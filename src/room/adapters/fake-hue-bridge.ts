import { parseRoomProfile } from "../schema";
import type { Capability, Device, RoomProfile, Zone } from "../types";
import {
  FakeFailureController,
  fakeBlockingFailureClassFor,
  type FakeDeviceFailureMode,
  type FakeFailureSeed,
} from "./fake-failures";

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

export interface FakeHueBridgeReadIdentity {
  readonly bridge_id: "fake-hue-bridge";
  readonly name: "JARVIS Fake Hue Bridge";
  readonly api_version: "v2";
  readonly read_contract_version: "phase_16a_read_snapshot_v1";
  readonly source_adapter: "fake_hue_bridge";
  readonly adapter_kind: "fake";
  readonly fake_only: true;
  readonly local_only: true;
  readonly read_only: true;
  readonly discovery_enabled: false;
  readonly network_called: false;
  readonly real_hue_sdk_loaded: false;
}

export interface FakeHueLightState {
  readonly on: boolean;
  readonly brightness_percent: number | null;
  readonly color_hex: string | null;
  readonly color_temperature_kelvin: number | null;
  readonly stale: boolean;
}

export interface FakeHueFreshnessSnapshot {
  readonly observed_at_ms: number | null;
  readonly stale_after_ms: number;
  readonly expires_at_ms: number | null;
  readonly source: "mock";
  readonly stale: boolean;
}

export interface FakeHueLightReadSnapshot {
  readonly id: string;
  readonly name: string;
  readonly zone_id: string;
  readonly source_adapter: "fake_hue_bridge";
  readonly adapter_kind: "fake";
  readonly fake_only: true;
  readonly local_only: true;
  readonly read_only: true;
  readonly reachable: boolean;
  readonly reachability: "reachable" | "unreachable";
  readonly unavailable_reason:
    | "adapter_unavailable"
    | "timeout"
    | "auth_error"
    | null;
  readonly capabilities: readonly Capability[];
  readonly on: boolean | null;
  readonly brightness_percent: number | null;
  readonly color_hex: string | null;
  readonly color_temperature_kelvin: number | null;
  readonly freshness: FakeHueFreshnessSnapshot;
  readonly raw_hue_payload_included: false;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
}

export interface FakeHueBridgeReadSnapshot {
  readonly bridge: FakeHueBridgeReadIdentity;
  readonly lights: readonly FakeHueLightReadSnapshot[];
  readonly read_only: true;
  readonly deterministic: true;
  readonly fake_only: true;
  readonly local_only: true;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly raw_hue_payload_included: false;
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
  readonly error:
    | "unsupported_capability"
    | "unknown_light"
    | "adapter_unavailable"
    | "timeout"
    | "auth_error"
    | null;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly one_light_one_capability_action: true;
}

export interface FakeHueReadResult {
  readonly ok: boolean;
  readonly light_id: string;
  readonly light: FakeHueLight | null;
  readonly error:
    | "unknown_light"
    | "adapter_unavailable"
    | "timeout"
    | "auth_error"
    | null;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
}

export interface FakeHueLightStatePatch {
  readonly on?: boolean;
  readonly brightness_percent?: number;
  readonly color_hex?: string;
  readonly color_temperature_kelvin?: number;
}

export interface FakeHueMultiWriteResult {
  readonly ok: boolean;
  readonly light_id: string;
  readonly capabilities: readonly Capability[];
  readonly applied_capabilities: readonly Capability[];
  readonly rejected_capabilities: readonly Capability[];
  readonly state: FakeHueLightState | null;
  readonly error:
    | "unsupported_capability"
    | "unknown_light"
    | "adapter_unavailable"
    | "timeout"
    | "auth_error"
    | "partial_success"
    | null;
  readonly partial_success: boolean;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
}

export interface FakeHueBridgeOptions {
  readonly failures?: FakeFailureController | readonly FakeFailureSeed[];
}

export class FakeHueBridge {
  private readonly lights = new Map<string, FakeHueLight>();
  private readonly groups = new Map<string, FakeHueGroup>();
  private readonly failures: FakeFailureController;

  constructor(profile: RoomProfile, options: FakeHueBridgeOptions = {}) {
    const parsed = parseRoomProfile(profile);
    this.failures =
      options.failures instanceof FakeFailureController
        ? options.failures
        : new FakeFailureController(options.failures ?? []);
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
          color_temperature_kelvin: device.state.color_temperature_kelvin,
          stale: false,
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

  readSnapshot(): FakeHueBridgeReadSnapshot {
    return {
      bridge: {
        bridge_id: "fake-hue-bridge",
        name: "JARVIS Fake Hue Bridge",
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
      lights: [...this.lights.values()]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((light) => this.lightReadSnapshot(light)),
      read_only: true,
      deterministic: true,
      fake_only: true,
      local_only: true,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
      raw_hue_payload_included: false,
    };
  }

  listLights(): FakeHueLight[] {
    return clone(
      [...this.lights.values()].sort((a, b) => a.id.localeCompare(b.id)),
    ).map((light) => this.readableLight(light));
  }

  getLight(id: string): FakeHueLight | null {
    const light = this.lights.get(id);
    return light ? this.readableLight(light) : null;
  }

  readLight(id: string): FakeHueReadResult {
    const light = this.lights.get(id);
    if (!light) return readResult(id, null, "unknown_light");
    const blockingFailure = this.failures.firstBlockingFailure(id);
    if (blockingFailure) {
      return readResult(id, null, fakeBlockingFailureClassFor(blockingFailure));
    }
    return readResult(id, this.readableLight(light), null);
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

  setLightState(
    lightId: string,
    patch: FakeHueLightStatePatch,
    options: { readonly allowPartialSuccess?: boolean } = {},
  ): FakeHueMultiWriteResult {
    const light = this.lights.get(lightId);
    const capabilities = capabilitiesForPatch(patch);
    if (!light) {
      return multiResult(lightId, capabilities, [], capabilities, null, {
        error: "unknown_light",
      });
    }

    const blockingFailure = this.failures.firstBlockingFailure(lightId);
    if (blockingFailure) {
      return multiResult(
        lightId,
        capabilities,
        [],
        capabilities,
        clone(light.state),
        { error: fakeBlockingFailureClassFor(blockingFailure) },
      );
    }

    const unsupported = capabilities.filter(
      (capability) => !light.capabilities.includes(capability),
    );
    const supported = capabilities.filter((capability) =>
      light.capabilities.includes(capability),
    );
    const allowPartial =
      options.allowPartialSuccess === true &&
      this.failures.allowsPartialSuccess(lightId);

    if (unsupported.length > 0 && !allowPartial) {
      return multiResult(
        lightId,
        capabilities,
        [],
        unsupported,
        clone(light.state),
        { error: "unsupported_capability" },
      );
    }

    const nextState = applyPatch(light.state, patch, supported);
    this.lights.set(lightId, {
      ...light,
      state: nextState,
    });

    return multiResult(
      lightId,
      capabilities,
      supported,
      unsupported,
      clone(nextState),
      { error: unsupported.length > 0 ? "partial_success" : null },
    );
  }

  enableFailure(mode: FakeDeviceFailureMode, targetId?: string): void {
    this.failures.enable(mode, targetId);
  }

  clearFailure(mode?: FakeDeviceFailureMode, targetId?: string): void {
    this.failures.clear(mode, targetId);
  }

  clearAllFailures(): void {
    this.failures.clearAll();
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
    const blockingFailure = this.failures.firstBlockingFailure(lightId);
    if (blockingFailure) {
      return result(
        lightId,
        capability,
        clone(light.state),
        fakeBlockingFailureClassFor(blockingFailure),
      );
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

  private readableLight(light: FakeHueLight): FakeHueLight {
    return {
      ...clone(light),
      state: {
        ...light.state,
        stale: this.failures.isStale(light.id),
      },
    };
  }

  private lightReadSnapshot(light: FakeHueLight): FakeHueLightReadSnapshot {
    const blockingFailure = this.failures.firstBlockingFailure(light.id);
    const stale = this.failures.isStale(light.id);
    const reachable = blockingFailure === null;

    return {
      id: light.id,
      name: light.name,
      zone_id: light.zone_id,
      source_adapter: "fake_hue_bridge",
      adapter_kind: "fake",
      fake_only: true,
      local_only: true,
      read_only: true,
      reachable,
      reachability: reachable ? "reachable" : "unreachable",
      unavailable_reason: blockingFailure
        ? fakeBlockingFailureClassFor(blockingFailure)
        : null,
      capabilities: [...light.capabilities],
      on: reachable ? light.state.on : null,
      brightness_percent: reachable ? light.state.brightness_percent : null,
      color_hex: reachable ? light.state.color_hex : null,
      color_temperature_kelvin: reachable
        ? light.state.color_temperature_kelvin
        : null,
      freshness: {
        observed_at_ms: reachable ? 0 : null,
        stale_after_ms: 30_000,
        expires_at_ms: reachable ? 30_000 : null,
        source: "mock",
        stale,
      },
      raw_hue_payload_included: false,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
    };
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

function readResult(
  lightId: string,
  light: FakeHueLight | null,
  error: FakeHueReadResult["error"],
): FakeHueReadResult {
  return {
    ok: error === null,
    light_id: lightId,
    light,
    error,
    network_called: false,
    hardware_io_performed: false,
    persisted: false,
  };
}

function multiResult(
  lightId: string,
  capabilities: readonly Capability[],
  appliedCapabilities: readonly Capability[],
  rejectedCapabilities: readonly Capability[],
  state: FakeHueLightState | null,
  options: { readonly error: FakeHueMultiWriteResult["error"] },
): FakeHueMultiWriteResult {
  return {
    ok: options.error === null,
    light_id: lightId,
    capabilities,
    applied_capabilities: appliedCapabilities,
    rejected_capabilities: rejectedCapabilities,
    state,
    error: options.error,
    partial_success: options.error === "partial_success",
    network_called: false,
    hardware_io_performed: false,
    persisted: false,
  };
}

function capabilitiesForPatch(patch: FakeHueLightStatePatch): Capability[] {
  const capabilities: Capability[] = [];
  if ("on" in patch) capabilities.push("power.switch");
  if ("brightness_percent" in patch) capabilities.push("light.dimmer");
  if ("color_hex" in patch) capabilities.push("light.color");
  if ("color_temperature_kelvin" in patch)
    capabilities.push("light.temperature");
  return capabilities;
}

function applyPatch(
  current: FakeHueLightState,
  patch: FakeHueLightStatePatch,
  capabilities: readonly Capability[],
): FakeHueLightState {
  let next = clone(current);
  if (capabilities.includes("power.switch") && patch.on !== undefined) {
    next = { ...next, on: patch.on };
  }
  if (
    capabilities.includes("light.dimmer") &&
    patch.brightness_percent !== undefined
  ) {
    next = {
      ...next,
      brightness_percent: Math.min(
        100,
        Math.max(0, Math.round(patch.brightness_percent)),
      ),
    };
  }
  if (capabilities.includes("light.color") && patch.color_hex !== undefined) {
    next = { ...next, color_hex: patch.color_hex };
  }
  if (
    capabilities.includes("light.temperature") &&
    patch.color_temperature_kelvin !== undefined
  ) {
    next = {
      ...next,
      color_temperature_kelvin: Math.min(
        6500,
        Math.max(2000, Math.round(patch.color_temperature_kelvin)),
      ),
    };
  }
  return next;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
