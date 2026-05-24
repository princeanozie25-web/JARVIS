import { parseRoomProfile } from "../schema";
import type { Capability, Device, RoomProfile, Zone } from "../types";

export interface FakeHueBridgeMetadata {
  readonly id: "fake-hue-bridge";
  readonly name: "JARVIS Fake Hue Bridge";
  readonly api_version: "v2";
  readonly local_only: true;
  readonly fake_only: true;
  readonly discovery_enabled: false;
  readonly network_called: false;
  readonly real_hue_sdk_loaded: false;
}

export interface FakeHueLightState {
  readonly on: boolean;
  readonly brightness_percent: number | null;
  readonly color_hex: string | null;
  readonly color_temperature_kelvin: number | null;
}

export interface FakeHueLight {
  readonly id: string;
  readonly name: string;
  readonly zone_id: string;
  readonly capabilities: readonly Capability[];
  readonly state: FakeHueLightState;
  readonly fake: true;
}

export interface FakeHueGroup {
  readonly id: string;
  readonly name: string;
  readonly light_ids: readonly string[];
  readonly fake: true;
}

export interface FakeHueWriteResult {
  readonly ok: boolean;
  readonly light_id: string;
  readonly capability: Capability;
  readonly state: FakeHueLightState | null;
  readonly error: "unsupported_capability" | "unknown_light" | null;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly one_light_one_capability_action: true;
}

export class FakeHueBridge {
  private readonly lights = new Map<string, FakeHueLight>();
  private readonly groups = new Map<string, FakeHueGroup>();

  constructor(profile: RoomProfile) {
    const parsed = parseRoomProfile(profile);
    for (const device of parsed.devices.filter(isHueEligibleLight)) {
      this.lights.set(device.id, {
        id: device.id,
        name: device.name,
        zone_id: device.zone_id,
        capabilities: [...device.capabilities],
        state: {
          on: device.state.power === "on",
          brightness_percent: device.state.brightness_percent,
          color_hex: device.state.color_hex,
          color_temperature_kelvin: null,
        },
        fake: true,
      });
    }
    for (const zone of parsed.zones) {
      const lightIds = [...this.lights.values()]
        .filter((light) => light.zone_id === zone.id)
        .map((light) => light.id)
        .sort();
      this.groups.set(zone.id, groupFromZone(zone, lightIds));
    }
  }

  getBridge(): FakeHueBridgeMetadata {
    return {
      id: "fake-hue-bridge",
      name: "JARVIS Fake Hue Bridge",
      api_version: "v2",
      local_only: true,
      fake_only: true,
      discovery_enabled: false,
      network_called: false,
      real_hue_sdk_loaded: false,
    };
  }

  listLights(): FakeHueLight[] {
    return clone(
      [...this.lights.values()].sort((a, b) => a.id.localeCompare(b.id)),
    );
  }

  getLight(id: string): FakeHueLight | null {
    return clone(this.lights.get(id) ?? null);
  }

  listGroups(): FakeHueGroup[] {
    return clone(
      [...this.groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
    );
  }

  getGroup(id: string): FakeHueGroup | null {
    return clone(this.groups.get(id) ?? null);
  }

  setOn(lightId: string, on: boolean): FakeHueWriteResult {
    return this.write(lightId, "power.switch", (light) => ({
      ...light.state,
      on,
    }));
  }

  setBrightness(
    lightId: string,
    brightnessPercent: number,
  ): FakeHueWriteResult {
    return this.write(lightId, "light.dimmer", (light) => ({
      ...light.state,
      brightness_percent: Math.min(
        100,
        Math.max(0, Math.round(brightnessPercent)),
      ),
    }));
  }

  setColor(lightId: string, colorHex: string): FakeHueWriteResult {
    return this.write(lightId, "light.color", (light) => ({
      ...light.state,
      color_hex: colorHex,
    }));
  }

  setTemperature(lightId: string, kelvin: number): FakeHueWriteResult {
    return this.write(lightId, "light.temperature", (light) => ({
      ...light.state,
      color_temperature_kelvin: Math.min(
        6500,
        Math.max(2000, Math.round(kelvin)),
      ),
    }));
  }

  private write(
    lightId: string,
    capability: Capability,
    apply: (light: FakeHueLight) => FakeHueLightState,
  ): FakeHueWriteResult {
    const light = this.lights.get(lightId);
    if (!light) {
      return result(lightId, capability, null, "unknown_light");
    }
    if (!light.capabilities.includes(capability)) {
      return result(
        lightId,
        capability,
        clone(light.state),
        "unsupported_capability",
      );
    }
    const updated = {
      ...light,
      state: apply(light),
    };
    this.lights.set(lightId, updated);
    return result(lightId, capability, clone(updated.state), null);
  }
}

function isHueEligibleLight(device: Device): boolean {
  return (
    device.kind === "light" &&
    device.adapter.kind === "fake" &&
    device.capabilities.includes("light.observe")
  );
}

function groupFromZone(zone: Zone, lightIds: string[]): FakeHueGroup {
  return {
    id: zone.id,
    name: zone.name,
    light_ids: lightIds,
    fake: true,
  };
}

function result(
  lightId: string,
  capability: Capability,
  state: FakeHueLightState | null,
  error: FakeHueWriteResult["error"],
): FakeHueWriteResult {
  return {
    ok: error === null,
    light_id: lightId,
    capability,
    state,
    error,
    network_called: false,
    hardware_io_performed: false,
    persisted: false,
    one_light_one_capability_action: true,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
