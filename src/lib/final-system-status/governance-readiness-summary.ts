import { z } from "zod";

import { FINAL_SYSTEM_PHASE_IDS, FinalSystemPhaseIdSchema } from "./contracts";
import { buildFinalReadinessReport, type FinalReadinessReport } from "./report";
import {
  getCriticalDisabledFeatures,
  summarizeDisabledFeaturePosture,
} from "./disabled-feature-matrix";
import {
  getAuthoritySurfacesRequiringApproval,
  getExecutableAuthoritySurfaces,
  getFinalAuthoritySurfaceInventory,
  getNetworkCapableAuthoritySurfaces,
  summarizeAuthoritySurfacePosture,
} from "./authority-surface-inventory";
import {
  buildFinalReadinessSummary,
  listBlockedOrMissingFinalSystemItems,
  listFinalSystemPhaseStatuses,
} from "./registry";

export const FINAL_GOVERNANCE_READINESS_SUMMARY_VERSION = "20A.5" as const;

export const FINAL_GOVERNANCE_READINESS_VERDICTS = [
  "governance_ready_for_phase20_hardening",
  "governance_ready_with_notes",
  "governance_blocked",
] as const;

export type FinalGovernanceReadinessVerdict =
  (typeof FINAL_GOVERNANCE_READINESS_VERDICTS)[number];

export const FinalGovernanceReadinessVerdictSchema = z.enum(
  FINAL_GOVERNANCE_READINESS_VERDICTS,
);

export const FinalGovernanceEvidenceIdSchema = z.enum([
  "phase-20a1:final-system-status-registry",
  "phase-20a2:final-readiness-report",
  "phase-20a3:final-disabled-feature-matrix",
  "phase-20a4:final-authority-surface-inventory",
] as const);

export const FinalGovernancePhaseCoverageSummarySchema = z.strictObject({
  phases_10_19_represented: z.literal(true),
  represented_phase_ids: z.array(FinalSystemPhaseIdSchema),
  registry_phase_count: z.number().int().positive(),
  report_phase_count: z.number().int().positive(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceBlockedMissingSummarySchema = z.strictObject({
  blocked_or_missing_count: z.number().int().nonnegative(),
  blocked_or_missing_phase_ids: z.array(FinalSystemPhaseIdSchema),
  none_reported_unless_registry_reports_them: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceDisabledFeatureSummarySchema = z.strictObject({
  feature_count: z.number().int().positive(),
  critical_feature_count: z.number().int().nonnegative(),
  all_features_remain_disabled: z.literal(true),
  all_critical_features_remain_disabled: z.literal(true),
  no_phase20_capability_created_by_matrix: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceAuthoritySurfaceSummarySchema = z.strictObject({
  surface_count: z.number().int().positive(),
  authority_surfaces_documented: z.literal(true),
  approval_required_surface_count: z.number().int().nonnegative(),
  execution_capable_surface_count: z.number().int().nonnegative(),
  network_capable_surface_count: z.number().int().nonnegative(),
  new_authority_surface_count: z.literal(0),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceApprovalSummarySchema = z.strictObject({
  execution_capable_surfaces_have_governance_posture: z.literal(true),
  auto_approval_surface_count: z.literal(0),
  auto_approval_posture_present: z.literal(false),
  approval_required_surface_ids: z.array(z.string().trim().min(1).max(120)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceNetworkSummarySchema = z.strictObject({
  network_capable_surfaces_governed: z.literal(true),
  network_capable_surface_ids: z.array(z.string().trim().min(1).max(120)),
  allowed_network_postures: z.array(z.string().trim().min(1).max(80)).min(1),
  network_calls_performed: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceSourceMaterialSummarySchema = z.strictObject({
  source_material_allowed_surface_count: z.literal(0),
  source_material_allowed_posture_present: z.literal(false),
  redaction_or_metadata_only_posture: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceCapabilityNeutralitySummarySchema = z.strictObject({
  phase20_capability_neutral: z.literal(true),
  no_new_phase20_capability: z.literal(true),
  no_new_authority_surface: z.literal(true),
  no_provider_call: z.literal(true),
  no_network_call: z.literal(true),
  no_runtime_filesystem_mutation: z.literal(true),
  no_execution_hook: z.literal(true),
  no_room_device_action: z.literal(true),
  no_approval_bypass: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const FinalGovernanceReadinessSummarySchema = z.strictObject({
  summary_version: z.literal(FINAL_GOVERNANCE_READINESS_SUMMARY_VERSION),
  summary_id: z.literal("phase-20a5-final-governance-readiness-summary"),
  derived_from: z.array(FinalGovernanceEvidenceIdSchema),
  verdict: FinalGovernanceReadinessVerdictSchema,
  governance_ready_for_phase20_hardening: z.boolean(),
  phase_coverage: FinalGovernancePhaseCoverageSummarySchema,
  blocked_missing: FinalGovernanceBlockedMissingSummarySchema,
  disabled_features: FinalGovernanceDisabledFeatureSummarySchema,
  authority_surfaces: FinalGovernanceAuthoritySurfaceSummarySchema,
  approval_governance: FinalGovernanceApprovalSummarySchema,
  network_governance: FinalGovernanceNetworkSummarySchema,
  source_material: FinalGovernanceSourceMaterialSummarySchema,
  capability_neutrality: FinalGovernanceCapabilityNeutralitySummarySchema,
  notes: z.array(z.string().trim().min(1).max(260)),
  evidence_ids: z.array(FinalGovernanceEvidenceIdSchema),
  deterministic: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export type FinalGovernanceEvidenceId = z.infer<
  typeof FinalGovernanceEvidenceIdSchema
>;
export type FinalGovernancePhaseCoverageSummary = z.infer<
  typeof FinalGovernancePhaseCoverageSummarySchema
>;
export type FinalGovernanceBlockedMissingSummary = z.infer<
  typeof FinalGovernanceBlockedMissingSummarySchema
>;
export type FinalGovernanceDisabledFeatureSummary = z.infer<
  typeof FinalGovernanceDisabledFeatureSummarySchema
>;
export type FinalGovernanceAuthoritySurfaceSummary = z.infer<
  typeof FinalGovernanceAuthoritySurfaceSummarySchema
>;
export type FinalGovernanceApprovalSummary = z.infer<
  typeof FinalGovernanceApprovalSummarySchema
>;
export type FinalGovernanceNetworkSummary = z.infer<
  typeof FinalGovernanceNetworkSummarySchema
>;
export type FinalGovernanceSourceMaterialSummary = z.infer<
  typeof FinalGovernanceSourceMaterialSummarySchema
>;
export type FinalGovernanceCapabilityNeutralitySummary = z.infer<
  typeof FinalGovernanceCapabilityNeutralitySummarySchema
>;
export type FinalGovernanceReadinessSummary = z.infer<
  typeof FinalGovernanceReadinessSummarySchema
>;

const EVIDENCE_IDS: readonly FinalGovernanceEvidenceId[] = [
  "phase-20a1:final-system-status-registry",
  "phase-20a2:final-readiness-report",
  "phase-20a3:final-disabled-feature-matrix",
  "phase-20a4:final-authority-surface-inventory",
] as const;

function phasesRepresented(report: FinalReadinessReport): boolean {
  return (
    listFinalSystemPhaseStatuses()
      .map((record) => record.phase_id)
      .join("|") === FINAL_SYSTEM_PHASE_IDS.join("|") &&
    report.phase_coverage.represented_phase_ids.join("|") ===
      FINAL_SYSTEM_PHASE_IDS.join("|")
  );
}

function criticalFeaturesRemainDisabled(): boolean {
  return getCriticalDisabledFeatures().every(
    (feature) =>
      feature.final_phase20_posture.startsWith("remains_disabled") &&
      !feature.creates_new_capability &&
      !feature.creates_new_authority &&
      !feature.adds_user_affordance &&
      !feature.performs_side_effect,
  );
}

function executableSurfacesHaveGovernance(): boolean {
  return getExecutableAuthoritySurfaces().every(
    (surface) =>
      surface.approval_requirement !== "disabled_no_approval_path" &&
      (surface.approval_requirement !== "not_applicable" ||
        /governance|governed|local-first|redaction|cost|advisory/i.test(
          surface.governance_notes,
        )),
  );
}

function networkSurfacesAreGoverned(): boolean {
  return getNetworkCapableAuthoritySurfaces().every((surface) =>
    [
      "lan_local_only",
      "cloud_disabled_by_default",
      "cloud_opt_in_gated",
      "sandbox_whitelist_only",
    ].includes(surface.network_posture),
  );
}

export function buildFinalGovernanceReadinessSummary(): FinalGovernanceReadinessSummary {
  const readinessReport = buildFinalReadinessReport();
  const readinessSummary = buildFinalReadinessSummary();
  const blockedOrMissing = listBlockedOrMissingFinalSystemItems();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const authoritySummary = summarizeAuthoritySurfacePosture();
  const authorityInventory = getFinalAuthoritySurfaceInventory();
  const approvalRequired = getAuthoritySurfacesRequiringApproval();
  const networkSurfaces = getNetworkCapableAuthoritySurfaces();
  const allPhasesRepresented = phasesRepresented(readinessReport);
  const criticalDisabled = criticalFeaturesRemainDisabled();
  const executableGoverned = executableSurfacesHaveGovernance();
  const networkGoverned = networkSurfacesAreGoverned();
  const autoApprovalCount = authorityInventory.filter(
    (surface) => surface.auto_approval_allowed,
  ).length;
  const sourceMaterialAllowedCount = authorityInventory.filter((surface) =>
    surface.raw_payload_posture.includes("allowed"),
  ).length;
  const capabilityNeutral =
    readinessSummary.phase20_capability_posture.new_capabilities_introduced ===
      false &&
    readinessReport.phase20_new_capabilities_introduced === false &&
    disabledFeatureSummary.no_phase20_capability_created &&
    authoritySummary.new_authority_surface_count === 0;
  const governanceReady =
    allPhasesRepresented &&
    blockedOrMissing.length === 0 &&
    disabledFeatureSummary.all_features_remain_disabled &&
    criticalDisabled &&
    authorityInventory.length > 0 &&
    executableGoverned &&
    networkGoverned &&
    autoApprovalCount === 0 &&
    sourceMaterialAllowedCount === 0 &&
    capabilityNeutral;

  return FinalGovernanceReadinessSummarySchema.parse({
    summary_version: FINAL_GOVERNANCE_READINESS_SUMMARY_VERSION,
    summary_id: "phase-20a5-final-governance-readiness-summary",
    derived_from: [...EVIDENCE_IDS],
    verdict: governanceReady
      ? "governance_ready_for_phase20_hardening"
      : "governance_blocked",
    governance_ready_for_phase20_hardening: governanceReady,
    phase_coverage: {
      phases_10_19_represented: allPhasesRepresented,
      represented_phase_ids: [...FINAL_SYSTEM_PHASE_IDS],
      registry_phase_count: listFinalSystemPhaseStatuses().length,
      report_phase_count:
        readinessReport.phase_coverage.represented_phase_ids.length,
      metadata_only: true,
      read_only: true,
    },
    blocked_missing: {
      blocked_or_missing_count: blockedOrMissing.length,
      blocked_or_missing_phase_ids: blockedOrMissing.map(
        (record) => record.phase_id,
      ),
      none_reported_unless_registry_reports_them: true,
      metadata_only: true,
      read_only: true,
    },
    disabled_features: {
      feature_count: disabledFeatureSummary.feature_count,
      critical_feature_count: disabledFeatureSummary.critical_feature_count,
      all_features_remain_disabled:
        disabledFeatureSummary.all_features_remain_disabled,
      all_critical_features_remain_disabled: criticalDisabled,
      no_phase20_capability_created_by_matrix:
        disabledFeatureSummary.no_phase20_capability_created,
      metadata_only: true,
      read_only: true,
    },
    authority_surfaces: {
      surface_count: authoritySummary.surface_count,
      authority_surfaces_documented: authorityInventory.length > 0,
      approval_required_surface_count:
        authoritySummary.approval_required_surface_count,
      execution_capable_surface_count:
        authoritySummary.executable_surface_count,
      network_capable_surface_count:
        authoritySummary.network_capable_surface_count,
      new_authority_surface_count: 0,
      metadata_only: true,
      read_only: true,
    },
    approval_governance: {
      execution_capable_surfaces_have_governance_posture: executableGoverned,
      auto_approval_surface_count: 0,
      auto_approval_posture_present: false,
      approval_required_surface_ids: approvalRequired.map(
        (surface) => surface.surface_id,
      ),
      metadata_only: true,
      read_only: true,
    },
    network_governance: {
      network_capable_surfaces_governed: networkGoverned,
      network_capable_surface_ids: networkSurfaces.map(
        (surface) => surface.surface_id,
      ),
      allowed_network_postures: [
        "lan_local_only",
        "cloud_disabled_by_default",
        "cloud_opt_in_gated",
        "sandbox_whitelist_only",
      ],
      network_calls_performed: false,
      metadata_only: true,
      read_only: true,
    },
    source_material: {
      source_material_allowed_surface_count: 0,
      source_material_allowed_posture_present: false,
      redaction_or_metadata_only_posture: sourceMaterialAllowedCount === 0,
      metadata_only: true,
      read_only: true,
    },
    capability_neutrality: {
      phase20_capability_neutral: capabilityNeutral,
      no_new_phase20_capability: capabilityNeutral,
      no_new_authority_surface: true,
      no_provider_call: true,
      no_network_call: true,
      no_runtime_filesystem_mutation: true,
      no_execution_hook: true,
      no_room_device_action: true,
      no_approval_bypass: true,
      metadata_only: true,
      read_only: true,
    },
    notes: [
      "Phase 20A.5 is derived only from existing Phase 20A metadata modules.",
      "Governance is ready for Phase 20 hardening while packaging, move-in, and portfolio work remain later integration slices.",
      "Capability-neutral posture is preserved: no route, provider call, network call, execution hook, device action, approval bypass, or new authority surface is introduced.",
    ],
    evidence_ids: [...EVIDENCE_IDS],
    deterministic: true,
    metadata_only: true,
    read_only: true,
  });
}
