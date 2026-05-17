import OpenAI from "openai";
import { calculateCostUsd } from "../cost";
import { config } from "../runtime/config";
import type { Message } from "../types";
import {
  isAssistantToolCallMessage,
  isToolResultMessage,
} from "./tool-messages";
import { toOpenAITools } from "./tools";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderMessage,
  ProviderId,
  StreamEvent,
  StreamResult,
} from "./types";

interface OpenAIToolCallState {
  id: string;
  name: string;
  argsJson: string;
  started: boolean;
}

type OpenAIMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toOpenAIMessages(messages: ProviderMessage[]): OpenAIMessageParam[] {
  return messages.map((message) => {
    if (isToolResultMessage(message)) {
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content,
      };
    }

    if (isAssistantToolCallMessage(message)) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.name,
            arguments: toolCall.argsJson || "{}",
          },
        })),
      };
    }

    return {
      role: message.role,
      content: message.content,
    } as OpenAIMessageParam;
  });
}

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

    const response = await this.client.chat.completions.create(
      {
        model: opts.model,
        messages: toOpenAIMessages(messages),
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        tools: toOpenAITools(opts.tools),
      },
      { signal: opts.signal },
    );

    const latencyMs = Date.now() - startedAt;

    const content =
      response.choices[0]?.message?.content ?? "No response generated.";

    return {
      content,
      modelId: response.model ?? opts.model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      costUsd: calculateCostUsd(
        opts.model,
        response.usage?.prompt_tokens,
        response.usage?.completion_tokens,
      ),
      latencyMs,
    };
  }

  async stream(
    messages: ProviderMessage[],
    opts: GenerateOptions,
  ): Promise<StreamResult> {
    const startedAt = Date.now();

    const sdkStream = await this.client.chat.completions.create(
      {
        model: opts.model,
        messages: toOpenAIMessages(messages),
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        tools: toOpenAITools(opts.tools),
      },
      { signal: opts.signal },
    );

    async function* iterate(): AsyncIterable<StreamEvent> {
      let content = "";
      let modelId = opts.model;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let timeToFirstTokenMs: number | undefined;
      const toolCalls = new Map<number, OpenAIToolCallState>();

      try {
        for await (const chunk of sdkStream) {
          if (chunk.model) modelId = chunk.model;

          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
            yield {
              type: "usage",
              inputTokens,
              outputTokens,
            };
          }

          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            if (timeToFirstTokenMs === undefined) {
              timeToFirstTokenMs = Date.now() - startedAt;
            }
            content += delta;
            yield { type: "text", value: delta };
          }

          for (const toolCall of chunk.choices[0]?.delta?.tool_calls ?? []) {
            const index = toolCall.index;
            const existing = toolCalls.get(index) ?? {
              id: toolCall.id ?? `tool-call-${index}`,
              name: toolCall.function?.name ?? "",
              argsJson: "",
              started: false,
            };

            if (toolCall.id) existing.id = toolCall.id;
            if (toolCall.function?.name) existing.name = toolCall.function.name;

            if (!existing.started && existing.name) {
              existing.started = true;
              yield {
                type: "tool_call_start",
                id: existing.id,
                name: existing.name,
              };
            }

            const argsJsonChunk = toolCall.function?.arguments;
            if (argsJsonChunk) {
              existing.argsJson += argsJsonChunk;
              yield {
                type: "tool_call_delta",
                id: existing.id,
                argsJsonChunk,
              };
            }

            toolCalls.set(index, existing);
          }
        }

        for (const toolCall of toolCalls.values()) {
          if (toolCall.started) {
            yield {
              type: "tool_call_complete",
              id: toolCall.id,
              name: toolCall.name,
              argsJson: toolCall.argsJson,
            };
          } else {
            yield {
              type: "tool_call_error",
              id: toolCall.id,
              message: "Tool call stream ended before a tool name was emitted.",
              recoverable: true,
            };
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
