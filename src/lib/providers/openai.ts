import OpenAI from "openai";
import { config } from "../config";
import type { Message } from "../types";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderId,
  StreamResult,
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

  async stream(
    messages: Message[],
    opts: GenerateOptions,
  ): Promise<StreamResult> {
    const startedAt = Date.now();

    const sdkStream = await this.client.chat.completions.create({
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    let resolveDone!: (r: GenerateResult) => void;
    let rejectDone!: (e: unknown) => void;
    const done = new Promise<GenerateResult>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });

    let content = "";
    let modelId = opts.model;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    async function* iterate(): AsyncIterable<string> {
      try {
        for await (const chunk of sdkStream) {
          if (chunk.model) modelId = chunk.model;
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
          }
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            content += delta;
            yield delta;
          }
        }
        resolveDone({
          content,
          modelId,
          inputTokens,
          outputTokens,
          costUsd: PLACEHOLDER_COST_PER_REQUEST_USD,
          latencyMs: Date.now() - startedAt,
        });
      } catch (err) {
        rejectDone(err);
        throw err;
      }
    }

    return { stream: iterate(), done };
  }
}
