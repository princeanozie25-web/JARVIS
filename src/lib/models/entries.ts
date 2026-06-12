import { models } from "./registry";

export const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

models.register({
  id: "anthropic/claude-haiku-title-aux",
  provider: "anthropic",
  modelName: "claude-haiku-title-aux",
  tier: "T1",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 0.2,
    outputPerMillionUsd: 0.8,
  },
});

models.register({
  id: "anthropic/claude-haiku-summary-aux",
  provider: "anthropic",
  modelName: "claude-haiku-summary-aux",
  tier: "T2",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 0.5,
    outputPerMillionUsd: 2,
  },
});

models.register({
  id: "openai/gpt-4o-mini",
  provider: "openai",
  modelName: "gpt-4o-mini",
  tier: "T3",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
  },
});

models.register({
  id: "anthropic/claude-haiku-4-5",
  provider: "anthropic",
  modelName: "claude-haiku-4-5-20251001",
  tier: "T3",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 1.0,
    outputPerMillionUsd: 5.0,
  },
});

// Phase 23A: no production T4 entry is registered by design. T4 is the
// frontier multimodal class (see ModelTier in ./types.ts); instantiating it
// later is registry data only and requires no phase change.
