import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLongTermMemory, listLongTermMemory } from "../db/memory";
import { insertProjectIndexSnapshot } from "../db/project-index-snapshots";
import { insertProjectSource, listProjectSources } from "../db/project-sources";
import { getRegisteredProject, insertRegisteredProject } from "../db/projects";
import { applyMigrations } from "../db/schema";
import { tools } from "../tools";
import {
  assembleProjectContext,
  PROJECT_CONTEXT_MIN_BUDGET_CHARS,
  PROJECT_CONTEXT_OPEN_BLOCKER_LIMIT,
  PROJECT_CONTEXT_PROMOTED_TASK_LIMIT,
} from "./context-assembly";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

function hash(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function seedProject() {
  insertRegisteredProject(db, {
    id: "proj_context",
    slug: "context",
    displayName: "Context",
    rootKind: "virtual",
    rootRef: "virtual:context",
    createdAt: 1_000,
  });
  insertProjectSource(db, {
    id: "psrc_secret",
    projectId: "proj_context",
    kind: "file",
    ref: "secret-source-ref.md",
  });
  insertLongTermMemory(db, {
    id: "mem_context_secret",
    category: "decision",
    content: "raw memory text must not enter project context",
    source: "user",
    source_id: null,
    project: "context",
    tags_json: JSON.stringify(["#context"]),
    sensitivity: "personal",
    created_at: 1_000,
    updated_at: 1_000,
    obsidian_path: "20-projects/context/secret.md",
    hash: hash("raw memory text must not enter project context"),
  });
  for (let index = 1; index <= 2; index += 1) {
    db.prepare(
      `INSERT INTO project_task (
         id, project_id, thread_id, title, status, confidence, promoted,
         origin_ref, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `ptask_candidate_${index}`,
      "proj_context",
      null,
      `Candidate ${index} should not be commitment`,
      "extracted",
      0.7,
      0,
      `origin:candidate:${index}:secret`,
      1_000,
      1_000 + index,
    );
  }
  for (let index = 1; index <= 6; index += 1) {
    db.prepare(
      `INSERT INTO project_task (
         id, project_id, thread_id, title, status, confidence, promoted,
         origin_ref, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `ptask_commitment_${index}`,
      "proj_context",
      null,
      `Commitment ${index}`,
      "open",
      0.9,
      1,
      `origin:commitment:${index}:secret`,
      1_000,
      2_000 + index,
    );
  }
  for (let index = 1; index <= 6; index += 1) {
    db.prepare(
      `INSERT INTO project_blocker (
         id, project_id, task_id, description, status, origin_ref
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      `pblk_open_${index}`,
      "proj_context",
      null,
      `Open blocker ${index}`,
      "open",
      `origin:blocker:${index}:secret`,
    );
  }
  db.prepare(
    `INSERT INTO project_blocker (
       id, project_id, task_id, description, status, origin_ref
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    "pblk_cleared",
    "proj_context",
    null,
    "Cleared blocker should not appear in open blockers",
    "cleared",
    "origin:blocker:cleared:secret",
  );
  db.prepare(
    `INSERT INTO project_thread (
       id, project_id, title, status, first_seen_at, last_active_at, origin_ref
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "pth_context",
    "proj_context",
    "Thread title should only count",
    "open",
    1_000,
    1_100,
    "origin:thread:secret",
  );
  db.prepare(
    `INSERT INTO project_decision (
       id, project_id, summary, decided_at, origin_ref
     ) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    "pdec_context",
    "proj_context",
    "Decision text should only count",
    1_500,
    "origin:decision:secret",
  );
  insertProjectIndexSnapshot(db, {
    id: "pidx_context",
    projectId: "proj_context",
    startedAt: 4_000,
    finishedAt: 4_200,
    sourcesSeen: 1,
    artifactsExtracted: 3,
    triggeredBy: "manual",
    status: "completed",
  });
}

describe("project context assembly", () => {
  it("requires an explicit project id and fails safely for missing projects", () => {
    expect(assembleProjectContext(db, {})).toEqual({
      ok: false,
      reason: "project_id_required",
      derivedState: true,
      authoritative: false,
      context: null,
    });
    expect(assembleProjectContext(db, { projectId: "missing" })).toEqual({
      ok: false,
      reason: "project_not_found",
      derivedState: true,
      authoritative: false,
      context: null,
    });
  });

  it("assembles bounded derived project context from project tables only", () => {
    seedProject();
    const before = {
      project: getRegisteredProject(db, { id: "proj_context" }),
      sources: listProjectSources(db, "proj_context"),
      memory: listLongTermMemory(db),
      tasks: db.prepare("SELECT * FROM project_task").all(),
      blockers: db.prepare("SELECT * FROM project_blocker").all(),
      snapshots: db.prepare("SELECT * FROM project_index_snapshot").all(),
    };

    const result = assembleProjectContext(db, {
      projectId: "proj_context",
      now: 5_000,
    });

    expect(result).toMatchObject({
      ok: true,
      context: {
        derivedState: true,
        authoritative: false,
        project: {
          id: "proj_context",
          slug: "context",
          displayName: "Context",
          status: "active",
        },
        indexFreshness: {
          snapshotId: "pidx_context",
          status: "completed",
          startedAt: 4_000,
          finishedAt: 4_200,
          snapshotAgeMs: 800,
          sourcesSeen: 1,
          artifactsExtracted: 3,
        },
        counts: {
          extractedTasks: 2,
          promotedTasks: 6,
          openBlockers: 6,
          clearedBlockers: 1,
          decisions: 1,
          threads: 1,
        },
        commitments: {
          semantics: "promoted_tasks_are_commitments",
          limit: PROJECT_CONTEXT_PROMOTED_TASK_LIMIT,
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "ptask_commitment_6",
              title: "Commitment 6",
            }),
          ]),
        },
        openBlockers: {
          semantics: "open_blockers_only",
          limit: PROJECT_CONTEXT_OPEN_BLOCKER_LIMIT,
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "pblk_open_1",
              description: "Open blocker 1",
            }),
          ]),
        },
        candidateTasks: {
          semantics: "unpromoted_extracted_tasks_are_candidates_only",
          count: 2,
        },
        budget: {
          truncated: false,
        },
      },
    });
    if (!result.ok) throw new Error("expected project context");
    expect(result.context.commitments.items).toHaveLength(5);
    expect(result.context.openBlockers.items).toHaveLength(5);
    expect(
      result.context.commitments.items.map((task) => task.id),
    ).not.toContain("ptask_candidate_1");
    expect(result.context.contextText).toContain(
      "Promoted tasks are commitments; unpromoted extracted tasks are candidates only.",
    );
    expect(JSON.stringify(result.context)).not.toContain("origin:");
    expect(JSON.stringify(result.context)).not.toContain(
      "secret-source-ref.md",
    );
    expect(JSON.stringify(result.context)).not.toContain(
      "raw memory text must not enter project context",
    );
    expect(JSON.stringify(result.context)).not.toContain("20-projects/context");
    expect(JSON.stringify(result.context)).not.toContain("Decision text");
    expect(JSON.stringify(result.context)).not.toContain("Thread title");
    expect(getRegisteredProject(db, { id: "proj_context" })).toEqual(
      before.project,
    );
    expect(listProjectSources(db, "proj_context")).toEqual(before.sources);
    expect(listLongTermMemory(db)).toEqual(before.memory);
    expect(db.prepare("SELECT * FROM project_task").all()).toEqual(
      before.tasks,
    );
    expect(db.prepare("SELECT * FROM project_blocker").all()).toEqual(
      before.blockers,
    );
    expect(db.prepare("SELECT * FROM project_index_snapshot").all()).toEqual(
      before.snapshots,
    );
  });

  it("enforces the hard character budget and sets truncated when exceeded", () => {
    seedProject();

    const result = assembleProjectContext(db, {
      projectId: "proj_context",
      maxChars: PROJECT_CONTEXT_MIN_BUDGET_CHARS,
      now: 5_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected project context");
    expect(result.context.budget.maxChars).toBe(
      PROJECT_CONTEXT_MIN_BUDGET_CHARS,
    );
    expect(result.context.budget.usedChars).toBeLessThanOrEqual(
      PROJECT_CONTEXT_MIN_BUDGET_CHARS,
    );
    expect(result.context.contextText.length).toBeLessThanOrEqual(
      PROJECT_CONTEXT_MIN_BUDGET_CHARS,
    );
    expect(result.context.budget.truncated).toBe(true);
    expect(result.context.contextText.endsWith("...")).toBe(true);
  });

  it("does not read files, source contents, memory text, telemetry payloads, or wire chat/router", () => {
    seedProject();
    const prepare = db.prepare.bind(db);
    db.prepare = ((source: string) => {
      expect(source).not.toMatch(/\bproject_source\b/i);
      expect(source).not.toMatch(/\blong_term_memory\b/i);
      expect(source).not.toMatch(/\btelemetry_events\b/i);
      expect(source).not.toMatch(/\btool_calls\b/i);
      return prepare(source);
    }) as typeof db.prepare;

    const result = assembleProjectContext(db, {
      projectId: "proj_context",
      now: 5_000,
    });

    expect(result.ok).toBe(true);
    const source = readFileSync(
      join(process.cwd(), "src/lib/projects/context-assembly.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/node:fs|readFile|readdir|opendir/i);
    expect(source).not.toMatch(/chat|router|runTool|toolRuntime/i);
    expect(source).not.toMatch(/insertLongTermMemory|memory\.note/i);
    expect(source).not.toMatch(/project\.write_memory/);
    expect(source).not.toMatch(/llm|LLM|project\.extract/);
    expect(source).not.toMatch(/fetch\(|WebSocket|network_url/i);
    expect(source).not.toMatch(/voice.*mutation|voice_project_mutation/i);
    expect(tools.has("project.write_memory")).toBe(false);
  });
});
