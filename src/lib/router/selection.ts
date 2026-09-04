import { models, type ModelEntry } from "../models";
import type { ProviderId } from "../providers";
import type { CapabilityResult, ModelSelectionResult } from "./types";

export interface SelectModelOptions {
  requestedProvider?: ProviderId;
  candidates?: ModelEntry[];
  /** E-037: the provider used when none is requested (tests inject it). */
  defaultProvider?: ProviderId;
}

const PROVIDER_IDS: readonly ProviderId[] = ["openai", "anthropic", "ollama"];

// E-037 (Phase 25B-1): the default chat provider is a CONFIG decision, not a
// literal. `JARVIS_DEFAULT_CHAT_PROVIDER` wins; else `JARVIS_LOCAL_ONLY=true`
// means the local brain; else the pre-25 default (OpenAI) — which is what the
// frozen router tests exercise with an empty env. The env var doubles as the
// kill switch: set it to `openai` and Ollama is never selected by default.
export function resolveDefaultChatProvider(
  env: Record<string, string | undefined> = process.env,
): ProviderId {
  const explicit = env.JARVIS_DEFAULT_CHAT_PROVIDER?.trim().toLowerCase();
  if (explicit && (PROVIDER_IDS as readonly string[]).includes(explicit)) {
    return explicit as ProviderId;
  }
  const localOnly = env.JARVIS_LOCAL_ONLY?.trim().toLowerCase();
  if (localOnly === "true" || localOnly === "1" || localOnly === "yes") {
    return "ollama";
  }
  return "openai";
}

export function selectModel(
  capability: CapabilityResult,
  opts: SelectModelOptions = {},
): ModelSelectionResult {
  const allCandidates =
    opts.candidates ?? models.list((entry) => entry.enabled);
  const tierCandidates = allCandidates.filter(
    (entry) => entry.tier === capability.tier,
  );
  const candidates = tierCandidates.length > 0 ? tierCandidates : allCandidates;

  const defaultProvider = opts.defaultProvider ?? resolveDefaultChatProvider();
  const providerCandidates = opts.requestedProvider
    ? candidates.filter((entry) => entry.provider === opts.requestedProvider)
    : candidates.filter((entry) => entry.provider === defaultProvider);

  const selected =
    providerCandidates.find((entry) =>
      capability.requiredCapabilities.every((cap) =>
        entry.capabilities.includes(cap),
      ),
    ) ??
    candidates.find((entry) =>
      capability.requiredCapabilities.every((cap) =>
        entry.capabilities.includes(cap),
      ),
    );

  if (!selected && capability.requiredCapabilities.includes("tools")) {
    const fallback =
      allCandidates.find(
        (entry) =>
          entry.provider === (opts.requestedProvider ?? defaultProvider) &&
          entry.capabilities.includes("text") &&
          entry.capabilities.includes("stream"),
      ) ??
      allCandidates.find(
        (entry) =>
          entry.provider === defaultProvider &&
          entry.capabilities.includes("text") &&
          entry.capabilities.includes("stream"),
      );

    if (fallback) {
      return {
        providerId: fallback.provider,
        model: fallback,
        reason: "No executable tool path exists yet; selected chat fallback.",
      };
    }
  }

  if (!selected) {
    throw new Error(`No enabled model supports tier ${capability.tier}`);
  }

  return {
    providerId: selected.provider,
    model: selected,
    reason: opts.requestedProvider
      ? `Selected requested provider ${selected.provider}.`
      : `Selected default ${defaultProvider} chat model.`,
  };
}
