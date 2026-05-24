import { describe, expect, it } from "vitest";

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
});
