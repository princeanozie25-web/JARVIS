import type { Message } from "../types";

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

export interface GenerateResult {
  content: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  latencyMs: number;
  timeToFirstTokenMs?: number;
}

export type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; argsJsonChunk: string }
  | { type: "tool_call_complete"; id: string; name: string; argsJson: string }
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
  stream(messages: Message[], opts: GenerateOptions): Promise<StreamResult>;
}
