import type { Message } from "../types";
import type { SafetyTag } from "../router/types";

export type ProviderId = "openai" | "anthropic" | "ollama";

export interface ProviderToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface ProviderToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: ProviderToolInputSchema;
}

export interface GenerateOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  tools?: ProviderToolDefinition[];
}

export interface CompletedProviderToolCall {
  id: string;
  name: string;
  argsJson: string;
}

export interface AssistantToolCallMessage {
  role: "assistant";
  content: string;
  toolCalls: CompletedProviderToolCall[];
}

export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type ProviderMessage =
  | Message
  | AssistantToolCallMessage
  | ToolResultMessage;

export interface GenerateResult {
  content: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  latencyMs: number;
  timeToFirstTokenMs?: number;
  // Additive (voice live): tool calls the model asked for during this
  // generation. Surfaced, never executed here — the Gate decides.
  toolCalls?: CompletedProviderToolCall[];
}

export type StreamEvent =
  | { type: "text"; value: string }
  | {
      type: "tool_proposed";
      executionId: string;
      toolId: string;
      toolName: string;
      summary: string;
    }
  | {
      type: "tool_executed";
      executionId: string;
      toolId: string;
      toolName: string;
    }
  | {
      type: "tool_completed";
      executionId: string;
      toolId: string;
      toolName: string;
      ok: boolean;
      status?: string;
      message: string;
      data?: unknown;
    }
  | {
      type: "tool_pending";
      executionId: string;
      toolId: string;
      toolName: string;
      scopeHash: string;
      requiredSafetyTag: SafetyTag;
      safetyTag: SafetyTag;
      summary: string;
      approvalExpiresAt: number;
      approvalToken: string;
    }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; argsJsonChunk: string }
  | { type: "tool_call_complete"; id: string; name: string; argsJson: string }
  | { type: "tool_call_end"; id: string; name: string; argsJson: string }
  | {
      type: "tool_call_error";
      id?: string;
      message: string;
      recoverable: boolean;
    }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "done"; result: GenerateResult };

export interface StreamResult {
  events: AsyncIterable<StreamEvent>;
}

export interface ChatProvider {
  readonly id: ProviderId;
  generate(messages: Message[], opts: GenerateOptions): Promise<GenerateResult>;
  stream(
    messages: ProviderMessage[],
    opts: GenerateOptions,
  ): Promise<StreamResult>;
}
