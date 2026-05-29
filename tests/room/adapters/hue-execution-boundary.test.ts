import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHueExecutionAuditPreview,
  evaluateHueExecutionBoundary,
  type HueExecutionApprovalMetadata,
  type HueExecutionApprovalStatus,
} from "../../../src/room/adapters/hue-execution-boundary";
import {
  buildHueDryRunAuditPreview,
  createHueDryRunPlan,
} from "../../../src/room/adapters/hue-dry-run";
import { mapHueLightPayloadToReadSnapshot } from "../../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16D Hue approval-gated execution boundary scaffold", () => {
  it.each([
    ["missing", undefined, "approval_missing"],
    ["pending", { approval_status: "pending" }, "approval_pending"],
    ["approved", { approval_status: "approved" }, "execution_not_implemented"],
    ["denied", { approval_status: "denied" }, "approval_denied"],
    ["expired", { approval_status: "expired" }, "approval_expired"],
    ["unsupported", { approval_status: "unsupported" }, "approval_unsupported"],
  ] as const)(
    "denies %s approval metadata before execution",
    (_label, approval, reason) => {
      const decision = evaluateHueExecutionBoundary(
        createPlan(),
        approval as HueExecutionApprovalMetadata | undefined,
      );

      expect(decision).toMatchObject({
        source_plan_id: "hue-dry-run-execution-boundary",
        adapter_kind: "hue",
        mode: "approval_gated_execution",
        approval_required: true,
        approval_status: approval?.approval_status ?? "missing",
        execution_allowed: false,
        execution_supported: false,
        denial_reason: reason,
        verification_required: true,
        verification_supported: false,
        verification_read_required_after_execution: true,
        verification_source: "future_hue_read_only",
        verification_status: "unsupported",
        verification_reason: "execution_not_implemented",
        verification_error_class: "verification_not_implemented",
        verification_network_allowed: false,
        verification_persistence_supported: false,
        verification_read_performed: false,
        verification_persisted: false,
        audit_required: true,
        audit_supported: false,
        audit_payload_kind: "metadata_only",
        replay_safe: true,
        redaction_status: "redacted_metadata_only",
        persistence_attempted: false,
        event_store_write_supported: false,
        event_store_write_attempted: false,
        compensation_required_if_executed: true,
        compensation_available_from_plan: true,
        compensation_source: "dry_run_plan",
        compensation_execution_supported: false,
        compensation_execution_attempted: false,
        compensation_requires_approval: true,
        compensation_precondition_status: "satisfied",
        compensation_precondition_reason: "dry_run_compensation_available",
        compensation_precondition_error_class: null,
        failure_handling_required: true,
        failure_handling_supported: false,
        timeout_handling_required: true,
        timeout_ms: 10_000,
        timeout_policy: {
          timeout_ms: 10_000,
          source: "phase_16d_boundary_default",
          metadata_only: true,
        },
        timeout_supported: false,
        retry_supported: false,
        retry_attempted: false,
        fallback_supported: false,
        fallback_attempted: false,
        partial_success_handling_required: true,
        partial_success_handling_supported: false,
        boundary_error_reason: reason,
        network_allowed: false,
        writes_allowed: false,
        discovery_allowed: false,
        cloud_allowed: false,
        raw_payload_exposed: false,
        raw_config_exposed: false,
        raw_api_key_exposed: false,
        metadata_only: true,
      });
    },
  );

  it("still denies approved metadata because execution is not implemented", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_id: "approval-safe-id",
      approval_status: "approved",
      reviewed_at_ms: 1_000,
      metadata_only: true,
    });

    expect(decision).toMatchObject({
      execution_boundary_id:
        "hue-execution-boundary-hue-dry-run-execution-boundary",
      approval_id: "approval-safe-id",
      approval_status: "approved",
      execution_allowed: false,
      execution_supported: false,
      denial_reason: "execution_not_implemented",
      verification_required: true,
      verification_supported: false,
      verification_read_required_after_execution: true,
      verification_source: "future_hue_read_only",
      verification_status: "unsupported",
      actual_post_state: {
        status: "unavailable",
        reason: "execution_not_performed",
        metadata_only: true,
        raw_payload_exposed: false,
      },
      network_allowed: false,
      writes_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      network_called: false,
      writes_attempted: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      compensation_available_from_plan: true,
      compensation_precondition_status: "satisfied",
      compensation_execution_attempted: false,
      failure_handling_required: true,
      failure_handling_supported: false,
      timeout_handling_required: true,
      timeout_supported: false,
      retry_supported: false,
      retry_attempted: false,
      fallback_supported: false,
      fallback_attempted: false,
      partial_success_handling_required: true,
      partial_success_handling_supported: false,
      boundary_error_class: "execution_not_implemented",
      boundary_error_reason: "execution_not_implemented",
      persisted: false,
      ui_rendered: false,
    });
  });

  it("derives expected post-state from intended dry-run state without reading actual state", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_status: "approved",
    });

    expect(decision.expected_post_state).toEqual({
      target_light_id: "execution-boundary-light",
      derived_from: "intended_dry_run_state",
      intended_state: {
        on: true,
        brightness_percent: 60,
      },
      metadata_only: true,
      raw_payload_exposed: false,
    });
    expect(decision.actual_post_state).toEqual({
      status: "unavailable",
      reason: "execution_not_performed",
      metadata_only: true,
      raw_payload_exposed: false,
    });
    expect(decision).toMatchObject({
      verification_network_allowed: false,
      verification_persistence_supported: false,
      verification_read_performed: false,
      verification_persisted: false,
      hardware_io_performed: false,
      persisted: false,
    });
  });

  it("models failure, timeout, retry, fallback, and partial-success handling without activating them", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_status: "approved",
    });

    expect(decision).toMatchObject({
      execution_allowed: false,
      failure_handling_required: true,
      failure_handling_supported: false,
      timeout_handling_required: true,
      timeout_ms: 10_000,
      timeout_policy: {
        timeout_ms: 10_000,
        source: "phase_16d_boundary_default",
        metadata_only: true,
      },
      timeout_supported: false,
      retry_supported: false,
      retry_attempted: false,
      fallback_supported: false,
      fallback_attempted: false,
      partial_success_handling_required: true,
      partial_success_handling_supported: false,
      boundary_error_class: "execution_not_implemented",
      boundary_error_reason: "execution_not_implemented",
      network_called: false,
      writes_attempted: false,
      hardware_io_performed: false,
    });
  });

  it("makes every boundary decision audit-shaped with provenance metadata", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_status: "pending",
    });

    expect(decision).toMatchObject({
      audit_required: true,
      audit_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      provenance: {
        execution_boundary_id:
          "hue-execution-boundary-hue-dry-run-execution-boundary",
        source_plan_id: "hue-dry-run-execution-boundary",
        adapter_kind: "hue",
        mode: "approval_gated_execution",
        target_light_id: "execution-boundary-light",
        approval_status: "pending",
        verification_required: true,
        metadata_only: true,
      },
    });
  });

  it("builds metadata-only replay-safe audit preview without persistence", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_id: "approval-safe-id",
      approval_status: "approved",
    });
    const preview = buildHueExecutionAuditPreview(decision);

    expect(preview).toEqual({
      preview_kind: "hue_execution_audit_preview",
      audit_required: true,
      audit_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      provenance: {
        execution_boundary_id:
          "hue-execution-boundary-hue-dry-run-execution-boundary",
        source_plan_id: "hue-dry-run-execution-boundary",
        adapter_kind: "hue",
        mode: "approval_gated_execution",
        target_light_id: "execution-boundary-light",
        approval_status: "approved",
        verification_required: true,
        metadata_only: true,
      },
      denial_reason: "execution_not_implemented",
      execution_allowed: false,
      execution_supported: false,
      verification_required: true,
      verification_supported: false,
      compensation_available_from_plan: true,
      compensation_precondition_status: "satisfied",
      compensation_execution_supported: false,
      compensation_execution_attempted: false,
      failure_handling_required: true,
      failure_handling_supported: false,
      timeout_handling_required: true,
      timeout_supported: false,
      retry_supported: false,
      retry_attempted: false,
      fallback_supported: false,
      fallback_attempted: false,
      partial_success_handling_required: true,
      partial_success_handling_supported: false,
      boundary_error_class: "execution_not_implemented",
      boundary_error_reason: "execution_not_implemented",
      raw_payload_exposed: false,
      raw_config_exposed: false,
      raw_api_key_exposed: false,
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      network_called: false,
      writes_attempted: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      ui_rendered: false,
      metadata_only: true,
    });
  });

  it("marks compensation preconditions satisfied when dry-run compensation is available", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_status: "approved",
    });

    expect(decision).toMatchObject({
      execution_allowed: false,
      denial_reason: "execution_not_implemented",
      compensation_required_if_executed: true,
      compensation_available_from_plan: true,
      compensation_source: "dry_run_plan",
      compensation_execution_supported: false,
      compensation_execution_attempted: false,
      compensation_requires_approval: true,
      compensation_precondition_status: "satisfied",
      compensation_precondition_reason: "dry_run_compensation_available",
      compensation_precondition_error_class: null,
    });
  });

  it("marks compensation preconditions unavailable when current state is unknown", () => {
    const decision = evaluateHueExecutionBoundary(createUnknownPlan(), {
      approval_status: "approved",
    });

    expect(decision).toMatchObject({
      execution_allowed: false,
      denial_reason: "execution_not_implemented",
      compensation_required_if_executed: true,
      compensation_available_from_plan: false,
      compensation_source: "unavailable",
      compensation_execution_supported: false,
      compensation_execution_attempted: false,
      compensation_requires_approval: false,
      compensation_precondition_status: "unavailable",
      compensation_precondition_reason: "dry_run_compensation_unavailable",
      compensation_precondition_error_class: "compensation_unavailable",
      retry_attempted: false,
      fallback_attempted: false,
      verification_supported: false,
      audit_supported: false,
    });
  });

  it("keeps dry-run plans non-executing and compensation descriptive-only", () => {
    const plan = createPlan();
    const decision = evaluateHueExecutionBoundary(plan, {
      approval_status: "approved",
    });

    expect(plan).toMatchObject({
      approval_required: true,
      approval_execution_supported: false,
      executable: false,
      execution_supported: false,
      network_called: false,
      writes_attempted: false,
      compensation: {
        compensation_available: true,
        compensation_execution_supported: false,
        compensation_requires_approval: true,
        compensation_plan: {
          descriptive_only: true,
          executable: false,
          execution_supported: false,
          rollback_execution_supported: false,
        },
      },
    });
    expect(decision).toMatchObject({
      dry_run_plan_executable: false,
      dry_run_execution_supported: false,
      compensation_execution_supported: false,
      compensation_execution_attempted: false,
      compensation_available_from_plan: true,
      compensation_source: "dry_run_plan",
      compensation_requires_approval: true,
      compensation_precondition_status: "satisfied",
      failure_handling_required: true,
      failure_handling_supported: false,
      timeout_handling_required: true,
      timeout_supported: false,
      retry_supported: false,
      retry_attempted: false,
      fallback_supported: false,
      fallback_attempted: false,
      partial_success_handling_required: true,
      partial_success_handling_supported: false,
      boundary_error_class: "execution_not_implemented",
      boundary_error_reason: "execution_not_implemented",
      compensation_required_if_executed: true,
      execution_allowed: false,
      execution_supported: false,
    });
  });

  it("keeps dry-run approval, compensation, and audit-preview metadata non-executing", () => {
    const plan = createPlan();
    const auditPreview = buildHueDryRunAuditPreview(plan);
    const decision = evaluateHueExecutionBoundary(plan, {
      approval_status: "approved",
    });

    expect(plan).toMatchObject({
      approval_flow_available: false,
      approval_execution_supported: false,
      executable: false,
      execution_supported: false,
      audit_event_supported: false,
      event_recording_supported: false,
      persistence_attempted: false,
    });
    expect(plan.compensation).toMatchObject({
      compensation_execution_supported: false,
      compensation_requires_approval: true,
    });
    expect(auditPreview).toMatchObject({
      audit_payload_kind: "metadata_only",
      event_recording_supported: false,
      persistence_attempted: false,
      ui_rendered: false,
    });
    expect(decision).toMatchObject({
      execution_allowed: false,
      verification_supported: false,
      verification_persistence_supported: false,
      audit_supported: false,
      event_store_write_attempted: false,
      compensation_execution_attempted: false,
      persisted: false,
    });
  });

  it("does not expose raw config, API key, or oversized approval payload fields", () => {
    const unsafeApproval = {
      approval_id: "approval-safe-id",
      approval_status: "approved" satisfies HueExecutionApprovalStatus,
      api_key: "secret-api-key",
      config_ref: "config_ref:hue.local.placeholder",
      raw_payload: { token: "secret-token" },
    } as unknown as HueExecutionApprovalMetadata;

    const json = JSON.stringify(
      evaluateHueExecutionBoundary(createPlan(), unsafeApproval),
    );

    expect(json).toContain("approval-safe-id");
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("config_ref:hue");
  });

  it("keeps Phase 16A/16B/16C guards pinned", () => {
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
      real_hue_writes_enabled: false,
      hue_auto_discovery_enabled: false,
      hue_cloud_remote_api_enabled: false,
      scenes_macros_enabled: false,
      scheduled_device_actions_enabled: false,
      voice_trust_class_elevation_enabled: false,
      runtime_trust_class_elevation_enabled: false,
      jarvis_policy_edits_enabled: false,
      multi_device_routines_enabled: false,
      real_hue_adapter_enabled: false,
      fake_conformance_required_before_real_hue: true,
      real_hue_adapter_requires_fake_conformance: true,
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
      persisted: false,
      ui_rendered: false,
    });
  });

  it("does not add SDK, network, discovery, cloud, or execution markers", () => {
    const packageJson = read("package.json");
    const hueSources = [
      read("src/room/adapters/hue-execution-boundary.ts"),
      read("src/room/adapters/hue-dry-run.ts"),
      read("src/room/adapters/hue-adapter.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSources).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });
});

function createPlan() {
  const current = mapHueLightPayloadToReadSnapshot({
    id: "execution-boundary-light",
    metadata: { name: "Execution Boundary Light" },
    on: { on: false },
    dimming: { brightness: 25 },
    status: { reachable: true },
    capabilities: ["on", "dimming"],
  });

  return createHueDryRunPlan({
    plan_id: "hue-dry-run-execution-boundary",
    target_light_id: "execution-boundary-light",
    current_state_snapshot: current,
    intended_state: {
      on: true,
      brightness_percent: 60,
    },
  });
}

function createUnknownPlan() {
  return createHueDryRunPlan({
    plan_id: "hue-dry-run-unknown-current",
    target_light_id: "unknown-current-light",
    intended_state: {
      on: true,
      brightness_percent: 30,
    },
  });
}

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
