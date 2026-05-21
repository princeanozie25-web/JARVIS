import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  insertEnvironmentDevice,
  insertEnvironmentRoom,
  seedEnvironmentRegistryDefaults,
  upsertEnvironmentRegistryMetadata,
} from "../db/environment-registry";
import { applyMigrations } from "../db/schema";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  environmentDescribeRegistry,
  environmentGet,
  environmentList,
} from "./index";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  seedEnvironmentRegistryDefaults(db, { updatedAt: 1_000 });
});

afterEach(() => {
  db.close();
});

function seedRoomWithDevices() {
  insertEnvironmentRoom(db, {
    id: "room:office",
    displayName: "Office",
  });
  insertEnvironmentRoom(db, {
    id: "room:studio",
    displayName: "Studio",
  });
  insertEnvironmentDevice(db, {
    id: "device:desk-lamp",
    displayName: "Desk Lamp",
    roomId: "room:office",
    manufacturer: "Unsafe Manufacturer Field",
    model: "Unsafe Model Field",
    trustClass: "safe-mutate",
    capabilities: ["state.observe", "light.observe"],
  });
  insertEnvironmentDevice(db, {
    id: "device:thermostat",
    displayName: "Thermostat",
    roomId: "room:office",
    trustClass: "restricted-mutate",
    capabilities: ["climate.observe"],
  });
  insertEnvironmentDevice(db, {
    id: "device:forbidden",
    displayName: "Forbidden Device",
    roomId: "room:studio",
    trustClass: "forbidden",
    capabilities: ["state.observe"],
  });
}

describe("Phase 6A4 environment read service", () => {
  it("returns a bounded deterministic environment.list read model", () => {
    seedRoomWithDevices();
    upsertEnvironmentRegistryMetadata(db, {
      key: "user_revision",
      value: "2",
      updatedAt: 2_000,
    });

    const result = environmentList({
      db,
      limits: {
        rooms: 1,
        devices: 2,
        capabilities: 3,
        trustClasses: 2,
      },
      policy: {
        capabilityEligibility: [
          {
            capabilityId: "state.observe",
            safeMutationEligible: true,
            requiresFreshState: true,
          },
          {
            capabilityId: "light.observe",
            safeMutationEligible: true,
            requiresFreshState: true,
          },
        ],
        roomPolicies: [
          {
            roomId: "room:office",
            safeMutateCapabilities: ["state.observe", "light.observe"],
          },
        ],
      },
    });

    expect(result).toMatchObject({
      kind: "environment.list",
      metadataOnly: true,
      liveState: false,
      physicalSideEffects: false,
      authoritativeForPhysicalWorld: false,
      source: "environment_registry",
      truncated: true,
      counts: {
        rooms: 2,
        devices: 3,
        capabilities: 8,
        trustClasses: 4,
      },
      freshness: {
        schemaVersion: 1,
        metadataUpdatedAt: 2_000,
        liveStateStatus: "not_ingested",
      },
    });
    expect(result.rooms.map((room) => room.id)).toEqual(["room:office"]);
    expect(result.devices.map((device) => device.id)).toEqual([
      "device:desk-lamp",
      "device:forbidden",
    ]);
    expect(result.capabilities).toHaveLength(3);
    expect(result.trustClasses).toHaveLength(2);
  });

  it("includes policy eligibility signals without executing anything", () => {
    seedRoomWithDevices();

    const result = environmentGet({
      db,
      targetKind: "device",
      id: "device:desk-lamp",
      policy: {
        capabilityEligibility: [
          {
            capabilityId: "state.observe",
            safeMutationEligible: true,
            requiresFreshState: true,
          },
          {
            capabilityId: "light.observe",
            safeMutationEligible: false,
            requiresFreshState: true,
          },
        ],
        roomPolicies: [
          {
            roomId: "room:office",
            safeMutateCapabilities: ["state.observe"],
          },
        ],
      },
    });

    expect(result).toMatchObject({
      kind: "environment.get",
      targetKind: "device",
      found: true,
      reason: "ok",
      metadataOnly: true,
      liveState: false,
      physicalSideEffects: false,
    });
    expect(result.device?.policySignals).toEqual([
      {
        capabilityId: "light.observe",
        read: {
          decision: "allowed",
          reason: "observe_only_read_allowed",
        },
        mutate: {
          decision: "denied",
          reason: "capability_not_allowed",
          approvalRequired: false,
        },
        hypotheticalFreshState: true,
        executed: false,
      },
      {
        capabilityId: "state.observe",
        read: {
          decision: "allowed",
          reason: "observe_only_read_allowed",
        },
        mutate: {
          decision: "allowed",
          reason: "allowed_safe_mutate",
          approvalRequired: false,
        },
        hypotheticalFreshState: true,
        executed: false,
      },
    ]);
  });

  it("returns one room snapshot and bounds nested devices", () => {
    seedRoomWithDevices();

    const result = environmentGet({
      db,
      targetKind: "room",
      id: "room:office",
      limits: { devicesPerRoom: 1 },
    });

    expect(result).toMatchObject({
      found: true,
      reason: "ok",
      room: {
        id: "room:office",
        displayName: "Office",
        deviceCount: 2,
      },
      device: null,
    });
    expect(result.room?.devices).toHaveLength(1);
    expect(result.room?.devices[0]?.id).toBe("device:desk-lamp");
  });

  it("handles unknown rooms and devices safely", () => {
    seedRoomWithDevices();

    expect(
      environmentGet({
        db,
        targetKind: "room",
        id: "room:missing",
      }),
    ).toMatchObject({
      found: false,
      reason: "unknown_room",
      room: null,
      device: null,
      metadataOnly: true,
    });
    expect(
      environmentGet({
        db,
        targetKind: "device",
        id: "device:missing",
      }),
    ).toMatchObject({
      found: false,
      reason: "unknown_device",
      room: null,
      device: null,
      metadataOnly: true,
    });
  });

  it("describes the registry as bounded metadata only", () => {
    seedRoomWithDevices();

    const result = environmentDescribeRegistry({
      db,
      limits: { rooms: 1, capabilities: 2 },
    });

    expect(result).toMatchObject({
      kind: "environment.describe_registry",
      metadataOnly: true,
      liveState: false,
      physicalSideEffects: false,
      authoritativeForPhysicalWorld: false,
      truncated: true,
      counts: {
        rooms: 2,
        devices: 3,
        capabilities: 8,
        trustClasses: 4,
      },
    });
    expect(result.rooms).toHaveLength(1);
    expect(result.capabilityIds).toHaveLength(2);
    expect(result.notes.join(" ")).toContain("No live device state");
    expect(result.notes.join(" ")).toContain("execute nothing");
  });

  it("omits raw unsafe persisted fields from read surfaces", () => {
    seedRoomWithDevices();

    const output = JSON.stringify(
      environmentGet({
        db,
        targetKind: "device",
        id: "device:desk-lamp",
      }),
    );

    expect(output).not.toContain("Unsafe Manufacturer Field");
    expect(output).not.toContain("Unsafe Model Field");
    expect(output).not.toContain("manufacturer");
    expect(output).not.toContain("model");
  });

  it("keeps disabled-feature defaults unchanged", () => {
    const result = environmentList({ db });

    expect(result.disabledFeatures).toEqual(DEFAULT_PHASE6_FEATURE_FLAGS);
    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );
    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(result.disabledFeatures[feature]).toBe(false);
    }
  });

  it("is not imported by router, chat, tools, or voice execution paths", () => {
    const repoRoot = process.cwd();
    const files = [
      "src/lib/tools/registry.ts",
      "src/lib/tools/runtime.ts",
      "src/lib/tools/projects.ts",
      "src/lib/chat/tool-continuation.ts",
      "src/lib/chat/tool-approvals.ts",
      "src/lib/router/index.ts",
      "src/lib/router/selection.ts",
      "src/lib/router/enforcement.ts",
      "src/lib/voice-streaming/project-tool-boundary.ts",
      "app/api/chat/route.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      expect(source).not.toContain("environmentList");
      expect(source).not.toContain("environmentGet");
      expect(source).not.toContain("environmentDescribeRegistry");
      expect(source).not.toContain("environment/service");
    }
  });
});
