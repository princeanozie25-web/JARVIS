import { z } from "zod";

export const SELF_AUDIT_COLLECTOR_SURFACES = [
  "approvals_ledger",
  "tool_call_audit",
  "failures",
  "cost_telemetry",
  "vision_replay",
  "environment_events",
  "project_ledger",
  "router_decisions",
  "safety_classifier",
] as const;

export const SELF_AUDIT_SAFE_FIELDS = [
  "counts",
  "bins",
  "classes",
  "duration_ms",
  "rows_read_bin",
  "truncated",
  "error_class",
  "redaction_status",
] as const;

export const SELF_AUDIT_FORBIDDEN_FIELDS = [
  "raw_text",
  "body",
  "content",
  "raw_content",
  "frame",
  "image",
  "ocr_text",
  "screen_text",
  "person",
  "person_name",
  "pii",
  "secret",
  "token",
  "password",
  "api_key",
  "approval_output",
  "action_output",
  "mutation_output",
] as const;

export const SELF_AUDIT_COLLECTOR_VALIDATION_REASONS = [
  "valid_collector_contract",
  "invalid_contract_shape",
  "writes_forbidden",
  "tools_forbidden",
  "network_forbidden",
  "cloud_forbidden",
  "actions_forbidden",
  "approvals_forbidden",
  "mutations_forbidden",
  "raw_content_forbidden",
] as const;

export const SELF_AUDIT_COLLECTOR_TELEMETRY_EVENT_TYPES = [
  "self_audit_collector_validated",
] as const;

export type SelfAuditCollectorSurface =
  (typeof SELF_AUDIT_COLLECTOR_SURFACES)[number];
export type SelfAuditSafeField = (typeof SELF_AUDIT_SAFE_FIELDS)[number];
export type SelfAuditForbiddenField =
  (typeof SELF_AUDIT_FORBIDDEN_FIELDS)[number];
export type SelfAuditCollectorValidationReason =
  (typeof SELF_AUDIT_COLLECTOR_VALIDATION_REASONS)[number];
export type SelfAuditCollectorTelemetryEventType =
  (typeof SELF_AUDIT_COLLECTOR_TELEMETRY_EVENT_TYPES)[number];

export const SelfAuditCollectorSurfaceSchema = z.enum(
  SELF_AUDIT_COLLECTOR_SURFACES,
);
export const SelfAuditSafeFieldSchema = z.enum(SELF_AUDIT_SAFE_FIELDS);
export const SelfAuditForbiddenFieldSchema = z.enum(
  SELF_AUDIT_FORBIDDEN_FIELDS,
);
export const SelfAuditCollectorValidationReasonSchema = z.enum(
  SELF_AUDIT_COLLECTOR_VALIDATION_REASONS,
);
export const SelfAuditCollectorTelemetryEventTypeSchema = z.enum(
  SELF_AUDIT_COLLECTOR_TELEMETRY_EVENT_TYPES,
);

export const SelfAuditCollectorContractSchema = z.strictObject({
  surface: SelfAuditCollectorSurfaceSchema,
  max_rows: z.number().int().positive().max(10_000),
  timeout_ms: z.number().int().positive().max(60_000),
  allowed_fields: z.array(SelfAuditSafeFieldSchema),
  forbidden_fields: z.array(SelfAuditForbiddenFieldSchema),
  read_only: z.literal(true),
  writes_allowed: z.boolean(),
  network_allowed: z.boolean(),
  cloud_allowed: z.boolean(),
  tools_allowed: z.boolean(),
  actions_allowed: z.boolean(),
  approvals_allowed: z.boolean(),
  mutations_allowed: z.boolean(),
  metadata_only: z.literal(true),
});

const CountEntrySchema = z.strictObject({
  class: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9._:-]+$/),
  count: z.number().int().nonnegative(),
});

const BinEntrySchema = z.strictObject({
  bin: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9._:-]+$/),
  count: z.number().int().nonnegative(),
});

export const SelfAuditCollectorResultSchema = z.strictObject({
  surface: SelfAuditCollectorSurfaceSchema,
  counts: z.array(CountEntrySchema),
  bins: z.array(BinEntrySchema),
  classes: z.array(
    z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9._:-]+$/),
  ),
  duration_ms: z.number().int().nonnegative(),
  rows_read_bin: z.enum(["none", "1_10", "11_100", "101_1000", "1001_plus"]),
  truncated: z.boolean(),
  error_class: z.enum([
    "none",
    "collector_unavailable",
    "timeout",
    "validation_failed",
  ]),
  redaction_status: z.enum(["metadata_only", "redacted"]),
  read_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_content_included: z.literal(false),
  writes_performed: z.literal(false),
  tools_called: z.literal(false),
  network_called: z.literal(false),
  actions_executed: z.literal(false),
  approvals_triggered: z.literal(false),
  mutations_performed: z.literal(false),
});

export const SelfAuditCollectorValidationSchema = z.strictObject({
  kind: z.literal("self_audit.collector_validation"),
  surface: SelfAuditCollectorSurfaceSchema.nullable(),
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(SelfAuditCollectorValidationReasonSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const SelfAuditCollectorTelemetryEventSchema = z.strictObject({
  event_type: SelfAuditCollectorTelemetryEventTypeSchema,
  pass: z.boolean(),
  collector_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export type SelfAuditCollectorContract = z.infer<
  typeof SelfAuditCollectorContractSchema
>;
export type SelfAuditCollectorResult = z.infer<
  typeof SelfAuditCollectorResultSchema
>;
export type SelfAuditCollectorValidation = z.infer<
  typeof SelfAuditCollectorValidationSchema
>;
export type SelfAuditCollectorTelemetryEvent = z.infer<
  typeof SelfAuditCollectorTelemetryEventSchema
>;

function contract(
  surface: SelfAuditCollectorSurface,
): SelfAuditCollectorContract {
  return SelfAuditCollectorContractSchema.parse({
    surface,
    max_rows: 1_000,
    timeout_ms: 5_000,
    allowed_fields: [
      "counts",
      "bins",
      "classes",
      "duration_ms",
      "rows_read_bin",
      "truncated",
      "error_class",
      "redaction_status",
    ],
    forbidden_fields: SELF_AUDIT_FORBIDDEN_FIELDS,
    read_only: true,
    writes_allowed: false,
    network_allowed: false,
    cloud_allowed: false,
    tools_allowed: false,
    actions_allowed: false,
    approvals_allowed: false,
    mutations_allowed: false,
    metadata_only: true,
  });
}

export const DEFAULT_SELF_AUDIT_COLLECTOR_CONTRACTS =
  SELF_AUDIT_COLLECTOR_SURFACES.map(contract);

function validation(input: {
  surface: SelfAuditCollectorSurface | null;
  violations: Set<SelfAuditCollectorValidationReason>;
}): SelfAuditCollectorValidation {
  return SelfAuditCollectorValidationSchema.parse({
    kind: "self_audit.collector_validation",
    surface: input.surface,
    pass: input.violations.size === 0,
    violation_count: input.violations.size,
    violations:
      input.violations.size === 0
        ? ["valid_collector_contract"]
        : [...input.violations],
    metadata_only: true,
    read_only: true,
    db_read_performed: false,
    db_write_performed: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateSelfAuditCollectorContract(
  input: unknown,
): SelfAuditCollectorValidation {
  const parsed = SelfAuditCollectorContractSchema.safeParse(input);
  const violations = new Set<SelfAuditCollectorValidationReason>();

  if (!parsed.success) {
    violations.add("invalid_contract_shape");
    return validation({ surface: null, violations });
  }

  const collector = parsed.data;
  if (collector.writes_allowed) {
    violations.add("writes_forbidden");
  }
  if (collector.tools_allowed) {
    violations.add("tools_forbidden");
  }
  if (collector.network_allowed) {
    violations.add("network_forbidden");
  }
  if (collector.cloud_allowed) {
    violations.add("cloud_forbidden");
  }
  if (collector.actions_allowed) {
    violations.add("actions_forbidden");
  }
  if (collector.approvals_allowed) {
    violations.add("approvals_forbidden");
  }
  if (collector.mutations_allowed) {
    violations.add("mutations_forbidden");
  }

  return validation({ surface: collector.surface, violations });
}

export function createSelfAuditCollectorTelemetryEvent(input: {
  validations: SelfAuditCollectorValidation[];
}): SelfAuditCollectorTelemetryEvent {
  const validations = input.validations.map((item) =>
    SelfAuditCollectorValidationSchema.parse(item),
  );
  return SelfAuditCollectorTelemetryEventSchema.parse({
    event_type: "self_audit_collector_validated",
    pass: validations.every((item) => item.pass),
    collector_count: validations.length,
    violation_count: validations.reduce(
      (total, item) => total + item.violation_count,
      0,
    ),
    metadata_only: true,
    counts_and_flags_only: true,
    db_read_performed: false,
    db_write_performed: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    network_called: false,
    cloud_called: false,
  });
}
