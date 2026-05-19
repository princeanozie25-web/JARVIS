import { createHash } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import {
  createRuntimeCommandCall,
  getRuntimeCommandCall,
  updateRuntimeCommandCallStatus,
  type RuntimeCommandCallRow,
} from "../db/runtime-command-calls";
import { insertTelemetryEvent } from "../db/telemetry";
import type { SafetyTag } from "../router";
import type { ReversibilityClass } from "../tools/types";
export {
  RuntimeExecutionController,
  cancelAllRuntimeCommands,
  cancelRuntimeCommandCall,
  runtimeExecutionController,
} from "./execution-controller";
export type {
  CreateRuntimeExecutionContextInput,
  RuntimeCancellationInput,
  RuntimeCancellationSource,
  RuntimeExecutionContext,
  RuntimeGlobalCancellationInput,
} from "./execution-controller";
export {
  RUNTIME_COMMAND_OUTPUT_LIMIT_BYTES,
  RuntimeCommandExecutor,
  RuntimeStreamEventEmitter,
  executeRuntimeCommand,
  streamRuntimeCommandExecution,
} from "./executor";
export type {
  ExecuteRuntimeCommandInput,
  RuntimeChildProcess,
  RuntimeCommandCapturedOutput,
  RuntimeCommandExecutionResult,
  RuntimeCommandSpawn,
  RuntimeCommandStream,
  RuntimeStreamEvent,
  StreamRuntimeCommandExecutionInput,
} from "./executor";

export type RuntimeCommandId =
  | "git.status"
  | "git.log"
  | "git.diff_stat"
  | "node.version";

export interface RuntimeCommandStructuredArgSchema {
  type: "argv";
  allowed: string[][];
}

export type RuntimeCommandWorkingDirectoryPolicy =
  | { type: "repo_root" }
  | { type: "none" };

export interface RuntimeCommandEnvironmentPolicy {
  inherit: false;
  allowedEnv: string[];
}

export interface RuntimeCommandSpec {
  id: string;
  command: string;
  allowedArgsPattern?: string;
  structuredArgSchema?: RuntimeCommandStructuredArgSchema;
  description: string;
  requiredSafetyTag: SafetyTag;
  reversibilityClass: ReversibilityClass;
  timeoutMs: number;
  workingDirectoryPolicy: RuntimeCommandWorkingDirectoryPolicy;
  environmentPolicy: RuntimeCommandEnvironmentPolicy;
  enabled: boolean;
}

export interface RuntimeCommandValidationInput {
  id: string;
  args?: string[];
}

export type RuntimeCommandValidationResult =
  | { ok: true; spec: RuntimeCommandSpec; args: string[] }
  | { ok: false; status: "disabled" | "not_found" | "invalid"; reason: string };

export interface RuntimeCommandRegistryOptions {
  db?: DatabaseType.Database;
  now?: () => number;
}

export interface ProposeRuntimeCommandCallInput {
  sessionId: string;
  commandId: string;
  argv?: string[];
  workingDirectory: string;
  callId?: string;
  registry?: RuntimeCommandRegistry;
  now?: () => number;
  newId?: () => string;
}

export interface RuntimeCommandApprovalMetadata {
  requiredSafetyTag: SafetyTag;
  scopeHash: string;
  approvalRequired: boolean;
  decision: "PENDING";
}

export type RuntimeCommandProposalResult =
  | {
      ok: true;
      call: RuntimeCommandCallRow;
      callId: string;
      approval: RuntimeCommandApprovalMetadata;
    }
  | { ok: false; status: "disabled" | "not_found" | "invalid"; reason: string };

export type RuntimeCommandApprovalResult =
  | { ok: true; call: RuntimeCommandCallRow }
  | { ok: false; status: "not_found" | "not_pending"; reason: string };

const DANGEROUS_SHELL_TOKEN_PATTERNS: RegExp[] = [
  /;/,
  /&/,
  /\|/,
  /`/,
  /\$\(/,
  /\$\{/,
  />/,
  /</,
];

function emitTelemetry(
  input: RuntimeCommandRegistryOptions & {
    eventType:
      | "runtime_command_registered"
      | "runtime_command_registry_read"
      | "runtime_command_validation_failed";
    success: boolean;
    commandId?: string;
    reason?: string;
  },
): void {
  if (!input.db) return;
  insertTelemetryEvent(input.db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: input.eventType,
    success: input.success,
    notes: [
      input.commandId ? `command_id=${input.commandId}` : undefined,
      input.reason ? `reason=${input.reason}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

function hasDangerousShellToken(value: string): boolean {
  return DANGEROUS_SHELL_TOKEN_PATTERNS.some((pattern) => pattern.test(value));
}

function newCallId(): string {
  return globalThis.crypto.randomUUID();
}

export function runtimeCommandScopeHash(input: {
  commandId: string;
  argv: string[];
  workingDirectory: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        commandId: input.commandId,
        argv: input.argv,
        workingDirectory: input.workingDirectory,
      }),
      "utf8",
    )
    .digest("hex");
}

function validateSpec(spec: RuntimeCommandSpec): void {
  if (!spec.id.trim()) throw new Error("Runtime command id is required");
  if (!spec.command.trim()) throw new Error("Runtime command is required");
  if (hasDangerousShellToken(spec.command)) {
    throw new Error(`Runtime command contains unsafe shell token: ${spec.id}`);
  }
  if (spec.reversibilityClass !== "PURE_READ") {
    throw new Error(`Runtime command must be read-only: ${spec.id}`);
  }
  if (spec.requiredSafetyTag !== "ALLOW") {
    throw new Error(`Runtime command must require ALLOW safety: ${spec.id}`);
  }
  if (!Number.isInteger(spec.timeoutMs) || spec.timeoutMs <= 0) {
    throw new Error(`Runtime command timeout must be positive: ${spec.id}`);
  }
}

function argsAllowedBySchema(
  schema: RuntimeCommandStructuredArgSchema | undefined,
  args: string[],
): boolean {
  if (!schema) return true;
  return schema.allowed.some(
    (allowed) =>
      allowed.length === args.length &&
      allowed.every((value, index) => value === args[index]),
  );
}

function argsAllowedByPattern(
  pattern: string | undefined,
  args: string[],
): boolean {
  if (!pattern) return true;
  return new RegExp(pattern).test(args.join(" "));
}

export class RuntimeCommandRegistry {
  private specs = new Map<string, RuntimeCommandSpec>();

  register(
    spec: RuntimeCommandSpec,
    options: RuntimeCommandRegistryOptions = {},
  ): void {
    validateSpec(spec);
    if (this.specs.has(spec.id)) {
      throw new Error(`Runtime command already registered: ${spec.id}`);
    }
    this.specs.set(spec.id, { ...spec });
    emitTelemetry({
      ...options,
      eventType: "runtime_command_registered",
      success: true,
      commandId: spec.id,
    });
  }

  get(
    id: string,
    options: RuntimeCommandRegistryOptions = {},
  ): RuntimeCommandSpec {
    const spec = this.specs.get(id);
    emitTelemetry({
      ...options,
      eventType: "runtime_command_registry_read",
      success: spec !== undefined,
      commandId: id,
      reason: spec ? undefined : "not_found",
    });
    if (!spec) throw new Error(`Runtime command not registered: ${id}`);
    return { ...spec };
  }

  list(options: RuntimeCommandRegistryOptions = {}): RuntimeCommandSpec[] {
    const specs = Array.from(this.specs.values())
      .map((spec) => ({ ...spec }))
      .sort((left, right) => left.id.localeCompare(right.id));
    emitTelemetry({
      ...options,
      eventType: "runtime_command_registry_read",
      success: true,
      reason: `rows=${specs.length}`,
    });
    return specs;
  }

  validateInput(
    input: RuntimeCommandValidationInput,
    options: RuntimeCommandRegistryOptions = {},
  ): RuntimeCommandValidationResult {
    const spec = this.specs.get(input.id);
    if (!spec) {
      emitTelemetry({
        ...options,
        eventType: "runtime_command_validation_failed",
        success: false,
        commandId: input.id,
        reason: "not_found",
      });
      return { ok: false, status: "not_found", reason: "not_found" };
    }
    if (!spec.enabled) {
      emitTelemetry({
        ...options,
        eventType: "runtime_command_validation_failed",
        success: false,
        commandId: input.id,
        reason: "disabled",
      });
      return { ok: false, status: "disabled", reason: "disabled" };
    }

    const args = input.args ?? [];
    const unsafeArg = args.find(hasDangerousShellToken);
    if (unsafeArg) {
      emitTelemetry({
        ...options,
        eventType: "runtime_command_validation_failed",
        success: false,
        commandId: input.id,
        reason: "dangerous_shell_metacharacter",
      });
      return {
        ok: false,
        status: "invalid",
        reason: `dangerous shell metacharacter rejected in argument: ${unsafeArg}`,
      };
    }
    if (!argsAllowedBySchema(spec.structuredArgSchema, args)) {
      emitTelemetry({
        ...options,
        eventType: "runtime_command_validation_failed",
        success: false,
        commandId: input.id,
        reason: "args_not_allowed",
      });
      return { ok: false, status: "invalid", reason: "args_not_allowed" };
    }
    if (!argsAllowedByPattern(spec.allowedArgsPattern, args)) {
      emitTelemetry({
        ...options,
        eventType: "runtime_command_validation_failed",
        success: false,
        commandId: input.id,
        reason: "args_pattern_mismatch",
      });
      return {
        ok: false,
        status: "invalid",
        reason: "args_pattern_mismatch",
      };
    }
    return { ok: true, spec: { ...spec }, args: [...args] };
  }
}

const readOnlyEnvironmentPolicy: RuntimeCommandEnvironmentPolicy = {
  inherit: false,
  allowedEnv: [],
};

export const INITIAL_RUNTIME_COMMAND_SPECS: RuntimeCommandSpec[] = [
  {
    id: "git.status",
    command: "git",
    structuredArgSchema: { type: "argv", allowed: [["status", "--short"]] },
    description: "Show concise repository status metadata.",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    timeoutMs: 5_000,
    workingDirectoryPolicy: { type: "repo_root" },
    environmentPolicy: readOnlyEnvironmentPolicy,
    enabled: true,
  },
  {
    id: "git.log",
    command: "git",
    structuredArgSchema: {
      type: "argv",
      allowed: [["log", "--oneline", "-n", "20"]],
    },
    description: "Show recent commit metadata.",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    timeoutMs: 5_000,
    workingDirectoryPolicy: { type: "repo_root" },
    environmentPolicy: readOnlyEnvironmentPolicy,
    enabled: true,
  },
  {
    id: "git.diff_stat",
    command: "git",
    structuredArgSchema: { type: "argv", allowed: [["diff", "--stat"]] },
    description: "Show diff statistics metadata.",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    timeoutMs: 5_000,
    workingDirectoryPolicy: { type: "repo_root" },
    environmentPolicy: readOnlyEnvironmentPolicy,
    enabled: true,
  },
  {
    id: "node.version",
    command: "node",
    structuredArgSchema: { type: "argv", allowed: [["--version"]] },
    description: "Show Node.js version metadata.",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    timeoutMs: 5_000,
    workingDirectoryPolicy: { type: "none" },
    environmentPolicy: readOnlyEnvironmentPolicy,
    enabled: true,
  },
];

export function createDefaultRuntimeCommandRegistry(): RuntimeCommandRegistry {
  const registry = new RuntimeCommandRegistry();
  for (const spec of INITIAL_RUNTIME_COMMAND_SPECS) {
    registry.register(spec);
  }
  return registry;
}

export const runtimeCommandRegistry = createDefaultRuntimeCommandRegistry();

export function registerRuntimeCommand(
  spec: RuntimeCommandSpec,
  options: RuntimeCommandRegistryOptions = {},
): void {
  runtimeCommandRegistry.register(spec, options);
}

export function listRuntimeCommands(
  options: RuntimeCommandRegistryOptions = {},
): RuntimeCommandSpec[] {
  return runtimeCommandRegistry.list(options);
}

export function getRuntimeCommand(
  id: string,
  options: RuntimeCommandRegistryOptions = {},
): RuntimeCommandSpec {
  return runtimeCommandRegistry.get(id, options);
}

export function validateRuntimeCommandInput(
  input: RuntimeCommandValidationInput,
  options: RuntimeCommandRegistryOptions = {},
): RuntimeCommandValidationResult {
  return runtimeCommandRegistry.validateInput(input, options);
}

function emitRuntimeCommandApprovalTelemetry(
  db: DatabaseType.Database,
  input: {
    eventType:
      | "runtime_command_proposed"
      | "runtime_command_approved"
      | "runtime_command_denied"
      | "runtime_command_approval_expired";
    timestamp: number;
    success: boolean;
    callId: string;
    commandId: string;
    notes?: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.timestamp,
    event_type: input.eventType,
    success: input.success,
    execution_id: input.callId,
    tool_name: input.commandId,
    notes: [
      `call_id=${input.callId}`,
      `command_id=${input.commandId}`,
      input.notes,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

function registryFor(
  registry: RuntimeCommandRegistry | undefined,
): RuntimeCommandRegistry {
  return registry ?? runtimeCommandRegistry;
}

export function proposeRuntimeCommandCall(
  db: DatabaseType.Database,
  input: ProposeRuntimeCommandCallInput,
): RuntimeCommandProposalResult {
  const registry = registryFor(input.registry);
  const validated = registry.validateInput(
    { id: input.commandId, args: input.argv },
    { db, now: input.now },
  );
  if (!validated.ok) return validated;

  const proposedAt = input.now?.() ?? Date.now();
  const callId = input.callId ?? input.newId?.() ?? newCallId();
  const scopeHash = runtimeCommandScopeHash({
    commandId: validated.spec.id,
    argv: validated.args,
    workingDirectory: input.workingDirectory,
  });
  const call = createRuntimeCommandCall(db, {
    id: callId,
    sessionId: input.sessionId,
    commandId: validated.spec.id,
    command: validated.spec.command,
    argv: validated.args,
    workingDirectory: input.workingDirectory,
    requiredSafetyTag: validated.spec.requiredSafetyTag,
    reversibilityClass: validated.spec.reversibilityClass,
    status: "pending",
    proposedAt,
  });
  const approval: RuntimeCommandApprovalMetadata = {
    requiredSafetyTag: validated.spec.requiredSafetyTag,
    scopeHash,
    approvalRequired: validated.spec.requiredSafetyTag !== "ALLOW",
    decision: "PENDING",
  };

  emitRuntimeCommandApprovalTelemetry(db, {
    eventType: "runtime_command_proposed",
    timestamp: proposedAt,
    success: true,
    callId,
    commandId: validated.spec.id,
    notes: `required_safety_tag=${approval.requiredSafetyTag} scope_hash=${approval.scopeHash} approval_required=${approval.approvalRequired}`,
  });

  return { ok: true, call, callId, approval };
}

function updatePendingRuntimeCommandApproval(
  db: DatabaseType.Database,
  input: {
    callId: string;
    status: "approved" | "denied";
    at?: number;
    eventType:
      | "runtime_command_approved"
      | "runtime_command_denied"
      | "runtime_command_approval_expired";
    errorClass?: string;
    errorMessage?: string;
  },
): RuntimeCommandApprovalResult {
  const row = getRuntimeCommandCall(db, input.callId);
  if (!row) {
    return { ok: false, status: "not_found", reason: "not_found" };
  }
  if (row.status !== "pending") {
    return { ok: false, status: "not_pending", reason: "not_pending" };
  }

  const at = input.at ?? Date.now();
  const updated = updateRuntimeCommandCallStatus(db, input.callId, {
    status: input.status,
    at,
    errorClass: input.errorClass,
    errorMessage: input.errorMessage,
  });
  if (!updated) {
    return { ok: false, status: "not_found", reason: "not_found" };
  }

  emitRuntimeCommandApprovalTelemetry(db, {
    eventType: input.eventType,
    timestamp: at,
    success: true,
    callId: updated.id,
    commandId: updated.command_id,
    notes: `status=${updated.status}`,
  });

  return { ok: true, call: updated };
}

export function approveRuntimeCommandCall(
  db: DatabaseType.Database,
  input: { callId: string; approvedAt?: number },
): RuntimeCommandApprovalResult {
  return updatePendingRuntimeCommandApproval(db, {
    callId: input.callId,
    status: "approved",
    at: input.approvedAt,
    eventType: "runtime_command_approved",
  });
}

export function denyRuntimeCommandCall(
  db: DatabaseType.Database,
  input: { callId: string; deniedAt?: number; reason?: string },
): RuntimeCommandApprovalResult {
  return updatePendingRuntimeCommandApproval(db, {
    callId: input.callId,
    status: "denied",
    at: input.deniedAt,
    eventType: "runtime_command_denied",
    errorClass: "RuntimeCommandApprovalDenied",
    errorMessage: input.reason ?? "Runtime command approval denied.",
  });
}

export function markRuntimeCommandApprovalExpired(
  db: DatabaseType.Database,
  input: { callId: string; expiredAt?: number },
): RuntimeCommandApprovalResult {
  return updatePendingRuntimeCommandApproval(db, {
    callId: input.callId,
    status: "denied",
    at: input.expiredAt,
    eventType: "runtime_command_approval_expired",
    errorClass: "RuntimeCommandApprovalExpired",
    errorMessage: "Runtime command approval expired.",
  });
}
