import type { Message } from "../types";

export type ProviderId = "openai" | "anthropic" | "ollama";

export interface GenerateOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
}

export interface ChatProvider {
  readonly id: ProviderId;
  generate(messages: Message[], opts: GenerateOptions): Promise<GenerateResult>;
}
