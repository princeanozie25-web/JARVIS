import { z } from "zod";

import {
  DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  Phase17RoutineEntrySchema,
  Phase17RoutineRegistrySchema,
  validatePhase17RoutineRegistry,
} from "./routine-registry";
import {
  DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT,
  ScheduledAssistanceRuntimeContractSchema,
} from "./runtime-contract";
import {
  ScheduledAssistanceTickInputSourceKindSchema,
  type ScheduledAssistanceTickInputSourceKind,
} from "./scheduled-assistance-tick-source";
import {
  RoutineEligibilityDecisionSchema,
  RoutineEligibilityReasonSchema,
  RoutineEligibilityUserPresentStateSchema,
  type RoutineEligibilityDecision,
  evaluateRoutineEligibility,
} from "./routine-eligibility";
import {
  ForegroundSchedulerOutputEnvelopeSchema,
  buildForegroundSchedulerOutputEnvelope,
} from "./scheduler-output-envelope";
import {
  ForegroundSchedulerAuditPreviewSchema,
  buildForegroundSchedulerAuditPreview,
} from "./scheduler-audit-preview";

export const FOREGROUND_SCHEDULER_KILL_SWITCH_STATES = [
  "safe",
  "active",
  "missing",
  "unsafe",
] as const;

export const FOREGROUND_SCHEDULER_DECISION_REASONS = [
  "scheduler_execution_not_implemented",
  "background_headless_tick_rejected",
  "catch_up_not_supported",
  "kill_switch_active",
  "kill_switch_missing",
  "kill_switch_unsafe",
  "unsafe_routine_registry",
  "unsafe_runtime_contract",
] as const;

export const FOREGROUND_SCHEDULER_SKIPPED_ROUTINE_REASONS = [
  "routine_disabled",
  "routine_execution_not_supported",
] as const;

export type ForegroundSchedulerKillSwitchState =
  (typeof FOREGROUND_SCHEDULER_KILL_SWITCH_STATES)[number];
export type ForegroundSchedulerDecisionReason =
  (typeof FOREGROUND_SCHEDULER_DECISION_REASONS)[number];
export type ForegroundSchedulerSkippedRoutineReason =
  (typeof FOREGROUND_SCHEDULER_SKIPPED_ROUTINE_REASONS)[number];

const TickIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^tick:[a-z0-9._:-]+$/);

export const ForegroundSchedulerKillSwitchStateSchema = z.enum(
  FOREGROUND_SCHEDULER_KILL_SWITCH_STATES,
);
export const ForegroundSchedulerDecisionReasonSchema = z.enum(
  FOREGROUND_SCHEDULER_DECISION_REASONS,
);
export const ForegroundSchedulerSkippedRoutineReasonSchema = z.enum(
  FOREGROUND_SCHEDULER_SKIPPED_ROUTINE_REASONS,
);

export const ForegroundSchedulerTickInputSchema = z.strictObject({
  tick_id: TickIdSchema,
  tick_source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  requested_at_ms: z.number().int().nonnegative().default(0),
  catch_up_requested: z.boolean().default(false),
  kill_switch_state:
    ForegroundSchedulerKillSwitchStateSchema.default("missing"),
  user_present_state:
    RoutineEligibilityUserPresentStateSchema.default("not_checked"),
});

export const ForegroundSchedulerEligibleRoutineSchema = z.strictObject({
  routine_id: z.string().trim().min(1).max(120),
  routine_kind: Phase17RoutineEntrySchema.shape.routine_kind,
  schedule_kind: Phase17RoutineEntrySchema.shape.schedule_kind,
  metadata_only: z.literal(true),
  routine_execution_allowed: z.literal(false),
});

export const ForegroundSchedulerSkippedRoutineSchema = z.strictObject({
  routine_id: z.string().trim().min(1).max(120),
  routine_kind: Phase17RoutineEntrySchema.shape.routine_kind,
  reason: RoutineEligibilityReasonSchema,
  metadata_only: z.literal(true),
  routine_execution_allowed: z.literal(false),
});

export const ForegroundSchedulerTickDecisionSchema = z.strictObject({
  tick_id: TickIdSchema,
  tick_source_kind: ScheduledAssistanceTickInputSourceKindSchema,
  decision: z.literal("denied"),
  reason: ForegroundSchedulerDecisionReasonSchema,
  foreground_only: z.literal(true),
  background_allowed: z.literal(false),
  scheduler_execution_supported: z.literal(false),
  scheduler_execution_allowed: z.literal(false),
  routine_execution_supported: z.literal(false),
  routine_execution_allowed: z.literal(false),
  side_effects_allowed: z.literal(false),
  routine_eligibility: z.array(RoutineEligibilityDecisionSchema),
  output_envelopes: z.array(ForegroundSchedulerOutputEnvelopeSchema),
  audit_preview: ForegroundSchedulerAuditPreviewSchema,
  eligible_routines: z.array(ForegroundSchedulerEligibleRoutineSchema),
  skipped_routines: z.array(ForegroundSchedulerSkippedRoutineSchema),
  kill_switch_required: z.literal(true),
  kill_switch_state: ForegroundSchedulerKillSwitchStateSchema,
  execution_attempted: z.literal(false),
  persistence_attempted: z.literal(false),
  metadata_only: z.literal(true),
  catch_up_supported: z.literal(false),
  catch_up_attempted: z.literal(false),
  missed_tick_policy: z.literal("skip"),
  timer_started: z.literal(false),
  scheduler_started: z.literal(false),
  routine_executed: z.literal(false),
  collector_ran: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  persisted: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
});

export type ForegroundSchedulerTickInput = z.input<
  typeof ForegroundSchedulerTickInputSchema
>;
export type ForegroundSchedulerEligibleRoutine = z.infer<
  typeof ForegroundSchedulerEligibleRoutineSchema
>;
export type ForegroundSchedulerSkippedRoutine = z.infer<
  typeof ForegroundSchedulerSkippedRoutineSchema
>;
export type ForegroundSchedulerTickDecision = z.infer<
  typeof ForegroundSchedulerTickDecisionSchema
>;

export function evaluateForegroundSchedulerTick(
  tick: ForegroundSchedulerTickInput,
  routineRegistry: unknown = DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  runtimeContract: unknown = DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT,
): ForegroundSchedulerTickDecision {
  const parsedTick = ForegroundSchedulerTickInputSchema.parse(tick);
  const parsedRegistry =
    Phase17RoutineRegistrySchema.safeParse(routineRegistry);
  const parsedRuntime =
    ScheduledAssistanceRuntimeContractSchema.safeParse(runtimeContract);
  const registryValidation = validatePhase17RoutineRegistry(routineRegistry);

  const routineEligibility =
    parsedRegistry.success && registryValidation.pass
      ? parsedRegistry.data.routines.map((routine) =>
          evaluateRoutineEligibility(
            routine,
            {
              tick_id: parsedTick.tick_id,
              tick_source_kind: parsedTick.tick_source_kind,
            },
            runtimeContract,
            {
              kill_switch_state: parsedTick.kill_switch_state,
              user_present_state: parsedTick.user_present_state,
            },
          ),
        )
      : [];
  const eligibleRoutines = routineEligibility
    .filter((routine) => routine.eligible)
    .map((routine) =>
      ForegroundSchedulerEligibleRoutineSchema.parse({
        routine_id: routine.routine_id,
        routine_kind: routine.routine_kind,
        schedule_kind: routine.schedule_kind,
        metadata_only: true,
        routine_execution_allowed: false,
      }),
    );
  const skippedRoutines = routineEligibility
    .filter((routine) => !routine.eligible)
    .map(toSkippedRoutine);
  const outputEnvelopes =
    parsedRegistry.success && registryValidation.pass
      ? parsedRegistry.data.routines.map((routine) => {
          const eligibility = routineEligibility.find(
            (candidate) => candidate.routine_id === routine.routine_id,
          );
          return buildForegroundSchedulerOutputEnvelope({
            tick_id: parsedTick.tick_id,
            routine,
            eligible: eligibility?.eligible ?? false,
          });
        })
      : [];
  const auditPreview = buildForegroundSchedulerAuditPreview({
    tick_id: parsedTick.tick_id,
    source_kind: parsedTick.tick_source_kind,
    eligible_count: eligibleRoutines.length,
    skipped_count: skippedRoutines.length,
    output_envelope_count: outputEnvelopes.length,
  });

  return ForegroundSchedulerTickDecisionSchema.parse({
    tick_id: parsedTick.tick_id,
    tick_source_kind: parsedTick.tick_source_kind,
    decision: "denied",
    reason: reasonForDecision({
      tick_source_kind: parsedTick.tick_source_kind,
      catch_up_requested: parsedTick.catch_up_requested,
      kill_switch_state: parsedTick.kill_switch_state,
      registry_safe: registryValidation.pass,
      runtime_safe: parsedRuntime.success,
    }),
    foreground_only: true,
    background_allowed: false,
    scheduler_execution_supported: false,
    scheduler_execution_allowed: false,
    routine_execution_supported: false,
    routine_execution_allowed: false,
    side_effects_allowed: false,
    routine_eligibility: routineEligibility,
    output_envelopes: outputEnvelopes,
    audit_preview: auditPreview,
    eligible_routines: eligibleRoutines,
    skipped_routines: skippedRoutines,
    kill_switch_required: true,
    kill_switch_state: parsedTick.kill_switch_state,
    execution_attempted: false,
    persistence_attempted: false,
    metadata_only: true,
    catch_up_supported: false,
    catch_up_attempted: false,
    missed_tick_policy: "skip",
    timer_started: false,
    scheduler_started: false,
    routine_executed: false,
    collector_ran: false,
    report_generated: false,
    suggestion_generated: false,
    db_read_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
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

function toSkippedRoutine(
  routine: RoutineEligibilityDecision,
): ForegroundSchedulerSkippedRoutine {
  return ForegroundSchedulerSkippedRoutineSchema.parse({
    routine_id: routine.routine_id,
    routine_kind: routine.routine_kind,
    reason: routine.reason,
    metadata_only: true,
    routine_execution_allowed: false,
  });
}

function reasonForDecision(input: {
  readonly tick_source_kind: ScheduledAssistanceTickInputSourceKind;
  readonly catch_up_requested: boolean;
  readonly kill_switch_state: ForegroundSchedulerKillSwitchState;
  readonly registry_safe: boolean;
  readonly runtime_safe: boolean;
}): ForegroundSchedulerDecisionReason {
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
  if (!input.registry_safe) {
    return "unsafe_routine_registry";
  }
  if (!input.runtime_safe) {
    return "unsafe_runtime_contract";
  }

  switch (input.kill_switch_state) {
    case "active":
      return "kill_switch_active";
    case "missing":
      return "kill_switch_missing";
    case "unsafe":
      return "kill_switch_unsafe";
    case "safe":
      return "scheduler_execution_not_implemented";
  }
}
