import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../../src/room/adapters/phase-16-disabled-guards";
import { FakeHueBridge } from "../../../src/room/adapters/fake-hue-bridge";
import { loadDefaultRoomRegistry } from "../../../src/room/registry";
import { parseRoomProfile } from "../../../src/room/schema";
import type { RoomProfile } from "../../../src/room/types";

function bridge(profile: RoomProfile = loadDefaultRoomRegistry().getProfile()) {
  return new FakeHueBridge(profile);
}

function withoutLedColor(): RoomProfile {
  const profile = loadDefaultRoomRegistry().getProfile();
  return parseRoomProfile({
    ...profile,
    devices: profile.devices.map((device) =>
      device.id === "led_strip"
        ? {
            ...device,
            capabilities: device.capabilities.filter(
              (capability) => capability !== "light.color",
            ),
          }
        : device,
    ),
  });
}

function withoutDeskTemperature(): RoomProfile {
  const profile = loadDefaultRoomRegistry().getProfile();
  return parseRoomProfile({
    ...profile,
    devices: profile.devices.map((device) =>
      device.id === "desk_lamp"
        ? {
            ...device,
            capabilities: device.capabilities.filter(
              (capability) => capability !== "light.temperature",
            ),
          }
        : device,
    ),
  });
}

describe("Phase 10B.5 fake Hue bridge simulator", () => {
  it("exposes deterministic fake bridge metadata", () => {
    expect(bridge().getBridge()).toEqual({
      id: "fake-hue-bridge",
      name: "JARVIS Fake Hue Bridge",
      api_version: "v2",
      local_only: true,
      fake_only: true,
      discovery_enabled: false,
      network_called: false,
      real_hue_sdk_loaded: false,
    });
  });

  it("derives fake lights from eligible fake room devices", () => {
    expect(
      bridge()
        .listLights()
        .map((light) => light.id),
    ).toEqual(["bed_lamp", "desk_lamp", "led_strip"]);
    expect(bridge().getLight("smart_plug")).toBeNull();
  });

  it("exposes deterministic read-only snapshots for future Hue v2 read parity", () => {
    const first = bridge().readSnapshot();
    const second = bridge().readSnapshot();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      bridge: {
        bridge_id: "fake-hue-bridge",
        api_version: "v2",
        read_contract_version: "phase_16a_read_snapshot_v1",
        source_adapter: "fake_hue_bridge",
        adapter_kind: "fake",
        fake_only: true,
        local_only: true,
        read_only: true,
        discovery_enabled: false,
        network_called: false,
        real_hue_sdk_loaded: false,
      },
      read_only: true,
      deterministic: true,
      fake_only: true,
      local_only: true,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
      raw_hue_payload_included: false,
    });
    expect(first.lights.map((light) => light.id)).toEqual([
      "bed_lamp",
      "desk_lamp",
      "led_strip",
    ]);
  });

  it("aligns fake Hue light snapshots with room adapter read metadata", () => {
    const desk = bridge()
      .readSnapshot()
      .lights.find((light) => light.id === "desk_lamp");

    expect(desk).toMatchObject({
      id: "desk_lamp",
      name: "Desk Lamp",
      zone_id: "desk",
      source_adapter: "fake_hue_bridge",
      adapter_kind: "fake",
      fake_only: true,
      local_only: true,
      read_only: true,
      reachable: true,
      reachability: "reachable",
      unavailable_reason: null,
      capabilities: expect.arrayContaining([
        "power.observe",
        "power.switch",
        "light.observe",
        "light.dimmer",
        "light.temperature",
      ]),
      on: false,
      brightness_percent: 0,
      color_hex: null,
      color_temperature_kelvin: null,
      freshness: {
        observed_at_ms: 0,
        stale_after_ms: 30_000,
        expires_at_ms: 30_000,
        source: "mock",
        stale: false,
      },
      raw_hue_payload_included: false,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
    });
  });

  it("light state reads return defensive copies", () => {
    const fake = bridge();
    const first = fake.getLight("desk_lamp");
    if (!first) throw new Error("expected desk lamp");
    const mutable = first as { state: { on: boolean } };
    mutable.state.on = true;

    expect(fake.getLight("desk_lamp")?.state.on).toBe(false);
  });

  it("on/off writes mutate only fake in-memory state", () => {
    const fake = bridge();

    expect(fake.setOn("desk_lamp", true)).toMatchObject({
      ok: true,
      light_id: "desk_lamp",
      capability: "power.switch",
      state: { on: true },
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
    });
    expect(fake.getLight("desk_lamp")?.state.on).toBe(true);
    expect(bridge().getLight("desk_lamp")?.state.on).toBe(false);
  });

  it("brightness writes respect capability boundaries", () => {
    const fake = bridge();

    expect(fake.setBrightness("desk_lamp", 64)).toMatchObject({
      ok: true,
      state: { brightness_percent: 64 },
    });
    expect(fake.setBrightness("missing_light", 30)).toMatchObject({
      ok: false,
      error: "unknown_light",
    });
  });

  it("color writes respect capability boundaries", () => {
    const fake = bridge();
    const noColor = bridge(withoutLedColor());

    expect(fake.setColor("led_strip", "#ffffff")).toMatchObject({
      ok: true,
      state: { color_hex: "#ffffff" },
    });
    expect(fake.setColor("desk_lamp", "#ffffff")).toMatchObject({
      ok: false,
      error: "unsupported_capability",
    });
    expect(noColor.setColor("led_strip", "#ffffff")).toMatchObject({
      ok: false,
      error: "unsupported_capability",
    });
  });

  it("temperature writes respect capability boundaries", () => {
    const fake = bridge();
    const noTemperature = bridge(withoutDeskTemperature());

    expect(fake.setTemperature("desk_lamp", 2700)).toMatchObject({
      ok: true,
      state: { color_temperature_kelvin: 2700 },
    });
    expect(noTemperature.setTemperature("desk_lamp", 2700)).toMatchObject({
      ok: false,
      error: "unsupported_capability",
    });
  });

  it("represents stale and unreachable fake Hue read states without guessing", () => {
    const fake = bridge();
    fake.enableFailure("stale", "desk_lamp");

    expect(
      fake.readSnapshot().lights.find((light) => light.id === "desk_lamp"),
    ).toMatchObject({
      reachable: true,
      reachability: "reachable",
      unavailable_reason: null,
      on: false,
      freshness: { stale: true, observed_at_ms: 0 },
    });

    fake.clearFailure("stale", "desk_lamp");
    fake.enableFailure("offline", "desk_lamp");

    expect(
      fake.readSnapshot().lights.find((light) => light.id === "desk_lamp"),
    ).toMatchObject({
      reachable: false,
      reachability: "unreachable",
      unavailable_reason: "adapter_unavailable",
      on: null,
      brightness_percent: null,
      color_hex: null,
      color_temperature_kelvin: null,
      freshness: {
        observed_at_ms: null,
        expires_at_ms: null,
        source: "mock",
      },
    });
  });

  it("unsupported capability writes are rejected", () => {
    expect(bridge().setColor("bed_lamp", "#ff0000")).toMatchObject({
      ok: false,
      capability: "light.color",
      error: "unsupported_capability",
      one_light_one_capability_action: true,
    });
  });

  it("groups and zones are readable", () => {
    expect(bridge().listGroups()).toEqual([
      { id: "ambient", name: "Ambient", light_ids: ["led_strip"], fake: true },
      { id: "bed", name: "Bed", light_ids: ["bed_lamp"], fake: true },
      { id: "desk", name: "Desk", light_ids: ["desk_lamp"], fake: true },
      { id: "door", name: "Door", light_ids: [], fake: true },
    ]);
    expect(bridge().getGroup("ambient")?.light_ids).toEqual(["led_strip"]);
  });

  it("exposes no network, discovery, or real Hue SDK path", async () => {
    const moduleExports = Object.keys(
      await import("../../../src/room/adapters/fake-hue-bridge"),
    );
    const metadata = bridge().getBridge();

    expect(metadata).toMatchObject({
      discovery_enabled: false,
      network_called: false,
      real_hue_sdk_loaded: false,
    });
    expect(
      moduleExports.some((name) => /discover|network|sdk|connect/i.test(name)),
    ).toBe(false);
  });

  it("keeps Phase 16 disabled guards pinned while aligning fake Hue reads", () => {
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
      real_hue_writes_enabled: false,
      hue_auto_discovery_enabled: false,
      hue_cloud_remote_api_enabled: false,
      real_hue_adapter_enabled: false,
      fake_conformance_required_before_real_hue: true,
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
    });
  });
});
