import { z } from "zod";

import {
  SELF_AUDIT_COLLECTOR_SURFACES,
  SelfAuditCollectorResultSchema,
  type SelfAuditCollectorResult,
  type SelfAuditCollectorSurface,
} from "./self-audit-collectors";
import {
  SelfAuditReportSchema,
  SelfAuditReportSectionSchema,
  SelfAuditReportValidationSchema,
  SelfAuditReportWindowSchema,
  validateSelfAuditReport,
  type SelfAuditReportSection,
  type SelfAuditReportSectionName,
} from "./self-audit-report";

export const SELF_AUDIT_REPORT_ASSEMBLY_TELEMETRY_EVENT_TYPES = [
  "self_audit_report_assembled",
] as const;

export type SelfAuditReportAssemblyTelemetryEventType =
  (typeof SELF_AUDIT_REPORT_ASSEMBLY_TELEMETRY_EVENT_TYPES)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const SelfAuditReportAssemblyTelemetryEventTypeSchema = z.enum(
  SELF_AUDIT_REPORT_ASSEMBLY_TELEMETRY_EVENT_TYPES,
);

export const AssembleSelfAuditReportInputSchema = z.strictObject({
  report_window: SelfAuditReportWindowSchema,
  generated_by_routine_id: RoutineIdSchema,
  collector_results: z.array(SelfAuditCollectorResultSchema).max(9),
  metadata_only: z.literal(true),
});

export const SelfAuditReportAssemblyMetadataSchema = z.strictObject({
  kind: z.literal("self_audit.report_assembly"),
  report_id: z.string().trim().min(1).max(160),
  collector_result_count: z.number().int().nonnegative(),
  missing_surface_count: z.number().int().nonnegative(),
  failed_collector_count: z.number().int().nonnegative(),
  truncated_collector_count: z.number().int().nonnegative(),
  validation_pass: z.boolean(),
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

export const SelfAuditReportAssemblyResultSchema = z.strictObject({
  report: SelfAuditReportSchema,
  validation: SelfAuditReportValidationSchema,
  metadata: SelfAuditReportAssemblyMetadataSchema,
});

export const SelfAuditReportAssemblyTelemetryEventSchema = z.strictObject({
  event_type: SelfAuditReportAssemblyTelemetryEventTypeSchema,
  pass: z.boolean(),
  collector_result_count: z.number().int().nonnegative(),
  missing_surface_count: z.number().int().nonnegative(),
  failed_collector_count: z.number().int().nonnegative(),
  truncated_collector_count: z.number().int().nonnegative(),
  section_count: z.number().int().nonnegative(),
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

export type AssembleSelfAuditReportInput = z.input<
  typeof AssembleSelfAuditReportInputSchema
>;
export type SelfAuditReportAssemblyMetadata = z.infer<
  typeof SelfAuditReportAssemblyMetadataSchema
>;
export type SelfAuditReportAssemblyResult = z.infer<
  typeof SelfAuditReportAssemblyResultSchema
>;
export type SelfAuditReportAssemblyTelemetryEvent = z.infer<
  typeof SelfAuditReportAssemblyTelemetryEventSchema
>;

const SURFACE_TO_SECTION: Record<
  SelfAuditCollectorSurface,
  SelfAuditReportSectionName
> = {
  approvals_ledger: "approvals",
  tool_call_audit: "tools",
  failures: "failures",
  cost_telemetry: "cost",
  vision_replay: "vision",
  environment_events: "environment",
  project_ledger: "projects",
  router_decisions: "router",
  safety_classifier: "safety",
};

function reportId(input: z.infer<typeof AssembleSelfAuditReportInputSchema>) {
  return `self_audit_report:${input.generated_by_routine_id}:${input.report_window.start_ms}:${input.report_window.end_ms}`;
}

function missingSection(
  surface: SelfAuditCollectorSurface,
): SelfAuditReportSection {
  return SelfAuditReportSectionSchema.parse({
    section: SURFACE_TO_SECTION[surface],
    counts: [{ class: "missing_surface", count: 1 }],
    bins: [],
    classes: ["missing_surface"],
    truncated: false,
    redaction_status: "metadata_only",
    metadata_only: true,
    raw_content_included: false,
  });
}

function sectionFromResult(
  result: SelfAuditCollectorResult,
): SelfAuditReportSection {
  if (result.error_class !== "none") {
    return SelfAuditReportSectionSchema.parse({
      section: SURFACE_TO_SECTION[result.surface],
      counts: [{ class: `error:${result.error_class}`, count: 1 }],
      bins: [],
      classes: [result.error_class],
      truncated: result.truncated,
      redaction_status: result.redaction_status,
      metadata_only: true,
      raw_content_included: false,
    });
  }

  return SelfAuditReportSectionSchema.parse({
    section: SURFACE_TO_SECTION[result.surface],
    counts: result.counts,
    bins: result.bins,
    classes: result.classes,
    truncated: result.truncated,
    redaction_status: result.redaction_status,
    metadata_only: true,
    raw_content_included: false,
  });
}

export function assembleSelfAuditReport(
  input: AssembleSelfAuditReportInput,
): SelfAuditReportAssemblyResult {
  const parsed = AssembleSelfAuditReportInputSchema.parse(input);
  const resultsBySurface = new Map<
    SelfAuditCollectorSurface,
    SelfAuditCollectorResult
  >();

  for (const result of parsed.collector_results) {
    if (!resultsBySurface.has(result.surface)) {
      resultsBySurface.set(result.surface, result);
    }
  }

  const sections = SELF_AUDIT_COLLECTOR_SURFACES.map((surface) => {
    const result = resultsBySurface.get(surface);
    return result ? sectionFromResult(result) : missingSection(surface);
  });
  const missingSurfaceCount = SELF_AUDIT_COLLECTOR_SURFACES.filter(
    (surface) => !resultsBySurface.has(surface),
  ).length;
  const failedCollectorCount = parsed.collector_results.filter(
    (result) => result.error_class !== "none",
  ).length;
  const truncatedCollectorCount = parsed.collector_results.filter(
    (result) => result.truncated,
  ).length;
  const report = SelfAuditReportSchema.parse({
    report_id: reportId(parsed),
    report_window: parsed.report_window,
    generated_by_routine_id: parsed.generated_by_routine_id,
    sections,
    redaction_status: sections.some(
      (section) => section.redaction_status === "redacted",
    )
      ? "redacted"
      : "metadata_only",
    truncated: sections.some((section) => section.truncated),
    metadata_only: true,
    counts_bins_classes_only: true,
    raw_body_included: false,
    raw_text_included: false,
    raw_content_included: false,
    ocr_payload_included: false,
    screen_payload_included: false,
    frame_payload_included: false,
    voice_transcript_included: false,
    environment_raw_values_included: false,
    secrets_or_pii_included: false,
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
  const validation = validateSelfAuditReport(report);
  const metadata = SelfAuditReportAssemblyMetadataSchema.parse({
    kind: "self_audit.report_assembly",
    report_id: report.report_id,
    collector_result_count: parsed.collector_results.length,
    missing_surface_count: missingSurfaceCount,
    failed_collector_count: failedCollectorCount,
    truncated_collector_count: truncatedCollectorCount,
    validation_pass: validation.pass,
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

  return SelfAuditReportAssemblyResultSchema.parse({
    report,
    validation,
    metadata,
  });
}

export function createSelfAuditReportAssemblyTelemetryEvent(
  assemblyInput: SelfAuditReportAssemblyResult,
): SelfAuditReportAssemblyTelemetryEvent {
  const assembly = SelfAuditReportAssemblyResultSchema.parse(assemblyInput);
  return SelfAuditReportAssemblyTelemetryEventSchema.parse({
    event_type: "self_audit_report_assembled",
    pass: assembly.validation.pass,
    collector_result_count: assembly.metadata.collector_result_count,
    missing_surface_count: assembly.metadata.missing_surface_count,
    failed_collector_count: assembly.metadata.failed_collector_count,
    truncated_collector_count: assembly.metadata.truncated_collector_count,
    section_count: assembly.report.sections.length,
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
