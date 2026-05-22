import { z } from "zod";

export const ROUTINE_TICK_SOURCE_MODES = [
  "manual",
  "foreground_single_process",
  "background",
  "multi_process",
  "remote",
  "network_triggered",
] as const;

export const ROUTINE_ALLOWED_TICK_SOURCE_MODES = [
  "manual",
  "foreground_single_process",
] as const;

export const ROUTINE_DISABLED_TICK_SOURCE_MODES = [
  "background",
  "multi_process",
  "remote",
  "network_triggered",
] as const;

export const ROUTINE_SCHEDULER_TICK_DECISIONS = [
  "eligible",
  "blocked",
  "noop",
] as const;

export const ROUTINE_SCHEDULER_TICK_REASONS = [
  "manual_tick_represented",
  "foreground_single_process_tick_represented",
  "disabled_tick_source_mode",
  "kill_switch_active",
  "user_present_required",
  "catch_up_tick_forbidden",
  "non_monotonic_timestamp",
] as const;

export const ROUTINE_SCHEDULER_TICK_TELEMETRY_EVENT_TYPES = [
  "routine_scheduler_tick_evaluated",
] as const;

export type RoutineTickSourceMode = (typeof ROUTINE_TICK_SOURCE_MODES)[number];
export type RoutineAllowedTickSourceMode =
  (typeof ROUTINE_ALLOWED_TICK_SOURCE_MODES)[number];
export type RoutineDisabledTickSourceMode =
  (typeof ROUTINE_DISABLED_TICK_SOURCE_MODES)[number];
export type RoutineSchedulerTickDecision =
  (typeof ROUTINE_SCHEDULER_TICK_DECISIONS)[number];
export type RoutineSchedulerTickReason =
  (typeof ROUTINE_SCHEDULER_TICK_REASONS)[number];
export type RoutineSchedulerTickTelemetryEventType =
  (typeof ROUTINE_SCHEDULER_TICK_TELEMETRY_EVENT_TYPES)[number];

const TickIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^tick:[a-z0-9._:-]+$/);

export const RoutineTickSourceModeSchema = z.enum(ROUTINE_TICK_SOURCE_MODES);
export const RoutineAllowedTickSourceModeSchema = z.enum(
  ROUTINE_ALLOWED_TICK_SOURCE_MODES,
);
export const RoutineDisabledTickSourceModeSchema = z.enum(
  ROUTINE_DISABLED_TICK_SOURCE_MODES,
);
export const RoutineSchedulerTickDecisionSchema = z.enum(
  ROUTINE_SCHEDULER_TICK_DECISIONS,
);
export const RoutineSchedulerTickReasonSchema = z.enum(
  ROUTINE_SCHEDULER_TICK_REASONS,
);
export const RoutineSchedulerTickTelemetryEventTypeSchema = z.enum(
  ROUTINE_SCHEDULER_TICK_TELEMETRY_EVENT_TYPES,
);

export const TickSourceConfigSchema = z.strictObject({
  mode: RoutineTickSourceModeSchema,
  allowed_modes: z.array(RoutineAllowedTickSourceModeSchema),
  disabled_modes: z.array(RoutineDisabledTickSourceModeSchema),
  foreground_only: z.literal(true),
  single_process_only: z.literal(true),
  timer_runtime_enabled: z.literal(false),
  background_jobs_enabled: z.literal(false),
  remote_triggers_enabled: z.literal(false),
  network_triggers_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const DEFAULT_TICK_SOURCE_CONFIG = TickSourceConfigSchema.parse({
  mode: "manual",
  allowed_modes: ["manual", "foreground_single_process"],
  disabled_modes: [
    "background",
    "multi_process",
    "remote",
    "network_triggered",
  ],
  foreground_only: true,
  single_process_only: true,
  timer_runtime_enabled: false,
  background_jobs_enabled: false,
  remote_triggers_enabled: false,
  network_triggers_enabled: false,
  metadata_only: true,
});

export const CreateSchedulerTickInputSchema = z.strictObject({
  tick_id: TickIdSchema,
  source_mode: RoutineTickSourceModeSchema,
  invoked_at_ms: z.number().int().nonnegative(),
  previous_tick_at_ms: z.number().int().nonnegative().nullable().default(null),
  kill_switch_active: z.boolean().default(false),
  user_present: z.boolean().default(false),
  user_present_required: z.boolean().default(true),
  catch_up_tick: z.boolean().default(false),
});

export const RoutineSchedulerTickSchema = z.strictObject({
  tick_id: TickIdSchema,
  source_mode: RoutineTickSourceModeSchema,
  invoked_at_ms: z.number().int().nonnegative(),
  previous_tick_at_ms: z.number().int().nonnegative().nullable(),
  monotonic_timestamp: z.boolean(),
  kill_switch_active: z.boolean(),
  user_present: z.boolean(),
  user_present_required: z.boolean(),
  catch_up_tick: z.boolean(),
  catch_up_allowed: z.literal(false),
  metadata_only: z.literal(true),
  foreground_only: z.literal(true),
  no_op_if_blocked: z.literal(true),
  scheduler_started: z.literal(false),
  timer_started: z.literal(false),
  background_job_started: z.literal(false),
  routine_executed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSchedulerTickValidationSchema = z.strictObject({
  decision: RoutineSchedulerTickDecisionSchema,
  reason: RoutineSchedulerTickReasonSchema,
  tick_id: TickIdSchema,
  source_mode: RoutineTickSourceModeSchema,
  metadata_only: z.literal(true),
  no_op: z.boolean(),
  scheduler_started: z.literal(false),
  timer_started: z.literal(false),
  background_job_started: z.literal(false),
  routine_executed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSchedulerTickTelemetryEventSchema = z.strictObject({
  event_type: RoutineSchedulerTickTelemetryEventTypeSchema,
  decision: RoutineSchedulerTickDecisionSchema,
  reason: RoutineSchedulerTickReasonSchema,
  source_mode: RoutineTickSourceModeSchema,
  eligible_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  noop_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_started: z.literal(false),
  timer_started: z.literal(false),
  background_job_started: z.literal(false),
  routine_executed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
});

export type TickSourceConfig = z.infer<typeof TickSourceConfigSchema>;
export type CreateSchedulerTickInput = z.input<
  typeof CreateSchedulerTickInputSchema
>;
export type RoutineSchedulerTick = z.infer<typeof RoutineSchedulerTickSchema>;
export type RoutineSchedulerTickValidation = z.infer<
  typeof RoutineSchedulerTickValidationSchema
>;
export type RoutineSchedulerTickTelemetryEvent = z.infer<
  typeof RoutineSchedulerTickTelemetryEventSchema
>;

export function createSchedulerTick(
  input: CreateSchedulerTickInput,
): RoutineSchedulerTick {
  const parsed = CreateSchedulerTickInputSchema.parse(input);
  return RoutineSchedulerTickSchema.parse({
    tick_id: parsed.tick_id,
    source_mode: parsed.source_mode,
    invoked_at_ms: parsed.invoked_at_ms,
    previous_tick_at_ms: parsed.previous_tick_at_ms,
    monotonic_timestamp:
      parsed.previous_tick_at_ms === null ||
      parsed.invoked_at_ms >= parsed.previous_tick_at_ms,
    kill_switch_active: parsed.kill_switch_active,
    user_present: parsed.user_present,
    user_present_required: parsed.user_present_required,
    catch_up_tick: parsed.catch_up_tick,
    catch_up_allowed: false,
    metadata_only: true,
    foreground_only: true,
    no_op_if_blocked: true,
    scheduler_started: false,
    timer_started: false,
    background_job_started: false,
    routine_executed: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    cloud_called: false,
  });
}

function validation(input: {
  decision: RoutineSchedulerTickDecision;
  reason: RoutineSchedulerTickReason;
  tick: RoutineSchedulerTick;
}): RoutineSchedulerTickValidation {
  return RoutineSchedulerTickValidationSchema.parse({
    decision: input.decision,
    reason: input.reason,
    tick_id: input.tick.tick_id,
    source_mode: input.tick.source_mode,
    metadata_only: true,
    no_op: input.decision !== "eligible",
    scheduler_started: false,
    timer_started: false,
    background_job_started: false,
    routine_executed: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    cloud_called: false,
  });
}

export function validateSchedulerTick(
  tickInput: RoutineSchedulerTick,
  configInput: TickSourceConfig = DEFAULT_TICK_SOURCE_CONFIG,
): RoutineSchedulerTickValidation {
  const tick = RoutineSchedulerTickSchema.parse(tickInput);
  const config = TickSourceConfigSchema.parse(configInput);

  if (config.disabled_modes.includes(tick.source_mode as never)) {
    return validation({
      decision: "blocked",
      reason: "disabled_tick_source_mode",
      tick,
    });
  }

  if (!config.allowed_modes.includes(tick.source_mode as never)) {
    return validation({
      decision: "blocked",
      reason: "disabled_tick_source_mode",
      tick,
    });
  }

  if (tick.kill_switch_active) {
    return validation({
      decision: "noop",
      reason: "kill_switch_active",
      tick,
    });
  }

  if (!tick.monotonic_timestamp) {
    return validation({
      decision: "blocked",
      reason: "non_monotonic_timestamp",
      tick,
    });
  }

  if (tick.catch_up_tick) {
    return validation({
      decision: "blocked",
      reason: "catch_up_tick_forbidden",
      tick,
    });
  }

  if (tick.user_present_required && !tick.user_present) {
    return validation({
      decision: "blocked",
      reason: "user_present_required",
      tick,
    });
  }

  return validation({
    decision: "eligible",
    reason:
      tick.source_mode === "foreground_single_process"
        ? "foreground_single_process_tick_represented"
        : "manual_tick_represented",
    tick,
  });
}

export function createSchedulerTickTelemetryEvent(
  validationInput: RoutineSchedulerTickValidation,
): RoutineSchedulerTickTelemetryEvent {
  const tickValidation =
    RoutineSchedulerTickValidationSchema.parse(validationInput);
  return RoutineSchedulerTickTelemetryEventSchema.parse({
    event_type: "routine_scheduler_tick_evaluated",
    decision: tickValidation.decision,
    reason: tickValidation.reason,
    source_mode: tickValidation.source_mode,
    eligible_count: tickValidation.decision === "eligible" ? 1 : 0,
    blocked_count: tickValidation.decision === "blocked" ? 1 : 0,
    noop_count: tickValidation.decision === "noop" ? 1 : 0,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_started: false,
    timer_started: false,
    background_job_started: false,
    routine_executed: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    cloud_called: false,
  });
}
