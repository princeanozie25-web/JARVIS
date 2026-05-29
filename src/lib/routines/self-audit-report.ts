import { z } from "zod";

export const SELF_AUDIT_REPORT_SECTIONS = [
  "approvals",
  "tools",
  "failures",
  "cost",
  "vision",
  "environment",
  "projects",
  "router",
  "safety",
] as const;

export const SELF_AUDIT_REPORT_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export const SELF_AUDIT_REPORT_VALIDATION_REASONS = [
  "valid_report",
  "invalid_report_shape",
  "raw_content_forbidden",
  "project_identifier_forbidden",
  "vision_payload_forbidden",
  "voice_transcript_forbidden",
  "environment_raw_value_forbidden",
  "secret_or_pii_forbidden",
] as const;

export const SELF_AUDIT_REPORT_TELEMETRY_EVENT_TYPES = [
  "self_audit_report_validated",
] as const;

export type SelfAuditReportSectionName =
  (typeof SELF_AUDIT_REPORT_SECTIONS)[number];
export type SelfAuditReportRedactionStatus =
  (typeof SELF_AUDIT_REPORT_REDACTION_STATUSES)[number];
export type SelfAuditReportValidationReason =
  (typeof SELF_AUDIT_REPORT_VALIDATION_REASONS)[number];
export type SelfAuditReportTelemetryEventType =
  (typeof SELF_AUDIT_REPORT_TELEMETRY_EVENT_TYPES)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const SafeClassSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9._:-]+$/);

const CountEntrySchema = z.strictObject({
  class: SafeClassSchema,
  count: z.number().int().nonnegative(),
});

const BinEntrySchema = z.strictObject({
  bin: SafeClassSchema,
  count: z.number().int().nonnegative(),
});

export const SelfAuditReportSectionNameSchema = z.enum(
  SELF_AUDIT_REPORT_SECTIONS,
);
export const SelfAuditReportRedactionStatusSchema = z.enum(
  SELF_AUDIT_REPORT_REDACTION_STATUSES,
);
export const SelfAuditReportValidationReasonSchema = z.enum(
  SELF_AUDIT_REPORT_VALIDATION_REASONS,
);
export const SelfAuditReportTelemetryEventTypeSchema = z.enum(
  SELF_AUDIT_REPORT_TELEMETRY_EVENT_TYPES,
);

export const SelfAuditReportWindowSchema = z
  .strictObject({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
  })
  .refine((window) => window.end_ms >= window.start_ms, {
    message: "report window end must be greater than or equal to start",
  });

export const SelfAuditReportSectionSchema = z.strictObject({
  section: SelfAuditReportSectionNameSchema,
  counts: z.array(CountEntrySchema).max(50),
  bins: z.array(BinEntrySchema).max(50),
  classes: z.array(SafeClassSchema).max(50),
  truncated: z.boolean(),
  redaction_status: SelfAuditReportRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_content_included: z.literal(false),
});

export const SelfAuditReportSchema = z.strictObject({
  report_id: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^self_audit_report:[a-z0-9._:-]+$/),
  report_window: SelfAuditReportWindowSchema,
  generated_by_routine_id: RoutineIdSchema,
  sections: z.array(SelfAuditReportSectionSchema).max(9),
  redaction_status: SelfAuditReportRedactionStatusSchema,
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_bins_classes_only: z.literal(true),
  raw_body_included: z.literal(false),
  raw_text_included: z.literal(false),
  raw_content_included: z.literal(false),
  ocr_payload_included: z.literal(false),
  screen_payload_included: z.literal(false),
  frame_payload_included: z.literal(false),
  voice_transcript_included: z.literal(false),
  environment_raw_values_included: z.literal(false),
  secrets_or_pii_included: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  llm_called: z.literal(false),
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

export const SelfAuditReportValidationSchema = z.strictObject({
  kind: z.literal("self_audit.report_validation"),
  pass: z.boolean(),
  report_id: z.string().trim().min(1).max(160).nullable(),
  section_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(SelfAuditReportValidationReasonSchema),
  metadata_only: z.literal(true),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  llm_called: z.literal(false),
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

export const SelfAuditReportTelemetryEventSchema = z.strictObject({
  event_type: SelfAuditReportTelemetryEventTypeSchema,
  pass: z.boolean(),
  section_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  llm_called: z.literal(false),
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

export type SelfAuditReportWindow = z.infer<typeof SelfAuditReportWindowSchema>;
export type SelfAuditReportSection = z.infer<
  typeof SelfAuditReportSectionSchema
>;
export type SelfAuditReport = z.infer<typeof SelfAuditReportSchema>;
export type SelfAuditReportValidation = z.infer<
  typeof SelfAuditReportValidationSchema
>;
export type SelfAuditReportTelemetryEvent = z.infer<
  typeof SelfAuditReportTelemetryEventSchema
>;

const RAW_CONTENT_PATTERNS = [
  /raw/i,
  /body/i,
  /content/i,
  /text/i,
  /transcript/i,
] as const;
const PROJECT_IDENTIFIER_PATTERNS = [
  /project[_-]?name/i,
  /file[_-]?path/i,
  /task[_-]?title/i,
] as const;
const VISION_PAYLOAD_PATTERNS = [
  /ocr/i,
  /screen/i,
  /frame/i,
  /image/i,
] as const;
const ENVIRONMENT_RAW_VALUE_PATTERNS = [
  /sensor[_-]?raw/i,
  /raw[_-]?sensor/i,
  /raw[_-]?value/i,
] as const;
const SECRET_OR_PII_PATTERNS = [
  /secret/i,
  /token/i,
  /password/i,
  /api[_-]?key/i,
  /pii/i,
] as const;

function containsPattern(
  values: string[],
  patterns: readonly RegExp[],
): boolean {
  return values.some((value) =>
    patterns.some((pattern) => pattern.test(value)),
  );
}

function reportStrings(report: SelfAuditReport): string[] {
  return report.sections.flatMap((section) => [
    section.section,
    ...section.classes,
    ...section.counts.map((count) => count.class),
    ...section.bins.map((bin) => bin.bin),
  ]);
}

function validation(input: {
  report: SelfAuditReport | null;
  violations: Set<SelfAuditReportValidationReason>;
}): SelfAuditReportValidation {
  return SelfAuditReportValidationSchema.parse({
    kind: "self_audit.report_validation",
    pass: input.violations.size === 0,
    report_id: input.report?.report_id ?? null,
    section_count: input.report?.sections.length ?? 0,
    violation_count: input.violations.size,
    violations:
      input.violations.size === 0 ? ["valid_report"] : [...input.violations],
    metadata_only: true,
    db_read_performed: false,
    db_write_performed: false,
    llm_called: false,
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

export function validateSelfAuditReport(
  input: unknown,
): SelfAuditReportValidation {
  const parsed = SelfAuditReportSchema.safeParse(input);
  const violations = new Set<SelfAuditReportValidationReason>();

  if (!parsed.success) {
    violations.add("invalid_report_shape");
    return validation({ report: null, violations });
  }

  const report = parsed.data;
  const strings = reportStrings(report);
  if (containsPattern(strings, RAW_CONTENT_PATTERNS)) {
    violations.add("raw_content_forbidden");
  }
  if (containsPattern(strings, PROJECT_IDENTIFIER_PATTERNS)) {
    violations.add("project_identifier_forbidden");
  }
  if (containsPattern(strings, VISION_PAYLOAD_PATTERNS)) {
    violations.add("vision_payload_forbidden");
  }
  if (containsPattern(strings, [/voice[_-]?transcript/i, /transcript/i])) {
    violations.add("voice_transcript_forbidden");
  }
  if (containsPattern(strings, ENVIRONMENT_RAW_VALUE_PATTERNS)) {
    violations.add("environment_raw_value_forbidden");
  }
  if (containsPattern(strings, SECRET_OR_PII_PATTERNS)) {
    violations.add("secret_or_pii_forbidden");
  }

  return validation({ report, violations });
}

export function createSelfAuditReportTelemetryEvent(
  reportInput: SelfAuditReport,
  validationInput: SelfAuditReportValidation,
): SelfAuditReportTelemetryEvent {
  const report = SelfAuditReportSchema.parse(reportInput);
  const reportValidation =
    SelfAuditReportValidationSchema.parse(validationInput);
  return SelfAuditReportTelemetryEventSchema.parse({
    event_type: "self_audit_report_validated",
    pass: reportValidation.pass,
    section_count: reportValidation.section_count,
    violation_count: reportValidation.violation_count,
    truncated: report.truncated,
    metadata_only: true,
    counts_and_flags_only: true,
    db_read_performed: false,
    db_write_performed: false,
    llm_called: false,
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

export const PHASE_17_SELF_AUDIT_REPORT_SECTIONS = [
  "approvals",
  "tools",
  "cost_model_usage",
  "vision",
  "environment_room",
  "projects",
  "router",
  "safety",
  "routines_scheduler",
] as const;

export const PHASE_17_SELF_AUDIT_REDACTION_STATUSES = [
  "not_started",
  "unavailable",
  "unsupported",
] as const;

export const PHASE_17_SELF_AUDIT_REPORT_VALIDATION_REASONS = [
  "valid_schema",
  "invalid_schema",
  "missing_required_section",
  "raw_payload_forbidden",
  "secret_forbidden",
  "pii_forbidden",
  "report_body_forbidden",
  "persistence_forbidden",
  "tool_output_forbidden",
  "project_body_forbidden",
  "voice_transcript_forbidden",
  "ocr_text_forbidden",
  "frame_payload_forbidden",
  "prompt_forbidden",
  "model_output_forbidden",
] as const;

export type Phase17SelfAuditReportSection =
  (typeof PHASE_17_SELF_AUDIT_REPORT_SECTIONS)[number];
export type Phase17SelfAuditRedactionStatus =
  (typeof PHASE_17_SELF_AUDIT_REDACTION_STATUSES)[number];
export type Phase17SelfAuditReportValidationReason =
  (typeof PHASE_17_SELF_AUDIT_REPORT_VALIDATION_REASONS)[number];

export const Phase17SelfAuditReportSectionNameSchema = z.enum(
  PHASE_17_SELF_AUDIT_REPORT_SECTIONS,
);
export const Phase17SelfAuditRedactionStatusSchema = z.enum(
  PHASE_17_SELF_AUDIT_REDACTION_STATUSES,
);
export const Phase17SelfAuditReportValidationReasonSchema = z.enum(
  PHASE_17_SELF_AUDIT_REPORT_VALIDATION_REASONS,
);

export const Phase17SelfAuditReportWindowSchema = z
  .strictObject({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
  })
  .refine((window) => window.end_ms >= window.start_ms, {
    message:
      "self-audit report window end must be greater than or equal to start",
  });

export const Phase17SelfAuditReportSectionSchema = z.strictObject({
  section_id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^section:[a-z0-9._:-]+$/),
  section: Phase17SelfAuditReportSectionNameSchema,
  section_kind: Phase17SelfAuditReportSectionNameSchema,
  metadata_only: z.literal(true),
  collector_supported: z.literal(false),
  collector_attempted: z.literal(false),
  source_read_supported: z.literal(false),
  source_read_attempted: z.literal(false),
  item_count: z.literal(0),
  row_cap: z.number().int().positive().max(1_000),
  max_items: z.number().int().positive().max(1_000),
  summary_available: z.literal(false),
  summary_generated: z.literal(false),
  raw_payload_allowed: z.literal(false),
  redaction_required: z.literal(true),
  redaction_status: Phase17SelfAuditRedactionStatusSchema,
  pii_allowed: z.literal(false),
  secrets_allowed: z.literal(false),
  report_body_allowed: z.literal(false),
  generated_content_allowed: z.literal(false),
  collector_execution_supported: z.literal(false),
  collector_execution_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
});

export const Phase17SelfAuditReportSchema = z.strictObject({
  report_id: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^self_audit_report:phase17:[a-z0-9._:-]+$/),
  routine_id: RoutineIdSchema,
  window: Phase17SelfAuditReportWindowSchema,
  generated_by_routine_id: RoutineIdSchema,
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  redaction_status: Phase17SelfAuditRedactionStatusSchema,
  raw_payload_allowed: z.literal(false),
  persistence_supported: z.literal(false),
  persistence_attempted: z.literal(false),
  sections: z
    .array(Phase17SelfAuditReportSectionSchema)
    .length(PHASE_17_SELF_AUDIT_REPORT_SECTIONS.length),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  collector_execution_supported: z.literal(false),
  collector_execution_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_supported: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const Phase17SelfAuditReportValidationSchema = z.strictObject({
  kind: z.literal("phase17.self_audit_report_schema_validation"),
  pass: z.boolean(),
  report_id: z.string().trim().min(1).max(180).nullable(),
  section_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(Phase17SelfAuditReportValidationReasonSchema),
  metadata_only: z.literal(true),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  collector_execution_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  persisted: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const Phase17SelfAuditSectionValidationSchema = z.strictObject({
  kind: z.literal("phase17.self_audit_section_metadata_validation"),
  pass: z.boolean(),
  section_id: z.string().trim().min(1).max(120).nullable(),
  section_kind: Phase17SelfAuditReportSectionNameSchema.nullable(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(Phase17SelfAuditReportValidationReasonSchema),
  metadata_only: z.literal(true),
  summary_generated: z.literal(false),
  collector_attempted: z.literal(false),
  source_read_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  persisted: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export type Phase17SelfAuditReportWindow = z.infer<
  typeof Phase17SelfAuditReportWindowSchema
>;
export type Phase17SelfAuditReportSectionMetadata = z.infer<
  typeof Phase17SelfAuditReportSectionSchema
>;
export type Phase17SelfAuditReport = z.infer<
  typeof Phase17SelfAuditReportSchema
>;
export type Phase17SelfAuditReportValidation = z.infer<
  typeof Phase17SelfAuditReportValidationSchema
>;
export type Phase17SelfAuditSectionValidation = z.infer<
  typeof Phase17SelfAuditSectionValidationSchema
>;

export function createEmptyPhase17SelfAuditReport(input: {
  readonly report_id: string;
  readonly routine_id: string;
  readonly generated_by_routine_id: string;
  readonly start_ms: number;
  readonly end_ms: number;
}): Phase17SelfAuditReport {
  return Phase17SelfAuditReportSchema.parse({
    report_id: input.report_id,
    routine_id: input.routine_id,
    window: {
      start_ms: input.start_ms,
      end_ms: input.end_ms,
      metadata_only: true,
    },
    generated_by_routine_id: input.generated_by_routine_id,
    metadata_only: true,
    redaction_required: true,
    redaction_status: "not_started",
    raw_payload_allowed: false,
    persistence_supported: false,
    persistence_attempted: false,
    sections: PHASE_17_SELF_AUDIT_REPORT_SECTIONS.map((section) => ({
      section_id: `section:${section}`,
      section,
      section_kind: section,
      metadata_only: true,
      collector_supported: false,
      collector_attempted: false,
      source_read_supported: false,
      source_read_attempted: false,
      item_count: 0,
      row_cap: 250,
      max_items: 250,
      summary_available: false,
      summary_generated: false,
      raw_payload_allowed: false,
      redaction_required: true,
      redaction_status: "not_started",
      pii_allowed: false,
      secrets_allowed: false,
      report_body_allowed: false,
      generated_content_allowed: false,
      collector_execution_supported: false,
      collector_execution_attempted: false,
      db_read_performed: false,
      event_store_read_performed: false,
    })),
    report_generated: false,
    suggestion_generated: false,
    baseline_update_generated: false,
    collector_execution_supported: false,
    collector_execution_attempted: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_supported: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateSelfAuditReportSchema(
  input: unknown,
): Phase17SelfAuditReportValidation {
  const parsed = Phase17SelfAuditReportSchema.safeParse(input);
  const violations = new Set<Phase17SelfAuditReportValidationReason>();

  for (const violation of forbiddenPayloadViolations(input)) {
    violations.add(violation);
  }

  if (!parsed.success) {
    violations.add("invalid_schema");
    return phase17Validation({
      report: null,
      violations,
      sectionCount: Array.isArray((input as { sections?: unknown }).sections)
        ? (input as { sections: unknown[] }).sections.length
        : 0,
    });
  }

  const sectionKinds = new Set(
    parsed.data.sections.map((section) => section.section_kind),
  );
  if (
    !PHASE_17_SELF_AUDIT_REPORT_SECTIONS.every((section) =>
      sectionKinds.has(section),
    )
  ) {
    violations.add("missing_required_section");
  }

  return phase17Validation({
    report: parsed.data,
    violations,
    sectionCount: parsed.data.sections.length,
  });
}

export function validateSelfAuditSectionMetadata(
  input: unknown,
): Phase17SelfAuditSectionValidation {
  const parsed = Phase17SelfAuditReportSectionSchema.safeParse(input);
  const violations = new Set<Phase17SelfAuditReportValidationReason>();

  for (const violation of forbiddenPayloadViolations(input)) {
    violations.add(violation);
  }

  if (!parsed.success) {
    violations.add("invalid_schema");
    return sectionValidation({
      section: null,
      violations,
    });
  }

  return sectionValidation({
    section: parsed.data,
    violations,
  });
}

function sectionValidation(input: {
  readonly section: Phase17SelfAuditReportSectionMetadata | null;
  readonly violations: Set<Phase17SelfAuditReportValidationReason>;
}): Phase17SelfAuditSectionValidation {
  return Phase17SelfAuditSectionValidationSchema.parse({
    kind: "phase17.self_audit_section_metadata_validation",
    pass: input.violations.size === 0,
    section_id: input.section?.section_id ?? null,
    section_kind: input.section?.section_kind ?? null,
    violation_count: input.violations.size,
    violations:
      input.violations.size === 0 ? ["valid_schema"] : [...input.violations],
    metadata_only: true,
    summary_generated: false,
    collector_attempted: false,
    source_read_attempted: false,
    db_read_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    persisted: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

function phase17Validation(input: {
  readonly report: Phase17SelfAuditReport | null;
  readonly violations: Set<Phase17SelfAuditReportValidationReason>;
  readonly sectionCount: number;
}): Phase17SelfAuditReportValidation {
  return Phase17SelfAuditReportValidationSchema.parse({
    kind: "phase17.self_audit_report_schema_validation",
    pass: input.violations.size === 0,
    report_id: input.report?.report_id ?? null,
    section_count: input.sectionCount,
    violation_count: input.violations.size,
    violations:
      input.violations.size === 0 ? ["valid_schema"] : [...input.violations],
    metadata_only: true,
    report_generated: false,
    suggestion_generated: false,
    baseline_update_generated: false,
    collector_execution_attempted: false,
    db_read_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    persisted: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

function forbiddenPayloadViolations(
  input: unknown,
): Phase17SelfAuditReportValidationReason[] {
  const violations = new Set<Phase17SelfAuditReportValidationReason>();

  visitUnknown(input, (key, value) => {
    const normalized = key.toLowerCase();
    if (/raw|payload|body_text|report_body|content/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("raw_payload_forbidden");
      }
    }
    if (/secret|token|password|api_key|apikey/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("secret_forbidden");
      }
    }
    if (/pii|email|phone|address/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("pii_forbidden");
      }
    }
    if (/report_body|body_text|report_text/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("report_body_forbidden");
      }
    }
    if (/persist|db_write|event_store_write/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("persistence_forbidden");
      }
    }
    if (/tool_output/.test(normalized)) {
      violations.add("tool_output_forbidden");
    }
    if (/project_body|project_content/.test(normalized)) {
      violations.add("project_body_forbidden");
    }
    if (/voice_transcript|transcript/.test(normalized)) {
      violations.add("voice_transcript_forbidden");
    }
    if (/ocr_text|extracted_text/.test(normalized)) {
      violations.add("ocr_text_forbidden");
    }
    if (/frame|raw_frame|image_bytes/.test(normalized)) {
      violations.add("frame_payload_forbidden");
    }
    if (/prompt/.test(normalized)) {
      violations.add("prompt_forbidden");
    }
    if (/model_output|model_response|llm_output/.test(normalized)) {
      violations.add("model_output_forbidden");
    }
  });

  return [...violations];
}

function visitUnknown(
  input: unknown,
  visit: (key: string, value: unknown) => void,
): void {
  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    visit(key, value);
    visitUnknown(value, visit);
  }
}
