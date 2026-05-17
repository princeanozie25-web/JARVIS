import type { ModelEntry, ModelTier } from "../models";
import type { ProviderId } from "../providers";

export type IntentClass =
  | "DETERMINISTIC_COMMAND"
  | "INFORMATION_REQUEST"
  | "REASONING_TASK"
  | "CREATIVE_TASK"
  | "CONVERSATIONAL"
  | "AMBIGUOUS";

export type SafetyTag = "ALLOW" | "CONFIRM_ONCE" | "CONFIRM_ALWAYS" | "BLOCK";

export interface IntentResult {
  intent: IntentClass;
  reason: string;
}

export interface SafetyResult {
  safetyTag: SafetyTag;
  reason: string;
}

export interface CapabilityResult {
  tier: ModelTier;
  requiredCapabilities: Array<"text" | "stream" | "tools">;
  reason: string;
}

export interface ModelSelectionResult {
  providerId: ProviderId;
  model: ModelEntry;
  reason: string;
}

export interface RouterDecision {
  intent: IntentResult;
  safety: SafetyResult;
  capability: CapabilityResult;
  selection: ModelSelectionResult;
}
