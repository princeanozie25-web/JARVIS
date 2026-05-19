import type DatabaseType from "better-sqlite3";
import {
  requireConsent,
  type ConsentFeatureId,
  type ConsentGateResult,
} from "../consent";
import { registerConsentRevocationInvalidator } from "../consent/revocation";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  requirePersonalContextAccess,
  type PersonalContextAccessContext,
  requireRuntimeWriteAllowed,
  type RuntimeWriteContext,
} from "../personal-context";

export const KEEPER_STATUSES = ["registered", "disabled"] as const;

export type KeeperStatus = (typeof KEEPER_STATUSES)[number];

export interface KeeperMetadata {
  id: string;
  name: string;
  description: string;
  requiredConsentFeature: ConsentFeatureId;
  supportedOperations: string[];
  dataClasses: string[];
  status: KeeperStatus;
}

export interface KeeperRegistry {
  keepers: Map<string, KeeperMetadata>;
}

export interface KeeperRegistryOptions {
  registry?: KeeperRegistry;
  manifestPath?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  accessContext?: PersonalContextAccessContext;
  writeContext?: RuntimeWriteContext;
}

export type KeeperRegistryBlockedResult = Extract<
  ConsentGateResult,
  { ok: false }
>;

export type KeeperRegistryResult<T> =
  | { ok: true; value: T }
  | KeeperRegistryBlockedResult;

export type KeeperRegistrationResult =
  | KeeperRegistryResult<KeeperMetadata>
  | { ok: false; status: "duplicate"; id: string };

export function createKeeperRegistry(): KeeperRegistry {
  return { keepers: new Map() };
}

export const defaultKeeperRegistry = createKeeperRegistry();

registerConsentRevocationInvalidator("keeper_interface", () => {
  defaultKeeperRegistry.keepers.clear();
});

function normalizeString(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function normalizeList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function registryFor(input: KeeperRegistryOptions): KeeperRegistry {
  return input.registry ?? defaultKeeperRegistry;
}

function requireKeeperConsent(
  db: DatabaseType.Database,
  input: KeeperRegistryOptions,
): ConsentGateResult {
  return requireConsent("keeper_interface", {
    db,
    manifestPath: input.manifestPath,
    env: input.env,
    now: input.now,
  });
}

function sanitizeKeeper(input: KeeperMetadata): KeeperMetadata {
  return {
    id: normalizeString(input.id, "id"),
    name: normalizeString(input.name, "name"),
    description: normalizeString(input.description, "description"),
    requiredConsentFeature: input.requiredConsentFeature,
    supportedOperations: normalizeList(input.supportedOperations),
    dataClasses: normalizeList(input.dataClasses),
    status: input.status,
  };
}

export function registerKeeper(
  db: DatabaseType.Database,
  keeper: KeeperMetadata,
  input: KeeperRegistryOptions = {},
): KeeperRegistrationResult {
  const at = input.now?.() ?? Date.now();
  requireRuntimeWriteAllowed(db, "keeper_interface", input.writeContext, input);

  const gate = requireKeeperConsent(db, input);
  if (!gate.ok) {
    insertTelemetryEvent(db, {
      timestamp: at,
      event_type: "keeper_registration_blocked",
      success: false,
      notes: `keeper_id=${keeper.id} reason=${gate.reason}`,
    });
    return gate;
  }

  const normalized = sanitizeKeeper(keeper);
  const registry = registryFor(input);
  if (registry.keepers.has(normalized.id)) {
    insertTelemetryEvent(db, {
      timestamp: at,
      event_type: "keeper_registration_blocked",
      success: false,
      notes: `keeper_id=${normalized.id} reason=duplicate`,
    });
    return { ok: false, status: "duplicate", id: normalized.id };
  }

  registry.keepers.set(normalized.id, normalized);
  insertTelemetryEvent(db, {
    timestamp: at,
    event_type: "keeper_registered",
    success: true,
    notes: `keeper_id=${normalized.id} status=${normalized.status}`,
  });
  return { ok: true, value: normalized };
}

export function listKeepers(
  db: DatabaseType.Database,
  input: KeeperRegistryOptions = {},
): KeeperRegistryResult<KeeperMetadata[]> {
  const at = input.now?.() ?? Date.now();
  const gate = requirePersonalContextAccess(
    db,
    "keeper_interface",
    input.accessContext,
    input,
  );
  if (!gate.ok) return gate;
  const keepers = Array.from(registryFor(input).keepers.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  insertTelemetryEvent(db, {
    timestamp: at,
    event_type: "keeper_registry_read",
    success: true,
    notes: `rows=${keepers.length}`,
  });
  return { ok: true, value: keepers };
}

export function getKeeper(
  db: DatabaseType.Database,
  id: string,
  input: KeeperRegistryOptions = {},
): KeeperRegistryResult<KeeperMetadata | null> {
  const at = input.now?.() ?? Date.now();
  const gate = requirePersonalContextAccess(
    db,
    "keeper_interface",
    input.accessContext,
    input,
  );
  if (!gate.ok) return gate;
  const keeper =
    registryFor(input).keepers.get(normalizeString(id, "id")) ?? null;
  insertTelemetryEvent(db, {
    timestamp: at,
    event_type: "keeper_registry_read",
    success: keeper !== null,
    notes: `keeper_id=${id}`,
  });
  return { ok: true, value: keeper };
}
