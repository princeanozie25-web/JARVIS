import type { Message } from "../types";

export type ProviderId = "openai" | "anthropic" | "ollama";

export interface GenerateOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  latencyMs: number;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  done: Promise<GenerateResult>;
}

export interface ChatProvider {
  readonly id: ProviderId;
  generate(messages: Message[], opts: GenerateOptions): Promise<GenerateResult>;
  stream(messages: Message[], opts: GenerateOptions): Promise<StreamResult>;
}
