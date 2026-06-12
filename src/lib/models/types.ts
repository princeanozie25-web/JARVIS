import type { ProviderId } from "../providers/types";

/**
 * ModelTier ranks MODEL CAPABILITY (routing/cost class). It is distinct from
 * the action-authority tiers T0-T3 in src/lib/voice-operating-mode/authority.ts,
 * which govern what an ACTION may do without human approval.
 *
 * T4 (Phase 23A semantics): frontier multimodal reasoning class — native
 * image+audio+text input with long-context cross-modal synthesis. No
 * production entry instantiates T4 yet; registering one later is registry
 * data only and requires no phase change.
 *
 * Minimum-capability rule: a model_tier enum in an analysis packet (e.g. the
 * social-extraction z.enum(["T3","T4"])) is a FLOOR, not a pin — the resolver
 * selects the lowest qualifying tier >= T3 per aux-routing and cost rules.
 */
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
