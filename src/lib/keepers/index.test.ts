import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  createKeeperRegistry,
  getKeeper,
  listKeepers,
  registerKeeper,
  type KeeperMetadata,
  type KeeperRegistry,
} from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;
let registry: KeeperRegistry;

const metadata: KeeperMetadata = {
  id: "metadata-only",
  name: "Metadata Only",
  description: "Skeleton Keeper metadata for tests.",
  requiredConsentFeature: "keeper_interface",
  supportedOperations: ["describe"],
  dataClasses: ["metadata"],
  status: "registered",
};

function accessContext(purpose = "test_keeper_registry") {
  return {
    caller: "keepers.test",
    feature_id: "keeper_interface" as const,
    purpose,
    personal_context: true,
  };
}

function enableKeeperInterface() {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId: "keeper_interface",
    enabled: true,
    now: () => 1_000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-keepers-"));
  manifestPath = join(root, "consent.json");
  registry = createKeeperRegistry();
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("keeper interface skeleton", () => {
  it("blocks registration when keeper interface consent is disabled", () => {
    const result = registerKeeper(db, metadata, {
      manifestPath,
      registry,
      now: () => 2_000,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "keeper_interface",
      reason: "consent_disabled",
    });
    expect(registry.keepers.size).toBe(0);
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining(["consent_denied", "keeper_registration_blocked"]),
    );
  });

  it("refuses duplicate keeper ids", () => {
    enableKeeperInterface();
    expect(registerKeeper(db, metadata, { manifestPath, registry }).ok).toBe(
      true,
    );

    expect(registerKeeper(db, metadata, { manifestPath, registry })).toEqual({
      ok: false,
      status: "duplicate",
      id: "metadata-only",
    });
  });

  it("lists and gets metadata without execution methods", () => {
    enableKeeperInterface();
    registerKeeper(db, metadata, { manifestPath, registry });

    const listResult = listKeepers(db, {
      manifestPath,
      registry,
      accessContext: accessContext(),
    });
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) throw new Error("expected keeper list");
    expect(listResult.value).toEqual([metadata]);

    const getResult = getKeeper(db, "metadata-only", {
      manifestPath,
      registry,
      accessContext: accessContext(),
    });
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) throw new Error("expected keeper metadata");
    expect(getResult.value).toEqual(metadata);
    expect(getResult.value).not.toHaveProperty("execute");
    expect(getResult.value).not.toHaveProperty("run");
    expect(getResult.value).not.toHaveProperty("process");
    expect(getResult.value).not.toHaveProperty("invoke");
  });

  it("has no concrete keepers registered by default", () => {
    enableKeeperInterface();
    const result = listKeepers(db, {
      manifestPath,
      registry,
      accessContext: accessContext(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected keeper list");
    expect(result.value).toEqual([]);
  });

  it("emits read and registration telemetry", () => {
    enableKeeperInterface();
    registerKeeper(db, metadata, {
      manifestPath,
      registry,
      now: () => 3_000,
    });
    listKeepers(db, {
      manifestPath,
      registry,
      now: () => 4_000,
      accessContext: accessContext(),
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining(["keeper_registered", "keeper_registry_read"]),
    );
  });
});
