import { z } from "zod";

import {
  DEFAULT_PHASE_17_DISABLED_GUARDS,
  Phase17DisabledGuardMatrixSchema,
} from "./phase-17-disabled-guards";
import {
  SCHEDULED_ASSISTANCE_ROUTINE_KINDS,
  ScheduledAssistanceRoutineKindSchema,
  ScheduledAssistanceScheduleKindSchema,
  type ScheduledAssistanceRoutineKind,
} from "./runtime-contract";

export const PHASE_17_ROUTINE_CLASSES = [
  "audit",
  "cost",
  "project",
  "calibration",
  "suggestion",
] as const;

export const PHASE_17_ROUTINE_OUTPUT_KINDS = [
  "report",
  "suggestion",
  "baseline_update",
] as const;

export const PHASE_17_ROUTINE_REGISTRY_VALIDATION_REASONS = [
  "valid_registry",
  "schema_invalid",
  "required_routine_missing",
  "disabled_guard_unsafe",
] as const;

export type Phase17RoutineClass = (typeof PHASE_17_ROUTINE_CLASSES)[number];
export type Phase17RoutineOutputKind =
  (typeof PHASE_17_ROUTINE_OUTPUT_KINDS)[number];
export type Phase17RoutineRegistryValidationReason =
  (typeof PHASE_17_ROUTINE_REGISTRY_VALIDATION_REASONS)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const Phase17RoutineClassSchema = z.enum(PHASE_17_ROUTINE_CLASSES);
export const Phase17RoutineOutputKindSchema = z.enum(
  PHASE_17_ROUTINE_OUTPUT_KINDS,
);
export const Phase17RoutineRegistryValidationReasonSchema = z.enum(
  PHASE_17_ROUTINE_REGISTRY_VALIDATION_REASONS,
);

export const Phase17RoutineEntrySchema = z.strictObject({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  routine_class: Phase17RoutineClassSchema,
  schedule_kind: ScheduledAssistanceScheduleKindSchema,
  enabled: z.literal(false),
  enabled_by_default: z.literal(false),
  requires_user_present: z.literal(true),
  side_effects_allowed: z.literal(false),
  output_kind: Phase17RoutineOutputKindSchema,
  execution_supported: z.literal(false),
  metadata_only: z.literal(true),
  foreground_only: z.literal(true),
  kill_switch_required: z.literal(true),
  scheduler_execution_supported: z.literal(false),
  background_headless_allowed: z.literal(false),
  tool_execution_allowed: z.literal(false),
  device_action_allowed: z.literal(false),
  project_mutation_allowed: z.literal(false),
  memory_write_allowed: z.literal(false),
  approval_execution_allowed: z.literal(false),
  cloud_network_allowed: z.literal(false),
});

export const Phase17RoutineRegistrySchema = z.strictObject({
  phase: z.literal(17),
  slice: z.literal("17A.3"),
  registry_id: z.literal("scheduled_assistance_routine_registry"),
  routines: z.array(Phase17RoutineEntrySchema),
  metadata_only: z.literal(true),
  foreground_only: z.literal(true),
  suggestion_only: z.literal(true),
  non_executing: z.literal(true),
  scheduler_registered: z.literal(false),
  timers_registered: z.literal(false),
  reports_generated: z.literal(false),
  suggestions_generated: z.literal(false),
  persisted: z.literal(false),
});

export const Phase17RoutineRegistryValidationSchema = z.strictObject({
  pass: z.boolean(),
  reason: Phase17RoutineRegistryValidationReasonSchema,
  routine_count: z.number().int().nonnegative(),
  required_routine_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  foreground_only: z.literal(true),
  suggestion_only: z.literal(true),
  non_executing: z.literal(true),
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

export type Phase17RoutineEntry = z.infer<typeof Phase17RoutineEntrySchema>;
export type Phase17RoutineRegistry = z.infer<
  typeof Phase17RoutineRegistrySchema
>;
export type Phase17RoutineRegistryValidation = z.infer<
  typeof Phase17RoutineRegistryValidationSchema
>;

function routine(input: {
  readonly routine_kind: ScheduledAssistanceRoutineKind;
  readonly routine_class: Phase17RoutineClass;
  readonly schedule_kind: Phase17RoutineEntry["schedule_kind"];
  readonly output_kind: Phase17RoutineOutputKind;
}): Phase17RoutineEntry {
  return Phase17RoutineEntrySchema.parse({
    routine_id: `routine:${input.routine_kind}`,
    routine_kind: input.routine_kind,
    routine_class: input.routine_class,
    schedule_kind: input.schedule_kind,
    enabled: false,
    enabled_by_default: false,
    requires_user_present: true,
    side_effects_allowed: false,
    output_kind: input.output_kind,
    execution_supported: false,
    metadata_only: true,
    foreground_only: true,
    kill_switch_required: true,
    scheduler_execution_supported: false,
    background_headless_allowed: false,
    tool_execution_allowed: false,
    device_action_allowed: false,
    project_mutation_allowed: false,
    memory_write_allowed: false,
    approval_execution_allowed: false,
    cloud_network_allowed: false,
  });
}

export const DEFAULT_PHASE_17_ROUTINE_REGISTRY =
  Phase17RoutineRegistrySchema.parse({
    phase: 17,
    slice: "17A.3",
    registry_id: "scheduled_assistance_routine_registry",
    routines: [
      routine({
        routine_kind: "daily_self_audit",
        routine_class: "audit",
        schedule_kind: "daily",
        output_kind: "report",
      }),
      routine({
        routine_kind: "cost_report",
        routine_class: "cost",
        schedule_kind: "weekly",
        output_kind: "report",
      }),
      routine({
        routine_kind: "project_progress",
        routine_class: "project",
        schedule_kind: "weekly",
        output_kind: "report",
      }),
      routine({
        routine_kind: "calibration_diff",
        routine_class: "calibration",
        schedule_kind: "on_demand",
        output_kind: "baseline_update",
      }),
      routine({
        routine_kind: "next_action_suggest",
        routine_class: "suggestion",
        schedule_kind: "on_demand",
        output_kind: "suggestion",
      }),
    ],
    metadata_only: true,
    foreground_only: true,
    suggestion_only: true,
    non_executing: true,
    scheduler_registered: false,
    timers_registered: false,
    reports_generated: false,
    suggestions_generated: false,
    persisted: false,
  });

export function validatePhase17RoutineRegistry(
  input: unknown = DEFAULT_PHASE_17_ROUTINE_REGISTRY,
  disabledGuards: unknown = DEFAULT_PHASE_17_DISABLED_GUARDS,
): Phase17RoutineRegistryValidation {
  const parsed = Phase17RoutineRegistrySchema.safeParse(input);
  const parsedGuards =
    Phase17DisabledGuardMatrixSchema.safeParse(disabledGuards);

  if (!parsed.success) {
    return validationResult({
      pass: false,
      reason: "schema_invalid",
      routineCount: 0,
    });
  }

  if (!parsedGuards.success) {
    return validationResult({
      pass: false,
      reason: "disabled_guard_unsafe",
      routineCount: parsed.data.routines.length,
    });
  }

  const routineKinds = new Set(
    parsed.data.routines.map((routineItem) => routineItem.routine_kind),
  );
  const requiredPresent = SCHEDULED_ASSISTANCE_ROUTINE_KINDS.every(
    (routineKind) => routineKinds.has(routineKind),
  );

  return validationResult({
    pass: requiredPresent,
    reason: requiredPresent ? "valid_registry" : "required_routine_missing",
    routineCount: parsed.data.routines.length,
  });
}

function validationResult(input: {
  readonly pass: boolean;
  readonly reason: Phase17RoutineRegistryValidationReason;
  readonly routineCount: number;
}): Phase17RoutineRegistryValidation {
  return Phase17RoutineRegistryValidationSchema.parse({
    pass: input.pass,
    reason: input.reason,
    routine_count: input.routineCount,
    required_routine_count: SCHEDULED_ASSISTANCE_ROUTINE_KINDS.length,
    metadata_only: true,
    foreground_only: true,
    suggestion_only: true,
    non_executing: true,
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
