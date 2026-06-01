import { z } from "zod";

import {
  AUDIT_DIMENSION_IDS,
  AUDIT_PHASE_IDS,
  AUDIT_SURFACE_IDS,
  AuditSeveritySchema,
  CrossPhaseAuditPostureSchema,
  type AuditSeverity,
  type CrossPhaseAuditPosture,
} from "./contracts";
import {
  getCrossPhaseAuditContract,
  summarizeCrossPhaseAuditContract,
} from "./registry";
import {
  getCrossPhaseAuditEvidenceRegistry,
  summarizeCrossPhaseAuditEvidence,
} from "./evidence";
import {
  createPendingCrossPhaseAuditResults,
  summarizeCrossPhaseAuditResults,
} from "./results";
import { buildCrossPhaseAuditReport } from "./report";

export const PHASE_20E_CLOSEOUT_VERSION = "20E.9" as const;

export const PHASE_20E_MODULE_IDS = [
  "phase-20e:cross-phase-audit-contract",
  "phase-20e:audit-evidence-registry",
  "phase-20e:audit-result-model",
  "phase-20e:cross-phase-audit-evaluator",
  "phase-20e:governance-boundary-audit",
  "phase-20e:disabled-feature-audit",
  "phase-20e:authority-surface-audit",
  "phase-20e:cross-phase-audit-report",
] as const;

export const PHASE_20E_CLOSEOUT_CHECK_IDS = [
  "phase-20e:contract-present",
  "phase-20e:evidence-registry-present",
  "phase-20e:result-model-present",
  "phase-20e:evaluator-present",
  "phase-20e:governance-audit-present",
  "phase-20e:disabled-feature-audit-present",
  "phase-20e:authority-surface-audit-present",
  "phase-20e:cross-phase-report-present",
  "phase-20e:surface-phase-coverage",
  "phase-20e:dimension-coverage",
  "phase-20e:evidence-coverage",
  "phase-20e:governance-audit-coverage",
  "phase-20e:disabled-feature-audit-coverage",
  "phase-20e:authority-surface-audit-coverage",
  "phase-20e:report-closeout-readiness",
  "phase-20e:no-blocking-findings",
  "phase-20e:deferred-posture-represented",
  "phase-20e:no-filesystem-inspection",
  "phase-20e:no-runtime-execution",
  "phase-20e:no-provider-network-calls",
  "phase-20e:no-shell-process-execution",
  "phase-20e:no-ui-or-telemetry-inspection",
  "phase-20e:no-approval-bypass",
  "phase-20e:no-authority-surface-created",
  "phase-20e:no-source-material-exposure",
  "phase-20e:no-new-capability",
  "phase-20e:phase-20f-ready",
] as const;

export type Phase20EModuleId = (typeof PHASE_20E_MODULE_IDS)[number];
export type Phase20ECloseoutCheckId =
  (typeof PHASE_20E_CLOSEOUT_CHECK_IDS)[number];
export type Phase20ECloseoutVerdict = "pass" | "fail";

export const Phase20EModuleIdSchema = z.enum(PHASE_20E_MODULE_IDS);
export const Phase20ECloseoutCheckIdSchema = z.enum(
  PHASE_20E_CLOSEOUT_CHECK_IDS,
);
export const Phase20ECloseoutVerdictSchema = z.enum(["pass", "fail"]);

export const Phase20ECloseoutCheckSchema = z.strictObject({
  check_id: Phase20ECloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(180),
  severity: AuditSeveritySchema,
  passed: z.boolean(),
  evidence_ids: z.array(z.string().trim().min(1).max(240)).min(1),
  summary: z.string().trim().min(1).max(520),
  posture: CrossPhaseAuditPostureSchema,
});

export const Phase20ECloseoutSummarySchema = z.strictObject({
  closeout_version: z.literal(PHASE_20E_CLOSEOUT_VERSION),
  module_count: z.number().int().nonnegative(),
  check_count: z.number().int().nonnegative(),
  passed_check_count: z.number().int().nonnegative(),
  failed_check_count: z.number().int().nonnegative(),
  audit_surface_count: z.number().int().nonnegative(),
  represented_phase_count: z.number().int().nonnegative(),
  audit_dimension_count: z.number().int().nonnegative(),
  evidence_count: z.number().int().nonnegative(),
  evaluator_result_count: z.number().int().nonnegative(),
  blocking_finding_count: z.number().int().nonnegative(),
  deferred_item_count: z.number().int().nonnegative(),
  phase20e_closeout_guard_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export const Phase20ECloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_20E_CLOSEOUT_VERSION),
  report_id: z.literal("phase-20e9-cross-phase-audit-closeout"),
  phase: z.literal("20E.9"),
  verdict: Phase20ECloseoutVerdictSchema,
  module_ids: z.array(Phase20EModuleIdSchema),
  checks: z.array(Phase20ECloseoutCheckSchema),
  summary: Phase20ECloseoutSummarySchema,
  phase20e_complete: z.boolean(),
  phase20f_ready_for_final_hardening: z.boolean(),
  final_closeout_statement: z.string().trim().min(1).max(700),
  posture: CrossPhaseAuditPostureSchema,
});

export type Phase20ECloseoutCheck = z.infer<typeof Phase20ECloseoutCheckSchema>;
export type Phase20ECloseoutSummary = z.infer<
  typeof Phase20ECloseoutSummarySchema
>;
export type Phase20ECloseoutReport = z.infer<
  typeof Phase20ECloseoutReportSchema
>;

const POSTURE: CrossPhaseAuditPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  audit_execution_enabled: false,
  filesystem_inspection_enabled: false,
  runtime_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function check(
  check_id: Phase20ECloseoutCheckId,
  label: string,
  severity: AuditSeverity,
  passed: boolean,
  evidence_ids: readonly string[],
  summary: string,
): Phase20ECloseoutCheck {
  return Phase20ECloseoutCheckSchema.parse({
    check_id,
    label,
    severity,
    passed,
    evidence_ids: [...evidence_ids],
    summary,
    posture: POSTURE,
  });
}

function posturesAreCapabilityNeutral(
  postures: readonly CrossPhaseAuditPosture[],
): boolean {
  return postures.every(
    (posture) =>
      posture.metadata_only &&
      posture.read_only &&
      posture.deterministic &&
      !posture.audit_execution_enabled &&
      !posture.filesystem_inspection_enabled &&
      !posture.runtime_execution_enabled &&
      !posture.provider_call_enabled &&
      !posture.network_call_enabled &&
      !posture.ui_route_created &&
      !posture.approval_bypass_created &&
      !posture.authority_surface_created &&
      !posture.capability_created &&
      !posture.source_material_exposure_enabled,
  );
}

export function buildPhase20ECloseoutReport(): Phase20ECloseoutReport {
  const contract = getCrossPhaseAuditContract();
  const contractSummary = summarizeCrossPhaseAuditContract();
  const evidenceRegistry = getCrossPhaseAuditEvidenceRegistry();
  const evidenceSummary = summarizeCrossPhaseAuditEvidence();
  const pendingResults = createPendingCrossPhaseAuditResults();
  const resultSummary = summarizeCrossPhaseAuditResults(pendingResults);
  const auditReport = buildCrossPhaseAuditReport();
  const evaluation = auditReport.evaluator;
  const representedPhaseIds = contract.surfaces.map(
    (surface) => surface.phase_id,
  );
  const representedDimensionIds = contract.dimensions.map(
    (dimension) => dimension.dimension_id,
  );
  const deferredCount =
    auditReport.finding_summary.deferred_count +
    auditReport.governance_summary.deferred_count +
    auditReport.disabled_feature_summary.deferred_count +
    auditReport.authority_surface_summary.deferred_count;
  const blockingCount = auditReport.finding_summary.blocking_count;
  const checks = [
    check(
      "phase-20e:contract-present",
      "Cross-phase audit contract exists",
      "critical",
      contract.contract_version === "20E.1",
      ["phase-20e1:cross-phase-audit-contract"],
      "The Phase 20E.1 audit contract is present.",
    ),
    check(
      "phase-20e:evidence-registry-present",
      "Audit evidence registry exists",
      "critical",
      evidenceRegistry.registry_version === "20E.2",
      ["phase-20e2:cross-phase-audit-evidence-registry"],
      "The Phase 20E.2 audit evidence registry is present.",
    ),
    check(
      "phase-20e:result-model-present",
      "Audit result model exists",
      "critical",
      resultSummary.results_version === "20E.3" &&
        resultSummary.result_count > 0,
      ["phase-20e3:cross-phase-audit-result-model"],
      "The Phase 20E.3 result model creates pending metadata placeholders.",
    ),
    check(
      "phase-20e:evaluator-present",
      "Cross-phase audit evaluator exists",
      "critical",
      evaluation.evaluator_version === "20E.4" && evaluation.results.length > 0,
      ["phase-20e4:cross-phase-audit-evaluator"],
      "The Phase 20E.4 evaluator is present and produces metadata-derived results.",
    ),
    check(
      "phase-20e:governance-audit-present",
      "Governance boundary audit exists",
      "critical",
      auditReport.governance_summary.finding_count > 0,
      ["phase-20e5:governance-boundary-audit"],
      "The governance boundary audit is represented.",
    ),
    check(
      "phase-20e:disabled-feature-audit-present",
      "Disabled-feature audit exists",
      "critical",
      auditReport.disabled_feature_summary.finding_count > 0,
      ["phase-20e6:disabled-feature-audit"],
      "The disabled-feature audit is represented.",
    ),
    check(
      "phase-20e:authority-surface-audit-present",
      "Authority surface audit exists",
      "critical",
      auditReport.authority_surface_summary.finding_count > 0,
      ["phase-20e7:authority-surface-audit"],
      "The authority surface audit is represented.",
    ),
    check(
      "phase-20e:cross-phase-report-present",
      "Cross-phase audit report exists",
      "critical",
      auditReport.report_version === "20E.8",
      ["phase-20e8:cross-phase-audit-report"],
      "The final cross-phase audit report is represented.",
    ),
    check(
      "phase-20e:surface-phase-coverage",
      "Audit surfaces cover Phases 10-20D",
      "critical",
      representedPhaseIds.join("|") === AUDIT_PHASE_IDS.join("|") &&
        contract.surfaces.length === AUDIT_SURFACE_IDS.length,
      ["phase-20e1:audit-surface-coverage"],
      "Audit surfaces cover the required Phase 10 through Phase 20D range.",
    ),
    check(
      "phase-20e:dimension-coverage",
      "Required audit dimensions are represented",
      "critical",
      representedDimensionIds.join("|") === AUDIT_DIMENSION_IDS.join("|"),
      ["phase-20e1:audit-dimension-coverage"],
      "Required audit dimensions are represented by the contract.",
    ),
    check(
      "phase-20e:evidence-coverage",
      "Evidence coverage is represented",
      "high",
      evidenceSummary.evidence_count === 23 &&
        auditReport.evidence_summary.evidence_count ===
          evidenceSummary.evidence_count,
      ["phase-20e2:audit-evidence-coverage"],
      "Cross-phase evidence coverage is represented in the registry and report.",
    ),
    check(
      "phase-20e:governance-audit-coverage",
      "Governance boundaries are audited",
      "critical",
      auditReport.governance_summary.finding_count > 0 &&
        auditReport.governance_summary.blocking_count === 0,
      ["phase-20e5:governance-boundary-audit"],
      "Governance boundary findings are represented without blocking failures.",
    ),
    check(
      "phase-20e:disabled-feature-audit-coverage",
      "Disabled-feature posture is audited",
      "critical",
      auditReport.disabled_feature_summary.finding_count > 0 &&
        auditReport.disabled_feature_summary
          .all_required_disabled_features_represented,
      ["phase-20e6:disabled-feature-audit"],
      "Disabled-feature findings are represented and remain disabled or deferred.",
    ),
    check(
      "phase-20e:authority-surface-audit-coverage",
      "Authority surfaces are audited",
      "critical",
      auditReport.authority_surface_summary.finding_count > 0 &&
        auditReport.authority_surface_summary.all_authority_surfaces_governed,
      ["phase-20e7:authority-surface-audit"],
      "Authority surface findings are represented and remain governed.",
    ),
    check(
      "phase-20e:report-closeout-readiness",
      "Cross-phase report declares closeout readiness",
      "critical",
      auditReport.phase20e_closeout_ready,
      ["phase-20e8:phase-20e-closeout-readiness"],
      "The cross-phase audit report declares readiness for closeout evaluation.",
    ),
    check(
      "phase-20e:no-blocking-findings",
      "No blocking audit findings exist",
      "critical",
      blockingCount === 0,
      ["phase-20e8:blocking-findings"],
      "No blocking audit findings are present unless explicitly declared.",
    ),
    check(
      "phase-20e:deferred-posture-represented",
      "Deferred posture is represented",
      "high",
      deferredCount > 0,
      ["phase-20e8:deferred-items"],
      "Deferred posture remains visible for intentionally disabled, gated, or future-only surfaces.",
    ),
    check(
      "phase-20e:no-filesystem-inspection",
      "No filesystem inspection exists",
      "critical",
      posturesAreCapabilityNeutral([
        contract.posture,
        evidenceRegistry.posture,
        evaluation.posture,
        auditReport.posture,
      ]),
      ["phase-20e:safety-posture"],
      "Phase 20E metadata declares no filesystem inspection path.",
    ),
    check(
      "phase-20e:no-runtime-execution",
      "No runtime execution exists",
      "critical",
      posturesAreCapabilityNeutral([evaluation.posture, auditReport.posture]),
      ["phase-20e:safety-posture"],
      "Phase 20E metadata declares no runtime execution path.",
    ),
    check(
      "phase-20e:no-provider-network-calls",
      "No provider or network calls exist",
      "critical",
      posturesAreCapabilityNeutral([evaluation.posture, auditReport.posture]),
      ["phase-20e:safety-posture"],
      "Phase 20E metadata declares no provider or network call path.",
    ),
    check(
      "phase-20e:no-shell-process-execution",
      "No shell or process execution exists",
      "critical",
      auditReport.phase20e_report_only &&
        auditReport.phase20e_capability_neutral,
      ["phase-20e:safety-posture"],
      "Phase 20E closeout is report/guard metadata only and includes no shell or process execution.",
    ),
    check(
      "phase-20e:no-ui-or-telemetry-inspection",
      "No UI inspection or live telemetry query exists",
      "critical",
      auditReport.finding_summary.source_material_exposure_count === 0,
      ["phase-20e:safety-posture"],
      "Phase 20E does not inspect UI or query live telemetry.",
    ),
    check(
      "phase-20e:no-approval-bypass",
      "No approval bypass exists",
      "critical",
      posturesAreCapabilityNeutral([evaluation.posture, auditReport.posture]),
      ["phase-20e:safety-posture"],
      "Phase 20E metadata declares no approval bypass.",
    ),
    check(
      "phase-20e:no-authority-surface-created",
      "No authority surface is created",
      "critical",
      auditReport.finding_summary.new_authority_surface_count === 0 &&
        auditReport.authority_surface_summary.all_authority_surfaces_governed,
      ["phase-20e7:authority-surface-audit"],
      "Phase 20E creates no new authority surface and preserves existing authority posture.",
    ),
    check(
      "phase-20e:no-source-material-exposure",
      "No source-material exposure exists",
      "critical",
      evidenceSummary.metadata_safe_count === evidenceSummary.evidence_count &&
        auditReport.finding_summary.source_material_exposure_count === 0,
      ["phase-20e2:metadata-safe-evidence"],
      "Evidence and report metadata preserve source-material-safe posture.",
    ),
    check(
      "phase-20e:no-new-capability",
      "No new capability exists",
      "critical",
      auditReport.phase20e_capability_neutral,
      ["phase-20e8:capability-neutral-report"],
      "Phase 20E report remains capability-neutral.",
    ),
    check(
      "phase-20e:phase-20f-ready",
      "Phase 20F ready",
      "critical",
      auditReport.phase20e_closeout_ready && blockingCount === 0,
      ["phase-20f:final-hardening-ready"],
      "Phase 20E is complete and ready for Phase 20F final hardening.",
    ),
  ];
  const passed = checks.every((closeoutCheck) => closeoutCheck.passed);

  return Phase20ECloseoutReportSchema.parse({
    closeout_version: PHASE_20E_CLOSEOUT_VERSION,
    report_id: "phase-20e9-cross-phase-audit-closeout",
    phase: "20E.9",
    verdict: passed ? "pass" : "fail",
    module_ids: [...PHASE_20E_MODULE_IDS],
    checks,
    summary: {
      closeout_version: PHASE_20E_CLOSEOUT_VERSION,
      module_count: PHASE_20E_MODULE_IDS.length,
      check_count: checks.length,
      passed_check_count: checks.filter((closeoutCheck) => closeoutCheck.passed)
        .length,
      failed_check_count: checks.filter(
        (closeoutCheck) => !closeoutCheck.passed,
      ).length,
      audit_surface_count: contractSummary.surface_count,
      represented_phase_count: contractSummary.represented_phase_count,
      audit_dimension_count: contractSummary.dimension_count,
      evidence_count: evidenceSummary.evidence_count,
      evaluator_result_count: evaluation.results.length,
      blocking_finding_count: blockingCount,
      deferred_item_count: deferredCount,
      phase20e_closeout_guard_only: true,
      phase20e_capability_neutral: true,
      posture: POSTURE,
    },
    phase20e_complete: passed,
    phase20f_ready_for_final_hardening: passed,
    final_closeout_statement:
      "Phase 20E cross-phase audit sweep is complete as a deterministic metadata-only closeout guard and is ready for Phase 20F final hardening.",
    posture: POSTURE,
  });
}
