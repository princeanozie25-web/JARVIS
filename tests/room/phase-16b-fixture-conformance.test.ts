import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DisabledHueReadOnlyAdapter,
  HUE_READ_ONLY_ADAPTER_MODE,
} from "../../src/room/adapters/hue-adapter";
import { EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG } from "../../src/room/adapters/hue-config";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16B.5 Hue read-only fixture conformance closeout", () => {
  it("returns adapter-compatible fixture read snapshots with authority pinned off", () => {
    const adapter = new DisabledHueReadOnlyAdapter(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
    );

    const result = adapter.dryRunReadFixtureSnapshot({
      bridge: {
        id: "bridge-fixture",
        name: "Fixture Bridge",
        api_version: "1.58.0",
      },
      lights: [
        {
          id: "reachable-light",
          metadata: { name: "Reachable Light" },
          owner: { rid: "desk", rtype: "room" },
          on: { on: true },
          dimming: { brightness: 66 },
          color: { xy: { x: 0.31, y: 0.34 } },
          color_temperature: { mirek: 370 },
          status: { reachable: true },
          capabilities: ["on", "dimming", "color", "color_temperature"],
          last_seen_at_ms: 10_000,
        },
      ],
    });

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
        read_only: true,
        writes_supported: false,
        discovery_supported: false,
        cloud_supported: false,
        network_called: false,
        hardware_io_performed: false,
        persisted: false,
        raw_hue_payload_included: false,
      },
    });
    expect(result.snapshot.lights[0]).toMatchObject({
      id: "reachable-light",
      name: "Reachable Light",
      reachability: "reachable",
      on: true,
      brightness_percent: 66,
      color_hex: null,
      color_xy: { x: 0.31, y: 0.34 },
      color_temperature_kelvin: 2703,
      unsupported_fields: ["color.xy_to_hex"],
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
    });
  });

  it("handles reachable, unreachable, stale, missing, invalid, and unsupported fixture states", () => {
    const result = new DisabledHueReadOnlyAdapter().dryRunReadFixtureSnapshot({
      bridge: { name: "Missing Bridge Fields" },
      lights: [
        {
          id: "reachable-stale",
          metadata: { name: "Reachable Stale" },
          on: { on: false },
          dimming: { brightness: 12 },
          color_temperature: { mirek: 500 },
          status: { reachable: true },
          last_seen_at_ms: 20_000,
          stale: true,
        },
        {
          id: "unreachable-light",
          metadata: { name: "Unreachable Light" },
          status: { reachable: false },
        },
        {
          id: "invalid-light",
          metadata: { name: "Invalid Light" },
          dimming: { brightness: 120 },
          color: { xy: { x: 2, y: 0.5 } },
          color_temperature: { mirek: -1 },
          status: { reachable: true },
        },
        {},
      ],
    });

    expect(result.snapshot.bridge).toMatchObject({
      bridge_id: null,
      missing_fields: ["id", "api_version"],
      degraded: true,
    });
    expect(result.snapshot.lights).toHaveLength(4);
    expect(result.snapshot.lights[2]).toMatchObject({
      id: "reachable-stale",
      reachability: "reachable",
      on: false,
      brightness_percent: 12,
      color_temperature_kelvin: 2000,
      freshness: {
        observed_at_ms: 20_000,
        stale: true,
      },
    });
    expect(result.snapshot.lights[3]).toMatchObject({
      id: "unreachable-light",
      reachability: "unreachable",
      unavailable_reason: "adapter_unavailable",
      on: null,
      brightness_percent: null,
      color_temperature_kelvin: null,
      degraded: true,
    });
    expect(result.snapshot.lights[1]?.invalid_fields).toEqual(
      expect.arrayContaining([
        "dimming.brightness",
        "color.xy",
        "color_temperature.mirek",
      ]),
    );
    expect(result.snapshot.lights[1]).toMatchObject({
      id: "invalid-light",
      brightness_percent: null,
      color_xy: null,
      color_temperature_kelvin: null,
      degraded: true,
    });
    expect(result.snapshot.lights[0]).toMatchObject({
      id: null,
      name: null,
      reachability: "unknown",
      missing_fields: expect.arrayContaining([
        "id",
        "metadata.name",
        "status.reachable",
      ]),
      degraded: true,
    });
  });

  it("never exposes raw config refs or API keys through fixture conformance output", () => {
    const result = new DisabledHueReadOnlyAdapter(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
    ).dryRunReadFixtureSnapshot({
      bridge: {
        id: "bridge-fixture",
        name: "Fixture Bridge",
        api_version: "1.58.0",
        api_key_config_ref: "config_ref:hue.local.placeholder",
      } as unknown as { id: string; name: string; api_version: string },
      lights: [
        {
          id: "unsafe-light",
          metadata: { name: "Unsafe Light" },
          status: { reachable: true },
          api_key: "secret-api-key",
          token: "secret-token",
          password: "secret-password",
        } as unknown as {
          id: string;
          metadata: { name: string };
          status: { reachable: boolean };
        },
      ],
    });
    const json = JSON.stringify(result);

    expect(result).toMatchObject({
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
    expect(json).not.toContain("config_ref:hue");
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("secret-password");
  });

  it("keeps live Hue implementation and Phase 16A disabled guards pinned off", () => {
    expect(HUE_READ_ONLY_ADAPTER_MODE).toMatchObject({
      enabled: false,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      real_reads_implemented: false,
      real_writes_implemented: false,
    });
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
  });

  it("keeps Hue adapter files free of SDK, network, discovery, and cloud implementations", () => {
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

  it("documents Phase 16B fixture conformance and live-read non-implementation", () => {
    const doc = read("docs/phase-16/phase-16b-read-only.md");
    const closeout = read("docs/phase-16/phase-16b5-fixture-conformance.md");

    for (const required of [
      "Phase 16B live Hue reads are still not implemented",
      "fixture conformance only proves mapper/adapter shape",
      "Phase 16B.6 - Live Read Boundary Preflight",
    ]) {
      expect(doc).toContain(required);
      expect(closeout).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
