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
