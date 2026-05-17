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
import { safeToolInputSummary } from "./tool-approvals";

export const READ_ONLY_PROVIDER_TOOL_IDS = new Set([
  "fs.list_dir",
  "fs.read_file",
  "fs.stat",
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

    const execution = await executeReadOnlyToolCalls(input, completedToolCalls);
    for (const event of execution.events) {
      yield event;
    }

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

async function executeReadOnlyToolCalls(
  input: StreamWithToolContinuationInput,
  toolCalls: CompletedProviderToolCall[],
): Promise<{ messages: ProviderMessage[]; events: StreamEvent[] }> {
  const messages: ProviderMessage[] = [];
  const events: StreamEvent[] = [];

  for (const toolCall of toolCalls) {
    const toolId = input.providerTools.nameToId.get(toolCall.name);
    const parsedInput = parseToolArgs(toolCall.argsJson);

    if (!toolId || !READ_ONLY_PROVIDER_TOOL_IDS.has(toolId)) {
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
    events.push({
      type: "tool_executed",
      executionId: toolCall.id,
      toolId,
      toolName: tool.name,
    });

    const result = await input.runtime.runTool({
      toolId,
      input: parsedInput.value,
      sessionId: input.sessionId,
      executionId: toolCall.id,
      messageId: input.assistantMessageId,
      decision: input.decision,
      signal: input.signal,
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

  return { messages, events };
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
