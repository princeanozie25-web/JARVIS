import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateHueExecutionBoundary,
  type HueExecutionApprovalMetadata,
  type HueExecutionApprovalStatus,
} from "../../../src/room/adapters/hue-execution-boundary";
import { createHueDryRunPlan } from "../../../src/room/adapters/hue-dry-run";
import { mapHueLightPayloadToReadSnapshot } from "../../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16D.1 Hue approval-gated execution boundary scaffold", () => {
  it.each([
    ["missing", undefined, "approval_missing"],
    ["pending", { approval_status: "pending" }, "approval_pending"],
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
        compensation_required_if_executed: true,
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
      network_allowed: false,
      writes_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      network_called: false,
      writes_attempted: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
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
      compensation_required_if_executed: true,
      execution_allowed: false,
      execution_supported: false,
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

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
