import { calculateCostUsd } from "../cost";
import { config } from "../runtime/config";
import {
  isAssistantToolCallMessage,
  isToolResultMessage,
} from "./tool-messages";
import type {
  ChatProvider,
  GenerateOptions,
  GenerateResult,
  ProviderId,
  ProviderMessage,
  ProviderToolDefinition,
  StreamEvent,
  StreamResult,
} from "./types";

// E-037 (Phase 25B-1) — the LOCAL chat provider on the existing ChatProvider
// contract: Ollama's /api/chat over loopback, NDJSON streamed. Same events as
// the OpenAI provider (text, tool_call_start/delta/complete, usage, done,
// error) so the chat route and the read-only tool continuation are untouched.
//   Kill switches: JARVIS_OLLAMA_BASE_URL (point elsewhere), the request
//   AbortSignal, a hard timeout. A dead runtime yields ONE honest `error`
//   event ("ollama unreachable") — never a cloud fallback, never a fake reply.
//   Privacy: nothing here logs prompts or bodies; usage is token counts only.

export const OLLAMA_PROVIDER_ID: ProviderId = "ollama";
export const OLLAMA_DEFAULT_TIMEOUT_MS = 120_000;

type FetchLike = typeof fetch;

interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: unknown } }[];
  tool_name?: string;
}

interface OllamaChatChunk {
  model?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: { function: { name: string; arguments: unknown } }[];
  };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

export interface OllamaProviderOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
}

function toOllamaMessages(messages: ProviderMessage[]): OllamaChatMessage[] {
  return messages.map((message) => {
    if (isToolResultMessage(message)) {
      return {
        role: "tool",
        content: message.content,
        tool_name: message.name,
      };
    }
    if (isAssistantToolCallMessage(message)) {
      return {
        role: "assistant",
        content: message.content ?? "",
        tool_calls: message.toolCalls.map((call) => ({
          function: { name: call.name, arguments: safeParse(call.argsJson) },
        })),
      };
    }
    return {
      role: message.role,
      content: message.content,
    } as OllamaChatMessage;
  });
}

function toOllamaTools(tools: ProviderToolDefinition[] | undefined) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

export class OllamaProvider implements ChatProvider {
  readonly id: ProviderId = OLLAMA_PROVIDER_ID;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? config.ollama.baseUrl).replace(
      /\/$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? OLLAMA_DEFAULT_TIMEOUT_MS;
  }

  async generate(
    messages: ProviderMessage[],
    opts: GenerateOptions,
  ): Promise<GenerateResult> {
    const { events } = await this.stream(messages, opts);
    let result: GenerateResult | null = null;
    for await (const event of events) {
      if (event.type === "done") result = event.result;
      if (event.type === "error") throw new Error(event.message);
    }
    if (!result) throw new Error("ollama stream ended without a result");
    return result;
  }

  async stream(
    messages: ProviderMessage[],
    opts: GenerateOptions,
  ): Promise<StreamResult> {
    const startedAt = Date.now();
    const baseUrl = this.baseUrl;
    const fetchImpl = this.fetchImpl;
    const timeoutMs = this.timeoutMs;

    async function* iterate(): AsyncIterable<StreamEvent> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      opts.signal?.addEventListener("abort", onAbort, { once: true });

      let content = "";
      let modelId = opts.model;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let timeToFirstTokenMs: number | undefined;
      let toolIndex = 0;

      try {
        let response: Response;
        try {
          response = await fetchImpl(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: opts.model,
              messages: toOllamaMessages(messages),
              stream: true,
              tools: toOllamaTools(opts.tools),
              options: {
                ...(opts.temperature === undefined
                  ? {}
                  : { temperature: opts.temperature }),
                ...(opts.maxTokens === undefined
                  ? {}
                  : { num_predict: opts.maxTokens }),
              },
            }),
            signal: controller.signal,
          });
        } catch (error) {
          const aborted = opts.signal?.aborted === true;
          yield {
            type: "error",
            message: aborted
              ? "ollama request aborted"
              : `ollama unreachable at ${baseUrl} (${error instanceof Error ? error.name : "error"})`,
            recoverable: aborted,
          };
          return;
        }

        if (!response.ok || !response.body) {
          yield {
            type: "error",
            message: `ollama responded ${response.status}`,
            recoverable: false,
          };
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          let newline = buffered.indexOf("\n");
          while (newline >= 0) {
            const line = buffered.slice(0, newline).trim();
            buffered = buffered.slice(newline + 1);
            newline = buffered.indexOf("\n");
            if (!line) continue;
            let chunk: OllamaChatChunk;
            try {
              chunk = JSON.parse(line) as OllamaChatChunk;
            } catch {
              continue;
            }
            if (chunk.error) {
              yield {
                type: "error",
                message: `ollama: ${chunk.error}`,
                recoverable: false,
              };
              return;
            }
            if (chunk.model) modelId = chunk.model;
            const delta = chunk.message?.content;
            if (delta) {
              if (timeToFirstTokenMs === undefined)
                timeToFirstTokenMs = Date.now() - startedAt;
              content += delta;
              yield { type: "text", value: delta };
            }
            for (const call of chunk.message?.tool_calls ?? []) {
              const id = `ollama-tool-${toolIndex++}`;
              const argsJson = JSON.stringify(call.function.arguments ?? {});
              yield { type: "tool_call_start", id, name: call.function.name };
              yield { type: "tool_call_delta", id, argsJsonChunk: argsJson };
              yield {
                type: "tool_call_complete",
                id,
                name: call.function.name,
                argsJson,
              };
            }
            if (chunk.done) {
              inputTokens = chunk.prompt_eval_count;
              outputTokens = chunk.eval_count;
              if (inputTokens !== undefined && outputTokens !== undefined) {
                yield { type: "usage", inputTokens, outputTokens };
              }
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
      } catch (error) {
        const aborted =
          opts.signal?.aborted === true || controller.signal.aborted;
        yield {
          type: "error",
          message: aborted
            ? "ollama request aborted or timed out"
            : error instanceof Error
              ? error.message
              : String(error),
          recoverable: aborted,
        };
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onAbort);
      }
    }

    return { events: iterate() };
  }
}
