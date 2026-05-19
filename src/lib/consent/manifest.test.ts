import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  PHASE_3D_FEATURE_IDS,
  createDefaultConsentManifest,
  readConsentManifest,
  requireConsent,
  setConsentFromUserAction,
} from ".";

let root: string;
let manifestPath: string;
let db: Database.Database;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-consent-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("consent manifest", () => {
  it("defaults every Phase 3D feature to disabled", () => {
    const manifest = createDefaultConsentManifest({
      now: () => Date.parse("2026-05-19T00:00:00.000Z"),
    });

    expect(manifest.records.map((record) => record.feature_id)).toEqual([
      ...PHASE_3D_FEATURE_IDS,
    ]);
    expect(manifest.records.every((record) => !record.enabled)).toBe(true);
    expect(manifest.records.every((record) => record.revocable)).toBe(true);
    expect(
      manifest.records.every((record) => record.granted_by === "user"),
    ).toBe(true);
  });

  it("creates and reads a manifest when missing", () => {
    const manifest = readConsentManifest({
      manifestPath,
      db,
      now: () => Date.parse("2026-05-19T00:00:00.000Z"),
    });

    expect(manifest.records).toHaveLength(PHASE_3D_FEATURE_IDS.length);
    expect(
      readConsentManifest({ manifestPath }).records.every(
        (record) => !record.enabled,
      ),
    ).toBe(true);
  });

  it("grants and revokes consent manually", () => {
    const granted = setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "preferences",
      enabled: true,
      now: () => Date.parse("2026-05-19T01:00:00.000Z"),
    });

    expect(granted).toMatchObject({
      feature_id: "preferences",
      enabled: true,
      granted_at: "2026-05-19T01:00:00.000Z",
      granted_by: "user",
      revocable: true,
    });
    expect(requireConsent("preferences", { manifestPath, db }).ok).toBe(true);

    const revoked = setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "preferences",
      enabled: false,
      now: () => Date.parse("2026-05-19T02:00:00.000Z"),
    });

    expect(revoked.enabled).toBe(false);
    expect(revoked.granted_at).toBeNull();
  });

  it("blocks requireConsent when a feature is disabled or missing", () => {
    expect(
      requireConsent("keeper_interface", {
        manifestPath,
        db,
        now: () => Date.parse("2026-05-19T03:00:00.000Z"),
      }),
    ).toEqual({
      ok: false,
      status: "blocked",
      featureId: "keeper_interface",
      reason: "consent_disabled",
    });
  });

  it("emits consent telemetry", () => {
    readConsentManifest({
      manifestPath,
      db,
      now: () => Date.parse("2026-05-19T00:00:00.000Z"),
    });
    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "goals",
      enabled: true,
      now: () => Date.parse("2026-05-19T01:00:00.000Z"),
    });
    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "goals",
      enabled: false,
      now: () => Date.parse("2026-05-19T02:00:00.000Z"),
    });
    requireConsent("goals", {
      manifestPath,
      db,
      now: () => Date.parse("2026-05-19T03:00:00.000Z"),
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "consent_read",
        "consent_granted",
        "consent_revoked",
        "consent_denied",
      ]),
    );
  });
});
