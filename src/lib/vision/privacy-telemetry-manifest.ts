import { z } from "zod";

export const VISION_MANIFEST_PHASES = [
  "sessions",
  "frame_ingestion",
  "provider_contracts",
  "observations",
  "context_assembly",
  "fallback_governance",
  "runtime_boundary_guard",
  "failure_replay",
] as const;

export const VISION_MANIFEST_ALLOWED_TELEMETRY_FIELDS = [
  "event_type",
  "session_id_hash",
  "frame_id",
  "vision_session_id",
  "provider_id",
  "operation_class",
  "decision",
  "reason",
  "confidence_band",
  "result_class",
  "observation_class",
  "counts",
  "duration_ms",
  "stale_count",
  "truncated",
  "metadata_only",
] as const;

export const VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES = [
  "raw_frame",
  "raw_image",
  "ocr_text",
  "screen_content",
  "person_identity",
  "face_identity",
  "biometric_attribute",
  "coordinates",
  "file_path",
  "base64",
  "blob",
] as const;

export const VISION_MANIFEST_ALLOWED_REPLAY_NODE_CLASSES = [
  "input",
  "provider",
  "confidence",
  "fallback_gate",
  "output",
  "action_gate",
  "result",
  "observation",
  "context",
  "boundary",
  "manifest",
] as const;

export const VISION_MANIFEST_ALLOWED_REPLAY_EDGE_CLASSES = [
  "to_provider",
  "scored",
  "gated",
  "selected",
  "action_gate",
  "result",
  "observed",
  "assembled",
  "guarded",
  "audited",
] as const;

export const VISION_MANIFEST_DISABLED_FEATURES = [
  "capture",
  "raw_storage",
  "provider_execution",
  "model_loading",
  "cloud_calls",
  "api_routes",
  "runtime_tools",
  "approval_granting",
  "memory_mutation",
  "project_mutation",
  "environment_mutation",
  "background_jobs",
  "ui_replay_renderer",
] as const;

export const VISION_MANIFEST_VIOLATION_CODES = [
  "raw_payload_allowed",
  "required_forbidden_payload_missing",
  "replay_graph_executable",
  "replay_not_diagnostic_only",
  "replay_raw_payload_storage_enabled",
  "disabled_feature_enabled",
] as const;

export const VISION_MANIFEST_TELEMETRY_EVENT_TYPES = [
  "vision_manifest_audited",
] as const;

export type VisionManifestPhase = (typeof VISION_MANIFEST_PHASES)[number];
export type VisionManifestAllowedTelemetryField =
  (typeof VISION_MANIFEST_ALLOWED_TELEMETRY_FIELDS)[number];
export type VisionManifestForbiddenPayloadClass =
  (typeof VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES)[number];
export type VisionManifestAllowedReplayNodeClass =
  (typeof VISION_MANIFEST_ALLOWED_REPLAY_NODE_CLASSES)[number];
export type VisionManifestAllowedReplayEdgeClass =
  (typeof VISION_MANIFEST_ALLOWED_REPLAY_EDGE_CLASSES)[number];
export type VisionManifestDisabledFeature =
  (typeof VISION_MANIFEST_DISABLED_FEATURES)[number];
export type VisionManifestViolationCode =
  (typeof VISION_MANIFEST_VIOLATION_CODES)[number];
export type VisionManifestTelemetryEventType =
  (typeof VISION_MANIFEST_TELEMETRY_EVENT_TYPES)[number];

const ManifestStringSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const VisionManifestPhaseSchema = z.enum(VISION_MANIFEST_PHASES);
export const VisionManifestAllowedTelemetryFieldSchema = z.enum(
  VISION_MANIFEST_ALLOWED_TELEMETRY_FIELDS,
);
export const VisionManifestForbiddenPayloadClassSchema = z.enum(
  VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES,
);
export const VisionManifestAllowedReplayNodeClassSchema = z.enum(
  VISION_MANIFEST_ALLOWED_REPLAY_NODE_CLASSES,
);
export const VisionManifestAllowedReplayEdgeClassSchema = z.enum(
  VISION_MANIFEST_ALLOWED_REPLAY_EDGE_CLASSES,
);
export const VisionManifestDisabledFeatureSchema = z.enum(
  VISION_MANIFEST_DISABLED_FEATURES,
);
export const VisionManifestViolationCodeSchema = z.enum(
  VISION_MANIFEST_VIOLATION_CODES,
);
export const VisionManifestTelemetryEventTypeSchema = z.enum(
  VISION_MANIFEST_TELEMETRY_EVENT_TYPES,
);

export const VisionRedactionPolicyManifestSchema = z.strictObject({
  allowed_telemetry_fields: z.array(ManifestStringSchema),
  forbidden_telemetry_fields: z.array(ManifestStringSchema),
  raw_payload_forbidden: z.array(ManifestStringSchema),
  metadata_only_required: z.boolean(),
});

export const VisionReplayGraphManifestSchema = z.strictObject({
  node_classes_allowed: z.array(ManifestStringSchema),
  edge_classes_allowed: z.array(ManifestStringSchema),
  forbidden_payload_classes: z.array(ManifestStringSchema),
  executable: z.boolean(),
  diagnostic_only: z.boolean(),
  stores_raw_frames: z.boolean(),
  stores_ocr_text: z.boolean(),
  stores_screen_content: z.boolean(),
  stores_person_or_coordinate_payloads: z.boolean(),
});

export const VisionDeveloperObservabilityManifestSchema = z.strictObject({
  safe_to_inspect: z.array(ManifestStringSchema),
  never_show_or_store: z.array(ManifestStringSchema),
  metadata_only_diagnostics: z.boolean(),
});

export const VisionDisabledFeatureManifestSchema = z.object(
  Object.fromEntries(
    VISION_MANIFEST_DISABLED_FEATURES.map((feature) => [feature, z.boolean()]),
  ) as Record<VisionManifestDisabledFeature, z.ZodBoolean>,
);

export const VisionPrivacyTelemetryManifestSchema = z.strictObject({
  manifest_version: z.literal("phase_7h"),
  phases: z.array(VisionManifestPhaseSchema),
  redaction_policy: VisionRedactionPolicyManifestSchema,
  replay_graph: VisionReplayGraphManifestSchema,
  developer_observability: VisionDeveloperObservabilityManifestSchema,
  disabled_features: VisionDisabledFeatureManifestSchema,
  derived: z.literal(true),
  advisory_only: z.literal(true),
  authoritative: z.literal(false),
  metadata_only: z.literal(true),
  hidden_writes: z.boolean(),
  telemetry_persistence: z.boolean(),
  cloud_export: z.boolean(),
  runtime_actions: z.boolean(),
  approval_granting: z.boolean(),
});

export const VisionPrivacyTelemetryManifestValidationSchema = z.strictObject({
  kind: z.literal("vision.manifest_validation"),
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(VisionManifestViolationCodeSchema),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  writes_performed: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export const VisionManifestTelemetryEventSchema = z.strictObject({
  event_type: VisionManifestTelemetryEventTypeSchema,
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  disabled_feature_count: z.number().int().nonnegative(),
  forbidden_payload_count: z.number().int().nonnegative(),
  phase_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_payload_included: z.literal(false),
  telemetry_persisted: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
});

export const VisionManifestReplayStepSchema = z.strictObject({
  manifest_version: z.literal("phase_7h"),
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  phase_count: z.number().int().nonnegative(),
  disabled_feature_count: z.number().int().nonnegative(),
  diagnostic_only: z.literal(true),
  executable: z.literal(false),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  telemetry_persisted: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export type VisionRedactionPolicyManifest = z.infer<
  typeof VisionRedactionPolicyManifestSchema
>;
export type VisionReplayGraphManifest = z.infer<
  typeof VisionReplayGraphManifestSchema
>;
export type VisionDeveloperObservabilityManifest = z.infer<
  typeof VisionDeveloperObservabilityManifestSchema
>;
export type VisionDisabledFeatureManifest = z.infer<
  typeof VisionDisabledFeatureManifestSchema
>;
export type VisionPrivacyTelemetryManifest = z.infer<
  typeof VisionPrivacyTelemetryManifestSchema
>;
export type VisionPrivacyTelemetryManifestValidation = z.infer<
  typeof VisionPrivacyTelemetryManifestValidationSchema
>;
export type VisionManifestTelemetryEvent = z.infer<
  typeof VisionManifestTelemetryEventSchema
>;
export type VisionManifestReplayStep = z.infer<
  typeof VisionManifestReplayStepSchema
>;

export function createDefaultVisionPrivacyTelemetryManifest(): VisionPrivacyTelemetryManifest {
  return VisionPrivacyTelemetryManifestSchema.parse({
    manifest_version: "phase_7h",
    phases: [...VISION_MANIFEST_PHASES],
    redaction_policy: {
      allowed_telemetry_fields: [...VISION_MANIFEST_ALLOWED_TELEMETRY_FIELDS],
      forbidden_telemetry_fields: [
        ...VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES,
      ],
      raw_payload_forbidden: [...VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES],
      metadata_only_required: true,
    },
    replay_graph: {
      node_classes_allowed: [...VISION_MANIFEST_ALLOWED_REPLAY_NODE_CLASSES],
      edge_classes_allowed: [...VISION_MANIFEST_ALLOWED_REPLAY_EDGE_CLASSES],
      forbidden_payload_classes: [...VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES],
      executable: false,
      diagnostic_only: true,
      stores_raw_frames: false,
      stores_ocr_text: false,
      stores_screen_content: false,
      stores_person_or_coordinate_payloads: false,
    },
    developer_observability: {
      safe_to_inspect: [
        "counts",
        "classes",
        "hashes",
        "confidence_bands",
        "decisions",
        "durations",
        "redaction_status",
      ],
      never_show_or_store: [...VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES],
      metadata_only_diagnostics: true,
    },
    disabled_features: Object.fromEntries(
      VISION_MANIFEST_DISABLED_FEATURES.map((feature) => [feature, false]),
    ),
    derived: true,
    advisory_only: true,
    authoritative: false,
    metadata_only: true,
    hidden_writes: false,
    telemetry_persistence: false,
    cloud_export: false,
    runtime_actions: false,
    approval_granting: false,
  });
}

function addViolation(
  violations: Set<VisionManifestViolationCode>,
  code: VisionManifestViolationCode,
): void {
  violations.add(code);
}

export function validateVisionPrivacyTelemetryManifest(
  manifestInput: VisionPrivacyTelemetryManifest,
): VisionPrivacyTelemetryManifestValidation {
  const manifest = VisionPrivacyTelemetryManifestSchema.parse(manifestInput);
  const violations = new Set<VisionManifestViolationCode>();
  const forbidden = new Set(VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES);

  for (const field of manifest.redaction_policy.allowed_telemetry_fields) {
    if (forbidden.has(field as VisionManifestForbiddenPayloadClass)) {
      addViolation(violations, "raw_payload_allowed");
    }
  }
  for (const payload of VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES) {
    if (!manifest.redaction_policy.raw_payload_forbidden.includes(payload)) {
      addViolation(violations, "required_forbidden_payload_missing");
    }
    if (!manifest.replay_graph.forbidden_payload_classes.includes(payload)) {
      addViolation(violations, "required_forbidden_payload_missing");
    }
  }
  if (manifest.replay_graph.executable) {
    addViolation(violations, "replay_graph_executable");
  }
  if (!manifest.replay_graph.diagnostic_only) {
    addViolation(violations, "replay_not_diagnostic_only");
  }
  if (
    manifest.replay_graph.stores_raw_frames ||
    manifest.replay_graph.stores_ocr_text ||
    manifest.replay_graph.stores_screen_content ||
    manifest.replay_graph.stores_person_or_coordinate_payloads
  ) {
    addViolation(violations, "replay_raw_payload_storage_enabled");
  }
  for (const feature of VISION_MANIFEST_DISABLED_FEATURES) {
    if (manifest.disabled_features[feature]) {
      addViolation(violations, "disabled_feature_enabled");
    }
  }
  if (
    manifest.hidden_writes ||
    manifest.telemetry_persistence ||
    manifest.cloud_export ||
    manifest.runtime_actions ||
    manifest.approval_granting
  ) {
    addViolation(violations, "disabled_feature_enabled");
  }

  return VisionPrivacyTelemetryManifestValidationSchema.parse({
    kind: "vision.manifest_validation",
    pass: violations.size === 0,
    violation_count: violations.size,
    violations: [...violations],
    metadata_only: true,
    raw_payload_included: false,
    writes_performed: false,
    cloud_called: false,
    action_executed: false,
  });
}

export function createVisionManifestTelemetryEvent(
  manifestInput: VisionPrivacyTelemetryManifest,
): VisionManifestTelemetryEvent {
  const manifest = VisionPrivacyTelemetryManifestSchema.parse(manifestInput);
  const validation = validateVisionPrivacyTelemetryManifest(manifest);
  return VisionManifestTelemetryEventSchema.parse({
    event_type: "vision_manifest_audited",
    pass: validation.pass,
    violation_count: validation.violation_count,
    disabled_feature_count: VISION_MANIFEST_DISABLED_FEATURES.length,
    forbidden_payload_count: VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES.length,
    phase_count: manifest.phases.length,
    metadata_only: true,
    counts_and_flags_only: true,
    raw_payload_included: false,
    telemetry_persisted: false,
    cloud_called: false,
    action_executed: false,
    approval_granted: false,
  });
}

export function createVisionManifestReplayStep(
  manifestInput: VisionPrivacyTelemetryManifest,
): VisionManifestReplayStep {
  const manifest = VisionPrivacyTelemetryManifestSchema.parse(manifestInput);
  const validation = validateVisionPrivacyTelemetryManifest(manifest);
  return VisionManifestReplayStepSchema.parse({
    manifest_version: manifest.manifest_version,
    pass: validation.pass,
    violation_count: validation.violation_count,
    phase_count: manifest.phases.length,
    disabled_feature_count: VISION_MANIFEST_DISABLED_FEATURES.length,
    diagnostic_only: true,
    executable: false,
    metadata_only: true,
    raw_payload_included: false,
    telemetry_persisted: false,
    cloud_called: false,
    action_executed: false,
  });
}
