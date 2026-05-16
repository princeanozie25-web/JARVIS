import OpenAI from "openai";
import { config } from "../config";
import type { Message } from "../types";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderId,
} from "./types";

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
    const response = await this.client.chat.completions.create({
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    });

    const content =
      response.choices[0]?.message?.content ?? "No response generated.";

    return { content };
  }
}
