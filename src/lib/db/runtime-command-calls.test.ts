import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations, listSchemaMigrations } from "./schema";
import { listTelemetryEvents } from "./telemetry";
import {
  attachRuntimeCommandOutputRefs,
  createRuntimeCommandCall,
  getRuntimeCommandCall,
  listRuntimeCommandCalls,
  updateRuntimeCommandCallStatus,
  type CreateRuntimeCommandCallInput,
} from "./runtime-command-calls";

let db: Database.Database;

function baseInput(
  overrides: Partial<CreateRuntimeCommandCallInput> = {},
): CreateRuntimeCommandCallInput {
  return {
    id: "runtime-call-1",
    sessionId: "session-1",
    commandId: "git.status",
    command: "git",
    argv: ["status", "--short"],
    workingDirectory: "repo_root",
    requiredSafetyTag: "ALLOW",
    reversibilityClass: "PURE_READ",
    proposedAt: 1_000,
    ...overrides,
  };
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("runtime command call audit storage", () => {
  it("creates the runtime command calls table via migration", () => {
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get("runtime_command_calls");

    expect(table).toEqual({ name: "runtime_command_calls" });
    expect(listSchemaMigrations(db).map((row) => row.id)).toContain(
      "013_runtime_command_calls",
    );
  });

  it("creates runtime command call audit rows", () => {
    const row = createRuntimeCommandCall(db, baseInput());

    expect(row).toMatchObject({
      id: "runtime-call-1",
      session_id: "session-1",
      command_id: "git.status",
      command: "git",
      argv_json: JSON.stringify(["status", "--short"]),
      working_directory: "repo_root",
      required_safety_tag: "ALLOW",
      reversibility_class: "PURE_READ",
      status: "pending",
      proposed_at: 1_000,
      stdout_ref: null,
      stderr_ref: null,
      exit_code: null,
    });
  });

  it("reads and lists runtime command calls", () => {
    const first = createRuntimeCommandCall(
      db,
      baseInput({ proposedAt: 1_000 }),
    );
    const second = createRuntimeCommandCall(
      db,
      baseInput({
        id: "runtime-call-2",
        sessionId: "session-2",
        commandId: "node.version",
        command: "node",
        argv: ["--version"],
        workingDirectory: "none",
        proposedAt: 2_000,
      }),
    );

    expect(getRuntimeCommandCall(db, first.id)).toEqual(first);
    expect(listRuntimeCommandCalls(db).map((row) => row.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(
      listRuntimeCommandCalls(db, { sessionId: "session-1" }).map(
        (row) => row.id,
      ),
    ).toEqual([first.id]);
    expect(
      listRuntimeCommandCalls(db, { commandId: "node.version" }).map(
        (row) => row.id,
      ),
    ).toEqual([second.id]);
  });

  it("updates runtime command call status timestamps and failure metadata", () => {
    createRuntimeCommandCall(db, baseInput());

    expect(
      updateRuntimeCommandCallStatus(db, "runtime-call-1", {
        status: "approved",
        at: 2_000,
      }),
    ).toMatchObject({ status: "approved", approved_at: 2_000 });
    expect(
      updateRuntimeCommandCallStatus(db, "runtime-call-1", {
        status: "running",
        at: 3_000,
      }),
    ).toMatchObject({ status: "running", started_at: 3_000 });
    expect(
      updateRuntimeCommandCallStatus(db, "runtime-call-1", {
        status: "failed",
        at: 4_000,
        exitCode: 1,
        errorClass: "FutureRuntimeError",
        errorMessage: "Execution layer not implemented.",
      }),
    ).toMatchObject({
      status: "failed",
      completed_at: 4_000,
      exit_code: 1,
      error_class: "FutureRuntimeError",
      error_message: "Execution layer not implemented.",
    });
  });

  it("attaches future stdout and stderr output references only", () => {
    createRuntimeCommandCall(db, baseInput());

    const row = attachRuntimeCommandOutputRefs(db, "runtime-call-1", {
      stdoutRef: "runtime-output/runtime-call-1/stdout.txt",
      stderrRef: "runtime-output/runtime-call-1/stderr.txt",
    });

    expect(row).toMatchObject({
      id: "runtime-call-1",
      stdout_ref: "runtime-output/runtime-call-1/stdout.txt",
      stderr_ref: "runtime-output/runtime-call-1/stderr.txt",
    });
  });

  it("rejects invalid runtime command call statuses", () => {
    expect(() =>
      createRuntimeCommandCall(db, baseInput({ status: "executing" as never })),
    ).toThrow("Invalid runtime command call status: executing");
    createRuntimeCommandCall(db, baseInput());
    expect(() =>
      updateRuntimeCommandCallStatus(db, "runtime-call-1", {
        status: "executing" as never,
      }),
    ).toThrow("Invalid runtime command call status: executing");
  });

  it("emits runtime command audit telemetry", () => {
    createRuntimeCommandCall(db, baseInput());
    updateRuntimeCommandCallStatus(db, "runtime-call-1", {
      status: "denied",
      at: 2_000,
      errorClass: "PolicyDenied",
      errorMessage: "Denied before execution.",
    });
    attachRuntimeCommandOutputRefs(db, "runtime-call-1", {
      stdoutRef: "runtime-output/runtime-call-1/stdout.txt",
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_command_call_created",
        "runtime_command_call_updated",
        "runtime_command_output_ref_attached",
      ]),
    );
  });
});
