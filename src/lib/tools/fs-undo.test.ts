import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
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
import {
  listRollbacks,
  recordRollback,
  type RollbackKind,
} from "../db/rollbacks";
import { applyMigrations } from "../db/schema";
import { listToolCalls } from "../db/tool-calls";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { InProcessToolRuntime, tools } from ".";
import { ROLLBACK_TTL_MS } from "./fs-undo";

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
let telemetryEvents: Array<
  Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
>;

function runtime(): InProcessToolRuntime {
  return new InProcessToolRuntime(tools, {
    db,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-undo-"));
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
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
  content = "new",
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
    });
  }
  return result;
}

async function requestWrite(
  executionId: string,
  path: string,
  content = "updated",
) {
  const result = await runtime().runTool({
    toolId: "fs.write_file",
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
      toolId: "fs.write_file",
      toolName: "Write File",
      scopeHash: `write:${path}`,
      requiredSafetyTag: "CONFIRM_ONCE",
      safetyTag: "ALLOW",
      toolInput: { path, content },
    });
  }
  return result;
}

async function approve(executionId: string) {
  return resumeApproval({
    db,
    runtime: runtime(),
    executionId,
    decision: "APPROVED_ONCE",
  });
}

function addRollback(input: {
  id?: string;
  sessionId?: string;
  kind: RollbackKind;
  payload: unknown;
  createdAt?: number;
  appliedAt?: number | null;
}) {
  recordRollback(db, {
    id: input.id ?? "rollback-1",
    execution_id: "original-exec",
    session_id: input.sessionId ?? "session-1",
    kind: input.kind,
    payload_json: JSON.stringify(input.payload),
    created_at: input.createdAt ?? Date.now(),
    applied_at: input.appliedAt,
  });
}

describe("fs.undo", () => {
  it("undo after fs.create_file removes the created file", async () => {
    await requestCreate("exec-create", "created.txt", "created");
    await approve("exec-create");

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      message: "Rollback applied.",
      data: { kind: "fs_unlink_created", path: "created.txt" },
    });

    expect(existsSync(join(workspaceRoot, "created.txt"))).toBe(false);
    expect(listRollbacks(db)[0].applied_at).not.toBeNull();
  });

  it("undo for fs_rmdir_empty removes an empty directory", async () => {
    mkdirSync(join(workspaceRoot, "created-dir"));
    addRollback({
      kind: "fs_rmdir_empty",
      payload: { path: "created-dir" },
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: { kind: "fs_rmdir_empty", path: "created-dir" },
    });

    expect(existsSync(join(workspaceRoot, "created-dir"))).toBe(false);
    expect(listRollbacks(db)[0].applied_at).not.toBeNull();
  });

  it("fs_rmdir_empty refuses non-empty directories", async () => {
    mkdirSync(join(workspaceRoot, "created-dir"));
    writeFileSync(join(workspaceRoot, "created-dir", "child.txt"), "child");
    addRollback({
      kind: "fs_rmdir_empty",
      payload: { path: "created-dir" },
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "directory_not_empty" },
    });

    expect(existsSync(join(workspaceRoot, "created-dir", "child.txt"))).toBe(
      true,
    );
    expect(listRollbacks(db)[0].applied_at).toBeNull();
  });

  it("undo after fs.write_file restores previous content", async () => {
    writeFileSync(join(workspaceRoot, "target.txt"), "original");
    await requestWrite("exec-write", "target.txt", "updated");
    await approve("exec-write");

    await runtime().runTool({
      toolId: "fs.undo",
      input: {},
      sessionId: "session-1",
      executionId: "exec-undo",
      decision: allowDecision,
    });

    expect(readFileSync(join(workspaceRoot, "target.txt"), "utf8")).toBe(
      "original",
    );
  });

  it("large backupPath restore works", async () => {
    const previous = "a".repeat(64 * 1024 + 1);
    writeFileSync(join(workspaceRoot, "large.txt"), previous);
    await requestWrite("exec-large", "large.txt", "small");
    await approve("exec-large");

    await runtime().runTool({
      toolId: "fs.undo",
      input: {},
      sessionId: "session-1",
      executionId: "exec-undo",
      decision: allowDecision,
    });

    expect(readFileSync(join(workspaceRoot, "large.txt"), "utf8")).toBe(
      previous,
    );
  });

  it("expired rollback is refused", async () => {
    writeFileSync(join(workspaceRoot, "old.txt"), "new");
    addRollback({
      kind: "fs_restore_content",
      payload: {
        path: "old.txt",
        previousContent: "old",
        previousLength: 3,
      },
      createdAt: Date.now() - ROLLBACK_TTL_MS - 1_000,
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "rollback_expired" },
    });
    expect(readFileSync(join(workspaceRoot, "old.txt"), "utf8")).toBe("new");
  });

  it("already applied rollback is refused", async () => {
    addRollback({
      kind: "fs_unlink_created",
      payload: { path: "created.txt" },
      appliedAt: Date.now(),
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "rollback_already_applied" },
    });
  });

  it("unsafe and protected rollback paths are refused", async () => {
    addRollback({
      id: "rollback-unsafe",
      kind: "fs_unlink_created",
      payload: { path: "../escape.txt" },
      createdAt: Date.now() - 1_000,
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo-unsafe",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });

    db.prepare("DELETE FROM rollbacks").run();
    addRollback({
      id: "rollback-protected",
      kind: "fs_unlink_created",
      payload: { path: ".env.local" },
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo-protected",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "protected_path" },
    });
  });

  it("current session cannot undo another session rollback", async () => {
    writeFileSync(join(workspaceRoot, "other.txt"), "other");
    addRollback({
      sessionId: "session-2",
      kind: "fs_unlink_created",
      payload: { path: "other.txt" },
    });

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "rollback_missing" },
    });
    expect(existsSync(join(workspaceRoot, "other.txt"))).toBe(true);
  });

  it("emits rollback telemetry and audits fs.undo", async () => {
    await requestCreate("exec-create", "created.txt", "created");
    await approve("exec-create");

    await runtime().runTool({
      toolId: "fs.undo",
      input: {},
      sessionId: "session-1",
      executionId: "exec-undo",
      decision: allowDecision,
    });

    expect(
      telemetryEvents
        .filter((event) =>
          ["tool_executed", "tool_completed", "tool_rolled_back"].includes(
            event.event_type,
          ),
        )
        .slice(-3)
        .map((event) => ({
          type: event.event_type,
          execution: event.execution_id,
          tool: event.tool_name,
        })),
    ).toEqual([
      { type: "tool_executed", execution: "exec-undo", tool: "fs.undo" },
      { type: "tool_completed", execution: "exec-undo", tool: "fs.undo" },
      { type: "tool_rolled_back", execution: "exec-undo", tool: "fs.undo" },
    ]);
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-undo",
      tool_id: "fs.undo",
      status: "COMPLETED",
    });
  });

  it("does not register rename/delete/terminal tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.rename", "fs.delete", "terminal.run"]),
    );
  });
});
