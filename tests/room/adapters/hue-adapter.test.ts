import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
  evaluatePhase16RoomAdapterDisabledFeature,
} from "../../../src/room/adapters/phase-16-disabled-guards";
import {
  DisabledHueReadOnlyAdapter,
  HUE_READ_ONLY_ADAPTER_MODE,
} from "../../../src/room/adapters/hue-adapter";
import {
  EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
  HueReadOnlyAdapterConfigSchema,
  parseHueReadOnlyAdapterConfig,
  validateHueReadOnlyAdapterConfig,
} from "../../../src/room/adapters/hue-config";
import { mapHueLightPayloadToReadSnapshot } from "../../../src/room/adapters/hue-read-mapper";
import { approvedContext, roomCommand } from "../conformance/harness";

describe("Phase 16B.1 disabled Hue read-only adapter scaffold", () => {
  it("is disabled by default and exposes read-only local Hue metadata", () => {
    const adapter = new DisabledHueReadOnlyAdapter();

    expect(HUE_READ_ONLY_ADAPTER_MODE).toEqual({
      adapter_kind: "hue",
      mode: "read_only",
      enabled: false,
      source: "local_hue_bridge",
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      real_reads_implemented: false,
      real_writes_implemented: false,
    });
    expect(adapter.getModeMetadata()).toEqual(HUE_READ_ONLY_ADAPTER_MODE);
    expect(adapter.descriptor).toMatchObject({
      identity: {
        adapter_id: "hue-read-only-disabled",
        adapter_kind: "hue",
        real_hardware_io: false,
        network_access: false,
        persistence_access: false,
        ui_access: false,
        implementation_enabled: false,
      },
      supported_capabilities: ["power.observe", "light.observe"],
      implementation_side_effects_enabled: false,
    });
    expect(adapter.getReadHealth()).toMatchObject({
      status: "config_missing",
      reason: "manual_config_missing",
      error_class: "config_missing",
      enabled: false,
      read_only: true,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
    });
  });

  it("does not perform real Hue reads while disabled", async () => {
    const adapter = DisabledHueReadOnlyAdapter.withExampleConfig();

    await expect(
      adapter.readState({
        deviceId: "desk_lamp",
        capability: "light.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "adapter_unavailable",
      state: null,
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
      provenance: {
        adapter_id: "hue-read-only-disabled",
        metadata_only: true,
      },
    });
  });

  it("has no write authority and returns disabled metadata for execution paths", async () => {
    const adapter = DisabledHueReadOnlyAdapter.withExampleConfig();
    const command = {
      ...roomCommand({
        commandId: "hue-write-disabled",
        deviceId: "desk_lamp",
        capability: "power.switch",
        value: true,
      }),
      mode: "approved_execution" as const,
    };

    await expect(
      adapter.planCommand({
        command: { ...command, mode: "dry_run" },
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow("disabled");
    await expect(
      adapter.executeCommand({
        command,
        context: approvedContext("approval-hue-disabled-1"),
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "hardware_io_disabled",
      state: null,
      approval: {
        required: true,
        dry_run_required: true,
        auto_approval_allowed: false,
        voice_only_approval_allowed: false,
      },
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
    await expect(
      adapter.verifyState({
        command,
        context: approvedContext("approval-hue-disabled-1"),
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "hardware_io_disabled",
      hardware_io_performed: false,
      network_called: false,
    });
  });

  it("validates manual config placeholders without live connection or secrets", () => {
    expect(
      parseHueReadOnlyAdapterConfig(EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG),
    ).toMatchObject({
      enabled: false,
      read_only: true,
      source: "local_hue_bridge",
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_calls_enabled: false,
      real_reads_implemented: false,
    });
    expect(
      HueReadOnlyAdapterConfigSchema.safeParse({
        ...EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
        enabled: true,
      }).success,
    ).toBe(false);
    expect(
      HueReadOnlyAdapterConfigSchema.safeParse({
        ...EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
        api_key_config_ref: "api_key=not-allowed",
      }).success,
    ).toBe(false);

    const yaml = parseYaml(
      readFileSync(join(process.cwd(), "config/room/hue.example.yaml"), "utf8"),
    );
    expect(parseHueReadOnlyAdapterConfig(yaml)).toMatchObject({
      enabled: false,
      read_only: true,
      bridge_ip: "192.0.2.10",
      api_key_config_ref: "config_ref:hue.local.placeholder",
    });
  });

  it("returns metadata-only config health without surfacing raw config refs", () => {
    const missing = validateHueReadOnlyAdapterConfig(undefined);
    expect(missing).toMatchObject({
      ok: false,
      status: "config_missing",
      enabled: false,
      read_only: true,
      bridge_ip_configured: false,
      bridge_ip_source: "not_configured",
      api_key_config_ref_status: "not_configured",
      metadata_only: true,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
    });

    const invalid = validateHueReadOnlyAdapterConfig({
      ...EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
      bridge_ip: "https://not-manual.example",
      api_key_config_ref: "api_key=not-allowed",
    });
    expect(invalid).toMatchObject({
      ok: false,
      status: "config_invalid",
      config: null,
      bridge_ip_configured: true,
      bridge_ip_source: "manual",
      api_key_config_ref_status: "configured",
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
    });
    expect(JSON.stringify(invalid)).not.toContain("api_key=not-allowed");

    const ready = validateHueReadOnlyAdapterConfig(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
    );
    expect(ready).toMatchObject({
      ok: true,
      status: "ready_for_future_read_only",
      config: null,
      enabled: false,
      read_only: true,
      bridge_ip_configured: true,
      bridge_ip_source: "manual",
      api_key_config_ref_status: "configured",
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
    });
    expect(JSON.stringify(ready)).not.toContain("config_ref:hue");

    const health =
      DisabledHueReadOnlyAdapter.withExampleConfig().getReadHealth();
    expect(health).toMatchObject({
      status: "ready_for_future_read_only",
      reason: "ready_but_execution_disabled",
      error_class: null,
      enabled: false,
      read_only: true,
      bridge_ip_configured: true,
      bridge_ip_source: "manual",
      api_key_config_ref_status: "configured",
      validation_errors: [],
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
    });
    expect(JSON.stringify(health)).not.toContain("config_ref:hue");
  });

  it("maps fixture-only Hue read payloads through the disabled adapter dry-run path", () => {
    const adapter = DisabledHueReadOnlyAdapter.withExampleConfig();

    const result = adapter.dryRunReadFixtureSnapshot({
      bridge: {
        id: "bridge-001",
        name: "Office Hue Bridge",
        api_version: "1.58.0",
      },
      lights: [
        {
          id: "light-reachable",
          metadata: { name: "Reachable Lamp" },
          owner: { rid: "office", rtype: "room" },
          on: { on: true },
          dimming: { brightness: 70 },
          color_temperature: { mirek: 400 },
          status: { reachable: true },
          capabilities: ["on", "dimming", "color_temperature"],
          last_seen_at_ms: 5_000,
          stale: true,
        },
        {
          id: "light-unreachable",
          metadata: { name: "Unreachable Lamp" },
          status: { reachable: false },
        },
      ],
    });

    expect(result).toMatchObject({
      status: "fixture_mapped",
      adapter_id: "hue-read-only-disabled",
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      fixture_only: true,
      dry_run_read: true,
      enabled: false,
      read_only: true,
      config_status: "ready_for_future_read_only",
      bridge_ip_configured: true,
      api_key_config_ref_status: "configured",
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
      snapshot: {
        adapter_kind: "hue",
        mode: "read_only",
        source: "local_hue_bridge",
        enabled: false,
        network_called: false,
        hardware_io_performed: false,
        persisted: false,
        raw_hue_payload_included: false,
      },
    });
    expect(result.snapshot.lights).toHaveLength(2);
    expect(result.snapshot.lights[0]).toMatchObject({
      id: "light-reachable",
      reachability: "reachable",
      on: true,
      brightness_percent: 70,
      color_temperature_kelvin: 2500,
      freshness: { observed_at_ms: 5_000, stale: true },
      raw_hue_payload_included: false,
      network_called: false,
    });
    expect(result.snapshot.lights[1]).toMatchObject({
      id: "light-unreachable",
      reachability: "unreachable",
      unavailable_reason: "adapter_unavailable",
      on: null,
      brightness_percent: null,
      color_temperature_kelvin: null,
      freshness: { observed_at_ms: null },
      degraded: true,
    });
  });

  it("keeps fixture dry-run mapping metadata-only for missing, invalid, and unsafe fields", () => {
    const adapter = new DisabledHueReadOnlyAdapter();

    const result = adapter.dryRunReadFixtureSnapshot({
      bridge: {
        name: "Incomplete Bridge",
        api_key_config_ref: "config_ref:hue.local.placeholder",
      } as unknown as { name: string },
      lights: [
        {
          id: "light-invalid",
          metadata: { name: "Invalid Lamp" },
          dimming: { brightness: 200 },
          color_temperature: { mirek: -1 },
          status: { reachable: true },
          api_key: "secret-api-key",
          token: "secret-token",
        } as unknown as {
          id: string;
          metadata: { name: string };
          dimming: { brightness: number };
          color_temperature: { mirek: number };
          status: { reachable: boolean };
        },
      ],
    });
    const json = JSON.stringify(result);

    expect(result).toMatchObject({
      config_status: "config_missing",
      fixture_only: true,
      dry_run_read: true,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
    });
    expect(result.snapshot.bridge).toMatchObject({
      bridge_id: null,
      missing_fields: ["id", "api_version"],
      degraded: true,
    });
    expect(result.snapshot.lights[0]).toMatchObject({
      brightness_percent: null,
      color_temperature_kelvin: null,
      degraded: true,
    });
    expect(result.snapshot.lights[0]?.invalid_fields).toEqual(
      expect.arrayContaining(["dimming.brightness", "color_temperature.mirek"]),
    );
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("config_ref:hue");
  });

  it("creates non-executable dry-run plans from fixture current state", () => {
    const adapter = DisabledHueReadOnlyAdapter.withExampleConfig();
    const current = mapHueLightPayloadToReadSnapshot({
      id: "desk-lamp",
      metadata: { name: "Desk Lamp" },
      on: { on: false },
      dimming: { brightness: 20 },
      status: { reachable: true },
      capabilities: ["on", "dimming"],
    });

    const result = adapter.createDryRunPlan({
      plan_id: "hue-adapter-dry-run-desk-lamp",
      target_light_id: "desk-lamp",
      current_state_snapshot: current,
      intended_state: {
        on: true,
        brightness_percent: 45,
      },
    });

    expect(result).toMatchObject({
      status: "dry_run_planned",
      adapter_id: "hue-read-only-disabled",
      adapter_kind: "hue",
      mode: "dry_run",
      source: "local_hue_bridge",
      dry_run_source: "fixture_current_state",
      fixture_only: true,
      enabled: false,
      read_only: true,
      config_status: "ready_for_future_read_only",
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
        plan_id: "hue-adapter-dry-run-desk-lamp",
        adapter_kind: "hue",
        mode: "dry_run",
        source: "local_hue_bridge",
        target_light_id: "desk-lamp",
        current_state_status: "available",
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
        raw_config_exposed: false,
        raw_api_key_exposed: false,
        diff_summary: {
          status: "diff_available",
          changed_fields: ["on", "brightness_percent"],
          metadata_only: true,
        },
      },
    });
  });

  it("keeps adapter dry-run current state unknown when no fixture snapshot exists", () => {
    const result = new DisabledHueReadOnlyAdapter().createDryRunPlan({
      target_light_id: "missing-light",
      intended_state: { on: false },
    });

    expect(result).toMatchObject({
      status: "dry_run_planned",
      config_status: "config_missing",
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

  it("keeps Phase 16A disabled guards pinned", () => {
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
      real_hue_writes_enabled: false,
      hue_auto_discovery_enabled: false,
      hue_cloud_remote_api_enabled: false,
      scenes_macros_enabled: false,
      scheduled_device_actions_enabled: false,
      real_hue_adapter_enabled: false,
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
    });
    expect(
      evaluatePhase16RoomAdapterDisabledFeature("real_hue_writes"),
    ).toMatchObject({
      allowed: false,
      reason: "phase_16a_fake_conformance_required",
    });
  });

  it("does not add SDK, discovery, cloud, or network call markers", () => {
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );
    const hueSource = [
      readFileSync(
        join(process.cwd(), "src/room/adapters/hue-adapter.ts"),
        "utf8",
      ),
      readFileSync(
        join(process.cwd(), "src/room/adapters/hue-config.ts"),
        "utf8",
      ),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSource).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });
});
