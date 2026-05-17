import Database from "better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { listToolCalls } from "../db/tool-calls";
import type {
  ChatProvider,
  GenerateResult,
  ProviderMessage,
  StreamEvent,
  StreamResult,
} from "../providers";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { InProcessToolRuntime, providerToolMetadata, tools } from "../tools";
import {
  PROVIDER_TOOL_IDS,
  READ_ONLY_PROVIDER_TOOL_IDS,
  streamWithReadOnlyToolContinuation,
} from "./tool-continuation";

const allowDecision: RouterDecision = {
  intent: { intent: "DETERMINISTIC_COMMAND", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: {
    tier: "T3",
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
      capabilities: ["tools"],
      enabled: true,
    },
    reason: "test",
  },
};

class StubProvider implements ChatProvider {
  readonly id = "openai" as const;
  readonly seenMessages: ProviderMessage[][] = [];

  constructor(
    private readonly toolName: string,
    private readonly argsJson: string,
    private readonly finalText: string,
  ) {}

  async generate(): Promise<GenerateResult> {
    throw new Error("not used");
  }

  async stream(messages: ProviderMessage[]): Promise<StreamResult> {
    this.seenMessages.push(messages);
    const callCount = this.seenMessages.length;
    const toolName = this.toolName;
    const argsJson = this.argsJson;
    const finalText = this.finalText;

    async function* events(): AsyncIterable<StreamEvent> {
      if (callCount === 1) {
        yield { type: "tool_call_start", id: "call-1", name: toolName };
        yield {
          type: "tool_call_complete",
          id: "call-1",
          name: toolName,
          argsJson,
        };
        yield {
          type: "done",
          result: result(""),
        };
        return;
      }

      yield { type: "text", value: finalText };
      yield {
        type: "done",
        result: result(finalText),
      };
    }

    return { events: events() };
  }
}

let db: Database.Database;
let workspace: string;
let previousWorkspaceRoot: string | undefined;
let telemetryEvents: Array<
  Omit<TelemetryEvent, "timestamp"> & { timestamp?: number }
>;

beforeEach(async () => {
  db = new Database(":memory:");
  applyMigrations(db);
  workspace = await mkdtemp(join(tmpdir(), "jarvis-continuation-"));
  mkdirSync(join(workspace, "docs"));
  writeFileSync(join(workspace, "README.md"), "hello from jarvis");
  writeFileSync(join(workspace, "docs", "notes.txt"), "note body");
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspace;
  telemetryEvents = [];
});

afterEach(async () => {
  db.close();
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
  await rm(workspace, { recursive: true, force: true });
});

function runtime() {
  return new InProcessToolRuntime(tools, {
    db,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
  });
}

async function collect(provider: ChatProvider): Promise<StreamEvent[]> {
  const providerTools = providerToolMetadata(tools, (toolId) =>
    READ_ONLY_PROVIDER_TOOL_IDS.has(toolId),
  );
  const events: StreamEvent[] = [];
  for await (const event of streamWithReadOnlyToolContinuation({
    provider,
    messages: [{ role: "user", content: "inspect workspace" }],
    model: "gpt-4o-mini",
    signal: new AbortController().signal,
    providerTools,
    runtime: runtime(),
    registry: tools,
    db,
    sessionId: "session-1",
    assistantMessageId: "message-1",
    decision: allowDecision,
    recordEvent(event) {
      telemetryEvents.push(event);
    },
  })) {
    events.push(event);
  }
  return events;
}

describe("read-only provider tool continuation", () => {
  it("executes fs.list_dir and streams the final assistant text", async () => {
    const provider = new StubProvider(
      "fs_list_dir",
      '{"path":"."}',
      "I found files.",
    );

    const events = await collect(provider);

    expect(events.map((event) => event.type)).toEqual([
      "tool_call_start",
      "tool_call_complete",
      "tool_proposed",
      "tool_executed",
      "tool_completed",
      "text",
      "done",
    ]);
    expect(provider.seenMessages).toHaveLength(2);
    expect(provider.seenMessages[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "assistant" }),
        expect.objectContaining({ role: "tool", toolCallId: "call-1" }),
      ]),
    );
    expect(
      provider.seenMessages[1].some(
        (message) =>
          message.role === "tool" && message.content.includes("README.md"),
      ),
    ).toBe(true);
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "call-1",
      tool_id: "fs.list_dir",
      status: "COMPLETED",
    });
  });

  it("executes fs.read_file and gives the provider the file content", async () => {
    const provider = new StubProvider(
      "fs_read_file",
      '{"path":"README.md"}',
      "The file says hello.",
    );

    await collect(provider);

    expect(
      provider.seenMessages[1].some(
        (message) =>
          message.role === "tool" &&
          message.content.includes("hello from jarvis"),
      ),
    ).toBe(true);
    expect(listToolCalls(db)[0]).toMatchObject({
      tool_id: "fs.read_file",
      status: "COMPLETED",
    });
  });

  it("passes a safe tool failure back to the provider", async () => {
    const provider = new StubProvider(
      "fs_read_file",
      '{"path":"missing.txt"}',
      "I could not read it.",
    );

    await collect(provider);

    expect(
      provider.seenMessages[1].some(
        (message) =>
          message.role === "tool" &&
          message.content.includes("Path does not exist"),
      ),
    ).toBe(true);
    expect(listToolCalls(db)[0]).toMatchObject({
      tool_id: "fs.read_file",
      status: "DENIED",
    });
  });

  it("records telemetry with execution id and tool name", async () => {
    const provider = new StubProvider(
      "fs_stat",
      '{"path":"README.md"}',
      "It is a file.",
    );

    await collect(provider);

    expect(
      telemetryEvents
        .filter((event) =>
          ["tool_proposed", "tool_executed", "tool_completed"].includes(
            event.event_type,
          ),
        )
        .map((event) => ({
          type: event.event_type,
          execution: event.execution_id,
          tool: event.tool_name,
        })),
    ).toEqual([
      { type: "tool_proposed", execution: "call-1", tool: "fs.stat" },
      { type: "tool_executed", execution: "call-1", tool: "fs.stat" },
      { type: "tool_completed", execution: "call-1", tool: "fs.stat" },
    ]);
  });

  it("does not expose write-capable tools to the provider", () => {
    const providerTools = providerToolMetadata(tools, (toolId) =>
      READ_ONLY_PROVIDER_TOOL_IDS.has(toolId),
    );

    expect(providerTools.definitions.map((tool) => tool.id)).toEqual([
      "fs.list_dir",
      "fs.read_file",
      "fs.stat",
    ]);
  });
});

describe("approval-gated provider tool continuation", () => {
  it("emits pending approval for fs.create_file without writing first", async () => {
    const provider = new StubProvider(
      "fs_create_file",
      '{"path":"created.txt","content":"hello"}',
      "unused",
    );
    const providerTools = providerToolMetadata(tools, (toolId) =>
      PROVIDER_TOOL_IDS.has(toolId),
    );

    const events: StreamEvent[] = [];
    for await (const event of streamWithReadOnlyToolContinuation({
      provider,
      messages: [{ role: "user", content: "create a file" }],
      model: "gpt-4o-mini",
      signal: new AbortController().signal,
      providerTools,
      runtime: runtime(),
      registry: tools,
      db,
      sessionId: "session-1",
      assistantMessageId: "message-1",
      decision: allowDecision,
      recordEvent(event) {
        telemetryEvents.push(event);
      },
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "tool_call_start",
      "tool_call_complete",
      "tool_proposed",
      "tool_pending",
    ]);
    expect(events.find((event) => event.type === "tool_pending")).toMatchObject(
      {
        type: "tool_pending",
        executionId: "call-1",
        toolId: "fs.create_file",
        requiredSafetyTag: "CONFIRM_ONCE",
        summary: "path: created.txt",
      },
    );
    expect(provider.seenMessages).toHaveLength(1);
    expect(listToolCalls(db)[0]).toMatchObject({
      execution_id: "call-1",
      tool_id: "fs.create_file",
      status: "AWAITING_APPROVAL",
    });
    await expect(
      import("node:fs/promises").then(({ access }) =>
        access(join(workspace, "created.txt")),
      ),
    ).rejects.toThrow();
  });

  it("exposes only read tools and fs.create_file to providers", () => {
    const providerTools = providerToolMetadata(tools, (toolId) =>
      PROVIDER_TOOL_IDS.has(toolId),
    );

    expect(providerTools.definitions.map((tool) => tool.id)).toEqual([
      "fs.list_dir",
      "fs.read_file",
      "fs.stat",
      "fs.create_file",
      "fs.write_file",
    ]);
  });
});

function result(content: string): GenerateResult {
  return {
    content,
    modelId: "gpt-4o-mini",
    inputTokens: 1,
    outputTokens: 1,
    costUsd: 0,
    latencyMs: 1,
    timeToFirstTokenMs: 1,
  };
}
