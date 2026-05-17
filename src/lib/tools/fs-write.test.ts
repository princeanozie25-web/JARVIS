import Database from "better-sqlite3";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensurePendingToolApproval,
  resumeApproval,
} from "../chat/tool-approvals";
import { listRollbacks } from "../db/rollbacks";
import { applyMigrations } from "../db/schema";
import { listToolCalls } from "../db/tool-calls";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { InProcessToolRuntime, tools } from ".";

const allowDecision: RouterDecision = {
  intent: { intent: "DETERMINISTIC_COMMAND", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T0",
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
      capabilities: ["text", "stream"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let workspaceRoot: string;
let previousWorkspaceRoot: string | undefined;
let now: number;
let telemetryEvents: Array<
  Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
>;

function runtime(): InProcessToolRuntime {
  return new InProcessToolRuntime(tools, {
    db,
    now: () => now,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-create-file-"));
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
  now = 1_000;
  telemetryEvents = [];
});

afterEach(() => {
  db.close();
  rmSync(workspaceRoot, { recursive: true, force: true });
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
});

async function requestCreate(
  executionId: string,
  path: string,
  content = "hello",
) {
  const result = await runtime().runTool({
    toolId: "fs.create_file",
    input: { path, content },
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  if (result.status === "AWAITING_APPROVAL") {
    ensurePendingToolApproval({
      db,
      executionId,
      sessionId: "session-1",
      toolId: "fs.create_file",
      toolName: "Create File",
      scopeHash: `create:${path}`,
      requiredSafetyTag: "CONFIRM_ONCE",
      safetyTag: "ALLOW",
      toolInput: { path, content },
      now,
    });
  }
  return result;
}

describe("fs.create_file", () => {
  it("requires approval and does not write before approval", async () => {
    await expect(
      requestCreate("exec-create", "new.txt"),
    ).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        toolId: "fs.create_file",
        scopeHash: "create:new.txt",
      },
    });

    expect(existsSync(join(workspaceRoot, "new.txt"))).toBe(false);
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-create",
      tool_id: "fs.create_file",
      status: "AWAITING_APPROVAL",
    });
  });

  it("approve once creates the file and rollback record", async () => {
    await requestCreate("exec-create", "new.txt", "created");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-create",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          telemetryEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        result: { status: "COMPLETED", message: "File created." },
      },
    });

    expect(readFileSync(join(workspaceRoot, "new.txt"), "utf8")).toBe(
      "created",
    );
    expect(listRollbacks(db)).toMatchObject([
      {
        execution_id: "exec-create",
        session_id: "session-1",
        kind: "fs_unlink_created",
        payload_json: JSON.stringify({ path: "new.txt" }),
      },
    ]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
      "tool_approved",
      "tool_executed",
      "tool_completed",
    ]);

    rmSync(join(workspaceRoot, "new.txt"));
    await expect(
      requestCreate("exec-create-replay", "new.txt", "again"),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "approval_replayed" },
    });
    expect(existsSync(join(workspaceRoot, "new.txt"))).toBe(false);
  });

  it("approve session works for the same session tool and scope", async () => {
    await requestCreate("exec-create", "session.txt", "first");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-create",
      decision: "APPROVED_SESSION",
      now,
      sessionTtlMs: 10_000,
    });
    rmSync(join(workspaceRoot, "session.txt"));

    await expect(
      requestCreate("exec-create-2", "session.txt", "second"),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
    });
    expect(readFileSync(join(workspaceRoot, "session.txt"), "utf8")).toBe(
      "second",
    );
  });

  it("denial does not create the file", async () => {
    await requestCreate("exec-create", "denied.txt");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-create",
      decision: "DENIED",
      now,
    });

    expect(existsSync(join(workspaceRoot, "denied.txt"))).toBe(false);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("refuses existing files after approval", async () => {
    writeFileSync(join(workspaceRoot, "exists.txt"), "old");
    await requestCreate("exec-create", "exists.txt", "new");
    now = 1_100;

    const result = await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-create",
      decision: "APPROVED_ONCE",
      now,
    });

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "file_exists" },
    });
    expect(readFileSync(join(workspaceRoot, "exists.txt"), "utf8")).toBe("old");
  });

  it("denies path traversal and protected paths after approval", async () => {
    await requestCreate("exec-traversal", "../escape.txt");
    await requestCreate("exec-protected", ".env.local");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-traversal",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "path_escape" },
        },
      },
    });

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-protected",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "protected_path" },
        },
      },
    });
    expect(existsSync(join(workspaceRoot, ".env.local"))).toBe(false);
  });

  it("does not register other write/delete/rename/terminal tools", () => {
    expect(
      tools
        .list()
        .filter((tool) => tool.reversibilityClass === "REVERSIBLE_WRITE")
        .map((tool) => tool.id),
    ).toEqual(["fs.create_file"]);
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining([
        "fs.overwrite_file",
        "fs.append_file",
        "fs.rename",
        "fs.delete",
        "terminal.run",
      ]),
    );
  });
});
