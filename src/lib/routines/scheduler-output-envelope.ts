import { z } from "zod";

import {
  Phase17RoutineOutputKindSchema,
  type Phase17RoutineOutputKind,
} from "./routine-registry";
import { ScheduledAssistanceRoutineKindSchema } from "./runtime-contract";

export const FOREGROUND_SCHEDULER_OUTPUT_KINDS = [
  "report",
  "suggestion",
  "baseline_update",
  "none",
] as const;

export const FOREGROUND_SCHEDULER_REDACTION_STATUSES = [
  "not_started",
  "unavailable",
  "unsupported",
] as const;

export type ForegroundSchedulerOutputKind =
  (typeof FOREGROUND_SCHEDULER_OUTPUT_KINDS)[number];
export type ForegroundSchedulerRedactionStatus =
  (typeof FOREGROUND_SCHEDULER_REDACTION_STATUSES)[number];

const TickIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^tick:[a-z0-9._:-]+$/);

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const EnvelopeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^envelope:[a-z0-9._:-]+$/);

export const ForegroundSchedulerOutputKindSchema = z.enum(
  FOREGROUND_SCHEDULER_OUTPUT_KINDS,
);
export const ForegroundSchedulerRedactionStatusSchema = z.enum(
  FOREGROUND_SCHEDULER_REDACTION_STATUSES,
);

export const ForegroundSchedulerOutputEnvelopeRoutineSchema = z.object({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  output_kind: Phase17RoutineOutputKindSchema.optional(),
});

export const ForegroundSchedulerOutputEnvelopeInputSchema = z.strictObject({
  tick_id: TickIdSchema,
  routine: ForegroundSchedulerOutputEnvelopeRoutineSchema,
  eligible: z.boolean().default(false),
});

export const ForegroundSchedulerOutputEnvelopeSchema = z.strictObject({
  envelope_id: EnvelopeIdSchema,
  tick_id: TickIdSchema,
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  output_kind: ForegroundSchedulerOutputKindSchema,
  output_supported: z.literal(false),
  output_generated: z.literal(false),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  redaction_status: ForegroundSchedulerRedactionStatusSchema,
  raw_output_allowed: z.literal(false),
  persistence_supported: z.literal(false),
  persistence_attempted: z.literal(false),
  approval_bridge_supported: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  collector_execution_supported: z.literal(false),
  collector_execution_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
});

export type ForegroundSchedulerOutputEnvelopeRoutine = z.infer<
  typeof ForegroundSchedulerOutputEnvelopeRoutineSchema
>;
export type ForegroundSchedulerOutputEnvelopeInput = z.input<
  typeof ForegroundSchedulerOutputEnvelopeInputSchema
>;
export type ForegroundSchedulerOutputEnvelope = z.infer<
  typeof ForegroundSchedulerOutputEnvelopeSchema
>;

export function buildForegroundSchedulerOutputEnvelope(
  input: ForegroundSchedulerOutputEnvelopeInput,
): ForegroundSchedulerOutputEnvelope {
  const parsed = ForegroundSchedulerOutputEnvelopeInputSchema.parse(input);
  const outputKind = parsed.eligible
    ? normalizeOutputKind(parsed.routine.output_kind)
    : "none";

  return ForegroundSchedulerOutputEnvelopeSchema.parse({
    envelope_id: `envelope:${parsed.tick_id.replace(/^tick:/, "")}:${parsed.routine.routine_id.replace(/^routine:/, "")}`,
    tick_id: parsed.tick_id,
    routine_id: parsed.routine.routine_id,
    routine_kind: parsed.routine.routine_kind,
    output_kind: outputKind,
    output_supported: false,
    output_generated: false,
    metadata_only: true,
    redaction_required: true,
    redaction_status: parsed.eligible ? "not_started" : "unavailable",
    raw_output_allowed: false,
    persistence_supported: false,
    persistence_attempted: false,
    approval_bridge_supported: false,
    approval_bridge_attempted: false,
    collector_execution_supported: false,
    collector_execution_attempted: false,
    db_read_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    report_generated: false,
    suggestion_generated: false,
    baseline_update_generated: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    memory_written: false,
    project_mutated: false,
    device_action_executed: false,
    approval_executed: false,
  });
}

function normalizeOutputKind(
  outputKind: Phase17RoutineOutputKind | undefined,
): ForegroundSchedulerOutputKind {
  if (
    outputKind === "report" ||
    outputKind === "suggestion" ||
    outputKind === "baseline_update"
  ) {
    return outputKind;
  }

  return "none";
}
