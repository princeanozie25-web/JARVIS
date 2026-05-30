import { z } from "zod";

export const RED_TEAM_SANDBOX_SAFETY_GUARD_VERSION = "19D.2" as const;

export const RED_TEAM_SANDBOX_SAFETY_VIOLATION_KINDS = [
  "executable_payload",
  "shell_command",
  "network_scan_command",
  "exploit_payload",
  "credential_attack",
  "secret_material",
  "raw_tool_arguments",
  "approval_token",
  "authority_token_creation",
  "external_target",
  "unsafe_filesystem_path",
  "action_affordance",
  "cai_execution_affordance",
  "cai_sidecar_affordance",
] as const;

export const RED_TEAM_SANDBOX_SAFETY_SCAN_TARGETS = [
  "profile",
  "proposal",
  "plan",
  "audit_preview",
  "query_result",
  "unknown_metadata",
] as const;

export type RedTeamSandboxSafetyViolationKind =
  (typeof RED_TEAM_SANDBOX_SAFETY_VIOLATION_KINDS)[number];
export type RedTeamSandboxSafetyScanTarget =
  (typeof RED_TEAM_SANDBOX_SAFETY_SCAN_TARGETS)[number];

export const RedTeamSandboxSafetyViolationKindSchema = z.enum(
  RED_TEAM_SANDBOX_SAFETY_VIOLATION_KINDS,
);
export const RedTeamSandboxSafetyScanTargetSchema = z.enum(
  RED_TEAM_SANDBOX_SAFETY_SCAN_TARGETS,
);

export const RedTeamSandboxSafetyViolationSchema = z.strictObject({
  violation_id: z
    .string()
    .trim()
    .regex(/^red-team-safety-violation:\d{4}$/),
  kind: RedTeamSandboxSafetyViolationKindSchema,
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
  recommendation: z.string().trim().min(1).max(280),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const RedTeamSandboxSafetyResultSchema = z.strictObject({
  policy_version: z.literal(RED_TEAM_SANDBOX_SAFETY_GUARD_VERSION),
  target_kind: RedTeamSandboxSafetyScanTargetSchema,
  passed: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(RedTeamSandboxSafetyViolationSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  diagnostics_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export type RedTeamSandboxSafetyViolation = z.infer<
  typeof RedTeamSandboxSafetyViolationSchema
>;
export type RedTeamSandboxSafetyResult = z.infer<
  typeof RedTeamSandboxSafetyResultSchema
>;

const FORBIDDEN_FIELD_KIND_BY_NAME: ReadonlyMap<
  string,
  RedTeamSandboxSafetyViolationKind
> = new Map([
  ["executable_payload", "executable_payload"],
  ["execution_payload", "executable_payload"],
  ["function_body", "executable_payload"],
  ["script", "shell_command"],
  ["command", "shell_command"],
  ["shell_command", "shell_command"],
  ["shell_commands", "shell_command"],
  ["network_scan", "network_scan_command"],
  ["scan_target", "network_scan_command"],
  ["nmap_command", "network_scan_command"],
  ["exploit", "exploit_payload"],
  ["exploit_payload", "exploit_payload"],
  ["payload", "exploit_payload"],
  ["credential_attack", "credential_attack"],
  ["credential", "credential_attack"],
  ["credentials", "credential_attack"],
  ["password", "credential_attack"],
  ["secret", "secret_material"],
  ["secrets", "secret_material"],
  ["api_key", "secret_material"],
  ["apikey", "secret_material"],
  ["access_token", "secret_material"],
  ["refresh_token", "secret_material"],
  ["tool_args", "raw_tool_arguments"],
  ["tool_arguments", "raw_tool_arguments"],
  ["raw_tool_arguments", "raw_tool_arguments"],
  ["approval_token", "approval_token"],
  ["raw_approval_token", "approval_token"],
  ["authority_token", "authority_token_creation"],
  ["create_authority_token", "authority_token_creation"],
  ["issue_authority_token", "authority_token_creation"],
  ["external_target", "external_target"],
  ["external_url", "external_target"],
  ["external_ip", "external_target"],
  ["public_target", "external_target"],
  ["filesystem_path", "unsafe_filesystem_path"],
  ["file_path", "unsafe_filesystem_path"],
  ["absolute_path", "unsafe_filesystem_path"],
]);

const ACTION_AFFORDANCE_NAMES = [
  "run",
  "retry",
  "execute",
  "dispatch",
  "mutate",
  "approve",
  "tool_call",
  "call_tool",
  "toolcall",
] as const;

const CAI_EXECUTION_AFFORDANCE_NAMES = [
  "cai_execute",
  "execute_cai",
  "call_cai",
  "cai_run",
  "run_cai",
  "invoke_cai",
] as const;

const CAI_SIDECAR_AFFORDANCE_NAMES = [
  "python_sidecar",
  "create_sidecar",
  "start_sidecar",
  "sidecar_process",
  "install_cai",
] as const;

const SECRET_VALUE_PATTERNS = [
  /\bsk-[a-z0-9_-]{10,}\b/i,
  /\bapi[_-]?key\s*[:=]\s*['"]?[a-z0-9_-]{10,}/i,
  /\bbearer\s+[a-z0-9._-]{12,}/i,
  /\bpassword\s*[:=]\s*['"]?[^'"\s]{6,}/i,
] as const;

const SHELL_VALUE_PATTERNS = [
  /^\s*(rm\s+-rf|del\s+\/[fq]|curl\s+https?:\/\/|wget\s+https?:\/\/|powershell\s+-|bash\s+-c|sh\s+-c|cmd\s+\/c)\b/i,
] as const;

const NETWORK_SCAN_VALUE_PATTERNS = [
  /^\s*(nmap|masscan|zmap|nikto|sqlmap)\b/i,
  /\b(network[_ -]?scan|port[_ -]?scan|scan\s+ports)\b/i,
] as const;

const EXECUTABLE_VALUE_PATTERNS = [
  /^\s*function\s+[a-z0-9_$]*\s*\(/i,
  /^\s*(async\s+)?\([^)]*\)\s*=>/i,
  /^\s*class\s+[a-z0-9_$]+/i,
] as const;

const EXPLOIT_VALUE_PATTERNS = [
  /\b(reverse shell|meterpreter|payload\s*=|exploit\s+module|rce exploit)\b/i,
] as const;

const CREDENTIAL_ATTACK_VALUE_PATTERNS = [
  /\b(password spray|credential stuffing|bruteforce|brute force|hash dump)\b/i,
] as const;

const CAI_EXECUTION_VALUE_PATTERNS = [
  /\b(cai\s+(run|execute|invoke)|python\s+-m\s+cai)\b/i,
] as const;

const CAI_SIDECAR_VALUE_PATTERNS = [
  /\b(start\s+sidecar|python\s+sidecar|cai\s+sidecar)\b/i,
] as const;

const EXTERNAL_URL_PATTERN =
  /https?:\/\/(?!localhost\b|127\.0\.0\.1\b|\[::1\]\b)[a-z0-9.-]+/i;
const EXTERNAL_IPV4_PATTERN = /\b(?!(?:127|0)\.)(?:\d{1,3}\.){3}\d{1,3}\b/;
const UNSAFE_PATH_PATTERN =
  /(^[a-z]:\\|^\\\\|^\/(?:etc|home|root|users|var|private)\b|\.\.\/|\.\.\\)/i;

function sampleClass(
  value: unknown,
): RedTeamSandboxSafetyViolation["sample_class"] {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "function") return "function";
  return typeof value as RedTeamSandboxSafetyViolation["sample_class"];
}

function recommendationForKind(
  kind: RedTeamSandboxSafetyViolationKind,
): string {
  switch (kind) {
    case "executable_payload":
    case "shell_command":
    case "network_scan_command":
    case "exploit_payload":
    case "credential_attack":
    case "action_affordance":
    case "cai_execution_affordance":
    case "cai_sidecar_affordance":
      return "Remove active red-team capability affordances; Phase 19D.2 is metadata-only.";
    case "secret_material":
    case "raw_tool_arguments":
    case "approval_token":
    case "authority_token_creation":
      return "Remove sensitive material and expose only redacted policy metadata.";
    case "external_target":
      return "Replace external targets with localhost-only, repo-static, or synthetic metadata.";
    case "unsafe_filesystem_path":
      return "Replace raw filesystem paths with synthetic or repo-static metadata references.";
  }
}

function redactedSample(
  kind: RedTeamSandboxSafetyViolationKind,
  value: unknown,
): string {
  return `[redacted:${sampleClass(value)}:${kind}]`;
}

function kindForFieldName(
  fieldName: string,
): RedTeamSandboxSafetyViolationKind | null {
  const normalized = fieldName.trim().toLowerCase();
  if (ACTION_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "action_affordance";
  }
  if (CAI_EXECUTION_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "cai_execution_affordance";
  }
  if (CAI_SIDECAR_AFFORDANCE_NAMES.includes(normalized as never)) {
    return "cai_sidecar_affordance";
  }
  return FORBIDDEN_FIELD_KIND_BY_NAME.get(normalized) ?? null;
}

function kindForStringValue(
  value: string,
): RedTeamSandboxSafetyViolationKind | null {
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "secret_material";
  }
  if (SHELL_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "shell_command";
  }
  if (NETWORK_SCAN_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "network_scan_command";
  }
  if (EXPLOIT_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "exploit_payload";
  }
  if (CREDENTIAL_ATTACK_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "credential_attack";
  }
  if (EXECUTABLE_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "executable_payload";
  }
  if (CAI_EXECUTION_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "cai_execution_affordance";
  }
  if (CAI_SIDECAR_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return "cai_sidecar_affordance";
  }
  if (EXTERNAL_URL_PATTERN.test(value) || EXTERNAL_IPV4_PATTERN.test(value)) {
    return "external_target";
  }
  if (UNSAFE_PATH_PATTERN.test(value)) {
    return "unsafe_filesystem_path";
  }
  return null;
}

function collectViolations(
  input: unknown,
  path: string,
  fieldName: string | null,
  violations: Omit<RedTeamSandboxSafetyViolation, "violation_id">[],
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
    const kind = "executable_payload";
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
  readonly target_kind: RedTeamSandboxSafetyScanTarget;
  readonly violations: readonly Omit<
    RedTeamSandboxSafetyViolation,
    "violation_id"
  >[];
}): RedTeamSandboxSafetyResult {
  const violations = [...input.violations]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((item, index) =>
      RedTeamSandboxSafetyViolationSchema.parse({
        ...item,
        violation_id: `red-team-safety-violation:${String(index).padStart(
          4,
          "0",
        )}`,
      }),
    );

  return RedTeamSandboxSafetyResultSchema.parse({
    policy_version: RED_TEAM_SANDBOX_SAFETY_GUARD_VERSION,
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

export function listRedTeamSandboxForbiddenFieldNames(): readonly string[] {
  return [...FORBIDDEN_FIELD_KIND_BY_NAME.keys()];
}

export function listRedTeamSandboxForbiddenAffordanceNames(): readonly string[] {
  return [
    ...ACTION_AFFORDANCE_NAMES,
    ...CAI_EXECUTION_AFFORDANCE_NAMES,
    ...CAI_SIDECAR_AFFORDANCE_NAMES,
  ];
}

export function scanRedTeamSandboxSafety(
  target: unknown,
  targetKind: RedTeamSandboxSafetyScanTarget = "unknown_metadata",
): RedTeamSandboxSafetyResult {
  const violations: Omit<RedTeamSandboxSafetyViolation, "violation_id">[] = [];
  collectViolations(target, "$", null, violations);
  return safetyResult({ target_kind: targetKind, violations });
}

export function assertRedTeamSandboxSafe(target: unknown): void {
  const result = scanRedTeamSandboxSafety(target);
  if (!result.passed) {
    const firstViolation = result.violations[0];
    throw new Error(
      `Red-team sandbox safety violation: ${firstViolation.kind} at ${firstViolation.path}`,
    );
  }
}
