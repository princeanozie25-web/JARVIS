import { describe, expect, it } from "vitest";

import {
  RoomProfileSchema,
  parseRoomProfile,
  validateRoomProfile,
} from "../../src/room/schema";

function adapter(id = "fake-room-adapter") {
  return {
    adapter_id: id,
    kind: "fake",
    local_only: true,
    real_adapter: false,
    network_access: false,
    hardware_io: false,
  };
}

function freshness() {
  return {
    observed_at_ms: 0,
    stale_after_ms: 30_000,
    expires_at_ms: 30_000,
    source: "mock",
  };
}

function validProfile() {
  return {
    schema_version: 1,
    profile_id: "default-room-profile",
    room_id: "bedroom",
    name: "Bedroom Workspace",
    deployment_scope: "one_room",
    local_only: true,
    zones: [
      {
        id: "desk",
        name: "Desk",
        purpose: "Work and coding zone",
      },
      {
        id: "ambient",
        name: "Ambient",
        purpose: "Room background state",
      },
    ],
    devices: [
      {
        id: "desk-lamp",
        name: "Desk Lamp",
        zone_id: "desk",
        kind: "light",
        capabilities: ["power.observe", "light.observe", "light.dimmer"],
        adapter: adapter(),
        trust_class: "safe_mutate",
        state: {
          power: "off",
          brightness_percent: 0,
          color_hex: null,
          derived: false,
          freshness: freshness(),
        },
      },
    ],
    sensors: [
      {
        id: "desk-presence",
        name: "Desk Presence",
        zone_id: "desk",
        kind: "presence",
        capabilities: ["presence.observe"],
        adapter: adapter("fake-presence-sensor"),
        trust_class: "observe_only",
        state: {
          value: false,
          unit: null,
          derived: false,
          freshness: freshness(),
        },
      },
    ],
    policy: {
      local_first: true,
      fake_first: true,
      one_room_first: true,
      public_network_exposure: false,
      real_hardware_enabled: false,
      real_adapters_enabled: false,
      background_capture_enabled: false,
      autonomous_execution_enabled: false,
      rules: [
        {
          id: "deny-background-capture",
          scope: "room",
          target_id: "bedroom",
          effect: "deny",
          reason: "No background capture in Phase 10 substrate.",
          declarative_only: true,
          executes_action: false,
        },
      ],
      approval: {
        approval_required_for: ["safe_mutate", "restricted_mutate"],
        auto_approval_enabled: false,
        voice_only_approval_enabled: false,
        dry_run_required: true,
      },
      retention: {
        audit: "forever",
        telemetry_days: 30,
        replay_metadata_days: 90,
        raw_payload_retention: false,
      },
    },
    substrate_only: true,
    registry_loading_implemented: false,
    adapters_implemented: false,
    hardware_io_enabled: false,
    network_calls_enabled: false,
    persistence_enabled: false,
    ui_rendering_enabled: false,
    provider_wiring_enabled: false,
    mutation_surface_enabled: false,
  };
}

function withoutKey<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

describe("Phase 10B.1 Room Profile schema", () => {
  it("accepts a valid default-style one-room profile", () => {
    const parsed = parseRoomProfile(validProfile());

    expect(RoomProfileSchema.parse(parsed)).toEqual(parsed);
    expect(parsed).toMatchObject({
      deployment_scope: "one_room",
      local_only: true,
      substrate_only: true,
      policy: {
        local_first: true,
        fake_first: true,
        one_room_first: true,
      },
    });
  });

  it("rejects malformed zones, devices, and sensors", () => {
    const profile = validProfile();

    expect(
      validateRoomProfile({
        ...profile,
        zones: [{ ...profile.zones[0], id: "Desk With Spaces" }],
      }).success,
    ).toBe(false);
    expect(
      validateRoomProfile({
        ...profile,
        devices: [{ ...profile.devices[0], zone_id: "missing-zone" }],
      }).success,
    ).toBe(false);
    expect(
      validateRoomProfile({
        ...profile,
        sensors: [{ ...profile.sensors[0], capabilities: [] }],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown trust classes", () => {
    const profile = validProfile();

    expect(
      validateRoomProfile({
        ...profile,
        devices: [{ ...profile.devices[0], trust_class: "trusted_root" }],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown capabilities", () => {
    const profile = validProfile();

    expect(
      validateRoomProfile({
        ...profile,
        devices: [
          {
            ...profile.devices[0],
            capabilities: ["power.observe", "robotics.execute"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects missing adapter refs", () => {
    const profile = validProfile();
    const deviceWithoutAdapter = withoutKey(profile.devices[0], "adapter");

    expect(
      validateRoomProfile({
        ...profile,
        devices: [deviceWithoutAdapter],
      }).success,
    ).toBe(false);
  });

  it("defaults new devices without trust class to observe_only", () => {
    const profile = validProfile();
    const deviceWithoutTrustClass = withoutKey(
      profile.devices[0],
      "trust_class",
    );
    const parsed = parseRoomProfile({
      ...profile,
      devices: [deviceWithoutTrustClass],
    });

    expect(parsed.devices[0].trust_class).toBe("observe_only");
  });

  it("requires derived and observed state to include freshness boundaries", () => {
    const profile = validProfile();

    expect(
      validateRoomProfile({
        ...profile,
        devices: [
          {
            ...profile.devices[0],
            state: {
              ...profile.devices[0].state,
              freshness: undefined,
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(parseRoomProfile(profile).devices[0].state.freshness).toMatchObject({
      stale_after_ms: 30_000,
      expires_at_ms: 30_000,
    });
  });

  it("keeps room policies declarative only", () => {
    const profile = validProfile();

    expect(parseRoomProfile(profile).policy.rules[0]).toMatchObject({
      declarative_only: true,
      executes_action: false,
    });
    expect(
      validateRoomProfile({
        ...profile,
        policy: {
          ...profile.policy,
          rules: [{ ...profile.policy.rules[0], executes_action: true }],
        },
      }).success,
    ).toBe(false);
  });

  it("supports required retention windows", () => {
    expect(parseRoomProfile(validProfile()).policy.retention).toEqual({
      audit: "forever",
      telemetry_days: 30,
      replay_metadata_days: 90,
      raw_payload_retention: false,
    });
  });

  it("contains no mutation, execution, provider, network, adapter, persistence, or UI wiring", () => {
    const parsed = parseRoomProfile(validProfile());

    expect(parsed).toMatchObject({
      registry_loading_implemented: false,
      adapters_implemented: false,
      hardware_io_enabled: false,
      network_calls_enabled: false,
      persistence_enabled: false,
      ui_rendering_enabled: false,
      provider_wiring_enabled: false,
      mutation_surface_enabled: false,
    });
    expect(
      parsed.devices.every((device) => device.adapter.real_adapter === false),
    ).toBe(true);
    expect(
      parsed.sensors.every((sensor) => sensor.adapter.hardware_io === false),
    ).toBe(true);
  });
});
