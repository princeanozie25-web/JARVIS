import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HUE_READ_MAPPER_CONTRACT_VERSION,
  mapHueBridgePayloadToReadSnapshot,
  mapHueLightPayloadToReadSnapshot,
  mapHueReadPayloadsToBridgeSnapshot,
  type HueBridgeV2LightPayloadFixture,
} from "../../../src/room/adapters/hue-read-mapper";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../../src/room/adapters/phase-16-disabled-guards";

const BRIDGE_FIXTURE = {
  id: "bridge-001",
  name: "Office Hue Bridge",
  api_version: "1.58.0",
};

const DESK_LIGHT_FIXTURE = {
  id: "light-001",
  metadata: { name: "Desk Lamp" },
  owner: { rid: "desk", rtype: "room" },
  on: { on: true },
  dimming: { brightness: 42.4 },
  color: { xy: { x: 0.3, y: 0.32 } },
  color_temperature: { mirek: 370 },
  status: { reachable: true },
  capabilities: ["on", "dimming", "color", "color_temperature"],
  last_seen_at_ms: 1_000,
} satisfies HueBridgeV2LightPayloadFixture;

describe("Phase 16B.3 Hue read-only request/result mapper", () => {
  it("maps bridge metadata into read-only adapter snapshot metadata", () => {
    expect(mapHueBridgePayloadToReadSnapshot(BRIDGE_FIXTURE)).toEqual({
      bridge_id: "bridge-001",
      name: "Office Hue Bridge",
      api_version: "1.58.0",
      read_contract_version: HUE_READ_MAPPER_CONTRACT_VERSION,
      source_adapter: "hue_read_mapper",
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      enabled: false,
      read_only: true,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      raw_hue_payload_included: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      missing_fields: [],
      degraded: false,
    });
  });

  it("maps reachable Hue light payloads without network or write authority", () => {
    expect(mapHueLightPayloadToReadSnapshot(DESK_LIGHT_FIXTURE)).toMatchObject({
      id: "light-001",
      name: "Desk Lamp",
      zone_id: "desk",
      source_adapter: "hue_read_mapper",
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      enabled: false,
      local_only: true,
      read_only: true,
      reachable: true,
      reachability: "reachable",
      unavailable_reason: null,
      capabilities: [
        "power.observe",
        "light.observe",
        "power.switch",
        "light.dimmer",
        "light.color",
        "light.temperature",
      ],
      on: true,
      brightness_percent: 42,
      color_hex: null,
      color_xy: { x: 0.3, y: 0.32 },
      color_temperature_kelvin: 2703,
      freshness: {
        observed_at_ms: 1_000,
        stale_after_ms: 30_000,
        expires_at_ms: 31_000,
        source: "local_hue_bridge",
        stale: false,
      },
      unsupported_fields: ["color.xy_to_hex"],
      raw_hue_payload_included: false,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
    });
  });

  it("represents unreachable and missing Hue fields as degraded metadata without guessing", () => {
    expect(
      mapHueLightPayloadToReadSnapshot({
        id: "light-002",
        metadata: { name: "Unreachable Lamp" },
        status: { reachable: false },
      }),
    ).toMatchObject({
      reachable: false,
      reachability: "unreachable",
      unavailable_reason: "adapter_unavailable",
      on: null,
      brightness_percent: null,
      color_hex: null,
      color_xy: null,
      color_temperature_kelvin: null,
      freshness: {
        observed_at_ms: null,
        expires_at_ms: null,
        source: "local_hue_bridge",
      },
      degraded: true,
    });

    const unknown = mapHueLightPayloadToReadSnapshot({});
    expect(unknown).toMatchObject({
      id: null,
      name: null,
      reachable: null,
      reachability: "unknown",
      unavailable_reason: null,
      on: null,
      brightness_percent: null,
      color_temperature_kelvin: null,
      degraded: true,
    });
    expect(unknown.missing_fields).toEqual(
      expect.arrayContaining([
        "id",
        "metadata.name",
        "status.reachable",
        "color_temperature.mirek",
      ]),
    );
  });

  it("keeps unsupported and invalid Hue fields explicit instead of inferring state", () => {
    const mapped = mapHueLightPayloadToReadSnapshot({
      ...DESK_LIGHT_FIXTURE,
      dimming: { brightness: 150 },
      color: { xy: { x: 1.2, y: 0.5 } },
      color_temperature: { mirek: -1 },
    });

    expect(mapped).toMatchObject({
      brightness_percent: null,
      color_hex: null,
      color_xy: null,
      color_temperature_kelvin: null,
      degraded: true,
    });
    expect(mapped.invalid_fields).toEqual(
      expect.arrayContaining([
        "dimming.brightness",
        "color.xy",
        "color_temperature.mirek",
      ]),
    );
  });

  it("maps bridge plus light fixtures deterministically and sorted by light id", () => {
    const first = mapHueReadPayloadsToBridgeSnapshot({
      bridge: BRIDGE_FIXTURE,
      lights: [
        { ...DESK_LIGHT_FIXTURE, id: "light-b" },
        { ...DESK_LIGHT_FIXTURE, id: "light-a" },
      ],
    });
    const second = mapHueReadPayloadsToBridgeSnapshot({
      bridge: BRIDGE_FIXTURE,
      lights: [
        { ...DESK_LIGHT_FIXTURE, id: "light-b" },
        { ...DESK_LIGHT_FIXTURE, id: "light-a" },
      ],
    });

    expect(first).toEqual(second);
    expect(first.lights.map((light) => light.id)).toEqual([
      "light-a",
      "light-b",
    ]);
    expect(first).toMatchObject({
      read_only: true,
      deterministic: true,
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      enabled: false,
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
      raw_hue_payload_included: false,
    });
  });

  it("does not surface config refs, API keys, or raw payloads in mapped results", () => {
    const unsafeFixture = {
      ...DESK_LIGHT_FIXTURE,
      api_key: "secret-api-key",
      api_key_config_ref: "config_ref:hue.local.placeholder",
      token: "secret-token",
    } as unknown as HueBridgeV2LightPayloadFixture;

    const mapped = mapHueReadPayloadsToBridgeSnapshot({
      bridge: {
        ...BRIDGE_FIXTURE,
        api_key_config_ref: "config_ref:hue.local.placeholder",
      } as unknown as typeof BRIDGE_FIXTURE,
      lights: [unsafeFixture],
    });
    const json = JSON.stringify(mapped);

    expect(mapped).toMatchObject({
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      raw_hue_payload_included: false,
    });
    expect(json).not.toContain("secret-api-key");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("config_ref:hue");
  });

  it("keeps Phase 16 disabled guards pinned while adding read mapping only", () => {
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

  it("does not add SDK, discovery, cloud, or network execution markers", () => {
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );
    const mapperSource = readFileSync(
      join(process.cwd(), "src/room/adapters/hue-read-mapper.ts"),
      "utf8",
    );

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(mapperSource).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });
});
