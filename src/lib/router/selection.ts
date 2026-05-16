import { models, type ModelEntry } from "../models";
import type { ProviderId } from "../providers";
import type { CapabilityResult, ModelSelectionResult } from "./types";

export interface SelectModelOptions {
  requestedProvider?: ProviderId;
  candidates?: ModelEntry[];
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

  const providerCandidates = opts.requestedProvider
    ? candidates.filter((entry) => entry.provider === opts.requestedProvider)
    : candidates.filter((entry) => entry.provider === "openai");

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

  if (!selected) {
    throw new Error(`No enabled model supports tier ${capability.tier}`);
  }

  return {
    providerId: selected.provider,
    model: selected,
    reason: opts.requestedProvider
      ? `Selected requested provider ${selected.provider}.`
      : "Selected default OpenAI chat model.",
  };
}
