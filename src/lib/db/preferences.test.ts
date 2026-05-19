import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import {
  addPreference,
  getEffectivePreference,
  listPreferences,
  supersedePreference,
  type PreferenceResult,
  type PreferenceRow,
  type SupersedePreferenceResult,
} from "./preferences";
import { applyMigrations } from "./schema";
import { listTelemetryEvents } from "./telemetry";

let db: Database.Database;
let root: string;
let manifestPath: string;

function expectOk<T>(
  result: PreferenceResult<T> | SupersedePreferenceResult,
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ok preference result");
  return result.value as T;
}

function enablePreferences() {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId: "preferences",
    enabled: true,
    now: () => 1_000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-preferences-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("preference ledger", () => {
  it("blocks reads and writes when preferences consent is disabled", () => {
    expect(
      addPreference(db, {
        manifestPath,
        key: "tone",
        value: "Concise",
        category: "communication",
      }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "preferences",
      reason: "consent_disabled",
    });
    expect(listPreferences(db, { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(getEffectivePreference(db, "tone", { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(
      supersedePreference(db, "pref-1", {
        manifestPath,
        value: "Detailed",
      }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
    });

    expect(
      db.prepare("SELECT COUNT(*) AS count FROM preferences").get(),
    ).toEqual({ count: 0 });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "consent_denied",
    );
  });

  it("adds and lists user-declared preferences", () => {
    enablePreferences();

    const created = expectOk<PreferenceRow>(
      addPreference(db, {
        manifestPath,
        id: "pref-1",
        key: "tone",
        value: "Prefer direct answers.",
        category: "communication",
        createdAt: 2_000,
      }),
    );

    expect(created).toEqual({
      id: "pref-1",
      key: "tone",
      value: "Prefer direct answers.",
      category: "communication",
      source: "user",
      effective_from: 2_000,
      supersedes_id: null,
      created_at: 2_000,
    });
    expect(
      expectOk<PreferenceRow[]>(listPreferences(db, { manifestPath })),
    ).toEqual([created]);
  });

  it("resolves the newest non-superseded preference as effective", () => {
    enablePreferences();
    addPreference(db, {
      manifestPath,
      id: "pref-old",
      key: "format",
      value: "Bullets are fine.",
      category: "style",
      effectiveFrom: 2_000,
      createdAt: 2_000,
    });
    addPreference(db, {
      manifestPath,
      id: "pref-new",
      key: "format",
      value: "Prefer short paragraphs.",
      category: "style",
      effectiveFrom: 3_000,
      createdAt: 3_000,
    });

    expect(
      expectOk<PreferenceRow | null>(
        getEffectivePreference(db, "format", { manifestPath }),
      )?.id,
    ).toBe("pref-new");
  });

  it("supersedes by inserting a new row and preserving history", () => {
    enablePreferences();
    const original = expectOk<PreferenceRow>(
      addPreference(db, {
        manifestPath,
        id: "pref-1",
        key: "verbosity",
        value: "Brief.",
        category: "communication",
        effectiveFrom: 2_000,
        createdAt: 2_000,
      }),
    );

    const replacement = expectOk<PreferenceRow>(
      supersedePreference(db, "pref-1", {
        manifestPath,
        id: "pref-2",
        value: "Moderate detail.",
        createdAt: 3_000,
      }),
    );

    expect(replacement).toMatchObject({
      id: "pref-2",
      key: "verbosity",
      value: "Moderate detail.",
      source: "user",
      supersedes_id: "pref-1",
    });
    expect(
      db.prepare("SELECT * FROM preferences WHERE id = ?").get("pref-1"),
    ).toEqual(original);
    expect(
      expectOk<PreferenceRow[]>(listPreferences(db, { manifestPath })).map(
        (row) => row.id,
      ),
    ).toEqual(["pref-2", "pref-1"]);
    expect(
      expectOk<PreferenceRow | null>(
        getEffectivePreference(db, "verbosity", { manifestPath }),
      )?.id,
    ).toBe("pref-2");
  });

  it("emits preference telemetry", () => {
    enablePreferences();
    addPreference(db, {
      manifestPath,
      id: "pref-1",
      key: "tone",
      value: "Warm.",
      category: "communication",
      createdAt: 2_000,
    });
    listPreferences(db, { manifestPath, now: () => 3_000 });
    supersedePreference(db, "pref-1", {
      manifestPath,
      id: "pref-2",
      value: "Warm but concise.",
      createdAt: 4_000,
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "preference_saved",
        "preference_read",
        "preference_superseded",
      ]),
    );
  });
});
