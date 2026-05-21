import type DatabaseType from "better-sqlite3";
import {
  getEnvironmentRegistry,
  listEnvironmentRegistryMetadata,
} from "../db/environment-registry";
import { DEFAULT_PHASE6_FEATURE_FLAGS } from "./registry";
import {
  createEnvironmentPolicy,
  evaluateEnvironmentAction,
  type EnvironmentPolicy,
  type EnvironmentPolicyEvaluation,
  type EnvironmentPolicyInput,
} from "./policy";
import type {
  Capability,
  Device,
  EnvironmentCapabilityId,
  EnvironmentRegistry,
  EnvironmentTrustClass,
  Room,
  TrustClass,
} from "./types";

export const ENVIRONMENT_READ_MODEL_DEFAULT_LIMIT = 25;
export const ENVIRONMENT_READ_MODEL_MAX_LIMIT = 100;

export interface EnvironmentReadModelLimits {
  rooms?: number;
  devices?: number;
  capabilities?: number;
  trustClasses?: number;
  devicesPerRoom?: number;
}

export interface EnvironmentRegistryFreshness {
  schemaVersion: 1;
  metadataUpdatedAt: number | null;
  liveStateStatus: "not_ingested";
}

export interface EnvironmentReadModelBase {
  metadataOnly: true;
  liveState: false;
  physicalSideEffects: false;
  authoritativeForPhysicalWorld: false;
  source: "environment_registry";
}

export interface EnvironmentCapabilityPolicySignal {
  capabilityId: EnvironmentCapabilityId;
  read: Pick<EnvironmentPolicyEvaluation, "decision" | "reason">;
  mutate: Pick<
    EnvironmentPolicyEvaluation,
    "decision" | "reason" | "approvalRequired"
  >;
  hypotheticalFreshState: true;
  executed: false;
}

export interface EnvironmentRoomSummary {
  id: string;
  displayName: string;
  kind: string;
  deviceCount: number;
}

export interface EnvironmentDeviceSummary {
  id: string;
  displayName: string;
  roomId: string;
  trustClass: EnvironmentTrustClass;
  capabilities: EnvironmentCapabilityId[];
  policySignals: EnvironmentCapabilityPolicySignal[];
}

export interface EnvironmentCapabilitySummary {
  id: EnvironmentCapabilityId;
  displayName: string;
  trustClass: EnvironmentTrustClass;
}

export interface EnvironmentTrustClassSummary {
  id: EnvironmentTrustClass;
  canObserve: boolean;
  canMutate: boolean;
  requiresApproval: boolean;
}

export interface EnvironmentListReadModel extends EnvironmentReadModelBase {
  kind: "environment.list";
  truncated: boolean;
  limits: Required<EnvironmentReadModelLimits>;
  counts: {
    rooms: number;
    devices: number;
    capabilities: number;
    trustClasses: number;
  };
  freshness: EnvironmentRegistryFreshness;
  rooms: EnvironmentRoomSummary[];
  devices: EnvironmentDeviceSummary[];
  capabilities: EnvironmentCapabilitySummary[];
  trustClasses: EnvironmentTrustClassSummary[];
  disabledFeatures: typeof DEFAULT_PHASE6_FEATURE_FLAGS;
}

export interface EnvironmentGetReadModel extends EnvironmentReadModelBase {
  kind: "environment.get";
  targetKind: "room" | "device";
  id: string;
  found: boolean;
  reason: "ok" | "unknown_room" | "unknown_device";
  freshness: EnvironmentRegistryFreshness;
  room:
    | (EnvironmentRoomSummary & { devices: EnvironmentDeviceSummary[] })
    | null;
  device: EnvironmentDeviceSummary | null;
}

export interface EnvironmentRegistryDescriptionReadModel extends EnvironmentReadModelBase {
  kind: "environment.describe_registry";
  truncated: boolean;
  freshness: EnvironmentRegistryFreshness;
  counts: EnvironmentListReadModel["counts"];
  trustClasses: EnvironmentTrustClassSummary[];
  capabilityIds: EnvironmentCapabilityId[];
  rooms: EnvironmentRoomSummary[];
  notes: string[];
}

export interface EnvironmentReadServiceInput {
  db: DatabaseType.Database;
  policy?: EnvironmentPolicy | EnvironmentPolicyInput;
  limits?: EnvironmentReadModelLimits;
}

export interface EnvironmentGetInput extends EnvironmentReadServiceInput {
  targetKind: "room" | "device";
  id: string;
}

function normalizeLimit(value: number | undefined): number {
  return Math.min(
    Math.max(Math.trunc(value ?? ENVIRONMENT_READ_MODEL_DEFAULT_LIMIT), 1),
    ENVIRONMENT_READ_MODEL_MAX_LIMIT,
  );
}

function normalizeLimits(
  limits: EnvironmentReadModelLimits | undefined,
): Required<EnvironmentReadModelLimits> {
  return {
    rooms: normalizeLimit(limits?.rooms),
    devices: normalizeLimit(limits?.devices),
    capabilities: normalizeLimit(limits?.capabilities),
    trustClasses: normalizeLimit(limits?.trustClasses),
    devicesPerRoom: normalizeLimit(limits?.devicesPerRoom),
  };
}

function baseReadModel(): EnvironmentReadModelBase {
  return {
    metadataOnly: true,
    liveState: false,
    physicalSideEffects: false,
    authoritativeForPhysicalWorld: false,
    source: "environment_registry",
  };
}

function registryFreshness(
  db: DatabaseType.Database,
): EnvironmentRegistryFreshness {
  const metadata = listEnvironmentRegistryMetadata(db);
  const metadataUpdatedAt = metadata.reduce<number | null>(
    (latest, row) =>
      latest === null ? row.updated_at : Math.max(latest, row.updated_at),
    null,
  );

  return {
    schemaVersion: 1,
    metadataUpdatedAt,
    liveStateStatus: "not_ingested",
  };
}

function resolvePolicy(
  policy: EnvironmentReadServiceInput["policy"],
): EnvironmentPolicy {
  return createEnvironmentPolicy(policy ?? {});
}

function bounded<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}

function hasTruncation(
  registry: EnvironmentRegistry,
  limits: Required<EnvironmentReadModelLimits>,
): boolean {
  return (
    registry.rooms.length > limits.rooms ||
    registry.devices.length > limits.devices ||
    registry.capabilities.length > limits.capabilities ||
    registry.trustClasses.length > limits.trustClasses
  );
}

function roomSummary(
  room: Room,
  registry: EnvironmentRegistry,
): EnvironmentRoomSummary {
  return {
    id: room.id,
    displayName: room.displayName,
    kind: room.kind,
    deviceCount: registry.devices.filter((device) => device.roomId === room.id)
      .length,
  };
}

function capabilitySummary(
  capability: Capability,
): EnvironmentCapabilitySummary {
  return {
    id: capability.id,
    displayName: capability.displayName,
    trustClass: capability.trustClass,
  };
}

function trustClassSummary(
  trustClass: TrustClass,
): EnvironmentTrustClassSummary {
  return {
    id: trustClass.id,
    canObserve: trustClass.canObserve,
    canMutate: trustClass.canMutate,
    requiresApproval: trustClass.requiresApproval,
  };
}

function policySignal(input: {
  registry: EnvironmentRegistry;
  policy: EnvironmentPolicy;
  device: Device;
  capabilityId: EnvironmentCapabilityId;
}): EnvironmentCapabilityPolicySignal {
  const actionBase = {
    deviceId: input.device.id,
    capabilityId: input.capabilityId,
    nowMs: 1_000,
    stateObservedAtMs: 1_000,
  };
  const read = evaluateEnvironmentAction({
    registry: input.registry,
    policy: input.policy,
    action: { ...actionBase, action: "read" },
  });
  const mutate = evaluateEnvironmentAction({
    registry: input.registry,
    policy: input.policy,
    action: { ...actionBase, action: "mutate" },
  });

  return {
    capabilityId: input.capabilityId,
    read: { decision: read.decision, reason: read.reason },
    mutate: {
      decision: mutate.decision,
      reason: mutate.reason,
      approvalRequired: mutate.approvalRequired,
    },
    hypotheticalFreshState: true,
    executed: false,
  };
}

function deviceSummary(input: {
  registry: EnvironmentRegistry;
  policy: EnvironmentPolicy;
  device: Device;
}): EnvironmentDeviceSummary {
  return {
    id: input.device.id,
    displayName: input.device.displayName,
    roomId: input.device.roomId,
    trustClass: input.device.trustClass,
    capabilities: input.device.capabilities,
    policySignals: input.device.capabilities.map((capabilityId) =>
      policySignal({
        registry: input.registry,
        policy: input.policy,
        device: input.device,
        capabilityId,
      }),
    ),
  };
}

export function environmentList(
  input: EnvironmentReadServiceInput,
): EnvironmentListReadModel {
  const registry = getEnvironmentRegistry(input.db);
  const policy = resolvePolicy(input.policy);
  const limits = normalizeLimits(input.limits);

  return {
    ...baseReadModel(),
    kind: "environment.list",
    truncated: hasTruncation(registry, limits),
    limits,
    counts: {
      rooms: registry.rooms.length,
      devices: registry.devices.length,
      capabilities: registry.capabilities.length,
      trustClasses: registry.trustClasses.length,
    },
    freshness: registryFreshness(input.db),
    rooms: bounded(registry.rooms, limits.rooms).map((room) =>
      roomSummary(room, registry),
    ),
    devices: bounded(registry.devices, limits.devices).map((device) =>
      deviceSummary({ registry, policy, device }),
    ),
    capabilities: bounded(registry.capabilities, limits.capabilities).map(
      capabilitySummary,
    ),
    trustClasses: bounded(registry.trustClasses, limits.trustClasses).map(
      trustClassSummary,
    ),
    disabledFeatures: DEFAULT_PHASE6_FEATURE_FLAGS,
  };
}

export function environmentGet(
  input: EnvironmentGetInput,
): EnvironmentGetReadModel {
  const registry = getEnvironmentRegistry(input.db);
  const policy = resolvePolicy(input.policy);
  const limits = normalizeLimits(input.limits);
  const base = {
    ...baseReadModel(),
    kind: "environment.get" as const,
    targetKind: input.targetKind,
    id: input.id,
    freshness: registryFreshness(input.db),
  };

  if (input.targetKind === "room") {
    const room = registry.rooms.find((item) => item.id === input.id);
    if (!room) {
      return {
        ...base,
        found: false,
        reason: "unknown_room",
        room: null,
        device: null,
      };
    }

    const devices = registry.devices
      .filter((device) => device.roomId === room.id)
      .slice(0, limits.devicesPerRoom)
      .map((device) => deviceSummary({ registry, policy, device }));

    return {
      ...base,
      found: true,
      reason: "ok",
      room: { ...roomSummary(room, registry), devices },
      device: null,
    };
  }

  const device = registry.devices.find((item) => item.id === input.id);
  if (!device) {
    return {
      ...base,
      found: false,
      reason: "unknown_device",
      room: null,
      device: null,
    };
  }

  return {
    ...base,
    found: true,
    reason: "ok",
    room: null,
    device: deviceSummary({ registry, policy, device }),
  };
}

export function environmentDescribeRegistry(
  input: EnvironmentReadServiceInput,
): EnvironmentRegistryDescriptionReadModel {
  const list = environmentList(input);

  return {
    ...baseReadModel(),
    kind: "environment.describe_registry",
    truncated: list.truncated,
    freshness: list.freshness,
    counts: list.counts,
    trustClasses: list.trustClasses,
    capabilityIds: list.capabilities.map((capability) => capability.id),
    rooms: list.rooms,
    notes: [
      "Registry/config metadata only.",
      "No live device state is inferred or ingested.",
      "Policy signals are dry-run eligibility metadata and execute nothing.",
    ],
  };
}
