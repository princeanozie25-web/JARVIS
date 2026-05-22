import { z } from "zod";

import {
  DEFAULT_ROUTINE_REGISTRY,
  ROUTINE_SCHEDULE_POLICY_KINDS,
  RoutineSchedulePolicyKindSchema,
  RoutineTrustClassSchema,
  RoutineSchema,
  validateRoutineRegistry,
  type Routine,
  type RoutineRegistry,
  type RoutineSchedulePolicyKind,
  type RoutineTrustClass,
} from "./registry";

export const ROUTINE_SCHEDULING_DECISIONS = [
  "eligible",
  "blocked",
  "requires_user_opt_in",
] as const;

export const ROUTINE_SCHEDULING_POLICY_REASONS = [
  "manual_non_executing_eligible",
  "daily_self_audit_eligible",
  "daily_self_audit_requires_user_opt_in",
  "daily_not_allowed_in_v1",
  "interval_disabled_in_v1",
  "actuate_reserved_schedule_blocked",
  "kill_switch_engaged",
  "user_present_required",
  "missed_run_catch_up_disabled",
  "routine_to_routine_scheduling_forbidden",
  "routine_not_found",
  "unsafe_registry",
  "unsafe_routine",
] as const;

export const ROUTINE_SCHEDULE_POLICY_TELEMETRY_EVENT_TYPES = [
  "routine_schedule_policy_evaluated",
] as const;

export type RoutineSchedulingDecision =
  (typeof ROUTINE_SCHEDULING_DECISIONS)[number];
export type RoutineSchedulingPolicyReason =
  (typeof ROUTINE_SCHEDULING_POLICY_REASONS)[number];
export type RoutineSchedulePolicyTelemetryEventType =
  (typeof ROUTINE_SCHEDULE_POLICY_TELEMETRY_EVENT_TYPES)[number];

export const DAILY_SELF_AUDIT_ROUTINE_ID = "routine:self_audit" as const;

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const RoutineSchedulingDecisionSchema = z.enum(
  ROUTINE_SCHEDULING_DECISIONS,
);
export const RoutineSchedulingPolicyReasonSchema = z.enum(
  ROUTINE_SCHEDULING_POLICY_REASONS,
);
export const RoutineSchedulePolicyTelemetryEventTypeSchema = z.enum(
  ROUTINE_SCHEDULE_POLICY_TELEMETRY_EVENT_TYPES,
);

export const RoutineSchedulingPolicySchema = z.strictObject({
  routine_id: RoutineIdSchema,
  default_schedule_kind: RoutineSchedulePolicyKindSchema,
  allowed_schedule_kinds: z.array(RoutineSchedulePolicyKindSchema).min(1),
  user_opt_in_required: z.boolean(),
  user_present_required: z.literal(true),
  catch_up_missed_runs: z.literal(false),
  can_schedule_other_routines: z.literal(false),
  scheduler_runtime_enabled: z.literal(false),
  execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const RoutineSchedulingPolicyTableSchema = z.strictObject({
  version: z.literal("phase_8a2"),
  policies: z.array(RoutineSchedulingPolicySchema),
  default_schedule_kind: z.literal("manual"),
  interval_schedules_enabled: z.literal(false),
  routine_to_routine_scheduling_enabled: z.literal(false),
  missed_run_catch_up_enabled: z.literal(false),
  scheduler_runtime_registered: z.literal(false),
  background_jobs_registered: z.literal(false),
  metadata_only: z.literal(true),
});

export const RoutineScheduleEligibilityInputSchema = z.strictObject({
  routine_id: RoutineIdSchema,
  requested_schedule_kind: RoutineSchedulePolicyKindSchema.optional(),
  requested_by: z.enum(["user", "routine", "developer_test"]).default("user"),
  user_present: z.boolean().default(false),
  user_opted_in: z.boolean().default(false),
  missed_run: z.boolean().default(false),
  kill_switch_engaged: z.boolean().default(false),
});

export const RoutineScheduleEligibilityDecisionSchema = z.strictObject({
  decision: RoutineSchedulingDecisionSchema,
  reason: RoutineSchedulingPolicyReasonSchema,
  routine_id: RoutineIdSchema,
  schedule_kind: RoutineSchedulePolicyKindSchema,
  trust_class: RoutineTrustClassSchema,
  metadata_only: z.literal(true),
  non_executing: z.literal(true),
  scheduler_started: z.literal(false),
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

export const RoutineSchedulePolicyTelemetryEventSchema = z.strictObject({
  event_type: RoutineSchedulePolicyTelemetryEventTypeSchema,
  decision: RoutineSchedulingDecisionSchema,
  reason: RoutineSchedulingPolicyReasonSchema,
  schedule_kind: RoutineSchedulePolicyKindSchema,
  trust_class: RoutineTrustClassSchema,
  eligible_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  requires_user_opt_in_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_started: z.literal(false),
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

export type RoutineSchedulingPolicy = z.infer<
  typeof RoutineSchedulingPolicySchema
>;
export type RoutineSchedulingPolicyTable = z.infer<
  typeof RoutineSchedulingPolicyTableSchema
>;
export type RoutineScheduleEligibilityInput = z.input<
  typeof RoutineScheduleEligibilityInputSchema
>;
export type RoutineScheduleEligibilityDecision = z.infer<
  typeof RoutineScheduleEligibilityDecisionSchema
>;
export type RoutineSchedulePolicyTelemetryEvent = z.infer<
  typeof RoutineSchedulePolicyTelemetryEventSchema
>;

function defaultPolicyForRoutine(routine: Routine): RoutineSchedulingPolicy {
  const dailySelfAudit = routine.id === DAILY_SELF_AUDIT_ROUTINE_ID;
  return RoutineSchedulingPolicySchema.parse({
    routine_id: routine.id,
    default_schedule_kind: "manual",
    allowed_schedule_kinds: dailySelfAudit ? ["manual", "daily"] : ["manual"],
    user_opt_in_required: dailySelfAudit,
    user_present_required: true,
    catch_up_missed_runs: false,
    can_schedule_other_routines: false,
    scheduler_runtime_enabled: false,
    execution_enabled: false,
    metadata_only: true,
  });
}

export const DEFAULT_ROUTINE_SCHEDULING_POLICY_TABLE =
  RoutineSchedulingPolicyTableSchema.parse({
    version: "phase_8a2",
    policies: DEFAULT_ROUTINE_REGISTRY.routines.map(defaultPolicyForRoutine),
    default_schedule_kind: "manual",
    interval_schedules_enabled: false,
    routine_to_routine_scheduling_enabled: false,
    missed_run_catch_up_enabled: false,
    scheduler_runtime_registered: false,
    background_jobs_registered: false,
    metadata_only: true,
  });

function decision(input: {
  decision: RoutineSchedulingDecision;
  reason: RoutineSchedulingPolicyReason;
  routineId: string;
  scheduleKind: RoutineSchedulePolicyKind;
  trustClass: RoutineTrustClass;
}): RoutineScheduleEligibilityDecision {
  return RoutineScheduleEligibilityDecisionSchema.parse({
    decision: input.decision,
    reason: input.reason,
    routine_id: input.routineId,
    schedule_kind: input.scheduleKind,
    trust_class: input.trustClass,
    metadata_only: true,
    non_executing: true,
    scheduler_started: false,
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

function unsafeRoutine(routine: Routine): boolean {
  return (
    routine.side_effects !== "none" ||
    routine.can_call_tools ||
    routine.can_write_memory ||
    routine.can_trigger_approvals ||
    routine.can_mutate_projects ||
    routine.can_mutate_environment ||
    routine.can_mutate_runtime ||
    routine.can_use_cloud_network ||
    routine.can_run_background ||
    routine.can_execute_actions ||
    routine.autonomous ||
    routine.scheduler_registered ||
    routine.schedule_policy.scheduler_enabled ||
    routine.actuation_allowed
  );
}

export function evaluateRoutineScheduleEligibility(
  input: RoutineScheduleEligibilityInput,
  options: {
    registry?: RoutineRegistry;
    policyTable?: RoutineSchedulingPolicyTable;
  } = {},
): RoutineScheduleEligibilityDecision {
  const parsedInput = RoutineScheduleEligibilityInputSchema.parse(input);
  const registry = options.registry ?? DEFAULT_ROUTINE_REGISTRY;
  const policyTable =
    options.policyTable ?? DEFAULT_ROUTINE_SCHEDULING_POLICY_TABLE;
  const parsedPolicyTable =
    RoutineSchedulingPolicyTableSchema.parse(policyTable);
  const registryValidation = validateRoutineRegistry(registry);
  const routine =
    registry.routines.find((item) => item.id === parsedInput.routine_id) ??
    null;
  const fallbackScheduleKind =
    parsedInput.requested_schedule_kind ??
    routine?.schedule_policy.kind ??
    parsedPolicyTable.default_schedule_kind;
  const trustClass = routine?.trust_class ?? "observe";

  if (routine?.trust_class === "actuate_reserved") {
    return decision({
      decision: "blocked",
      reason: "actuate_reserved_schedule_blocked",
      routineId: routine.id,
      scheduleKind: fallbackScheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (!registryValidation.pass) {
    return decision({
      decision: "blocked",
      reason: "unsafe_registry",
      routineId: parsedInput.routine_id,
      scheduleKind: fallbackScheduleKind,
      trustClass,
    });
  }

  if (!routine) {
    return decision({
      decision: "blocked",
      reason: "routine_not_found",
      routineId: parsedInput.routine_id,
      scheduleKind: fallbackScheduleKind,
      trustClass,
    });
  }

  RoutineSchema.parse(routine);
  const policy =
    parsedPolicyTable.policies.find((item) => item.routine_id === routine.id) ??
    defaultPolicyForRoutine(routine);
  const scheduleKind =
    parsedInput.requested_schedule_kind ?? policy.default_schedule_kind;

  if (parsedInput.kill_switch_engaged) {
    return decision({
      decision: "blocked",
      reason: "kill_switch_engaged",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (parsedInput.requested_by === "routine") {
    return decision({
      decision: "blocked",
      reason: "routine_to_routine_scheduling_forbidden",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (parsedInput.missed_run) {
    return decision({
      decision: "blocked",
      reason: "missed_run_catch_up_disabled",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (unsafeRoutine(routine)) {
    return decision({
      decision: "blocked",
      reason: "unsafe_routine",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (policy.user_present_required && !parsedInput.user_present) {
    return decision({
      decision: "blocked",
      reason: "user_present_required",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (scheduleKind === "interval") {
    return decision({
      decision: "blocked",
      reason: "interval_disabled_in_v1",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (scheduleKind === "daily" && routine.id !== DAILY_SELF_AUDIT_ROUTINE_ID) {
    return decision({
      decision: "blocked",
      reason: "daily_not_allowed_in_v1",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (!policy.allowed_schedule_kinds.includes(scheduleKind)) {
    return decision({
      decision: "blocked",
      reason:
        scheduleKind === "daily"
          ? "daily_not_allowed_in_v1"
          : "interval_disabled_in_v1",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  if (
    scheduleKind === "daily" &&
    policy.user_opt_in_required &&
    !parsedInput.user_opted_in
  ) {
    return decision({
      decision: "requires_user_opt_in",
      reason: "daily_self_audit_requires_user_opt_in",
      routineId: routine.id,
      scheduleKind,
      trustClass: routine.trust_class,
    });
  }

  return decision({
    decision: "eligible",
    reason:
      scheduleKind === "daily"
        ? "daily_self_audit_eligible"
        : "manual_non_executing_eligible",
    routineId: routine.id,
    scheduleKind,
    trustClass: routine.trust_class,
  });
}

export function createRoutineSchedulePolicyTelemetryEvent(
  scheduleDecisionInput: RoutineScheduleEligibilityDecision,
): RoutineSchedulePolicyTelemetryEvent {
  const scheduleDecision = RoutineScheduleEligibilityDecisionSchema.parse(
    scheduleDecisionInput,
  );
  return RoutineSchedulePolicyTelemetryEventSchema.parse({
    event_type: "routine_schedule_policy_evaluated",
    decision: scheduleDecision.decision,
    reason: scheduleDecision.reason,
    schedule_kind: scheduleDecision.schedule_kind,
    trust_class: scheduleDecision.trust_class,
    eligible_count: scheduleDecision.decision === "eligible" ? 1 : 0,
    blocked_count: scheduleDecision.decision === "blocked" ? 1 : 0,
    requires_user_opt_in_count:
      scheduleDecision.decision === "requires_user_opt_in" ? 1 : 0,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_started: false,
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

export function getAllowedRoutineScheduleKinds(): readonly RoutineSchedulePolicyKind[] {
  return ROUTINE_SCHEDULE_POLICY_KINDS;
}
