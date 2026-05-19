import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addPreference,
  createMemoryCandidate,
  createSession,
  createSessionIfMissing,
  createSessionSummary,
  listPreferences,
} from "../db/node";
import { createGoal, listGoals } from "../db/goals";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import { readPassiveMemoryWeighting } from "../memory-weighting";
import { generateReflectionPrompt } from "../reflection-prompts";
import { listReviewItems } from "../human-review";
import {
  defaultKeeperRegistry,
  listKeepers,
  registerKeeper,
  type KeeperMetadata,
} from "../keepers";
import { readTimelineIndex } from "../timeline";
import { setConsentFromUserAction } from "./manifest";

let db: Database.Database;
let root: string;
let manifestPath: string;

function enable(
  featureId:
    | "preferences"
    | "goals"
    | "timeline"
    | "memory_weighting"
    | "reflection_prompts"
    | "human_review_queue"
    | "keeper_interface",
  at = 1_000,
) {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId,
    enabled: true,
    now: () => at,
  });
}

function revoke(
  featureId:
    | "preferences"
    | "goals"
    | "timeline"
    | "memory_weighting"
    | "reflection_prompts"
    | "human_review_queue"
    | "keeper_interface",
  at = 9_000,
) {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId,
    enabled: false,
    now: () => at,
  });
}

function accessContext(
  featureId:
    | "preferences"
    | "goals"
    | "timeline"
    | "reflection_prompts"
    | "human_review_queue"
    | "keeper_interface",
  purpose = "revocation_test",
) {
  return {
    caller: "consent.revocation.test",
    feature_id: featureId,
    purpose,
    personal_context: true,
  };
}

function writeContext(
  featureId: "preferences" | "goals" | "keeper_interface",
  operation: string,
) {
  return {
    origin: "user_ui" as const,
    feature_id: featureId,
    operation,
    approved_manual_flow: true,
  };
}

function seedTimeline() {
  createSessionIfMissing(db, "session-1", 1_000);
  createSessionSummary(db, {
    sessionId: "session-1",
    summaryText: "Personal projection should be blocked after revoke.",
    summaryHash: "summary-1",
    coveredMessageCount: 3,
    createdAt: 2_000,
    updatedAt: 2_000,
  });
}

function seedCandidate() {
  createSession(db, "session-1", 1_000);
  createMemoryCandidate(db, {
    id: "candidate-1",
    sessionId: "session-1",
    sourceMessageIds: ["message-1"],
    proposedCategory: "decision",
    proposedContent: "Candidate projection should not leak.",
    proposedTags: ["revocation"],
    proposedSensitivity: "personal",
    rationale: "Test fixture.",
    createdAt: 2_000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-consent-revocation-"));
  manifestPath = join(root, "consent.json");
  defaultKeeperRegistry.keepers.clear();
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
  defaultKeeperRegistry.keepers.clear();
});

describe("consent revocation invalidation", () => {
  it("revoking preferences blocks future reads and stale preference rows", () => {
    enable("preferences");
    addPreference(db, {
      manifestPath,
      id: "pref-1",
      key: "format",
      value: "Concise.",
      category: "writing",
      createdAt: 2_000,
      writeContext: writeContext("preferences", "add_preference"),
    });
    expect(
      listPreferences(db, {
        manifestPath,
        accessContext: accessContext("preferences"),
      }).ok,
    ).toBe(true);

    revoke("preferences");

    expect(
      listPreferences(db, {
        manifestPath,
        accessContext: accessContext("preferences"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });

  it("revoking goals blocks future reads", () => {
    enable("goals");
    createGoal(db, {
      manifestPath,
      id: "goal-1",
      title: "No stale goal reads.",
      createdAt: 2_000,
      writeContext: writeContext("goals", "create_goal"),
    });
    revoke("goals");

    expect(
      listGoals(db, {
        manifestPath,
        accessContext: accessContext("goals"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });

  it("revoking timeline blocks projections", () => {
    enable("timeline");
    seedTimeline();
    expect(
      readTimelineIndex(db, {
        manifestPath,
        accessContext: accessContext("timeline"),
      }).ok,
    ).toBe(true);

    revoke("timeline");

    expect(
      readTimelineIndex(db, {
        manifestPath,
        accessContext: accessContext("timeline"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });

  it("revoking memory_weighting blocks weighting projections", () => {
    enable("memory_weighting");
    seedCandidate();
    expect(readPassiveMemoryWeighting(db, { manifestPath }).ok).toBe(true);

    revoke("memory_weighting");

    expect(readPassiveMemoryWeighting(db, { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
    });
  });

  it("revoking reflection_prompts blocks generation", () => {
    enable("reflection_prompts");
    expect(
      generateReflectionPrompt(db, {
        manifestPath,
        accessContext: accessContext("reflection_prompts"),
      }).ok,
    ).toBe(true);

    revoke("reflection_prompts");

    expect(
      generateReflectionPrompt(db, {
        manifestPath,
        accessContext: accessContext("reflection_prompts"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });

  it("revoking review_queue blocks reads", () => {
    enable("human_review_queue");
    seedCandidate();
    expect(
      listReviewItems(db, {
        manifestPath,
        accessContext: accessContext("human_review_queue"),
      }).ok,
    ).toBe(true);

    revoke("human_review_queue");

    expect(
      listReviewItems(db, {
        manifestPath,
        accessContext: accessContext("human_review_queue"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });

  it("invalidates in-memory keeper registry cache on revoke", () => {
    const keeper: KeeperMetadata = {
      id: "cached-keeper",
      name: "Cached Keeper",
      description: "Metadata-only cache fixture.",
      requiredConsentFeature: "keeper_interface",
      supportedOperations: ["describe"],
      dataClasses: ["metadata"],
      status: "registered",
    };
    enable("keeper_interface");
    expect(
      registerKeeper(db, keeper, {
        manifestPath,
        writeContext: writeContext("keeper_interface", "register_keeper"),
      }).ok,
    ).toBe(true);
    expect(defaultKeeperRegistry.keepers.size).toBe(1);

    revoke("keeper_interface");

    expect(defaultKeeperRegistry.keepers.size).toBe(0);
    expect(
      listKeepers(db, {
        manifestPath,
        accessContext: accessContext("keeper_interface"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });

  it("emits revocation and blocked projection telemetry", () => {
    enable("timeline");
    revoke("timeline", 3_000);
    readTimelineIndex(db, {
      manifestPath,
      now: () => 4_000,
      accessContext: accessContext("timeline"),
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "consent_revocation_processed",
        "consent_revocation_cache_invalidated",
        "consent_revocation_blocked_projection",
      ]),
    );
  });

  it("has no embedding or vector leakage path for Phase 3D personal projections", () => {
    db.prepare(
      `INSERT INTO memory_embeddings (
         memory_id, category, embedding, model, dim, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("memory-1", "fact", Buffer.from([1, 2, 3]), "test-model", 3, 1_000);

    enable("preferences");
    revoke("preferences");

    // 3D personal-context projections do not read embeddings/vector stores;
    // revocation blocks their read APIs instead of relying on vector cleanup.
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM memory_embeddings").get(),
    ).toEqual({ count: 1 });
    expect(
      listPreferences(db, {
        manifestPath,
        accessContext: accessContext("preferences"),
      }),
    ).toMatchObject({ ok: false, status: "blocked" });
  });
});
