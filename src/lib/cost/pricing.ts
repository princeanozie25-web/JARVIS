import { models } from "../models";

const FALLBACK_COST_USD = 0.001;

export function calculateCostUsd(
  modelName: string,
  inputTokens?: number,
  outputTokens?: number,
): number {
  if (inputTokens === undefined || outputTokens === undefined) {
    return FALLBACK_COST_USD;
  }

  const entry = models.getByModelName(modelName);
  if (!entry) {
    console.warn(
      `[cost/pricing] unknown model "${modelName}"; using fallback $${FALLBACK_COST_USD}/call`,
    );
    return FALLBACK_COST_USD;
  }

  if (!entry.pricing) {
    return FALLBACK_COST_USD;
  }

  return (
    (inputTokens / 1_000_000) * entry.pricing.inputPerMillionUsd +
    (outputTokens / 1_000_000) * entry.pricing.outputPerMillionUsd
  );
}
