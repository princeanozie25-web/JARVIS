import { z } from "zod";

import type { ModelCapability, ModelEntry, ModelTier } from "../models";

export const AUX_TASK_KINDS = [
  "session_title",
  "summary",
  "keyword_extract",
  "paraphrase",
  "vision_preprocess",
  "intent_assist",
] as const;

export const AUX_MODEL_PREFERENCES = ["cheapest", "fastest"] as const;

export const AuxTaskKindSchema = z.enum(AUX_TASK_KINDS);
export const AuxModelPreferenceSchema = z.enum(AUX_MODEL_PREFERENCES);

export const AuxRequirementSchema = z.strictObject({
  minTier: z.enum(["T0", "T1", "T2", "T3", "T4"]),
  maxTier: z.enum(["T0", "T1", "T2", "T3", "T4"]),
  requires: z.array(z.enum(["text", "stream", "tools", "vision"])).min(1),
  prefer: AuxModelPreferenceSchema,
});

export type AuxTaskKind = z.infer<typeof AuxTaskKindSchema>;
export type AuxModelPreference = z.infer<typeof AuxModelPreferenceSchema>;
export type AuxRequirement = Omit<
  z.infer<typeof AuxRequirementSchema>,
  "minTier" | "maxTier" | "requires"
> & {
  readonly minTier: ModelTier;
  readonly maxTier: ModelTier;
  readonly requires: readonly ModelCapability[];
};

export interface AuxModelResolution {
  readonly kind: AuxTaskKind;
  readonly requirement: AuxRequirement;
  readonly safety: {
    readonly safetyTag: "ALLOW" | "CONFIRM_ONCE" | "CONFIRM_ALWAYS" | "BLOCK";
    readonly reason: string;
  };
  readonly selection: {
    readonly providerId: ModelEntry["provider"];
    readonly model: ModelEntry;
    readonly reason: string;
  };
  readonly fallback_used: boolean;
  readonly fallback_reason: string | null;
  readonly logged: readonly string[];
}

export interface AuxQualityAccepted {
  readonly status: "accepted";
  readonly kind: AuxTaskKind;
  readonly model: ModelEntry;
}

export interface AuxQualityEscalation {
  readonly status: "escalated";
  readonly kind: AuxTaskKind;
  readonly reason: "schema_validation_failed";
  readonly from_model: ModelEntry;
  readonly to_model: ModelEntry;
  readonly maxTier: ModelTier;
  readonly silent: false;
}

export interface AuxQualityBlocked {
  readonly status: "blocked";
  readonly kind: AuxTaskKind;
  readonly reason: "schema_validation_failed_at_max_tier";
  readonly model: ModelEntry;
  readonly maxTier: ModelTier;
  readonly silent: false;
}

export type AuxQualityResult =
  | AuxQualityAccepted
  | AuxQualityEscalation
  | AuxQualityBlocked;
