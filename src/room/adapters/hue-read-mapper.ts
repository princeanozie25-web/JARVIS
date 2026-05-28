import type { Capability } from "../types";

export const HUE_READ_MAPPER_CONTRACT_VERSION = "phase_16b_hue_read_mapper_v1";

export interface HueBridgeV2BridgePayloadFixture {
  readonly id?: string;
  readonly name?: string;
  readonly bridge_id?: string;
  readonly api_version?: string;
}

export interface HueBridgeV2XyCoordinatesFixture {
  readonly x?: number;
  readonly y?: number;
}

export interface HueBridgeV2LightPayloadFixture {
  readonly id?: string;
  readonly metadata?: {
    readonly name?: string;
  };
  readonly owner?: {
    readonly rid?: string;
    readonly rtype?: string;
  };
  readonly on?: {
    readonly on?: boolean;
  };
  readonly dimming?: {
    readonly brightness?: number;
  };
  readonly color?: {
    readonly xy?: HueBridgeV2XyCoordinatesFixture;
  };
  readonly color_temperature?: {
    readonly mirek?: number | null;
  };
  readonly status?: {
    readonly reachable?: boolean;
  };
  readonly capabilities?: readonly string[];
  readonly last_seen_at_ms?: number;
  readonly stale?: boolean;
}

export interface HueReadMapperOptions {
  readonly observedAtMs?: number;
  readonly staleAfterMs?: number;
}

export interface HueReadFreshnessSnapshot {
  readonly observed_at_ms: number | null;
  readonly stale_after_ms: number;
  readonly expires_at_ms: number | null;
  readonly source: "local_hue_bridge";
  readonly stale: boolean;
}

export interface HueReadBridgeIdentitySnapshot {
  readonly bridge_id: string | null;
  readonly name: string | null;
  readonly api_version: string | null;
  readonly read_contract_version: typeof HUE_READ_MAPPER_CONTRACT_VERSION;
  readonly source_adapter: "hue_read_mapper";
  readonly adapter_kind: "hue";
  readonly mode: "read_only";
  readonly source: "local_hue_bridge";
  readonly enabled: false;
  readonly read_only: true;
  readonly writes_supported: false;
  readonly discovery_supported: false;
  readonly cloud_supported: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly raw_hue_payload_included: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly missing_fields: readonly string[];
  readonly degraded: boolean;
}

export interface HueReadLightSnapshot {
  readonly id: string | null;
  readonly name: string | null;
  readonly zone_id: string | null;
  readonly source_adapter: "hue_read_mapper";
  readonly adapter_kind: "hue";
  readonly mode: "read_only";
  readonly source: "local_hue_bridge";
  readonly enabled: false;
  readonly local_only: true;
  readonly read_only: true;
  readonly reachable: boolean | null;
  readonly reachability: "reachable" | "unreachable" | "unknown";
  readonly unavailable_reason: "adapter_unavailable" | null;
  readonly capabilities: readonly Capability[];
  readonly on: boolean | null;
  readonly brightness_percent: number | null;
  readonly color_hex: null;
  readonly color_xy: { readonly x: number; readonly y: number } | null;
  readonly color_temperature_kelvin: number | null;
  readonly freshness: HueReadFreshnessSnapshot;
  readonly missing_fields: readonly string[];
  readonly unsupported_fields: readonly string[];
  readonly invalid_fields: readonly string[];
  readonly degraded: boolean;
  readonly raw_hue_payload_included: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly writes_supported: false;
  readonly discovery_supported: false;
  readonly cloud_supported: false;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
}

export interface HueReadBridgeSnapshot {
  readonly bridge: HueReadBridgeIdentitySnapshot;
  readonly lights: readonly HueReadLightSnapshot[];
  readonly read_only: true;
  readonly deterministic: true;
  readonly adapter_kind: "hue";
  readonly mode: "read_only";
  readonly source: "local_hue_bridge";
  readonly enabled: false;
  readonly writes_supported: false;
  readonly discovery_supported: false;
  readonly cloud_supported: false;
  readonly network_called: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly raw_hue_payload_included: false;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
}

export function mapHueBridgePayloadToReadSnapshot(
  payload: HueBridgeV2BridgePayloadFixture,
): HueReadBridgeIdentitySnapshot {
  const missingFields = requiredMissingFields(payload, ["name", "api_version"]);
  if (payload.id === undefined && payload.bridge_id === undefined) {
    missingFields.unshift("id");
  }

  return {
    bridge_id: payload.id ?? payload.bridge_id ?? null,
    name: payload.name ?? null,
    api_version: payload.api_version ?? null,
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
    missing_fields: missingFields,
    degraded: missingFields.length > 0,
  };
}

export function mapHueLightPayloadToReadSnapshot(
  payload: HueBridgeV2LightPayloadFixture,
  options: HueReadMapperOptions = {},
): HueReadLightSnapshot {
  const staleAfterMs = options.staleAfterMs ?? 30_000;
  const missingFields = requiredMissingFields(payload, [
    "id",
    "metadata.name",
    "status.reachable",
  ]);
  const invalidFields: string[] = [];
  const unsupportedFields: string[] = [];
  const reachable = normalizeReachability(payload);
  const observedAtMs =
    reachable === true
      ? (payload.last_seen_at_ms ?? options.observedAtMs ?? 0)
      : null;
  const colorTemperatureKelvin = mapMirekToKelvin(
    payload.color_temperature?.mirek,
    invalidFields,
    missingFields,
  );
  const colorXy = mapColorXy(payload.color?.xy, invalidFields);

  if (colorXy) {
    unsupportedFields.push("color.xy_to_hex");
  }

  return {
    id: payload.id ?? null,
    name: payload.metadata?.name ?? null,
    zone_id: payload.owner?.rid ?? null,
    source_adapter: "hue_read_mapper",
    adapter_kind: "hue",
    mode: "read_only",
    source: "local_hue_bridge",
    enabled: false,
    local_only: true,
    read_only: true,
    reachable,
    reachability:
      reachable === true
        ? "reachable"
        : reachable === false
          ? "unreachable"
          : "unknown",
    unavailable_reason: reachable === false ? "adapter_unavailable" : null,
    capabilities: mapCapabilities(payload.capabilities),
    on:
      reachable === true && typeof payload.on?.on === "boolean"
        ? payload.on.on
        : null,
    brightness_percent:
      reachable === true
        ? mapBrightness(payload.dimming?.brightness, invalidFields)
        : null,
    color_hex: null,
    color_xy: reachable === true ? colorXy : null,
    color_temperature_kelvin:
      reachable === true ? colorTemperatureKelvin : null,
    freshness: {
      observed_at_ms: observedAtMs,
      stale_after_ms: staleAfterMs,
      expires_at_ms: observedAtMs === null ? null : observedAtMs + staleAfterMs,
      source: "local_hue_bridge",
      stale: payload.stale === true,
    },
    missing_fields: missingFields,
    unsupported_fields: unsupportedFields,
    invalid_fields: invalidFields,
    degraded:
      reachable !== true ||
      missingFields.length > 0 ||
      unsupportedFields.length > 0 ||
      invalidFields.length > 0,
    raw_hue_payload_included: false,
    raw_config_ref_exposed: false,
    raw_api_key_exposed: false,
    writes_supported: false,
    discovery_supported: false,
    cloud_supported: false,
    network_called: false,
    hardware_io_performed: false,
    persisted: false,
  };
}

export function mapHueReadPayloadsToBridgeSnapshot(input: {
  readonly bridge: HueBridgeV2BridgePayloadFixture;
  readonly lights: readonly HueBridgeV2LightPayloadFixture[];
  readonly options?: HueReadMapperOptions;
}): HueReadBridgeSnapshot {
  return {
    bridge: mapHueBridgePayloadToReadSnapshot(input.bridge),
    lights: input.lights
      .map((light) => mapHueLightPayloadToReadSnapshot(light, input.options))
      .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? "")),
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
    raw_config_ref_exposed: false,
    raw_api_key_exposed: false,
  };
}

function mapCapabilities(input: readonly string[] | undefined): Capability[] {
  const capabilities: Capability[] = ["power.observe", "light.observe"];
  if (input?.includes("on")) capabilities.push("power.switch");
  if (input?.includes("dimming")) capabilities.push("light.dimmer");
  if (input?.includes("color")) capabilities.push("light.color");
  if (input?.includes("color_temperature")) {
    capabilities.push("light.temperature");
  }
  return [...new Set(capabilities)];
}

function normalizeReachability(
  payload: HueBridgeV2LightPayloadFixture,
): boolean | null {
  return typeof payload.status?.reachable === "boolean"
    ? payload.status.reachable
    : null;
}

function mapBrightness(
  brightness: number | undefined,
  invalidFields: string[],
): number | null {
  if (brightness === undefined) return null;
  if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) {
    invalidFields.push("dimming.brightness");
    return null;
  }
  return Math.round(brightness);
}

function mapMirekToKelvin(
  mirek: number | null | undefined,
  invalidFields: string[],
  missingFields: string[],
): number | null {
  if (mirek === undefined) {
    missingFields.push("color_temperature.mirek");
    return null;
  }
  if (mirek === null) return null;
  if (!Number.isFinite(mirek) || mirek <= 0) {
    invalidFields.push("color_temperature.mirek");
    return null;
  }
  return Math.round(1_000_000 / mirek);
}

function mapColorXy(
  xy: HueBridgeV2XyCoordinatesFixture | undefined,
  invalidFields: string[],
): { readonly x: number; readonly y: number } | null {
  if (!xy) return null;
  if (
    typeof xy.x !== "number" ||
    typeof xy.y !== "number" ||
    !Number.isFinite(xy.x) ||
    !Number.isFinite(xy.y) ||
    xy.x < 0 ||
    xy.x > 1 ||
    xy.y < 0 ||
    xy.y > 1
  ) {
    invalidFields.push("color.xy");
    return null;
  }
  return { x: xy.x, y: xy.y };
}

function requiredMissingFields(
  payload: HueBridgeV2BridgePayloadFixture | HueBridgeV2LightPayloadFixture,
  paths: readonly string[],
): string[] {
  return paths.filter((path) => readPath(payload, path) === undefined);
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current !== null && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);
}
