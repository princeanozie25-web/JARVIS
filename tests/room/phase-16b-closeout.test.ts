import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DisabledHueReadOnlyAdapter,
  HUE_READ_ONLY_ADAPTER_MODE,
  evaluateHueLiveReadPreflight,
} from "../../src/room/adapters/hue-adapter";
import { EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG } from "../../src/room/adapters/hue-config";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../src/room/adapters/phase-16-disabled-guards";
import { approvedContext, roomCommand } from "./conformance/harness";

const repoRoot = process.cwd();

describe("Phase 16B.7 real Hue read-only closeout", () => {
  it("keeps the Hue adapter scaffold disabled by default with read-only metadata", () => {
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
    expect(adapter.descriptor).toMatchObject({
      identity: {
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
      enabled: false,
      read_only: true,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
    });
  });

  it("keeps real Hue live reads and writes non-operational", async () => {
    const adapter = DisabledHueReadOnlyAdapter.withExampleConfig();
    const command = {
      ...roomCommand({
        commandId: "phase-16b-closeout-write-disabled",
        deviceId: "desk_lamp",
        capability: "power.switch",
        value: true,
      }),
      mode: "approved_execution" as const,
    };

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
    });
    await expect(
      adapter.planCommand({
        command: { ...command, mode: "dry_run" },
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow("disabled");
    await expect(
      adapter.executeCommand({
        command,
        context: approvedContext("phase-16b-closeout-approval"),
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "hardware_io_disabled",
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
  });

  it("proves fixture-only read mapping exists and remains metadata-safe", () => {
    const result =
      DisabledHueReadOnlyAdapter.withExampleConfig().dryRunReadFixtureSnapshot({
        bridge: {
          id: "bridge-closeout",
          name: "Closeout Bridge",
          api_version: "1.58.0",
          api_key_config_ref: "config_ref:hue.local.placeholder",
        } as unknown as {
          id: string;
          name: string;
          api_version: string;
        },
        lights: [
          {
            id: "reachable-light",
            metadata: { name: "Reachable Light" },
            on: { on: true },
            dimming: { brightness: 33 },
            color_temperature: { mirek: 400 },
            status: { reachable: true },
            api_key: "secret-api-key",
          } as unknown as {
            id: string;
            metadata: { name: string };
            on: { on: boolean };
            dimming: { brightness: number };
            color_temperature: { mirek: number };
            status: { reachable: boolean };
          },
          {
            id: "unreachable-light",
            metadata: { name: "Unreachable Light" },
            status: { reachable: false },
          },
        ],
      });
    const json = JSON.stringify(result);

    expect(result).toMatchObject({
      status: "fixture_mapped",
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      fixture_only: true,
      dry_run_read: true,
      enabled: false,
      read_only: true,
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
        raw_hue_payload_included: false,
      },
    });
    expect(result.snapshot.lights).toEqual([
      expect.objectContaining({
        id: "reachable-light",
        reachability: "reachable",
        on: true,
        brightness_percent: 33,
      }),
      expect.objectContaining({
        id: "unreachable-light",
        reachability: "unreachable",
        unavailable_reason: "adapter_unavailable",
        on: null,
        degraded: true,
      }),
    ]);
    expect(json).not.toContain("config_ref:hue");
    expect(json).not.toContain("secret-api-key");
  });

  it("proves live-read preflight exists but denies execution", () => {
    const missing = evaluateHueLiveReadPreflight();
    const ready = evaluateHueLiveReadPreflight(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
    );

    expect(missing).toMatchObject({
      allowed: false,
      status: "denied",
      reason: "manual_config_missing",
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      live_read_implemented: false,
    });
    expect(ready).toMatchObject({
      allowed: false,
      status: "ready_for_manual_live_read_implementation",
      reason: "ready_but_live_read_not_implemented",
      config_status: "ready_for_future_read_only",
      disabled_guard_status: "pinned_off",
      enabled: false,
      read_only: true,
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      live_read_implemented: false,
    });
    expect(JSON.stringify(ready)).not.toContain("config_ref:hue");
  });

  it("keeps Phase 16A disabled guards pinned", () => {
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

  it("keeps Hue adapter files free of real SDK, network, discovery, and cloud paths", () => {
    const packageJson = read("package.json");
    const hueSources = [
      read("src/room/adapters/hue-adapter.ts"),
      read("src/room/adapters/hue-config.ts"),
      read("src/room/adapters/hue-read-mapper.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSources).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });

  it("documents Phase 16B closeout and Phase 16C prerequisite", () => {
    const closeout = read("docs/phase-16/phase-16b-closeout.md");

    for (const required of [
      "PASS WITH NOTES",
      "Completed 16B Slices",
      "Files/Modules Audited",
      "Explicit Disabled Features Still Pinned Off",
      "Why Live Hue Reads Are Still Deferred",
      "Phase 16C.1 - Hue Dry-Run Plan Contract Scaffold",
    ]) {
      expect(closeout).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
