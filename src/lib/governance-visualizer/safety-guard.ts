import { z } from "zod";

export const GOVERNANCE_BOUNDARY_SAFETY_GUARD_VERSION = "19C.2" as const;

export const GOVERNANCE_BOUNDARY_SAFETY_VIOLATION_KINDS = [
  "executable_payload",
  "raw_tool_arguments",
  "raw_approval_token",
  "raw_prompt",
  "raw_model_output",
  "raw_voice_or_audio",
  "raw_ocr_text",
  "raw_frame_or_screenshot",
  "project_file_body",
  "secret_material",
  "function_body",
  "shell_command",
  "action_affordance",
  "authority_creation_affordance",
  "policy_mutation_affordance",
] as const;

export const GOVERNANCE_BOUNDARY_SAFETY_SCAN_TARGETS = [
  "projection",
  "node",
  "edge",
  "policy",
  "tripwire",
  "warning",
  "query_result",
  "unknown_metadata",
] as const;

export type GovernanceBoundarySafetyViolationKind =
  (typeof GOVERNANCE_BOUNDARY_SAFETY_VIOLATION_KINDS)[number];
export type GovernanceBoundarySafetyScanTarget =
  (typeof GOVERNANCE_BOUNDARY_SAFETY_SCAN_TARGETS)[number];

export const GovernanceBoundarySafetyViolationKindSchema = z.enum(
  GOVERNANCE_BOUNDARY_SAFETY_VIOLATION_KINDS,
);
export const GovernanceBoundarySafetyScanTargetSchema = z.enum(
  GOVERNANCE_BOUNDARY_SAFETY_SCAN_TARGETS,
);

export const GovernanceBoundarySafetyViolationSchema = z.strictObject({
  violation_id: z
    .string()
    .trim()
    .regex(/^governance-boundary-violation:\d{4}$/),
  kind: GovernanceBoundarySafetyViolationKindSchema,
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
  recommendation: z.string().trim().min(1).max(260),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const GovernanceBoundarySafetyResultSchema = z.strictObject({
  policy_version: z.literal(GOVERNANCE_BOUNDARY_SAFETY_GUARD_VERSION),
  target_kind: GovernanceBoundarySafetyScanTargetSchema,
  passed: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(GovernanceBoundarySafetyViolationSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  diagnostics_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export type GovernanceBoundarySafetyViolation = z.infer<
  typeof GovernanceBoundarySafetyViolationSchema
>;
export type GovernanceBoundarySafetyResult = z.infer<
  typeof GovernanceBoundarySafetyResultSchema
>;

const FORBIDDEN_FIELD_KIND_BY_NAME: ReadonlyMap<
  string,
  GovernanceBoundarySafetyViolationKind
> = new Map([
  ["executable_payload", "executable_payload"],
  ["execution_payload", "executable_payload"],
  ["action_payload", "executable_payload"],
  ["tool_args", "raw_tool_arguments"],
  ["tool_arguments", "raw_tool_arguments"],
  ["raw_tool_arguments", "raw_tool_arguments"],
  ["approval_token", "raw_approval_token"],
  ["raw_approval_token", "raw_approval_token"],
  ["prompt", "raw_prompt"],
  ["prompts", "raw_prompt"],
  ["raw_prompt", "raw_prompt"],
  ["model_output", "raw_model_output"],
  ["raw_model_output", "raw_model_output"],
  ["raw_output", "raw_model_output"],
  ["voice_transcript", "raw_voice_or_audio"],
  ["raw_voice_transcript", "raw_voice_or_audio"],
  ["raw_voice", "raw_voice_or_audio"],
  ["audio", "raw_voice_or_audio"],
  ["raw_audio", "raw_voice_or_audio"],
  ["ocr_text", "raw_ocr_text"],
  ["raw_ocr_text", "raw_ocr_text"],
  ["raw_ocr", "raw_ocr_text"],
  ["frame", "raw_frame_or_screenshot"],
  ["frames", "raw_frame_or_screenshot"],
  ["raw_frame", "raw_frame_or_screenshot"],
  ["screenshot", "raw_frame_or_screenshot"],
  ["raw_screenshot", "raw_frame_or_screenshot"],
  ["project_file_body", "project_file_body"],
  ["project_body", "project_file_body"],
  ["file_body", "project_file_body"],
  ["secret", "secret_material"],
  ["secrets", "secret_material"],
  ["api_key", "secret_material"],
  ["apikey", "secret_material"],
  ["access_token", "secret_material"],
  ["refresh_token", "secret_material"],
  ["function_body", "function_body"],
  ["command", "shell_command"],
  ["shell_command", "shell_command"],
  ["script", "shell_command"],
]);

const ACTION_AFFORDANCE_NAMES = [
  "run",
  "retry",
  "execute",
  "approve",
  "mutate",
  "dispatch",
  "tool_call",
  "call_tool",
  "toolcall",
] as const;

const AUTHORITY_AFFORDANCE_NAMES = [
  "grant_authority",
  "grantauthority",
  "create_authority",
  "createauthority",
  "create_token",
  "createtoken",
  "issue_token",
  "issuetoken",
] as const;

const POLICY_MUTATION_AFFORDANCE_NAMES = [
  "mutate_policy",
  "mutatepolicy",
  "update_policy",
  "updatepolicy",
  "write_policy",
  "writepolicy",
  "acknowledge_tripwire",
  "acknowledgetripwire",
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
): GovernanceBoundarySafetyViolation["sample_class"] {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "function") return "function";
  return typeof value as GovernanceBoundarySafetyViolation["sample_class"];
}

function recommendationForKind(
  kind: GovernanceBoundarySafetyViolationKind,
): string {
  switch (kind) {
    case "executable_payload":
    case "function_body":
    case "shell_command":
      return "Remove executable content; governance visualizer data must stay read-only.";
    case "raw_tool_arguments":
    case "raw_approval_token":
    case "raw_prompt":
    case "raw_model_output":
    case "raw_voice_or_audio":
    case "raw_ocr_text":
    case "raw_frame_or_screenshot":
    case "project_file_body":
      return "Replace raw data with redacted references, counts, labels, or policy metadata.";
    case "secret_material":
      return "Remove secret material and expose only redaction-safe metadata.";
    case "action_affordance":
      return "Remove action affordances from governance boundary metadata.";
    case "authority_creation_affordance":
      return "Remove authority creation affordances; this layer is visibility only.";
    case "policy_mutation_affordance":
      return "Remove policy mutation affordances; tripwires are display metadata only.";
  }
}

function redactedSample(
  kind: GovernanceBoundarySafetyViolationKind,
  value: unknown,
): string {
  return `[redacted:${sampleClass(value)}:${kind}]`;
}

function kindForFieldName(
  fieldName: string,
): GovernanceBoundarySafetyViolationKind | null {
  const normalized = fieldName.trim().toLowerCase();
  if (ACTION_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "action_affordance";
  }
  if (AUTHORITY_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "authority_creation_affordance";
  }
  if (POLICY_MUTATION_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "policy_mutation_affordance";
  }

  return FORBIDDEN_FIELD_KIND_BY_NAME.get(normalized) ?? null;
}

function kindForStringValue(
  value: string,
): GovernanceBoundarySafetyViolationKind | null {
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
  violations: Omit<GovernanceBoundarySafetyViolation, "violation_id">[],
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
  readonly target_kind: GovernanceBoundarySafetyScanTarget;
  readonly violations: readonly Omit<
    GovernanceBoundarySafetyViolation,
    "violation_id"
  >[];
}): GovernanceBoundarySafetyResult {
  const violations = [...input.violations]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((item, index) =>
      GovernanceBoundarySafetyViolationSchema.parse({
        ...item,
        violation_id: `governance-boundary-violation:${String(index).padStart(
          4,
          "0",
        )}`,
      }),
    );

  return GovernanceBoundarySafetyResultSchema.parse({
    policy_version: GOVERNANCE_BOUNDARY_SAFETY_GUARD_VERSION,
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

export function listGovernanceBoundaryForbiddenFieldNames(): readonly string[] {
  return [...FORBIDDEN_FIELD_KIND_BY_NAME.keys()];
}

export function listGovernanceBoundaryForbiddenAffordanceNames(): readonly string[] {
  return [
    ...ACTION_AFFORDANCE_NAMES,
    ...AUTHORITY_AFFORDANCE_NAMES,
    ...POLICY_MUTATION_AFFORDANCE_NAMES,
  ];
}

export function scanGovernanceBoundarySafety(
  target: unknown,
  targetKind: GovernanceBoundarySafetyScanTarget = "unknown_metadata",
): GovernanceBoundarySafetyResult {
  const violations: Omit<GovernanceBoundarySafetyViolation, "violation_id">[] =
    [];
  collectViolations(target, "$", null, violations);

  return safetyResult({
    target_kind: targetKind,
    violations,
  });
}

export function assertGovernanceBoundarySafe(target: unknown): void {
  const result = scanGovernanceBoundarySafety(target);
  if (!result.passed) {
    const firstViolation = result.violations[0];
    throw new Error(
      `Governance boundary safety violation: ${firstViolation.kind} at ${firstViolation.path}`,
    );
  }
}
