import { z } from "zod";

export const ROUTINE_PRIVACY_ALLOWED_TELEMETRY_FIELDS = [
  "event_type",
  "count",
  "counts",
  "flags",
  "status",
  "statuses",
  "class",
  "classes",
  "bin",
  "bins",
  "hash",
  "hashes",
  "duration_ms",
  "truncated",
  "redaction_status",
] as const;

export const ROUTINE_PRIVACY_FORBIDDEN_TELEMETRY_FIELDS = [
  "body",
  "content",
  "text",
  "prompt",
  "response",
  "transcript",
  "file_path",
  "project_name",
  "task_title",
  "environment_value",
  "vision_frame",
  "ocr_text",
  "pii",
  "secret",
] as const;

export const ROUTINE_PRIVACY_RAW_PAYLOAD_FORBIDDEN_LIST = [
  "raw_report_body",
  "raw_suggestion_text",
  "raw_project_name",
  "raw_task_title",
  "raw_file_path",
  "raw_prompt",
  "raw_response",
  "voice_transcript",
  "raw_environment_value",
  "raw_vision_frame",
  "ocr_text",
  "pii",
  "secret",
] as const;

export const ROUTINE_PRIVACY_DISABLED_FEATURES = [
  "telemetry_persistence",
  "remote_sink",
  "raw_report_storage",
  "raw_suggestion_storage",
  "tool_calls",
  "approvals_granted",
  "actions_executed",
  "memory_writes",
  "mutations",
  "cloud_network",
  "background_jobs",
  "ui_runtime_wiring",
] as const;

export const ROUTINE_PRIVACY_VALIDATION_REASONS = [
  "pass",
  "raw_payload_allowed",
  "forbidden_telemetry_field_allowed",
  "remote_sink_enabled",
  "disabled_feature_enabled",
  "developer_observability_unsafe",
] as const;

export const ROUTINE_PRIVACY_TELEMETRY_EVENT_TYPES = [
  "routine_privacy_manifest_validated",
] as const;

export type RoutinePrivacyAllowedTelemetryField =
  (typeof ROUTINE_PRIVACY_ALLOWED_TELEMETRY_FIELDS)[number];
export type RoutinePrivacyForbiddenTelemetryField =
  (typeof ROUTINE_PRIVACY_FORBIDDEN_TELEMETRY_FIELDS)[number];
export type RoutinePrivacyRawPayloadForbidden =
  (typeof ROUTINE_PRIVACY_RAW_PAYLOAD_FORBIDDEN_LIST)[number];
export type RoutinePrivacyDisabledFeature =
  (typeof ROUTINE_PRIVACY_DISABLED_FEATURES)[number];
export type RoutinePrivacyValidationReason =
  (typeof ROUTINE_PRIVACY_VALIDATION_REASONS)[number];
export type RoutinePrivacyTelemetryEventType =
  (typeof ROUTINE_PRIVACY_TELEMETRY_EVENT_TYPES)[number];

export const RoutinePrivacyAllowedTelemetryFieldSchema = z.enum(
  ROUTINE_PRIVACY_ALLOWED_TELEMETRY_FIELDS,
);
export const RoutinePrivacyForbiddenTelemetryFieldSchema = z.enum(
  ROUTINE_PRIVACY_FORBIDDEN_TELEMETRY_FIELDS,
);
export const RoutinePrivacyRawPayloadForbiddenSchema = z.enum(
  ROUTINE_PRIVACY_RAW_PAYLOAD_FORBIDDEN_LIST,
);
export const RoutinePrivacyDisabledFeatureSchema = z.enum(
  ROUTINE_PRIVACY_DISABLED_FEATURES,
);
export const RoutinePrivacyValidationReasonSchema = z.enum(
  ROUTINE_PRIVACY_VALIDATION_REASONS,
);
export const RoutinePrivacyTelemetryEventTypeSchema = z.enum(
  ROUTINE_PRIVACY_TELEMETRY_EVENT_TYPES,
);

export const RoutinePrivacyStoragePostureSchema = z.strictObject({
  routine_runs_metadata_only: z.literal(true),
  suggestions_redacted_only: z.literal(true),
  baselines_metadata_only: z.literal(true),
  no_remote_sink: z.literal(true),
  metadata_only: z.literal(true),
});

export const RoutineDeveloperObservabilityPostureSchema = z.strictObject({
  counts_allowed: z.literal(true),
  classes_allowed: z.literal(true),
  bins_allowed: z.literal(true),
  hashes_allowed: z.literal(true),
  statuses_allowed: z.literal(true),
  raw_payload_inspection_allowed: z.literal(false),
  raw_report_body_visible: z.literal(false),
  raw_suggestion_text_visible: z.literal(false),
  raw_project_name_visible: z.literal(false),
  raw_task_title_visible: z.literal(false),
  raw_file_path_visible: z.literal(false),
  raw_prompt_visible: z.literal(false),
  raw_response_visible: z.literal(false),
  voice_transcript_visible: z.literal(false),
  raw_environment_value_visible: z.literal(false),
  raw_vision_frame_visible: z.literal(false),
  ocr_text_visible: z.literal(false),
  pii_visible: z.literal(false),
  secret_visible: z.literal(false),
  metadata_only: z.literal(true),
});

export const RoutineDisabledFeatureManifestSchema = z.strictObject({
  telemetry_persistence: z.literal(false),
  remote_sink: z.literal(false),
  raw_report_storage: z.literal(false),
  raw_suggestion_storage: z.literal(false),
  tool_calls: z.literal(false),
  approvals_granted: z.literal(false),
  actions_executed: z.literal(false),
  memory_writes: z.literal(false),
  mutations: z.literal(false),
  cloud_network: z.literal(false),
  background_jobs: z.literal(false),
  ui_runtime_wiring: z.literal(false),
});

export const RoutinePrivacyTelemetryManifestSchema = z.strictObject({
  manifest_id: z.literal("routine_privacy_telemetry_redaction_v1"),
  allowed_telemetry_fields: z.array(RoutinePrivacyAllowedTelemetryFieldSchema),
  forbidden_telemetry_fields: z.array(
    RoutinePrivacyForbiddenTelemetryFieldSchema,
  ),
  raw_payload_forbidden_list: z.array(RoutinePrivacyRawPayloadForbiddenSchema),
  storage_posture: RoutinePrivacyStoragePostureSchema,
  developer_observability: RoutineDeveloperObservabilityPostureSchema,
  disabled_features: RoutineDisabledFeatureManifestSchema,
  metadata_only: z.literal(true),
  counts_classes_bins_hashes_statuses_only: z.literal(true),
  telemetry_persisted: z.literal(false),
  remote_sink_enabled: z.literal(false),
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
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  runtime_wired: z.literal(false),
});

export const RoutinePrivacyManifestValidationSchema = z.strictObject({
  passed: z.boolean(),
  violations: z.array(RoutinePrivacyValidationReasonSchema),
  allowed_field_count: z.number().int().nonnegative(),
  forbidden_field_count: z.number().int().nonnegative(),
  raw_payload_forbidden_count: z.number().int().nonnegative(),
  disabled_feature_count: z.number().int().nonnegative(),
  enabled_disabled_feature_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  telemetry_persisted: z.literal(false),
  remote_sink_enabled: z.literal(false),
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
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  runtime_wired: z.literal(false),
});

export const RoutinePrivacyManifestTelemetryEventSchema = z.strictObject({
  event_type: RoutinePrivacyTelemetryEventTypeSchema,
  passed: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  allowed_field_count: z.number().int().nonnegative(),
  forbidden_field_count: z.number().int().nonnegative(),
  raw_payload_forbidden_count: z.number().int().nonnegative(),
  enabled_disabled_feature_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  telemetry_persisted: z.literal(false),
  remote_sink_enabled: z.literal(false),
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
  mutation_performed: z.literal(false),
  ui_wired: z.literal(false),
  runtime_wired: z.literal(false),
});

export type RoutinePrivacyStoragePosture = z.infer<
  typeof RoutinePrivacyStoragePostureSchema
>;
export type RoutineDeveloperObservabilityPosture = z.infer<
  typeof RoutineDeveloperObservabilityPostureSchema
>;
export type RoutineDisabledFeatureManifest = z.infer<
  typeof RoutineDisabledFeatureManifestSchema
>;
export type RoutinePrivacyTelemetryManifest = z.infer<
  typeof RoutinePrivacyTelemetryManifestSchema
>;
export type RoutinePrivacyManifestValidation = z.infer<
  typeof RoutinePrivacyManifestValidationSchema
>;
export type RoutinePrivacyManifestTelemetryEvent = z.infer<
  typeof RoutinePrivacyManifestTelemetryEventSchema
>;

export const DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST =
  RoutinePrivacyTelemetryManifestSchema.parse({
    manifest_id: "routine_privacy_telemetry_redaction_v1",
    allowed_telemetry_fields: [...ROUTINE_PRIVACY_ALLOWED_TELEMETRY_FIELDS],
    forbidden_telemetry_fields: [...ROUTINE_PRIVACY_FORBIDDEN_TELEMETRY_FIELDS],
    raw_payload_forbidden_list: [...ROUTINE_PRIVACY_RAW_PAYLOAD_FORBIDDEN_LIST],
    storage_posture: {
      routine_runs_metadata_only: true,
      suggestions_redacted_only: true,
      baselines_metadata_only: true,
      no_remote_sink: true,
      metadata_only: true,
    },
    developer_observability: {
      counts_allowed: true,
      classes_allowed: true,
      bins_allowed: true,
      hashes_allowed: true,
      statuses_allowed: true,
      raw_payload_inspection_allowed: false,
      raw_report_body_visible: false,
      raw_suggestion_text_visible: false,
      raw_project_name_visible: false,
      raw_task_title_visible: false,
      raw_file_path_visible: false,
      raw_prompt_visible: false,
      raw_response_visible: false,
      voice_transcript_visible: false,
      raw_environment_value_visible: false,
      raw_vision_frame_visible: false,
      ocr_text_visible: false,
      pii_visible: false,
      secret_visible: false,
      metadata_only: true,
    },
    disabled_features: {
      telemetry_persistence: false,
      remote_sink: false,
      raw_report_storage: false,
      raw_suggestion_storage: false,
      tool_calls: false,
      approvals_granted: false,
      actions_executed: false,
      memory_writes: false,
      mutations: false,
      cloud_network: false,
      background_jobs: false,
      ui_runtime_wiring: false,
    },
    metadata_only: true,
    counts_classes_bins_hashes_statuses_only: true,
    telemetry_persisted: false,
    remote_sink_enabled: false,
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
    mutation_performed: false,
    ui_wired: false,
    runtime_wired: false,
  });

function enabledDisabledFeatureCount(
  disabledFeatures: RoutineDisabledFeatureManifest,
): number {
  return ROUTINE_PRIVACY_DISABLED_FEATURES.filter(
    (feature) => disabledFeatures[feature],
  ).length;
}

function collectViolations(
  manifest: RoutinePrivacyTelemetryManifest,
): RoutinePrivacyValidationReason[] {
  const violations = new Set<RoutinePrivacyValidationReason>();
  const allowedFields = new Set(manifest.allowed_telemetry_fields);

  if (
    manifest.forbidden_telemetry_fields.some((field) =>
      allowedFields.has(field as RoutinePrivacyAllowedTelemetryField),
    )
  ) {
    violations.add("forbidden_telemetry_field_allowed");
  }

  if (
    ROUTINE_PRIVACY_RAW_PAYLOAD_FORBIDDEN_LIST.some((field) =>
      allowedFields.has(field as RoutinePrivacyAllowedTelemetryField),
    )
  ) {
    violations.add("raw_payload_allowed");
  }

  if (
    !manifest.storage_posture.no_remote_sink ||
    manifest.remote_sink_enabled
  ) {
    violations.add("remote_sink_enabled");
  }

  if (enabledDisabledFeatureCount(manifest.disabled_features) > 0) {
    violations.add("disabled_feature_enabled");
  }

  const observability = manifest.developer_observability;
  if (
    observability.raw_payload_inspection_allowed ||
    observability.raw_report_body_visible ||
    observability.raw_suggestion_text_visible ||
    observability.raw_project_name_visible ||
    observability.raw_task_title_visible ||
    observability.raw_file_path_visible ||
    observability.raw_prompt_visible ||
    observability.raw_response_visible ||
    observability.voice_transcript_visible ||
    observability.raw_environment_value_visible ||
    observability.raw_vision_frame_visible ||
    observability.ocr_text_visible ||
    observability.pii_visible ||
    observability.secret_visible
  ) {
    violations.add("developer_observability_unsafe");
  }

  return [...violations];
}

function violationsFromIssues(
  issues: z.ZodIssue[],
): RoutinePrivacyValidationReason[] {
  const violations = new Set<RoutinePrivacyValidationReason>();

  for (const issue of issues) {
    const path = issue.path.join(".");
    if (
      path.includes("allowed_telemetry_fields") ||
      path.includes("raw_payload_forbidden_list") ||
      path.includes("raw_")
    ) {
      violations.add("raw_payload_allowed");
    }
    if (
      path.includes("storage_posture.no_remote_sink") ||
      path.includes("remote_sink_enabled")
    ) {
      violations.add("remote_sink_enabled");
    }
    if (path.includes("disabled_features")) {
      violations.add("disabled_feature_enabled");
    }
    if (path.includes("developer_observability")) {
      violations.add("developer_observability_unsafe");
    }
    if (
      path.includes("tool_called") ||
      path.includes("action_executed") ||
      path.includes("approval_granted") ||
      path.includes("memory_written") ||
      path.includes("mutation_performed") ||
      path.includes("network_called") ||
      path.includes("cloud_called") ||
      path.includes("ui_wired") ||
      path.includes("runtime_wired")
    ) {
      violations.add("disabled_feature_enabled");
    }
  }

  return violations.size > 0 ? [...violations] : ["raw_payload_allowed"];
}

export function validateRoutinePrivacyTelemetryManifest(
  input: unknown,
): RoutinePrivacyManifestValidation {
  const parsed = RoutinePrivacyTelemetryManifestSchema.safeParse(input);
  if (!parsed.success) {
    return RoutinePrivacyManifestValidationSchema.parse({
      passed: false,
      violations: violationsFromIssues(parsed.error.issues),
      allowed_field_count: 0,
      forbidden_field_count: 0,
      raw_payload_forbidden_count: 0,
      disabled_feature_count: ROUTINE_PRIVACY_DISABLED_FEATURES.length,
      enabled_disabled_feature_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      telemetry_persisted: false,
      remote_sink_enabled: false,
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
      mutation_performed: false,
      ui_wired: false,
      runtime_wired: false,
    });
  }

  const manifest = parsed.data;
  const violations = collectViolations(manifest);

  return RoutinePrivacyManifestValidationSchema.parse({
    passed: violations.length === 0,
    violations,
    allowed_field_count: manifest.allowed_telemetry_fields.length,
    forbidden_field_count: manifest.forbidden_telemetry_fields.length,
    raw_payload_forbidden_count: manifest.raw_payload_forbidden_list.length,
    disabled_feature_count: ROUTINE_PRIVACY_DISABLED_FEATURES.length,
    enabled_disabled_feature_count: enabledDisabledFeatureCount(
      manifest.disabled_features,
    ),
    metadata_only: true,
    counts_and_flags_only: true,
    telemetry_persisted: false,
    remote_sink_enabled: false,
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
    mutation_performed: false,
    ui_wired: false,
    runtime_wired: false,
  });
}

export function createRoutinePrivacyManifestTelemetryEvent(
  validationInput: RoutinePrivacyManifestValidation,
): RoutinePrivacyManifestTelemetryEvent {
  const validation =
    RoutinePrivacyManifestValidationSchema.parse(validationInput);
  return RoutinePrivacyManifestTelemetryEventSchema.parse({
    event_type: "routine_privacy_manifest_validated",
    passed: validation.passed,
    violation_count: validation.violations.length,
    allowed_field_count: validation.allowed_field_count,
    forbidden_field_count: validation.forbidden_field_count,
    raw_payload_forbidden_count: validation.raw_payload_forbidden_count,
    enabled_disabled_feature_count: validation.enabled_disabled_feature_count,
    metadata_only: true,
    counts_and_flags_only: true,
    telemetry_persisted: false,
    remote_sink_enabled: false,
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
    mutation_performed: false,
    ui_wired: false,
    runtime_wired: false,
  });
}
