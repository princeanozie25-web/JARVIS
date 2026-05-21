import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
} from "../environment";
import {
  getEnvironmentDevice,
  getEnvironmentRegistry,
  getEnvironmentRegistryMetadata,
  getEnvironmentRoom,
  insertEnvironmentCapability,
  insertEnvironmentDevice,
  insertEnvironmentRoom,
  listEnvironmentCapabilities,
  listEnvironmentDevices,
  listEnvironmentRegistryMetadata,
  listEnvironmentRooms,
  listEnvironmentTrustClasses,
  seedEnvironmentRegistryDefaults,
  updateEnvironmentCapability,
  updateEnvironmentDevice,
  updateEnvironmentRoom,
  upsertEnvironmentRegistryMetadata,
} from "./environment-registry";
import { applyMigrations } from "./schema";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("environment registry persistence", () => {
  it("seeds local trust classes, capability allowlist, and metadata", () => {
    seedEnvironmentRegistryDefaults(db, { updatedAt: 1_000 });

    expect(listEnvironmentTrustClasses(db).map((row) => row.id)).toEqual([
      "forbidden",
      "observe-only",
      "restricted-mutate",
      "safe-mutate",
    ]);
    expect(listEnvironmentCapabilities(db).map((row) => row.id)).toEqual([
      "automation.plan",
      "climate.observe",
      "environment.observe",
      "light.observe",
      "lock.observe",
      "media.observe",
      "power.observe",
      "state.observe",
    ]);
    expect(getEnvironmentRegistryMetadata(db, "schema_version")).toEqual({
      key: "schema_version",
      value: "1",
      updated_at: 1_000,
    });
  });

  it("creates, reads, updates, and lists rooms", () => {
    const inserted = insertEnvironmentRoom(db, {
      id: "room:office",
      displayName: "Office",
      kind: "workspace",
    });

    expect(inserted).toEqual({
      id: "room:office",
      display_name: "Office",
      kind: "workspace",
    });
    expect(getEnvironmentRoom(db, "room:office")).toEqual({
      id: "room:office",
      displayName: "Office",
      kind: "workspace",
    });

    expect(
      updateEnvironmentRoom(db, {
        id: "room:office",
        displayName: "Studio",
        kind: "room",
      }),
    ).toEqual({
      id: "room:office",
      displayName: "Studio",
      kind: "room",
    });
    expect(listEnvironmentRooms(db).map((room) => room.id)).toEqual([
      "room:office",
    ]);
  });

  it("creates, reads, updates, and lists capabilities through the allowlist", () => {
    seedEnvironmentRegistryDefaults(db);

    expect(
      updateEnvironmentCapability(db, {
        id: "light.observe",
        displayName: "Observe Light State",
        description: "Metadata-only observation.",
        trustClass: "observe-only",
      }),
    ).toEqual({
      id: "light.observe",
      displayName: "Observe Light State",
      description: "Metadata-only observation.",
      trustClass: "observe-only",
    });

    expect(() =>
      insertEnvironmentCapability(db, {
        id: "camera.stream",
        displayName: "Camera Stream",
      }),
    ).toThrow();
  });

  it("creates, reads, updates, and lists devices with capability pointers", () => {
    seedEnvironmentRegistryDefaults(db);
    insertEnvironmentRoom(db, {
      id: "room:office",
      displayName: "Office",
    });

    const inserted = insertEnvironmentDevice(db, {
      id: "device:desk-lamp",
      displayName: "Desk Lamp",
      roomId: "room:office",
      manufacturer: "Local",
      capabilities: ["state.observe", "light.observe"],
    });

    expect(inserted).toEqual({
      id: "device:desk-lamp",
      display_name: "Desk Lamp",
      room_id: "room:office",
      manufacturer: "Local",
      model: null,
      trust_class: "observe-only",
    });
    expect(getEnvironmentDevice(db, "device:desk-lamp")).toEqual({
      id: "device:desk-lamp",
      displayName: "Desk Lamp",
      roomId: "room:office",
      manufacturer: "Local",
      trustClass: "observe-only",
      capabilities: ["light.observe", "state.observe"],
    });

    expect(
      updateEnvironmentDevice(db, {
        id: "device:desk-lamp",
        displayName: "Desk Lamp Updated",
        roomId: "room:office",
        model: "v2",
        trustClass: "restricted-mutate",
        capabilities: ["power.observe"],
      }),
    ).toEqual({
      id: "device:desk-lamp",
      displayName: "Desk Lamp Updated",
      roomId: "room:office",
      model: "v2",
      trustClass: "restricted-mutate",
      capabilities: ["power.observe"],
    });
    expect(listEnvironmentDevices(db).map((device) => device.id)).toEqual([
      "device:desk-lamp",
    ]);
  });

  it("rejects invalid capabilities before device persistence", () => {
    seedEnvironmentRegistryDefaults(db);
    insertEnvironmentRoom(db, {
      id: "room:office",
      displayName: "Office",
    });

    expect(() =>
      insertEnvironmentDevice(db, {
        id: "device:camera",
        displayName: "Camera",
        roomId: "room:office",
        capabilities: ["camera.stream"],
      }),
    ).toThrow();
    expect(listEnvironmentDevices(db)).toEqual([]);
  });

  it("persists observe-only trust class for new or unknown devices", () => {
    seedEnvironmentRegistryDefaults(db);
    insertEnvironmentRoom(db, {
      id: "room:office",
      displayName: "Office",
    });

    insertEnvironmentDevice(db, {
      id: "device:unknown",
      displayName: "Unknown",
      roomId: "room:office",
      trustClass: "admin",
      capabilities: [],
    });

    expect(getEnvironmentDevice(db, "device:unknown")).toMatchObject({
      id: "device:unknown",
      trustClass: "observe-only",
    });
  });

  it("enforces room and capability foreign keys without side effects", () => {
    seedEnvironmentRegistryDefaults(db);

    expect(() =>
      insertEnvironmentDevice(db, {
        id: "device:orphan",
        displayName: "Orphan",
        roomId: "room:missing",
        capabilities: ["state.observe"],
      }),
    ).toThrow();
    expect(listEnvironmentDevices(db)).toEqual([]);
  });

  it("assembles a registry snapshot from persisted rows", () => {
    seedEnvironmentRegistryDefaults(db);
    insertEnvironmentRoom(db, {
      id: "room:office",
      displayName: "Office",
    });
    insertEnvironmentDevice(db, {
      id: "device:desk-lamp",
      displayName: "Desk Lamp",
      roomId: "room:office",
      capabilities: ["state.observe"],
    });

    const registry = getEnvironmentRegistry(db);

    expect(registry).toMatchObject({
      schemaVersion: 1,
      rooms: [{ id: "room:office", displayName: "Office", kind: "room" }],
      devices: [
        {
          id: "device:desk-lamp",
          displayName: "Desk Lamp",
          trustClass: "observe-only",
          capabilities: ["state.observe"],
        },
      ],
      disabledFeatures: DEFAULT_PHASE6_FEATURE_FLAGS,
    });
  });

  it("keeps Phase 6 disabled-feature defaults unchanged", () => {
    seedEnvironmentRegistryDefaults(db);
    upsertEnvironmentRegistryMetadata(db, {
      key: "disabled_features",
      value: JSON.stringify(DEFAULT_PHASE6_FEATURE_FLAGS),
      updatedAt: 2_000,
    });

    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );
    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE6_FEATURE_FLAGS[feature]).toBe(false);
    }
    expect(listEnvironmentRegistryMetadata(db)).toEqual([
      {
        key: "disabled_features",
        value: JSON.stringify(DEFAULT_PHASE6_FEATURE_FLAGS),
        updated_at: 2_000,
      },
      {
        key: "schema_version",
        value: "1",
        updated_at: expect.any(Number),
      },
    ]);
  });
});
