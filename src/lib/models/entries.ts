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

// E-037 (Phase 25B-1): the M1 Max brain (E-035). Priced at 0 — local is
// free, and the pricing fallback would otherwise book a fictitious
// $0.001/call. Registered first so `getDefaultForProvider("ollama")` picks
// the workhorse. The "tools" CAPABILITY FLAG is deliberately not declared
// here: in this legacy catalog it selects the T0 tool-executor tier, which
// the frozen router battery pins to "no executable tool path yet". Tool
// metadata is still offered on every stream (the route attaches it), and the
// fit gate proved both models make structured calls.
models.register({
  id: "ollama/qwen3.5-9b-mlx",
  provider: "ollama",
  modelName: "qwen3.5:9b-mlx",
  tier: "T3",
  capabilities: ["text", "stream", "vision"],
  enabled: true,
  pricing: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
});

models.register({
  id: "ollama/qwen3.5-27b-mlx",
  provider: "ollama",
  modelName: "qwen3.5:27b-mlx",
  tier: "T3",
  capabilities: ["text", "stream", "vision"],
  enabled: true,
  pricing: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
});

// Phase 23A: no production T4 entry is registered by design. T4 is the
// frontier multimodal class (see ModelTier in ./types.ts); instantiating it
// later is registry data only and requires no phase change.
