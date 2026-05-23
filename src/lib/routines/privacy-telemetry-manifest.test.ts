import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST,
  RoutinePrivacyManifestTelemetryEventSchema,
  RoutinePrivacyTelemetryManifestSchema,
  createRoutinePrivacyManifestTelemetryEvent,
  validateRoutinePrivacyTelemetryManifest,
} from "./index";

function manifest(overrides = {}) {
  return {
    ...DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST,
    ...overrides,
  };
}

describe("Phase 8I.1 routine privacy telemetry manifest", () => {
  it("passes the default manifest", () => {
    const validation = validateRoutinePrivacyTelemetryManifest(
      DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST,
    );

    expect(validation).toMatchObject({
      passed: true,
      violations: [],
      allowed_field_count: 15,
      forbidden_field_count: 14,
      raw_payload_forbidden_count: 13,
      disabled_feature_count: 12,
      enabled_disabled_feature_count: 0,
      metadata_only: true,
      telemetry_persisted: false,
      remote_sink_enabled: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
    });
  });

  it("fails if any raw forbidden payload is allowed", () => {
    const validation = validateRoutinePrivacyTelemetryManifest({
      ...manifest(),
      allowed_telemetry_fields: [
        ...DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST.allowed_telemetry_fields,
        "raw_report_body",
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      violations: ["raw_payload_allowed"],
    });
  });

  it("fails if remote sink is enabled", () => {
    const disabledPosture = validateRoutinePrivacyTelemetryManifest({
      ...manifest(),
      storage_posture: {
        ...DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST.storage_posture,
        no_remote_sink: false,
      },
    });
    const remoteSink = validateRoutinePrivacyTelemetryManifest({
      ...manifest(),
      remote_sink_enabled: true,
    });

    expect(disabledPosture).toMatchObject({
      passed: false,
      violations: ["remote_sink_enabled"],
    });
    expect(remoteSink).toMatchObject({
      passed: false,
      violations: ["remote_sink_enabled"],
    });
  });

  it("fails if tool, action, approval, memory, mutation, cloud, background, or UI flags are enabled", () => {
    for (const feature of [
      "tool_calls",
      "approvals_granted",
      "actions_executed",
      "memory_writes",
      "mutations",
      "cloud_network",
      "background_jobs",
      "ui_runtime_wiring",
    ] as const) {
      const validation = validateRoutinePrivacyTelemetryManifest({
        ...manifest(),
        disabled_features: {
          ...DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST.disabled_features,
          [feature]: true,
        },
      });

      expect(validation).toMatchObject({
        passed: false,
        violations: ["disabled_feature_enabled"],
      });
    }
  });

  it("allows developer observability metadata only", () => {
    const validation = validateRoutinePrivacyTelemetryManifest(manifest());

    expect(
      DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST.developer_observability,
    ).toMatchObject({
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
    });
    expect(validation.passed).toBe(true);
    expect(
      RoutinePrivacyTelemetryManifestSchema.safeParse({
        ...manifest(),
        developer_observability: {
          ...DEFAULT_ROUTINE_PRIVACY_TELEMETRY_MANIFEST.developer_observability,
          raw_payload_inspection_allowed: true,
        },
      }).success,
    ).toBe(false);
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const validation = validateRoutinePrivacyTelemetryManifest(manifest());
    const telemetry = createRoutinePrivacyManifestTelemetryEvent(validation);

    expect(telemetry).toEqual({
      event_type: "routine_privacy_manifest_validated",
      passed: true,
      violation_count: 0,
      allowed_field_count: 15,
      forbidden_field_count: 14,
      raw_payload_forbidden_count: 13,
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
    expect(
      RoutinePrivacyManifestTelemetryEventSchema.safeParse({
        ...telemetry,
        raw_report_body: "private",
      }).success,
    ).toBe(false);
    expect(
      RoutinePrivacyManifestTelemetryEventSchema.safeParse({
        ...telemetry,
        network_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, write, persistence, network, tool, action, UI, or runtime paths", () => {
    const validation = validateRoutinePrivacyTelemetryManifest(manifest());

    expect({
      dbRead: validation.db_read_performed,
      dbWrite: validation.db_write_performed,
      telemetryPersisted: validation.telemetry_persisted,
      remoteSink: validation.remote_sink_enabled,
      providerCalled: validation.provider_called,
      llmCalled: validation.llm_called,
      networkCalled: validation.network_called,
      cloudCalled: validation.cloud_called,
      toolCalled: validation.tool_called,
      actionExecuted: validation.action_executed,
      approvalGranted: validation.approval_granted,
      memoryWritten: validation.memory_written,
      mutationPerformed: validation.mutation_performed,
      uiWired: validation.ui_wired,
      runtimeWired: validation.runtime_wired,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      telemetryPersisted: false,
      remoteSink: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalGranted: false,
      memoryWritten: false,
      mutationPerformed: false,
      uiWired: false,
      runtimeWired: false,
    });
  });
});
