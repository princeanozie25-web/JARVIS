import Anthropic from "@anthropic-ai/sdk";
import { calculateCostUsd } from "../cost";
import { config } from "../runtime/config";
import type { Message } from "../types";
import { splitSystemPrompt } from "./anthropic-messages";
import { toAnthropicTools } from "./tools";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderMessage,
  ProviderId,
  StreamEvent,
  StreamResult,
} from "./types";

const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicToolCallState {
  id: string;
  name: string;
  argsJson: string;
}

export { splitSystemPrompt } from "./anthropic-messages";
export type { AnthropicMessage } from "./anthropic-messages";

export class AnthropicProvider implements ChatProvider {
  readonly id: ProviderId = "anthropic";

  private client: Anthropic;

  constructor(apiKey: string = config.anthropic.apiKey) {
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required to use the Anthropic provider",
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    messages: ProviderMessage[],
    opts: GenerateOptions,
  ): Promise<GenerateResult> {
    const startedAt = Date.now();
    const { system, messages: rest } = splitSystemPrompt(messages);

    const response = await this.client.messages.create(
      {
        model: opts.model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature,
        system,
        messages: rest,
        tools: toAnthropicTools(opts.tools),
      },
      { signal: opts.signal },
    );

    const latencyMs = Date.now() - startedAt;

    const text = response.content
      .filter(
        (block): block is Extract<typeof block, { type: "text" }> =>
          block.type === "text",
      )
      .map((block) => block.text)
      .join("");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      content: text || "No response generated.",
      modelId: response.model ?? opts.model,
      inputTokens,
      outputTokens,
      costUsd: calculateCostUsd(opts.model, inputTokens, outputTokens),
      latencyMs,
    };
  }

  async stream(
    messages: Message[],
    opts: GenerateOptions,
  ): Promise<StreamResult> {
    const startedAt = Date.now();
    const { system, messages: rest } = splitSystemPrompt(messages);

    const sdkStream = this.client.messages.stream(
      {
        model: opts.model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature,
        system,
        messages: rest,
        tools: toAnthropicTools(opts.tools),
      },
      { signal: opts.signal },
    );

    async function* iterate(): AsyncIterable<StreamEvent> {
      let content = "";
      let modelId = opts.model;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let timeToFirstTokenMs: number | undefined;
      let usageEmitted = false;
      const toolCalls = new Map<number, AnthropicToolCallState>();

      try {
        for await (const event of sdkStream) {
          if (event.type === "message_start") {
            modelId = event.message.model ?? modelId;
            inputTokens = event.message.usage.input_tokens;
            outputTokens = event.message.usage.output_tokens;
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            if (text) {
              if (timeToFirstTokenMs === undefined) {
                timeToFirstTokenMs = Date.now() - startedAt;
              }
              content += text;
              yield { type: "text", value: text };
            }
          } else if (
            event.type === "content_block_start" &&
            event.content_block.type === "tool_use"
          ) {
            const toolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              argsJson: "",
            };
            toolCalls.set(event.index, toolCall);
            yield {
              type: "tool_call_start",
              id: toolCall.id,
              name: toolCall.name,
            };
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "input_json_delta"
          ) {
            const toolCall = toolCalls.get(event.index);
            if (toolCall) {
              toolCall.argsJson += event.delta.partial_json;
              yield {
                type: "tool_call_delta",
                id: toolCall.id,
                argsJsonChunk: event.delta.partial_json,
              };
            } else {
              yield {
                type: "tool_call_error",
                message: "Received tool input delta before tool start.",
                recoverable: true,
              };
            }
          } else if (event.type === "content_block_stop") {
            const toolCall = toolCalls.get(event.index);
            if (toolCall) {
              yield {
                type: "tool_call_complete",
                id: toolCall.id,
                name: toolCall.name,
                argsJson: toolCall.argsJson,
              };
              toolCalls.delete(event.index);
            }
          } else if (event.type === "message_delta") {
            outputTokens = event.usage.output_tokens;
            if (
              !usageEmitted &&
              inputTokens !== undefined &&
              outputTokens !== undefined
            ) {
              usageEmitted = true;
              yield { type: "usage", inputTokens, outputTokens };
            }
          }
        }

        yield {
          type: "done",
          result: {
            content,
            modelId,
            inputTokens,
            outputTokens,
            costUsd: calculateCostUsd(opts.model, inputTokens, outputTokens),
            latencyMs: Date.now() - startedAt,
            timeToFirstTokenMs,
          },
        };
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const aborted =
          name === "AbortError" ||
          name === "APIUserAbortError" ||
          opts.signal?.aborted === true;
        yield {
          type: "error",
          message: err instanceof Error ? err.message : String(err),
          recoverable: aborted,
        };
      }
    }

    return { events: iterate() };
  }
}
