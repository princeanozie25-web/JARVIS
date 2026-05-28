import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DisabledHueReadOnlyAdapter } from "../../src/room/adapters/hue-adapter";
import {
  buildHueDryRunAuditPreview,
  canSubmitHueDryRunPlanForApproval,
  createHueDryRunPlan,
} from "../../src/room/adapters/hue-dry-run";
import { mapHueLightPayloadToReadSnapshot } from "../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16C.6 Hue dry-run closeout guard", () => {
  it("proves the dry-run planner is contract-shaped and non-executing", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "closeout-light",
      metadata: { name: "Closeout Light" },
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

    const plan = createHueDryRunPlan({
      plan_id: "hue-dry-run-closeout",
      target_light_id: "closeout-light",
      current_state_snapshot: current,
      intended_state: {
        on: true,
        brightness_percent: 50,
      },
    });

    expect(plan).toMatchObject({
      plan_id: "hue-dry-run-closeout",
      adapter_kind: "hue",
      mode: "dry_run",
      source: "local_hue_bridge",
      target_light_id: "closeout-light",
      metadata_only: true,
      approval_required: true,
      user_review_required: true,
      approval_flow_available: false,
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
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      persistence_attempted: false,
    });
    expect(JSON.stringify(plan)).not.toContain("secret-api-key");
  });

  it("proves disabled Hue adapter exposes fixture/current dry-run planning only", () => {
    const adapter = DisabledHueReadOnlyAdapter.withExampleConfig();
    const result = adapter.createDryRunPlan({
      target_light_id: "adapter-closeout-light",
      intended_state: { on: true },
    });

    expect(result).toMatchObject({
      status: "dry_run_planned",
      adapter_kind: "hue",
      mode: "dry_run",
      source: "local_hue_bridge",
      dry_run_source: "fixture_current_state",
      fixture_only: true,
      enabled: false,
      read_only: true,
      approval_required: true,
      approval_flow_available: false,
      approval_execution_supported: false,
      user_review_required: true,
      executable: false,
      execution_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      writes_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
      plan: {
        current_state_status: "unknown",
        current_state_snapshot: null,
        current_state_unknown_reason: "snapshot_missing",
        diff_summary: {
          status: "current_state_unknown",
          unknown_fields: ["on"],
        },
      },
    });
  });

  it("proves approval submission, compensation execution, and audit persistence remain unsupported", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "governed-light",
      metadata: { name: "Governed Light" },
      on: { on: false },
      status: { reachable: true },
      capabilities: ["on"],
    });
    const plan = createHueDryRunPlan({
      plan_id: "hue-dry-run-governed-light",
      target_light_id: "governed-light",
      current_state_snapshot: current,
      intended_state: { on: true },
    });
    const auditPreview = buildHueDryRunAuditPreview(plan);

    expect(canSubmitHueDryRunPlanForApproval(plan)).toMatchObject({
      allowed: false,
      reason: "approval_execution_not_implemented",
      approval_required: true,
      approval_flow_available: false,
      approval_execution_supported: false,
      executable: false,
      execution_supported: false,
    });
    expect(plan.compensation).toMatchObject({
      compensation_available: true,
      compensation_execution_supported: false,
      compensation_requires_approval: true,
      compensation_source: "current_state_snapshot",
      compensation_plan: {
        descriptive_only: true,
        executable: false,
        execution_supported: false,
        rollback_execution_supported: false,
      },
    });
    expect(auditPreview).toMatchObject({
      preview_kind: "hue_dry_run_audit_preview",
      audit_event_supported: false,
      event_recording_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      persistence_attempted: false,
      ui_rendered: false,
      metadata_only: true,
    });
  });

  it("proves unknown current state is not guessed and compensation is unavailable", () => {
    const plan = createHueDryRunPlan({
      target_light_id: "unknown-current-light",
      intended_state: { on: false, brightness_percent: 15 },
    });

    expect(plan).toMatchObject({
      current_state_status: "unknown",
      current_state_snapshot: null,
      current_state_unknown_reason: "snapshot_missing",
      diff_summary: {
        status: "current_state_unknown",
        unknown_fields: ["on", "brightness_percent"],
      },
      compensation: {
        compensation_available: false,
        compensation_execution_supported: false,
        compensation_requires_approval: false,
        compensation_source: "unavailable",
        compensation_reason: "current_state_unknown",
        compensation_plan: null,
      },
    });
    expect(plan.diff_summary.entries).toEqual([
      {
        field: "on",
        current: "unknown",
        intended: false,
        changed: "unknown",
        metadata_only: true,
      },
      {
        field: "brightness_percent",
        current: "unknown",
        intended: 15,
        changed: "unknown",
        metadata_only: true,
      },
    ]);
  });

  it("keeps Phase 16A/16B disabled guards pinned", () => {
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

  it("keeps Hue adapter and dry-run files free of real SDK, network, discovery, and cloud paths", () => {
    const packageJson = read("package.json");
    const hueSources = [
      read("src/room/adapters/hue-adapter.ts"),
      read("src/room/adapters/hue-config.ts"),
      read("src/room/adapters/hue-read-mapper.ts"),
      read("src/room/adapters/hue-dry-run.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSources).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });

  it("documents Phase 16C closeout and Phase 16D prerequisite", () => {
    const closeout = read("docs/phase-16/phase-16c-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 16C Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "Why Dry-Run Execution Is Still Deferred",
      "Remaining Notes Before Phase 16D",
      "Phase 16D.1 - Hue Approval-Gated Execution Boundary Scaffold",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
