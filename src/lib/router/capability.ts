import type { CapabilityResult, IntentResult, SafetyResult } from "./types";

export function matchCapability(
  intent: IntentResult,
  safety: SafetyResult,
): CapabilityResult {
  void safety;

  if (intent.intent === "DETERMINISTIC_COMMAND") {
    return {
      tier: "T0",
      requiredCapabilities: ["text", "stream"],
      reason:
        "Command detected, but no tools are wired yet; keep chat reply path.",
    };
  }

  if (
    intent.intent === "REASONING_TASK" ||
    intent.intent === "CREATIVE_TASK" ||
    intent.intent === "AMBIGUOUS"
  ) {
    return {
      tier: "T3",
      requiredCapabilities: ["text", "stream"],
      reason: "Cloud chat model is the current capable path.",
    };
  }

  return {
    tier: "T3",
    requiredCapabilities: ["text", "stream"],
    reason: "Default typed chat path.",
  };
}
