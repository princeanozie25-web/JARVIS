import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRuntimeCommandCall,
  getRuntimeCommandCall,
  listRuntimeCommandCalls,
} from "@/lib/db/runtime-command-calls";
import { applyMigrations } from "@/lib/db/schema";
import { listTelemetryEvents } from "@/lib/db/telemetry";
import { runtimeExecutionController } from "@/lib/runtime-commands";
import { POST as approveCommand } from "./[callId]/approve/route";
import { POST as cancelCommand } from "./[callId]/cancel/route";
import { POST as denyCommand } from "./[callId]/deny/route";
import { POST as executeCommand } from "./[callId]/execute/route";
import { POST as streamCommand } from "./[callId]/stream/route";
import { GET as listCommands, POST as proposeCommand } from "./route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    getDb: mocks.getDb,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("node:child_process", () => ({
  spawn: mocks.spawn,
}));

let db: Database.Database;

class FakeRuntimeChild extends EventEmitter {
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
}

function routeContext(callId: string) {
  return { params: Promise.resolve({ callId }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/runtime-commands", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function spawnWith(
  onSpawn: (child: FakeRuntimeChild) => void = (child) => {
    queueMicrotask(() => child.close(0));
  },
) {
  mocks.spawn.mockImplementation(() => {
    const child = new FakeRuntimeChild();
    onSpawn(child);
    return child;
  });
}

async function proposeNodeVersion() {
  const response = await proposeCommand(
    jsonRequest({
      sessionId: "session-1",
      commandId: "node.version",
      argv: ["--version"],
    }),
  );
  const body = (await response.json()) as { callId: string };
  return body.callId;
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  mocks.getDb.mockReturnValue(db);
  mocks.spawn.mockReset();
  runtimeExecutionController.clear();
});

afterEach(() => {
  runtimeExecutionController.clear();
  db.close();
});

describe("runtime command API", () => {
  it("lists only read-only runtime commands", async () => {
    const response = await listCommands();
    const body = (await response.json()) as {
      commands: Array<{
        id: string;
        requiredSafetyTag: string;
        reversibilityClass: string;
      }>;
    };

    expect(body.commands.map((command) => command.id).sort()).toEqual([
      "git.diff_stat",
      "git.log",
      "git.status",
      "node.version",
    ]);
    expect(
      body.commands.every(
        (command) =>
          command.requiredSafetyTag === "ALLOW" &&
          command.reversibilityClass === "PURE_READ",
      ),
    ).toBe(true);
  });

  it("proposes a valid command", async () => {
    const response = await proposeCommand(
      jsonRequest({
        sessionId: "session-1",
        commandId: "node.version",
        argv: ["--version"],
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      callId: string;
      call: { status: string; command_id: string };
    };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      call: { status: "pending", command_id: "node.version" },
    });
    expect(getRuntimeCommandCall(db, body.callId)?.status).toBe("pending");
  });

  it("rejects invalid commands before audit row creation", async () => {
    const response = await proposeCommand(
      jsonRequest({
        sessionId: "session-1",
        commandId: "runtime.write_file",
        argv: ["anything"],
      }),
    );

    expect(response.status).toBe(404);
    expect(listRuntimeCommandCalls(db)).toEqual([]);
    expect(listTelemetryEvents(db).map((event) => event.event_type)).toContain(
      "runtime_api_denied",
    );
  });

  it("rejects dangerous argv before audit row creation", async () => {
    const response = await proposeCommand(
      jsonRequest({
        sessionId: "session-1",
        commandId: "git.status",
        argv: ["status", "--short", ";"],
      }),
    );

    expect(response.status).toBe(400);
    expect(listRuntimeCommandCalls(db)).toEqual([]);
  });

  it("approves a pending runtime command", async () => {
    const callId = await proposeNodeVersion();

    const response = await approveCommand(
      jsonRequest({}),
      routeContext(callId),
    );
    const body = (await response.json()) as { call: { status: string } };

    expect(response.status).toBe(200);
    expect(body.call.status).toBe("approved");
    expect(getRuntimeCommandCall(db, callId)?.status).toBe("approved");
  });

  it("denies a pending runtime command", async () => {
    const callId = await proposeNodeVersion();

    const response = await denyCommand(
      jsonRequest({ reason: "not now" }),
      routeContext(callId),
    );
    const body = (await response.json()) as { call: { status: string } };

    expect(response.status).toBe(200);
    expect(body.call.status).toBe("denied");
    expect(getRuntimeCommandCall(db, callId)).toMatchObject({
      status: "denied",
      error_class: "RuntimeCommandApprovalDenied",
    });
  });

  it("executes an approved read-only command through spawn shell false", async () => {
    const callId = await proposeNodeVersion();
    await approveCommand(jsonRequest({}), routeContext(callId));
    spawnWith((child) => {
      queueMicrotask(() => {
        child.stdout.write("v22.0.0\n");
        child.close(0);
      });
    });

    const response = await executeCommand(
      jsonRequest({}),
      routeContext(callId),
    );
    const body = (await response.json()) as {
      ok: boolean;
      result: { status: string; stdout: { text: string } };
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      result: {
        status: "completed",
        stdout: { text: "v22.0.0\n" },
      },
    });
    expect(mocks.spawn).toHaveBeenCalledWith(
      "node",
      ["--version"],
      expect.objectContaining({ shell: false }),
    );
  });

  it("rejects execution when the command is not approved", async () => {
    const callId = await proposeNodeVersion();

    const response = await executeCommand(
      jsonRequest({}),
      routeContext(callId),
    );

    expect(response.status).toBe(409);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("cancels an active runtime command", async () => {
    createRuntimeCommandCall(db, {
      id: "runtime-call-1",
      sessionId: "session-1",
      commandId: "node.version",
      command: "node",
      argv: ["--version"],
      workingDirectory: "none",
      requiredSafetyTag: "ALLOW",
      reversibilityClass: "PURE_READ",
      status: "running",
      proposedAt: 1_000,
      approvedAt: 2_000,
      startedAt: 3_000,
    });
    runtimeExecutionController.createContext({
      commandCallId: "runtime-call-1",
      timeoutMs: 5_000,
      db,
    });

    const response = await cancelCommand(
      jsonRequest({}),
      routeContext("runtime-call-1"),
    );

    expect(response.status).toBe(200);
    expect(getRuntimeCommandCall(db, "runtime-call-1")).toMatchObject({
      status: "cancelled",
      error_class: "RuntimeCommandCancelled",
    });
  });

  it("streams typed NDJSON runtime events", async () => {
    const callId = await proposeNodeVersion();
    await approveCommand(jsonRequest({}), routeContext(callId));
    spawnWith((child) => {
      queueMicrotask(() => {
        child.stdout.write("stream-out");
        child.close(0);
      });
    });

    const response = await streamCommand(jsonRequest({}), routeContext(callId));
    const text = await response.text();
    const events = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; chunk?: string });

    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "runtime_command_started" }),
        expect.objectContaining({
          type: "runtime_stdout",
          chunk: "stream-out",
        }),
        expect.objectContaining({ type: "runtime_command_completed" }),
      ]),
    );
    expect(mocks.spawn).toHaveBeenCalledWith(
      "node",
      ["--version"],
      expect.objectContaining({ shell: false }),
    );
  });

  it("rejects stream execution when the command is not approved", async () => {
    const callId = await proposeNodeVersion();

    const response = await streamCommand(jsonRequest({}), routeContext(callId));

    expect(response.status).toBe(409);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("records runtime API telemetry", async () => {
    const callId = await proposeNodeVersion();
    await approveCommand(jsonRequest({}), routeContext(callId));

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_api_request",
        "runtime_command_proposed",
        "runtime_command_approved",
      ]),
    );
  });
});
