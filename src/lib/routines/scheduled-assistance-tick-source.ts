import { z } from "zod";

export const SCHEDULED_ASSISTANCE_TICK_SOURCE_KINDS = [
  "manual",
  "foreground_scheduler",
  "test_fixture",
] as const;

export const SCHEDULED_ASSISTANCE_REJECTED_TICK_SOURCE_KINDS = [
  "background",
  "headless",
  "background_headless",
] as const;

export const SCHEDULED_ASSISTANCE_TICK_DECISION_REASONS = [
  "scheduler_execution_not_implemented",
  "background_headless_tick_rejected",
  "catch_up_not_supported",
] as const;

export type ScheduledAssistanceTickSourceKind =
  (typeof SCHEDULED_ASSISTANCE_TICK_SOURCE_KINDS)[number];
export type ScheduledAssistanceRejectedTickSourceKind =
  (typeof SCHEDULED_ASSISTANCE_REJECTED_TICK_SOURCE_KINDS)[number];
export type ScheduledAssistanceTickInputSourceKind =
  | ScheduledAssistanceTickSourceKind
  | ScheduledAssistanceRejectedTickSourceKind;
export type ScheduledAssistanceTickDecisionReason =
  (typeof SCHEDULED_ASSISTANCE_TICK_DECISION_REASONS)[number];

const TickIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^tick:[a-z0-9._:-]+$/);

export const ScheduledAssistanceTickSourceKindSchema = z.enum(
  SCHEDULED_ASSISTANCE_TICK_SOURCE_KINDS,
);
export const ScheduledAssistanceRejectedTickSourceKindSchema = z.enum(
  SCHEDULED_ASSISTANCE_REJECTED_TICK_SOURCE_KINDS,
);
export const ScheduledAssistanceTickInputSourceKindSchema = z.enum([
  ...SCHEDULED_ASSISTANCE_TICK_SOURCE_KINDS,
  ...SCHEDULED_ASSISTANCE_REJECTED_TICK_SOURCE_KINDS,
]);
export const ScheduledAssistanceTickDecisionReasonSchema = z.enum(
  SCHEDULED_ASSISTANCE_TICK_DECISION_REASONS,
);

export const ScheduledAssistanceTickInputSchema = z.strictObject({
  tick_id: TickIdSchema,
  tick_source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  requested_at_ms: z.number().int().nonnegative().default(0),
  catch_up_requested: z.boolean().default(false),
});

export const ScheduledAssistanceTickDecisionSchema = z.strictObject({
  tick_id: TickIdSchema,
  tick_source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  decision: z.literal("denied"),
  reason: ScheduledAssistanceTickDecisionReasonSchema,
  execution_allowed: z.literal(false),
  foreground_only: z.literal(true),
  background_allowed: z.literal(false),
  scheduler_execution_supported: z.literal(false),
  scheduler_execution_attempted: z.literal(false),
  routine_execution_supported: z.literal(false),
  routine_execution_attempted: z.literal(false),
  catch_up_supported: z.literal(false),
  catch_up_attempted: z.literal(false),
  missed_tick_policy: z.literal("skip"),
  metadata_only: z.literal(true),
  side_effects_allowed: z.literal(false),
  timer_started: z.literal(false),
  scheduler_started: z.literal(false),
  routine_executed: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  persisted: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
});

export type ScheduledAssistanceTickInput = z.input<
  typeof ScheduledAssistanceTickInputSchema
>;
export type ScheduledAssistanceTickDecision = z.infer<
  typeof ScheduledAssistanceTickDecisionSchema
>;

export function evaluateScheduledAssistanceTick(
  input: ScheduledAssistanceTickInput,
): ScheduledAssistanceTickDecision {
  const parsed = ScheduledAssistanceTickInputSchema.parse(input);

  return ScheduledAssistanceTickDecisionSchema.parse({
    tick_id: parsed.tick_id,
    tick_source_kind: parsed.tick_source_kind,
    decision: "denied",
    reason: reasonForTick(parsed),
    execution_allowed: false,
    foreground_only: true,
    background_allowed: false,
    scheduler_execution_supported: false,
    scheduler_execution_attempted: false,
    routine_execution_supported: false,
    routine_execution_attempted: false,
    catch_up_supported: false,
    catch_up_attempted: false,
    missed_tick_policy: "skip",
    metadata_only: true,
    side_effects_allowed: false,
    timer_started: false,
    scheduler_started: false,
    routine_executed: false,
    report_generated: false,
    suggestion_generated: false,
    persisted: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    memory_written: false,
    project_mutated: false,
    device_action_executed: false,
    approval_executed: false,
  });
}

function reasonForTick(
  input: z.infer<typeof ScheduledAssistanceTickInputSchema>,
): ScheduledAssistanceTickDecisionReason {
  if (
    input.tick_source_kind === "background" ||
    input.tick_source_kind === "headless" ||
    input.tick_source_kind === "background_headless"
  ) {
    return "background_headless_tick_rejected";
  }

  if (input.catch_up_requested) {
    return "catch_up_not_supported";
  }

  return "scheduler_execution_not_implemented";
}
