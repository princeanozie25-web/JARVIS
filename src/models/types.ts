import type { z } from "zod";
import type { ModelRegistryEntrySchema, ModelRegistrySchema } from "./schema";

export const MODEL_PROVIDER_KINDS = [
  "ollama",
  "anthropic",
  "openai",
  "mock",
] as const;

export const MODEL_TIERS = ["T1", "T2", "T3", "T4"] as const;

export const MODEL_CAPABILITIES = [
  "chat",
  "summarize",
  "classify",
  "embed",
  "vision",
  "tool_reasoning",
] as const;

export const MODEL_RUNTIME_CLASSES = ["local", "cloud", "mock"] as const;

export const MODEL_VISIBILITIES = ["enabled", "disabled"] as const;

export type ModelProviderKind = (typeof MODEL_PROVIDER_KINDS)[number];
export type ModelTier = (typeof MODEL_TIERS)[number];
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];
export type ModelRuntimeClass = (typeof MODEL_RUNTIME_CLASSES)[number];
export type ModelVisibility = (typeof MODEL_VISIBILITIES)[number];

export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;
export type ModelRegistry = z.infer<typeof ModelRegistrySchema>;
