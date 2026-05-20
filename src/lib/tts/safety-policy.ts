import type {
  SpeechSynthesisInput,
  SpeechSynthesisRefusalReason,
} from "./types";

export interface SpeechSafetyPolicyDecision {
  allowed: boolean;
  reason?: SpeechSynthesisRefusalReason;
}

export function evaluateSpeechSafetyPolicy(
  input: SpeechSynthesisInput,
): SpeechSafetyPolicyDecision {
  if (!input.text.trim()) {
    return { allowed: false, reason: "empty_text" };
  }
  if (input.source === "tool_output") {
    return { allowed: false, reason: "tool_output_blocked" };
  }
  if (input.source === "code_block" || containsCodeBlock(input.text)) {
    return { allowed: false, reason: "code_block_blocked" };
  }
  if (input.source === "audit_runtime_output") {
    return { allowed: false, reason: "audit_runtime_output_blocked" };
  }
  if (
    input.source === "personal_context" ||
    input.contentTags?.includes("personal_context") ||
    containsPersonalContextTag(input.text)
  ) {
    return { allowed: false, reason: "personal_context_blocked" };
  }
  if (input.source !== "assistant_prose") {
    return { allowed: false, reason: "assistant_prose_required" };
  }

  return { allowed: true };
}

function containsCodeBlock(text: string): boolean {
  return text.includes("```");
}

function containsPersonalContextTag(text: string): boolean {
  return /<\/?personal_context\b|personal_context:/i.test(text);
}
