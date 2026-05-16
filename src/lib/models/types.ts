import type { ProviderId } from "../providers/types";

export type ModelTier = "T0" | "T1" | "T2" | "T3" | "T4";

export type ModelCapability = "text" | "stream" | "tools" | "vision";

export interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export interface ModelEntry {
  id: string;
  provider: ProviderId;
  modelName: string;
  tier: ModelTier;
  capabilities: ModelCapability[];
  enabled: boolean;
  pricing?: ModelPricing;
}
