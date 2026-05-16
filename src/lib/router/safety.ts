import type { Message } from "../types";
import type { SafetyResult } from "./types";

function latestUserText(messages: Message[]): string {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

export function classifySafety(messages: Message[]): SafetyResult {
  const text = latestUserText(messages).trim().toLowerCase();

  if (/\b(api[_ -]?key|password|secret|private key)\b/.test(text)) {
    return {
      safetyTag: "BLOCK",
      reason: "Mentions sensitive credential material.",
    };
  }

  if (/\b(delete|wipe|erase|destroy|format|rm -rf|drop table)\b/.test(text)) {
    return {
      safetyTag: "CONFIRM_ALWAYS",
      reason: "Potentially destructive action.",
    };
  }

  if (/\b(edit|write to|save|create|update|modify|rename)\b/.test(text)) {
    return {
      safetyTag: "CONFIRM_ONCE",
      reason: "Potentially reversible write action.",
    };
  }

  return {
    safetyTag: "ALLOW",
    reason: "No risky action detected.",
  };
}
