import { z } from "zod";

export const PHASE_17_DISABLED_FEATURES = [
  "scheduler_execution",
  "background_headless_scheduler",
  "autonomous_execution",
  "tool_calls",
  "device_actions",
  "project_mutations",
  "memory_writes",
  "approval_execution",
  "cloud_network_calls",
  "routine_chaining",
  "self_modifying_routines",
  "auto_tuning_thresholds_budgets_policies",
  "catch_up_missed_schedule_runs",
  "voice_enable_disable_schedule_changes",
  "raw_report_telemetry",
  "raw_suggestion_telemetry",
] as const;

export const PHASE_17_DISABLED_GUARD_REASONS = [
  "phase_17_contract_scaffold_only",
  "suggestion_only_invariant",
  "foreground_only_invariant",
  "metadata_only_invariant",
  "non_executing_runtime_invariant",
  "privacy_telemetry_invariant",
] as const;

export type Phase17DisabledFeature =
  (typeof PHASE_17_DISABLED_FEATURES)[number];
export type Phase17DisabledGuardReason =
  (typeof PHASE_17_DISABLED_GUARD_REASONS)[number];

export const Phase17DisabledFeatureSchema = z.enum(PHASE_17_DISABLED_FEATURES);
export const Phase17DisabledGuardReasonSchema = z.enum(
  PHASE_17_DISABLED_GUARD_REASONS,
);

export const Phase17DisabledGuardMatrixSchema = z.strictObject({
  phase: z.literal(17),
  slice: z.literal("17A.2"),
  status: z.literal("disabled_guard_matrix"),
  scheduler_execution_enabled: z.literal(false),
  background_headless_scheduler_enabled: z.literal(false),
  autonomous_execution_enabled: z.literal(false),
  tool_calls_enabled: z.literal(false),
  device_actions_enabled: z.literal(false),
  project_mutations_enabled: z.literal(false),
  memory_writes_enabled: z.literal(false),
  approval_execution_enabled: z.literal(false),
  cloud_network_calls_enabled: z.literal(false),
  routine_chaining_enabled: z.literal(false),
  self_modifying_routines_enabled: z.literal(false),
  auto_tuning_thresholds_budgets_policies_enabled: z.literal(false),
  catch_up_missed_schedule_runs_enabled: z.literal(false),
  voice_enable_disable_schedule_changes_enabled: z.literal(false),
  raw_report_telemetry_enabled: z.literal(false),
  raw_suggestion_telemetry_enabled: z.literal(false),
  suggestion_only: z.literal(true),
  foreground_only: z.literal(true),
  metadata_only: z.literal(true),
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

export const Phase17DisabledGuardDecisionSchema = z.strictObject({
  feature: Phase17DisabledFeatureSchema,
  allowed: z.literal(false),
  reason: Phase17DisabledGuardReasonSchema,
  error_class: Phase17DisabledGuardReasonSchema,
  phase: z.literal(17),
  slice: z.literal("17A.2"),
  suggestion_only: z.literal(true),
  foreground_only: z.literal(true),
  metadata_only: z.literal(true),
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

export type Phase17DisabledGuardMatrix = z.infer<
  typeof Phase17DisabledGuardMatrixSchema
>;
export type Phase17DisabledGuardDecision = z.infer<
  typeof Phase17DisabledGuardDecisionSchema
>;

export const DEFAULT_PHASE_17_DISABLED_GUARDS =
  Phase17DisabledGuardMatrixSchema.parse({
    phase: 17,
    slice: "17A.2",
    status: "disabled_guard_matrix",
    scheduler_execution_enabled: false,
    background_headless_scheduler_enabled: false,
    autonomous_execution_enabled: false,
    tool_calls_enabled: false,
    device_actions_enabled: false,
    project_mutations_enabled: false,
    memory_writes_enabled: false,
    approval_execution_enabled: false,
    cloud_network_calls_enabled: false,
    routine_chaining_enabled: false,
    self_modifying_routines_enabled: false,
    auto_tuning_thresholds_budgets_policies_enabled: false,
    catch_up_missed_schedule_runs_enabled: false,
    voice_enable_disable_schedule_changes_enabled: false,
    raw_report_telemetry_enabled: false,
    raw_suggestion_telemetry_enabled: false,
    suggestion_only: true,
    foreground_only: true,
    metadata_only: true,
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

export function evaluatePhase17DisabledGuard(
  feature: Phase17DisabledFeature,
): Phase17DisabledGuardDecision {
  return Phase17DisabledGuardDecisionSchema.parse({
    feature,
    allowed: false,
    reason: reasonForFeature(feature),
    error_class: reasonForFeature(feature),
    phase: 17,
    slice: "17A.2",
    suggestion_only: true,
    foreground_only: true,
    metadata_only: true,
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

function reasonForFeature(
  feature: Phase17DisabledFeature,
): Phase17DisabledGuardReason {
  switch (feature) {
    case "scheduler_execution":
    case "autonomous_execution":
    case "catch_up_missed_schedule_runs":
      return "non_executing_runtime_invariant";
    case "background_headless_scheduler":
      return "foreground_only_invariant";
    case "tool_calls":
    case "device_actions":
    case "project_mutations":
    case "memory_writes":
    case "approval_execution":
    case "routine_chaining":
    case "self_modifying_routines":
    case "auto_tuning_thresholds_budgets_policies":
    case "voice_enable_disable_schedule_changes":
      return "suggestion_only_invariant";
    case "cloud_network_calls":
      return "phase_17_contract_scaffold_only";
    case "raw_report_telemetry":
    case "raw_suggestion_telemetry":
      return "privacy_telemetry_invariant";
  }
}
