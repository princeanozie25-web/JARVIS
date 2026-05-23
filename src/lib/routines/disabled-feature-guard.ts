import { z } from "zod";

export const ROUTINE_CLOSEOUT_DISABLED_FEATURES = [
  "actuate_routines",
  "routines_call_tools",
  "routines_write_memory",
  "routines_trigger_device_actions",
  "routines_initiate_cloud_calls",
  "background_execution_user_absent",
  "missed_schedule_catchup",
  "voice_schedule_changes",
  "auto_threshold_tuning",
  "auto_budget_tuning",
  "auto_policy_tuning",
  "auto_router_tuning",
  "auto_approval",
  "routine_chaining",
  "multi_process_scheduling",
  "remote_network_triggered_routines",
  "llm_extraction_in_collectors",
  "routine_self_modification",
  "raw_report_telemetry",
  "public_remote_schedule_control",
] as const;

export const ROUTINE_DISABLED_FEATURE_GUARD_TELEMETRY_EVENT_TYPES = [
  "routine_disabled_feature_guard_validated",
] as const;

export type RoutineCloseoutDisabledFeature =
  (typeof ROUTINE_CLOSEOUT_DISABLED_FEATURES)[number];
export type RoutineDisabledFeatureGuardTelemetryEventType =
  (typeof ROUTINE_DISABLED_FEATURE_GUARD_TELEMETRY_EVENT_TYPES)[number];

export const RoutineCloseoutDisabledFeatureSchema = z.enum(
  ROUTINE_CLOSEOUT_DISABLED_FEATURES,
);
export const RoutineDisabledFeatureGuardTelemetryEventTypeSchema = z.enum(
  ROUTINE_DISABLED_FEATURE_GUARD_TELEMETRY_EVENT_TYPES,
);

export const RoutineDisabledFeatureChecklistSchema = z.strictObject({
  actuate_routines: z.literal(false),
  routines_call_tools: z.literal(false),
  routines_write_memory: z.literal(false),
  routines_trigger_device_actions: z.literal(false),
  routines_initiate_cloud_calls: z.literal(false),
  background_execution_user_absent: z.literal(false),
  missed_schedule_catchup: z.literal(false),
  voice_schedule_changes: z.literal(false),
  auto_threshold_tuning: z.literal(false),
  auto_budget_tuning: z.literal(false),
  auto_policy_tuning: z.literal(false),
  auto_router_tuning: z.literal(false),
  auto_approval: z.literal(false),
  routine_chaining: z.literal(false),
  multi_process_scheduling: z.literal(false),
  remote_network_triggered_routines: z.literal(false),
  llm_extraction_in_collectors: z.literal(false),
  routine_self_modification: z.literal(false),
  raw_report_telemetry: z.literal(false),
  public_remote_schedule_control: z.literal(false),
});

export const RoutineDisabledFeatureGuardSchema = z.strictObject({
  guard_id: z.literal("routine_disabled_feature_closeout_v1"),
  disabled_features: RoutineDisabledFeatureChecklistSchema,
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_execution_started: z.literal(false),
  timers_started: z.literal(false),
  background_jobs_started: z.literal(false),
  telemetry_persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  api_route_added: z.literal(false),
  runtime_wired: z.literal(false),
  voice_wired: z.literal(false),
});

export const RoutineDisabledFeatureGuardValidationSchema = z.strictObject({
  passed: z.boolean(),
  violations: z.array(RoutineCloseoutDisabledFeatureSchema),
  disabled_feature_count: z.number().int().nonnegative(),
  enabled_feature_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_execution_started: z.literal(false),
  timers_started: z.literal(false),
  background_jobs_started: z.literal(false),
  telemetry_persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  api_route_added: z.literal(false),
  runtime_wired: z.literal(false),
  voice_wired: z.literal(false),
});

export const RoutineDisabledFeatureGuardTelemetryEventSchema = z.strictObject({
  event_type: RoutineDisabledFeatureGuardTelemetryEventTypeSchema,
  passed: z.boolean(),
  disabled_feature_count: z.number().int().nonnegative(),
  enabled_feature_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_execution_started: z.literal(false),
  timers_started: z.literal(false),
  background_jobs_started: z.literal(false),
  telemetry_persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  api_route_added: z.literal(false),
  runtime_wired: z.literal(false),
  voice_wired: z.literal(false),
});

export type RoutineDisabledFeatureChecklist = z.infer<
  typeof RoutineDisabledFeatureChecklistSchema
>;
export type RoutineDisabledFeatureGuard = z.infer<
  typeof RoutineDisabledFeatureGuardSchema
>;
export type RoutineDisabledFeatureGuardValidation = z.infer<
  typeof RoutineDisabledFeatureGuardValidationSchema
>;
export type RoutineDisabledFeatureGuardTelemetryEvent = z.infer<
  typeof RoutineDisabledFeatureGuardTelemetryEventSchema
>;

export const DEFAULT_ROUTINE_DISABLED_FEATURE_GUARD =
  RoutineDisabledFeatureGuardSchema.parse({
    guard_id: "routine_disabled_feature_closeout_v1",
    disabled_features: Object.fromEntries(
      ROUTINE_CLOSEOUT_DISABLED_FEATURES.map((feature) => [feature, false]),
    ),
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_execution_started: false,
    timers_started: false,
    background_jobs_started: false,
    telemetry_persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    ui_wired: false,
    api_route_added: false,
    runtime_wired: false,
    voice_wired: false,
  });

function guardFromUnknown(input: unknown): {
  parsed: RoutineDisabledFeatureGuard | null;
  violations: RoutineCloseoutDisabledFeature[];
} {
  const parsed = RoutineDisabledFeatureGuardSchema.safeParse(input);
  if (parsed.success) {
    return { parsed: parsed.data, violations: [] };
  }

  const issues = parsed.error.issues;
  const violations = new Set<RoutineCloseoutDisabledFeature>();
  for (const issue of issues) {
    const path = issue.path.join(".");
    for (const feature of ROUTINE_CLOSEOUT_DISABLED_FEATURES) {
      if (path.includes(`disabled_features.${feature}`)) {
        violations.add(feature);
      }
    }
  }

  return { parsed: null, violations: [...violations] };
}

export function validateRoutineDisabledFeatureGuard(
  input: unknown,
): RoutineDisabledFeatureGuardValidation {
  const { parsed, violations } = guardFromUnknown(input);

  return RoutineDisabledFeatureGuardValidationSchema.parse({
    passed: parsed !== null && violations.length === 0,
    violations,
    disabled_feature_count: ROUTINE_CLOSEOUT_DISABLED_FEATURES.length,
    enabled_feature_count: violations.length,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_execution_started: false,
    timers_started: false,
    background_jobs_started: false,
    telemetry_persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    ui_wired: false,
    api_route_added: false,
    runtime_wired: false,
    voice_wired: false,
  });
}

export function createRoutineDisabledFeatureGuardTelemetryEvent(
  validationInput: RoutineDisabledFeatureGuardValidation,
): RoutineDisabledFeatureGuardTelemetryEvent {
  const validation =
    RoutineDisabledFeatureGuardValidationSchema.parse(validationInput);
  return RoutineDisabledFeatureGuardTelemetryEventSchema.parse({
    event_type: "routine_disabled_feature_guard_validated",
    passed: validation.passed,
    disabled_feature_count: validation.disabled_feature_count,
    enabled_feature_count: validation.enabled_feature_count,
    violation_count: validation.violations.length,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_execution_started: false,
    timers_started: false,
    background_jobs_started: false,
    telemetry_persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    ui_wired: false,
    api_route_added: false,
    runtime_wired: false,
    voice_wired: false,
  });
}
