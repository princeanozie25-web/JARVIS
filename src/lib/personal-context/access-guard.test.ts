import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  requirePersonalContextAccess,
  type PersonalContextAccessContext,
} from ".";

let db: Database.Database;
let root: string;
let manifestPath: string;

function access(
  input: Partial<PersonalContextAccessContext> = {},
): PersonalContextAccessContext {
  return {
    caller: "personal-context.test",
    feature_id: "preferences",
    purpose: "verify_guard",
    personal_context: true,
    ...input,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-personal-context-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("PersonalContextAccessGuard", () => {
  it("throws when access context is missing", () => {
    expect(() =>
      requirePersonalContextAccess(db, "preferences", undefined, {
        manifestPath,
      }),
    ).toThrow("personal context access context is required");
  });

  it("denies by default when personal_context is not explicitly true", () => {
    const result = requirePersonalContextAccess(
      db,
      "preferences",
      access({ personal_context: false }),
      { manifestPath },
    );

    expect(result).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "preferences",
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "personal_context_access_denied",
    );
  });

  it("denies when feature consent is disabled", () => {
    const result = requirePersonalContextAccess(db, "preferences", access(), {
      manifestPath,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "preferences",
      reason: "consent_disabled",
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "consent_denied",
        "personal_context_access_denied",
      ]),
    );
  });

  it("grants access when context and consent are valid", () => {
    setConsentFromUserAction({
      manifestPath,
      db,
      featureId: "preferences",
      enabled: true,
      now: () => 1_000,
    });

    const result = requirePersonalContextAccess(db, "preferences", access(), {
      manifestPath,
      now: () => 2_000,
    });

    expect(result).toEqual({ ok: true });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "personal_context_access_granted",
    );
  });

  it("throws on invalid feature access", () => {
    expect(() =>
      requirePersonalContextAccess(
        db,
        "preferences",
        access({ feature_id: "conversation_curator" as never }),
        { manifestPath },
      ),
    ).toThrow("invalid personal context feature");
    expect(() =>
      requirePersonalContextAccess(
        db,
        "preferences",
        access({ feature_id: "goals" }),
        { manifestPath },
      ),
    ).toThrow("personal context feature mismatch");
  });
});
