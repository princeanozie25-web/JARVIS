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
import {
  countProjectSources,
  insertProjectSource,
  listProjectSources,
} from "../db/project-sources";
import { getRegisteredProject, listRegisteredProjects } from "../db/projects";
import { applyMigrations } from "../db/schema";
import { insertRegisteredProject } from "../db/projects";
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

beforeEach(() => {
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
});

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
    expect(registeredToolIds).not.toContain("project.write_memory");
    expect(registeredToolIds).not.toContain("project.task");
    expect(registeredToolIds).not.toContain("project.thread");
    expect(registeredToolIds).not.toContain("project.blocker");
    expect(registeredToolIds).not.toContain("project.decision");
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
      "project_id: proj_index; triggered_by: manual; mode: metadata_only; artifacts_extracted: 0",
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
    expect(JSON.stringify(approved.body)).not.toContain("thread:do-not-read");
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM long_term_memory").get(),
    ).toMatchObject({ count: 0 });
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
