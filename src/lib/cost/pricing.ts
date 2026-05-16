interface TokenPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

const FALLBACK_COST_USD = 0.001;

const OPENAI_TEXT_PRICING: Record<string, TokenPricing> = {
  "gpt-4o-mini": {
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
  },
};

export function calculateOpenAICostUsd(
  model: string,
  inputTokens?: number,
  outputTokens?: number,
): number {
  if (inputTokens === undefined || outputTokens === undefined) {
    return FALLBACK_COST_USD;
  }

  const pricing = OPENAI_TEXT_PRICING[model];
  if (!pricing) {
    throw new Error(`Missing OpenAI pricing for model: ${model}`);
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (outputTokens / 1_000_000) * pricing.outputPerMillionUsd
  );
}
