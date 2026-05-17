import Database from "better-sqlite3";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
let telemetryEvents: Array<
  Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
>;

function runtime(): InProcessToolRuntime {
  return new InProcessToolRuntime(tools, {
    db,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
    newId() {
      return "exec-fs";
    },
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  telemetryEvents = [];
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-workspace-"));
  outsideRoot = mkdtempSync(join(tmpdir(), "jarvis-outside-"));
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
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

describe("read-only filesystem tools", () => {
  it("lists, reads, and stats paths inside the workspace", async () => {
    mkdirSync(join(workspaceRoot, "notes"));
    writeFileSync(join(workspaceRoot, "notes", "hello.txt"), "hello Jarvis");

    await expect(
      runtime().runTool({
        toolId: "fs.list_dir",
        input: { path: "notes" },
        sessionId: "session-1",
        executionId: "exec-list",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: {
        path: "notes",
        entries: [{ name: "hello.txt", type: "file" }],
      },
    });

    await expect(
      runtime().runTool({
        toolId: "fs.read_file",
        input: { path: "notes/hello.txt" },
        sessionId: "session-1",
        executionId: "exec-read",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: { content: "hello Jarvis" },
    });

    await expect(
      runtime().runTool({
        toolId: "fs.stat",
        input: { path: "notes/hello.txt" },
        sessionId: "session-1",
        executionId: "exec-stat",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "COMPLETED",
      data: { type: "file", size: 12 },
    });
  });

  it("denies path traversal outside the workspace", async () => {
    writeFileSync(join(outsideRoot, "secret.txt"), "outside");

    await expect(
      runtime().runTool({
        toolId: "fs.read_file",
        input: { path: "../secret.txt" },
        sessionId: "session-1",
        executionId: "exec-traversal",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("denies symlink escapes outside the workspace", async () => {
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

    await expect(
      runtime().runTool({
        toolId: "fs.read_file",
        input: { path: "escape/outside.txt" },
        sessionId: "session-1",
        executionId: "exec-symlink",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "path_escape" },
    });
  });

  it("denies protected files", async () => {
    writeFileSync(join(workspaceRoot, ".env.local"), "OPENAI_API_KEY=x");

    await expect(
      runtime().runTool({
        toolId: "fs.read_file",
        input: { path: ".env.local" },
        sessionId: "session-1",
        executionId: "exec-protected",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "protected_path" },
    });
  });

  it("denies oversized text files", async () => {
    writeFileSync(
      join(workspaceRoot, "large.txt"),
      "a".repeat(1024 * 1024 + 1),
    );

    await expect(
      runtime().runTool({
        toolId: "fs.read_file",
        input: { path: "large.txt" },
        sessionId: "session-1",
        executionId: "exec-large",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "file_too_large" },
    });
  });

  it("denies binary files", async () => {
    writeFileSync(join(workspaceRoot, "binary.bin"), Buffer.from([0, 1, 2, 3]));

    await expect(
      runtime().runTool({
        toolId: "fs.read_file",
        input: { path: "binary.bin" },
        sessionId: "session-1",
        executionId: "exec-binary",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "binary_file" },
    });
  });

  it("records audit rows and telemetry for filesystem tool execution", async () => {
    writeFileSync(join(workspaceRoot, "audit.txt"), "audit");

    await runtime().runTool({
      toolId: "fs.read_file",
      input: { path: "audit.txt" },
      sessionId: "session-1",
      executionId: "exec-audit",
      decision: allowDecision,
    });

    expect(listToolCalls(db)).toMatchObject([
      {
        execution_id: "exec-audit",
        tool_id: "fs.read_file",
        status: "COMPLETED",
      },
    ]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("preserves runner abort handling for read-only tools", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runtime().runTool({
        toolId: "fs.stat",
        input: { path: "." },
        sessionId: "session-1",
        executionId: "exec-abort",
        decision: allowDecision,
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "CANCELLED",
      data: { reason: "aborted" },
    });
  });
});
