import Database from "better-sqlite3";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
let outsideRoot: string;
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
  outsideRoot = mkdtempSync(join(tmpdir(), "jarvis-write-outside-"));
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
  now = 1_000;
  telemetryEvents = [];
});

afterEach(() => {
  db.close();
  rmSync(workspaceRoot, { recursive: true, force: true });
  rmSync(outsideRoot, { recursive: true, force: true });
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
      now,
    });
  }
  return result;
}

async function requestAppend(
  executionId: string,
  path: string,
  content = " appended",
) {
  const result = await runtime().runTool({
    toolId: "fs.append_file",
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
      toolId: "fs.append_file",
      toolName: "Append File",
      scopeHash: `append:${path}`,
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
    ).toEqual(["fs.create_file", "fs.write_file", "fs.append_file"]);
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining([
        "fs.overwrite_file",
        "fs.rename",
        "fs.delete",
        "terminal.run",
      ]),
    );
  });
});

describe("fs.append_file", () => {
  it("requires approval and does not append before approval", async () => {
    writeFileSync(join(workspaceRoot, "append.txt"), "original");

    await expect(
      requestAppend("exec-append", "append.txt", " plus"),
    ).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        toolId: "fs.append_file",
        scopeHash: "append:append.txt",
      },
    });

    expect(readFileSync(join(workspaceRoot, "append.txt"), "utf8")).toBe(
      "original",
    );
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-append",
      tool_id: "fs.append_file",
      status: "AWAITING_APPROVAL",
    });
  });

  it("approve once appends content and records rollback length", async () => {
    writeFileSync(join(workspaceRoot, "append.txt"), "original");
    await requestAppend("exec-append", "append.txt", " plus");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-append",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          telemetryEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        result: { status: "COMPLETED", message: "File appended." },
      },
    });

    expect(readFileSync(join(workspaceRoot, "append.txt"), "utf8")).toBe(
      "original plus",
    );
    const rollback = listRollbacks(db)[0];
    expect(rollback).toMatchObject({
      execution_id: "exec-append",
      session_id: "session-1",
      kind: "fs_truncate_to_length",
    });
    expect(JSON.parse(rollback.payload_json)).toEqual({
      path: "append.txt",
      previousLength: 8,
    });
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
      "tool_approved",
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("denial preserves original content", async () => {
    writeFileSync(join(workspaceRoot, "denied-append.txt"), "original");
    await requestAppend("exec-append", "denied-append.txt", " plus");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-append",
      decision: "DENIED",
      now,
    });

    expect(readFileSync(join(workspaceRoot, "denied-append.txt"), "utf8")).toBe(
      "original",
    );
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("approve session works for the same session tool and scope", async () => {
    writeFileSync(join(workspaceRoot, "session-append.txt"), "one");
    await requestAppend("exec-append", "session-append.txt", " two");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-append",
      decision: "APPROVED_SESSION",
      now,
      sessionTtlMs: 10_000,
    });

    await expect(
      requestAppend("exec-append-2", "session-append.txt", " three"),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
    });
    expect(
      readFileSync(join(workspaceRoot, "session-append.txt"), "utf8"),
    ).toBe("one two three");
  });

  it("rollback undo restores previous length", async () => {
    writeFileSync(join(workspaceRoot, "undo-append.txt"), "original");
    await requestAppend("exec-append", "undo-append.txt", " plus");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-append",
      decision: "APPROVED_ONCE",
      now,
    });

    await runtime().runTool({
      toolId: "fs.undo",
      input: {},
      sessionId: "session-1",
      executionId: "exec-undo",
      decision: allowDecision,
    });

    expect(readFileSync(join(workspaceRoot, "undo-append.txt"), "utf8")).toBe(
      "original",
    );
    expect(listRollbacks(db)[0].applied_at).not.toBeNull();
  });

  it("refuses missing and binary targets after approval", async () => {
    writeFileSync(
      join(workspaceRoot, "append-binary.bin"),
      Buffer.from([0, 1]),
    );
    await requestAppend("exec-missing", "missing-append.txt", " plus");
    await requestAppend("exec-binary", "append-binary.bin", " plus");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-missing",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "not_found" },
        },
      },
    });

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-binary",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "binary_file" },
        },
      },
    });
  });

  it("denies path traversal, protected paths, and symlink escapes", async () => {
    writeFileSync(join(outsideRoot, "outside.txt"), "outside");
    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "append-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await requestAppend("exec-traversal", "../escape.txt", " plus");
    await requestAppend("exec-protected", ".env.local", " plus");
    await requestAppend("exec-symlink", "append-escape/outside.txt", " plus");
    now = 1_100;

    for (const [executionId, reason] of [
      ["exec-traversal", "path_escape"],
      ["exec-protected", "protected_path"],
      ["exec-symlink", "path_escape"],
    ] as const) {
      await expect(
        resumeApproval({
          db,
          runtime: runtime(),
          executionId,
          decision: "APPROVED_ONCE",
          now,
        }),
      ).resolves.toMatchObject({
        body: {
          result: {
            ok: false,
            status: "DENIED",
            data: { reason },
          },
        },
      });
    }
    expect(readFileSync(join(outsideRoot, "outside.txt"), "utf8")).toBe(
      "outside",
    );
  });

  it("does not register rename/delete/terminal tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.rename", "fs.delete", "terminal.run"]),
    );
  });
});

describe("fs.write_file", () => {
  it("requires approval and does not write before approval", async () => {
    writeFileSync(join(workspaceRoot, "target.txt"), "original");

    await expect(
      requestWrite("exec-write", "target.txt", "updated"),
    ).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        toolId: "fs.write_file",
        scopeHash: "write:target.txt",
      },
    });

    expect(readFileSync(join(workspaceRoot, "target.txt"), "utf8")).toBe(
      "original",
    );
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-write",
      tool_id: "fs.write_file",
      status: "AWAITING_APPROVAL",
    });
  });

  it("approve once overwrites the file and creates inline rollback content", async () => {
    writeFileSync(join(workspaceRoot, "target.txt"), "original");
    await requestWrite("exec-write", "target.txt", "updated");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-write",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          telemetryEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        result: { status: "COMPLETED", message: "File overwritten." },
      },
    });

    expect(readFileSync(join(workspaceRoot, "target.txt"), "utf8")).toBe(
      "updated",
    );
    const rollback = listRollbacks(db)[0];
    expect(rollback).toMatchObject({
      execution_id: "exec-write",
      session_id: "session-1",
      kind: "fs_restore_content",
    });
    expect(JSON.parse(rollback.payload_json)).toEqual({
      path: "target.txt",
      previousContent: "original",
      previousLength: 8,
    });
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
      "tool_approved",
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("approve session works for the same session tool and scope", async () => {
    writeFileSync(join(workspaceRoot, "session.txt"), "one");
    await requestWrite("exec-write", "session.txt", "two");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-write",
      decision: "APPROVED_SESSION",
      now,
      sessionTtlMs: 10_000,
    });

    await expect(
      requestWrite("exec-write-2", "session.txt", "three"),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
    });
    expect(readFileSync(join(workspaceRoot, "session.txt"), "utf8")).toBe(
      "three",
    );
  });

  it("denial does not modify the file", async () => {
    writeFileSync(join(workspaceRoot, "denied.txt"), "original");
    await requestWrite("exec-write", "denied.txt", "updated");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-write",
      decision: "DENIED",
      now,
    });

    expect(readFileSync(join(workspaceRoot, "denied.txt"), "utf8")).toBe(
      "original",
    );
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("large previous content uses backupPath rollback payload", async () => {
    const previous = "a".repeat(64 * 1024 + 1);
    writeFileSync(join(workspaceRoot, "large.txt"), previous);
    await requestWrite("exec-large", "large.txt", "small");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-large",
      decision: "APPROVED_ONCE",
      now,
    });

    const payload = JSON.parse(listRollbacks(db)[0].payload_json) as {
      path: string;
      backupPath: string;
      previousContent?: string;
      previousLength: number;
    };
    expect(payload).toEqual({
      path: "large.txt",
      backupPath: ".jarvis-trash/backups/exec-large",
      previousLength: previous.length,
    });
    expect(payload.previousContent).toBeUndefined();
    expect(readFileSync(join(workspaceRoot, payload.backupPath), "utf8")).toBe(
      previous,
    );
  });

  it("refuses missing and binary targets after approval", async () => {
    writeFileSync(join(workspaceRoot, "binary.bin"), Buffer.from([0, 1, 2]));
    await requestWrite("exec-missing", "missing.txt", "updated");
    await requestWrite("exec-binary", "binary.bin", "updated");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-missing",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "not_found" },
        },
      },
    });

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-binary",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "binary_file" },
        },
      },
    });
  });

  it("denies path traversal, protected paths, and symlink escapes", async () => {
    writeFileSync(join(outsideRoot, "outside.txt"), "outside");
    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await requestWrite("exec-traversal", "../escape.txt", "updated");
    await requestWrite("exec-protected", ".env.local", "updated");
    await requestWrite("exec-symlink", "escape/outside.txt", "updated");
    now = 1_100;

    for (const [executionId, reason] of [
      ["exec-traversal", "path_escape"],
      ["exec-protected", "protected_path"],
      ["exec-symlink", "path_escape"],
    ] as const) {
      await expect(
        resumeApproval({
          db,
          runtime: runtime(),
          executionId,
          decision: "APPROVED_ONCE",
          now,
        }),
      ).resolves.toMatchObject({
        body: {
          result: {
            ok: false,
            status: "DENIED",
            data: { reason },
          },
        },
      });
    }
    expect(readFileSync(join(outsideRoot, "outside.txt"), "utf8")).toBe(
      "outside",
    );
  });

  it("does not register rename/delete/terminal tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.rename", "fs.delete", "terminal.run"]),
    );
  });
});
