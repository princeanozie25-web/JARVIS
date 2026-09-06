// Any JARVIS ChatProvider (Ollama locally, a keyed cloud provider if ever
// chosen) as the local live session's brain. Tool calls come back as data on
// GenerateResult.toolCalls (additive) and are NOT executed here.

import type {
  ChatProvider,
  ProviderToolDefinition,
  ProviderToolInputSchema,
} from "../../providers/types";

type Message = Parameters<ChatProvider["generate"]>[0][number];
import type { VoiceLiveToolSpec } from "./contract";
import type {
  VoiceLiveBrain,
  VoiceLiveBrainMessage,
  VoiceLiveBrainTurn,
} from "./local-turn-provider";

export interface ChatProviderBrainOptions {
  readonly model: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

// The ChatProvider.generate contract takes plain Messages; tool results are
// folded into the conversation as text so this works with every provider.
function toMessages(messages: readonly VoiceLiveBrainMessage[]): Message[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "user",
        content: `Tool result (${m.tool_call_id ?? "call"}): ${m.content}\nAnswer the user now in one short spoken sentence.`,
      };
    }
    return { role: m.role, content: m.content };
  });
}

function toTools(
  tools: readonly VoiceLiveToolSpec[],
): ProviderToolDefinition[] | undefined {
  if (tools.length === 0) return undefined;
  return tools.map((t) => ({
    id: t.name,
    name: t.name,
    description: t.description,
    inputSchema: { type: "object", ...t.parameters } as ProviderToolInputSchema,
  }));
}

export function createChatProviderBrain(
  provider: ChatProvider,
  options: ChatProviderBrainOptions,
): VoiceLiveBrain {
  return {
    generate: async (messages, tools, signal): Promise<VoiceLiveBrainTurn> => {
      const result = await provider.generate(toMessages(messages), {
        model: options.model,
        maxTokens: options.maxTokens ?? 160,
        ...(options.temperature === undefined
          ? {}
          : { temperature: options.temperature }),
        ...(signal ? { signal } : {}),
        ...(toTools(tools) ? { tools: toTools(tools) } : {}),
      });
      return {
        text: result.content,
        tool_calls: (result.toolCalls ?? []).map((c) => ({
          call_id: c.id,
          name: c.name,
          arguments_json: c.argsJson,
        })),
        input_tokens: result.inputTokens ?? 0,
        output_tokens: result.outputTokens ?? 0,
        cost_usd: result.costUsd,
      };
    },
  };
}
