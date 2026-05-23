import { z } from "zod";

export const ROUTINE_KILL_SWITCH_STATES = [
  "enabled",
  "disabled",
  "locked_down",
] as const;

export const ROUTINE_KILL_SWITCH_DECISIONS = [
  "allowed",
  "blocked",
  "locked_down",
] as const;

export const ROUTINE_KILL_SWITCH_OPERATIONS = [
  "tick_eligibility",
  "lease_acquisition",
  "routine_run",
  "change_state",
  "reset",
] as const;

export const ROUTINE_KILL_SWITCH_REQUEST_ORIGINS = [
  "user",
  "routine",
  "voice",
  "developer_test",
] as const;

export const ROUTINE_KILL_SWITCH_REASONS = [
  "enabled_policy_decision_only",
  "disabled_blocks_all",
  "locked_down_manual_reset_required",
  "routine_origin_cannot_change_kill_switch",
  "voice_origin_cannot_change_kill_switch",
  "automatic_reset_forbidden",
  "kill_switch_mutation_forbidden",
] as const;

export const ROUTINE_KILL_SWITCH_TELEMETRY_EVENT_TYPES = [
  "routine_kill_switch_evaluated",
] as const;

export type RoutineKillSwitchStateName =
  (typeof ROUTINE_KILL_SWITCH_STATES)[number];
export type RoutineKillSwitchDecisionName =
  (typeof ROUTINE_KILL_SWITCH_DECISIONS)[number];
export type RoutineKillSwitchOperation =
  (typeof ROUTINE_KILL_SWITCH_OPERATIONS)[number];
export type RoutineKillSwitchRequestOrigin =
  (typeof ROUTINE_KILL_SWITCH_REQUEST_ORIGINS)[number];
export type RoutineKillSwitchReason =
  (typeof ROUTINE_KILL_SWITCH_REASONS)[number];
export type RoutineKillSwitchTelemetryEventType =
  (typeof ROUTINE_KILL_SWITCH_TELEMETRY_EVENT_TYPES)[number];

export const RoutineKillSwitchStateNameSchema = z.enum(
  ROUTINE_KILL_SWITCH_STATES,
);
export const RoutineKillSwitchDecisionNameSchema = z.enum(
  ROUTINE_KILL_SWITCH_DECISIONS,
);
export const RoutineKillSwitchOperationSchema = z.enum(
  ROUTINE_KILL_SWITCH_OPERATIONS,
);
export const RoutineKillSwitchRequestOriginSchema = z.enum(
  ROUTINE_KILL_SWITCH_REQUEST_ORIGINS,
);
export const RoutineKillSwitchReasonSchema = z.enum(
  ROUTINE_KILL_SWITCH_REASONS,
);
export const RoutineKillSwitchTelemetryEventTypeSchema = z.enum(
  ROUTINE_KILL_SWITCH_TELEMETRY_EVENT_TYPES,
);

export const RoutineKillSwitchStateSchema = z.strictObject({
  state: RoutineKillSwitchStateNameSchema,
  checked_at_ms: z.number().int().nonnegative(),
  manual_reset_required: z.boolean(),
  automatic_reset_enabled: z.literal(false),
  can_be_changed_by_routine: z.literal(false),
  can_be_changed_by_voice: z.literal(false),
  scheduler_execution_enabled: z.literal(false),
  routine_execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const RoutineKillSwitchEvaluationInputSchema = z.strictObject({
  kill_switch: RoutineKillSwitchStateSchema,
  operation: RoutineKillSwitchOperationSchema,
  requested_by: RoutineKillSwitchRequestOriginSchema.default("user"),
  automatic_reset_requested: z.boolean().default(false),
});

export const RoutineKillSwitchDecisionSchema = z.strictObject({
  decision: RoutineKillSwitchDecisionNameSchema,
  reason: RoutineKillSwitchReasonSchema,
  state: RoutineKillSwitchStateNameSchema,
  operation: RoutineKillSwitchOperationSchema,
  requested_by: RoutineKillSwitchRequestOriginSchema,
  manual_reset_required: z.boolean(),
  policy_decision_only: z.literal(true),
  metadata_only: z.literal(true),
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
  kill_switch_mutated: z.literal(false),
  automatic_reset_performed: z.literal(false),
});

export const RoutineKillSwitchTelemetryEventSchema = z.strictObject({
  event_type: RoutineKillSwitchTelemetryEventTypeSchema,
  decision: RoutineKillSwitchDecisionNameSchema,
  reason: RoutineKillSwitchReasonSchema,
  state: RoutineKillSwitchStateNameSchema,
  operation: RoutineKillSwitchOperationSchema,
  allowed_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  locked_down_count: z.number().int().nonnegative(),
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
  kill_switch_mutated: z.literal(false),
  automatic_reset_performed: z.literal(false),
});

export type RoutineKillSwitchState = z.infer<
  typeof RoutineKillSwitchStateSchema
>;
export type RoutineKillSwitchEvaluationInput = z.input<
  typeof RoutineKillSwitchEvaluationInputSchema
>;
export type RoutineKillSwitchDecision = z.infer<
  typeof RoutineKillSwitchDecisionSchema
>;
export type RoutineKillSwitchTelemetryEvent = z.infer<
  typeof RoutineKillSwitchTelemetryEventSchema
>;

export const DEFAULT_ROUTINE_KILL_SWITCH_STATE =
  RoutineKillSwitchStateSchema.parse({
    state: "disabled",
    checked_at_ms: 0,
    manual_reset_required: false,
    automatic_reset_enabled: false,
    can_be_changed_by_routine: false,
    can_be_changed_by_voice: false,
    scheduler_execution_enabled: false,
    routine_execution_enabled: false,
    metadata_only: true,
  });

export function createRoutineKillSwitchState(input: {
  state: RoutineKillSwitchStateName;
  checked_at_ms: number;
}): RoutineKillSwitchState {
  return RoutineKillSwitchStateSchema.parse({
    state: input.state,
    checked_at_ms: input.checked_at_ms,
    manual_reset_required: input.state === "locked_down",
    automatic_reset_enabled: false,
    can_be_changed_by_routine: false,
    can_be_changed_by_voice: false,
    scheduler_execution_enabled: false,
    routine_execution_enabled: false,
    metadata_only: true,
  });
}

function decision(input: {
  decision: RoutineKillSwitchDecisionName;
  reason: RoutineKillSwitchReason;
  killSwitch: RoutineKillSwitchState;
  operation: RoutineKillSwitchOperation;
  requestedBy: RoutineKillSwitchRequestOrigin;
}): RoutineKillSwitchDecision {
  return RoutineKillSwitchDecisionSchema.parse({
    decision: input.decision,
    reason: input.reason,
    state: input.killSwitch.state,
    operation: input.operation,
    requested_by: input.requestedBy,
    manual_reset_required: input.killSwitch.manual_reset_required,
    policy_decision_only: true,
    metadata_only: true,
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
    kill_switch_mutated: false,
    automatic_reset_performed: false,
  });
}

export function evaluateRoutineKillSwitch(
  input: RoutineKillSwitchEvaluationInput,
): RoutineKillSwitchDecision {
  const parsed = RoutineKillSwitchEvaluationInputSchema.parse(input);

  if (parsed.automatic_reset_requested) {
    return decision({
      decision: "blocked",
      reason: "automatic_reset_forbidden",
      killSwitch: parsed.kill_switch,
      operation: parsed.operation,
      requestedBy: parsed.requested_by,
    });
  }

  if (
    parsed.operation === "change_state" &&
    parsed.requested_by === "routine"
  ) {
    return decision({
      decision: "blocked",
      reason: "routine_origin_cannot_change_kill_switch",
      killSwitch: parsed.kill_switch,
      operation: parsed.operation,
      requestedBy: parsed.requested_by,
    });
  }

  if (parsed.operation === "change_state" && parsed.requested_by === "voice") {
    return decision({
      decision: "blocked",
      reason: "voice_origin_cannot_change_kill_switch",
      killSwitch: parsed.kill_switch,
      operation: parsed.operation,
      requestedBy: parsed.requested_by,
    });
  }

  if (parsed.operation === "change_state" || parsed.operation === "reset") {
    return decision({
      decision: "blocked",
      reason: "kill_switch_mutation_forbidden",
      killSwitch: parsed.kill_switch,
      operation: parsed.operation,
      requestedBy: parsed.requested_by,
    });
  }

  if (parsed.kill_switch.state === "locked_down") {
    return decision({
      decision: "locked_down",
      reason: "locked_down_manual_reset_required",
      killSwitch: parsed.kill_switch,
      operation: parsed.operation,
      requestedBy: parsed.requested_by,
    });
  }

  if (parsed.kill_switch.state === "disabled") {
    return decision({
      decision: "blocked",
      reason: "disabled_blocks_all",
      killSwitch: parsed.kill_switch,
      operation: parsed.operation,
      requestedBy: parsed.requested_by,
    });
  }

  return decision({
    decision: "allowed",
    reason: "enabled_policy_decision_only",
    killSwitch: parsed.kill_switch,
    operation: parsed.operation,
    requestedBy: parsed.requested_by,
  });
}

export function assertRoutineKillSwitchAllows(
  input: RoutineKillSwitchEvaluationInput,
): RoutineKillSwitchDecision {
  return evaluateRoutineKillSwitch(input);
}

export function createRoutineKillSwitchTelemetryEvent(
  decisionInput: RoutineKillSwitchDecision,
): RoutineKillSwitchTelemetryEvent {
  const killSwitchDecision =
    RoutineKillSwitchDecisionSchema.parse(decisionInput);
  return RoutineKillSwitchTelemetryEventSchema.parse({
    event_type: "routine_kill_switch_evaluated",
    decision: killSwitchDecision.decision,
    reason: killSwitchDecision.reason,
    state: killSwitchDecision.state,
    operation: killSwitchDecision.operation,
    allowed_count: killSwitchDecision.decision === "allowed" ? 1 : 0,
    blocked_count: killSwitchDecision.decision === "blocked" ? 1 : 0,
    locked_down_count: killSwitchDecision.decision === "locked_down" ? 1 : 0,
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
    kill_switch_mutated: false,
    automatic_reset_performed: false,
  });
}
