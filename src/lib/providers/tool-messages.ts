import type {
  AssistantToolCallMessage,
  CompletedProviderToolCall,
  ProviderMessage,
  ToolResultMessage,
} from "./types";

export function isAssistantToolCallMessage(
  message: ProviderMessage,
): message is AssistantToolCallMessage {
  return (
    message.role === "assistant" &&
    "toolCalls" in message &&
    Array.isArray(message.toolCalls)
  );
}

export function isToolResultMessage(
  message: ProviderMessage,
): message is ToolResultMessage {
  return message.role === "tool";
}

export function assistantToolCallMessage(
  toolCalls: CompletedProviderToolCall[],
): AssistantToolCallMessage {
  return {
    role: "assistant",
    content: "",
    toolCalls,
  };
}

export function toolResultMessage(input: {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}): ToolResultMessage {
  return {
    role: "tool",
    toolCallId: input.toolCallId,
    name: input.name,
    content: input.content,
    isError: input.isError,
  };
}
