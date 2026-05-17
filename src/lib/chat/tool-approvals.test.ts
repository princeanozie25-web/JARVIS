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

    expect(approved.body.result).toMatchObject({
      ok: true,
      status: "COMPLETED",
    });
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

    expect(denied.body.result).toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "approval_denied" },
    });
    expect(calls).toEqual([]);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
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
