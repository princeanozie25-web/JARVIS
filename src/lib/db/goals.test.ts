import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setConsentFromUserAction } from "../consent";
import {
  createGoal,
  getGoal,
  listGoals,
  touchGoal,
  updateGoalStatus,
  type GoalMutationResult,
  type GoalResult,
  type GoalRow,
} from "./goals";
import { applyMigrations } from "./schema";
import { listTelemetryEvents } from "./telemetry";

let db: Database.Database;
let root: string;
let manifestPath: string;

function expectOk<T>(result: GoalResult<T> | GoalMutationResult): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ok goal result");
  return result.value as T;
}

function enableGoals() {
  setConsentFromUserAction({
    manifestPath,
    db,
    featureId: "goals",
    enabled: true,
    now: () => 1_000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jarvis-goals-"));
  manifestPath = join(root, "consent.json");
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("goal continuity store", () => {
  it("blocks reads and writes when goals consent is disabled", () => {
    expect(
      createGoal(db, { manifestPath, title: "Ship Phase 3D" }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
      featureId: "goals",
      reason: "consent_disabled",
    });
    expect(listGoals(db, { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(getGoal(db, "goal-1", { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(
      updateGoalStatus(db, "goal-1", {
        manifestPath,
        status: "met",
      }),
    ).toMatchObject({
      ok: false,
      status: "blocked",
    });
    expect(touchGoal(db, "goal-1", { manifestPath })).toMatchObject({
      ok: false,
      status: "blocked",
    });

    expect(db.prepare("SELECT COUNT(*) AS count FROM goals").get()).toEqual({
      count: 0,
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "consent_denied",
    );
  });

  it("creates, lists, and gets user-declared goals", () => {
    enableGoals();

    const created = expectOk<GoalRow>(
      createGoal(db, {
        manifestPath,
        id: "goal-1",
        title: "Finish Goal Continuity Store.",
        createdAt: 2_000,
      }),
    );

    expect(created).toEqual({
      id: "goal-1",
      title: "Finish Goal Continuity Store.",
      status: "active",
      parent_id: null,
      created_at: 2_000,
      last_touched: 2_000,
      completed_at: null,
      source: "user",
    });
    expect(expectOk<GoalRow[]>(listGoals(db, { manifestPath }))).toEqual([
      created,
    ]);
    expect(
      expectOk<GoalRow | null>(getGoal(db, "goal-1", { manifestPath })),
    ).toEqual(created);
  });

  it("stores parent goal relations", () => {
    enableGoals();
    createGoal(db, {
      manifestPath,
      id: "parent",
      title: "Complete Phase 3D.",
      createdAt: 2_000,
    });

    const child = expectOk<GoalRow>(
      createGoal(db, {
        manifestPath,
        id: "child",
        title: "Implement goals.",
        parentId: "parent",
        createdAt: 3_000,
      }),
    );

    expect(child.parent_id).toBe("parent");
  });

  it("applies explicit status transitions and completion timestamps", () => {
    enableGoals();
    createGoal(db, {
      manifestPath,
      id: "goal-1",
      title: "Write tests.",
      createdAt: 2_000,
    });

    const met = expectOk<GoalRow>(
      updateGoalStatus(db, "goal-1", {
        manifestPath,
        status: "met",
        now: () => 3_000,
      }),
    );
    expect(met.status).toBe("met");
    expect(met.last_touched).toBe(3_000);
    expect(met.completed_at).toBe(3_000);

    const active = expectOk<GoalRow>(
      updateGoalStatus(db, "goal-1", {
        manifestPath,
        status: "active",
        now: () => 4_000,
      }),
    );
    expect(active.status).toBe("active");
    expect(active.last_touched).toBe(4_000);
    expect(active.completed_at).toBeNull();
  });

  it("touches goals without changing status", () => {
    enableGoals();
    createGoal(db, {
      manifestPath,
      id: "goal-1",
      title: "Keep current.",
      createdAt: 2_000,
    });

    const touched = expectOk<GoalRow>(
      touchGoal(db, "goal-1", {
        manifestPath,
        now: () => 5_000,
      }),
    );

    expect(touched.status).toBe("active");
    expect(touched.last_touched).toBe(5_000);
    expect(touched.completed_at).toBeNull();
  });

  it("emits goal telemetry", () => {
    enableGoals();
    createGoal(db, {
      manifestPath,
      id: "goal-1",
      title: "Emit telemetry.",
      createdAt: 2_000,
    });
    listGoals(db, { manifestPath, now: () => 3_000 });
    updateGoalStatus(db, "goal-1", {
      manifestPath,
      status: "missed",
      now: () => 4_000,
    });
    touchGoal(db, "goal-1", {
      manifestPath,
      now: () => 5_000,
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "goal_created",
        "goal_read",
        "goal_status_changed",
        "goal_touched",
      ]),
    );
  });
});
