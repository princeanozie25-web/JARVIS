export const PHASE_3D_FEATURE_IDS = [
  "preferences",
  "goals",
  "timeline",
  "memory_weighting",
  "conversation_curator",
  "reflection_prompts",
  "keeper_interface",
  "human_review_queue",
] as const;

export type ConsentFeatureId = (typeof PHASE_3D_FEATURE_IDS)[number];

export const PHASE_3D_FEATURE_LABELS: Record<ConsentFeatureId, string> = {
  preferences: "Preferences",
  goals: "Goals",
  timeline: "Timeline",
  memory_weighting: "Memory Weighting",
  conversation_curator: "Conversation Curator",
  reflection_prompts: "Reflection Prompts",
  keeper_interface: "Keeper Interface",
  human_review_queue: "Human Review Queue",
};

export const PHASE_3D_FEATURE_SCOPES: Record<ConsentFeatureId, string> = {
  preferences: "personal_preferences",
  goals: "personal_goals",
  timeline: "personal_timeline",
  memory_weighting: "memory_weighting",
  conversation_curator: "conversation_curation",
  reflection_prompts: "reflection_prompts",
  keeper_interface: "keeper_interface",
  human_review_queue: "human_review_queue",
};

export interface ConsentRecord {
  feature_id: ConsentFeatureId;
  enabled: boolean;
  scope: string;
  granted_at: string | null;
  granted_by: "user";
  revocable: true;
}

export interface ConsentManifest {
  version: 1;
  records: ConsentRecord[];
  updated_at: string;
}

export interface ConsentGateAllowed {
  ok: true;
  record: ConsentRecord;
}

export interface ConsentGateBlocked {
  ok: false;
  status: "blocked";
  featureId: ConsentFeatureId;
  reason: "consent_disabled";
}

export type ConsentGateResult = ConsentGateAllowed | ConsentGateBlocked;
