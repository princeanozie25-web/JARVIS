import { z } from "zod";

import {
  FINAL_SYSTEM_PHASE_IDS,
  FINAL_SYSTEM_READINESS_CATEGORIES,
  FinalSystemAuthorityPostureValueSchema,
  FinalSystemDisabledFeatureSurfaceSchema,
  FinalSystemPackagingRelevanceSchema,
  FinalSystemPhaseIdSchema,
  FinalSystemReadinessCategorySchema,
  FinalSystemSummaryStatusSchema,
  type FinalSystemReadinessCategory,
  type FinalSystemStatusRecord,
  type FinalSystemSummaryStatus,
} from "./contracts";
import {
  buildFinalReadinessSummary,
  listAuthorityBearingFinalSystemSurfaces,
  listBlockedOrMissingFinalSystemItems,
  listDisabledFeatureFinalSystemSurfaces,
  listFinalSystemPhaseStatuses,
} from "./registry";

export const FINAL_READINESS_REPORT_VERSION = "20A.2" as const;

export const FINAL_READINESS_OVERALL_STATUSES = [
  "ready",
  "ready_with_notes",
  "blocked",
  "missing",
  "unknown",
] as const;

export const FINAL_READINESS_GOVERNANCE_VERDICTS = [
  "pass",
  "pass_with_notes",
  "fail",
] as const;

export type FinalReadinessOverallStatus =
  (typeof FINAL_READINESS_OVERALL_STATUSES)[number];
export type FinalReadinessGovernanceVerdictValue =
  (typeof FINAL_READINESS_GOVERNANCE_VERDICTS)[number];

export const FinalReadinessOverallStatusSchema = z.enum(
  FINAL_READINESS_OVERALL_STATUSES,
);
export const FinalReadinessGovernanceVerdictValueSchema = z.enum(
  FINAL_READINESS_GOVERNANCE_VERDICTS,
);

export const FinalReadinessReportSummarySchema = z.strictObject({
  overall_system_readiness: FinalReadinessOverallStatusSchema,
  completed_phase_count: z.number().int().nonnegative(),
  complete_with_notes_phase_count: z.number().int().nonnegative(),
  blocked_or_missing_phase_count: z.number().int().nonnegative(),
  authority_bearing_phase_count: z.number().int().nonnegative(),
  disabled_feature_surface_count: z.number().int().nonnegative(),
  statement: z.string().trim().min(1).max(360),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessPhaseCoverageSchema = z.strictObject({
  represented_phase_ids: z.array(FinalSystemPhaseIdSchema),
  completed_phase_ids: z.array(FinalSystemPhaseIdSchema),
  complete_with_notes_phase_ids: z.array(FinalSystemPhaseIdSchema),
  blocked_or_missing_phase_ids: z.array(FinalSystemPhaseIdSchema),
  all_core_phases_represented: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessCategorySectionSchema = z.strictObject({
  category: FinalSystemReadinessCategorySchema,
  status: FinalSystemSummaryStatusSchema,
  phase_ids: z.array(FinalSystemPhaseIdSchema),
  phase_count: z.number().int().nonnegative(),
  summary: z.string().trim().min(1).max(320),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessAuthoritySurfaceSchema = z.strictObject({
  phase_id: FinalSystemPhaseIdSchema,
  phase_name: z.string().trim().min(1).max(120),
  posture: FinalSystemAuthorityPostureValueSchema,
  governance_summary: z.string().trim().min(1).max(280),
  governance_refs: z.array(z.string().trim().min(1).max(260)).min(1),
  new_authority_surface_created_by_phase_20: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessDisabledFeatureSectionSchema = z.strictObject({
  phase_id: FinalSystemPhaseIdSchema,
  phase_name: z.string().trim().min(1).max(120),
  posture_summary: z.string().trim().min(1).max(280),
  surfaces: z.array(FinalSystemDisabledFeatureSurfaceSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessContextSectionSchema = z.strictObject({
  status: FinalSystemSummaryStatusSchema,
  phase_ids: z.array(FinalSystemPhaseIdSchema),
  relevance: z.array(FinalSystemPackagingRelevanceSchema),
  summary: z.string().trim().min(1).max(360),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessGovernanceVerdictSchema = z.strictObject({
  verdict: FinalReadinessGovernanceVerdictValueSchema,
  summary: z.string().trim().min(1).max(360),
  approval_bypass_detected: z.literal(false),
  new_phase20_capabilities_introduced: z.literal(false),
  execution_hooks_added: z.literal(false),
  provider_calls_enabled: z.literal(false),
  network_calls_enabled: z.literal(false),
  room_device_control_enabled: z.literal(false),
  raw_payloads_included: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalReadinessReportSchema = z.strictObject({
  report_version: z.literal(FINAL_READINESS_REPORT_VERSION),
  report_id: z.literal("phase-20a2-final-readiness-report"),
  generated_from: z.literal("final-system-status-registry"),
  summary: FinalReadinessReportSummarySchema,
  phase_coverage: FinalReadinessPhaseCoverageSchema,
  readiness_categories: z.array(FinalReadinessCategorySectionSchema),
  authority_surfaces: z.array(FinalReadinessAuthoritySurfaceSchema),
  disabled_features: z.array(FinalReadinessDisabledFeatureSectionSchema),
  packaging_readiness: FinalReadinessContextSectionSchema,
  move_in_readiness: FinalReadinessContextSectionSchema,
  portfolio_readiness: FinalReadinessContextSectionSchema,
  governance_verdict: FinalReadinessGovernanceVerdictSchema,
  deterministic: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  no_ui_route_added: z.literal(true),
  provider_calls_enabled: z.literal(false),
  network_calls_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  execution_hooks_added: z.literal(false),
  room_device_actions_enabled: z.literal(false),
  approval_bypass_enabled: z.literal(false),
  raw_payloads_included: z.literal(false),
  phase20_new_capabilities_introduced: z.literal(false),
});

export type FinalReadinessReportSummary = z.infer<
  typeof FinalReadinessReportSummarySchema
>;
export type FinalReadinessPhaseCoverage = z.infer<
  typeof FinalReadinessPhaseCoverageSchema
>;
export type FinalReadinessCategorySection = z.infer<
  typeof FinalReadinessCategorySectionSchema
>;
export type FinalReadinessAuthoritySurface = z.infer<
  typeof FinalReadinessAuthoritySurfaceSchema
>;
export type FinalReadinessDisabledFeatureSection = z.infer<
  typeof FinalReadinessDisabledFeatureSectionSchema
>;
export type FinalReadinessContextSection = z.infer<
  typeof FinalReadinessContextSectionSchema
>;
export type FinalReadinessGovernanceVerdict = z.infer<
  typeof FinalReadinessGovernanceVerdictSchema
>;
export type FinalReadinessReport = z.infer<typeof FinalReadinessReportSchema>;

function toOverallStatus(
  status: FinalSystemSummaryStatus,
): FinalReadinessOverallStatus {
  if (status === "clear") {
    return "ready";
  }

  if (status === "clear_with_notes") {
    return "ready_with_notes";
  }

  return status;
}

function statusForCategory(
  records: readonly FinalSystemStatusRecord[],
): FinalSystemSummaryStatus {
  if (records.some((record) => record.status === "blocked")) {
    return "blocked";
  }

  if (records.some((record) => record.status === "missing")) {
    return "missing";
  }

  if (records.some((record) => record.status === "unknown")) {
    return "unknown";
  }

  if (records.some((record) => record.status === "complete_with_notes")) {
    return "clear_with_notes";
  }

  return "clear";
}

function recordsForCategory(
  records: readonly FinalSystemStatusRecord[],
  category: FinalSystemReadinessCategory,
): readonly FinalSystemStatusRecord[] {
  return records.filter((record) =>
    record.readiness_categories.includes(category),
  );
}

function uniqueSortedValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function buildContextSection(
  records: readonly FinalSystemStatusRecord[],
  category: FinalSystemReadinessCategory,
  summary: string,
) {
  const categoryRecords = recordsForCategory(records, category);

  return FinalReadinessContextSectionSchema.parse({
    status: statusForCategory(categoryRecords),
    phase_ids: categoryRecords.map((record) => record.phase_id),
    relevance: uniqueSortedValues(
      categoryRecords.flatMap((record) => record.packaging_posture.relevance),
    ),
    summary,
    metadata_only: true,
    read_only: true,
  });
}

export function buildFinalReadinessReport(): FinalReadinessReport {
  const records = listFinalSystemPhaseStatuses();
  const readinessSummary = buildFinalReadinessSummary();
  const blockedOrMissing = listBlockedOrMissingFinalSystemItems();
  const authoritySurfaces = listAuthorityBearingFinalSystemSurfaces();
  const disabledFeatureRecords = listDisabledFeatureFinalSystemSurfaces();
  const completedPhaseIds = records
    .filter((record) => record.status === "complete")
    .map((record) => record.phase_id);
  const completeWithNotesPhaseIds = records
    .filter((record) => record.status === "complete_with_notes")
    .map((record) => record.phase_id);
  const overallStatus = toOverallStatus(readinessSummary.final_audit_status);

  return FinalReadinessReportSchema.parse({
    report_version: FINAL_READINESS_REPORT_VERSION,
    report_id: "phase-20a2-final-readiness-report",
    generated_from: "final-system-status-registry",
    summary: {
      overall_system_readiness: overallStatus,
      completed_phase_count: completedPhaseIds.length,
      complete_with_notes_phase_count: completeWithNotesPhaseIds.length,
      blocked_or_missing_phase_count: blockedOrMissing.length,
      authority_bearing_phase_count: authoritySurfaces.length,
      disabled_feature_surface_count:
        readinessSummary.disabled_feature_surface_count,
      statement:
        "JARVIS core phases 10-19 are represented for Phase 20 final integration with readiness notes, authority posture, disabled-feature posture, and packaging relevance.",
      metadata_only: true,
      read_only: true,
    },
    phase_coverage: {
      represented_phase_ids: records.map((record) => record.phase_id),
      completed_phase_ids: completedPhaseIds,
      complete_with_notes_phase_ids: completeWithNotesPhaseIds,
      blocked_or_missing_phase_ids: blockedOrMissing.map(
        (record) => record.phase_id,
      ),
      all_core_phases_represented:
        records.map((record) => record.phase_id).join("|") ===
        FINAL_SYSTEM_PHASE_IDS.join("|"),
      metadata_only: true,
      read_only: true,
    },
    readiness_categories: FINAL_SYSTEM_READINESS_CATEGORIES.map((category) => {
      const categoryRecords = recordsForCategory(records, category);

      return FinalReadinessCategorySectionSchema.parse({
        category,
        status: statusForCategory(categoryRecords),
        phase_ids: categoryRecords.map((record) => record.phase_id),
        phase_count: categoryRecords.length,
        summary: `${category} readiness is derived from ${categoryRecords.length} final-system-status records.`,
        metadata_only: true,
        read_only: true,
      });
    }),
    authority_surfaces: authoritySurfaces.map((record) =>
      FinalReadinessAuthoritySurfaceSchema.parse({
        phase_id: record.phase_id,
        phase_name: record.phase_name,
        posture: record.authority_posture.posture,
        governance_summary: record.authority_posture.governance_summary,
        governance_refs: record.authority_posture.governance_refs,
        new_authority_surface_created_by_phase_20:
          record.authority_posture.new_authority_surface_created_by_phase_20,
        metadata_only: true,
        read_only: true,
      }),
    ),
    disabled_features: disabledFeatureRecords.map((record) =>
      FinalReadinessDisabledFeatureSectionSchema.parse({
        phase_id: record.phase_id,
        phase_name: record.phase_name,
        posture_summary: record.disabled_feature_posture.summary,
        surfaces: record.disabled_feature_posture.surfaces,
        metadata_only: true,
        read_only: true,
      }),
    ),
    packaging_readiness: buildContextSection(
      records,
      "packaging",
      "Packaging readiness is clear with notes because runtime, desktop, audit, provider-configuration, demo, and safety-closeout relevance are represented, while packaging automation remains a later Phase 20 slice.",
    ),
    move_in_readiness: buildContextSection(
      records,
      "move_in",
      "Move-in readiness is clear with notes because bootstrap, persistence, Command Center, model, voice, vision, room adapter, scheduler, and approval-governance surfaces are represented for final audit.",
    ),
    portfolio_readiness: buildContextSection(
      records,
      "portfolio",
      "Portfolio readiness is clear with notes because Command Center, scheduled assistance, approval governance, and Phase 19 fortress visibility are represented without enabling new capabilities.",
    ),
    governance_verdict: {
      verdict:
        overallStatus === "ready"
          ? "pass"
          : overallStatus === "ready_with_notes"
            ? "pass_with_notes"
            : "fail",
      summary:
        "Final governance posture remains local-first, replay-safe, approval-gated, redaction-aware, metadata-only, and non-authoritative for Phase 20A.2.",
      approval_bypass_detected: false,
      new_phase20_capabilities_introduced: false,
      execution_hooks_added: false,
      provider_calls_enabled: false,
      network_calls_enabled: false,
      room_device_control_enabled: false,
      raw_payloads_included: false,
      metadata_only: true,
      read_only: true,
    },
    deterministic: true,
    metadata_only: true,
    read_only: true,
    no_ui_route_added: true,
    provider_calls_enabled: false,
    network_calls_enabled: false,
    filesystem_mutation_enabled: false,
    execution_hooks_added: false,
    room_device_actions_enabled: false,
    approval_bypass_enabled: false,
    raw_payloads_included: false,
    phase20_new_capabilities_introduced: false,
  });
}
