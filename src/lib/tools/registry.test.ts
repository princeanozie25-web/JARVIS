import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { InProcessToolRuntime, tools } from ".";
import { applyMigrations } from "../db/schema";
import { listToolCalls } from "../db/tool-calls";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { statusTool } from "./mock";
import { ToolRegistry } from "./registry";
import type { Tool } from "./types";

const allowDecision: RouterDecision = {
  intent: { intent: "CONVERSATIONAL", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["text", "stream"],
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
let telemetryEvents: Array<
  Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
>;

function runtimeFor(registry: ToolRegistry = tools): InProcessToolRuntime {
  return new InProcessToolRuntime(registry, {
    db,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
    newId() {
      return "exec-generated";
    },
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  telemetryEvents = [];
});

afterEach(() => {
  db.close();
});

describe("ToolRegistry", () => {
  it("registers and retrieves tools by id", () => {
    const registry = new ToolRegistry();
    registry.register(statusTool);

    expect(registry.has("mock.status")).toBe(true);
    expect(registry.get("mock.status")).toBe(statusTool);
    expect(registry.list()).toEqual([statusTool]);
  });

  it("rejects duplicate tool ids", () => {
    const registry = new ToolRegistry();
    registry.register(statusTool);

    expect(() => registry.register(statusTool)).toThrow(
      "Tool already registered: mock.status",
    );
  });

  it("ships with mock status and phase 2 filesystem tools registered", () => {
    expect(tools.list().map((tool) => tool.id)).toEqual([
      "mock.status",
      "fs.list_dir",
      "fs.read_file",
      "fs.stat",
      "fs.create_file",
      "fs.write_file",
      "fs.append_file",
      "fs.mkdir",
      "fs.rename",
      "fs.undo",
    ]);
  });

  it("does not register unapproved write/delete/terminal tools", () => {
    expect(
      tools
        .list()
        .filter((tool) => tool.reversibilityClass !== "NO_SIDE_EFFECT")
        .map((tool) => [
          tool.id,
          tool.reversibilityClass,
          tool.requiredSafetyTag,
        ]),
    ).toEqual([
      ["fs.list_dir", "PURE_READ", "ALLOW"],
      ["fs.read_file", "PURE_READ", "ALLOW"],
      ["fs.stat", "PURE_READ", "ALLOW"],
      ["fs.create_file", "REVERSIBLE_WRITE", "CONFIRM_ONCE"],
      ["fs.write_file", "REVERSIBLE_WRITE", "CONFIRM_ONCE"],
      ["fs.append_file", "REVERSIBLE_WRITE", "CONFIRM_ONCE"],
      ["fs.mkdir", "REVERSIBLE_WRITE", "CONFIRM_ONCE"],
      ["fs.rename", "REVERSIBLE_WRITE", "CONFIRM_ONCE"],
      ["fs.undo", "PURE_READ", "ALLOW"],
    ]);
  });

  it("executes the mock tool through the in-process runtime", async () => {
    const runtime = runtimeFor(tools);

    await expect(
      runtime.runTool({
        toolId: "mock.status",
        input: { echo: "hello" },
        sessionId: "session-1",
        executionId: "exec-1",
        decision: allowDecision,
      }),
    ).resolves.toEqual({
      ok: true,
      status: "COMPLETED",
      message: "Mock tool registry is online.",
      data: {
        echo: "hello",
        executionId: "exec-1",
        sessionId: "session-1",
      },
    });

    expect(listToolCalls(db).map((row) => row.status)).toEqual(["COMPLETED"]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_executed",
      "tool_completed",
    ]);
  });

  it("denies invalid tool input before execution", async () => {
    const runtime = runtimeFor(tools);

    await expect(
      runtime.runTool({
        toolId: "mock.status",
        input: { echo: 42 },
        sessionId: "session-1",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "DENIED",
      message: "Tool input failed validation.",
      data: { reason: "invalid_tool_input" },
    });

    expect(listToolCalls(db).map((row) => row.status)).toEqual(["DENIED"]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
    ]);
  });

  it("detects approval required when router safety is insufficient", async () => {
    const registry = new ToolRegistry();
    const writeLikeTool: Tool<{ value: string }> = {
      id: "mock.write_like",
      name: "Mock Write-like Tool",
      description: "Test-only tool that requires write-level safety.",
      requiredSafetyTag: "CONFIRM_ONCE",
      inputSchema: z.object({ value: z.string() }),
      scopeOf(input) {
        return input.value;
      },
      reversibilityClass: "REVERSIBLE_WRITE",
      timeoutMs: 1000,
      async execute() {
        return { ok: true, message: "should not execute" };
      },
    };
    registry.register(writeLikeTool);
    const runtime = runtimeFor(registry);

    await expect(
      runtime.runTool({
        toolId: "mock.write_like",
        input: { value: "x" },
        sessionId: "session-1",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "AWAITING_APPROVAL",
      message: "Tool approval required.",
      data: {
        reason: "approval_required",
        approvalStatus: "required",
        requiredSafetyTag: "CONFIRM_ONCE",
        actualSafetyTag: "ALLOW",
      },
    });

    expect(listToolCalls(db).map((row) => row.status)).toEqual([
      "AWAITING_APPROVAL",
    ]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_denied",
    ]);
  });

  it("returns an abort result when the parent signal aborts", async () => {
    const registry = new ToolRegistry();
    const slowTool: Tool<Record<string, never>> = {
      id: "mock.slow",
      name: "Mock Slow Tool",
      description: "Test-only slow tool.",
      requiredSafetyTag: "ALLOW",
      inputSchema: z.object({}),
      scopeOf() {
        return "mock.slow";
      },
      reversibilityClass: "NO_SIDE_EFFECT",
      timeoutMs: 1000,
      execute(_input, context) {
        return new Promise((resolve) => {
          context.signal.addEventListener("abort", () => {
            resolve({ ok: false, message: "tool saw abort" });
          });
        });
      },
    };
    registry.register(slowTool);
    const runtime = runtimeFor(registry);
    const controller = new AbortController();
    controller.abort();

    await expect(
      runtime.runTool({
        toolId: "mock.slow",
        input: {},
        sessionId: "session-1",
        decision: allowDecision,
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "CANCELLED",
      message: "Tool execution aborted.",
      data: { reason: "aborted" },
    });

    expect(listToolCalls(db).map((row) => row.status)).toEqual(["CANCELLED"]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_cancelled",
    ]);
  });

  it("returns a timeout result when execution exceeds the tool timeout", async () => {
    const registry = new ToolRegistry();
    const timeoutTool: Tool<Record<string, never>> = {
      id: "mock.timeout",
      name: "Mock Timeout Tool",
      description: "Test-only timeout tool.",
      requiredSafetyTag: "ALLOW",
      inputSchema: z.object({}),
      scopeOf() {
        return "mock.timeout";
      },
      reversibilityClass: "NO_SIDE_EFFECT",
      timeoutMs: 1,
      execute() {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ ok: true, message: "too late" });
          }, 50);
        });
      },
    };
    registry.register(timeoutTool);
    const runtime = runtimeFor(registry);

    await expect(
      runtime.runTool({
        toolId: "mock.timeout",
        input: {},
        sessionId: "session-1",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "TIMEOUT",
      message: "Tool execution timed out.",
      data: { reason: "timeout" },
    });

    expect(listToolCalls(db).map((row) => row.status)).toEqual(["TIMEOUT"]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_executed",
      "tool_timeout",
    ]);
  });

  it("returns an error result when a tool throws", async () => {
    const registry = new ToolRegistry();
    const throwTool: Tool<Record<string, never>> = {
      id: "mock.throw",
      name: "Mock Throw Tool",
      description: "Test-only throwing tool.",
      requiredSafetyTag: "ALLOW",
      inputSchema: z.object({}),
      scopeOf() {
        return "mock.throw";
      },
      reversibilityClass: "NO_SIDE_EFFECT",
      timeoutMs: 1000,
      async execute() {
        throw new Error("boom");
      },
    };
    registry.register(throwTool);
    const runtime = runtimeFor(registry);

    await expect(
      runtime.runTool({
        toolId: "mock.throw",
        input: {},
        sessionId: "session-1",
        decision: allowDecision,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "ERROR",
      message: "Tool execution failed.",
      data: { reason: "error", error: "boom" },
    });

    expect(listToolCalls(db).map((row) => row.status)).toEqual(["ERROR"]);
    expect(telemetryEvents.map((event) => event.event_type)).toEqual([
      "tool_executed",
      "tool_completed",
    ]);
  });
});
