import OpenAI from "openai";
import { config } from "../config";
import type { Message } from "../types";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderId,
} from "./types";

const PLACEHOLDER_COST_PER_REQUEST_USD = 0.001;

export class OpenAIProvider implements ChatProvider {
  readonly id: ProviderId = "openai";

  private client: OpenAI;

  constructor(apiKey: string = config.openai.apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(
    messages: Message[],
    opts: GenerateOptions,
  ): Promise<GenerateResult> {
    const startedAt = Date.now();

    const response = await this.client.chat.completions.create({
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    });

    const latencyMs = Date.now() - startedAt;

    const content =
      response.choices[0]?.message?.content ?? "No response generated.";

    return {
      content,
      modelId: response.model ?? opts.model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      costUsd: PLACEHOLDER_COST_PER_REQUEST_USD,
      latencyMs,
    };
  }
}
