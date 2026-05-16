import { models } from "./registry";

export const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

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
});
