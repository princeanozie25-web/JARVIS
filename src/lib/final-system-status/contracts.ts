import { z } from "zod";

export const FINAL_SYSTEM_STATUS_CONTRACT_VERSION = "20A.1" as const;

export const FINAL_SYSTEM_PHASE_IDS = [
  "phase-10",
  "phase-11",
  "phase-12",
  "phase-13",
  "phase-14",
  "phase-15",
  "phase-16",
  "phase-17",
  "phase-18",
  "phase-19",
] as const;

export const FINAL_SYSTEM_STATUS_VALUES = [
  "complete",
  "complete_with_notes",
  "blocked",
  "missing",
  "unknown",
] as const;

export const FINAL_SYSTEM_READINESS_CATEGORIES = [
  "final_audit",
  "packaging",
  "move_in",
  "onboarding",
  "portfolio",
  "disabled_feature_matrix",
] as const;

export const FINAL_SYSTEM_AUTHORITY_POSTURES = [
  "no_authority_surface",
  "read_only_or_inert",
  "approval_governed_only",
  "sandboxed_governance_required",
] as const;

export const FINAL_SYSTEM_DISABLED_FEATURE_POSTURES = [
  "no_risky_surface",
  "disabled_by_default",
  "disabled_until_explicit_enablement",
  "governed_sandbox_only",
] as const;

export const FINAL_SYSTEM_PACKAGING_RELEVANCE = [
  "runtime_dependency",
  "local_bootstrap",
  "desktop_shell",
  "audit_surface",
  "hardware_onboarding",
  "provider_configuration",
  "demo_story",
  "safety_closeout",
] as const;

export const FINAL_SYSTEM_SUMMARY_STATUSES = [
  "clear",
  "clear_with_notes",
  "blocked",
  "missing",
  "unknown",
] as const;

export type FinalSystemPhaseId = (typeof FINAL_SYSTEM_PHASE_IDS)[number];
export type FinalSystemStatusValue =
  (typeof FINAL_SYSTEM_STATUS_VALUES)[number];
export type FinalSystemReadinessCategory =
  (typeof FINAL_SYSTEM_READINESS_CATEGORIES)[number];
export type FinalSystemAuthorityPosture =
  (typeof FINAL_SYSTEM_AUTHORITY_POSTURES)[number];
export type FinalSystemDisabledFeaturePosture =
  (typeof FINAL_SYSTEM_DISABLED_FEATURE_POSTURES)[number];
export type FinalSystemPackagingRelevance =
  (typeof FINAL_SYSTEM_PACKAGING_RELEVANCE)[number];
export type FinalSystemSummaryStatus =
  (typeof FINAL_SYSTEM_SUMMARY_STATUSES)[number];

export const FinalSystemPhaseIdSchema = z.enum(FINAL_SYSTEM_PHASE_IDS);
export const FinalSystemStatusValueSchema = z.enum(FINAL_SYSTEM_STATUS_VALUES);
export const FinalSystemReadinessCategorySchema = z.enum(
  FINAL_SYSTEM_READINESS_CATEGORIES,
);
export const FinalSystemAuthorityPostureValueSchema = z.enum(
  FINAL_SYSTEM_AUTHORITY_POSTURES,
);
export const FinalSystemDisabledFeaturePostureValueSchema = z.enum(
  FINAL_SYSTEM_DISABLED_FEATURE_POSTURES,
);
export const FinalSystemPackagingRelevanceSchema = z.enum(
  FINAL_SYSTEM_PACKAGING_RELEVANCE,
);
export const FinalSystemSummaryStatusSchema = z.enum(
  FINAL_SYSTEM_SUMMARY_STATUSES,
);

export const FinalSystemEvidenceSchema = z.strictObject({
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-(1[0-9])-evidence:[a-z0-9._:-]+$/),
  source_ref: z.string().trim().min(1).max(260),
  summary: z.string().trim().min(1).max(280),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_payload_included: z.literal(false),
});

export const FinalSystemAuthorityPostureSchema = z.strictObject({
  authority_bearing: z.boolean(),
  posture: FinalSystemAuthorityPostureValueSchema,
  governance_summary: z.string().trim().min(1).max(280),
  governance_refs: z.array(z.string().trim().min(1).max(260)).min(1),
  new_authority_surface_created_by_phase_20: z.literal(false),
});

export const FinalSystemDisabledFeatureSurfaceSchema = z.strictObject({
  surface_id: z
    .string()
    .trim()
    .regex(/^disabled-surface:[a-z0-9._:-]+$/),
  summary: z.string().trim().min(1).max(240),
  remains_disabled: z.literal(true),
  enablement_requires_future_governance: z.literal(true),
});

export const FinalSystemDisabledFeaturePostureSchema = z.strictObject({
  posture: FinalSystemDisabledFeaturePostureValueSchema,
  surfaces: z.array(FinalSystemDisabledFeatureSurfaceSchema),
  summary: z.string().trim().min(1).max(280),
});

export const FinalSystemPackagingPostureSchema = z.strictObject({
  relevance: z.array(FinalSystemPackagingRelevanceSchema).min(1),
  readiness_categories: z.array(FinalSystemReadinessCategorySchema).min(1),
  summary: z.string().trim().min(1).max(280),
});

export const FinalSystemStatusRecordSchema = z.strictObject({
  contract_version: z.literal(FINAL_SYSTEM_STATUS_CONTRACT_VERSION),
  phase_id: FinalSystemPhaseIdSchema,
  phase_name: z.string().trim().min(1).max(120),
  status: FinalSystemStatusValueSchema,
  status_summary: z.string().trim().min(1).max(280),
  evidence: z.array(FinalSystemEvidenceSchema).min(1),
  readiness_categories: z.array(FinalSystemReadinessCategorySchema).min(1),
  authority_posture: FinalSystemAuthorityPostureSchema,
  disabled_feature_posture: FinalSystemDisabledFeaturePostureSchema,
  packaging_posture: FinalSystemPackagingPostureSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  provider_calls_enabled: z.literal(false),
  network_calls_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  route_added: z.literal(false),
  routine_execution_enabled: z.literal(false),
  room_device_control_enabled: z.literal(false),
  raw_payload_included: z.literal(false),
  phase20_new_capability_introduced: z.literal(false),
});

export const FinalSystemPhaseStatusCountsSchema = z.strictObject({
  complete: z.number().int().nonnegative(),
  complete_with_notes: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

export const FinalSystemPhase20CapabilityPostureSchema = z.strictObject({
  new_capabilities_introduced: z.literal(false),
  new_authority_surface_created: z.literal(false),
  execution_hooks_added: z.literal(false),
  provider_calls_enabled: z.literal(false),
  network_calls_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  route_added: z.literal(false),
  room_device_control_enabled: z.literal(false),
});

export const FinalReadinessSummarySchema = z.strictObject({
  contract_version: z.literal(FINAL_SYSTEM_STATUS_CONTRACT_VERSION),
  phase_count: z.number().int().positive(),
  represented_phase_ids: z.array(FinalSystemPhaseIdSchema),
  status_counts: FinalSystemPhaseStatusCountsSchema,
  final_audit_status: FinalSystemSummaryStatusSchema,
  packaging_status: FinalSystemSummaryStatusSchema,
  move_in_status: FinalSystemSummaryStatusSchema,
  onboarding_status: FinalSystemSummaryStatusSchema,
  portfolio_status: FinalSystemSummaryStatusSchema,
  blocked_or_missing_count: z.number().int().nonnegative(),
  authority_bearing_phase_count: z.number().int().nonnegative(),
  disabled_feature_surface_count: z.number().int().nonnegative(),
  phase20_capability_posture: FinalSystemPhase20CapabilityPostureSchema,
  summary: z.string().trim().min(1).max(320),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_payload_included: z.literal(false),
});

export type FinalSystemEvidence = z.infer<typeof FinalSystemEvidenceSchema>;
export type FinalSystemAuthorityPostureRecord = z.infer<
  typeof FinalSystemAuthorityPostureSchema
>;
export type FinalSystemDisabledFeatureSurface = z.infer<
  typeof FinalSystemDisabledFeatureSurfaceSchema
>;
export type FinalSystemDisabledFeaturePostureRecord = z.infer<
  typeof FinalSystemDisabledFeaturePostureSchema
>;
export type FinalSystemPackagingPosture = z.infer<
  typeof FinalSystemPackagingPostureSchema
>;
export type FinalSystemStatusRecord = z.infer<
  typeof FinalSystemStatusRecordSchema
>;
export type FinalSystemPhaseStatusCounts = z.infer<
  typeof FinalSystemPhaseStatusCountsSchema
>;
export type FinalSystemPhase20CapabilityPosture = z.infer<
  typeof FinalSystemPhase20CapabilityPostureSchema
>;
export type FinalReadinessSummary = z.infer<typeof FinalReadinessSummarySchema>;
