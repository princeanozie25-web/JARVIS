import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  streamRuntimeCommandExecution,
  type RuntimeChildProcess,
  type RuntimeCommandSpawn,
  type RuntimeCommandSpec,
  type RuntimeStreamEvent,
} from ".";

let db: Database.Database;
let controller: RuntimeExecutionController;
let defaultWorkspaceRoot: string;
let previousWorkspaceRoot: string | undefined;
const tempRoots: string[] = [];

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

async function collectStream(input: {
  events: AsyncIterable<RuntimeStreamEvent>;
  result: Promise<unknown>;
}): Promise<{ events: RuntimeStreamEvent[]; result: unknown }> {
  const events: RuntimeStreamEvent[] = [];
  const collecting = (async () => {
    for await (const event of input.events) events.push(event);
  })();
  const result = await input.result;
  await collecting;
  return { events, result };
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  controller = new RuntimeExecutionController();
  defaultWorkspaceRoot = tempWorkspace();
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = defaultWorkspaceRoot;
});

afterEach(() => {
  controller.clear();
  vi.useRealTimers();
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
  db.close();
});

function tempWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "jarvis-runtime-"));
  tempRoots.push(root);
  return root;
}

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
      { shell: false, cwd: defaultWorkspaceRoot },
    ]);
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "completed",
      exit_code: 0,
      stdout_ref: "runtime-inline://runtime-call-1/stdout",
    });
  });

  it("executes git.status in the configured repository root", async () => {
    const workspaceRoot = tempWorkspace();
    mkdirSync(join(workspaceRoot, "packages"), { recursive: true });
    const proposed = proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      callId: "runtime-call-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "packages",
      workspaceRoot,
      now: () => 1_000,
    });
    if (!proposed.ok) throw new Error(proposed.reason);
    const approved = approveRuntimeCommandCall(db, {
      callId: "runtime-call-1",
      approvedAt: 2_000,
    });
    if (!approved.ok) throw new Error(approved.reason);
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => child.close(0));
    });

    const result = await new RuntimeCommandExecutor(db).runApproved({
      callId: "runtime-call-1",
      workspaceRoot,
      controller,
      spawnCommand,
    });

    expect(result.ok).toBe(true);
    expect(spawnCommand.calls[0]).toMatchObject([
      "git",
      ["status", "--short"],
      { shell: false, cwd: join(workspaceRoot, "packages") },
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

  it("uses the workspace resolver before spawning", async () => {
    createRuntimeCommandCall(db, {
      id: "runtime-call-1",
      sessionId: "session-1",
      commandId: "git.status",
      command: "git",
      argv: ["status", "--short"],
      workingDirectory: "..",
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

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      reason: "path_traversal_rejected",
    });
    expect(spawnCommand.calls).toHaveLength(0);
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "failed",
      error_class: "RuntimeCommandSpawnFailed",
    });
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

  it("streams started, stdout, stderr, and completed events", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => {
        child.stdout.write("node-out");
        child.stderr.write("node-err");
        child.close(0);
      });
    });

    const stream = streamRuntimeCommandExecution(db, {
      callId: "runtime-call-1",
      controller,
      spawnCommand,
      now: () => 5_000,
    });
    const emitted: RuntimeStreamEvent[] = [];
    stream.emitter.onRuntimeEvent((event) => emitted.push(event));
    const { events, result } = await collectStream(stream);

    expect(result).toMatchObject({ ok: true, status: "completed" });
    expect(events).toEqual([
      {
        type: "runtime_command_started",
        command_call_id: "runtime-call-1",
        command_id: "node.version",
        timestamp: 5_000,
      },
      {
        type: "runtime_stdout",
        command_call_id: "runtime-call-1",
        command_id: "node.version",
        timestamp: 5_000,
        chunk: "node-out",
        bytes: 8,
      },
      {
        type: "runtime_stderr",
        command_call_id: "runtime-call-1",
        command_id: "node.version",
        timestamp: 5_000,
        chunk: "node-err",
        bytes: 8,
      },
      {
        type: "runtime_command_completed",
        command_call_id: "runtime-call-1",
        command_id: "node.version",
        timestamp: 5_000,
        exit_code: 0,
      },
    ]);
    expect(spawnCommand.calls[0][2].shell).toBe(false);
    expect(emitted).toEqual(events);
  });

  it("streams failed events", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn((child) => {
      queueMicrotask(() => child.close(2));
    });

    const { events, result } = await collectStream(
      streamRuntimeCommandExecution(db, {
        callId: "runtime-call-1",
        controller,
        spawnCommand,
        now: () => 6_000,
      }),
    );

    expect(result).toMatchObject({ ok: false, status: "failed", exitCode: 2 });
    expect(events).toContainEqual({
      type: "runtime_command_failed",
      command_call_id: "runtime-call-1",
      command_id: "node.version",
      timestamp: 6_000,
      exit_code: 2,
      error_class: "RuntimeCommandNonZeroExit",
      error_message: "Runtime command exited with code 2.",
    });
  });

  it("streams timeout events", async () => {
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
    const stream = streamRuntimeCommandExecution(db, {
      callId: "runtime-call-1",
      registry,
      controller,
      spawnCommand,
      now: () => 7_000,
    });
    const collecting = collectStream(stream);

    await vi.advanceTimersByTimeAsync(100);
    const { events, result } = await collecting;

    expect(result).toMatchObject({ ok: false, status: "timeout" });
    expect(events).toContainEqual({
      type: "runtime_command_timeout",
      command_call_id: "runtime-call-1",
      command_id: "node.version",
      timestamp: 7_000,
    });
  });

  it("streams cancelled events", async () => {
    proposeAndApprove({
      callId: "runtime-call-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
    });
    const spawnCommand = makeSpawn();
    const stream = streamRuntimeCommandExecution(db, {
      callId: "runtime-call-1",
      controller,
      spawnCommand,
      now: () => 8_000,
    });
    const collecting = collectStream(stream);

    controller.cancel("runtime-call-1", { db, now: () => 9_000 });
    const { events, result } = await collecting;

    expect(result).toMatchObject({ ok: false, status: "cancelled" });
    expect(events).toContainEqual({
      type: "runtime_command_cancelled",
      command_call_id: "runtime-call-1",
      command_id: "node.version",
      timestamp: 8_000,
    });
  });

  it("streams truncation events and bounded chunks", async () => {
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

    const { events, result } = await collectStream(
      streamRuntimeCommandExecution(db, {
        callId: "runtime-call-1",
        controller,
        spawnCommand,
        outputLimitBytes: 3,
        now: () => 10_000,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      stdout: { text: "abc", truncated: true },
      stderr: { text: "ghi", truncated: true },
    });
    expect(events).toEqual(
      expect.arrayContaining([
        {
          type: "runtime_stdout",
          command_call_id: "runtime-call-1",
          command_id: "node.version",
          timestamp: 10_000,
          chunk: "abc",
          bytes: 6,
        },
        {
          type: "runtime_output_truncated",
          command_call_id: "runtime-call-1",
          command_id: "node.version",
          timestamp: 10_000,
          stream: "stdout",
          limit_bytes: 3,
          observed_bytes: 6,
        },
        {
          type: "runtime_output_truncated",
          command_call_id: "runtime-call-1",
          command_id: "node.version",
          timestamp: 10_000,
          stream: "stderr",
          limit_bytes: 3,
          observed_bytes: 6,
        },
      ]),
    );
  });

  it("keeps stream payloads free of environment and secret values", async () => {
    process.env.JARVIS_STREAM_TEST_SECRET = "super-secret-value";
    try {
      proposeAndApprove({
        callId: "runtime-call-1",
        commandId: "node.version",
        argv: ["--version"],
        workingDirectory: "none",
      });
      const spawnCommand = makeSpawn((child) => {
        queueMicrotask(() => child.close(0));
      });

      const { events } = await collectStream(
        streamRuntimeCommandExecution(db, {
          callId: "runtime-call-1",
          controller,
          spawnCommand,
        }),
      );
      const serialized = JSON.stringify(events);

      expect(serialized).not.toContain("JARVIS_STREAM_TEST_SECRET");
      expect(serialized).not.toContain("super-secret-value");
      expect(serialized).not.toContain("env");
      expect(spawnCommand.calls[0][2].shell).toBe(false);
    } finally {
      delete process.env.JARVIS_STREAM_TEST_SECRET;
    }
  });
});
