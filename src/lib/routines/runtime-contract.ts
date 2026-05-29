import { z } from "zod";

export const SCHEDULED_ASSISTANCE_ROUTINE_KINDS = [
  "daily_self_audit",
  "cost_report",
  "project_progress",
  "calibration_diff",
  "next_action_suggest",
] as const;

export const SCHEDULED_ASSISTANCE_SCHEDULE_KINDS = [
  "manual",
  "daily",
  "weekly",
  "on_demand",
] as const;

export const SCHEDULED_ASSISTANCE_OUTPUT_KINDS = [
  "metadata_report",
  "metadata_summary",
  "metadata_diff",
  "metadata_suggestion",
] as const;

export const SCHEDULED_ASSISTANCE_EXECUTION_MODES = [
  "contract_only",
  "scheduler_disabled",
] as const;

export type ScheduledAssistanceRoutineKind =
  (typeof SCHEDULED_ASSISTANCE_ROUTINE_KINDS)[number];
export type ScheduledAssistanceScheduleKind =
  (typeof SCHEDULED_ASSISTANCE_SCHEDULE_KINDS)[number];
export type ScheduledAssistanceOutputKind =
  (typeof SCHEDULED_ASSISTANCE_OUTPUT_KINDS)[number];
export type ScheduledAssistanceExecutionMode =
  (typeof SCHEDULED_ASSISTANCE_EXECUTION_MODES)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const ScheduledAssistanceRoutineKindSchema = z.enum(
  SCHEDULED_ASSISTANCE_ROUTINE_KINDS,
);
export const ScheduledAssistanceScheduleKindSchema = z.enum(
  SCHEDULED_ASSISTANCE_SCHEDULE_KINDS,
);
export const ScheduledAssistanceOutputKindSchema = z.enum(
  SCHEDULED_ASSISTANCE_OUTPUT_KINDS,
);
export const ScheduledAssistanceExecutionModeSchema = z.enum(
  SCHEDULED_ASSISTANCE_EXECUTION_MODES,
);

export const ScheduledAssistanceRoutineMetadataSchema = z.strictObject({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  schedule_kind: ScheduledAssistanceScheduleKindSchema,
  enabled: z.literal(false),
  user_present_required: z.literal(true),
  side_effects_allowed: z.literal(false),
  output_kind: ScheduledAssistanceOutputKindSchema,
  execution_mode: ScheduledAssistanceExecutionModeSchema,
  kill_switch_required: z.literal(true),
  metadata_only: z.literal(true),
});

export const ScheduledAssistanceRuntimeContractSchema = z.strictObject({
  phase: z.literal(17),
  slice: z.literal("17A.1"),
  runtime_id: z.literal("scheduled_assistance_runtime"),
  routines: z.array(ScheduledAssistanceRoutineMetadataSchema),
  execution_supported: z.literal(false),
  scheduler_active: z.literal(false),
  scheduler_running: z.literal(false),
  side_effects_supported: z.literal(false),
  network_allowed: z.literal(false),
  cloud_allowed: z.literal(false),
  tool_execution_allowed: z.literal(false),
  memory_write_allowed: z.literal(false),
  device_action_allowed: z.literal(false),
  project_mutation_allowed: z.literal(false),
  approval_execution_allowed: z.literal(false),
  report_generation_supported: z.literal(false),
  suggestion_generation_supported: z.literal(false),
  persistence_supported: z.literal(false),
  timers_registered: z.literal(false),
  metadata_only: z.literal(true),
});

export type ScheduledAssistanceRoutineMetadata = z.infer<
  typeof ScheduledAssistanceRoutineMetadataSchema
>;
export type ScheduledAssistanceRuntimeContract = z.infer<
  typeof ScheduledAssistanceRuntimeContractSchema
>;

function routine(input: {
  readonly routine_kind: ScheduledAssistanceRoutineKind;
  readonly schedule_kind: ScheduledAssistanceScheduleKind;
  readonly output_kind: ScheduledAssistanceOutputKind;
}): ScheduledAssistanceRoutineMetadata {
  return ScheduledAssistanceRoutineMetadataSchema.parse({
    routine_id: `routine:${input.routine_kind}`,
    routine_kind: input.routine_kind,
    schedule_kind: input.schedule_kind,
    enabled: false,
    user_present_required: true,
    side_effects_allowed: false,
    output_kind: input.output_kind,
    execution_mode: "contract_only",
    kill_switch_required: true,
    metadata_only: true,
  });
}

export const DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT =
  ScheduledAssistanceRuntimeContractSchema.parse({
    phase: 17,
    slice: "17A.1",
    runtime_id: "scheduled_assistance_runtime",
    routines: [
      routine({
        routine_kind: "daily_self_audit",
        schedule_kind: "daily",
        output_kind: "metadata_report",
      }),
      routine({
        routine_kind: "cost_report",
        schedule_kind: "weekly",
        output_kind: "metadata_report",
      }),
      routine({
        routine_kind: "project_progress",
        schedule_kind: "weekly",
        output_kind: "metadata_summary",
      }),
      routine({
        routine_kind: "calibration_diff",
        schedule_kind: "on_demand",
        output_kind: "metadata_diff",
      }),
      routine({
        routine_kind: "next_action_suggest",
        schedule_kind: "on_demand",
        output_kind: "metadata_suggestion",
      }),
    ],
    execution_supported: false,
    scheduler_active: false,
    scheduler_running: false,
    side_effects_supported: false,
    network_allowed: false,
    cloud_allowed: false,
    tool_execution_allowed: false,
    memory_write_allowed: false,
    device_action_allowed: false,
    project_mutation_allowed: false,
    approval_execution_allowed: false,
    report_generation_supported: false,
    suggestion_generation_supported: false,
    persistence_supported: false,
    timers_registered: false,
    metadata_only: true,
  });

export function getScheduledAssistanceRuntimeContract(): ScheduledAssistanceRuntimeContract {
  return DEFAULT_SCHEDULED_ASSISTANCE_RUNTIME_CONTRACT;
}
