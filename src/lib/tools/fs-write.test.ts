import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensurePendingToolApproval,
  resumeApproval as resumeToolApproval,
} from "../chat/tool-approvals";
import { listRollbacks } from "../db/rollbacks";
import { applyMigrations } from "../db/schema";
import { listToolCalls } from "../db/tool-calls";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { InProcessToolRuntime, tools } from ".";
import { executionPathSegment } from "./safe-filenames";

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
let approvalTokens: Map<string, string>;

const hostileExecutionIds = [
  "../../escape",
  "..\\..\\escape",
  "abc/../../escape",
  "abc\\..\\escape",
  "id-with-null-byte\0tail",
  "C:\\Windows\\System32",
  "/etc/passwd",
  "x".repeat(2_000),
  "",
] as const;

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
  approvalTokens = new Map();
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
    const pending = ensurePendingToolApproval({
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
    approvalTokens.set(executionId, pending.approvalToken);
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
    const pending = ensurePendingToolApproval({
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
    approvalTokens.set(executionId, pending.approvalToken);
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
    const pending = ensurePendingToolApproval({
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
    approvalTokens.set(executionId, pending.approvalToken);
  }
  return result;
}

async function requestMkdir(executionId: string, path: string) {
  const result = await runtime().runTool({
    toolId: "fs.mkdir",
    input: { path },
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  if (result.status === "AWAITING_APPROVAL") {
    const pending = ensurePendingToolApproval({
      db,
      executionId,
      sessionId: "session-1",
      toolId: "fs.mkdir",
      toolName: "Make Directory",
      scopeHash: `mkdir:${path}`,
      requiredSafetyTag: "CONFIRM_ONCE",
      safetyTag: "ALLOW",
      toolInput: { path },
      now,
    });
    approvalTokens.set(executionId, pending.approvalToken);
  }
  return result;
}

async function requestRename(
  executionId: string,
  fromPath: string,
  toPath: string,
) {
  const result = await runtime().runTool({
    toolId: "fs.rename",
    input: { fromPath, toPath },
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  if (result.status === "AWAITING_APPROVAL") {
    const pending = ensurePendingToolApproval({
      db,
      executionId,
      sessionId: "session-1",
      toolId: "fs.rename",
      toolName: "Rename Path",
      scopeHash: `rename:${fromPath}->${toPath}`,
      requiredSafetyTag: "CONFIRM_ONCE",
      safetyTag: "ALLOW",
      toolInput: { fromPath, toPath },
      now,
    });
    approvalTokens.set(executionId, pending.approvalToken);
  }
  return result;
}

async function requestDelete(executionId: string, path: string) {
  const result = await runtime().runTool({
    toolId: "fs.delete_file",
    input: { path },
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  if (result.status === "AWAITING_APPROVAL") {
    const pending = ensurePendingToolApproval({
      db,
      executionId,
      sessionId: "session-1",
      toolId: "fs.delete_file",
      toolName: "Delete File",
      scopeHash: `delete:${path}`,
      requiredSafetyTag: "CONFIRM_ALWAYS",
      safetyTag: "ALLOW",
      toolInput: { path },
      now,
    });
    approvalTokens.set(executionId, pending.approvalToken);
  }
  return result;
}

function approvalTokenFor(executionId: string): string {
  const token = approvalTokens.get(executionId);
  if (!token) throw new Error(`Missing approval token for ${executionId}`);
  return token;
}

function resumeApproval(
  input: Parameters<typeof resumeToolApproval>[0],
): ReturnType<typeof resumeToolApproval> {
  return resumeToolApproval({
    ...input,
    approvalToken: input.approvalToken ?? approvalTokenFor(input.executionId),
  });
}

async function withRollbackInsertFailure<T>(fn: () => Promise<T>): Promise<T> {
  const originalPrepare = db.prepare.bind(db);
  const prepareSpy = vi.spyOn(db, "prepare");
  prepareSpy.mockImplementation(((source: string) => {
    if (source.includes("INSERT INTO rollbacks")) {
      throw new Error("injected rollback insert failure");
    }
    return originalPrepare(source);
  }) as Database.Database["prepare"]);
  try {
    return await fn();
  } finally {
    prepareSpy.mockRestore();
  }
}

function expectToolCallLinkedToRollback(executionId: string) {
  const rollback = listRollbacks(db).find(
    (row) => row.execution_id === executionId,
  );
  const toolCall = listToolCalls(db).find(
    (row) => row.execution_id === executionId,
  );
  expect(rollback?.id).toBeTruthy();
  expect(toolCall?.rollback_id).toBe(rollback?.id);
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

  it("does not register other write/directory-delete/terminal tools", () => {
    expect(
      tools
        .list()
        .filter((tool) => tool.reversibilityClass === "REVERSIBLE_WRITE")
        .map((tool) => tool.id),
    ).toEqual([
      "fs.create_file",
      "fs.write_file",
      "fs.append_file",
      "fs.mkdir",
      "fs.rename",
      "fs.delete_file",
    ]);
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining([
        "fs.overwrite_file",
        "fs.delete",
        "terminal.run",
      ]),
    );
  });
});

describe("write tool execution id path hardening", () => {
  it.each(hostileExecutionIds)(
    "fs.create_file temp path cannot escape for hostile execution id %#",
    async (executionId) => {
      await requestCreate(executionId, "hostile-create.txt", "created");
      now = 1_100;

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
          ok: true,
          result: { status: "COMPLETED" },
        },
      });

      expect(
        readFileSync(join(workspaceRoot, "hostile-create.txt"), "utf8"),
      ).toBe("created");
    },
  );

  it.each(hostileExecutionIds)(
    "fs.write_file temp path cannot escape for hostile execution id %#",
    async (executionId) => {
      writeFileSync(join(workspaceRoot, "hostile-write.txt"), "old");
      await requestWrite(executionId, "hostile-write.txt", "new");
      now = 1_100;

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
          ok: true,
          result: { status: "COMPLETED" },
        },
      });

      expect(
        readFileSync(join(workspaceRoot, "hostile-write.txt"), "utf8"),
      ).toBe("new");
    },
  );

  it.each(hostileExecutionIds)(
    "fs.write_file large backup stays in backups for hostile execution id %#",
    async (executionId) => {
      const previous = "a".repeat(64 * 1024 + 1);
      writeFileSync(join(workspaceRoot, "hostile-large.txt"), previous);
      await requestWrite(executionId, "hostile-large.txt", "new");
      now = 1_100;

      await resumeApproval({
        db,
        runtime: runtime(),
        executionId,
        decision: "APPROVED_ONCE",
        now,
      });

      const payload = JSON.parse(listRollbacks(db)[0].payload_json) as {
        backupPath: string;
      };
      expect(payload.backupPath).toBe(
        `.jarvis-trash/backups/${executionPathSegment(executionId)}`,
      );
      expect(payload.backupPath).toMatch(
        /^\.jarvis-trash\/backups\/exec_[A-Za-z0-9_-]+$/,
      );
      expect(
        readFileSync(join(workspaceRoot, payload.backupPath), "utf8"),
      ).toBe(previous);
    },
  );

  it.each(hostileExecutionIds)(
    "fs.append_file rollback path ignores hostile execution id %#",
    async (executionId) => {
      writeFileSync(join(workspaceRoot, "hostile-append.txt"), "old");
      await requestAppend(executionId, "hostile-append.txt", " new");
      now = 1_100;

      await resumeApproval({
        db,
        runtime: runtime(),
        executionId,
        decision: "APPROVED_ONCE",
        now,
      });

      expect(
        readFileSync(join(workspaceRoot, "hostile-append.txt"), "utf8"),
      ).toBe("old new");
      expect(JSON.parse(listRollbacks(db)[0].payload_json)).toEqual({
        path: "hostile-append.txt",
        previousLength: 3,
      });
    },
  );
});

describe("write rollback hardening", () => {
  it("links every write-capable tool call to its rollback row", async () => {
    await requestCreate("exec-create-link", "created-link.txt", "created");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-create-link",
      decision: "APPROVED_ONCE",
      now,
    });

    writeFileSync(join(workspaceRoot, "write-link.txt"), "old");
    await requestWrite("exec-write-link", "write-link.txt", "new");
    now += 100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-write-link",
      decision: "APPROVED_ONCE",
      now,
    });

    writeFileSync(join(workspaceRoot, "append-link.txt"), "old");
    await requestAppend("exec-append-link", "append-link.txt", " new");
    now += 100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-append-link",
      decision: "APPROVED_ONCE",
      now,
    });

    await requestMkdir("exec-mkdir-link", "mkdir-link");
    now += 100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-mkdir-link",
      decision: "APPROVED_ONCE",
      now,
    });

    writeFileSync(join(workspaceRoot, "rename-link-old.txt"), "old");
    await requestRename(
      "exec-rename-link",
      "rename-link-old.txt",
      "rename-link-new.txt",
    );
    now += 100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-rename-link",
      decision: "APPROVED_ONCE",
      now,
    });

    for (const executionId of [
      "exec-create-link",
      "exec-write-link",
      "exec-append-link",
      "exec-mkdir-link",
      "exec-rename-link",
    ]) {
      expectToolCallLinkedToRollback(executionId);
    }

    writeFileSync(join(workspaceRoot, "delete-link.txt"), "delete me");
    await requestDelete("exec-delete-link", "delete-link.txt");
    now += 100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-delete-link",
      decision: "APPROVED_ONCE",
      now,
    });
    expectToolCallLinkedToRollback("exec-delete-link");
  });

  it("reverts fs.create_file when rollback persistence fails", async () => {
    await requestCreate("exec-create-fail", "create-fail.txt", "created");
    now = 1_100;

    const result = await withRollbackInsertFailure(() =>
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-create-fail",
        decision: "APPROVED_ONCE",
        now,
      }),
    );

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "ERROR",
      data: { reason: "rollback_persistence_failed" },
    });
    expect(existsSync(join(workspaceRoot, "create-fail.txt"))).toBe(false);
    expect(listRollbacks(db)).toHaveLength(0);
  });

  it("reverts fs.write_file when rollback persistence fails", async () => {
    writeFileSync(join(workspaceRoot, "write-fail.txt"), "original");
    await requestWrite("exec-write-fail", "write-fail.txt", "updated");
    now = 1_100;

    const result = await withRollbackInsertFailure(() =>
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-write-fail",
        decision: "APPROVED_ONCE",
        now,
      }),
    );

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "ERROR",
      data: { reason: "rollback_persistence_failed" },
    });
    expect(readFileSync(join(workspaceRoot, "write-fail.txt"), "utf8")).toBe(
      "original",
    );
    expect(listRollbacks(db)).toHaveLength(0);
  });

  it("reverts fs.append_file when rollback persistence fails", async () => {
    writeFileSync(join(workspaceRoot, "append-fail.txt"), "original");
    await requestAppend("exec-append-fail", "append-fail.txt", " plus");
    now = 1_100;

    const result = await withRollbackInsertFailure(() =>
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-append-fail",
        decision: "APPROVED_ONCE",
        now,
      }),
    );

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "ERROR",
      data: { reason: "rollback_persistence_failed" },
    });
    expect(readFileSync(join(workspaceRoot, "append-fail.txt"), "utf8")).toBe(
      "original",
    );
    expect(listRollbacks(db)).toHaveLength(0);
  });

  it("reverts fs.mkdir when rollback persistence fails", async () => {
    await requestMkdir("exec-mkdir-fail", "mkdir-fail");
    now = 1_100;

    const result = await withRollbackInsertFailure(() =>
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-mkdir-fail",
        decision: "APPROVED_ONCE",
        now,
      }),
    );

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "ERROR",
      data: { reason: "rollback_persistence_failed" },
    });
    expect(existsSync(join(workspaceRoot, "mkdir-fail"))).toBe(false);
    expect(listRollbacks(db)).toHaveLength(0);
  });

  it("reverts fs.rename when rollback persistence fails", async () => {
    writeFileSync(join(workspaceRoot, "rename-fail-old.txt"), "old");
    await requestRename(
      "exec-rename-fail",
      "rename-fail-old.txt",
      "rename-fail-new.txt",
    );
    now = 1_100;

    const result = await withRollbackInsertFailure(() =>
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-rename-fail",
        decision: "APPROVED_ONCE",
        now,
      }),
    );

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "ERROR",
      data: { reason: "rollback_persistence_failed" },
    });
    expect(
      readFileSync(join(workspaceRoot, "rename-fail-old.txt"), "utf8"),
    ).toBe("old");
    expect(existsSync(join(workspaceRoot, "rename-fail-new.txt"))).toBe(false);
    expect(listRollbacks(db)).toHaveLength(0);
  });

  it("reverts fs.delete_file when rollback persistence fails", async () => {
    writeFileSync(join(workspaceRoot, "delete-fail.txt"), "delete me");
    await requestDelete("exec-delete-fail", "delete-fail.txt");
    now = 1_100;

    const result = await withRollbackInsertFailure(() =>
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-delete-fail",
        decision: "APPROVED_ONCE",
        now,
      }),
    );

    expect(result.body.result).toMatchObject({
      ok: false,
      status: "ERROR",
      data: { reason: "rollback_persistence_failed" },
    });
    expect(readFileSync(join(workspaceRoot, "delete-fail.txt"), "utf8")).toBe(
      "delete me",
    );
    expect(listRollbacks(db)).toHaveLength(0);
  });
});

describe("fs.delete_file", () => {
  it("requires CONFIRM_ALWAYS approval and does not move before approval", async () => {
    writeFileSync(join(workspaceRoot, "delete.txt"), "delete me");

    await expect(
      requestDelete("exec-delete", "delete.txt"),
    ).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        toolId: "fs.delete_file",
        requiredSafetyTag: "CONFIRM_ALWAYS",
        scopeHash: "delete:delete.txt",
      },
    });

    expect(readFileSync(join(workspaceRoot, "delete.txt"), "utf8")).toBe(
      "delete me",
    );
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-delete",
      tool_id: "fs.delete_file",
      status: "AWAITING_APPROVAL",
      required_safety_tag: "CONFIRM_ALWAYS",
    });
  });

  it("approve once moves the file to trash and records rollback linkage", async () => {
    writeFileSync(join(workspaceRoot, "delete.txt"), "delete me");
    await requestDelete("exec-delete", "delete.txt");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-delete",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          telemetryEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        result: { status: "COMPLETED", message: "File moved to trash." },
      },
    });

    expect(existsSync(join(workspaceRoot, "delete.txt"))).toBe(false);
    const rollback = listRollbacks(db)[0];
    const payload = JSON.parse(rollback.payload_json) as {
      originalPath: string;
      trashedPath: string;
    };
    expect(rollback).toMatchObject({
      execution_id: "exec-delete",
      session_id: "session-1",
      kind: "fs_untrash",
    });
    expect(payload.originalPath).toBe("delete.txt");
    expect(payload.trashedPath).toMatch(
      /^\.jarvis-trash\/\d{4}-\d{2}-\d{2}\/exec_[A-Za-z0-9_-]+-delete\.txt$/,
    );
    expect(readFileSync(join(workspaceRoot, payload.trashedPath), "utf8")).toBe(
      "delete me",
    );
    expectToolCallLinkedToRollback("exec-delete");
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
      "tool_approved",
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("denial leaves the file untouched", async () => {
    writeFileSync(join(workspaceRoot, "denied-delete.txt"), "delete me");
    await requestDelete("exec-delete", "denied-delete.txt");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-delete",
      decision: "DENIED",
      now,
    });

    expect(readFileSync(join(workspaceRoot, "denied-delete.txt"), "utf8")).toBe(
      "delete me",
    );
    expect(existsSync(join(workspaceRoot, ".jarvis-trash"))).toBe(false);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("refuses directories, missing files, protected paths, traversal, and symlink escapes", async () => {
    mkdirSync(join(workspaceRoot, "delete-dir"));
    writeFileSync(join(workspaceRoot, ".env.local"), "secret");
    writeFileSync(join(outsideRoot, "outside.txt"), "outside");
    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "delete-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await requestDelete("exec-dir", "delete-dir");
    await requestDelete("exec-missing", "missing.txt");
    await requestDelete("exec-protected", ".env.local");
    await requestDelete("exec-traversal", "../outside.txt");
    await requestDelete("exec-symlink", "delete-escape/outside.txt");
    now = 1_100;

    for (const [executionId, reason] of [
      ["exec-dir", "not_file"],
      ["exec-missing", "not_found"],
      ["exec-protected", "protected_path"],
      ["exec-traversal", "path_escape"],
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

    expect(readFileSync(join(workspaceRoot, ".env.local"), "utf8")).toBe(
      "secret",
    );
    expect(readFileSync(join(outsideRoot, "outside.txt"), "utf8")).toBe(
      "outside",
    );
  });

  it("APPROVED_SESSION is refused for delete", async () => {
    writeFileSync(join(workspaceRoot, "session-delete.txt"), "delete me");
    await requestDelete("exec-delete", "session-delete.txt");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-delete",
        decision: "APPROVED_SESSION",
        now,
      }),
    ).resolves.toMatchObject({
      httpStatus: 409,
      body: {
        ok: false,
        reason: "approval_session_not_allowed",
      },
    });

    expect(
      readFileSync(join(workspaceRoot, "session-delete.txt"), "utf8"),
    ).toBe("delete me");
  });

  it("fs.undo restores the trashed file", async () => {
    writeFileSync(join(workspaceRoot, "undo-delete.txt"), "delete me");
    await requestDelete("exec-delete", "undo-delete.txt");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-delete",
      decision: "APPROVED_ONCE",
      now,
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
      data: { kind: "fs_untrash" },
    });

    expect(readFileSync(join(workspaceRoot, "undo-delete.txt"), "utf8")).toBe(
      "delete me",
    );
    expect(listRollbacks(db)[0].applied_at).not.toBeNull();
  });

  it("fs.undo refuses if original path is occupied or trashed file is missing", async () => {
    writeFileSync(join(workspaceRoot, "occupied-delete.txt"), "delete me");
    await requestDelete("exec-delete-occupied", "occupied-delete.txt");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-delete-occupied",
      decision: "APPROVED_ONCE",
      now,
    });
    writeFileSync(join(workspaceRoot, "occupied-delete.txt"), "occupied");

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo-occupied",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "original_path_occupied" },
    });

    db.prepare("DELETE FROM rollbacks").run();
    writeFileSync(join(workspaceRoot, "missing-trash.txt"), "delete me");
    await requestDelete("exec-delete-missing-trash", "missing-trash.txt");
    now += 100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-delete-missing-trash",
      decision: "APPROVED_ONCE",
      now,
    });
    const payload = JSON.parse(listRollbacks(db)[0].payload_json) as {
      trashedPath: string;
    };
    rmSync(join(workspaceRoot, payload.trashedPath));

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo-missing-trash",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "not_found" },
    });
  });
});

describe("fs.rename", () => {
  it("requires approval and does not rename before approval", async () => {
    writeFileSync(join(workspaceRoot, "old.txt"), "old");

    await expect(
      requestRename("exec-rename", "old.txt", "new.txt"),
    ).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        toolId: "fs.rename",
        scopeHash: "rename:old.txt->new.txt",
      },
    });

    expect(readFileSync(join(workspaceRoot, "old.txt"), "utf8")).toBe("old");
    expect(existsSync(join(workspaceRoot, "new.txt"))).toBe(false);
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-rename",
      tool_id: "fs.rename",
      status: "AWAITING_APPROVAL",
    });
  });

  it("approve once renames a file and creates rollback", async () => {
    writeFileSync(join(workspaceRoot, "old.txt"), "old");
    await requestRename("exec-rename", "old.txt", "new.txt");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-rename",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          telemetryEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        result: { status: "COMPLETED", message: "Path renamed." },
      },
    });

    expect(existsSync(join(workspaceRoot, "old.txt"))).toBe(false);
    expect(readFileSync(join(workspaceRoot, "new.txt"), "utf8")).toBe("old");
    const rollback = listRollbacks(db)[0];
    expect(rollback).toMatchObject({
      execution_id: "exec-rename",
      session_id: "session-1",
      kind: "fs_move_back",
    });
    expect(JSON.parse(rollback.payload_json)).toEqual({
      fromPath: "old.txt",
      toPath: "new.txt",
    });
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
      "tool_approved",
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("denial does not rename a file", async () => {
    writeFileSync(join(workspaceRoot, "denied-old.txt"), "old");
    await requestRename("exec-rename", "denied-old.txt", "denied-new.txt");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-rename",
      decision: "DENIED",
      now,
    });

    expect(readFileSync(join(workspaceRoot, "denied-old.txt"), "utf8")).toBe(
      "old",
    );
    expect(existsSync(join(workspaceRoot, "denied-new.txt"))).toBe(false);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("refuses missing source and existing destination", async () => {
    writeFileSync(join(workspaceRoot, "source.txt"), "source");
    writeFileSync(join(workspaceRoot, "exists.txt"), "exists");
    await requestRename("exec-missing", "missing.txt", "new.txt");
    await requestRename("exec-existing", "source.txt", "exists.txt");
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
        executionId: "exec-existing",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "destination_exists" },
        },
      },
    });
  });

  it("denies traversal for source and destination", async () => {
    writeFileSync(join(workspaceRoot, "source.txt"), "source");
    await requestRename("exec-source-traversal", "../outside.txt", "new.txt");
    await requestRename("exec-dest-traversal", "source.txt", "../outside.txt");
    now = 1_100;

    for (const executionId of [
      "exec-source-traversal",
      "exec-dest-traversal",
    ]) {
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
            data: { reason: "path_escape" },
          },
        },
      });
    }
    expect(readFileSync(join(workspaceRoot, "source.txt"), "utf8")).toBe(
      "source",
    );
  });

  it("denies protected source and destination", async () => {
    writeFileSync(join(workspaceRoot, "source.txt"), "source");
    writeFileSync(join(workspaceRoot, ".env.local"), "SECRET=x");
    await requestRename("exec-source-protected", ".env.local", "new.txt");
    await requestRename("exec-dest-protected", "source.txt", ".env.local");
    now = 1_100;

    for (const executionId of [
      "exec-source-protected",
      "exec-dest-protected",
    ]) {
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
            data: { reason: "protected_path" },
          },
        },
      });
    }
  });

  it("denies symlink escapes for source and destination", async () => {
    writeFileSync(join(outsideRoot, "outside.txt"), "outside");
    writeFileSync(join(workspaceRoot, "source.txt"), "source");
    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "rename-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await requestRename(
      "exec-source-symlink",
      "rename-escape/outside.txt",
      "new.txt",
    );
    await requestRename(
      "exec-dest-symlink",
      "source.txt",
      "rename-escape/new.txt",
    );
    now = 1_100;

    for (const executionId of ["exec-source-symlink", "exec-dest-symlink"]) {
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
            data: { reason: "path_escape" },
          },
        },
      });
    }
    expect(readFileSync(join(outsideRoot, "outside.txt"), "utf8")).toBe(
      "outside",
    );
  });

  it("refuses non-empty directories and allows empty directory rename", async () => {
    mkdirSync(join(workspaceRoot, "non-empty"));
    writeFileSync(join(workspaceRoot, "non-empty", "child.txt"), "child");
    mkdirSync(join(workspaceRoot, "empty"));
    await requestRename("exec-non-empty", "non-empty", "renamed-non-empty");
    await requestRename("exec-empty", "empty", "renamed-empty");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-non-empty",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "directory_not_empty" },
        },
      },
    });

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-empty",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: true,
          status: "COMPLETED",
        },
      },
    });
    expect(existsSync(join(workspaceRoot, "empty"))).toBe(false);
    expect(existsSync(join(workspaceRoot, "renamed-empty"))).toBe(true);
  });

  it("rollback undo moves a renamed file back", async () => {
    writeFileSync(join(workspaceRoot, "undo-old.txt"), "old");
    await requestRename("exec-rename", "undo-old.txt", "undo-new.txt");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-rename",
      decision: "APPROVED_ONCE",
      now,
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
      data: { kind: "fs_move_back", path: "undo-new.txt->undo-old.txt" },
    });
    expect(readFileSync(join(workspaceRoot, "undo-old.txt"), "utf8")).toBe(
      "old",
    );
    expect(existsSync(join(workspaceRoot, "undo-new.txt"))).toBe(false);
    expect(listRollbacks(db)[0].applied_at).not.toBeNull();
  });

  it("rollback refuses occupied source path and missing destination", async () => {
    writeFileSync(join(workspaceRoot, "old.txt"), "old");
    await requestRename("exec-rename", "old.txt", "new.txt");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-rename",
      decision: "APPROVED_ONCE",
      now,
    });
    writeFileSync(join(workspaceRoot, "old.txt"), "occupied");

    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo-occupied",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "source_path_occupied" },
    });
    expect(listRollbacks(db)[0].applied_at).toBeNull();

    rmSync(join(workspaceRoot, "old.txt"));
    rmSync(join(workspaceRoot, "new.txt"));
    await expect(
      runtime().runTool({
        toolId: "fs.undo",
        input: {},
        sessionId: "session-1",
        executionId: "exec-undo-missing",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "not_found" },
    });
  });

  it("does not register delete/terminal/network tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.delete", "terminal.run", "network.fetch"]),
    );
  });
});

describe("fs.mkdir", () => {
  it("requires approval and does not create a directory before approval", async () => {
    await expect(requestMkdir("exec-mkdir", "newdir")).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      data: {
        reason: "approval_required",
        toolId: "fs.mkdir",
        scopeHash: "mkdir:newdir",
      },
    });

    expect(existsSync(join(workspaceRoot, "newdir"))).toBe(false);
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "exec-mkdir",
      tool_id: "fs.mkdir",
      status: "AWAITING_APPROVAL",
    });
  });

  it("approve once creates the directory and rollback record", async () => {
    await requestMkdir("exec-mkdir", "newdir");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-mkdir",
        decision: "APPROVED_ONCE",
        now,
        recordEvent(event) {
          telemetryEvents.push(event);
        },
      }),
    ).resolves.toMatchObject({
      body: {
        ok: true,
        result: { status: "COMPLETED", message: "Directory created." },
      },
    });

    expect(existsSync(join(workspaceRoot, "newdir"))).toBe(true);
    expect(listRollbacks(db)).toMatchObject([
      {
        execution_id: "exec-mkdir",
        session_id: "session-1",
        kind: "fs_rmdir_empty",
        payload_json: JSON.stringify({ path: "newdir" }),
      },
    ]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
      "tool_approved",
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("denial does not create the directory", async () => {
    await requestMkdir("exec-mkdir", "denied-dir");
    now = 1_100;

    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-mkdir",
      decision: "DENIED",
      now,
    });

    expect(existsSync(join(workspaceRoot, "denied-dir"))).toBe(false);
    expect(listToolCalls(db)[0].status).toBe("DENIED");
  });

  it("approve session works for the same session tool and scope", async () => {
    await requestMkdir("exec-mkdir", "session-dir");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-mkdir",
      decision: "APPROVED_SESSION",
      now,
      sessionTtlMs: 10_000,
    });
    rmSync(join(workspaceRoot, "session-dir"), { recursive: true });

    await expect(
      requestMkdir("exec-mkdir-2", "session-dir"),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
    });
    expect(existsSync(join(workspaceRoot, "session-dir"))).toBe(true);
  });

  it("refuses existing paths and missing parents after approval", async () => {
    mkdirSync(join(workspaceRoot, "exists-dir"));
    await requestMkdir("exec-exists", "exists-dir");
    await requestMkdir("exec-missing-parent", "missing-parent/newdir");
    now = 1_100;

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-exists",
        decision: "APPROVED_ONCE",
        now,
      }),
    ).resolves.toMatchObject({
      body: {
        result: {
          ok: false,
          status: "DENIED",
          data: { reason: "path_exists" },
        },
      },
    });

    await expect(
      resumeApproval({
        db,
        runtime: runtime(),
        executionId: "exec-missing-parent",
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
  });

  it("denies path traversal, protected paths, and symlink escapes", async () => {
    try {
      symlinkSync(
        outsideRoot,
        join(workspaceRoot, "mkdir-escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      return;
    }

    await requestMkdir("exec-traversal", "../escape-dir");
    await requestMkdir("exec-protected", ".env.local");
    await requestMkdir("exec-symlink", "mkdir-escape/newdir");
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
    expect(existsSync(join(outsideRoot, "newdir"))).toBe(false);
  });

  it("rollback undo removes the empty directory", async () => {
    await requestMkdir("exec-mkdir", "undo-dir");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-mkdir",
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

    expect(existsSync(join(workspaceRoot, "undo-dir"))).toBe(false);
    expect(listRollbacks(db)[0].applied_at).not.toBeNull();
  });

  it("rollback refuses a non-empty directory", async () => {
    await requestMkdir("exec-mkdir", "non-empty-dir");
    now = 1_100;
    await resumeApproval({
      db,
      runtime: runtime(),
      executionId: "exec-mkdir",
      decision: "APPROVED_ONCE",
      now,
    });
    writeFileSync(join(workspaceRoot, "non-empty-dir", "child.txt"), "child");

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

    expect(existsSync(join(workspaceRoot, "non-empty-dir", "child.txt"))).toBe(
      true,
    );
    expect(listRollbacks(db)[0].applied_at).toBeNull();
  });

  it("does not register delete/terminal tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.delete", "terminal.run"]),
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

  it("does not register delete/terminal tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.delete", "terminal.run"]),
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
      backupPath: `.jarvis-trash/backups/${executionPathSegment("exec-large")}`,
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

  it("does not register delete/terminal tools", () => {
    expect(tools.list().map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(["fs.delete", "terminal.run"]),
    );
  });
});
