import { describe, expect, it } from "vitest";

import {
  createRoomRegistryFromYaml,
  loadDefaultRoomRegistry,
} from "../../src/room/registry";

describe("Phase 10B.2 fake room registry", () => {
  it("loads default-room.yaml successfully", () => {
    const registry = loadDefaultRoomRegistry();

    expect(registry.profileId).toBe("bedroom-workspace-default");
    expect(registry.getRoom()).toEqual({
      room_id: "bedroom-workspace",
      name: "Bedroom Workspace",
      deployment_scope: "one_room",
    });
  });

  it("exposes zones, devices, and sensors correctly", () => {
    const registry = loadDefaultRoomRegistry();

    expect(registry.listZones().map((zone) => zone.id)).toEqual([
      "desk",
      "bed",
      "door",
      "ambient",
    ]);
    expect(registry.listDevices().map((device) => device.id)).toEqual([
      "desk_lamp",
      "bed_lamp",
      "led_strip",
      "smart_plug",
    ]);
    expect(registry.listSensors().map((sensor) => sensor.id)).toEqual([
      "motion_door",
      "presence_desk",
    ]);
    expect(registry.getZone("desk")?.name).toBe("Desk");
    expect(registry.getDevice("led_strip")?.capabilities).toContain(
      "light.color",
    );
    expect(registry.getSensor("presence_desk")?.kind).toBe("presence");
  });

  it("keeps all adapter refs fake and local-only", () => {
    const registry = loadDefaultRoomRegistry();
    const refs = [
      ...registry.listDevices().map((device) => device.adapter),
      ...registry.listSensors().map((sensor) => sensor.adapter),
    ];

    expect(refs.every((ref) => ref.kind === "fake")).toBe(true);
    expect(refs.every((ref) => ref.local_only === true)).toBe(true);
    expect(refs.every((ref) => ref.real_adapter === false)).toBe(true);
    expect(refs.every((ref) => ref.network_access === false)).toBe(true);
    expect(refs.every((ref) => ref.hardware_io === false)).toBe(true);
  });

  it("applies trust class defaults and preserves explicit fake light declarations", () => {
    const registry = loadDefaultRoomRegistry();
    const trustByDevice = Object.fromEntries(
      registry.listDevices().map((device) => [device.id, device.trust_class]),
    );
    const trustBySensor = Object.fromEntries(
      registry.listSensors().map((sensor) => [sensor.id, sensor.trust_class]),
    );

    expect(trustByDevice).toEqual({
      desk_lamp: "safe_mutate",
      bed_lamp: "safe_mutate",
      led_strip: "safe_mutate",
      smart_plug: "observe_only",
    });
    expect(trustBySensor).toEqual({
      motion_door: "observe_only",
      presence_desk: "observe_only",
    });
  });

  it("returns defensive copies so callers cannot mutate canonical profile", () => {
    const registry = loadDefaultRoomRegistry();
    const firstRead = registry.getProfile();
    firstRead.devices[0].name = "Mutated Lamp";
    firstRead.policy.retention.telemetry_days = 30;
    firstRead.zones.push({
      id: "intruder",
      name: "Intruder",
      purpose: "Should not persist",
    });

    expect(registry.getDevice("desk_lamp")?.name).toBe("Desk Lamp");
    expect(registry.listZones().map((zone) => zone.id)).not.toContain(
      "intruder",
    );
  });

  it("rejects malformed YAML/profile shapes", () => {
    expect(() =>
      createRoomRegistryFromYaml(`
schema_version: 1
profile_id: malformed
room_id: malformed
name: Broken Room
deployment_scope: one_room
local_only: true
zones: []
policy:
  local_first: true
`),
    ).toThrow();
  });

  it("keeps policies declarative only and retention aligned with Phase 10B.1", () => {
    const registry = loadDefaultRoomRegistry();

    expect(
      registry
        .getPolicy()
        .rules.every((rule) => rule.declarative_only && !rule.executes_action),
    ).toBe(true);
    expect(registry.getRetentionPolicy()).toEqual({
      audit: "forever",
      telemetry_days: 30,
      replay_metadata_days: 90,
      raw_payload_retention: false,
    });
  });

  it("exposes no adapter execution, persistence, provider, network, hardware, mutation, or UI path", async () => {
    const registry = loadDefaultRoomRegistry();
    const moduleExports = Object.keys(await import("../../src/room/registry"));

    expect(registry.getAuthoritySnapshot()).toEqual({
      adapterExecutionAvailable: false,
      persistenceEnabled: false,
      networkCallsEnabled: false,
      hardwareIoEnabled: false,
      providerWiringEnabled: false,
      uiRenderingEnabled: false,
      mutationSurfaceEnabled: false,
    });
    expect(
      moduleExports.some((name) =>
        /execute|dispatch|persist|connect/i.test(name),
      ),
    ).toBe(false);
  });
});
