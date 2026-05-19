import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRuntimeCommandCall,
  getRuntimeCommandCall,
} from "../db/runtime-command-calls";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  RuntimeExecutionController,
  cancelAllRuntimeCommands,
  cancelRuntimeCommandCall,
} from ".";

let db: Database.Database;
let controller: RuntimeExecutionController;

function seedCall(id: string, proposedAt = 1_000) {
  return createRuntimeCommandCall(db, {
    id,
    sessionId: "session-1",
    commandId: "git.status",
    command: "git",
    argv: ["status", "--short"],
    workingDirectory: "repo_root",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    status: "approved",
    proposedAt,
    approvedAt: proposedAt,
  });
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

describe("RuntimeExecutionController", () => {
  it("creates abort signals without requiring execution", () => {
    seedCall("runtime-call-1");

    const context = controller.createContext({
      commandCallId: "runtime-call-1",
      timeoutMs: 1_000,
      db,
      now: () => 2_000,
    });

    expect(context).toMatchObject({
      command_call_id: "runtime-call-1",
      timeoutMs: 1_000,
      created_at: 2_000,
      cancellation_source: null,
    });
    expect(context.signal.aborted).toBe(false);
    expect(controller.size()).toBe(1);
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "runtime_command_abort_signal_created",
    );
  });

  it("aborts signal on timeout and records cancellation source", () => {
    vi.useFakeTimers();
    seedCall("runtime-call-1");
    const context = controller.createContext({
      commandCallId: "runtime-call-1",
      timeoutMs: 100,
      db,
      now: () => 3_000,
    });

    vi.advanceTimersByTime(100);

    expect(context.signal.aborted).toBe(true);
    expect(context.cancellation_source).toBe("timeout");
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "timeout",
      completed_at: 3_000,
      error_class: "RuntimeCommandTimeout",
    });
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "runtime_command_timeout",
    );
  });

  it("aborts signal on manual cancellation and records source", () => {
    seedCall("runtime-call-1");
    const context = controller.createContext({
      commandCallId: "runtime-call-1",
      timeoutMs: 1_000,
      db,
      now: () => 2_000,
    });

    const cancelled = cancelRuntimeCommandCall({
      commandCallId: "runtime-call-1",
      controller,
      db,
      now: () => 4_000,
    });

    expect(cancelled).toBe(context);
    expect(context.signal.aborted).toBe(true);
    expect(context.cancellation_source).toBe("user");
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "cancelled",
      completed_at: 4_000,
      error_class: "RuntimeCommandCancelled",
    });
  });

  it("global cancellation aborts all active signals", () => {
    seedCall("runtime-call-1");
    seedCall("runtime-call-2");
    const first = controller.createContext({
      commandCallId: "runtime-call-1",
      timeoutMs: 1_000,
      db,
    });
    const second = controller.createContext({
      commandCallId: "runtime-call-2",
      timeoutMs: 1_000,
      db,
    });

    const cancelled = cancelAllRuntimeCommands({
      controller,
      db,
      now: () => 5_000,
    });

    expect(cancelled.map((context) => context.command_call_id).sort()).toEqual([
      "runtime-call-1",
      "runtime-call-2",
    ]);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(first.cancellation_source).toBe("global_shutdown");
    expect(second.cancellation_source).toBe("global_shutdown");
    expect(getRuntimeCommandCall(db, "runtime-call-1")?.status).toBe(
      "cancelled",
    );
    expect(getRuntimeCommandCall(db, "runtime-call-2")?.status).toBe(
      "cancelled",
    );
  });

  it("records cancellation telemetry for manual and global cancellation", () => {
    seedCall("runtime-call-1");
    seedCall("runtime-call-2");
    controller.createContext({
      commandCallId: "runtime-call-1",
      timeoutMs: 1_000,
      db,
    });
    controller.createContext({
      commandCallId: "runtime-call-2",
      timeoutMs: 1_000,
      db,
    });

    cancelRuntimeCommandCall({
      commandCallId: "runtime-call-1",
      controller,
      db,
    });
    cancelAllRuntimeCommands({ controller, db });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_command_abort_signal_created",
        "runtime_command_cancelled",
      ]),
    );
  });
});
