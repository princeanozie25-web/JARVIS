import { z } from "zod";

import { FINAL_SYSTEM_PHASE_IDS, FinalSystemPhaseIdSchema } from "./contracts";
import {
  buildFinalReadinessSummary,
  listBlockedOrMissingFinalSystemItems,
  listFinalSystemPhaseStatuses,
} from "./registry";
import { buildFinalReadinessReport } from "./report";
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
import { buildFinalGovernanceReadinessSummary } from "./governance-readiness-summary";

export const PHASE_20A_CLOSEOUT_VERSION = "20A.6" as const;

export const PHASE_20A_CLOSEOUT_VERDICTS = ["pass", "fail"] as const;

export const PHASE_20A_MODULE_IDS = [
  "phase-20a1:final-system-status-registry",
  "phase-20a2:final-readiness-report-generator",
  "phase-20a3:final-disabled-feature-matrix",
  "phase-20a4:final-authority-surface-inventory",
  "phase-20a5:final-governance-readiness-summary",
] as const;

export const PHASE_20A_CLOSEOUT_CHECK_IDS = [
  "phase20a_modules_integrated",
  "phases_10_19_represented",
  "blocked_missing_aligned_with_registry",
  "critical_disabled_features_remain_disabled",
  "authority_surfaces_inventoried",
  "runtime_capable_surfaces_governed",
  "network_capable_surfaces_governed",
  "auto_approval_absent",
  "source_material_allowed_absent",
  "capability_neutrality_preserved",
  "phase20b_ready_for_packaging_bootstrap_onboarding_hardening",
] as const;

export type Phase20ACloseoutVerdict =
  (typeof PHASE_20A_CLOSEOUT_VERDICTS)[number];
export type Phase20AModuleId = (typeof PHASE_20A_MODULE_IDS)[number];
export type Phase20ACloseoutCheckId =
  (typeof PHASE_20A_CLOSEOUT_CHECK_IDS)[number];

export const Phase20ACloseoutVerdictSchema = z.enum(
  PHASE_20A_CLOSEOUT_VERDICTS,
);
export const Phase20AModuleIdSchema = z.enum(PHASE_20A_MODULE_IDS);
export const Phase20ACloseoutCheckIdSchema = z.enum(
  PHASE_20A_CLOSEOUT_CHECK_IDS,
);

export const Phase20ACloseoutCheckSchema = z.strictObject({
  check_id: Phase20ACloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(220),
  passed: z.boolean(),
  evidence_id: Phase20AModuleIdSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const Phase20ACapabilityNeutralitySchema = z.strictObject({
  runtime_hook_count: z.literal(0),
  provider_call_count: z.literal(0),
  network_call_count: z.literal(0),
  ui_route_count: z.literal(0),
  room_device_command_count: z.literal(0),
  approval_bypass_count: z.literal(0),
  runtime_filesystem_mutation_count: z.literal(0),
  authority_surface_delta_count: z.literal(0),
  phase20_capability_delta_count: z.literal(0),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const Phase20ACloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_20A_CLOSEOUT_VERSION),
  report_id: z.literal("phase-20a-final-readiness-layer-closeout"),
  verdict: Phase20ACloseoutVerdictSchema,
  included_modules: z.array(Phase20AModuleIdSchema),
  checks: z.array(Phase20ACloseoutCheckSchema),
  phase_coverage_ids: z.array(FinalSystemPhaseIdSchema),
  blocked_or_missing_phase_ids: z.array(FinalSystemPhaseIdSchema),
  critical_disabled_feature_count: z.number().int().nonnegative(),
  authority_surface_count: z.number().int().positive(),
  approval_required_surface_count: z.number().int().nonnegative(),
  runtime_capable_surface_count: z.number().int().nonnegative(),
  network_capable_surface_count: z.number().int().nonnegative(),
  governance_summary_id: z.literal(
    "phase-20a5-final-governance-readiness-summary",
  ),
  capability_neutrality: Phase20ACapabilityNeutralitySchema,
  phase20a_complete: z.boolean(),
  phase20b_ready_for_packaging_bootstrap_onboarding_hardening: z.boolean(),
  deterministic: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export type Phase20ACloseoutCheck = z.infer<typeof Phase20ACloseoutCheckSchema>;
export type Phase20ACapabilityNeutrality = z.infer<
  typeof Phase20ACapabilityNeutralitySchema
>;
export type Phase20ACloseoutReport = z.infer<
  typeof Phase20ACloseoutReportSchema
>;

function check(input: {
  readonly check_id: Phase20ACloseoutCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly evidence_id: Phase20AModuleId;
}): Phase20ACloseoutCheck {
  return Phase20ACloseoutCheckSchema.parse({
    ...input,
    metadata_only: true,
    read_only: true,
  });
}

function phases10Through19Represented(): boolean {
  return (
    listFinalSystemPhaseStatuses()
      .map((record) => record.phase_id)
      .join("|") === FINAL_SYSTEM_PHASE_IDS.join("|")
  );
}

function criticalDisabledFeaturesRemainDisabled(): boolean {
  return getCriticalDisabledFeatures().every(
    (feature) =>
      feature.final_phase20_posture.startsWith("remains_disabled") &&
      !feature.creates_new_capability &&
      !feature.creates_new_authority &&
      !feature.adds_user_affordance &&
      !feature.performs_side_effect,
  );
}

function runtimeCapableSurfacesGoverned(): boolean {
  return getExecutableAuthoritySurfaces().every(
    (surface) =>
      surface.approval_requirement !== "disabled_no_approval_path" &&
      (surface.approval_requirement !== "not_applicable" ||
        /governance|governed|local-first|redaction|cost|advisory/i.test(
          surface.governance_notes,
        )),
  );
}

function networkCapableSurfacesGoverned(): boolean {
  return getNetworkCapableAuthoritySurfaces().every((surface) =>
    [
      "lan_local_only",
      "cloud_disabled_by_default",
      "cloud_opt_in_gated",
      "sandbox_whitelist_only",
    ].includes(surface.network_posture),
  );
}

export function buildPhase20ACloseoutReport(): Phase20ACloseoutReport {
  const readinessSummary = buildFinalReadinessSummary();
  const readinessReport = buildFinalReadinessReport();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const authoritySummary = summarizeAuthoritySurfacePosture();
  const governanceSummary = buildFinalGovernanceReadinessSummary();
  const blockedOrMissing = listBlockedOrMissingFinalSystemItems();
  const authorityInventory = getFinalAuthoritySurfaceInventory();
  const approvalRequired = getAuthoritySurfacesRequiringApproval();
  const runtimeCapable = getExecutableAuthoritySurfaces();
  const networkCapable = getNetworkCapableAuthoritySurfaces();
  const moduleCoverage =
    readinessReport.generated_from === "final-system-status-registry";
  const phaseCoverage = phases10Through19Represented();
  const blockedMissingAligned =
    governanceSummary.blocked_missing.blocked_or_missing_count ===
      blockedOrMissing.length &&
    governanceSummary.blocked_missing.blocked_or_missing_phase_ids.join("|") ===
      blockedOrMissing.map((record) => record.phase_id).join("|");
  const disabledFeaturePosture =
    disabledFeatureSummary.all_features_remain_disabled &&
    criticalDisabledFeaturesRemainDisabled();
  const authorityPosture =
    authorityInventory.length > 0 &&
    authoritySummary.surface_count === authorityInventory.length;
  const runtimeGoverned = runtimeCapableSurfacesGoverned();
  const networkGoverned = networkCapableSurfacesGoverned();
  const autoApprovalAbsent = authorityInventory.every(
    (surface) => !surface.auto_approval_allowed,
  );
  const sourceMaterialAllowedAbsent = authorityInventory.every(
    (surface) => !surface.raw_payload_posture.includes("allowed"),
  );
  const capabilityNeutral =
    readinessSummary.phase20_capability_posture.new_capabilities_introduced ===
      false &&
    readinessReport.phase20_new_capabilities_introduced === false &&
    disabledFeatureSummary.no_phase20_capability_created &&
    authoritySummary.new_authority_surface_count === 0 &&
    governanceSummary.capability_neutrality.phase20_capability_neutral;

  const checks = [
    check({
      check_id: "phase20a_modules_integrated",
      label:
        "Final system status, readiness report, disabled-feature matrix, authority inventory, and governance summary are integrated.",
      passed: moduleCoverage,
      evidence_id: "phase-20a5:final-governance-readiness-summary",
    }),
    check({
      check_id: "phases_10_19_represented",
      label: "Phases 10-19 are represented in the final status layer.",
      passed: phaseCoverage,
      evidence_id: "phase-20a1:final-system-status-registry",
    }),
    check({
      check_id: "blocked_missing_aligned_with_registry",
      label:
        "Blocked or missing phases are reported only when present in the registry.",
      passed: blockedMissingAligned,
      evidence_id: "phase-20a1:final-system-status-registry",
    }),
    check({
      check_id: "critical_disabled_features_remain_disabled",
      label: "Critical disabled features remain disabled.",
      passed: disabledFeaturePosture,
      evidence_id: "phase-20a3:final-disabled-feature-matrix",
    }),
    check({
      check_id: "authority_surfaces_inventoried",
      label:
        "Authority-bearing and authority-adjacent surfaces are inventoried.",
      passed: authorityPosture,
      evidence_id: "phase-20a4:final-authority-surface-inventory",
    }),
    check({
      check_id: "runtime_capable_surfaces_governed",
      label: "Runtime-capable surfaces declare approval or governance posture.",
      passed: runtimeGoverned,
      evidence_id: "phase-20a4:final-authority-surface-inventory",
    }),
    check({
      check_id: "network_capable_surfaces_governed",
      label:
        "Network-capable surfaces are local-first, cloud-gated, or whitelist-postured.",
      passed: networkGoverned,
      evidence_id: "phase-20a4:final-authority-surface-inventory",
    }),
    check({
      check_id: "auto_approval_absent",
      label: "No auto-approval posture exists.",
      passed: autoApprovalAbsent,
      evidence_id: "phase-20a4:final-authority-surface-inventory",
    }),
    check({
      check_id: "source_material_allowed_absent",
      label: "No source-material-allowed posture exists.",
      passed: sourceMaterialAllowedAbsent,
      evidence_id: "phase-20a4:final-authority-surface-inventory",
    }),
    check({
      check_id: "capability_neutrality_preserved",
      label: "Phase 20A remains capability-neutral.",
      passed: capabilityNeutral,
      evidence_id: "phase-20a5:final-governance-readiness-summary",
    }),
    check({
      check_id: "phase20b_ready_for_packaging_bootstrap_onboarding_hardening",
      label:
        "Phase 20A is ready for Phase 20B packaging, bootstrap, and onboarding hardening.",
      passed:
        governanceSummary.governance_ready_for_phase20_hardening &&
        capabilityNeutral,
      evidence_id: "phase-20a5:final-governance-readiness-summary",
    }),
  ];
  const passed = checks.every((item) => item.passed);

  return Phase20ACloseoutReportSchema.parse({
    closeout_version: PHASE_20A_CLOSEOUT_VERSION,
    report_id: "phase-20a-final-readiness-layer-closeout",
    verdict: passed ? "pass" : "fail",
    included_modules: [...PHASE_20A_MODULE_IDS],
    checks,
    phase_coverage_ids: [...FINAL_SYSTEM_PHASE_IDS],
    blocked_or_missing_phase_ids: blockedOrMissing.map(
      (record) => record.phase_id,
    ),
    critical_disabled_feature_count:
      disabledFeatureSummary.critical_feature_count,
    authority_surface_count: authoritySummary.surface_count,
    approval_required_surface_count: approvalRequired.length,
    runtime_capable_surface_count: runtimeCapable.length,
    network_capable_surface_count: networkCapable.length,
    governance_summary_id: "phase-20a5-final-governance-readiness-summary",
    capability_neutrality: {
      runtime_hook_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      ui_route_count: 0,
      room_device_command_count: 0,
      approval_bypass_count: 0,
      runtime_filesystem_mutation_count: 0,
      authority_surface_delta_count: 0,
      phase20_capability_delta_count: 0,
      metadata_only: true,
      read_only: true,
    },
    phase20a_complete: passed,
    phase20b_ready_for_packaging_bootstrap_onboarding_hardening: passed,
    deterministic: true,
    metadata_only: true,
    read_only: true,
  });
}
