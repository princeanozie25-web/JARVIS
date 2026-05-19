import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRuntimeCommandCall,
  getRuntimeCommandCall,
  listRuntimeCommandCalls,
} from "../db/runtime-command-calls";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  RuntimeCommandExecutor,
  RuntimeCommandRegistry,
  RuntimeExecutionController,
  approveRuntimeCommandCall,
  createDefaultRuntimeCommandRegistry,
  proposeRuntimeCommandCall,
  type RuntimeChildProcess,
  type RuntimeCommandSpawn,
  type RuntimeCommandSpec,
} from ".";

let db: Database.Database;
let controller: RuntimeExecutionController;

class FakeRuntimeChild extends EventEmitter implements RuntimeChildProcess {
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn(() => {
    this.emit("close", null);
    return true;
  });

  close(code: number | null): void {
    this.stdout.end();
    this.stderr.end();
    this.emit("close", code);
  }

  fail(error: Error): void {
    this.emit("error", error);
  }
}

function makeSpawn(
  onSpawn?: (child: FakeRuntimeChild) => void,
): RuntimeCommandSpawn & { calls: Array<Parameters<RuntimeCommandSpawn>> } {
  const calls: Array<Parameters<RuntimeCommandSpawn>> = [];
  const spawnCommand = ((...args: Parameters<RuntimeCommandSpawn>) => {
    calls.push(args);
    const child = new FakeRuntimeChild();
    onSpawn?.(child);
    return child;
  }) as unknown as RuntimeCommandSpawn & {
    calls: Array<Parameters<RuntimeCommandSpawn>>;
  };
  spawnCommand.calls = calls;
  return spawnCommand;
}

function proposeAndApprove(input: {
  callId: string;
  commandId: "git.status" | "node.version";
  argv: string[];
  workingDirectory: string;
}) {
  const proposed = proposeRuntimeCommandCall(db, {
    sessionId: "session-1",
    commandId: input.commandId,
    argv: input.argv,
    workingDirectory: input.workingDirectory,
    callId: input.callId,
    now: () => 1_000,
  });
  if (!proposed.ok) throw new Error(proposed.reason);
  const approved = approveRuntimeCommandCall(db, {
    callId: input.callId,
    approvedAt: 2_000,
  });
  if (!approved.ok) throw new Error(approved.reason);
  return approved.call;
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  controller = new RuntimeExecutionController();
});

afterEach(() => {
  controller.clear();
  vi.useRealTimers();
  db.close();
});

describe("RuntimeCommandExecutor", () => {
  it("executes node.version safely with spawn shell false", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => {
        child.stdout.write("v22.0.0\n");
        child.close(0);
      });
    });

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      controller,
      spawnCommand,
      now: () => 3_000,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "completed",
      exitCode: 0,
      stdout: { text: "v22.0.0\n", truncated: false },
    });
    expect(spawnCommand.calls[0]).toMatchObject([
      "node",
      ["--version"],
      { shell: false, cwd: undefined },
    ]);
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "completed",
      exit_code: 0,
      stdout_ref: "runtime-inline://runtime-call-1/stdout",
    });
  });

  it("executes git.status in the configured repository root", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
    });
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => child.close(0));
    });

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      repoRoot: "C:\\repo",
      controller,
      spawnCommand,
    });

    expect(result.ok).toBe(true);
    expect(spawnCommand.calls[0]).toMatchObject([
      "git",
      ["status", "--short"],
      { shell: false, cwd: "C:\\repo" },
    ]);
  });

  it("does not execute unapproved command calls", async () => {
    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
      callId: "runtime-call-1",
    });
    const spawnCommand = makeSpawn();

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      controller,
      spawnCommand,
    });

    expect(result).toMatchObject({ ok: false, status: "not_approved" });
    expect(spawnCommand.calls).toHaveLength(0);
    expect(getRuntimeCommandCall(db, "runtime-call-1")?.status).toBe("pending");
  });

  it("rejects dangerous argv before spawning", async () => {
    createRuntimeCommandCall(db, {
      id: "runtime-call-1",
      sessionId: "session-1",
      commandId: "git.status",
      command: "git",
      argv: ["status", "--short", ";"],
      workingDirectory: "repo_root",
      requiredSafetyTag: "ALLOW",
      reversibilityClass: "PURE_READ",
      status: "approved",
      proposedAt: 1_000,
      approvedAt: 2_000,
    });
    const spawnCommand = makeSpawn();

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      controller,
      spawnCommand,
    });

    expect(result).toMatchObject({ ok: false, status: "invalid" });
    expect(spawnCommand.calls).toHaveLength(0);
  });

  it("does not execute disabled commands", async () => {
    const disabledSpec: RuntimeCommandSpec = {
      ...createDefaultRuntimeCommandRegistry().get("git.status"),
      enabled: false,
    };
    const registry = new RuntimeCommandRegistry();
    registry.register(disabledSpec);
    createRuntimeCommandCall(db, {
      id: "runtime-call-1",
      sessionId: "session-1",
      commandId: "git.status",
      command: "git",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
      requiredSafetyTag: "ALLOW",
      reversibilityClass: "PURE_READ",
      status: "approved",
      proposedAt: 1_000,
      approvedAt: 2_000,
    });
    const spawnCommand = makeSpawn();

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      registry,
      controller,
      spawnCommand,
    });

    expect(result).toMatchObject({ ok: false, status: "invalid" });
    expect(spawnCommand.calls).toHaveLength(0);
  });

  it("updates status on timeout without needing shell execution", async () => {
    vi.useFakeTimers();
    const registry = new RuntimeCommandRegistry();
    registry.register({
      ...createDefaultRuntimeCommandRegistry().get("node.version"),
      timeoutMs: 100,
    });
    createRuntimeCommandCall(db, {
      id: "runtime-call-1",
      sessionId: "session-1",
      commandId: "node.version",
      command: "node",
      argv: ["--version"],
      workingDirectory: "none",
      requiredSafetyTag: "ALLOW",
      reversibilityClass: "PURE_READ",
      status: "approved",
      proposedAt: 1_000,
      approvedAt: 2_000,
    });
    const spawnCommand = makeSpawn();

    const pending = new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      registry,
      controller,
      spawnCommand,
      now: () => 3_000,
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;

    expect(result).toMatchObject({ ok: false, status: "timeout" });
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "timeout",
      error_class: "RuntimeCommandTimeout",
    });
  });

  it("updates status on manual cancellation", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn();
    const pending = new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      controller,
      spawnCommand,
      now: () => 3_000,
    });

    controller.cancel("runtime-call-1", { db, now: () => 4_000 });
    const result = await pending;

    expect(result).toMatchObject({ ok: false, status: "cancelled" });
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "cancelled",
      error_class: "RuntimeCommandCancelled",
    });
  });

  it("bounds stdout and stderr and emits truncation telemetry", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => {
        child.stdout.write("abcdef");
        child.stderr.write("ghijkl");
        child.close(0);
      });
    });

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      controller,
      spawnCommand,
      outputLimitBytes: 3,
    });

    expect(result).toMatchObject({
      ok: true,
      stdout: { text: "abc", bytes: 6, truncated: true },
      stderr: { text: "ghi", bytes: 6, truncated: true },
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "runtime_command_output_truncated",
    );
  });

  it("emits execution telemetry and keeps command surface read-only", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => child.close(0));
    });

    await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      controller,
      spawnCommand,
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_command_started",
        "runtime_command_completed",
      ]),
    );
    expect(listRuntimeCommandCalls(db)).toHaveLength(1);
    expect(spawnCommand.calls.every((call) => call[2].shell === false)).toBe(
      true,
    );
  });
});
