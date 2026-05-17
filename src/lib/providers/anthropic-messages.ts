import type Anthropic from "@anthropic-ai/sdk";
import type { ProviderMessage } from "./types";
import {
  isAssistantToolCallMessage,
  isToolResultMessage,
} from "./tool-messages";

export type AnthropicMessage = Anthropic.Messages.MessageParam;

function parseToolInput(argsJson: string): Record<string, unknown> {
  if (!argsJson.trim()) return {};
  try {
    const parsed = JSON.parse(argsJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function splitSystemPrompt(messages: ProviderMessage[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const rest: AnthropicMessage[] = [];
  for (const m of messages) {
    if (isToolResultMessage(m)) {
      rest.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content,
            is_error: m.isError,
          },
        ],
      });
      continue;
    }

    if (isAssistantToolCallMessage(m)) {
      rest.push({
        role: "assistant",
        content: [
          ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
          ...m.toolCalls.map((toolCall) => ({
            type: "tool_use" as const,
            id: toolCall.id,
            name: toolCall.name,
            input: parseToolInput(toolCall.argsJson),
          })),
        ],
      });
      continue;
    }

    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      rest.push({ role: m.role, content: m.content });
    }
  }
  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: rest,
  };
}
