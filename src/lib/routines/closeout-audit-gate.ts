import { z } from "zod";

export const ROUTINE_CLOSEOUT_AUDIT_CATEGORIES = [
  "registry_valid",
  "scheduling_policy_safe",
  "tick_source_foreground_only",
  "lease_concurrency_capped",
  "kill_switch_enforced",
  "dedupe_metadata_only",
  "collectors_read_only_contracts",
  "report_metadata_only",
  "report_assembly_pure",
  "cost_usage_metadata_only",
  "project_progress_deterministic",
  "suggestions_advisory_only",
  "calibration_advisory_only",
  "suggestion_inbox_non_executing",
  "approval_bridge_boundary_only",
  "privacy_manifest_passed",
  "disabled_feature_guard_passed",
] as const;

export const ROUTINE_CLOSEOUT_AUDIT_TELEMETRY_EVENT_TYPES = [
  "routine_closeout_audit_gate_evaluated",
] as const;

export const ROUTINE_CLOSEOUT_AUDIT_VIOLATIONS = [
  "missing_module_coverage",
  "unsafe_authority_surface",
  "privacy_manifest_failed",
  "disabled_feature_guard_failed",
  "side_effect_flag_enabled",
] as const;

export type RoutineCloseoutAuditCategory =
  (typeof ROUTINE_CLOSEOUT_AUDIT_CATEGORIES)[number];
export type RoutineCloseoutAuditTelemetryEventType =
  (typeof ROUTINE_CLOSEOUT_AUDIT_TELEMETRY_EVENT_TYPES)[number];
export type RoutineCloseoutAuditViolation =
  (typeof ROUTINE_CLOSEOUT_AUDIT_VIOLATIONS)[number];

export const RoutineCloseoutAuditCategorySchema = z.enum(
  ROUTINE_CLOSEOUT_AUDIT_CATEGORIES,
);
export const RoutineCloseoutAuditTelemetryEventTypeSchema = z.enum(
  ROUTINE_CLOSEOUT_AUDIT_TELEMETRY_EVENT_TYPES,
);
export const RoutineCloseoutAuditViolationSchema = z.enum(
  ROUTINE_CLOSEOUT_AUDIT_VIOLATIONS,
);

export const RoutineCloseoutAuditCoverageSchema = z.strictObject(
  Object.fromEntries(
    ROUTINE_CLOSEOUT_AUDIT_CATEGORIES.map((category) => [
      category,
      z.literal(true),
    ]),
  ) as Record<RoutineCloseoutAuditCategory, z.ZodLiteral<true>>,
);

export const RoutineCloseoutAuthoritySurfaceSummarySchema = z.strictObject({
  phase: z.literal("8"),
  autonomy_boundary: z.literal("suggestion_only"),
  side_effects_allowed: z.literal(false),
  scheduler_execution_enabled: z.literal(false),
  background_execution_enabled: z.literal(false),
  routine_tool_calls_enabled: z.literal(false),
  routine_action_execution_enabled: z.literal(false),
  approval_execution_enabled: z.literal(false),
  memory_writes_enabled: z.literal(false),
  project_mutations_enabled: z.literal(false),
  environment_mutations_enabled: z.literal(false),
  cloud_network_enabled: z.literal(false),
  ui_runtime_wiring_enabled: z.literal(false),
});

export const RoutineCloseoutDisabledFeatureStatusSchema = z.strictObject({
  privacy_manifest_passed: z.boolean(),
  disabled_feature_guard_passed: z.boolean(),
  enabled_disabled_feature_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
});

export const RoutineCloseoutAuditGateSchema = z.strictObject({
  phase: z.literal("8"),
  module_coverage: RoutineCloseoutAuditCoverageSchema,
  disabled_feature_status: RoutineCloseoutDisabledFeatureStatusSchema,
  authority_surface: RoutineCloseoutAuthoritySurfaceSummarySchema,
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_execution_enabled: z.literal(false),
  routine_execution_enabled: z.literal(false),
  timers_started: z.literal(false),
  background_execution_enabled: z.literal(false),
  telemetry_persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_executed: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  api_route_added: z.literal(false),
  runtime_wired: z.literal(false),
  voice_wired: z.literal(false),
});

export const RoutineCloseoutAuditGateResultSchema = z.strictObject({
  passed: z.boolean(),
  violations: z.array(RoutineCloseoutAuditViolationSchema),
  warnings: z.array(z.string().max(160)),
  module_coverage_count: z.number().int().nonnegative(),
  missing_module_count: z.number().int().nonnegative(),
  disabled_feature_status: RoutineCloseoutDisabledFeatureStatusSchema,
  authority_surface: RoutineCloseoutAuthoritySurfaceSummarySchema,
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_execution_enabled: z.literal(false),
  routine_execution_enabled: z.literal(false),
  timers_started: z.literal(false),
  background_execution_enabled: z.literal(false),
  telemetry_persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_executed: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  api_route_added: z.literal(false),
  runtime_wired: z.literal(false),
  voice_wired: z.literal(false),
});

export const RoutineCloseoutAuditGateTelemetryEventSchema = z.strictObject({
  event_type: RoutineCloseoutAuditTelemetryEventTypeSchema,
  passed: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  module_coverage_count: z.number().int().nonnegative(),
  missing_module_count: z.number().int().nonnegative(),
  enabled_disabled_feature_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  scheduler_execution_enabled: z.literal(false),
  routine_execution_enabled: z.literal(false),
  background_execution_enabled: z.literal(false),
  telemetry_persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_executed: z.literal(false),
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  runtime_wired: z.literal(false),
});

export type RoutineCloseoutAuditCoverage = z.infer<
  typeof RoutineCloseoutAuditCoverageSchema
>;
export type RoutineCloseoutAuthoritySurfaceSummary = z.infer<
  typeof RoutineCloseoutAuthoritySurfaceSummarySchema
>;
export type RoutineCloseoutDisabledFeatureStatus = z.infer<
  typeof RoutineCloseoutDisabledFeatureStatusSchema
>;
export type RoutineCloseoutAuditGate = z.infer<
  typeof RoutineCloseoutAuditGateSchema
>;
export type RoutineCloseoutAuditGateResult = z.infer<
  typeof RoutineCloseoutAuditGateResultSchema
>;
export type RoutineCloseoutAuditGateTelemetryEvent = z.infer<
  typeof RoutineCloseoutAuditGateTelemetryEventSchema
>;

const DEFAULT_MODULE_COVERAGE = Object.fromEntries(
  ROUTINE_CLOSEOUT_AUDIT_CATEGORIES.map((category) => [category, true]),
) as RoutineCloseoutAuditCoverage;

const DEFAULT_AUTHORITY_SURFACE: RoutineCloseoutAuthoritySurfaceSummary = {
  phase: "8",
  autonomy_boundary: "suggestion_only",
  side_effects_allowed: false,
  scheduler_execution_enabled: false,
  background_execution_enabled: false,
  routine_tool_calls_enabled: false,
  routine_action_execution_enabled: false,
  approval_execution_enabled: false,
  memory_writes_enabled: false,
  project_mutations_enabled: false,
  environment_mutations_enabled: false,
  cloud_network_enabled: false,
  ui_runtime_wiring_enabled: false,
};

export const DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE =
  RoutineCloseoutAuditGateSchema.parse({
    phase: "8",
    module_coverage: DEFAULT_MODULE_COVERAGE,
    disabled_feature_status: {
      privacy_manifest_passed: true,
      disabled_feature_guard_passed: true,
      enabled_disabled_feature_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
    },
    authority_surface: DEFAULT_AUTHORITY_SURFACE,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_execution_enabled: false,
    routine_execution_enabled: false,
    timers_started: false,
    background_execution_enabled: false,
    telemetry_persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_executed: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    ui_wired: false,
    api_route_added: false,
    runtime_wired: false,
    voice_wired: false,
  });

function rawObject(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

function hasEnabledSideEffectFlag(input: unknown): boolean {
  const gate = rawObject(input);
  const authority = rawObject(gate.authority_surface);
  const keys = [
    "scheduler_execution_enabled",
    "routine_execution_enabled",
    "timers_started",
    "background_execution_enabled",
    "telemetry_persisted",
    "db_read_performed",
    "db_write_performed",
    "provider_called",
    "llm_called",
    "network_called",
    "cloud_called",
    "tool_called",
    "action_executed",
    "approval_executed",
    "memory_written",
    "project_mutated",
    "environment_mutated",
    "mutation_performed",
    "ui_wired",
    "api_route_added",
    "runtime_wired",
    "voice_wired",
    "side_effects_allowed",
    "routine_tool_calls_enabled",
    "routine_action_execution_enabled",
    "approval_execution_enabled",
    "memory_writes_enabled",
    "project_mutations_enabled",
    "environment_mutations_enabled",
    "cloud_network_enabled",
    "ui_runtime_wiring_enabled",
  ];

  return keys.some((key) => gate[key] === true || authority[key] === true);
}

function missingModuleCount(input: unknown): number {
  const coverage = rawObject(rawObject(input).module_coverage);
  return ROUTINE_CLOSEOUT_AUDIT_CATEGORIES.filter(
    (category) => coverage[category] !== true,
  ).length;
}

export function evaluateRoutineCloseoutAuditGate(
  input: unknown,
): RoutineCloseoutAuditGateResult {
  const parsed = RoutineCloseoutAuditGateSchema.safeParse(input);
  const gate = parsed.success ? parsed.data : null;
  const raw = rawObject(input);
  const rawStatus = rawObject(raw.disabled_feature_status);
  const missingModules = missingModuleCount(input);
  const enabledFeatureCount =
    typeof rawStatus.enabled_disabled_feature_count === "number"
      ? rawStatus.enabled_disabled_feature_count
      : 0;
  const privacyPassed = rawStatus.privacy_manifest_passed === true;
  const disabledGuardPassed = rawStatus.disabled_feature_guard_passed === true;
  const violations = new Set<RoutineCloseoutAuditViolation>();

  if (missingModules > 0) {
    violations.add("missing_module_coverage");
  }
  if (hasEnabledSideEffectFlag(input)) {
    violations.add("side_effect_flag_enabled");
    violations.add("unsafe_authority_surface");
  }
  if (!privacyPassed) {
    violations.add("privacy_manifest_failed");
  }
  if (!disabledGuardPassed || enabledFeatureCount > 0) {
    violations.add("disabled_feature_guard_failed");
  }
  if (!parsed.success && violations.size === 0) {
    violations.add("unsafe_authority_surface");
  }

  const disabledFeatureStatus =
    RoutineCloseoutDisabledFeatureStatusSchema.parse({
      privacy_manifest_passed: privacyPassed,
      disabled_feature_guard_passed: disabledGuardPassed,
      enabled_disabled_feature_count: enabledFeatureCount,
      metadata_only: true,
      counts_and_flags_only: true,
    });

  return RoutineCloseoutAuditGateResultSchema.parse({
    passed: gate !== null && violations.size === 0,
    violations: [...violations],
    warnings: [],
    module_coverage_count:
      ROUTINE_CLOSEOUT_AUDIT_CATEGORIES.length - missingModules,
    missing_module_count: missingModules,
    disabled_feature_status: disabledFeatureStatus,
    authority_surface: DEFAULT_AUTHORITY_SURFACE,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_execution_enabled: false,
    routine_execution_enabled: false,
    timers_started: false,
    background_execution_enabled: false,
    telemetry_persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_executed: false,
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

export function createRoutineCloseoutAuditGateTelemetryEvent(
  resultInput: RoutineCloseoutAuditGateResult,
): RoutineCloseoutAuditGateTelemetryEvent {
  const result = RoutineCloseoutAuditGateResultSchema.parse(resultInput);
  return RoutineCloseoutAuditGateTelemetryEventSchema.parse({
    event_type: "routine_closeout_audit_gate_evaluated",
    passed: result.passed,
    violation_count: result.violations.length,
    warning_count: result.warnings.length,
    module_coverage_count: result.module_coverage_count,
    missing_module_count: result.missing_module_count,
    enabled_disabled_feature_count:
      result.disabled_feature_status.enabled_disabled_feature_count,
    metadata_only: true,
    counts_and_flags_only: true,
    scheduler_execution_enabled: false,
    routine_execution_enabled: false,
    background_execution_enabled: false,
    telemetry_persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_executed: false,
    mutation_performed: false,
    ui_wired: false,
    runtime_wired: false,
  });
}
