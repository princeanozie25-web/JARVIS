import { z } from "zod";

import {
  FINAL_SYSTEM_PHASE_IDS,
  FinalSystemPhaseIdSchema,
  FinalSystemReadinessCategorySchema,
} from "./contracts";

export const FINAL_DISABLED_FEATURE_MATRIX_VERSION = "20A.3" as const;

export const FINAL_DISABLED_FEATURE_IDS = [
  "disabled-feature:wake-word",
  "disabled-feature:always-listening",
  "disabled-feature:background-camera",
  "disabled-feature:hidden-capture",
  "disabled-feature:autonomous-device-execution",
  "disabled-feature:public-remote-dashboards",
  "disabled-feature:voice-only-approval",
  "disabled-feature:auto-approval",
  "disabled-feature:graph-driven-execution",
  "disabled-feature:raw-payload-telemetry-ui-exposure",
  "disabled-feature:remote-cloud-defaults",
  "disabled-feature:whole-home-multi-room",
  "disabled-feature:cai-non-whitelisted-targets",
  "disabled-feature:ui-run-retry-mutate-affordances",
  "disabled-feature:scheduler-side-effects",
  "disabled-feature:routine-chaining",
  "disabled-feature:unapproved-room-device-actions",
  "disabled-feature:ungoverned-provider-escalation",
] as const;

export const FINAL_DISABLED_FEATURE_CATEGORIES = [
  "voice_capture",
  "vision_capture",
  "authority_governance",
  "dashboard_ui",
  "telemetry_redaction",
  "provider_network",
  "room_scope",
  "red_team_sandbox",
  "scheduler_routines",
  "graph_governance",
] as const;

export const FINAL_DISABLED_FEATURE_ENFORCEMENT_POSTURES = [
  "disabled_by_policy",
  "forbidden_tripwire",
  "approval_governed_but_still_disabled",
  "local_first_opt_in_only",
  "sandbox_whitelist_required",
] as const;

export const FINAL_DISABLED_FEATURE_PHASE20_POSTURES = [
  "remains_disabled",
  "remains_disabled_until_future_governance",
] as const;

export type FinalDisabledFeatureId =
  (typeof FINAL_DISABLED_FEATURE_IDS)[number];
export type FinalDisabledFeatureCategory =
  (typeof FINAL_DISABLED_FEATURE_CATEGORIES)[number];
export type FinalDisabledFeatureEnforcementPosture =
  (typeof FINAL_DISABLED_FEATURE_ENFORCEMENT_POSTURES)[number];
export type FinalDisabledFeaturePhase20Posture =
  (typeof FINAL_DISABLED_FEATURE_PHASE20_POSTURES)[number];
export type FinalDisabledFeatureOriginatingPhase =
  | (typeof FINAL_SYSTEM_PHASE_IDS)[number]
  | "phase-20";

export const FinalDisabledFeatureIdSchema = z.enum(FINAL_DISABLED_FEATURE_IDS);
export const FinalDisabledFeatureCategorySchema = z.enum(
  FINAL_DISABLED_FEATURE_CATEGORIES,
);
export const FinalDisabledFeatureEnforcementPostureSchema = z.enum(
  FINAL_DISABLED_FEATURE_ENFORCEMENT_POSTURES,
);
export const FinalDisabledFeaturePhase20PostureSchema = z.enum(
  FINAL_DISABLED_FEATURE_PHASE20_POSTURES,
);
export const FinalDisabledFeatureOriginatingPhaseSchema = z.union([
  FinalSystemPhaseIdSchema,
  z.literal("phase-20"),
]);

export const FinalDisabledFeatureRecordSchema = z.strictObject({
  matrix_version: z.literal(FINAL_DISABLED_FEATURE_MATRIX_VERSION),
  feature_id: FinalDisabledFeatureIdSchema,
  label: z.string().trim().min(1).max(120),
  category: FinalDisabledFeatureCategorySchema,
  originating_phases: z
    .array(FinalDisabledFeatureOriginatingPhaseSchema)
    .min(1),
  disabled_reason: z.string().trim().min(1).max(320),
  enforcement_posture: FinalDisabledFeatureEnforcementPostureSchema,
  closeout_relevance: z.array(FinalSystemReadinessCategorySchema).min(1),
  final_phase20_posture: FinalDisabledFeaturePhase20PostureSchema,
  critical: z.boolean(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  creates_new_capability: z.literal(false),
  creates_new_authority: z.literal(false),
  adds_user_affordance: z.literal(false),
  performs_side_effect: z.literal(false),
  calls_provider: z.literal(false),
  calls_network: z.literal(false),
  includes_sensitive_material: z.literal(false),
});

export const FinalDisabledFeatureCategorySummarySchema = z.strictObject({
  category: FinalDisabledFeatureCategorySchema,
  feature_count: z.number().int().nonnegative(),
  critical_count: z.number().int().nonnegative(),
  feature_ids: z.array(FinalDisabledFeatureIdSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalDisabledFeaturePostureSummarySchema = z.strictObject({
  matrix_version: z.literal(FINAL_DISABLED_FEATURE_MATRIX_VERSION),
  feature_count: z.number().int().positive(),
  critical_feature_count: z.number().int().nonnegative(),
  category_summaries: z.array(FinalDisabledFeatureCategorySummarySchema),
  all_features_remain_disabled: z.literal(true),
  no_phase20_capability_created: z.literal(true),
  no_authority_created: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export type FinalDisabledFeatureRecord = z.infer<
  typeof FinalDisabledFeatureRecordSchema
>;
export type FinalDisabledFeatureCategorySummary = z.infer<
  typeof FinalDisabledFeatureCategorySummarySchema
>;
export type FinalDisabledFeaturePostureSummary = z.infer<
  typeof FinalDisabledFeaturePostureSummarySchema
>;

const MATRIX = [
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:wake-word",
    label: "Wake word",
    category: "voice_capture",
    originating_phases: ["phase-14", "phase-20"],
    disabled_reason:
      "Wake-word activation would create ambient microphone risk; Phase 14 and Phase 20 keep voice push-to-talk only.",
    enforcement_posture: "disabled_by_policy",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:always-listening",
    label: "Always-listening audio",
    category: "voice_capture",
    originating_phases: ["phase-14", "phase-20"],
    disabled_reason:
      "Always-listening would weaken visible capture and consent boundaries; capture remains explicit and bounded.",
    enforcement_posture: "disabled_by_policy",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:background-camera",
    label: "Background camera",
    category: "vision_capture",
    originating_phases: ["phase-15", "phase-20"],
    disabled_reason:
      "Background camera access would bypass user-initiated vision sessions; camera remains mock or explicitly requested.",
    enforcement_posture: "disabled_by_policy",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:hidden-capture",
    label: "Hidden capture",
    category: "vision_capture",
    originating_phases: ["phase-14", "phase-15", "phase-20"],
    disabled_reason:
      "Audio and vision capture must remain visible to the user; hidden capture is incompatible with consent posture.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: [
      "final_audit",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:autonomous-device-execution",
    label: "Autonomous device control",
    category: "authority_governance",
    originating_phases: ["phase-16", "phase-18", "phase-20"],
    disabled_reason:
      "Device changes require dry-run, approval, and verification; autonomous control would bypass the authority boundary.",
    enforcement_posture: "approval_governed_but_still_disabled",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:public-remote-dashboards",
    label: "Public or remote dashboards",
    category: "dashboard_ui",
    originating_phases: ["phase-12", "phase-19", "phase-20"],
    disabled_reason:
      "Audit and Command Center surfaces are local-only; public exposure would expand the trust boundary.",
    enforcement_posture: "disabled_by_policy",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:voice-only-approval",
    label: "Voice-only approval",
    category: "authority_governance",
    originating_phases: ["phase-14", "phase-18", "phase-20"],
    disabled_reason:
      "Voice transport cannot approve side effects; approvals require governed review outside the voice channel.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: [
      "final_audit",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:auto-approval",
    label: "Auto-approval",
    category: "authority_governance",
    originating_phases: ["phase-18", "phase-20"],
    disabled_reason:
      "Approval must remain explicit, bounded, expiring, and reviewable; automatic approval is forbidden.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:graph-driven-execution",
    label: "Graph-driven control",
    category: "graph_governance",
    originating_phases: ["phase-12", "phase-19", "phase-20"],
    disabled_reason:
      "Architecture, governance, replay, and dependency graphs are inspection surfaces only.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: ["final_audit", "portfolio", "disabled_feature_matrix"],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:raw-payload-telemetry-ui-exposure",
    label: "Unredacted telemetry or UI exposure",
    category: "telemetry_redaction",
    originating_phases: [
      "phase-11",
      "phase-12",
      "phase-14",
      "phase-15",
      "phase-19",
      "phase-20",
    ],
    disabled_reason:
      "Telemetry and UI surfaces must expose metadata and redacted summaries only, never sensitive source material.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:remote-cloud-defaults",
    label: "Remote/cloud defaults",
    category: "provider_network",
    originating_phases: [
      "phase-13",
      "phase-14",
      "phase-15",
      "phase-16",
      "phase-20",
    ],
    disabled_reason:
      "Cloud providers and remote device paths require explicit opt-in, budget, consent, and governance; local-first remains default.",
    enforcement_posture: "local_first_opt_in_only",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "onboarding",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled_until_future_governance",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:whole-home-multi-room",
    label: "Whole-home or multi-room control",
    category: "room_scope",
    originating_phases: ["phase-16", "phase-20"],
    disabled_reason:
      "Room control remains scoped and individually governed; whole-home authority is deferred beyond Phase 20.",
    enforcement_posture: "disabled_by_policy",
    closeout_relevance: [
      "final_audit",
      "move_in",
      "onboarding",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled_until_future_governance",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:cai-non-whitelisted-targets",
    label: "CAI non-whitelisted targets",
    category: "red_team_sandbox",
    originating_phases: ["phase-19", "phase-20"],
    disabled_reason:
      "Red-team actions remain sandboxed, whitelist-bound, and approval-governed; non-whitelisted targets are denied.",
    enforcement_posture: "sandbox_whitelist_required",
    closeout_relevance: ["final_audit", "portfolio", "disabled_feature_matrix"],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:ui-run-retry-mutate-affordances",
    label: "UI run/retry/mutate controls",
    category: "dashboard_ui",
    originating_phases: ["phase-12", "phase-19", "phase-20"],
    disabled_reason:
      "Read-only dashboards may inspect but must not present direct controls for state changes or reruns.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: ["final_audit", "portfolio", "disabled_feature_matrix"],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:scheduler-side-effects",
    label: "Scheduler side effects",
    category: "scheduler_routines",
    originating_phases: ["phase-17", "phase-20"],
    disabled_reason:
      "Scheduled assistance may produce suggestions and reports only; it cannot trigger side effects.",
    enforcement_posture: "forbidden_tripwire",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:routine-chaining",
    label: "Routine chaining",
    category: "scheduler_routines",
    originating_phases: ["phase-17", "phase-20"],
    disabled_reason:
      "One scheduled suggestion must not trigger another routine or compound unattended behavior.",
    enforcement_posture: "disabled_by_policy",
    closeout_relevance: ["final_audit", "move_in", "disabled_feature_matrix"],
    final_phase20_posture: "remains_disabled",
    critical: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:unapproved-room-device-actions",
    label: "Unapproved room/device actions",
    category: "authority_governance",
    originating_phases: ["phase-16", "phase-18", "phase-20"],
    disabled_reason:
      "Room and device actions require explicit approval lifecycle binding before any governed adapter may act.",
    enforcement_posture: "approval_governed_but_still_disabled",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "portfolio",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
  {
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_id: "disabled-feature:ungoverned-provider-escalation",
    label: "Ungoverned provider escalation",
    category: "provider_network",
    originating_phases: ["phase-13", "phase-14", "phase-15", "phase-20"],
    disabled_reason:
      "Provider escalation cannot silently move from local to cloud or from lower-risk to higher-risk providers.",
    enforcement_posture: "local_first_opt_in_only",
    closeout_relevance: [
      "final_audit",
      "packaging",
      "move_in",
      "disabled_feature_matrix",
    ],
    final_phase20_posture: "remains_disabled_until_future_governance",
    critical: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_new_capability: false,
    creates_new_authority: false,
    adds_user_affordance: false,
    performs_side_effect: false,
    calls_provider: false,
    calls_network: false,
    includes_sensitive_material: false,
  },
] satisfies readonly FinalDisabledFeatureRecord[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyFeature(
  feature: FinalDisabledFeatureRecord,
): FinalDisabledFeatureRecord {
  return FinalDisabledFeatureRecordSchema.parse(
    JSON.parse(JSON.stringify(feature)),
  );
}

function copyFeatures(
  features: readonly FinalDisabledFeatureRecord[],
): FinalDisabledFeatureRecord[] {
  return features.map(copyFeature);
}

export const FINAL_DISABLED_FEATURE_MATRIX = deepFreeze(
  FinalDisabledFeatureRecordSchema.array().parse(MATRIX),
);

export function getFinalDisabledFeatureMatrix(): readonly FinalDisabledFeatureRecord[] {
  return copyFeatures(FINAL_DISABLED_FEATURE_MATRIX);
}

export function getDisabledFeaturesByCategory(
  category: FinalDisabledFeatureCategory,
): readonly FinalDisabledFeatureRecord[] {
  return copyFeatures(
    FINAL_DISABLED_FEATURE_MATRIX.filter(
      (feature) => feature.category === category,
    ),
  );
}

export function getCriticalDisabledFeatures(): readonly FinalDisabledFeatureRecord[] {
  return copyFeatures(
    FINAL_DISABLED_FEATURE_MATRIX.filter((feature) => feature.critical),
  );
}

export function summarizeDisabledFeaturePosture(): FinalDisabledFeaturePostureSummary {
  const categorySummaries = FINAL_DISABLED_FEATURE_CATEGORIES.map(
    (category) => {
      const features = FINAL_DISABLED_FEATURE_MATRIX.filter(
        (feature) => feature.category === category,
      );

      return FinalDisabledFeatureCategorySummarySchema.parse({
        category,
        feature_count: features.length,
        critical_count: features.filter((feature) => feature.critical).length,
        feature_ids: features.map((feature) => feature.feature_id),
        metadata_only: true,
        read_only: true,
      });
    },
  );

  return FinalDisabledFeaturePostureSummarySchema.parse({
    matrix_version: FINAL_DISABLED_FEATURE_MATRIX_VERSION,
    feature_count: FINAL_DISABLED_FEATURE_MATRIX.length,
    critical_feature_count: getCriticalDisabledFeatures().length,
    category_summaries: categorySummaries,
    all_features_remain_disabled: true,
    no_phase20_capability_created: true,
    no_authority_created: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
  });
}
