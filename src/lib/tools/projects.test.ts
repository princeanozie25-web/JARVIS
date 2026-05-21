import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensurePendingToolApproval,
  resumeApproval,
} from "../chat/tool-approvals";
import {
  insertProjectIndexSnapshot,
  listProjectIndexSnapshots,
} from "../db/project-index-snapshots";
import { listProjectBlockers, listProjectTasks } from "../db/project-artifacts";
import {
  countProjectSources,
  insertProjectSource,
  listProjectSources,
} from "../db/project-sources";
import { getRegisteredProject, listRegisteredProjects } from "../db/projects";
import { applyMigrations } from "../db/schema";
import { insertRegisteredProject } from "../db/projects";
import { listToolCalls } from "../db/tool-calls";
import type { RouterDecision } from "../router";
import { InProcessToolRuntime, tools } from ".";

const allowDecision: RouterDecision = {
  intent: { intent: "CONVERSATIONAL", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["text", "stream"],
    reason: "test",
  },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["text", "stream"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let runtime: InProcessToolRuntime;
let now: number;
let previousWorkspaceRoot: string | undefined;
let workspaceRoot: string;

beforeEach(() => {
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-projects-"));
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
  db = new Database(":memory:");
  applyMigrations(db);
  now = 1_000;
  runtime = new InProcessToolRuntime(tools, {
    db,
    now: () => now,
    toolsEnabled: true,
    bindHost: "127.0.0.1",
  });
});

afterEach(() => {
  db.close();
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
  rmSync(workspaceRoot, { recursive: true, force: true });
});

async function runApprovedProjectIndex(
  executionId: string,
  input: { projectId: string; triggeredBy: string },
) {
  await runtime.runTool({
    toolId: "project.index",
    input,
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  const pending = ensurePendingToolApproval({
    db,
    executionId,
    sessionId: "session-1",
    toolId: "project.index",
    toolName: "Index Project Snapshot",
    scopeHash: tools.get("project.index").scopeOf(input),
    requiredSafetyTag: "CONFIRM_ALWAYS",
    safetyTag: "ALLOW",
    toolInput: input,
    now,
    ttlMs: 500,
  });
  now += 100;
  return resumeApproval({
    db,
    runtime,
    executionId,
    decision: "APPROVED_ONCE",
    approvalToken: pending.approvalToken,
    now,
  });
}

async function runApprovedProjectPromoteTask(
  executionId: string,
  input: { projectId: string; taskId: string },
) {
  await runtime.runTool({
    toolId: "project.promote_task",
    input,
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  const pending = ensurePendingToolApproval({
    db,
    executionId,
    sessionId: "session-1",
    toolId: "project.promote_task",
    toolName: "Promote Project Task",
    scopeHash: tools.get("project.promote_task").scopeOf(input),
    requiredSafetyTag: "CONFIRM_ALWAYS",
    safetyTag: "ALLOW",
    toolInput: input,
    now,
    ttlMs: 500,
  });
  now += 100;
  return resumeApproval({
    db,
    runtime,
    executionId,
    decision: "APPROVED_ONCE",
    approvalToken: pending.approvalToken,
    now,
  });
}

function insertExtractedProjectTask(input: {
  id: string;
  projectId: string;
  title?: string;
  status?: string;
  confidence?: number;
  promoted?: 0 | 1;
  createdAt?: number;
  updatedAt?: number;
}) {
  db.prepare(
    `INSERT INTO project_task (
       id, project_id, thread_id, title, status, confidence, promoted,
       origin_ref, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.projectId,
    null,
    input.title ?? "Promote me",
    input.status ?? "extracted",
    input.confidence ?? 0.8,
    input.promoted ?? 0,
    `origin:${input.id}`,
    input.createdAt ?? 1_000,
    input.updatedAt ?? 1_000,
  );
}

describe("Phase 5 project tools", () => {
  it("project.list returns registered rows", async () => {
    insertRegisteredProject(db, {
      id: "proj_jarvis",
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "fs",
      rootRef: "workspace-ref",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.list",
      input: { maxResults: 10 },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        count: 1,
        derivedState: true,
        projects: [
          expect.objectContaining({
            id: "proj_jarvis",
            slug: "jarvis",
            displayName: "JARVIS",
            rootKind: "fs",
            rootRef: "workspace-ref",
            status: "active",
            indexedAt: null,
            sourceCount: 0,
          }),
        ],
      },
    });
  });

  it("project.get returns one registered row", async () => {
    insertRegisteredProject(db, {
      id: "proj_lookup",
      slug: "lookup",
      displayName: "Lookup",
      rootKind: "virtual",
      rootRef: "virtual:lookup",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.get",
      input: { slug: "lookup" },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        project: expect.objectContaining({
          id: "proj_lookup",
          slug: "lookup",
          indexedAt: null,
          sourceCount: 0,
        }),
        derivedState: true,
      },
    });
  });

  it("handles registered-but-unindexed projects cleanly", async () => {
    insertRegisteredProject(db, {
      id: "proj_unindexed",
      slug: "unindexed",
      displayName: "Unindexed",
      rootKind: "memory",
      rootRef: "memory:unindexed",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.get",
      input: { id: "proj_unindexed" },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result.data).toMatchObject({
      project: expect.objectContaining({
        id: "proj_unindexed",
        indexedAt: null,
        sourceCount: 0,
      }),
    });
  });

  it("project.get returns bounded derived artifact counts and commitment lists", async () => {
    insertRegisteredProject(db, {
      id: "proj_artifacts",
      slug: "artifacts",
      displayName: "Artifacts",
      rootKind: "virtual",
      rootRef: "virtual:artifacts",
      createdAt: 1_000,
    });
    db.prepare(
      `INSERT INTO project_thread (
         id, project_id, title, status, first_seen_at, last_active_at, origin_ref
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "pth_1",
      "proj_artifacts",
      "Thread",
      "open",
      1_000,
      1_000,
      "origin:thread",
    );
    for (let index = 1; index <= 2; index += 1) {
      db.prepare(
        `INSERT INTO project_task (
           id, project_id, thread_id, title, status, confidence, promoted,
           origin_ref, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `ptask_extracted_${index}`,
        "proj_artifacts",
        "pth_1",
        `Candidate ${index}`,
        "extracted",
        0.8,
        0,
        `origin:task:extracted:${index}`,
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
        `ptask_promoted_${index}`,
        "proj_artifacts",
        null,
        `Promoted commitment ${index}`,
        "open",
        1,
        1,
        `origin:task:promoted:${index}`,
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
        "proj_artifacts",
        null,
        `Open blocker ${index}`,
        "open",
        `origin:blocker:open:${index}`,
      );
    }
    db.prepare(
      `INSERT INTO project_blocker (
         id, project_id, task_id, description, status, origin_ref
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      "pblk_cleared",
      "proj_artifacts",
      null,
      "Cleared blocker",
      "cleared",
      "origin:blocker:cleared",
    );
    for (let index = 1; index <= 2; index += 1) {
      db.prepare(
        `INSERT INTO project_decision (
           id, project_id, summary, decided_at, origin_ref
         ) VALUES (?, ?, ?, ?, ?)`,
      ).run(
        `pdec_${index}`,
        "proj_artifacts",
        `Decision ${index}`,
        3_000 + index,
        `origin:decision:${index}`,
      );
    }
    insertProjectIndexSnapshot(db, {
      id: "pidx_latest",
      projectId: "proj_artifacts",
      startedAt: 4_000,
      finishedAt: 4_100,
      sourcesSeen: 3,
      artifactsExtracted: 9,
      triggeredBy: "manual",
      status: "completed",
    });

    const result = await runtime.runTool({
      toolId: "project.get",
      input: { id: "proj_artifacts" },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        artifactSummary: {
          derivedState: true,
          counts: {
            extractedTasks: 2,
            promotedTasks: 6,
            openBlockers: 6,
            clearedBlockers: 1,
            decisions: 2,
            threads: 1,
          },
          promotedTasks: {
            limit: 5,
            items: expect.arrayContaining([
              expect.objectContaining({
                id: "ptask_promoted_6",
                title: "Promoted commitment 6",
                status: "open",
                confidence: 1,
              }),
            ]),
          },
          openBlockers: {
            limit: 5,
            items: expect.arrayContaining([
              expect.objectContaining({
                id: "pblk_open_1",
                description: "Open blocker 1",
                status: "open",
              }),
            ]),
          },
          latestSnapshot: expect.objectContaining({
            id: "pidx_latest",
            finishedAt: 4_100,
            artifactsExtracted: 9,
            status: "completed",
          }),
          indexFreshness: {
            indexedAt: 4_100,
            status: "completed",
            sourcesSeen: 3,
            artifactsExtracted: 9,
          },
          semantics: {
            promotedTasks: "commitments",
            extractedTasks: "candidate_tasks",
          },
        },
      },
    });
    const summary = (result.data as { artifactSummary: unknown })
      .artifactSummary as {
      promotedTasks: { items: Array<{ id: string }> };
      openBlockers: { items: Array<{ id: string }> };
    };
    expect(summary.promotedTasks.items).toHaveLength(5);
    expect(summary.openBlockers.items).toHaveLength(5);
    expect(summary.promotedTasks.items.map((task) => task.id)).not.toContain(
      "ptask_extracted_1",
    );
    expect(JSON.stringify(result.data)).not.toContain("origin:");
    expect(JSON.stringify(result.data)).not.toContain("Cleared blocker");
  });

  it("project.get does not read sources, index, or mutate rows", async () => {
    writeFileSync(
      join(workspaceRoot, "get-only.md"),
      "TODO: this content must not be read by project.get",
    );
    insertRegisteredProject(db, {
      id: "proj_get_readonly",
      slug: "get-readonly",
      displayName: "Get Readonly",
      rootKind: "virtual",
      rootRef: "virtual:get-readonly",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_get_file",
      projectId: "proj_get_readonly",
      kind: "file",
      ref: "get-only.md",
    });
    const before = {
      sources: listProjectSources(db, "proj_get_readonly"),
      snapshots: listProjectIndexSnapshots(db, "proj_get_readonly"),
      tasks: listProjectTasks(db, "proj_get_readonly"),
      blockers: listProjectBlockers(db, "proj_get_readonly"),
    };

    const result = await runtime.runTool({
      toolId: "project.get",
      input: { id: "proj_get_readonly" },
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        artifactSummary: {
          counts: {
            extractedTasks: 0,
            promotedTasks: 0,
            openBlockers: 0,
            clearedBlockers: 0,
            decisions: 0,
            threads: 0,
          },
          latestSnapshot: null,
          indexFreshness: null,
        },
      },
    });
    expect(JSON.stringify(result.data)).not.toContain("this content");
    expect(listProjectSources(db, "proj_get_readonly")).toEqual(before.sources);
    expect(listProjectIndexSnapshots(db, "proj_get_readonly")).toEqual(
      before.snapshots,
    );
    expect(listProjectTasks(db, "proj_get_readonly")).toEqual(before.tasks);
    expect(listProjectBlockers(db, "proj_get_readonly")).toEqual(
      before.blockers,
    );
  });

  it("project.get and project.list expose source counts without source refs", async () => {
    insertRegisteredProject(db, {
      id: "proj_counted",
      slug: "counted",
      displayName: "Counted",
      rootKind: "virtual",
      rootRef: "virtual:counted",
      createdAt: 1_000,
    });
    db.prepare(
      `INSERT INTO project_source (
         id, project_id, kind, ref, last_indexed_at, source_hash
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("psrc_1", "proj_counted", "thread", "thread:secret-ref", null, null);

    const getResult = await runtime.runTool({
      toolId: "project.get",
      input: { id: "proj_counted" },
      sessionId: "session-1",
      decision: allowDecision,
    });
    const listResult = await runtime.runTool({
      toolId: "project.list",
      input: {},
      sessionId: "session-1",
      decision: allowDecision,
    });

    expect(getResult.data).toMatchObject({
      project: expect.objectContaining({ sourceCount: 1 }),
    });
    expect(listResult.data).toMatchObject({
      projects: [expect.objectContaining({ sourceCount: 1 })],
    });
    expect(JSON.stringify(getResult.data)).not.toContain("thread:secret-ref");
    expect(JSON.stringify(listResult.data)).not.toContain("thread:secret-ref");
  });

  it("does not register disabled Phase 5 tools or mutation surfaces", () => {
    const registeredToolIds = tools.list().map((tool) => tool.id);

    expect(registeredToolIds).toContain("project.list");
    expect(registeredToolIds).toContain("project.get");
    expect(registeredToolIds).toContain("project.register");
    expect(registeredToolIds).toContain("project.add_source");
    expect(registeredToolIds).toContain("project.index");
    expect(registeredToolIds).toContain("project.promote_task");
    expect(registeredToolIds).not.toContain("project.write_memory");
    expect(registeredToolIds).not.toContain("project.task");
    expect(registeredToolIds).not.toContain("project.thread");
    expect(registeredToolIds).not.toContain("project.blocker");
    expect(registeredToolIds).not.toContain("project.decision");
    expect(registeredToolIds).not.toContain("project.summarize");
    expect(registeredToolIds).not.toContain("project.extract");
    expect(registeredToolIds).not.toContain("project.extract_tasks");
    expect(registeredToolIds).not.toContain("background.indexing");
    expect(registeredToolIds).not.toContain("task.auto_promote");
    expect(registeredToolIds).not.toContain("voice.project_mutation");
  });

  it("project.register requires approval and does not mutate before approval", async () => {
    const result = await runtime.runTool({
      toolId: "project.register",
      input: {
        slug: "jarvis",
        displayName: "JARVIS",
        rootKind: "fs",
        rootRef: "workspace-ref",
        status: "active",
      },
      sessionId: "session-1",
      executionId: "register-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        requiredSafetyTag: "CONFIRM_ALWAYS",
      },
    });
    expect(listRegisteredProjects(db, { includeArchived: true })).toEqual([]);
  });

  it("project.register creates a row only after approval", async () => {
    const input = {
      slug: "jarvis",
      displayName: "JARVIS",
      rootKind: "virtual" as const,
      rootRef: "virtual:jarvis",
      status: "paused" as const,
    };
    await runtime.runTool({
      toolId: "project.register",
      input,
      sessionId: "session-1",
      executionId: "register-approved",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "register-approved",
      sessionId: "session-1",
      toolId: "project.register",
      toolName: "Register Project",
      scopeHash: tools.get("project.register").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "slug: jarvis; display_name: JARVIS; root_kind: virtual; root_ref: virtual:jarvis; status: paused",
    );
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "register-approved",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: true,
      executionId: "register-approved",
      decision: "APPROVED_ONCE",
      status: "COMPLETED",
      message: "Project registered.",
    });
    expect(approved.body).not.toHaveProperty("data");
    expect(approved.body).not.toHaveProperty("result");
    const row = getRegisteredProject(db, { slug: "jarvis" });
    expect(row).toMatchObject({
      slug: "jarvis",
      display_name: "JARVIS",
      root_kind: "virtual",
      root_ref: "virtual:jarvis",
      status: "paused",
    });
    expect(row?.id).toMatch(/^proj_/);
    expect(row?.id).not.toBe("virtual:jarvis");
  });

  it("project.register cannot use session approval", async () => {
    const input = {
      slug: "session-blocked",
      displayName: "Session Blocked",
      rootKind: "memory" as const,
      rootRef: "memory:session-blocked",
      status: "active" as const,
    };
    await runtime.runTool({
      toolId: "project.register",
      input,
      sessionId: "session-1",
      executionId: "register-session",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "register-session",
      sessionId: "session-1",
      toolId: "project.register",
      toolName: "Register Project",
      scopeHash: tools.get("project.register").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "register-session",
      decision: "APPROVED_SESSION",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved).toMatchObject({
      httpStatus: 409,
      body: { ok: false, reason: "approval_session_not_allowed" },
    });
    expect(
      getRegisteredProject(db, { slug: "session-blocked" }),
    ).toBeUndefined();
  });

  it("duplicate slug registration fails safely after approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_existing",
      slug: "jarvis",
      displayName: "Existing JARVIS",
      rootKind: "virtual",
      rootRef: "virtual:existing",
      createdAt: 500,
    });
    const input = {
      slug: "jarvis",
      displayName: "Duplicate JARVIS",
      rootKind: "virtual" as const,
      rootRef: "virtual:duplicate",
      status: "active" as const,
    };
    await runtime.runTool({
      toolId: "project.register",
      input,
      sessionId: "session-1",
      executionId: "register-duplicate",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "register-duplicate",
      sessionId: "session-1",
      toolId: "project.register",
      toolName: "Register Project",
      scopeHash: tools.get("project.register").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "register-duplicate",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: false,
      status: "DENIED",
      message: "Project slug is already registered.",
    });
    expect(approved.body).not.toHaveProperty("data");
    expect(listRegisteredProjects(db, { includeArchived: true })).toHaveLength(
      1,
    );
  });

  it("invalid root_kind and status fail validation before approval", async () => {
    await expect(
      runtime.runTool({
        toolId: "project.register",
        input: {
          slug: "bad-root",
          displayName: "Bad Root",
          rootKind: "network",
          rootRef: "https://example.test/project",
          status: "active",
        },
        sessionId: "session-1",
        executionId: "register-bad-root",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_tool_input" },
    });

    await expect(
      runtime.runTool({
        toolId: "project.register",
        input: {
          slug: "bad-status",
          displayName: "Bad Status",
          rootKind: "virtual",
          rootRef: "virtual:bad-status",
          status: "running",
        },
        sessionId: "session-1",
        executionId: "register-bad-status",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_tool_input" },
    });

    expect(listRegisteredProjects(db, { includeArchived: true })).toEqual([]);
  });

  it("project.add_source requires approval and does not mutate before approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_source",
      slug: "source",
      displayName: "Source",
      rootKind: "virtual",
      rootRef: "virtual:source",
      createdAt: 1_000,
    });

    const result = await runtime.runTool({
      toolId: "project.add_source",
      input: {
        projectId: "proj_source",
        kind: "thread",
        ref: "thread:phase-5-a3",
      },
      sessionId: "session-1",
      executionId: "source-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        requiredSafetyTag: "CONFIRM_ALWAYS",
      },
    });
    expect(countProjectSources(db, "proj_source")).toBe(0);
  });

  it("project.add_source adds a pointer ledger row only after approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_source",
      slug: "source",
      displayName: "Source",
      rootKind: "virtual",
      rootRef: "virtual:source",
      createdAt: 1_000,
    });
    const input = {
      projectId: "proj_source",
      kind: "thread" as const,
      ref: "thread:phase-5-a3",
    };
    await runtime.runTool({
      toolId: "project.add_source",
      input,
      sessionId: "session-1",
      executionId: "source-approved",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "source-approved",
      sessionId: "session-1",
      toolId: "project.add_source",
      toolName: "Add Project Source",
      scopeHash: tools.get("project.add_source").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_source; kind: thread; ref: thread:phase-5-a3; indexes_now: false",
    );
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "source-approved",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: true,
      executionId: "source-approved",
      decision: "APPROVED_ONCE",
      status: "COMPLETED",
      message: "Project source added.",
    });
    expect(approved.body).not.toHaveProperty("data");
    expect(approved.body).not.toHaveProperty("result");
    expect(listProjectSources(db, "proj_source")).toEqual([
      expect.objectContaining({
        project_id: "proj_source",
        kind: "thread",
        ref: "thread:phase-5-a3",
        last_indexed_at: null,
        source_hash: null,
      }),
    ]);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM long_term_memory").get(),
    ).toMatchObject({ count: 0 });
  });

  it("project.add_source fails safely for missing project and invalid kind", async () => {
    const missingProjectInput = {
      projectId: "proj_missing",
      kind: "thread" as const,
      ref: "thread:missing",
    };
    await runtime.runTool({
      toolId: "project.add_source",
      input: missingProjectInput,
      sessionId: "session-1",
      executionId: "source-missing-project",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "source-missing-project",
      sessionId: "session-1",
      toolId: "project.add_source",
      toolName: "Add Project Source",
      scopeHash: tools.get("project.add_source").scopeOf(missingProjectInput),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: missingProjectInput,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "source-missing-project",
        decision: "APPROVED_ONCE",
        approvalToken: pending.approvalToken,
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        ok: false,
        status: "DENIED",
        message: "Project is not registered.",
      },
    });
    expect(countProjectSources(db, "proj_missing")).toBe(0);

    await expect(
      runtime.runTool({
        toolId: "project.add_source",
        input: {
          projectId: "proj_missing",
          kind: "network_url",
          ref: "https://example.test/project",
        },
        sessionId: "session-1",
        executionId: "source-invalid-kind",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_tool_input" },
    });
  });

  it("project.promote_task requires approval and does not mutate before approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_promote",
      slug: "promote",
      displayName: "Promote",
      rootKind: "virtual",
      rootRef: "virtual:promote",
      createdAt: 1_000,
    });
    insertExtractedProjectTask({
      id: "ptask_promote",
      projectId: "proj_promote",
      title: "Promote safely",
      confidence: 0.75,
    });

    const result = await runtime.runTool({
      toolId: "project.promote_task",
      input: { projectId: "proj_promote", taskId: "ptask_promote" },
      sessionId: "session-1",
      executionId: "promote-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        requiredSafetyTag: "CONFIRM_ALWAYS",
      },
    });
    expect(listProjectTasks(db, "proj_promote")).toEqual([
      expect.objectContaining({
        id: "ptask_promote",
        promoted: 0,
        updated_at: 1_000,
      }),
    ]);
  });

  it("project.promote_task promotes an extracted task after approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_promote",
      slug: "promote",
      displayName: "Promote",
      rootKind: "virtual",
      rootRef: "virtual:promote",
      createdAt: 1_000,
    });
    insertExtractedProjectTask({
      id: "ptask_promote",
      projectId: "proj_promote",
      title: "Promote safely",
      confidence: 0.75,
      updatedAt: 1_000,
    });
    const input = { projectId: "proj_promote", taskId: "ptask_promote" };
    await runtime.runTool({
      toolId: "project.promote_task",
      input,
      sessionId: "session-1",
      executionId: "promote-approved",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "promote-approved",
      sessionId: "session-1",
      toolId: "project.promote_task",
      toolName: "Promote Project Task",
      scopeHash: tools.get("project.promote_task").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_promote; task_id: ptask_promote; task_title: Promote safely; current_status: extracted; confidence: 0.75",
    );
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "promote-approved",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: true,
      executionId: "promote-approved",
      decision: "APPROVED_ONCE",
      status: "COMPLETED",
      message: "Project task promoted.",
    });
    expect(approved.body).not.toHaveProperty("data");
    expect(approved.body).not.toHaveProperty("result");
    const [task] = listProjectTasks(db, "proj_promote");
    expect(task).toMatchObject({
      id: "ptask_promote",
      title: "Promote safely",
      status: "extracted",
      confidence: 0.75,
      promoted: 1,
      origin_ref: "origin:ptask_promote",
      created_at: 1_000,
    });
    expect(task?.updated_at).toBeGreaterThanOrEqual(1_000);

    const getResult = await runtime.runTool({
      toolId: "project.get",
      input: { id: "proj_promote" },
      sessionId: "session-1",
      decision: allowDecision,
    });
    expect(getResult.data).toMatchObject({
      artifactSummary: {
        counts: {
          extractedTasks: 0,
          promotedTasks: 1,
        },
        promotedTasks: {
          items: [
            expect.objectContaining({
              id: "ptask_promote",
              title: "Promote safely",
              status: "extracted",
              confidence: 0.75,
            }),
          ],
        },
        semantics: {
          promotedTasks: "commitments",
          extractedTasks: "candidate_tasks",
        },
      },
    });
    expect(JSON.stringify(getResult.data)).not.toContain(
      "origin:ptask_promote",
    );
  });

  it("project.promote_task cannot use session approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_promote",
      slug: "promote",
      displayName: "Promote",
      rootKind: "virtual",
      rootRef: "virtual:promote",
      createdAt: 1_000,
    });
    insertExtractedProjectTask({
      id: "ptask_session",
      projectId: "proj_promote",
    });
    const input = { projectId: "proj_promote", taskId: "ptask_session" };
    await runtime.runTool({
      toolId: "project.promote_task",
      input,
      sessionId: "session-1",
      executionId: "promote-session",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "promote-session",
      sessionId: "session-1",
      toolId: "project.promote_task",
      toolName: "Promote Project Task",
      scopeHash: tools.get("project.promote_task").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "promote-session",
      decision: "APPROVED_SESSION",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved).toMatchObject({
      httpStatus: 409,
      body: { ok: false, reason: "approval_session_not_allowed" },
    });
    expect(listProjectTasks(db, "proj_promote")).toEqual([
      expect.objectContaining({ id: "ptask_session", promoted: 0 }),
    ]);
  });

  it("project.promote_task fails safely for duplicates and missing rows", async () => {
    insertRegisteredProject(db, {
      id: "proj_promote",
      slug: "promote",
      displayName: "Promote",
      rootKind: "virtual",
      rootRef: "virtual:promote",
      createdAt: 1_000,
    });
    insertExtractedProjectTask({
      id: "ptask_promoted",
      projectId: "proj_promote",
      promoted: 1,
    });
    insertExtractedProjectTask({
      id: "ptask_open",
      projectId: "proj_promote",
      status: "open",
    });

    await expect(
      runApprovedProjectPromoteTask("promote-duplicate", {
        projectId: "proj_promote",
        taskId: "ptask_promoted",
      }),
    ).resolves.toMatchObject({
      body: {
        ok: false,
        status: "DENIED",
        message: "Project task is already promoted.",
      },
    });
    await expect(
      runApprovedProjectPromoteTask("promote-missing-project", {
        projectId: "proj_missing",
        taskId: "ptask_promoted",
      }),
    ).resolves.toMatchObject({
      body: {
        ok: false,
        status: "DENIED",
        message: "Project is not registered.",
      },
    });
    await expect(
      runApprovedProjectPromoteTask("promote-missing-task", {
        projectId: "proj_promote",
        taskId: "ptask_missing",
      }),
    ).resolves.toMatchObject({
      body: {
        ok: false,
        status: "DENIED",
        message: "Project task is not registered.",
      },
    });
    await expect(
      runApprovedProjectPromoteTask("promote-open-task", {
        projectId: "proj_promote",
        taskId: "ptask_open",
      }),
    ).resolves.toMatchObject({
      body: {
        ok: false,
        status: "DENIED",
        message: "Only extracted project tasks can be promoted.",
      },
    });
  });

  it("project.index requires approval and does not snapshot before approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_unapproved",
      projectId: "proj_index",
      kind: "thread",
      ref: "thread:unapproved",
    });

    const result = await runtime.runTool({
      toolId: "project.index",
      input: { projectId: "proj_index", triggeredBy: "manual" },
      sessionId: "session-1",
      executionId: "index-1",
      decision: allowDecision,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        requiredSafetyTag: "CONFIRM_ALWAYS",
      },
    });
    expect(listProjectIndexSnapshots(db, "proj_index")).toEqual([]);
    expect(listProjectSources(db, "proj_index")).toEqual([
      expect.objectContaining({
        id: "psrc_unapproved",
        last_indexed_at: null,
        source_hash: null,
      }),
    ]);
  });

  it("project.index does not read file content before approval", async () => {
    writeFileSync(
      join(workspaceRoot, "unapproved.md"),
      "TODO: secret unapproved task",
    );
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_file_unapproved",
      projectId: "proj_index",
      kind: "file",
      ref: "unapproved.md",
    });

    const result = await runtime.runTool({
      toolId: "project.index",
      input: { projectId: "proj_index", triggeredBy: "manual" },
      sessionId: "session-1",
      executionId: "index-file-unapproved",
      decision: allowDecision,
    });

    expect(result).toMatchObject({ status: "AWAITING_APPROVAL" });
    expect(listProjectTasks(db, "proj_index")).toEqual([]);
    expect(listProjectBlockers(db, "proj_index")).toEqual([]);
    expect(listProjectIndexSnapshots(db, "proj_index")).toEqual([]);
  });

  it("project.index records a metadata-only snapshot after approval", async () => {
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    db.prepare(
      `INSERT INTO project_source (
         id, project_id, kind, ref, last_indexed_at, source_hash
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      "psrc_index",
      "proj_index",
      "thread",
      "thread:do-not-read",
      null,
      null,
    );
    const input = { projectId: "proj_index", triggeredBy: "manual" };
    await runtime.runTool({
      toolId: "project.index",
      input,
      sessionId: "session-1",
      executionId: "index-approved",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "index-approved",
      sessionId: "session-1",
      toolId: "project.index",
      toolName: "Index Project Snapshot",
      scopeHash: tools.get("project.index").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_index; triggered_by: manual; mode: deterministic_markers; file_sources_only: true",
    );
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "index-approved",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: true,
      executionId: "index-approved",
      decision: "APPROVED_ONCE",
      status: "COMPLETED",
      message: "Project index snapshot recorded.",
    });
    expect(approved.body).not.toHaveProperty("data");
    expect(approved.body).not.toHaveProperty("result");
    expect(listProjectIndexSnapshots(db, "proj_index")).toEqual([
      expect.objectContaining({
        project_id: "proj_index",
        sources_seen: 1,
        artifacts_extracted: 0,
        triggered_by: "manual",
        finished_at: expect.any(Number),
        status: "completed",
      }),
    ]);
    expect(listProjectSources(db, "proj_index")).toEqual([
      expect.objectContaining({
        id: "psrc_index",
        last_indexed_at: expect.any(Number),
        source_hash: null,
      }),
    ]);
    for (const tableName of [
      "project_thread",
      "project_task",
      "project_blocker",
      "project_decision",
    ]) {
      expect(
        db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get(),
      ).toMatchObject({ count: 0 });
    }
    expect(JSON.stringify(approved.body)).not.toContain("thread:do-not-read");
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM long_term_memory").get(),
    ).toMatchObject({ count: 0 });
  });

  it("project.index extracts deterministic markers from explicitly registered safe files only", async () => {
    writeFileSync(
      join(workspaceRoot, "markers.md"),
      [
        "TODO: finish deterministic parser secret-alpha",
        "FIXME: repair snapshot count secret-beta",
        "notes #task document marker confidence secret-gamma",
        "#blocked waiting for schema fixture secret-delta",
        "blocked by approval review secret-epsilon",
        "waiting on final gates secret-zeta",
      ].join("\n"),
    );
    writeFileSync(
      join(workspaceRoot, "ignored.md"),
      "TODO: ignored unregistered task",
    );
    writeFileSync(
      join(workspaceRoot, "memory-pointer.md"),
      "TODO: ignored memory pointer task",
    );
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_markers",
      projectId: "proj_index",
      kind: "file",
      ref: "markers.md",
    });
    insertProjectSource(db, {
      id: "psrc_memory",
      projectId: "proj_index",
      kind: "memory_slug",
      ref: "memory-pointer.md",
    });
    insertProjectSource(db, {
      id: "psrc_obsidian",
      projectId: "proj_index",
      kind: "obsidian_note",
      ref: "ignored.md",
    });
    insertProjectSource(db, {
      id: "psrc_thread",
      projectId: "proj_index",
      kind: "thread",
      ref: "ignored.md",
    });

    const approved = await runApprovedProjectIndex("index-markers", {
      projectId: "proj_index",
      triggeredBy: "manual",
    });

    expect(approved.body).toMatchObject({
      ok: true,
      status: "COMPLETED",
      message: "Project index snapshot recorded.",
    });
    const tasks = listProjectTasks(db, "proj_index").sort((left, right) =>
      left.origin_ref.localeCompare(right.origin_ref),
    );
    const blockers = listProjectBlockers(db, "proj_index").sort((left, right) =>
      left.origin_ref.localeCompare(right.origin_ref),
    );
    expect(tasks).toEqual([
      expect.objectContaining({
        title: "finish deterministic parser secret-alpha",
        status: "extracted",
        confidence: 0.85,
        promoted: 0,
        origin_ref: "markers.md#L1:C1:task:TODO:",
      }),
      expect.objectContaining({
        title: "repair snapshot count secret-beta",
        status: "extracted",
        confidence: 0.9,
        promoted: 0,
        origin_ref: "markers.md#L2:C1:task:FIXME:",
      }),
      expect.objectContaining({
        title: "document marker confidence secret-gamma",
        status: "extracted",
        confidence: 0.8,
        promoted: 0,
        origin_ref: "markers.md#L3:C7:task:#task",
      }),
    ]);
    expect(blockers).toEqual([
      expect.objectContaining({
        description: "waiting for schema fixture secret-delta",
        status: "open",
        task_id: null,
        origin_ref: "markers.md#L4:C1:blocker:#blocked",
      }),
      expect.objectContaining({
        description: "approval review secret-epsilon",
        status: "open",
        task_id: null,
        origin_ref: "markers.md#L5:C1:blocker:blocked by",
      }),
      expect.objectContaining({
        description: "final gates secret-zeta",
        status: "open",
        task_id: null,
        origin_ref: "markers.md#L6:C1:blocker:waiting on",
      }),
    ]);
    expect(listProjectIndexSnapshots(db, "proj_index")).toEqual([
      expect.objectContaining({
        sources_seen: 4,
        artifacts_extracted: 6,
        status: "completed",
      }),
    ]);
    expect(JSON.stringify(approved.body)).not.toContain("secret-alpha");
    expect(
      JSON.stringify(listProjectIndexSnapshots(db, "proj_index")),
    ).not.toContain("secret-alpha");
    expect(JSON.stringify(listToolCalls(db))).not.toContain("secret-alpha");
    expect(JSON.stringify(listToolCalls(db))).not.toContain("ignored");
  });

  it("project.index deterministic marker extraction is idempotent by origin_ref", async () => {
    writeFileSync(join(workspaceRoot, "repeat.md"), "TODO: run once");
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_repeat",
      projectId: "proj_index",
      kind: "file",
      ref: "repeat.md",
    });

    await runApprovedProjectIndex("index-repeat-1", {
      projectId: "proj_index",
      triggeredBy: "manual",
    });
    await runApprovedProjectIndex("index-repeat-2", {
      projectId: "proj_index",
      triggeredBy: "manual",
    });

    expect(listProjectTasks(db, "proj_index")).toHaveLength(1);
    expect(
      listProjectIndexSnapshots(db, "proj_index").map(
        (row) => row.artifacts_extracted,
      ),
    ).toEqual([0, 1]);
  });

  it("project.index fails safe before reading an unsafe registered file ref", async () => {
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_escape",
      projectId: "proj_index",
      kind: "file",
      ref: "../outside-a7.md",
    });

    const approved = await runApprovedProjectIndex("index-unsafe-file", {
      projectId: "proj_index",
      triggeredBy: "manual",
    });

    expect(approved.body).toMatchObject({
      ok: false,
      status: "ERROR",
      message: "Project index snapshot failed during metadata validation.",
    });
    expect(listProjectTasks(db, "proj_index")).toEqual([]);
    expect(listProjectBlockers(db, "proj_index")).toEqual([]);
    expect(listProjectIndexSnapshots(db, "proj_index")).toEqual([
      expect.objectContaining({
        artifacts_extracted: 0,
        status: "failed",
      }),
    ]);
  });

  it("project.index fails closed without touching source metadata for disabled source refs", async () => {
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_network",
      projectId: "proj_index",
      kind: "thread",
      ref: "https://example.test/project",
    });
    const input = { projectId: "proj_index", triggeredBy: "manual" };
    await runtime.runTool({
      toolId: "project.index",
      input,
      sessionId: "session-1",
      executionId: "index-failed",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "index-failed",
      sessionId: "session-1",
      toolId: "project.index",
      toolName: "Index Project Snapshot",
      scopeHash: tools.get("project.index").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "index-failed",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: false,
      status: "ERROR",
      message: "Project index snapshot failed during metadata validation.",
    });
    expect(listProjectIndexSnapshots(db, "proj_index")).toEqual([
      expect.objectContaining({
        project_id: "proj_index",
        sources_seen: 1,
        artifacts_extracted: 0,
        status: "failed",
      }),
    ]);
    expect(listProjectSources(db, "proj_index")).toEqual([
      expect.objectContaining({
        id: "psrc_network",
        last_indexed_at: null,
        source_hash: null,
      }),
    ]);
  });

  it("project.index metadata pass does not query content-bearing project sources", async () => {
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectSource(db, {
      id: "psrc_thread",
      projectId: "proj_index",
      kind: "thread",
      ref: "thread:content-must-not-be-read",
    });
    const prepare = db.prepare.bind(db);
    const blockedContentTables =
      /\b(long_term_memory|messages|reflective_memory|semantic_memory)\b/i;
    db.prepare = ((source: string) => {
      expect(source).not.toMatch(blockedContentTables);
      expect(source).not.toMatch(/\bcontent\b/i);
      return prepare(source);
    }) as typeof db.prepare;
    const input = { projectId: "proj_index", triggeredBy: "manual" };
    await runtime.runTool({
      toolId: "project.index",
      input,
      sessionId: "session-1",
      executionId: "index-no-content",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "index-no-content",
      sessionId: "session-1",
      toolId: "project.index",
      toolName: "Index Project Snapshot",
      scopeHash: tools.get("project.index").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "index-no-content",
        decision: "APPROVED_ONCE",
        approvalToken: pending.approvalToken,
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        status: "COMPLETED",
      },
    });
  });

  it("project.index rejects concurrent active snapshots with a rejected audit row", async () => {
    insertRegisteredProject(db, {
      id: "proj_index",
      slug: "index",
      displayName: "Index",
      rootKind: "virtual",
      rootRef: "virtual:index",
      createdAt: 1_000,
    });
    insertProjectIndexSnapshot(db, {
      id: "pidx_running",
      projectId: "proj_index",
      startedAt: 1_050,
      sourcesSeen: 0,
      artifactsExtracted: 0,
      triggeredBy: "manual",
      status: "running",
    });
    const input = { projectId: "proj_index", triggeredBy: "manual" };
    await runtime.runTool({
      toolId: "project.index",
      input,
      sessionId: "session-1",
      executionId: "index-rejected",
      decision: allowDecision,
    });
    const pending = ensurePendingToolApproval({
      db,
      executionId: "index-rejected",
      sessionId: "session-1",
      toolId: "project.index",
      toolName: "Index Project Snapshot",
      scopeHash: tools.get("project.index").scopeOf(input),
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: input,
      now,
      ttlMs: 500,
    });
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "index-rejected",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    expect(approved.body).toMatchObject({
      ok: false,
      status: "DENIED",
      message: "Project index snapshot rejected because one is already active.",
    });
    expect(
      listProjectIndexSnapshots(db, "proj_index").map((row) => row.status),
    ).toEqual(["rejected", "running"]);
  });
});
