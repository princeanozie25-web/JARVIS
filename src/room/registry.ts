import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseRoomProfile } from "./schema";
import type {
  Device,
  RetentionPolicy,
  RoomPolicy,
  RoomProfile,
  Sensor,
  Zone,
} from "./types";

export const DEFAULT_ROOM_PROFILE_PATH = resolve(
  process.cwd(),
  "config/room/default-room.yaml",
);

export interface RoomRegistry {
  readonly profileId: string;
  getProfile(): RoomProfile;
  getRoom(): Pick<RoomProfile, "room_id" | "name" | "deployment_scope">;
  listZones(): Zone[];
  getZone(id: string): Zone | null;
  listDevices(): Device[];
  getDevice(id: string): Device | null;
  listSensors(): Sensor[];
  getSensor(id: string): Sensor | null;
  getPolicy(): RoomPolicy;
  getRetentionPolicy(): RetentionPolicy;
  getAuthoritySnapshot(): RoomRegistryAuthoritySnapshot;
}

export interface RoomRegistryAuthoritySnapshot {
  readonly adapterExecutionAvailable: false;
  readonly persistenceEnabled: false;
  readonly networkCallsEnabled: false;
  readonly hardwareIoEnabled: false;
  readonly providerWiringEnabled: false;
  readonly uiRenderingEnabled: false;
  readonly mutationSurfaceEnabled: false;
}

export function loadDefaultRoomRegistry(): RoomRegistry {
  return loadRoomRegistryFromFile(DEFAULT_ROOM_PROFILE_PATH);
}

export function loadRoomRegistryFromFile(path: string): RoomRegistry {
  return createRoomRegistryFromYaml(readFileSync(path, "utf8"));
}

export function createRoomRegistryFromYaml(yamlText: string): RoomRegistry {
  return createRoomRegistry(parseRoomProfileYaml(yamlText));
}

export function parseRoomProfileYaml(yamlText: string): RoomProfile {
  return parseRoomProfile(parseYaml(yamlText));
}

export function createRoomRegistry(profile: RoomProfile): RoomRegistry {
  const canonicalProfile = deepFreeze(clone(profile));

  return {
    profileId: canonicalProfile.profile_id,
    getProfile: () => clone(canonicalProfile),
    getRoom: () =>
      clone({
        room_id: canonicalProfile.room_id,
        name: canonicalProfile.name,
        deployment_scope: canonicalProfile.deployment_scope,
      }),
    listZones: () => clone(canonicalProfile.zones),
    getZone: (id) =>
      clone(canonicalProfile.zones.find((zone) => zone.id === id) ?? null),
    listDevices: () => clone(canonicalProfile.devices),
    getDevice: (id) =>
      clone(
        canonicalProfile.devices.find((device) => device.id === id) ?? null,
      ),
    listSensors: () => clone(canonicalProfile.sensors),
    getSensor: (id) =>
      clone(
        canonicalProfile.sensors.find((sensor) => sensor.id === id) ?? null,
      ),
    getPolicy: () => clone(canonicalProfile.policy),
    getRetentionPolicy: () => clone(canonicalProfile.policy.retention),
    getAuthoritySnapshot: () => ({
      adapterExecutionAvailable: false,
      persistenceEnabled: false,
      networkCallsEnabled: false,
      hardwareIoEnabled: false,
      providerWiringEnabled: false,
      uiRenderingEnabled: false,
      mutationSurfaceEnabled: false,
    }),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}
