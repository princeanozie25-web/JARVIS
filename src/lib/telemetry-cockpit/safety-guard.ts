import { z } from "zod";

export const TELEMETRY_COCKPIT_SAFETY_GUARD_VERSION = "19B.2" as const;

export const TELEMETRY_COCKPIT_SAFETY_VIOLATION_KINDS = [
  "raw_prompt",
  "raw_model_output",
  "raw_tool_arguments",
  "raw_approval_token",
  "raw_voice_transcript",
  "raw_audio",
  "raw_ocr_text",
  "raw_screenshot_or_frame",
  "project_file_body",
  "secret_material",
  "executable_payload",
  "function_body",
  "shell_command",
  "action_affordance",
  "live_observer_affordance",
] as const;

export const TELEMETRY_COCKPIT_SAFETY_SCAN_TARGETS = [
  "projection",
  "panel",
  "metric",
  "alert",
  "warning",
  "query_result",
  "unknown_metadata",
] as const;

export const TelemetryCockpitSafetyViolationKindSchema = z.enum(
  TELEMETRY_COCKPIT_SAFETY_VIOLATION_KINDS,
);
export const TelemetryCockpitSafetyScanTargetSchema = z.enum(
  TELEMETRY_COCKPIT_SAFETY_SCAN_TARGETS,
);

export type TelemetryCockpitSafetyViolationKind =
  (typeof TELEMETRY_COCKPIT_SAFETY_VIOLATION_KINDS)[number];
export type TelemetryCockpitSafetyScanTarget =
  (typeof TELEMETRY_COCKPIT_SAFETY_SCAN_TARGETS)[number];

export const TelemetryCockpitSafetyViolationSchema = z.strictObject({
  violation_id: z
    .string()
    .trim()
    .regex(/^telemetry-cockpit-violation:\d{4}$/),
  kind: TelemetryCockpitSafetyViolationKindSchema,
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
  redacted_sample: z.string().trim().min(1).max(140),
  severity: z.literal("error"),
  recommendation: z.string().trim().min(1).max(240),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const TelemetryCockpitSafetyResultSchema = z.strictObject({
  policy_version: z.literal(TELEMETRY_COCKPIT_SAFETY_GUARD_VERSION),
  target_kind: TelemetryCockpitSafetyScanTargetSchema,
  passed: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(TelemetryCockpitSafetyViolationSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  diagnostics_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export type TelemetryCockpitSafetyViolation = z.infer<
  typeof TelemetryCockpitSafetyViolationSchema
>;
export type TelemetryCockpitSafetyResult = z.infer<
  typeof TelemetryCockpitSafetyResultSchema
>;

const FORBIDDEN_FIELD_KIND_BY_NAME: ReadonlyMap<
  string,
  TelemetryCockpitSafetyViolationKind
> = new Map([
  ["prompt", "raw_prompt"],
  ["prompts", "raw_prompt"],
  ["raw_prompt", "raw_prompt"],
  ["model_output", "raw_model_output"],
  ["model_outputs", "raw_model_output"],
  ["raw_model_output", "raw_model_output"],
  ["tool_args", "raw_tool_arguments"],
  ["tool_arguments", "raw_tool_arguments"],
  ["raw_tool_arguments", "raw_tool_arguments"],
  ["approval_token", "raw_approval_token"],
  ["raw_approval_token", "raw_approval_token"],
  ["voice_transcript", "raw_voice_transcript"],
  ["raw_voice_transcript", "raw_voice_transcript"],
  ["audio", "raw_audio"],
  ["raw_audio", "raw_audio"],
  ["audio_reference", "raw_audio"],
  ["ocr_text", "raw_ocr_text"],
  ["raw_ocr_text", "raw_ocr_text"],
  ["screenshot", "raw_screenshot_or_frame"],
  ["raw_screenshot", "raw_screenshot_or_frame"],
  ["frame", "raw_screenshot_or_frame"],
  ["frames", "raw_screenshot_or_frame"],
  ["raw_frame", "raw_screenshot_or_frame"],
  ["project_file_body", "project_file_body"],
  ["project_body", "project_file_body"],
  ["file_body", "project_file_body"],
  ["secret", "secret_material"],
  ["secrets", "secret_material"],
  ["api_key", "secret_material"],
  ["apikey", "secret_material"],
  ["access_token", "secret_material"],
  ["refresh_token", "secret_material"],
  ["executable_payload", "executable_payload"],
  ["execution_payload", "executable_payload"],
  ["function_body", "function_body"],
  ["command", "shell_command"],
  ["shell_command", "shell_command"],
  ["script", "shell_command"],
]);

const FORBIDDEN_AFFORDANCE_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
  "call_tool",
  "tool_call",
  "toolcall",
  "createapproval",
] as const;

const FORBIDDEN_LIVE_AFFORDANCE_NAMES = [
  "poll",
  "polling",
  "websocket",
  "live_stream",
  "livestream",
  "runtime_observer",
  "observer",
  "subscribe",
  "collector",
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

function sampleClass(
  value: unknown,
): TelemetryCockpitSafetyViolation["sample_class"] {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "function") return "function";
  return typeof value as TelemetryCockpitSafetyViolation["sample_class"];
}

function recommendationForKind(
  kind: TelemetryCockpitSafetyViolationKind,
): string {
  switch (kind) {
    case "raw_prompt":
    case "raw_model_output":
    case "raw_tool_arguments":
    case "raw_approval_token":
    case "raw_voice_transcript":
    case "raw_audio":
    case "raw_ocr_text":
    case "raw_screenshot_or_frame":
    case "project_file_body":
      return "Replace raw data with redacted references, hashes, counts, or bands.";
    case "secret_material":
      return "Remove secret material and expose only redaction-safe metadata.";
    case "executable_payload":
    case "function_body":
    case "shell_command":
      return "Remove executable content; telemetry cockpit data must stay read-only.";
    case "action_affordance":
      return "Remove action affordances from telemetry cockpit metadata.";
    case "live_observer_affordance":
      return "Keep live observers, polling, and streams out of this slice.";
  }
}

function redactedSample(
  kind: TelemetryCockpitSafetyViolationKind,
  value: unknown,
): string {
  return `[redacted:${sampleClass(value)}:${kind}]`;
}

function normalizedFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

function kindForFieldName(
  fieldName: string,
): TelemetryCockpitSafetyViolationKind | null {
  const normalized = normalizedFieldName(fieldName);
  if (FORBIDDEN_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "action_affordance";
  }
  if (FORBIDDEN_LIVE_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "live_observer_affordance";
  }

  return FORBIDDEN_FIELD_KIND_BY_NAME.get(normalized) ?? null;
}

function kindForStringValue(
  value: string,
): TelemetryCockpitSafetyViolationKind | null {
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
  violations: Omit<TelemetryCockpitSafetyViolation, "violation_id">[],
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
  readonly target_kind: TelemetryCockpitSafetyScanTarget;
  readonly violations: readonly Omit<
    TelemetryCockpitSafetyViolation,
    "violation_id"
  >[];
}): TelemetryCockpitSafetyResult {
  const violations = [...input.violations]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((item, index) =>
      TelemetryCockpitSafetyViolationSchema.parse({
        ...item,
        violation_id: `telemetry-cockpit-violation:${String(index).padStart(
          4,
          "0",
        )}`,
      }),
    );

  return TelemetryCockpitSafetyResultSchema.parse({
    policy_version: TELEMETRY_COCKPIT_SAFETY_GUARD_VERSION,
    target_kind: input.target_kind,
    passed: violations.length === 0,
    violation_count: violations.length,
    violations,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    diagnostics_only: true,
    raw_value_included: false,
  });
}

export function listTelemetryCockpitForbiddenFieldNames(): readonly string[] {
  return [...FORBIDDEN_FIELD_KIND_BY_NAME.keys()];
}

export function listTelemetryCockpitForbiddenAffordanceNames(): readonly string[] {
  return [...FORBIDDEN_AFFORDANCE_NAMES, ...FORBIDDEN_LIVE_AFFORDANCE_NAMES];
}

export function scanTelemetryCockpitSafety(
  target: unknown,
  targetKind: TelemetryCockpitSafetyScanTarget = "unknown_metadata",
): TelemetryCockpitSafetyResult {
  const violations: Omit<TelemetryCockpitSafetyViolation, "violation_id">[] =
    [];
  collectViolations(target, "$", null, violations);

  return safetyResult({
    target_kind: targetKind,
    violations,
  });
}

export function assertTelemetryCockpitSafe(target: unknown): void {
  const result = scanTelemetryCockpitSafety(target);
  if (!result.passed) {
    const firstViolation = result.violations[0];
    throw new Error(
      `Telemetry cockpit safety violation: ${firstViolation.kind} at ${firstViolation.path}`,
    );
  }
}
