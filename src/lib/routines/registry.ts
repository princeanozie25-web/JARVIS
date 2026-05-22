import { z } from "zod";

export const ROUTINE_CAPABILITIES = [
  "self_audit",
  "cost_report",
  "project_progress",
  "next_action_suggest",
  "calibration_diff",
  "mistake_review",
] as const;

export const ROUTINE_TRUST_CLASSES = [
  "observe",
  "summarize",
  "suggest",
  "calibrate",
  "actuate_reserved",
] as const;

export const ROUTINE_SCHEDULE_POLICY_KINDS = [
  "manual",
  "daily",
  "interval",
] as const;

export const ROUTINE_OUTPUT_MODES = [
  "report",
  "suggestion",
  "calibration",
] as const;

export const ROUTINE_DISABLED_FEATURES = [
  "scheduler_runtime",
  "timers",
  "background_jobs",
  "tool_calls",
  "runtime_actions",
  "approval_granting",
  "memory_writes",
  "project_mutations",
  "environment_mutations",
  "runtime_mutations",
  "cloud_network_calls",
  "ui",
  "voice_scheduling",
] as const;

export const ROUTINE_REGISTRY_VALIDATION_REASONS = [
  "valid_registry",
  "side_effects_not_none",
  "actuation_reserved",
  "tool_calls_forbidden",
  "memory_writes_forbidden",
  "approvals_forbidden",
  "mutations_forbidden",
  "cloud_network_forbidden",
  "background_or_autonomous_forbidden",
  "actions_forbidden",
  "disabled_feature_enabled",
  "kill_switch_not_safe",
] as const;

export const ROUTINE_TELEMETRY_EVENT_TYPES = [
  "routine_registry_validated",
] as const;

export type RoutineCapability = (typeof ROUTINE_CAPABILITIES)[number];
export type RoutineTrustClass = (typeof ROUTINE_TRUST_CLASSES)[number];
export type RoutineSchedulePolicyKind =
  (typeof ROUTINE_SCHEDULE_POLICY_KINDS)[number];
export type RoutineOutputMode = (typeof ROUTINE_OUTPUT_MODES)[number];
export type RoutineDisabledFeature = (typeof ROUTINE_DISABLED_FEATURES)[number];
export type RoutineRegistryValidationReason =
  (typeof ROUTINE_REGISTRY_VALIDATION_REASONS)[number];
export type RoutineTelemetryEventType =
  (typeof ROUTINE_TELEMETRY_EVENT_TYPES)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const RoutineCapabilitySchema = z.enum(ROUTINE_CAPABILITIES);
export const RoutineTrustClassSchema = z.enum(ROUTINE_TRUST_CLASSES);
export const RoutineSchedulePolicyKindSchema = z.enum(
  ROUTINE_SCHEDULE_POLICY_KINDS,
);
export const RoutineOutputModeSchema = z.enum(ROUTINE_OUTPUT_MODES);
export const RoutineDisabledFeatureSchema = z.enum(ROUTINE_DISABLED_FEATURES);
export const RoutineRegistryValidationReasonSchema = z.enum(
  ROUTINE_REGISTRY_VALIDATION_REASONS,
);
export const RoutineTelemetryEventTypeSchema = z.enum(
  ROUTINE_TELEMETRY_EVENT_TYPES,
);

export const RoutineSchedulePolicySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("manual"),
    scheduler_enabled: z.literal(false),
  }),
  z.strictObject({
    kind: z.literal("daily"),
    local_time: z.string().regex(/^\d{2}:\d{2}$/),
    scheduler_enabled: z.literal(false),
  }),
  z.strictObject({
    kind: z.literal("interval"),
    interval_minutes: z.number().int().positive(),
    scheduler_enabled: z.literal(false),
  }),
]);

export const RoutineSchema = z.strictObject({
  id: RoutineIdSchema,
  capability: RoutineCapabilitySchema,
  display_name: z.string().trim().min(1).max(160),
  trust_class: RoutineTrustClassSchema,
  output_mode: RoutineOutputModeSchema,
  schedule_policy: RoutineSchedulePolicySchema,
  enabled: z.boolean(),
  side_effects: z.enum(["none", "read", "write", "actuate"]),
  can_call_tools: z.boolean(),
  can_write_memory: z.boolean(),
  can_trigger_approvals: z.boolean(),
  can_mutate_projects: z.boolean(),
  can_mutate_environment: z.boolean(),
  can_mutate_runtime: z.boolean(),
  can_use_cloud_network: z.boolean(),
  can_run_background: z.boolean(),
  can_execute_actions: z.boolean(),
  autonomous: z.boolean(),
  scheduler_registered: z.boolean(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  actuation_allowed: z.boolean(),
});

export const RoutineFeatureFlagsSchema = z.object(
  Object.fromEntries(
    ROUTINE_DISABLED_FEATURES.map((feature) => [feature, z.boolean()]),
  ) as Record<RoutineDisabledFeature, z.ZodBoolean>,
);

export const DEFAULT_ROUTINE_FEATURE_FLAGS = Object.fromEntries(
  ROUTINE_DISABLED_FEATURES.map((feature) => [feature, false]),
) as z.infer<typeof RoutineFeatureFlagsSchema>;

export const RoutineKillSwitchConfigSchema = z.strictObject({
  global_routines_enabled: z.boolean(),
  scheduler_enabled: z.boolean(),
  autonomous_execution_enabled: z.boolean(),
  tool_calls_enabled: z.boolean(),
  memory_writes_enabled: z.boolean(),
  approvals_enabled: z.boolean(),
  runtime_actions_enabled: z.boolean(),
  project_mutations_enabled: z.boolean(),
  environment_mutations_enabled: z.boolean(),
  runtime_mutations_enabled: z.boolean(),
  cloud_network_enabled: z.boolean(),
  metadata_only: z.literal(true),
});

export const DEFAULT_ROUTINE_KILL_SWITCH_CONFIG =
  RoutineKillSwitchConfigSchema.parse({
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
  });

export const RoutineRegistrySchema = z.strictObject({
  version: z.literal("phase_8a1"),
  routines: z.array(RoutineSchema),
  feature_flags: RoutineFeatureFlagsSchema,
  kill_switch: RoutineKillSwitchConfigSchema,
  metadata_only: z.literal(true),
  scheduler_runtime_registered: z.literal(false),
  background_jobs_registered: z.literal(false),
  runtime_tools_registered: z.literal(false),
  actions_registered: z.literal(false),
  approvals_registered: z.literal(false),
});

export const RoutineRegistryValidationSchema = z.strictObject({
  kind: z.literal("routine.registry_validation"),
  pass: z.boolean(),
  routine_count: z.number().int().nonnegative(),
  enabled_routine_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(RoutineRegistryValidationReasonSchema),
  metadata_only: z.literal(true),
  scheduler_started: z.literal(false),
  background_job_started: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineRegistryTelemetryEventSchema = z.strictObject({
  event_type: RoutineTelemetryEventTypeSchema,
  pass: z.boolean(),
  routine_count: z.number().int().nonnegative(),
  enabled_routine_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  disabled_feature_count: z.number().int().nonnegative(),
  kill_switch_safe: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_started: z.literal(false),
  background_job_started: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
});

export type RoutineSchedulePolicy = z.infer<typeof RoutineSchedulePolicySchema>;
export type Routine = z.infer<typeof RoutineSchema>;
export type RoutineFeatureFlags = z.infer<typeof RoutineFeatureFlagsSchema>;
export type RoutineKillSwitchConfig = z.infer<
  typeof RoutineKillSwitchConfigSchema
>;
export type RoutineRegistry = z.infer<typeof RoutineRegistrySchema>;
export type RoutineRegistryValidation = z.infer<
  typeof RoutineRegistryValidationSchema
>;
export type RoutineRegistryTelemetryEvent = z.infer<
  typeof RoutineRegistryTelemetryEventSchema
>;

function routine(input: Omit<Routine, "enabled">): Routine {
  return RoutineSchema.parse({ ...input, enabled: false });
}

export const DEFAULT_ROUTINE_REGISTRY = RoutineRegistrySchema.parse({
  version: "phase_8a1",
  routines: [
    routine({
      id: "routine:self_audit",
      capability: "self_audit",
      display_name: "Daily self-audit",
      trust_class: "summarize",
      output_mode: "report",
      schedule_policy: { kind: "manual", scheduler_enabled: false },
      side_effects: "none",
      can_call_tools: false,
      can_write_memory: false,
      can_trigger_approvals: false,
      can_mutate_projects: false,
      can_mutate_environment: false,
      can_mutate_runtime: false,
      can_use_cloud_network: false,
      can_run_background: false,
      can_execute_actions: false,
      autonomous: false,
      scheduler_registered: false,
      metadata_only: true,
      advisory_only: true,
      actuation_allowed: false,
    }),
    routine({
      id: "routine:cost_report",
      capability: "cost_report",
      display_name: "Cost report",
      trust_class: "summarize",
      output_mode: "report",
      schedule_policy: { kind: "manual", scheduler_enabled: false },
      side_effects: "none",
      can_call_tools: false,
      can_write_memory: false,
      can_trigger_approvals: false,
      can_mutate_projects: false,
      can_mutate_environment: false,
      can_mutate_runtime: false,
      can_use_cloud_network: false,
      can_run_background: false,
      can_execute_actions: false,
      autonomous: false,
      scheduler_registered: false,
      metadata_only: true,
      advisory_only: true,
      actuation_allowed: false,
    }),
    routine({
      id: "routine:project_progress",
      capability: "project_progress",
      display_name: "Project progress summary",
      trust_class: "summarize",
      output_mode: "report",
      schedule_policy: { kind: "manual", scheduler_enabled: false },
      side_effects: "none",
      can_call_tools: false,
      can_write_memory: false,
      can_trigger_approvals: false,
      can_mutate_projects: false,
      can_mutate_environment: false,
      can_mutate_runtime: false,
      can_use_cloud_network: false,
      can_run_background: false,
      can_execute_actions: false,
      autonomous: false,
      scheduler_registered: false,
      metadata_only: true,
      advisory_only: true,
      actuation_allowed: false,
    }),
    routine({
      id: "routine:next_action_suggest",
      capability: "next_action_suggest",
      display_name: "Next action suggestion",
      trust_class: "suggest",
      output_mode: "suggestion",
      schedule_policy: { kind: "manual", scheduler_enabled: false },
      side_effects: "none",
      can_call_tools: false,
      can_write_memory: false,
      can_trigger_approvals: false,
      can_mutate_projects: false,
      can_mutate_environment: false,
      can_mutate_runtime: false,
      can_use_cloud_network: false,
      can_run_background: false,
      can_execute_actions: false,
      autonomous: false,
      scheduler_registered: false,
      metadata_only: true,
      advisory_only: true,
      actuation_allowed: false,
    }),
    routine({
      id: "routine:calibration_diff",
      capability: "calibration_diff",
      display_name: "Calibration diff",
      trust_class: "calibrate",
      output_mode: "calibration",
      schedule_policy: { kind: "manual", scheduler_enabled: false },
      side_effects: "none",
      can_call_tools: false,
      can_write_memory: false,
      can_trigger_approvals: false,
      can_mutate_projects: false,
      can_mutate_environment: false,
      can_mutate_runtime: false,
      can_use_cloud_network: false,
      can_run_background: false,
      can_execute_actions: false,
      autonomous: false,
      scheduler_registered: false,
      metadata_only: true,
      advisory_only: true,
      actuation_allowed: false,
    }),
    routine({
      id: "routine:mistake_review",
      capability: "mistake_review",
      display_name: "Mistake review",
      trust_class: "observe",
      output_mode: "report",
      schedule_policy: { kind: "manual", scheduler_enabled: false },
      side_effects: "none",
      can_call_tools: false,
      can_write_memory: false,
      can_trigger_approvals: false,
      can_mutate_projects: false,
      can_mutate_environment: false,
      can_mutate_runtime: false,
      can_use_cloud_network: false,
      can_run_background: false,
      can_execute_actions: false,
      autonomous: false,
      scheduler_registered: false,
      metadata_only: true,
      advisory_only: true,
      actuation_allowed: false,
    }),
  ],
  feature_flags: DEFAULT_ROUTINE_FEATURE_FLAGS,
  kill_switch: DEFAULT_ROUTINE_KILL_SWITCH_CONFIG,
  metadata_only: true,
  scheduler_runtime_registered: false,
  background_jobs_registered: false,
  runtime_tools_registered: false,
  actions_registered: false,
  approvals_registered: false,
});

function addViolation(
  violations: Set<RoutineRegistryValidationReason>,
  reason: RoutineRegistryValidationReason,
): void {
  violations.add(reason);
}

function killSwitchIsSafe(killSwitch: RoutineKillSwitchConfig): boolean {
  return (
    killSwitch.global_routines_enabled === false &&
    killSwitch.scheduler_enabled === false &&
    killSwitch.autonomous_execution_enabled === false &&
    killSwitch.tool_calls_enabled === false &&
    killSwitch.memory_writes_enabled === false &&
    killSwitch.approvals_enabled === false &&
    killSwitch.runtime_actions_enabled === false &&
    killSwitch.project_mutations_enabled === false &&
    killSwitch.environment_mutations_enabled === false &&
    killSwitch.runtime_mutations_enabled === false &&
    killSwitch.cloud_network_enabled === false
  );
}

export function validateRoutineRegistry(
  input: RoutineRegistry = DEFAULT_ROUTINE_REGISTRY,
): RoutineRegistryValidation {
  const parsed = RoutineRegistrySchema.safeParse(input);
  const violations = new Set<RoutineRegistryValidationReason>();

  if (!parsed.success) {
    return RoutineRegistryValidationSchema.parse({
      kind: "routine.registry_validation",
      pass: false,
      routine_count: 0,
      enabled_routine_count: 0,
      violation_count: 1,
      violations: ["side_effects_not_none"],
      metadata_only: true,
      scheduler_started: false,
      background_job_started: false,
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

  const registry = parsed.data;
  for (const routineItem of registry.routines) {
    if (routineItem.side_effects !== "none") {
      addViolation(violations, "side_effects_not_none");
    }
    if (
      routineItem.trust_class === "actuate_reserved" ||
      routineItem.actuation_allowed
    ) {
      addViolation(violations, "actuation_reserved");
    }
    if (routineItem.can_call_tools) {
      addViolation(violations, "tool_calls_forbidden");
    }
    if (routineItem.can_write_memory) {
      addViolation(violations, "memory_writes_forbidden");
    }
    if (routineItem.can_trigger_approvals) {
      addViolation(violations, "approvals_forbidden");
    }
    if (
      routineItem.can_mutate_projects ||
      routineItem.can_mutate_environment ||
      routineItem.can_mutate_runtime
    ) {
      addViolation(violations, "mutations_forbidden");
    }
    if (routineItem.can_use_cloud_network) {
      addViolation(violations, "cloud_network_forbidden");
    }
    if (
      routineItem.can_run_background ||
      routineItem.autonomous ||
      routineItem.scheduler_registered ||
      routineItem.schedule_policy.scheduler_enabled
    ) {
      addViolation(violations, "background_or_autonomous_forbidden");
    }
    if (routineItem.can_execute_actions) {
      addViolation(violations, "actions_forbidden");
    }
  }

  for (const feature of ROUTINE_DISABLED_FEATURES) {
    if (registry.feature_flags[feature]) {
      addViolation(violations, "disabled_feature_enabled");
    }
  }
  if (
    !killSwitchIsSafe(registry.kill_switch) ||
    registry.scheduler_runtime_registered ||
    registry.background_jobs_registered ||
    registry.runtime_tools_registered ||
    registry.actions_registered ||
    registry.approvals_registered
  ) {
    addViolation(violations, "kill_switch_not_safe");
  }

  return RoutineRegistryValidationSchema.parse({
    kind: "routine.registry_validation",
    pass: violations.size === 0,
    routine_count: registry.routines.length,
    enabled_routine_count: registry.routines.filter((item) => item.enabled)
      .length,
    violation_count: violations.size,
    violations: [...violations],
    metadata_only: true,
    scheduler_started: false,
    background_job_started: false,
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

export function createRoutineRegistryTelemetryEvent(
  validationInput: RoutineRegistryValidation,
): RoutineRegistryTelemetryEvent {
  const validation = RoutineRegistryValidationSchema.parse(validationInput);
  return RoutineRegistryTelemetryEventSchema.parse({
    event_type: "routine_registry_validated",
    pass: validation.pass,
    routine_count: validation.routine_count,
    enabled_routine_count: validation.enabled_routine_count,
    violation_count: validation.violation_count,
    disabled_feature_count: ROUTINE_DISABLED_FEATURES.length,
    kill_switch_safe: validation.violations.includes("kill_switch_not_safe")
      ? false
      : true,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_started: false,
    background_job_started: false,
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
