import { z } from "zod";

import {
  RoutineSchema,
  validateRoutineRegistry,
  type Routine,
  type RoutineRegistry,
} from "./registry";
import { RoutineSchedulerTickSchema } from "./tick-source";

export const ROUTINE_RUN_LEASE_STATES = [
  "available",
  "acquired",
  "denied",
  "expired",
  "cancelled",
] as const;

export const ROUTINE_RUN_LEASE_REASONS = [
  "lease_available",
  "lease_acquired",
  "concurrency_cap_reached",
  "kill_switch_active",
  "user_present_required",
  "routine_invalid",
  "routine_disabled",
  "lease_expired",
  "lease_cancelled",
] as const;

export const ROUTINE_RUN_LEASE_TELEMETRY_EVENT_TYPES = [
  "routine_run_lease_evaluated",
] as const;

export type RoutineRunLeaseState = (typeof ROUTINE_RUN_LEASE_STATES)[number];
export type RoutineRunLeaseReason = (typeof ROUTINE_RUN_LEASE_REASONS)[number];
export type RoutineRunLeaseTelemetryEventType =
  (typeof ROUTINE_RUN_LEASE_TELEMETRY_EVENT_TYPES)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const LeaseIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^lease:[a-z0-9._:-]+$/);

const CancellationTokenRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^(cancel|hash|ref):[a-z0-9._:-]+$/);

export const RoutineRunLeaseStateSchema = z.enum(ROUTINE_RUN_LEASE_STATES);
export const RoutineRunLeaseReasonSchema = z.enum(ROUTINE_RUN_LEASE_REASONS);
export const RoutineRunLeaseTelemetryEventTypeSchema = z.enum(
  ROUTINE_RUN_LEASE_TELEMETRY_EVENT_TYPES,
);

export const RoutineConcurrencyPolicySchema = z.strictObject({
  concurrency_cap: z.literal(1),
  deny_when_active_lease_exists: z.literal(true),
  user_present_required: z.literal(true),
  timer_runtime_enabled: z.literal(false),
  background_jobs_enabled: z.literal(false),
  scheduler_loop_enabled: z.literal(false),
  routine_execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const DEFAULT_ROUTINE_CONCURRENCY_POLICY =
  RoutineConcurrencyPolicySchema.parse({
    concurrency_cap: 1,
    deny_when_active_lease_exists: true,
    user_present_required: true,
    timer_runtime_enabled: false,
    background_jobs_enabled: false,
    scheduler_loop_enabled: false,
    routine_execution_enabled: false,
    metadata_only: true,
  });

export const EvaluateRoutineRunLeaseInputSchema = z.strictObject({
  lease_id: LeaseIdSchema,
  tick: RoutineSchedulerTickSchema,
  routine: z.unknown(),
  active_lease_count: z.number().int().nonnegative(),
  kill_switch_active: z.boolean().default(false),
  user_present: z.boolean().default(false),
  max_runtime_ms: z.number().int().positive(),
  cancellation_token_ref: CancellationTokenRefSchema,
});

export const RoutineRunLeaseSchema = z.strictObject({
  lease_id: LeaseIdSchema,
  state: RoutineRunLeaseStateSchema,
  reason: RoutineRunLeaseReasonSchema,
  routine_id: RoutineIdSchema,
  tick_id: z.string().trim().min(1).max(160),
  active_lease_count: z.number().int().nonnegative(),
  concurrency_cap: z.literal(1),
  max_runtime_ms: z.number().int().positive(),
  cancellation_token_ref: CancellationTokenRefSchema,
  acquired_at_ms: z.number().int().nonnegative().nullable(),
  ended_at_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  lease_only: z.literal(true),
  no_future_work_scheduled: z.literal(true),
  timer_started: z.literal(false),
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

export const RoutineRunLeaseTelemetryEventSchema = z.strictObject({
  event_type: RoutineRunLeaseTelemetryEventTypeSchema,
  state: RoutineRunLeaseStateSchema,
  reason: RoutineRunLeaseReasonSchema,
  acquired_count: z.number().int().nonnegative(),
  denied_count: z.number().int().nonnegative(),
  expired_count: z.number().int().nonnegative(),
  cancelled_count: z.number().int().nonnegative(),
  concurrency_cap: z.literal(1),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  timer_started: z.literal(false),
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

export type RoutineConcurrencyPolicy = z.infer<
  typeof RoutineConcurrencyPolicySchema
>;
export type EvaluateRoutineRunLeaseInput = z.input<
  typeof EvaluateRoutineRunLeaseInputSchema
>;
export type RoutineRunLease = z.infer<typeof RoutineRunLeaseSchema>;
export type RoutineRunLeaseTelemetryEvent = z.infer<
  typeof RoutineRunLeaseTelemetryEventSchema
>;

function routineIdFromUnknown(routine: unknown): string {
  const maybeRoutine = routine as { id?: unknown };
  return typeof maybeRoutine.id === "string"
    ? maybeRoutine.id
    : "routine:invalid";
}

function unsafeRoutine(routine: Routine): boolean {
  const registry: RoutineRegistry = {
    version: "phase_8a1",
    routines: [routine],
    feature_flags: {
      scheduler_runtime: false,
      timers: false,
      background_jobs: false,
      tool_calls: false,
      runtime_actions: false,
      approval_granting: false,
      memory_writes: false,
      project_mutations: false,
      environment_mutations: false,
      runtime_mutations: false,
      cloud_network_calls: false,
      ui: false,
      voice_scheduling: false,
    },
    kill_switch: {
      global_routines_enabled: false,
      scheduler_enabled: false,
      autonomous_execution_enabled: false,
      tool_calls_enabled: false,
      memory_writes_enabled: false,
      approvals_enabled: false,
      runtime_actions_enabled: false,
      project_mutations_enabled: false,
      environment_mutations_enabled: false,
      runtime_mutations_enabled: false,
      cloud_network_enabled: false,
      metadata_only: true,
    },
    metadata_only: true,
    scheduler_runtime_registered: false,
    background_jobs_registered: false,
    runtime_tools_registered: false,
    actions_registered: false,
    approvals_registered: false,
  };
  return !validateRoutineRegistry(registry).pass;
}

function lease(input: {
  parsedInput: z.infer<typeof EvaluateRoutineRunLeaseInputSchema>;
  state: RoutineRunLeaseState;
  reason: RoutineRunLeaseReason;
  routineId: string;
  acquiredAtMs: number | null;
  endedAtMs?: number | null;
  policy: RoutineConcurrencyPolicy;
}): RoutineRunLease {
  return RoutineRunLeaseSchema.parse({
    lease_id: input.parsedInput.lease_id,
    state: input.state,
    reason: input.reason,
    routine_id: input.routineId,
    tick_id: input.parsedInput.tick.tick_id,
    active_lease_count: input.parsedInput.active_lease_count,
    concurrency_cap: input.policy.concurrency_cap,
    max_runtime_ms: input.parsedInput.max_runtime_ms,
    cancellation_token_ref: input.parsedInput.cancellation_token_ref,
    acquired_at_ms: input.acquiredAtMs,
    ended_at_ms: input.endedAtMs ?? null,
    metadata_only: true,
    lease_only: true,
    no_future_work_scheduled: true,
    timer_started: false,
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

export function evaluateRoutineRunLease(
  input: EvaluateRoutineRunLeaseInput,
  policyInput: RoutineConcurrencyPolicy = DEFAULT_ROUTINE_CONCURRENCY_POLICY,
): RoutineRunLease {
  const parsedInput = EvaluateRoutineRunLeaseInputSchema.parse(input);
  const policy = RoutineConcurrencyPolicySchema.parse(policyInput);
  const routineResult = RoutineSchema.safeParse(parsedInput.routine);
  const routineId = routineResult.success
    ? routineResult.data.id
    : routineIdFromUnknown(parsedInput.routine);

  if (!routineResult.success) {
    return lease({
      parsedInput,
      state: "denied",
      reason: "routine_invalid",
      routineId,
      acquiredAtMs: null,
      policy,
    });
  }

  if (!routineResult.data.enabled) {
    return lease({
      parsedInput,
      state: "denied",
      reason: "routine_disabled",
      routineId,
      acquiredAtMs: null,
      policy,
    });
  }

  if (unsafeRoutine(routineResult.data)) {
    return lease({
      parsedInput,
      state: "denied",
      reason: "routine_invalid",
      routineId,
      acquiredAtMs: null,
      policy,
    });
  }

  if (parsedInput.kill_switch_active || parsedInput.tick.kill_switch_active) {
    return lease({
      parsedInput,
      state: "denied",
      reason: "kill_switch_active",
      routineId,
      acquiredAtMs: null,
      policy,
    });
  }

  if (
    policy.deny_when_active_lease_exists &&
    parsedInput.active_lease_count >= policy.concurrency_cap
  ) {
    return lease({
      parsedInput,
      state: "denied",
      reason: "concurrency_cap_reached",
      routineId,
      acquiredAtMs: null,
      policy,
    });
  }

  if (policy.user_present_required && !parsedInput.user_present) {
    return lease({
      parsedInput,
      state: "denied",
      reason: "user_present_required",
      routineId,
      acquiredAtMs: null,
      policy,
    });
  }

  return lease({
    parsedInput,
    state: "acquired",
    reason: "lease_acquired",
    routineId,
    acquiredAtMs: parsedInput.tick.invoked_at_ms,
    policy,
  });
}

export function expireRoutineRunLease(
  leaseInput: RoutineRunLease,
  endedAtMs: number,
): RoutineRunLease {
  const parsedLease = RoutineRunLeaseSchema.parse(leaseInput);
  return RoutineRunLeaseSchema.parse({
    ...parsedLease,
    state: "expired",
    reason: "lease_expired",
    ended_at_ms: endedAtMs,
    timer_started: false,
    routine_executed: false,
  });
}

export function cancelRoutineRunLease(
  leaseInput: RoutineRunLease,
  endedAtMs: number,
): RoutineRunLease {
  const parsedLease = RoutineRunLeaseSchema.parse(leaseInput);
  return RoutineRunLeaseSchema.parse({
    ...parsedLease,
    state: "cancelled",
    reason: "lease_cancelled",
    ended_at_ms: endedAtMs,
    routine_executed: false,
    action_executed: false,
  });
}

export function createRoutineRunLeaseTelemetryEvent(
  leaseInput: RoutineRunLease,
): RoutineRunLeaseTelemetryEvent {
  const parsedLease = RoutineRunLeaseSchema.parse(leaseInput);
  return RoutineRunLeaseTelemetryEventSchema.parse({
    event_type: "routine_run_lease_evaluated",
    state: parsedLease.state,
    reason: parsedLease.reason,
    acquired_count: parsedLease.state === "acquired" ? 1 : 0,
    denied_count: parsedLease.state === "denied" ? 1 : 0,
    expired_count: parsedLease.state === "expired" ? 1 : 0,
    cancelled_count: parsedLease.state === "cancelled" ? 1 : 0,
    concurrency_cap: parsedLease.concurrency_cap,
    metadata_only: true,
    counts_and_flags_only: true,
    timer_started: false,
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
