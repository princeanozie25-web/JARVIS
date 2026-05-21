import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { applyMigrations } from "../db/schema";
import { listToolCalls } from "../db/tool-calls";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { InProcessToolRuntime } from "../tools/runtime";
import { ToolRegistry } from "../tools/registry";
import type { Tool } from "../tools/types";
import { ensurePendingToolApproval, resumeApproval } from "./tool-approvals";

const allowDecision: RouterDecision = {
  intent: { intent: "DETERMINISTIC_COMMAND", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["tools"],
    reason: "test",
  },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["tools"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let calls: string[];
let now: number;
let runtime: InProcessToolRuntime;
let approvalTokens: Map<string, string>;

const confirmTool: Tool<{ value: string }> = {
  id: "mock.confirm",
  name: "Mock Confirm",
  description: "Test-only confirmation tool.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: z.object({ value: z.string() }),
  scopeOf(input) {
    return `value:${input.value}`;
  },
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: 1000,
  async execute(input) {
    calls.push(input.value);
    return {
      ok: true,
      status: "COMPLETED",
      message: `executed ${input.value}`,
      data: { value: input.value },
    };
  },
};

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  calls = [];
  approvalTokens = new Map();
  now = 1_000;
  const registry = new ToolRegistry();
  registry.register(confirmTool);
  runtime = new InProcessToolRuntime(registry, {
    db,
    now: () => now,
    newId: () => "generated-exec",
  });
});

afterEach(() => {
  db.close();
});

async function requestApproval(executionId: string, value = "alpha") {
  const result = await runtime.runTool({
    toolId: confirmTool.id,
    input: { value },
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  expect(result.status).toBe("AWAITING_APPROVAL");
  const pending = ensurePendingToolApproval({
    db,
    executionId,
    sessionId: "session-1",
    toolId: confirmTool.id,
    toolName: confirmTool.name,
    scopeHash: confirmTool.scopeOf({ value }),
    requiredSafetyTag: confirmTool.requiredSafetyTag,
    safetyTag: "ALLOW",
    toolInput: { value },
    now,
    ttlMs: 500,
  });
  approvalTokens.set(executionId, pending.approvalToken);
  return pending;
}

function tokenFor(executionId: string): string {
  const token = approvalTokens.get(executionId);
  if (!token) throw new Error(`Missing approval token for ${executionId}`);
  return token;
}

describe("tool approval flow", () => {
  it("creates a pending approval payload for SSE", async () => {
    const pending = await requestApproval("exec-1");

    expect(pending).toMatchObject({
      executionId: "exec-1",
      toolId: "mock.confirm",
      toolName: "Mock Confirm",
      scopeHash: "value:alpha",
      requiredSafetyTag: "CONFIRM_ONCE",
      safetyTag: "ALLOW",
      summary: "fields: value",
      approvalExpiresAt: 1_500,
    });
    expect(pending.approvalToken).toEqual(expect.any(String));
    expect(pending.approvalToken.length).toBeGreaterThan(20);
    const storedApproval = db
      .prepare("SELECT token_hash FROM approvals WHERE execution_id = ?")
      .get("exec-1") as { token_hash: string };
    expect(storedApproval.token_hash).not.toBe(pending.approvalToken);
    expect(listToolCalls(db)[0].status).toBe("AWAITING_APPROVAL");
  });

  it("shows project registration details in the approval summary", () => {
    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-project",
      sessionId: "session-1",
      toolId: "project.register",
      toolName: "Register Project",
      scopeHash: "project.register:slug:jarvis",
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: {
        slug: "jarvis",
        displayName: "JARVIS",
        rootKind: "fs",
        rootRef: "workspace-ref",
        status: "active",
      },
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "slug: jarvis; display_name: JARVIS; root_kind: fs; root_ref: workspace-ref; status: active",
    );
    expect(JSON.stringify(pending)).not.toContain("output_json");
    expect(JSON.stringify(pending)).not.toContain("result");
  });

  it("shows project source pointer details in the approval summary", () => {
    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-source",
      sessionId: "session-1",
      toolId: "project.add_source",
      toolName: "Add Project Source",
      scopeHash: "project.add_source:project:proj_1",
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: {
        projectId: "proj_1",
        kind: "thread",
        ref: "thread:phase-5-a3",
      },
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_1; kind: thread; ref: thread:phase-5-a3; indexes_now: false",
    );
    expect(JSON.stringify(pending)).not.toContain("output_json");
    expect(JSON.stringify(pending)).not.toContain("result");
  });

  it("shows deterministic marker project index details in the approval summary", () => {
    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-index",
      sessionId: "session-1",
      toolId: "project.index",
      toolName: "Index Project Snapshot",
      scopeHash: "project.index:project:proj_1",
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: {
        projectId: "proj_1",
        triggeredBy: "manual",
      },
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_1; triggered_by: manual; mode: deterministic_markers; file_sources_only: true",
    );
    expect(JSON.stringify(pending)).not.toContain("output_json");
    expect(JSON.stringify(pending)).not.toContain("result");
  });

  it("shows safe project task promotion details in the approval summary", () => {
    db.prepare(
      `INSERT INTO projects (
         id, slug, display_name, root_kind, root_ref, created_at, archived_at, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "proj_1",
      "jarvis",
      "JARVIS",
      "virtual",
      "virtual:jarvis",
      1_000,
      null,
      "active",
    );
    db.prepare(
      `INSERT INTO project_task (
         id, project_id, thread_id, title, status, confidence, promoted,
         origin_ref, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "ptask_1",
      "proj_1",
      null,
      "Review artifact read model",
      "extracted",
      0.85,
      0,
      "origin:hidden",
      1_000,
      1_000,
    );

    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-promote",
      sessionId: "session-1",
      toolId: "project.promote_task",
      toolName: "Promote Project Task",
      scopeHash: "project.promote_task:project:proj_1:task:ptask_1",
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: {
        projectId: "proj_1",
        taskId: "ptask_1",
      },
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_1; task_id: ptask_1; task_title: Review artifact read model; current_status: extracted; confidence: 0.85",
    );
    expect(pending.summary).not.toContain("origin:hidden");
    expect(JSON.stringify(pending)).not.toContain("output_json");
    expect(JSON.stringify(pending)).not.toContain("result");
  });

  it("shows safe project status change details in the approval summary", () => {
    db.prepare(
      `INSERT INTO projects (
         id, slug, display_name, root_kind, root_ref, created_at, archived_at, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "proj_1",
      "jarvis",
      "JARVIS",
      "virtual",
      "virtual:jarvis",
      1_000,
      null,
      "active",
    );

    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-status",
      sessionId: "session-1",
      toolId: "project.set_status",
      toolName: "Set Project Status",
      scopeHash: "project.set_status:project:proj_1:status:paused",
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: {
        projectId: "proj_1",
        status: "paused",
      },
      now,
      ttlMs: 500,
    });

    expect(pending.summary).toBe(
      "project_id: proj_1; slug: jarvis; display_name: JARVIS; current_status: active; requested_status: paused",
    );
    expect(JSON.stringify(pending)).not.toContain("output_json");
    expect(JSON.stringify(pending)).not.toContain("result");
  });

  it("allows an approved-once tool execution exactly once", async () => {
    await requestApproval("exec-1");
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime,
      executionId: "exec-1",
      decision: "APPROVED_ONCE",
      approvalToken: tokenFor("exec-1"),
      now,
    });

    expect(approved.body).toMatchObject({
      ok: true,
      status: "COMPLETED",
    });
    expect(approved.body).not.toHaveProperty("result");
    expect(calls).toEqual(["alpha"]);
    expect(listToolCalls(db)[0].status).toBe("COMPLETED");

    const replay = await runtime.runTool({
      toolId: confirmTool.id,
      input: { value: "alpha" },
      sessionId: "session-1",
      executionId: "exec-2",
      decision: allowDecision,
    });

    expect(replay).toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "approval_replayed" },
    });
    expect(calls).toEqual(["alpha"]);
  });

  it("consumes approved-once when execution is attempted even if the tool fails", async () => {
    const failingTool: Tool<{ value: string }> = {
      id: "mock.fails_after_approval",
      name: "Mock Fails After Approval",
      description: "Test-only tool that fails after approval.",
      requiredSafetyTag: "CONFIRM_ONCE",
      inputSchema: z.object({ value: z.string() }),
      scopeOf(input) {
        return `value:${input.value}`;
      },
      reversibilityClass: "REVERSIBLE_WRITE",
      timeoutMs: 1000,
      async execute(input) {
        calls.push(input.value);
        return {
          ok: false,
          status: "DENIED",
          message: "failed after approval",
          data: { reason: "injected_failure" },
        };
      },
    };
    const localRegistry = new ToolRegistry();
    localRegistry.register(failingTool);
    const localRuntime = new InProcessToolRuntime(localRegistry, {
      db,
      now: () => now,
    });

    const requested = await localRuntime.runTool({
      toolId: failingTool.id,
      input: { value: "alpha" },
      sessionId: "session-1",
      executionId: "exec-fail",
      decision: allowDecision,
    });
    expect(requested.status).toBe("AWAITING_APPROVAL");
    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-fail",
      sessionId: "session-1",
      toolId: failingTool.id,
      toolName: failingTool.name,
      scopeHash: failingTool.scopeOf({ value: "alpha" }),
      requiredSafetyTag: failingTool.requiredSafetyTag,
      safetyTag: "ALLOW",
      toolInput: { value: "alpha" },
      now,
      ttlMs: 500,
    });
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: localRuntime,
        executionId: "exec-fail",
        decision: "APPROVED_ONCE",
        approvalToken: pending.approvalToken,
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        ok: false,
        status: "DENIED",
        message: "failed after approval",
      },
    });

    await expect(
      localRuntime.runTool({
        toolId: failingTool.id,
        input: { value: "alpha" },
        sessionId: "session-1",
        executionId: "exec-replay",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "approval_replayed" },
    });
    expect(calls).toEqual(["alpha"]);
  });

  it("allows session approval for the same session tool and scope", async () => {
    await requestApproval("exec-1");
    now = 1_100;

    await resumeApproval({
      db,
      runtime,
      executionId: "exec-1",
      decision: "APPROVED_SESSION",
      approvalToken: tokenFor("exec-1"),
      now,
      sessionTtlMs: 10_000,
    });

    const second = await runtime.runTool({
      toolId: confirmTool.id,
      input: { value: "alpha" },
      sessionId: "session-1",
      executionId: "exec-2",
      decision: allowDecision,
    });

    expect(second).toMatchObject({ ok: true, status: "COMPLETED" });
    expect(calls).toEqual(["alpha", "alpha"]);
  });

  it("does not execute an expired approval", async () => {
    await requestApproval("exec-1");
    now = 2_000;

    const expired = await resumeApproval({
      db,
      runtime,
      executionId: "exec-1",
      decision: "APPROVED_ONCE",
      approvalToken: tokenFor("exec-1"),
      now,
    });

    expect(expired.httpStatus).toBe(410);
    expect(expired.body.reason).toBe("approval_expired");
    expect(calls).toEqual([]);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("records denial and returns a synthetic denied tool result", async () => {
    await requestApproval("exec-1");
    now = 1_100;

    const denied = await resumeApproval({
      db,
      runtime,
      executionId: "exec-1",
      decision: "DENIED",
      approvalToken: tokenFor("exec-1"),
      now,
    });

    expect(denied.body).toMatchObject({
      ok: false,
      status: "DENIED",
      message: "Tool execution denied by user.",
    });
    expect(denied.body).not.toHaveProperty("result");
    expect(calls).toEqual([]);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
    const approval = db
      .prepare("SELECT consumed_at FROM approvals WHERE execution_id = ?")
      .get("exec-1") as { consumed_at: number | null };
    expect(approval.consumed_at).toBeNull();
  });

  it("emits tool_approved and tool_denied telemetry with session and execution ids", async () => {
    await requestApproval("exec-1");
    await requestApproval("exec-2", "beta");
    now = 1_100;
    const approvalEvents: Array<
      Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
    > = [];

    await resumeApproval({
      db,
      runtime,
      executionId: "exec-1",
      decision: "APPROVED_ONCE",
      approvalToken: tokenFor("exec-1"),
      now,
      recordEvent(event) {
        approvalEvents.push(event);
      },
    });
    await resumeApproval({
      db,
      runtime,
      executionId: "exec-2",
      decision: "DENIED",
      approvalToken: tokenFor("exec-2"),
      now,
      recordEvent(event) {
        approvalEvents.push(event);
      },
    });

    expect(
      approvalEvents.map((event) => ({
        type: event.event_type,
        session: event.session_id,
        execution: event.execution_id,
      })),
    ).toEqual([
      { type: "tool_approved", session: "session-1", execution: "exec-1" },
      { type: "tool_denied", session: "session-1", execution: "exec-2" },
    ]);
  });

  it("does not return raw tool data text in the approval HTTP body", async () => {
    const secretBody = "SUPER_SECRET_DOCUMENT_BODY_XYZ123";
    const textReturningTool: Tool<{ value: string }> = {
      id: "mock.text_return",
      name: "Mock Text Return",
      description: "Test-only CONFIRM_ONCE tool that returns text in data.",
      requiredSafetyTag: "CONFIRM_ONCE",
      inputSchema: z.object({ value: z.string() }),
      scopeOf(input) {
        return `value:${input.value}`;
      },
      reversibilityClass: "PURE_READ",
      timeoutMs: 1000,
      async execute(input) {
        return {
          ok: true,
          status: "COMPLETED",
          message: "Text returned",
          data: { text: secretBody, echoed: input.value },
        };
      },
    };
    const localRegistry = new ToolRegistry();
    localRegistry.register(textReturningTool);
    const localRuntime = new InProcessToolRuntime(localRegistry, {
      db,
      now: () => now,
      newId: () => "exec-text-return",
    });

    const requested = await localRuntime.runTool({
      toolId: textReturningTool.id,
      input: { value: "alpha" },
      sessionId: "session-1",
      executionId: "exec-text-return",
      decision: allowDecision,
    });
    expect(requested.status).toBe("AWAITING_APPROVAL");

    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-text-return",
      sessionId: "session-1",
      toolId: textReturningTool.id,
      toolName: textReturningTool.name,
      scopeHash: textReturningTool.scopeOf({ value: "alpha" }),
      requiredSafetyTag: textReturningTool.requiredSafetyTag,
      safetyTag: "ALLOW",
      toolInput: { value: "alpha" },
      now,
      ttlMs: 500,
    });
    now = 1_100;

    const approved = await resumeApproval({
      db,
      runtime: localRuntime,
      executionId: "exec-text-return",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
    });

    // The body must NOT contain raw returned data.
    const bodyJson = JSON.stringify(approved.body);
    expect(bodyJson).not.toContain(secretBody);
    expect(bodyJson).not.toContain("echoed");

    // The shape must be exactly the safe metadata fields.
    expect(approved.body).toMatchObject({
      ok: true,
      executionId: "exec-text-return",
      decision: "APPROVED_ONCE",
      status: "COMPLETED",
    });
    expect(approved.body).not.toHaveProperty("result");
    expect(approved.body).not.toHaveProperty("data");

    // The tool result is still recorded in tool_calls.output_json for audit.
    const row = listToolCalls(db).find(
      (r) => r.execution_id === "exec-text-return",
    );
    expect(row?.status).toBe("COMPLETED");
    expect(row?.output_json).toContain(secretBody);
  });

  it("rejects missing, invalid, reused, and cross-execution tokens", async () => {
    await requestApproval("exec-1");
    await requestApproval("exec-2", "beta");
    now = 1_100;
    const approvalEvents: Array<
      Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
    > = [];

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "exec-1",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          approvalEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      httpStatus: 401,
      body: { ok: false, reason: "approval_invalid_token" },
    });
    expect(calls).toEqual([]);
    expect(
      listToolCalls(db).find((row) => row.execution_id === "exec-1"),
    ).toMatchObject({ status: "AWAITING_APPROVAL" });

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "exec-1",
        decision: "APPROVED_ONCE",
        approvalToken: "not-the-token",
        now,
        recordEvent(event) {
          approvalEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      httpStatus: 401,
      body: { ok: false, reason: "approval_invalid_token" },
    });

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "exec-1",
        decision: "APPROVED_ONCE",
        approvalToken: tokenFor("exec-2"),
        now,
      }),
    ).resolves.toMatchObject({
      httpStatus: 401,
      body: { ok: false, reason: "approval_invalid_token" },
    });
    expect(calls).toEqual([]);

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "exec-1",
        decision: "APPROVED_ONCE",
        approvalToken: tokenFor("exec-1"),
        now,
      }),
    ).resolves.toMatchObject({
      httpStatus: 200,
      body: { ok: true },
    });
    expect(calls).toEqual(["alpha"]);

    await expect(
      resumeApproval({
        db,
        runtime,
        executionId: "exec-1",
        decision: "APPROVED_ONCE",
        approvalToken: tokenFor("exec-1"),
        now,
        recordEvent(event) {
          approvalEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      httpStatus: 409,
      body: { ok: false, reason: "approval_replayed" },
    });
    expect(calls).toEqual(["alpha"]);
    expect(JSON.stringify(approvalEvents)).not.toContain(tokenFor("exec-1"));
    expect(JSON.stringify(approvalEvents)).not.toContain(tokenFor("exec-2"));
  });
});
