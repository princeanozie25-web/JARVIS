import { z } from "zod";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  Phase17DisabledGuardMatrixSchema,
} from "./phase-17-disabled-guards";
import {
  Phase17RoutineClassSchema,
  Phase17RoutineOutputKindSchema,
} from "./routine-registry";
import {
  DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT,
  ScheduledAssistanceRoutineKindSchema,
  ScheduledAssistanceRuntimeContractSchema,
  ScheduledAssistanceScheduleKindSchema,
} from "./runtime-contract";
import { ScheduledAssistanceTickInputSourceKindSchema } from "./scheduled-assistance-tick-source";

export const ROUTINE_ELIGIBILITY_USER_PRESENT_STATES = [
  "present",
  "absent",
  "unknown",
  "not_checked",
] as const;

export const ROUTINE_ELIGIBILITY_KILL_SWITCH_STATES = [
  "safe",
  "active",
  "missing",
  "unsafe",
] as const;

export const ROUTINE_ELIGIBILITY_REASONS = [
  "eligible_metadata_only",
  "routine_disabled",
  "user_absent",
  "user_unknown",
  "user_presence_not_checked",
  "kill_switch_active",
  "kill_switch_missing",
  "kill_switch_unsafe",
  "background_headless_tick_rejected",
  "unsafe_routine_entry",
  "unsafe_runtime_contract",
  "unsafe_disabled_guard_state",
  "side_effects_forbidden",
  "tool_authority_forbidden",
  "device_authority_forbidden",
  "memory_write_forbidden",
  "project_mutation_forbidden",
  "approval_execution_forbidden",
  "cloud_network_forbidden",
] as const;

export type RoutineEligibilityUserPresentState =
  (typeof ROUTINE_ELIGIBILITY_USER_PRESENT_STATES)[number];
export type RoutineEligibilityKillSwitchState =
  (typeof ROUTINE_ELIGIBILITY_KILL_SWITCH_STATES)[number];
export type RoutineEligibilityReason =
  (typeof ROUTINE_ELIGIBILITY_REASONS)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const RoutineEligibilityUserPresentStateSchema = z.enum(
  ROUTINE_ELIGIBILITY_USER_PRESENT_STATES,
);
export const RoutineEligibilityKillSwitchStateSchema = z.enum(
  ROUTINE_ELIGIBILITY_KILL_SWITCH_STATES,
);
export const RoutineEligibilityReasonSchema = z.enum(
  ROUTINE_ELIGIBILITY_REASONS,
);

export const RoutineEligibilityRoutineSchema = z.strictObject({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  routine_class: Phase17RoutineClassSchema,
  schedule_kind: ScheduledAssistanceScheduleKindSchema,
  enabled: z.boolean(),
  enabled_by_default: z.boolean(),
  requires_user_present: z.boolean(),
  side_effects_allowed: z.boolean(),
  output_kind: Phase17RoutineOutputKindSchema,
  execution_supported: z.boolean(),
  metadata_only: z.boolean(),
  foreground_only: z.boolean(),
  kill_switch_required: z.boolean(),
  scheduler_execution_supported: z.boolean(),
  background_headless_allowed: z.boolean(),
  tool_execution_allowed: z.boolean(),
  device_action_allowed: z.boolean(),
  project_mutation_allowed: z.boolean(),
  memory_write_allowed: z.boolean(),
  approval_execution_allowed: z.boolean(),
  cloud_network_allowed: z.boolean(),
});

export const RoutineEligibilityTickMetadataSchema = z.strictObject({
  tick_id: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^tick:[a-z0-9._:-]+$/),
  tick_source_kind: ScheduledAssistanceTickInputSourceKindSchema,
});

export const RoutineEligibilityGuardStateSchema = z.strictObject({
  user_present_state:
    RoutineEligibilityUserPresentStateSchema.default("not_checked"),
  kill_switch_state: RoutineEligibilityKillSwitchStateSchema.default("missing"),
  disabled_guards: z.unknown().default(DEFAULT_PHASE_17_DISABLED_GUARDS),
});

export const RoutineEligibilityDecisionSchema = z.strictObject({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  eligible: z.boolean(),
  enabled: z.boolean(),
  enabled_by_default: z.boolean(),
  user_present_required: z.boolean(),
  user_present_state: RoutineEligibilityUserPresentStateSchema,
  kill_switch_required: z.boolean(),
  kill_switch_state: RoutineEligibilityKillSwitchStateSchema,
  schedule_kind: ScheduledAssistanceScheduleKindSchema,
  tick_source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  foreground_only: z.literal(true),
  side_effects_allowed: z.literal(false),
  execution_supported: z.literal(false),
  reason: RoutineEligibilityReasonSchema,
  error_class: RoutineEligibilityReasonSchema,
  metadata_only: z.literal(true),
  routine_execution_allowed: z.literal(false),
  routine_executed: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  collector_ran: z.literal(false),
  persisted: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
});

export type RoutineEligibilityRoutine = z.infer<
  typeof RoutineEligibilityRoutineSchema
>;
export type RoutineEligibilityTickMetadata = z.infer<
  typeof RoutineEligibilityTickMetadataSchema
>;
export type RoutineEligibilityGuardState = z.input<
  typeof RoutineEligibilityGuardStateSchema
>;
export type RoutineEligibilityDecision = z.infer<
  typeof RoutineEligibilityDecisionSchema
>;

export function evaluateRoutineEligibility(
  routine: unknown,
  tick: unknown,
  runtimeContract: unknown = DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT,
  guardState: RoutineEligibilityGuardState = {},
): RoutineEligibilityDecision {
  const parsedRoutine = RoutineEligibilityRoutineSchema.safeParse(routine);
  const parsedTick = RoutineEligibilityTickMetadataSchema.safeParse(tick);
  const parsedRuntime =
    ScheduledAssistanceRuntimeContractSchema.safeParse(runtimeContract);
  const parsedGuardState = RoutineEligibilityGuardStateSchema.parse(guardState);
  const parsedDisabledGuards = Phase17DisabledGuardMatrixSchema.safeParse(
    parsedGuardState.disabled_guards,
  );

  if (!parsedRoutine.success || !parsedTick.success) {
    return decision({
      routine_id: "routine:invalid",
      routine_kind: "daily_self_audit",
      enabled: false,
      enabled_by_default: false,
      user_present_required: true,
      user_present_state: parsedGuardState.user_present_state,
      kill_switch_required: true,
      kill_switch_state: parsedGuardState.kill_switch_state,
      schedule_kind: "manual",
      tick_source_kind: "test_fixture",
      eligible: false,
      reason: "unsafe_routine_entry",
    });
  }

  const reason = reasonForEligibility({
    routine: parsedRoutine.data,
    tick: parsedTick.data,
    runtimeSafe: parsedRuntime.success,
    disabledGuardsSafe: parsedDisabledGuards.success,
    userPresentState: parsedGuardState.user_present_state,
    killSwitchState: parsedGuardState.kill_switch_state,
  });

  return decision({
    routine_id: parsedRoutine.data.routine_id,
    routine_kind: parsedRoutine.data.routine_kind,
    enabled: parsedRoutine.data.enabled,
    enabled_by_default: parsedRoutine.data.enabled_by_default,
    user_present_required: parsedRoutine.data.requires_user_present,
    user_present_state: parsedGuardState.user_present_state,
    kill_switch_required: parsedRoutine.data.kill_switch_required,
    kill_switch_state: parsedGuardState.kill_switch_state,
    schedule_kind: parsedRoutine.data.schedule_kind,
    tick_source_kind: parsedTick.data.tick_source_kind,
    eligible: reason === "eligible_metadata_only",
    reason,
  });
}

function decision(input: {
  readonly routine_id: string;
  readonly routine_kind: RoutineEligibilityDecision["routine_kind"];
  readonly enabled: boolean;
  readonly enabled_by_default: boolean;
  readonly user_present_required: boolean;
  readonly user_present_state: RoutineEligibilityUserPresentState;
  readonly kill_switch_required: boolean;
  readonly kill_switch_state: RoutineEligibilityKillSwitchState;
  readonly schedule_kind: RoutineEligibilityDecision["schedule_kind"];
  readonly tick_source_kind: RoutineEligibilityDecision["tick_source_kind"];
  readonly eligible: boolean;
  readonly reason: RoutineEligibilityReason;
}): RoutineEligibilityDecision {
  return RoutineEligibilityDecisionSchema.parse({
    routine_id: input.routine_id,
    routine_kind: input.routine_kind,
    eligible: input.eligible,
    enabled: input.enabled,
    enabled_by_default: input.enabled_by_default,
    user_present_required: input.user_present_required,
    user_present_state: input.user_present_state,
    kill_switch_required: input.kill_switch_required,
    kill_switch_state: input.kill_switch_state,
    schedule_kind: input.schedule_kind,
    tick_source_kind: input.tick_source_kind,
    foreground_only: true,
    side_effects_allowed: false,
    execution_supported: false,
    reason: input.reason,
    error_class: input.reason,
    metadata_only: true,
    routine_execution_allowed: false,
    routine_executed: false,
    report_generated: false,
    suggestion_generated: false,
    collector_ran: false,
    persisted: false,
    db_read_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    memory_written: false,
    project_mutated: false,
    device_action_executed: false,
    approval_executed: false,
  });
}

function reasonForEligibility(input: {
  readonly routine: RoutineEligibilityRoutine;
  readonly tick: RoutineEligibilityTickMetadata;
  readonly runtimeSafe: boolean;
  readonly disabledGuardsSafe: boolean;
  readonly userPresentState: RoutineEligibilityUserPresentState;
  readonly killSwitchState: RoutineEligibilityKillSwitchState;
}): RoutineEligibilityReason {
  if (
    input.tick.tick_source_kind === "background" ||
    input.tick.tick_source_kind === "headless" ||
    input.tick.tick_source_kind === "background_headless"
  ) {
    return "background_headless_tick_rejected";
  }
  if (!input.disabledGuardsSafe) {
    return "unsafe_disabled_guard_state";
  }
  if (!input.runtimeSafe) {
    return "unsafe_runtime_contract";
  }
  if (!input.routine.enabled) {
    return "routine_disabled";
  }
  if (input.routine.side_effects_allowed) {
    return "side_effects_forbidden";
  }
  if (input.routine.tool_execution_allowed) {
    return "tool_authority_forbidden";
  }
  if (input.routine.device_action_allowed) {
    return "device_authority_forbidden";
  }
  if (input.routine.memory_write_allowed) {
    return "memory_write_forbidden";
  }
  if (input.routine.project_mutation_allowed) {
    return "project_mutation_forbidden";
  }
  if (input.routine.approval_execution_allowed) {
    return "approval_execution_forbidden";
  }
  if (input.routine.cloud_network_allowed) {
    return "cloud_network_forbidden";
  }
  if (input.killSwitchState === "active") {
    return "kill_switch_active";
  }
  if (input.killSwitchState === "missing") {
    return "kill_switch_missing";
  }
  if (input.killSwitchState === "unsafe") {
    return "kill_switch_unsafe";
  }
  if (input.routine.requires_user_present) {
    if (input.userPresentState === "absent") {
      return "user_absent";
    }
    if (input.userPresentState === "unknown") {
      return "user_unknown";
    }
    if (input.userPresentState === "not_checked") {
      return "user_presence_not_checked";
    }
  }
  if (
    input.routine.enabled_by_default ||
    !input.routine.requires_user_present ||
    !input.routine.kill_switch_required ||
    !input.routine.metadata_only ||
    !input.routine.foreground_only ||
    input.routine.scheduler_execution_supported ||
    input.routine.background_headless_allowed ||
    input.routine.execution_supported
  ) {
    return "unsafe_routine_entry";
  }

  return "eligible_metadata_only";
}
