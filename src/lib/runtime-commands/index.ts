import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "../db/telemetry";
import type { SafetyTag } from "../router";
import type { ReversibilityClass } from "../tools/types";

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
