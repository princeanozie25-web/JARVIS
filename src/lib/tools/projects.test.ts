import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensurePendingToolApproval,
  resumeApproval,
} from "../chat/tool-approvals";
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
      }),
    });
  });

  it("does not register disabled Phase 5 tools or mutation surfaces", () => {
    const registeredToolIds = tools.list().map((tool) => tool.id);

    expect(registeredToolIds).toContain("project.list");
    expect(registeredToolIds).toContain("project.get");
    expect(registeredToolIds).toContain("project.register");
    expect(registeredToolIds).not.toContain("project.index");
    expect(registeredToolIds).not.toContain("project.write_memory");
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
});
