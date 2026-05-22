import { describe, expect, it } from "vitest";
import {
  VISION_AUDIT_CATEGORIES,
  VISION_AUDIT_MODULES,
  VisionAuditGateResultSchema,
  createDefaultVisionPrivacyTelemetryManifest,
  createVisionAuditGateReplayStep,
  createVisionAuditGateTelemetryEvent,
  evaluateVisionAuditGate,
} from "./index";

describe("Phase 7I vision audit and developer observability gate", () => {
  it("passes for the default safe Phase 7 scaffold", () => {
    const result = evaluateVisionAuditGate();

    expect(result).toMatchObject({
      kind: "vision.audit_gate_result",
      pass: true,
      violations: [],
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
    expect(result.disabled_feature_status).toMatchObject({
      enabled_count: 0,
      all_disabled: true,
    });
    expect(Object.values(result.categories_passed).every(Boolean)).toBe(true);
  });

  it("fails if raw payload, capture, cloud, action, approval, mutation, or background flags are enabled", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const result = evaluateVisionAuditGate({
      manifest: {
        ...manifest,
        redaction_policy: {
          ...manifest.redaction_policy,
          allowed_telemetry_fields: [
            ...manifest.redaction_policy.allowed_telemetry_fields,
            "raw_frame",
          ],
        },
        disabled_features: {
          ...manifest.disabled_features,
          capture: true,
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
      },
    });

    expect(result.pass).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "manifest_validation_failed",
        "disabled_feature_enabled",
        "category_failed",
      ]),
    );
    expect(result.disabled_feature_status.enabled_count).toBeGreaterThan(0);
    expect(result.categories_passed.no_raw_payloads).toBe(true);
    expect(result.categories_passed.no_capture).toBe(false);
    expect(result.categories_passed.no_cloud_calls).toBe(false);
    expect(result.categories_passed.no_runtime_actions).toBe(false);
    expect(result.categories_passed.no_approval_granting).toBe(false);
    expect(result.categories_passed.no_mutations).toBe(false);
    expect(result.categories_passed.no_background_jobs).toBe(false);
  });

  it("fails if replay graph is executable", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const result = evaluateVisionAuditGate({
      manifest: {
        ...manifest,
        replay_graph: {
          ...manifest.replay_graph,
          executable: true,
        },
      },
    });

    expect(result.pass).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "manifest_validation_failed",
        "replay_graph_executable",
        "category_failed",
      ]),
    );
    expect(result.categories_passed.graph_non_executable).toBe(false);
  });

  it("fails if developer observability exposes raw payload fields", () => {
    const manifest = createDefaultVisionPrivacyTelemetryManifest();
    const result = evaluateVisionAuditGate({
      manifest: {
        ...manifest,
        developer_observability: {
          ...manifest.developer_observability,
          safe_to_inspect: [
            ...manifest.developer_observability.safe_to_inspect,
            "ocr_text",
          ],
        },
      },
    });

    expect(result.pass).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "developer_observability_unsafe",
        "category_failed",
      ]),
    );
    expect(result.categories_passed.developer_observability_safe).toBe(false);
  });

  it("returns audit output with counts and flags only", () => {
    const result = evaluateVisionAuditGate();
    const event = createVisionAuditGateTelemetryEvent(result);

    expect(event).toEqual({
      event_type: "vision_audit_gate_evaluated",
      pass: true,
      violation_count: 0,
      warning_count: 1,
      required_module_count: VISION_AUDIT_MODULES.length,
      covered_module_count: VISION_AUDIT_MODULES.length,
      missing_module_count: 0,
      category_count: VISION_AUDIT_CATEGORIES.length,
      disabled_feature_enabled_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      raw_payload_included: false,
      cloud_called: false,
      action_executed: false,
      approval_granted: false,
      mutation_performed: false,
      telemetry_persisted: false,
    });
    expect(JSON.stringify(event)).not.toContain("raw_frame");
    expect(JSON.stringify(event)).not.toContain("ocr_text");
  });

  it("represents every Phase 7 module in audit coverage", () => {
    const result = evaluateVisionAuditGate();

    expect(result.module_coverage.required_modules).toEqual([
      "sessions",
      "frame_ingestion",
      "provider_contracts",
      "observations",
      "context_assembly",
      "fallback_governance",
      "runtime_boundary_guard",
      "failure_replay",
      "privacy_telemetry_manifest",
    ]);
    expect(result.module_coverage.covered_modules).toEqual(
      result.module_coverage.required_modules,
    );
    expect(result.module_coverage.missing_count).toBe(0);
  });

  it("fails when module coverage is missing", () => {
    const result = evaluateVisionAuditGate({
      covered_modules: ["sessions", "frame_ingestion"],
    });

    expect(result.pass).toBe(false);
    expect(result.violations).toContain("module_coverage_missing");
    expect(result.module_coverage.missing_count).toBeGreaterThan(0);
  });

  it("summarizes developer observability without raw inspection", () => {
    const result = evaluateVisionAuditGate();

    expect(result.developer_observability).toMatchObject({
      safe_inspectable_fields: [
        "counts",
        "classes",
        "hashes",
        "confidence_bands",
        "decisions",
        "durations",
        "redaction_status",
      ],
      raw_payload_inspection_allowed: false,
      metadata_only: true,
    });
    expect(result.developer_observability.forbidden_fields).toEqual(
      expect.arrayContaining(["raw_frame", "ocr_text", "screen_content"]),
    );
  });

  it("creates metadata-only failure replay audit steps", () => {
    const step = createVisionAuditGateReplayStep(evaluateVisionAuditGate());

    expect(step).toEqual({
      pass: true,
      violation_count: 0,
      warning_count: 1,
      covered_module_count: VISION_AUDIT_MODULES.length,
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
  });

  it("cannot represent runtime side effects in audit results", () => {
    const result = evaluateVisionAuditGate();

    expect(
      VisionAuditGateResultSchema.safeParse({
        ...result,
        cloud_called: true,
        action_executed: true,
        approval_granted: true,
        mutation_performed: true,
        telemetry_persisted: true,
        background_job_started: true,
      }).success,
    ).toBe(false);
  });
});
