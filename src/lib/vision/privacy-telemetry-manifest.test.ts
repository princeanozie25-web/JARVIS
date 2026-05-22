import { describe, expect, it } from "vitest";
import {
  VISION_MANIFEST_DISABLED_FEATURES,
  VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES,
  VisionManifestTelemetryEventSchema,
  createDefaultVisionPrivacyTelemetryManifest,
  createVisionManifestReplayStep,
  createVisionManifestTelemetryEvent,
  validateVisionPrivacyTelemetryManifest,
} from "./index";

describe("Phase 7H vision privacy telemetry manifest", () => {
  it("passes when all safety flags are disabled/default safe", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const validation = validateVisionPrivacyTelemetryManifest(manifest);

    expect(validation).toEqual({
      kind: "vision.manifest_validation",
      pass: true,
      violation_count: 0,
      violations: [],
      metadata_only: true,
      raw_payload_included: false,
      writes_performed: false,
      cloud_called: false,
      action_executed: false,
    });
    expect(manifest).toMatchObject({
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
  });

  it("fails if raw payload fields are allowed in telemetry", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const validation = validateVisionPrivacyTelemetryManifest({
      ...manifest,
      redaction_policy: {
        ...manifest.redaction_policy,
        allowed_telemetry_fields: [
          ...manifest.redaction_policy.allowed_telemetry_fields,
          "raw_frame",
        ],
      },
    });

    expect(validation).toMatchObject({
      pass: false,
      violations: ["raw_payload_allowed"],
      raw_payload_included: false,
    });
  });

  it("fails if replay graph is executable", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const validation = validateVisionPrivacyTelemetryManifest({
      ...manifest,
      replay_graph: {
        ...manifest.replay_graph,
        executable: true,
      },
    });

    expect(validation).toMatchObject({
      pass: false,
      violations: ["replay_graph_executable"],
      action_executed: false,
    });
  });

  it("fails if replay stores raw frame, OCR, screen, person, or coordinate payloads", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const validation = validateVisionPrivacyTelemetryManifest({
      ...manifest,
      replay_graph: {
        ...manifest.replay_graph,
        stores_raw_frames: true,
        stores_ocr_text: true,
        stores_screen_content: true,
        stores_person_or_coordinate_payloads: true,
      },
    });

    expect(validation).toMatchObject({
      pass: false,
      violations: ["replay_raw_payload_storage_enabled"],
      raw_payload_included: false,
    });
  });

  it("fails if cloud/action/approval/mutation/background flags are enabled", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const validation = validateVisionPrivacyTelemetryManifest({
      ...manifest,
      disabled_features: {
        ...manifest.disabled_features,
        cloud_calls: true,
        runtime_tools: true,
        approval_granting: true,
        memory_mutation: true,
        project_mutation: true,
        environment_mutation: true,
        background_jobs: true,
      },
      cloud_export: true,
      runtime_actions: true,
      approval_granting: true,
    });

    expect(validation).toMatchObject({
      pass: false,
      violations: ["disabled_feature_enabled"],
      writes_performed: false,
      cloud_called: false,
      action_executed: false,
    });
  });

  it("emits telemetry with counts and flags only", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const event = createVisionManifestTelemetryEvent(manifest);

    expect(event).toEqual({
      event_type: "vision_manifest_audited",
      pass: true,
      violation_count: 0,
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
    expect(JSON.stringify(event)).not.toContain("raw_frame");
    expect(JSON.stringify(event)).not.toContain("ocr_text");
  });

  it("allows metadata developer observability while forbidding raw inspection", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();

    expect(manifest.developer_observability.safe_to_inspect).toEqual([
      "counts",
      "classes",
      "hashes",
      "confidence_bands",
      "decisions",
      "durations",
      "redaction_status",
    ]);
    expect(manifest.developer_observability.never_show_or_store).toEqual([
      ...VISION_MANIFEST_FORBIDDEN_PAYLOAD_CLASSES,
    ]);
    expect(manifest.developer_observability.metadata_only_diagnostics).toBe(
      true,
    );
  });

  it("creates metadata-only diagnostic replay manifest steps", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const step = createVisionManifestReplayStep(manifest);

    expect(step).toEqual({
      manifest_version: "phase_7h",
      pass: true,
      violation_count: 0,
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
    expect(JSON.stringify(step)).not.toContain("raw_image");
    expect(JSON.stringify(step)).not.toContain("screen_content");
  });

  it("cannot represent telemetry persistence or side effects in audit events", () => {
    const event = createVisionManifestTelemetryEvent(
      createDefaultVisionPrivacyTelemetryManifest(),
    );

    expect(
      VisionManifestTelemetryEventSchema.safeParse({
        ...event,
        telemetry_persisted: true,
        cloud_called: true,
        action_executed: true,
        approval_granted: true,
      }).success,
    ).toBe(false);
  });
});
