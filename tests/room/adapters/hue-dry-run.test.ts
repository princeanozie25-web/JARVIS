import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHueDryRunAuditPreview,
  canSubmitHueDryRunPlanForApproval,
  createHueDryRunPlan,
} from "../../../src/room/adapters/hue-dry-run";
import { mapHueLightPayloadToReadSnapshot } from "../../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../../src/room/adapters/phase-16-disabled-guards";

describe("Phase 16C.1 Hue dry-run plan contract scaffold", () => {
  it("generates a metadata-only dry-run plan from fixture current state and intended state", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "desk-lamp",
      metadata: { name: "Desk Lamp" },
      owner: { rid: "desk", rtype: "room" },
      on: { on: false },
      dimming: { brightness: 25 },
      color_temperature: { mirek: 370 },
      status: { reachable: true },
      capabilities: ["on", "dimming", "color_temperature"],
      last_seen_at_ms: 1_000,
    });

    const plan = createHueDryRunPlan({
      plan_id: "hue-dry-run-desk-lamp",
      target_light_id: "desk-lamp",
      current_state_snapshot: current,
      intended_state: {
        on: true,
        brightness_percent: 60,
        color_temperature_kelvin: 2703,
      },
    });

    expect(plan).toMatchObject({
      plan_id: "hue-dry-run-desk-lamp",
      adapter_kind: "hue",
      mode: "dry_run",
      source: "local_hue_bridge",
      target_light_id: "desk-lamp",
      intended_state: {
        on: true,
        brightness_percent: 60,
        color_temperature_kelvin: 2703,
      },
      current_state_status: "available",
      current_state_unknown_reason: null,
      approval_required: true,
      approval_flow_available: false,
      approval_execution_supported: false,
      user_review_required: true,
      expires_at_ms: 300_000,
      plan_summary: "Hue dry-run for desk-lamp: changed=on,brightness_percent",
      redacted_summary:
        "Hue dry-run for desk-lamp: changed=on,brightness_percent",
      risk_class: "device_mutation_requires_future_approval",
      action_class: "single_light_state_change",
      audit_event_supported: false,
      event_recording_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      persistence_attempted: false,
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
      metadata_only: true,
      diff_summary: {
        status: "diff_available",
        changed_fields: ["on", "brightness_percent"],
        unchanged_fields: ["color_temperature_kelvin"],
        unknown_fields: [],
        metadata_only: true,
      },
      compensation: {
        compensation_available: true,
        compensation_execution_supported: false,
        compensation_requires_approval: true,
        compensation_source: "current_state_snapshot",
        compensation_reason: null,
        compensation_plan: {
          target_light_id: "desk-lamp",
          descriptive_only: true,
          executable: false,
          execution_supported: false,
          rollback_execution_supported: false,
          raw_payload_exposed: false,
          raw_config_exposed: false,
          metadata_only: true,
        },
        metadata_only: true,
      },
    });
    expect(plan.compensation.compensation_plan?.restore_hints).toEqual([
      { field: "on", restore_value: false, metadata_only: true },
      { field: "brightness_percent", restore_value: 25, metadata_only: true },
    ]);
    expect(plan.diff_summary.entries).toEqual([
      {
        field: "on",
        current: false,
        intended: true,
        changed: true,
        metadata_only: true,
      },
      {
        field: "brightness_percent",
        current: 25,
        intended: 60,
        changed: true,
        metadata_only: true,
      },
      {
        field: "color_temperature_kelvin",
        current: 2703,
        intended: 2703,
        changed: false,
        metadata_only: true,
      },
    ]);
  });

  it("supports color metadata without executing or guessing", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "accent-light",
      metadata: { name: "Accent Light" },
      on: { on: true },
      color: { xy: { x: 0.3, y: 0.34 } },
      status: { reachable: true },
      capabilities: ["on", "color"],
    });

    const plan = createHueDryRunPlan({
      target_light_id: "accent-light",
      current_state_snapshot: current,
      intended_state: {
        color_hex: "#3366ff",
      },
    });

    expect(plan).toMatchObject({
      plan_id: "hue-dry-run-accent-light",
      current_state_status: "available",
      executable: false,
      execution_supported: false,
      writes_attempted: false,
      approval_flow_available: false,
      approval_execution_supported: false,
      diff_summary: {
        status: "diff_available",
        changed_fields: ["color_hex"],
        unknown_fields: [],
      },
    });
    expect(plan.diff_summary.entries).toEqual([
      {
        field: "color_hex",
        current: null,
        intended: "#3366ff",
        changed: true,
        metadata_only: true,
      },
    ]);
  });

  it("represents missing current state as unknown rather than guessing", () => {
    const plan = createHueDryRunPlan({
      target_light_id: "unknown-light",
      intended_state: {
        on: false,
        brightness_percent: 10,
      },
    });

    expect(plan).toMatchObject({
      current_state_status: "unknown",
      current_state_snapshot: null,
      current_state_unknown_reason: "snapshot_missing",
      compensation: {
        compensation_available: false,
        compensation_execution_supported: false,
        compensation_requires_approval: false,
        compensation_source: "unavailable",
        compensation_reason: "current_state_unknown",
        compensation_plan: null,
        metadata_only: true,
      },
      executable: false,
      execution_supported: false,
      approval_flow_available: false,
      approval_execution_supported: false,
      user_review_required: true,
      redacted_summary:
        "Hue dry-run for unknown-light: changed=no_known_changes; unknown=on,brightness_percent",
      diff_summary: {
        status: "current_state_unknown",
        changed_fields: [],
        unchanged_fields: [],
        unknown_fields: ["on", "brightness_percent"],
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
        intended: 10,
        changed: "unknown",
        metadata_only: true,
      },
    ]);
  });

  it("represents unreachable current state as unavailable metadata", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "offline-light",
      metadata: { name: "Offline Light" },
      status: { reachable: false },
    });

    const plan = createHueDryRunPlan({
      target_light_id: "offline-light",
      current_state_snapshot: current,
      intended_state: {
        on: true,
      },
    });

    expect(plan).toMatchObject({
      current_state_status: "unavailable",
      current_state_snapshot: null,
      current_state_unknown_reason: "snapshot_unreachable",
      compensation: {
        compensation_available: false,
        compensation_execution_supported: false,
        compensation_requires_approval: false,
        compensation_source: "unavailable",
        compensation_reason: "current_state_unavailable",
        compensation_plan: null,
        metadata_only: true,
      },
      diff_summary: {
        status: "current_state_unknown",
        unknown_fields: ["on"],
      },
      network_called: false,
      writes_attempted: false,
    });
  });

  it("never exposes raw config or API key fields from oversized fixture inputs", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "unsafe-light",
      metadata: { name: "Unsafe Light" },
      status: { reachable: true },
      api_key: "secret-api-key",
      api_key_config_ref: "config_ref:hue.local.placeholder",
      token: "secret-token",
    } as unknown as {
      id: string;
      metadata: { name: string };
      status: { reachable: boolean };
    });

    const plan = createHueDryRunPlan({
      target_light_id: "unsafe-light",
      current_state_snapshot: current,
      intended_state: {
        on: true,
      },
    });
    const json = JSON.stringify(plan);

    expect(plan).toMatchObject({
      raw_config_exposed: false,
      raw_api_key_exposed: false,
      raw_payload_exposed: false,
      metadata_only: true,
    });
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("config_ref:hue");
  });

  it("does not create compensation when no changed fields exist", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "unchanged-light",
      metadata: { name: "Unchanged Light" },
      on: { on: true },
      status: { reachable: true },
      capabilities: ["on"],
    });

    const plan = createHueDryRunPlan({
      target_light_id: "unchanged-light",
      current_state_snapshot: current,
      intended_state: { on: true },
    });

    expect(plan).toMatchObject({
      diff_summary: {
        changed_fields: [],
        unchanged_fields: ["on"],
      },
      compensation: {
        compensation_available: false,
        compensation_execution_supported: false,
        compensation_requires_approval: false,
        compensation_source: "unavailable",
        compensation_reason: "no_changed_fields",
        compensation_plan: null,
        metadata_only: true,
      },
      writes_attempted: false,
      hardware_io_performed: false,
    });
  });

  it("keeps Phase 16A/16B disabled guards pinned", () => {
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
      real_hue_writes_enabled: false,
      hue_auto_discovery_enabled: false,
      hue_cloud_remote_api_enabled: false,
      scenes_macros_enabled: false,
      scheduled_device_actions_enabled: false,
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

  it("denies direct approval submission and execution for dry-run plans", () => {
    const plan = createHueDryRunPlan({
      plan_id: "hue-dry-run-approval-denied",
      target_light_id: "approval-light",
      intended_state: { on: true },
    });

    expect(canSubmitHueDryRunPlanForApproval(plan)).toEqual({
      allowed: false,
      reason: "approval_execution_not_implemented",
      plan_id: "hue-dry-run-approval-denied",
      approval_required: true,
      approval_flow_available: false,
      approval_execution_supported: false,
      executable: false,
      execution_supported: false,
      metadata_only: true,
      network_called: false,
      writes_attempted: false,
    });
  });

  it("builds replay-safe audit preview metadata without persisting events", () => {
    const current = mapHueLightPayloadToReadSnapshot({
      id: "audit-light",
      metadata: { name: "Audit Light" },
      on: { on: false },
      status: { reachable: true },
      capabilities: ["on"],
      api_key: "secret-api-key",
    } as unknown as {
      id: string;
      metadata: { name: string };
      on: { on: boolean };
      status: { reachable: boolean };
      capabilities: string[];
    });
    const plan = createHueDryRunPlan({
      plan_id: "hue-dry-run-audit-light",
      target_light_id: "audit-light",
      current_state_snapshot: current,
      intended_state: { on: true },
    });

    const preview = buildHueDryRunAuditPreview(plan);
    const json = JSON.stringify(preview);

    expect(preview).toEqual({
      preview_kind: "hue_dry_run_audit_preview",
      audit_event_supported: false,
      event_recording_supported: false,
      audit_payload_kind: "metadata_only",
      replay_safe: true,
      redaction_status: "redacted_metadata_only",
      provenance: {
        adapter_kind: "hue",
        mode: "dry_run",
        source: "local_hue_bridge",
        target_light_id: "audit-light",
        plan_id: "hue-dry-run-audit-light",
        metadata_only: true,
      },
      plan_summary: "Hue dry-run for audit-light: changed=on",
      redacted_summary: "Hue dry-run for audit-light: changed=on",
      approval_required: true,
      approval_execution_supported: false,
      compensation_execution_supported: false,
      executable: false,
      execution_supported: false,
      raw_payload_exposed: false,
      raw_config_exposed: false,
      raw_api_key_exposed: false,
      persistence_attempted: false,
      ui_rendered: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      writes_attempted: false,
      hardware_io_performed: false,
      metadata_only: true,
    });
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("config_ref:hue");
  });

  it("does not add SDK, network, discovery, cloud, or execution markers", () => {
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );
    const dryRunSource = readFileSync(
      join(process.cwd(), "src/room/adapters/hue-dry-run.ts"),
      "utf8",
    );

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(dryRunSource).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });
});
