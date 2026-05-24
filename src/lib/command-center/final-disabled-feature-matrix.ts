import { z } from "zod";

import { COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS } from "./privacy-enforcement";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";

export const PHASE_9_DISABLED_FEATURE_IDS = [
  "remote_networked_dashboard_access",
  "public_internet_ui_exposure",
  "run_trace_affordance",
  "retry_tool_affordance",
  "rerun_routine_affordance",
  "ui_approval_bypass",
  "ui_auto_approve",
  "ui_routine_enable_disable_schedule",
  "ui_cloud_fallback_toggle",
  "wake_word_screen_transition",
  "voice_screen_transition",
  "camera_driven_ui",
  "presence_triggered_wake",
  "raw_payload_rendering",
  "live_code_introspection",
  "source_code_rendering",
  "telemetry_editing",
  "audit_db_editing",
  "baseline_editing",
  "unredacted_export",
  "multi_user_shared_session_ui",
  "browser_extension_surface",
  "third_party_embed_surface",
  "auto_cockpit_screenshot_reports",
  "graph_driven_execution",
  "demo_mode_real_db_write",
  "developer_console_non_dev_build",
] as const;

export const PHASE_9_DISABLED_FEATURE_ENFORCEMENT_SURFACES = [
  "app_shell",
  "rest_screen",
  "working_cockpit",
  "audit_screen",
  "observability_api",
  "demo_mode",
  "developer_console",
  "privacy_closeout",
  "final_closeout",
] as const;

export const PHASE_9_DISABLED_FEATURE_MATRIX_VALIDATION_REASONS = [
  "disabled_feature_matrix_valid",
  "schema_rejected",
  "missing_feature",
  "duplicate_feature",
  "unknown_feature",
  "forbidden_feature_enabled",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const PHASE_9_DISABLED_FEATURE_MATRIX_VERDICTS = [
  "pass",
  "fail",
] as const;

export const Phase9DisabledFeatureIdSchema = z.enum(
  PHASE_9_DISABLED_FEATURE_IDS,
);
export const Phase9DisabledFeatureEnforcementSurfaceSchema = z.enum(
  PHASE_9_DISABLED_FEATURE_ENFORCEMENT_SURFACES,
);
export const Phase9DisabledFeatureMatrixValidationReasonSchema = z.enum(
  PHASE_9_DISABLED_FEATURE_MATRIX_VALIDATION_REASONS,
);
export const Phase9DisabledFeatureMatrixVerdictSchema = z.enum(
  PHASE_9_DISABLED_FEATURE_MATRIX_VERDICTS,
);

export const Phase9DisabledFeatureGuardSchema = z.strictObject({
  kind: z.literal("command_center.phase_9_disabled_feature_guard"),
  phase: z.literal("9L2"),
  feature_id: Phase9DisabledFeatureIdSchema,
  disabled: z.literal(true),
  enforcement_surface: Phase9DisabledFeatureEnforcementSurfaceSchema,
  notes: z.array(z.string().trim().min(1).max(180)),
});

export const Phase9DisabledFeatureMatrixSchema = z.strictObject({
  kind: z.literal("command_center.phase_9_disabled_feature_matrix"),
  phase: z.literal("9L2"),
  generated_at: z.number().int().nonnegative(),
  guards: z.array(Phase9DisabledFeatureGuardSchema),
});

export const Phase9DisabledFeatureMatrixValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(Phase9DisabledFeatureMatrixValidationReasonSchema),
  missing_features: z.array(Phase9DisabledFeatureIdSchema),
  duplicate_features: z.array(Phase9DisabledFeatureIdSchema),
  enabled_forbidden_features: z.array(Phase9DisabledFeatureIdSchema),
  unknown_feature_count: z.number().int().nonnegative(),
  withheld_fields: z.array(z.string().trim().min(1).max(180)),
  notes: z.array(z.string().trim().min(1).max(180)),
  mutated_input: z.literal(false),
});

export const Phase9DisabledFeatureMatrixSummarySchema = z.strictObject({
  total_features: z.number().int().nonnegative(),
  disabled_features: z.array(Phase9DisabledFeatureIdSchema),
  enabled_forbidden_features: z.array(Phase9DisabledFeatureIdSchema),
  verdict: Phase9DisabledFeatureMatrixVerdictSchema,
  notes: z.array(z.string().trim().min(1).max(180)),
});

export type Phase9DisabledFeatureId = z.infer<
  typeof Phase9DisabledFeatureIdSchema
>;
export type Phase9DisabledFeatureEnforcementSurface = z.infer<
  typeof Phase9DisabledFeatureEnforcementSurfaceSchema
>;
export type Phase9DisabledFeatureMatrixValidationReason = z.infer<
  typeof Phase9DisabledFeatureMatrixValidationReasonSchema
>;
export type Phase9DisabledFeatureMatrixVerdict = z.infer<
  typeof Phase9DisabledFeatureMatrixVerdictSchema
>;
export type Phase9DisabledFeatureGuard = z.infer<
  typeof Phase9DisabledFeatureGuardSchema
>;
export type Phase9DisabledFeatureMatrix = z.infer<
  typeof Phase9DisabledFeatureMatrixSchema
>;
export type Phase9DisabledFeatureMatrixValidation = z.infer<
  typeof Phase9DisabledFeatureMatrixValidationSchema
>;
export type Phase9DisabledFeatureMatrixSummary = z.infer<
  typeof Phase9DisabledFeatureMatrixSummarySchema
>;

export function createDefaultPhase9DisabledFeatureMatrix(): Phase9DisabledFeatureMatrix {
  return Phase9DisabledFeatureMatrixSchema.parse({
    kind: "command_center.phase_9_disabled_feature_matrix",
    phase: "9L2",
    generated_at: 0,
    guards: PHASE_9_DISABLED_FEATURE_IDS.map((featureId) =>
      createDisabledFeatureGuard(featureId),
    ),
  });
}

export function validatePhase9DisabledFeatureMatrix(
  input: unknown = createDefaultPhase9DisabledFeatureMatrix(),
): Phase9DisabledFeatureMatrixValidation {
  const parsed = Phase9DisabledFeatureMatrixSchema.safeParse(input);
  const guards = readGuards(input);
  const scan = scanDisabledFeatureMatrix(input, [], new WeakSet<object>());
  const reasons = new Set<Phase9DisabledFeatureMatrixValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const seen = new Set<Phase9DisabledFeatureId>();
  const duplicates = new Set<Phase9DisabledFeatureId>();
  const enabled = new Set<Phase9DisabledFeatureId>();
  let unknownFeatureCount = 0;

  if (!parsed.success) reasons.add("schema_rejected");
  for (const guard of guards) {
    const feature = readFeatureId(guard);
    if (feature === "unknown") {
      unknownFeatureCount += 1;
      continue;
    }
    if (seen.has(feature)) duplicates.add(feature);
    seen.add(feature);
    if (readBooleanField(guard, "disabled") !== true) enabled.add(feature);
  }

  const missing = PHASE_9_DISABLED_FEATURE_IDS.filter(
    (feature) => !seen.has(feature),
  );
  if (missing.length > 0) reasons.add("missing_feature");
  if (duplicates.size > 0) reasons.add("duplicate_feature");
  if (unknownFeatureCount > 0) reasons.add("unknown_feature");
  if (enabled.size > 0) reasons.add("forbidden_feature_enabled");
  if (scan.rawPayloadFields.length > 0) {
    reasons.add("raw_payload_field_present");
  }
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return Phase9DisabledFeatureMatrixValidationSchema.parse({
    passed,
    reasons: passed ? ["disabled_feature_matrix_valid"] : [...reasons],
    missing_features: missing,
    duplicate_features: [...duplicates],
    enabled_forbidden_features: [...enabled],
    unknown_feature_count: unknownFeatureCount,
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0 ? [...notes] : ["phase_9_forbidden_features_disabled"],
    mutated_input: false,
  });
}

export function summarizePhase9DisabledFeatureMatrix(
  input: unknown = createDefaultPhase9DisabledFeatureMatrix(),
): Phase9DisabledFeatureMatrixSummary {
  const validation = validatePhase9DisabledFeatureMatrix(input);
  const guards = readGuards(input);
  const disabled = guards
    .filter((guard) => readBooleanField(guard, "disabled") === true)
    .map(readFeatureId)
    .filter(
      (feature): feature is Phase9DisabledFeatureId => feature !== "unknown",
    )
    .filter((feature, index, features) => features.indexOf(feature) === index);

  return Phase9DisabledFeatureMatrixSummarySchema.parse({
    total_features: PHASE_9_DISABLED_FEATURE_IDS.length,
    disabled_features: PHASE_9_DISABLED_FEATURE_IDS.filter((feature) =>
      disabled.includes(feature),
    ),
    enabled_forbidden_features: validation.enabled_forbidden_features,
    verdict: validation.passed ? "pass" : "fail",
    notes: validation.passed
      ? ["all_phase_9_forbidden_features_disabled"]
      : validation.notes,
  });
}

function createDisabledFeatureGuard(
  featureId: Phase9DisabledFeatureId,
): Phase9DisabledFeatureGuard {
  return Phase9DisabledFeatureGuardSchema.parse({
    kind: "command_center.phase_9_disabled_feature_guard",
    phase: "9L2",
    feature_id: featureId,
    disabled: true,
    enforcement_surface: enforcementSurfaceFor(featureId),
    notes: [`${featureId}:disabled_by_phase_9_final_matrix`],
  });
}

function enforcementSurfaceFor(
  featureId: Phase9DisabledFeatureId,
): Phase9DisabledFeatureEnforcementSurface {
  if (
    featureId === "wake_word_screen_transition" ||
    featureId === "voice_screen_transition" ||
    featureId === "camera_driven_ui" ||
    featureId === "presence_triggered_wake"
  ) {
    return "app_shell";
  }
  if (
    featureId === "run_trace_affordance" ||
    featureId === "retry_tool_affordance" ||
    featureId === "rerun_routine_affordance" ||
    featureId === "graph_driven_execution"
  ) {
    return "audit_screen";
  }
  if (
    featureId === "raw_payload_rendering" ||
    featureId === "source_code_rendering" ||
    featureId === "live_code_introspection" ||
    featureId === "unredacted_export"
  ) {
    return "privacy_closeout";
  }
  if (featureId === "demo_mode_real_db_write") return "demo_mode";
  if (featureId === "developer_console_non_dev_build") {
    return "developer_console";
  }
  if (
    featureId === "telemetry_editing" ||
    featureId === "audit_db_editing" ||
    featureId === "baseline_editing"
  ) {
    return "observability_api";
  }
  return "final_closeout";
}

interface DisabledFeatureMatrixScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanDisabledFeatureMatrix(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): DisabledFeatureMatrixScanResult {
  const result: DisabledFeatureMatrixScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };
  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("disabled_feature_matrix_missing");
    return result;
  }
  if (
    typeof input === "function" ||
    typeof input === "symbol" ||
    typeof input === "bigint"
  ) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable:${path.join(".") || "root"}`);
    return result;
  }
  if (input === null || typeof input !== "object") return result;
  if (seen.has(input)) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable_cycle:${path.join(".") || "root"}`);
    return result;
  }
  seen.add(input);
  if (
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    result.unsafeShape = true;
    result.notes.push(`unsafe_object:${path.join(".") || "root"}`);
    return result;
  }

  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  for (const [key, value] of entries) {
    if (isForbiddenRawPayloadField(key)) {
      result.rawPayloadFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanDisabledFeatureMatrix(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function readGuards(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  const guards = (input as { guards?: unknown }).guards;
  return Array.isArray(guards) ? guards : [];
}

function readFeatureId(input: unknown): Phase9DisabledFeatureId | "unknown" {
  if (!input || typeof input !== "object") return "unknown";
  const parsed = Phase9DisabledFeatureIdSchema.safeParse(
    (input as { feature_id?: unknown }).feature_id,
  );
  return parsed.success ? parsed.data : "unknown";
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      "raw_tool_arguments",
      "raw_prompts",
      "raw_model_outputs",
      "source_code",
      "raw_stack_traces",
      "exact_pii",
      "api_keys",
      "tokens",
      "passwords",
    ] as readonly string[]
  ).includes(key);
}

function isExecutableAffordanceKey(key: string, value: unknown): boolean {
  if (
    key === "run_affordance_allowed" ||
    key === "retry_affordance_allowed" ||
    key === "approve_affordance_allowed" ||
    key === "execute_affordance_allowed" ||
    key === "mutate_affordance_allowed" ||
    key === "graph_execution_allowed" ||
    key === "remote_dashboard_allowed" ||
    key === "export_allowed" ||
    key === "debug_actions_allowed"
  ) {
    return value !== false;
  }
  return (
    COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS as readonly string[]
  ).includes(key);
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}
