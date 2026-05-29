import { z } from "zod";

import { ScheduledAssistanceTickInputSourceKindSchema } from "./scheduled-assistance-tick-source";

export const FOREGROUND_SCHEDULER_AUDIT_REDACTION_STATUSES = [
  "not_started",
  "unavailable",
  "unsupported",
] as const;

export type ForegroundSchedulerAuditRedactionStatus =
  (typeof FOREGROUND_SCHEDULER_AUDIT_REDACTION_STATUSES)[number];

const TickIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^tick:[a-z0-9._:-]+$/);

const AuditPreviewIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^audit_preview:[a-z0-9._:-]+$/);

export const ForegroundSchedulerAuditRedactionStatusSchema = z.enum(
  FOREGROUND_SCHEDULER_AUDIT_REDACTION_STATUSES,
);

export const ForegroundSchedulerAuditPreviewInputSchema = z.strictObject({
  tick_id: TickIdSchema,
  source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  eligible_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  output_envelope_count: z.number().int().nonnegative(),
});

export const ForegroundSchedulerAuditPreviewSchema = z.strictObject({
  audit_preview_id: AuditPreviewIdSchema,
  tick_id: TickIdSchema,
  source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  eligible_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  output_envelope_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_status: ForegroundSchedulerAuditRedactionStatusSchema,
  raw_payload_allowed: z.literal(false),
  persistence_supported: z.literal(false),
  persistence_attempted: z.literal(false),
  event_store_write_supported: z.literal(false),
  event_store_write_attempted: z.literal(false),
  telemetry_supported: z.literal(false),
  telemetry_attempted: z.literal(false),
  collector_execution_supported: z.literal(false),
  collector_execution_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  routine_executed: z.literal(false),
  timer_started: z.literal(false),
  scheduler_started: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
});

export type ForegroundSchedulerAuditPreviewInput = z.input<
  typeof ForegroundSchedulerAuditPreviewInputSchema
>;
export type ForegroundSchedulerAuditPreview = z.infer<
  typeof ForegroundSchedulerAuditPreviewSchema
>;

export function buildForegroundSchedulerAuditPreview(
  input: ForegroundSchedulerAuditPreviewInput,
): ForegroundSchedulerAuditPreview {
  const parsed = ForegroundSchedulerAuditPreviewInputSchema.parse(input);

  return ForegroundSchedulerAuditPreviewSchema.parse({
    audit_preview_id: `audit_preview:${parsed.tick_id.replace(/^tick:/, "")}`,
    tick_id: parsed.tick_id,
    source_kind: parsed.source_kind,
    eligible_count: parsed.eligible_count,
    skipped_count: parsed.skipped_count,
    output_envelope_count: parsed.output_envelope_count,
    metadata_only: true,
    replay_safe: true,
    redaction_status: "not_started",
    raw_payload_allowed: false,
    persistence_supported: false,
    persistence_attempted: false,
    event_store_write_supported: false,
    event_store_write_attempted: false,
    telemetry_supported: false,
    telemetry_attempted: false,
    collector_execution_supported: false,
    collector_execution_attempted: false,
    db_read_performed: false,
    event_store_read_performed: false,
    report_generated: false,
    suggestion_generated: false,
    baseline_update_generated: false,
    routine_executed: false,
    timer_started: false,
    scheduler_started: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    memory_written: false,
    project_mutated: false,
    device_action_executed: false,
    approval_executed: false,
  });
}
