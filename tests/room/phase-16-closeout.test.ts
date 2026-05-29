import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DisabledHueReadOnlyAdapter } from "../../src/room/adapters/hue-adapter";
import {
  buildHueExecutionAuditPreview,
  evaluateHueExecutionBoundary,
} from "../../src/room/adapters/hue-execution-boundary";
import {
  buildHueDryRunAuditPreview,
  canSubmitHueDryRunPlanForApproval,
  createHueDryRunPlan,
} from "../../src/room/adapters/hue-dry-run";
import { mapHueLightPayloadToReadSnapshot } from "../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16 final room adapter realization closeout", () => {
  it("proves Phase 16A through 16D closeout docs and tests exist", () => {
    for (const path of [
      "docs/phase-16/phase-16a-closeout.md",
      "docs/phase-16/phase-16b-closeout.md",
      "docs/phase-16/phase-16c-closeout.md",
      "docs/phase-16/phase-16d-closeout.md",
      "tests/room/phase-16a-closeout.test.ts",
      "tests/room/phase-16b-closeout.test.ts",
      "tests/room/phase-16c-closeout.test.ts",
      "tests/room/phase-16d-closeout.test.ts",
      "tests/room/conformance/failure-partial-success.test.ts",
      "tests/room/conformance/rollback-compensation.test.ts",
      "tests/room/conformance/verification-read.test.ts",
    ]) {
      expect(existsSync(join(repoRoot, path)), path).toBe(true);
    }
  });

  it("keeps the Phase 16 disabled guard matrix pinned", () => {
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
      metadata_only: true,
      local_only: true,
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
      persisted: false,
      ui_rendered: false,
    });
  });

  it("keeps Hue adapter disabled by default with live reads and writes unimplemented", async () => {
    const adapter = new DisabledHueReadOnlyAdapter();

    expect(adapter.getModeMetadata()).toMatchObject({
      adapter_kind: "hue",
      mode: "read_only",
      enabled: false,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      real_reads_implemented: false,
      real_writes_implemented: false,
    });
    expect(adapter.getLiveReadPreflight()).toMatchObject({
      allowed: false,
      live_read_implemented: false,
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
    });
    await expect(
      adapter.readState({
        deviceId: "phase-16-final-light",
        capability: "light.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "adapter_unavailable",
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
  });

  it("keeps dry-run plans metadata-only and non-executing", () => {
    const plan = createPlan();
    const preview = buildHueDryRunAuditPreview(plan);
    const approvalSubmission = canSubmitHueDryRunPlanForApproval(plan);

    expect(plan).toMatchObject({
      adapter_kind: "hue",
      mode: "dry_run",
      metadata_only: true,
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
        compensation_available: true,
        compensation_execution_supported: false,
      },
    });
    expect(preview).toMatchObject({
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      event_recording_supported: false,
      persistence_attempted: false,
      metadata_only: true,
    });
    expect(approvalSubmission).toMatchObject({
      allowed: false,
      reason: "approval_execution_not_implemented",
      execution_supported: false,
      network_called: false,
      writes_attempted: false,
    });
  });

  it("keeps approval-gated execution boundary non-operational", () => {
    const decision = evaluateHueExecutionBoundary(createPlan(), {
      approval_id: "approval-final-safe",
      approval_status: "approved",
      metadata_only: true,
    });
    const auditPreview = buildHueExecutionAuditPreview(decision);

    expect(decision).toMatchObject({
      mode: "approval_gated_execution",
      approval_required: true,
      approval_status: "approved",
      execution_allowed: false,
      execution_supported: false,
      denial_reason: "execution_not_implemented",
      verification_required: true,
      verification_supported: false,
      verification_read_performed: false,
      audit_required: true,
      audit_supported: false,
      event_store_write_supported: false,
      event_store_write_attempted: false,
      compensation_required_if_executed: true,
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
      network_called: false,
      writes_attempted: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_payload_exposed: false,
      raw_config_exposed: false,
      raw_api_key_exposed: false,
    });
    expect(auditPreview).toMatchObject({
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      persistence_attempted: false,
      event_store_write_attempted: false,
      metadata_only: true,
    });
    expect(JSON.stringify(decision)).not.toContain("config_ref:hue");
    expect(JSON.stringify(decision)).not.toContain("secret-api-key");
  });

  it("keeps Hue adapter, dry-run, and execution files free of real Hue authority markers", () => {
    const packageJson = read("package.json");
    const hueSources = [
      read("src/room/adapters/hue-adapter.ts"),
      read("src/room/adapters/hue-config.ts"),
      read("src/room/adapters/hue-read-mapper.ts"),
      read("src/room/adapters/hue-dry-run.ts"),
      read("src/room/adapters/hue-execution-boundary.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSources).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });

  it("documents the final Phase 16 verdict and next phase", () => {
    const closeout = read("docs/phase-16/phase-16-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed Phase 16 Slices",
      "Files/Modules Audited",
      "Final Operational State",
      "Explicit Disabled Features Still Pinned Off",
      "What Phase 16 Achieved",
      "What Phase 16 Intentionally Did Not Implement",
      "Phase 17 - Scheduled Assistance Runtime",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function createPlan() {
  const current = mapHueLightPayloadToReadSnapshot({
    id: "phase-16-final-light",
    metadata: { name: "Phase 16 Final Light" },
    on: { on: false },
    dimming: { brightness: 20 },
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
    plan_id: "hue-dry-run-phase-16-final",
    target_light_id: "phase-16-final-light",
    current_state_snapshot: current,
    intended_state: {
      on: true,
      brightness_percent: 80,
    },
  });
}

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
