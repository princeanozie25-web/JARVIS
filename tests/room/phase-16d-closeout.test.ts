import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHueExecutionAuditPreview,
  evaluateHueExecutionBoundary,
  type HueExecutionApprovalMetadata,
} from "../../src/room/adapters/hue-execution-boundary";
import { createHueDryRunPlan } from "../../src/room/adapters/hue-dry-run";
import { mapHueLightPayloadToReadSnapshot } from "../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16D.6 Hue execution boundary closeout guard", () => {
  it("proves the execution boundary evaluator denies every approval state", () => {
    for (const [approval, reason] of [
      [undefined, "approval_missing"],
      [{ approval_status: "missing" }, "approval_missing"],
      [{ approval_status: "pending" }, "approval_pending"],
      [{ approval_status: "approved" }, "execution_not_implemented"],
      [{ approval_status: "denied" }, "approval_denied"],
      [{ approval_status: "expired" }, "approval_expired"],
      [{ approval_status: "unsupported" }, "approval_unsupported"],
    ] as const) {
      const decision = evaluateHueExecutionBoundary(
        createKnownPlan(),
        approval as HueExecutionApprovalMetadata | undefined,
      );

      expect(decision).toMatchObject({
        execution_allowed: false,
        execution_supported: false,
        denial_reason: reason,
        network_allowed: false,
        writes_allowed: false,
        discovery_allowed: false,
        cloud_allowed: false,
        network_called: false,
        writes_attempted: false,
        discovery_attempted: false,
        cloud_attempted: false,
        hardware_io_performed: false,
        metadata_only: true,
      });
    }
  });

  it("proves approved metadata remains non-executing and verification-aware", () => {
    const decision = evaluateHueExecutionBoundary(createKnownPlan(), {
      approval_id: "approval-closeout-safe",
      approval_status: "approved",
      metadata_only: true,
    });

    expect(decision).toMatchObject({
      adapter_kind: "hue",
      mode: "approval_gated_execution",
      approval_required: true,
      approval_status: "approved",
      denial_reason: "execution_not_implemented",
      boundary_error_class: "execution_not_implemented",
      verification_required: true,
      verification_supported: false,
      verification_read_required_after_execution: true,
      verification_source: "future_hue_read_only",
      verification_read_performed: false,
      expected_post_state: {
        target_light_id: "phase-16d-closeout-light",
        derived_from: "intended_dry_run_state",
        intended_state: {
          on: true,
          brightness_percent: 70,
        },
        metadata_only: true,
        raw_payload_exposed: false,
      },
      actual_post_state: {
        status: "unavailable",
        reason: "execution_not_performed",
        metadata_only: true,
      },
    });
  });

  it("proves audit preview is metadata-only, replay-safe, and non-persisting", () => {
    const decision = evaluateHueExecutionBoundary(createKnownPlan(), {
      approval_status: "approved",
    });
    const preview = buildHueExecutionAuditPreview(decision);

    expect(decision).toMatchObject({
      audit_required: true,
      audit_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      persistence_attempted: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
    });
    expect(preview).toMatchObject({
      preview_kind: "hue_execution_audit_preview",
      audit_required: true,
      audit_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      persistence_attempted: false,
      metadata_only: true,
    });
  });

  it("proves compensation and failure-mode handling are required but non-executing", () => {
    const known = evaluateHueExecutionBoundary(createKnownPlan(), {
      approval_status: "approved",
    });
    const unknown = evaluateHueExecutionBoundary(createUnknownPlan(), {
      approval_status: "approved",
    });

    expect(known).toMatchObject({
      compensation_required_if_executed: true,
      compensation_available_from_plan: true,
      compensation_source: "dry_run_plan",
      compensation_execution_supported: false,
      compensation_execution_attempted: false,
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
    });
    expect(unknown).toMatchObject({
      compensation_required_if_executed: true,
      compensation_available_from_plan: false,
      compensation_source: "unavailable",
      compensation_execution_supported: false,
      compensation_execution_attempted: false,
      compensation_requires_approval: false,
      compensation_precondition_status: "unavailable",
      compensation_precondition_error_class: "compensation_unavailable",
    });
  });

  it("proves dry-run plans remain non-executing and metadata-safe", () => {
    const plan = createKnownPlan();
    const json = JSON.stringify(plan);

    expect(plan).toMatchObject({
      adapter_kind: "hue",
      mode: "dry_run",
      approval_required: true,
      approval_execution_supported: false,
      executable: false,
      execution_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      writes_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_payload_exposed: false,
      raw_config_exposed: false,
      raw_api_key_exposed: false,
      compensation: {
        compensation_execution_supported: false,
      },
    });
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("config_ref:hue");
  });

  it("keeps Phase 16A/16B/16C disabled guards pinned", () => {
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

  it("keeps Hue execution boundary files free of real execution markers", () => {
    const packageJson = read("package.json");
    const hueSources = [
      read("src/room/adapters/hue-execution-boundary.ts"),
      read("src/room/adapters/hue-dry-run.ts"),
      read("src/room/adapters/hue-adapter.ts"),
      read("src/room/adapters/hue-config.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSources).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });

  it("documents Phase 16D closeout and the next Phase 16 step", () => {
    const closeout = read("docs/phase-16/phase-16d-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 16D Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "Why Real Hue Execution Is Still Deferred",
      "Remaining Notes Before Full Phase 16 Closeout",
      "Phase 16 Final Closeout",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function createKnownPlan() {
  const current = mapHueLightPayloadToReadSnapshot({
    id: "phase-16d-closeout-light",
    metadata: { name: "Phase 16D Closeout Light" },
    on: { on: false },
    dimming: { brightness: 25 },
    status: { reachable: true },
    capabilities: ["on", "dimming"],
    api_key: "secret-api-key",
  } as unknown as {
    id: string;
    metadata: { name: string };
    on: { on: boolean };
    dimming: { brightness: number };
    status: { reachable: boolean };
    capabilities: string[];
  });

  return createHueDryRunPlan({
    plan_id: "hue-dry-run-phase-16d-closeout",
    target_light_id: "phase-16d-closeout-light",
    current_state_snapshot: current,
    intended_state: {
      on: true,
      brightness_percent: 70,
    },
  });
}

function createUnknownPlan() {
  return createHueDryRunPlan({
    plan_id: "hue-dry-run-phase-16d-unknown",
    target_light_id: "phase-16d-unknown-light",
    intended_state: {
      on: true,
      brightness_percent: 10,
    },
  });
}

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
