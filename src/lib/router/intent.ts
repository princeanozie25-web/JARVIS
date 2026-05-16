import type { Message } from "../types";
import type { IntentResult } from "./types";

function latestUserText(messages: Message[]): string {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

export function classifyIntent(messages: Message[]): IntentResult {
  const text = latestUserText(messages).trim().toLowerCase();

  if (!text) {
    return { intent: "AMBIGUOUS", reason: "No user message found." };
  }

  if (/^(hi|hello|hey|yo|thanks|thank you|you there)\b/.test(text)) {
    return {
      intent: "CONVERSATIONAL",
      reason: "Greeting or lightweight chat.",
    };
  }

  if (/^(open|launch|start|stop|turn on|turn off|set|close)\b/.test(text)) {
    return {
      intent: "DETERMINISTIC_COMMAND",
      reason: "Looks like a direct command.",
    };
  }

  if (/\b(write|draft|compose|rewrite|brainstorm|story|poem)\b/.test(text)) {
    return {
      intent: "CREATIVE_TASK",
      reason: "Asks for generation or rewriting.",
    };
  }

  if (
    /\b(review|debug|reason|plan|compare|design|architecture|why|solve)\b/.test(
      text,
    )
  ) {
    return {
      intent: "REASONING_TASK",
      reason: "Requires analysis or multi-step reasoning.",
    };
  }

  if (/^(what|who|when|where|how|which)\b/.test(text)) {
    return {
      intent: "INFORMATION_REQUEST",
      reason: "Asks for information.",
    };
  }

  return {
    intent: "AMBIGUOUS",
    reason: "No deterministic rule matched.",
  };
}
