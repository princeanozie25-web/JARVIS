import { z } from "zod";
import {
  VISION_MANIFEST_ALLOWED_REPLAY_EDGE_CLASSES,
  VISION_MANIFEST_ALLOWED_REPLAY_NODE_CLASSES,
  VISION_MANIFEST_DISABLED_FEATURES,
  VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES,
  VISION_MANIFEST_PHASES,
  VisionPrivacyTelemetryManifestSchema,
  createDefaultVisionPrivacyTelemetryManifest,
  validateVisionPrivacyTelemetryManifest,
  type VisionPrivacyTelemetryManifest,
} from "./privacy-telemetry-manifest";

export const VISION_AUDIT_MODULES = [
  ...VISION_MANIFEST_PHASES,
  "privacy_telemetry_manifest",
] as const;

export const VISION_AUDIT_CATEGORIES = [
  "metadata_only",
  "advisory_only",
  "no_raw_payloads",
  "no_capture",
  "no_provider_execution",
  "no_cloud_calls",
  "no_runtime_actions",
  "no_approval_granting",
  "no_mutations",
  "no_background_jobs",
  "replay_diagnostic_only",
  "graph_non_executable",
  "developer_observability_safe",
] as const;

export const VISION_AUDIT_VIOLATION_CODES = [
  "manifest_validation_failed",
  "module_coverage_missing",
  "category_failed",
  "disabled_feature_enabled",
  "developer_observability_unsafe",
  "replay_graph_executable",
] as const;

export const VISION_AUDIT_WARNING_CODES = [
  "coverage_supplied_by_manifest",
  "audit_scaffold_only",
] as const;

export const VISION_AUDIT_TELEMETRY_EVENT_TYPES = [
  "vision_audit_gate_evaluated",
] as const;

export type VisionAuditModule = (typeof VISION_AUDIT_MODULES)[number];
export type VisionAuditCategory = (typeof VISION_AUDIT_CATEGORIES)[number];
export type VisionAuditViolationCode =
  (typeof VISION_AUDIT_VIOLATION_CODES)[number];
export type VisionAuditWarningCode =
  (typeof VISION_AUDIT_WARNING_CODES)[number];
export type VisionAuditTelemetryEventType =
  (typeof VISION_AUDIT_TELEMETRY_EVENT_TYPES)[number];

const VisionAuditStringSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionAuditModuleSchema = z.enum(VISION_AUDIT_MODULES);
export const VisionAuditCategorySchema = z.enum(VISION_AUDIT_CATEGORIES);
export const VisionAuditViolationCodeSchema = z.enum(
  VISION_AUDIT_VIOLATION_CODES,
);
export const VisionAuditWarningCodeSchema = z.enum(VISION_AUDIT_WARNING_CODES);
export const VisionAuditTelemetryEventTypeSchema = z.enum(
  VISION_AUDIT_TELEMETRY_EVENT_TYPES,
);

export const VisionAuditModuleCoverageSchema = z.strictObject({
  required_modules: z.array(VisionAuditModuleSchema),
  covered_modules: z.array(VisionAuditModuleSchema),
  required_count: z.number().int().nonnegative(),
  covered_count: z.number().int().nonnegative(),
  missing_count: z.number().int().nonnegative(),
});

export const VisionAuditDisabledFeatureStatusSchema = z.strictObject({
  total_count: z.number().int().nonnegative(),
  disabled_count: z.number().int().nonnegative(),
  enabled_count: z.number().int().nonnegative(),
  all_disabled: z.boolean(),
});

export const VisionDeveloperObservabilitySummarySchema = z.strictObject({
  safe_inspectable_fields: z.array(VisionAuditStringSchema),
  forbidden_fields: z.array(VisionAuditStringSchema),
  replay_graph_node_class_count: z.number().int().nonnegative(),
  replay_graph_edge_class_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_inspection_allowed: z.literal(false),
});

export const VisionAuditGateResultSchema = z.strictObject({
  kind: z.literal("vision.audit_gate_result"),
  pass: z.boolean(),
  violations: z.array(VisionAuditViolationCodeSchema),
  warnings: z.array(VisionAuditWarningCodeSchema),
  module_coverage: VisionAuditModuleCoverageSchema,
  disabled_feature_status: VisionAuditDisabledFeatureStatusSchema,
  categories_passed: z.record(VisionAuditCategorySchema, z.boolean()),
  developer_observability: VisionDeveloperObservabilitySummarySchema,
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  derived: z.literal(true),
  advisory_only: z.literal(true),
  authoritative: z.literal(false),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  mutation_performed: z.literal(false),
  telemetry_persisted: z.literal(false),
  background_job_started: z.literal(false),
});

export const VisionAuditGateTelemetryEventSchema = z.strictObject({
  event_type: VisionAuditTelemetryEventTypeSchema,
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  required_module_count: z.number().int().nonnegative(),
  covered_module_count: z.number().int().nonnegative(),
  missing_module_count: z.number().int().nonnegative(),
  category_count: z.number().int().nonnegative(),
  disabled_feature_enabled_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  mutation_performed: z.literal(false),
  telemetry_persisted: z.literal(false),
});

export const VisionAuditGateReplayStepSchema = z.strictObject({
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  covered_module_count: z.number().int().nonnegative(),
  category_count: z.number().int().nonnegative(),
  diagnostic_only: z.literal(true),
  executable: z.literal(false),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  mutation_performed: z.literal(false),
});

export type VisionAuditModuleCoverage = z.infer<
  typeof VisionAuditModuleCoverageSchema
>;
export type VisionAuditDisabledFeatureStatus = z.infer<
  typeof VisionAuditDisabledFeatureStatusSchema
>;
export type VisionDeveloperObservabilitySummary = z.infer<
  typeof VisionDeveloperObservabilitySummarySchema
>;
export type VisionAuditGateResult = z.infer<typeof VisionAuditGateResultSchema>;
export type VisionAuditGateTelemetryEvent = z.infer<
  typeof VisionAuditGateTelemetryEventSchema
>;
export type VisionAuditGateReplayStep = z.infer<
  typeof VisionAuditGateReplayStepSchema
>;

export interface EvaluateVisionAuditGateInput {
  manifest?: VisionPrivacyTelemetryManifest;
  covered_modules?: VisionAuditModule[];
}

function addViolation(
  violations: Set<VisionAuditViolationCode>,
  code: VisionAuditViolationCode,
): void {
  violations.add(code);
}

function moduleCoverage(
  coveredModules: VisionAuditModule[],
): VisionAuditModuleCoverage {
  const covered = [...new Set(coveredModules)];
  const missing = VISION_AUDIT_MODULES.filter(
    (moduleName) => !covered.includes(moduleName),
  );
  return VisionAuditModuleCoverageSchema.parse({
    required_modules: [...VISION_AUDIT_MODULES],
    covered_modules: covered,
    required_count: VISION_AUDIT_MODULES.length,
    covered_count: covered.length,
    missing_count: missing.length,
  });
}

function disabledFeatureStatus(
  manifest: VisionPrivacyTelemetryManifest,
): VisionAuditDisabledFeatureStatus {
  const enabled = VISION_MANIFEST_DISABLED_FEATURES.filter(
    (feature) => manifest.disabled_features[feature],
  );
  return VisionAuditDisabledFeatureStatusSchema.parse({
    total_count: VISION_MANIFEST_DISABLED_FEATURES.length,
    disabled_count: VISION_MANIFEST_DISABLED_FEATURES.length - enabled.length,
    enabled_count: enabled.length,
    all_disabled: enabled.length === 0,
  });
}

function developerObservabilitySummary(
  manifest: VisionPrivacyTelemetryManifest,
): VisionDeveloperObservabilitySummary {
  return VisionDeveloperObservabilitySummarySchema.parse({
    safe_inspectable_fields: manifest.developer_observability.safe_to_inspect,
    forbidden_fields: manifest.developer_observability.never_show_or_store,
    replay_graph_node_class_count:
      VISION_MANIFEST_ALLOWED_REPLAY_NODE_CLASSES.length,
    replay_graph_edge_class_count:
      VISION_MANIFEST_ALLOWED_REPLAY_EDGE_CLASSES.length,
    metadata_only: true,
    raw_payload_inspection_allowed: false,
  });
}

function categoryResults(
  manifest: VisionPrivacyTelemetryManifest,
  disabled: VisionAuditDisabledFeatureStatus,
): Record<VisionAuditCategory, boolean> {
  const forbidden = new Set(VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES);
  const observabilityUnsafe =
    !manifest.developer_observability.metadata_only_diagnostics ||
    manifest.developer_observability.safe_to_inspect.some((field) =>
      forbidden.has(
        field as (typeof VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES)[number],
      ),
    );

  return {
    metadata_only: manifest.metadata_only,
    advisory_only: manifest.advisory_only && !manifest.authoritative,
    no_raw_payloads:
      manifest.redaction_policy.metadata_only_required &&
      VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES.every(
        (payload) =>
          manifest.redaction_policy.raw_payload_forbidden.includes(payload) &&
          manifest.replay_graph.forbidden_payload_classes.includes(payload),
      ),
    no_capture: !manifest.disabled_features.capture,
    no_provider_execution: !manifest.disabled_features.provider_execution,
    no_cloud_calls: !manifest.disabled_features.cloud_calls,
    no_runtime_actions:
      !manifest.disabled_features.runtime_tools && !manifest.runtime_actions,
    no_approval_granting:
      !manifest.disabled_features.approval_granting &&
      !manifest.approval_granting,
    no_mutations:
      !manifest.disabled_features.memory_mutation &&
      !manifest.disabled_features.project_mutation &&
      !manifest.disabled_features.environment_mutation,
    no_background_jobs: !manifest.disabled_features.background_jobs,
    replay_diagnostic_only: manifest.replay_graph.diagnostic_only,
    graph_non_executable: !manifest.replay_graph.executable,
    developer_observability_safe: !observabilityUnsafe && disabled.all_disabled,
  };
}

export function evaluateVisionAuditGate(
  input: EvaluateVisionAuditGateInput = {},
): VisionAuditGateResult {
  const manifest = VisionPrivacyTelemetryManifestSchema.parse(
    input.manifest ?? createDefaultVisionPrivacyTelemetryManifest(),
  );
  const coveredModules = input.covered_modules ?? [
    ...manifest.phases,
    "privacy_telemetry_manifest",
  ];
  const coverage = moduleCoverage(coveredModules);
  const disabled = disabledFeatureStatus(manifest);
  const observability = developerObservabilitySummary(manifest);
  const validation = validateVisionPrivacyTelemetryManifest(manifest);
  const categories = categoryResults(manifest, disabled);
  const violations = new Set<VisionAuditViolationCode>();

  if (!validation.pass) addViolation(violations, "manifest_validation_failed");
  if (coverage.missing_count > 0) {
    addViolation(violations, "module_coverage_missing");
  }
  if (!disabled.all_disabled) {
    addViolation(violations, "disabled_feature_enabled");
  }
  if (manifest.replay_graph.executable) {
    addViolation(violations, "replay_graph_executable");
  }
  if (!categories.developer_observability_safe) {
    addViolation(violations, "developer_observability_unsafe");
  }
  if (Object.values(categories).some((passed) => !passed)) {
    addViolation(violations, "category_failed");
  }

  return VisionAuditGateResultSchema.parse({
    kind: "vision.audit_gate_result",
    pass: violations.size === 0,
    violations: [...violations],
    warnings: ["audit_scaffold_only"],
    module_coverage: coverage,
    disabled_feature_status: disabled,
    categories_passed: categories,
    developer_observability: observability,
    metadata_only: true,
    counts_and_flags_only: true,
    derived: true,
    advisory_only: true,
    authoritative: false,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
    approval_granted: false,
    mutation_performed: false,
    telemetry_persisted: false,
    background_job_started: false,
  });
}

export function createVisionAuditGateTelemetryEvent(
  resultInput: VisionAuditGateResult,
): VisionAuditGateTelemetryEvent {
  const result = VisionAuditGateResultSchema.parse(resultInput);
  return VisionAuditGateTelemetryEventSchema.parse({
    event_type: "vision_audit_gate_evaluated",
    pass: result.pass,
    violation_count: result.violations.length,
    warning_count: result.warnings.length,
    required_module_count: result.module_coverage.required_count,
    covered_module_count: result.module_coverage.covered_count,
    missing_module_count: result.module_coverage.missing_count,
    category_count: VISION_AUDIT_CATEGORIES.length,
    disabled_feature_enabled_count:
      result.disabled_feature_status.enabled_count,
    metadata_only: true,
    counts_and_flags_only: true,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
    approval_granted: false,
    mutation_performed: false,
    telemetry_persisted: false,
  });
}

export function createVisionAuditGateReplayStep(
  resultInput: VisionAuditGateResult,
): VisionAuditGateReplayStep {
  const result = VisionAuditGateResultSchema.parse(resultInput);
  return VisionAuditGateReplayStepSchema.parse({
    pass: result.pass,
    violation_count: result.violations.length,
    warning_count: result.warnings.length,
    covered_module_count: result.module_coverage.covered_count,
    category_count: VISION_AUDIT_CATEGORIES.length,
    diagnostic_only: true,
    executable: false,
    metadata_only: true,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
    approval_granted: false,
    mutation_performed: false,
  });
}
