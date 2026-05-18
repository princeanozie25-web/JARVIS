import type {
  ChatProvider,
  CompletedProviderToolCall,
  ProviderMessage,
  ProviderToolDefinition,
  StreamEvent,
} from "../providers";
import {
  assistantToolCallMessage,
  toolResultMessage,
} from "../providers/tool-messages";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import type { ToolRegistry, ToolResult, ToolRuntime } from "../tools";
import {
  ensurePendingToolApproval,
  safeToolInputSummary,
} from "./tool-approvals";
import type DatabaseType from "better-sqlite3";

export const READ_ONLY_PROVIDER_TOOL_IDS = new Set([
  "fs.list_dir",
  "fs.read_file",
  "fs.stat",
  "doc.read_txt",
  "doc.read_pdf",
  "doc.read_docx",
]);

export const WRITE_PROVIDER_TOOL_IDS = new Set([
  "fs.create_file",
  "fs.write_file",
  "fs.append_file",
  "fs.mkdir",
  "fs.rename",
  "fs.delete_file",
]);

export const MEMORY_PROVIDER_TOOL_IDS = new Set(["memory.note"]);

export const PROVIDER_TOOL_IDS = new Set([
  ...READ_ONLY_PROVIDER_TOOL_IDS,
  ...WRITE_PROVIDER_TOOL_IDS,
  ...MEMORY_PROVIDER_TOOL_IDS,
]);

const MAX_TOOL_CONTINUATIONS = 3;

export interface ProviderToolMetadataForContinuation {
  definitions: ProviderToolDefinition[];
  nameToId: Map<string, string>;
}

export interface StreamWithToolContinuationInput {
  provider: ChatProvider;
  messages: ProviderMessage[];
  model: string;
  signal: AbortSignal;
  providerTools: ProviderToolMetadataForContinuation;
  runtime: ToolRuntime;
  registry: ToolRegistry;
  db?: DatabaseType.Database;
  sessionId: string;
  assistantMessageId: string;
  decision: RouterDecision;
  recordEvent?: (
    event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
  ) => void;
  maxContinuations?: number;
}

export async function* streamWithReadOnlyToolContinuation(
  input: StreamWithToolContinuationInput,
): AsyncIterable<StreamEvent> {
  let messages = [...input.messages];
  let accumulatedCostUsd = 0;
  const maxContinuations = input.maxContinuations ?? MAX_TOOL_CONTINUATIONS;

  for (let turn = 0; turn <= maxContinuations; turn += 1) {
    const stream = await input.provider.stream(messages, {
      model: input.model,
      signal: input.signal,
      tools: input.providerTools.definitions,
    });

    const completedToolCalls: CompletedProviderToolCall[] = [];

    for await (const event of stream.events) {
      if (isToolCallEnd(event)) {
        const completed = {
          id: event.id,
          name: event.name,
          argsJson: event.argsJson,
        };
        completedToolCalls.push(completed);
        yield event;
        continue;
      }

      if (event.type === "done") {
        if (completedToolCalls.length > 0) {
          accumulatedCostUsd += event.result.costUsd;
          continue;
        }

        yield {
          ...event,
          result: {
            ...event.result,
            costUsd: event.result.costUsd + accumulatedCostUsd,
          },
        };
        return;
      }

      yield event;
    }

    if (completedToolCalls.length === 0) return;

    const execution = await executeProviderToolCalls(input, completedToolCalls);
    for (const event of execution.events) {
      yield event;
    }
    if (execution.awaitingApproval) return;

    messages = [
      ...messages,
      assistantToolCallMessage(completedToolCalls),
      ...execution.messages,
    ];
  }

  yield {
    type: "error",
    message: "Tool continuation limit reached.",
    recoverable: false,
  };
}

async function executeProviderToolCalls(
  input: StreamWithToolContinuationInput,
  toolCalls: CompletedProviderToolCall[],
): Promise<{
  messages: ProviderMessage[];
  events: StreamEvent[];
  awaitingApproval: boolean;
}> {
  const messages: ProviderMessage[] = [];
  const events: StreamEvent[] = [];
  let awaitingApproval = false;

  for (const toolCall of toolCalls) {
    const toolId = input.providerTools.nameToId.get(toolCall.name);
    const parsedInput = parseToolArgs(toolCall.argsJson);

    if (!toolId || !PROVIDER_TOOL_IDS.has(toolId)) {
      messages.push(
        toolResultMessage({
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: safeResultJson({
            ok: false,
            status: "DENIED",
            message: "Tool is not available in read-only mode.",
          }),
          isError: true,
        }),
      );
      events.push({
        type: "tool_completed",
        executionId: toolCall.id,
        toolId: toolId ?? toolCall.name,
        toolName: toolCall.name,
        ok: false,
        status: "DENIED",
        message: "Tool is not available in read-only mode.",
      });
      continue;
    }

    if (!parsedInput.ok) {
      messages.push(
        toolResultMessage({
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: safeResultJson({
            ok: false,
            status: "DENIED",
            message: "Tool input was not valid JSON.",
          }),
          isError: true,
        }),
      );
      events.push({
        type: "tool_completed",
        executionId: toolCall.id,
        toolId,
        toolName: toolCall.name,
        ok: false,
        status: "DENIED",
        message: "Tool input was not valid JSON.",
      });
      continue;
    }

    const tool = input.registry.get(toolId);
    const summary = safeToolInputSummary(parsedInput.value);
    const proposed: Extract<StreamEvent, { type: "tool_proposed" }> = {
      type: "tool_proposed",
      executionId: toolCall.id,
      toolId,
      toolName: tool.name,
      summary,
    };
    events.push(proposed);
    recordToolProposed(input, proposed);

    const result = await input.runtime.runTool({
      toolId,
      input: parsedInput.value,
      sessionId: input.sessionId,
      executionId: toolCall.id,
      messageId: input.assistantMessageId,
      decision: input.decision,
      signal: input.signal,
    });

    if (result.status === "AWAITING_APPROVAL") {
      const data = result.data as
        | {
            executionId?: string;
            sessionId?: string;
            toolId?: string;
            scopeHash?: string;
            requiredSafetyTag?: RouterDecision["safety"]["safetyTag"];
            actualSafetyTag?: RouterDecision["safety"]["safetyTag"];
          }
        | undefined;
      const pending =
        input.db &&
        ensurePendingToolApproval({
          db: input.db,
          executionId: data?.executionId ?? toolCall.id,
          sessionId: data?.sessionId ?? input.sessionId,
          toolId,
          toolName: tool.name,
          scopeHash: data?.scopeHash ?? tool.scopeOf(parsedInput.value),
          requiredSafetyTag: data?.requiredSafetyTag ?? tool.requiredSafetyTag,
          safetyTag: data?.actualSafetyTag ?? input.decision.safety.safetyTag,
          toolInput: parsedInput.value,
        });
      if (pending) {
        events.push({ type: "tool_pending", ...pending });
      }
      awaitingApproval = true;
      break;
    }

    events.push({
      type: "tool_executed",
      executionId: toolCall.id,
      toolId,
      toolName: tool.name,
    });

    messages.push(
      toolResultMessage({
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: safeResultJson(result),
        isError: !result.ok,
      }),
    );
    events.push({
      type: "tool_completed",
      executionId: toolCall.id,
      toolId,
      toolName: tool.name,
      ok: result.ok,
      status: result.status,
      message: result.message,
    });
  }

  return { messages, events, awaitingApproval };
}

function recordToolProposed(
  input: StreamWithToolContinuationInput,
  event: Extract<StreamEvent, { type: "tool_proposed" }>,
): void {
  input.recordEvent?.({
    event_type: "tool_proposed",
    success: true,
    session_id: input.sessionId,
    execution_id: event.executionId,
    tool_name: event.toolId,
    intent: input.decision.intent.intent,
    safety_tag: input.decision.safety.safetyTag,
    tier: input.decision.capability.tier,
    model_id: input.model,
    notes: `message_id=${input.assistantMessageId} tool_id=${event.toolId} summary=${event.summary}`,
  });
}

function parseToolArgs(
  argsJson: string,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: argsJson.trim() ? JSON.parse(argsJson) : {} };
  } catch {
    return { ok: false };
  }
}

function safeResultJson(result: ToolResult | Record<string, unknown>): string {
  try {
    return JSON.stringify(result);
  } catch {
    return JSON.stringify({
      ok: false,
      status: "ERROR",
      message: "Tool result could not be serialized.",
    });
  }
}

function isToolCallEnd(
  event: StreamEvent,
): event is Extract<
  StreamEvent,
  { type: "tool_call_complete" | "tool_call_end" }
> {
  return event.type === "tool_call_complete" || event.type === "tool_call_end";
}
