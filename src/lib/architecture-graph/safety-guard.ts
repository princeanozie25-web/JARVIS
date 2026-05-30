import { z } from "zod";

import {
  type ArchitectureGraphProjection,
  ArchitectureGraphProjectionSchema,
} from "./projections";

export const ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION = "19A.5" as const;

export const ARCHITECTURE_GRAPH_SAFETY_VIOLATION_KINDS = [
  "raw_prompt",
  "raw_model_output",
  "raw_tool_arguments",
  "raw_approval_token",
  "raw_voice_transcript",
  "raw_audio_reference",
  "raw_ocr_text",
  "raw_screenshot",
  "raw_camera_frame",
  "secret_material",
  "executable_payload",
  "function_body",
  "shell_command",
  "action_affordance",
  "graph_driven_execution_affordance",
] as const;

export const ARCHITECTURE_GRAPH_SAFETY_SCAN_TARGETS = [
  "graph_contract",
  "static_registry_output",
  "query_output",
  "projection_output",
  "unknown_metadata",
] as const;

export const ARCHITECTURE_GRAPH_SAFETY_SEVERITIES = ["error"] as const;

export type ArchitectureGraphSafetyViolationKind =
  (typeof ARCHITECTURE_GRAPH_SAFETY_VIOLATION_KINDS)[number];
export type ArchitectureGraphSafetyScanTarget =
  (typeof ARCHITECTURE_GRAPH_SAFETY_SCAN_TARGETS)[number];

export const ArchitectureGraphSafetyViolationKindSchema = z.enum(
  ARCHITECTURE_GRAPH_SAFETY_VIOLATION_KINDS,
);
export const ArchitectureGraphSafetyScanTargetSchema = z.enum(
  ARCHITECTURE_GRAPH_SAFETY_SCAN_TARGETS,
);

export const ArchitectureGraphSafetyViolationSchema = z.strictObject({
  violation_id: z
    .string()
    .trim()
    .regex(/^arch-safety-violation:\d{4}$/),
  kind: ArchitectureGraphSafetyViolationKindSchema,
  path: z.string().trim().min(1).max(260),
  field_name: z.string().trim().min(1).max(120).nullable(),
  sample_class: z.enum([
    "array",
    "boolean",
    "function",
    "null",
    "number",
    "object",
    "string",
    "undefined",
  ]),
  redacted_sample: z.string().trim().min(1).max(120),
  severity: z.literal("error"),
  recommendation: z.string().trim().min(1).max(220),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const ArchitectureGraphSafetyPolicySchema = z.strictObject({
  policy_version: z.literal(ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION),
  policy_id: z.literal("architecture_graph_safety_policy"),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  forbidden_field_names: z.array(z.string().trim().min(1)),
  forbidden_affordance_names: z.array(z.string().trim().min(1)),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observer_created: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  mutation_performed: z.literal(false),
  authority_surface_created: z.literal(false),
});

export const ArchitectureGraphSafetyResultSchema = z.strictObject({
  policy_version: z.literal(ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION),
  target_kind: ArchitectureGraphSafetyScanTargetSchema,
  valid: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(ArchitectureGraphSafetyViolationSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  diagnostics_only: z.literal(true),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observer_created: z.literal(false),
  raw_value_included: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  mutation_performed: z.literal(false),
  authority_surface_created: z.literal(false),
});

export type ArchitectureGraphSafetyViolation = z.infer<
  typeof ArchitectureGraphSafetyViolationSchema
>;
export type ArchitectureGraphSafetyPolicy = z.infer<
  typeof ArchitectureGraphSafetyPolicySchema
>;
export type ArchitectureGraphSafetyResult = z.infer<
  typeof ArchitectureGraphSafetyResultSchema
>;

const FORBIDDEN_FIELD_KIND_BY_NAME: ReadonlyMap<
  string,
  ArchitectureGraphSafetyViolationKind
> = new Map([
  ["prompt", "raw_prompt"],
  ["raw_prompt", "raw_prompt"],
  ["prompts", "raw_prompt"],
  ["model_output", "raw_model_output"],
  ["raw_model_output", "raw_model_output"],
  ["model_outputs", "raw_model_output"],
  ["tool_args", "raw_tool_arguments"],
  ["tool_arguments", "raw_tool_arguments"],
  ["raw_tool_arguments", "raw_tool_arguments"],
  ["approval_token", "raw_approval_token"],
  ["raw_approval_token", "raw_approval_token"],
  ["voice_transcript", "raw_voice_transcript"],
  ["raw_voice_transcript", "raw_voice_transcript"],
  ["audio_reference", "raw_audio_reference"],
  ["raw_audio_reference", "raw_audio_reference"],
  ["audio_url", "raw_audio_reference"],
  ["ocr_text", "raw_ocr_text"],
  ["raw_ocr_text", "raw_ocr_text"],
  ["screenshot", "raw_screenshot"],
  ["raw_screenshot", "raw_screenshot"],
  ["camera_frame", "raw_camera_frame"],
  ["raw_camera_frame", "raw_camera_frame"],
  ["raw_frame", "raw_camera_frame"],
  ["frame", "raw_camera_frame"],
  ["frames", "raw_camera_frame"],
  ["secret", "secret_material"],
  ["secrets", "secret_material"],
  ["api_key", "secret_material"],
  ["apikey", "secret_material"],
  ["access_token", "secret_material"],
  ["refresh_token", "secret_material"],
  ["executable_payload", "executable_payload"],
  ["execution_payload", "executable_payload"],
  ["action_payload", "executable_payload"],
  ["function_body", "function_body"],
  ["shell_command", "shell_command"],
  ["command", "shell_command"],
  ["script", "shell_command"],
  ["graph_execute", "graph_driven_execution_affordance"],
  ["graph_run", "graph_driven_execution_affordance"],
  ["graph_dispatch", "graph_driven_execution_affordance"],
  ["graph_driven_execution", "graph_driven_execution_affordance"],
  ["execute_trace", "graph_driven_execution_affordance"],
]);

const FORBIDDEN_AFFORDANCE_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
  "calltool",
  "tool_call",
  "toolcall",
  "createapproval",
] as const;

const SECRET_VALUE_PATTERNS = [
  /\bsk-[a-z0-9_-]{10,}\b/i,
  /\bapi[_-]?key\s*[:=]\s*['"]?[a-z0-9_-]{10,}/i,
  /\bbearer\s+[a-z0-9._-]{12,}/i,
] as const;

const FUNCTION_BODY_PATTERNS = [
  /^\s*function\s+[a-z0-9_$]*\s*\(/i,
  /^\s*(async\s+)?\([^)]*\)\s*=>/i,
  /^\s*class\s+[a-z0-9_$]+/i,
] as const;

const SHELL_COMMAND_PATTERNS = [
  /^\s*(rm\s+-rf|del\s+\/[fq]|curl\s+https?:\/\/|wget\s+https?:\/\/|powershell\s+-|bash\s+-c|sh\s+-c|cmd\s+\/c)\b/i,
] as const;

export const DEFAULT_ARCHITECTURE_GRAPH_SAFETY_POLICY =
  ArchitectureGraphSafetyPolicySchema.parse({
    policy_version: ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION,
    policy_id: "architecture_graph_safety_policy",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    forbidden_field_names: [...FORBIDDEN_FIELD_KIND_BY_NAME.keys()],
    forbidden_affordance_names: [...FORBIDDEN_AFFORDANCE_NAMES],
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observer_created: false,
    action_executed: false,
    dispatch_performed: false,
    mutation_performed: false,
    authority_surface_created: false,
  });

function sampleClass(
  value: unknown,
): ArchitectureGraphSafetyViolation["sample_class"] {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "function") {
    return "function";
  }

  return typeof value as ArchitectureGraphSafetyViolation["sample_class"];
}

function redactedSample(
  kind: ArchitectureGraphSafetyViolationKind,
  value: unknown,
): string {
  return `[redacted:${sampleClass(value)}:${kind}]`;
}

function recommendationForKind(
  kind: ArchitectureGraphSafetyViolationKind,
): string {
  switch (kind) {
    case "raw_prompt":
    case "raw_model_output":
    case "raw_tool_arguments":
    case "raw_approval_token":
    case "raw_voice_transcript":
    case "raw_audio_reference":
    case "raw_ocr_text":
    case "raw_screenshot":
    case "raw_camera_frame":
      return "Replace raw data with redacted metadata, hashes, counts, or stable references.";
    case "secret_material":
      return "Remove secret material and expose only redaction-safe metadata.";
    case "executable_payload":
    case "function_body":
    case "shell_command":
      return "Remove executable content; architecture graph data must stay view-only metadata.";
    case "action_affordance":
    case "graph_driven_execution_affordance":
      return "Remove action affordances; architecture graph surfaces cannot trigger behavior.";
  }
}

function normalizedFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

function kindForFieldName(
  fieldName: string,
): ArchitectureGraphSafetyViolationKind | null {
  const normalized = normalizedFieldName(fieldName);
  if (FORBIDDEN_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "action_affordance";
  }

  return FORBIDDEN_FIELD_KIND_BY_NAME.get(normalized) ?? null;
}

function kindForStringValue(
  value: string,
): ArchitectureGraphSafetyViolationKind | null {
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "secret_material";
  }
  if (FUNCTION_BODY_PATTERNS.some((pattern) => pattern.test(value))) {
    return "function_body";
  }
  if (SHELL_COMMAND_PATTERNS.some((pattern) => pattern.test(value))) {
    return "shell_command";
  }

  return null;
}

function collectViolations(
  input: unknown,
  path: string,
  fieldName: string | null,
  violations: Omit<ArchitectureGraphSafetyViolation, "violation_id">[],
): void {
  if (fieldName) {
    const fieldKind = kindForFieldName(fieldName);
    if (fieldKind) {
      violations.push({
        kind: fieldKind,
        path,
        field_name: fieldName,
        sample_class: sampleClass(input),
        redacted_sample: redactedSample(fieldKind, input),
        severity: "error",
        recommendation: recommendationForKind(fieldKind),
        metadata_only: true,
        read_only: true,
        raw_value_included: false,
      });
      return;
    }
  }

  if (typeof input === "function") {
    const kind = "function_body";
    violations.push({
      kind,
      path,
      field_name: fieldName,
      sample_class: "function",
      redacted_sample: redactedSample(kind, input),
      severity: "error",
      recommendation: recommendationForKind(kind),
      metadata_only: true,
      read_only: true,
      raw_value_included: false,
    });
    return;
  }

  if (typeof input === "string") {
    const valueKind = kindForStringValue(input);
    if (valueKind) {
      violations.push({
        kind: valueKind,
        path,
        field_name: fieldName,
        sample_class: "string",
        redacted_sample: redactedSample(valueKind, input),
        severity: "error",
        recommendation: recommendationForKind(valueKind),
        metadata_only: true,
        read_only: true,
        raw_value_included: false,
      });
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      collectViolations(value, `${path}[${index}]`, null, violations);
    });
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    collectViolations(value, `${path}.${key}`, key, violations);
  }
}

function safetyResult(input: {
  readonly target_kind: ArchitectureGraphSafetyScanTarget;
  readonly violations: readonly Omit<
    ArchitectureGraphSafetyViolation,
    "violation_id"
  >[];
}): ArchitectureGraphSafetyResult {
  const violations = input.violations.map((item, index) =>
    ArchitectureGraphSafetyViolationSchema.parse({
      ...item,
      violation_id: `arch-safety-violation:${String(index).padStart(4, "0")}`,
    }),
  );

  return ArchitectureGraphSafetyResultSchema.parse({
    policy_version: ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION,
    target_kind: input.target_kind,
    valid: violations.length === 0,
    violation_count: violations.length,
    violations,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    diagnostics_only: true,
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observer_created: false,
    raw_value_included: false,
    action_executed: false,
    dispatch_performed: false,
    mutation_performed: false,
    authority_surface_created: false,
  });
}

export function listArchitectureGraphForbiddenFieldNames(): readonly string[] {
  return [...FORBIDDEN_FIELD_KIND_BY_NAME.keys()];
}

export function listArchitectureGraphForbiddenAffordanceNames(): readonly string[] {
  return [...FORBIDDEN_AFFORDANCE_NAMES];
}

export function scanArchitectureGraphSafety(
  target: unknown,
  targetKind: ArchitectureGraphSafetyScanTarget = "unknown_metadata",
): ArchitectureGraphSafetyResult {
  const violations: Omit<ArchitectureGraphSafetyViolation, "violation_id">[] =
    [];
  collectViolations(target, "$", null, violations);

  return safetyResult({
    target_kind: targetKind,
    violations,
  });
}

export function assertArchitectureGraphSafe(target: unknown): void {
  const result = scanArchitectureGraphSafety(target);
  if (!result.valid) {
    const firstViolation = result.violations[0];
    throw new Error(
      `Architecture graph safety violation: ${firstViolation.kind} at ${firstViolation.path}`,
    );
  }
}

export function scanArchitectureGraphProjectionSafety(
  projection: ArchitectureGraphProjection,
): ArchitectureGraphSafetyResult {
  const parsed = ArchitectureGraphProjectionSchema.parse(projection);
  return scanArchitectureGraphSafety(parsed, "projection_output");
}

export function assertArchitectureGraphProjectionSafe(
  projection: ArchitectureGraphProjection,
): void {
  const result = scanArchitectureGraphProjectionSafety(projection);
  if (!result.valid) {
    const firstViolation = result.violations[0];
    throw new Error(
      `Architecture graph projection safety violation: ${firstViolation.kind} at ${firstViolation.path}`,
    );
  }
}
