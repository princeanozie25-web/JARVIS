import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import { addPreference } from "../db/preferences";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  requireRuntimeWriteAllowed,
  RuntimeWriteBoundaryViolation,
  type RuntimeWriteContext,
} from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;

function writeContext(
  origin: RuntimeWriteContext["origin"],
  approvedManualFlow = false,
): RuntimeWriteContext {
  return {
    origin,
    feature_id: "preferences",
    operation: "test_preference_write",
    approved_manual_flow: approvedManualFlow,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-write-boundary-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("RuntimeWriteBoundaryGuard", () => {
  it("throws when write context is missing", () => {
    expect(() =>
      requireRuntimeWriteAllowed(db, "preferences", undefined, {
        now: () => 1_000,
      }),
    ).toThrow(RuntimeWriteBoundaryViolation);
  });

  it.each(["runtime", "tool", "system"] as const)(
    "denies %s-originated writes by default",
    (origin) => {
      expect(() =>
        requireRuntimeWriteAllowed(db, "preferences", writeContext(origin), {
          now: () => 2_000,
        }),
      ).toThrow(RuntimeWriteBoundaryViolation);

      expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
        expect.arrayContaining([
          "runtime_write_denied",
          "runtime_write_boundary_violation",
        ]),
      );
    },
  );

  it("allows explicit approved manual UI writes", () => {
    expect(() =>
      requireRuntimeWriteAllowed(
        db,
        "preferences",
        writeContext("user_ui", true),
        { now: () => 3_000 },
      ),
    ).not.toThrow();

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "runtime_write_allowed",
    );
  });

  it("denies before protected DB mutation", () => {
    setConsentFromUserAction({
      db,
      manifestPath,
      featureId: "preferences",
      enabled: true,
      now: () => 1_000,
    });

    expect(() =>
      addPreference(db, {
        manifestPath,
        key: "format",
        value: "Concise",
        category: "writing",
        writeContext: writeContext("runtime"),
      }),
    ).toThrow(RuntimeWriteBoundaryViolation);

    expect(
      db.prepare("SELECT COUNT(*) AS count FROM preferences").get(),
    ).toEqual({ count: 0 });
  });
});
