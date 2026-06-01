import { z } from "zod";

import {
  CrossPhaseAuditPostureSchema,
  type CrossPhaseAuditPosture,
} from "./contracts";
import {
  CrossPhaseAuditEvidenceSummarySchema,
  summarizeCrossPhaseAuditEvidence,
} from "./evidence";
import {
  CrossPhaseAuditEvaluationSchema,
  evaluateCrossPhaseAudit,
} from "./evaluator";
import {
  GovernanceAuditSummarySchema,
  buildGovernanceAuditReport,
} from "./governance-audit";
import {
  DisabledFeatureAuditSummarySchema,
  buildDisabledFeatureAuditReport,
} from "./disabled-feature-audit";
import {
  AuthoritySurfaceAuditSummarySchema,
  buildAuthoritySurfaceAuditReport,
} from "./authority-surface-audit";

export const CROSS_PHASE_AUDIT_REPORT_VERSION = "20E.8" as const;

export const CROSS_PHASE_AUDIT_REPORT_VERDICTS = [
  "pass",
  "pass_with_warnings",
  "blocked",
  "pending",
] as const;

export const CROSS_PHASE_AUDIT_REPORT_SECTION_IDS = [
  "cross-phase-audit-report:overall-verdict",
  "cross-phase-audit-report:surface-coverage",
  "cross-phase-audit-report:dimension-coverage",
  "cross-phase-audit-report:governance-audit",
  "cross-phase-audit-report:disabled-feature-audit",
  "cross-phase-audit-report:authority-surface-audit",
  "cross-phase-audit-report:blocking-findings",
  "cross-phase-audit-report:warnings",
  "cross-phase-audit-report:deferred-items",
  "cross-phase-audit-report:evidence-coverage",
  "cross-phase-audit-report:final-audit-statement",
  "cross-phase-audit-report:phase-20e-closeout-readiness",
] as const;

export type CrossPhaseAuditReportVerdict =
  (typeof CROSS_PHASE_AUDIT_REPORT_VERDICTS)[number];
export type CrossPhaseAuditReportSectionId =
  (typeof CROSS_PHASE_AUDIT_REPORT_SECTION_IDS)[number];

export const CrossPhaseAuditReportVerdictSchema = z.enum(
  CROSS_PHASE_AUDIT_REPORT_VERDICTS,
);
export const CrossPhaseAuditReportSectionIdSchema = z.enum(
  CROSS_PHASE_AUDIT_REPORT_SECTION_IDS,
);

export const CrossPhaseAuditReportSectionSchema = z.strictObject({
  section_id: CrossPhaseAuditReportSectionIdSchema,
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(700),
  evidence_ids: z.array(z.string().trim().min(1).max(220)),
  posture: CrossPhaseAuditPostureSchema,
});

export const CrossPhaseAuditReportCoverageSummarySchema = z.strictObject({
  surface_count: z.number().int().nonnegative(),
  dimension_count: z.number().int().nonnegative(),
  evidence_count: z.number().int().nonnegative(),
  result_count: z.number().int().nonnegative(),
  represented_surface_count: z.number().int().nonnegative(),
  represented_dimension_count: z.number().int().nonnegative(),
});

export const CrossPhaseAuditReportFindingSummarySchema = z.strictObject({
  blocking_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  pending_count: z.number().int().nonnegative(),
  source_material_exposure_count: z.literal(0),
  new_authority_surface_count: z.literal(0),
});

export const CrossPhaseAuditReportSchema = z.strictObject({
  report_version: z.literal(CROSS_PHASE_AUDIT_REPORT_VERSION),
  report_id: z.literal("phase-20e8-cross-phase-audit-report"),
  phase: z.literal("20E.8"),
  verdict: CrossPhaseAuditReportVerdictSchema,
  sections: z.array(CrossPhaseAuditReportSectionSchema),
  coverage_summary: CrossPhaseAuditReportCoverageSummarySchema,
  finding_summary: CrossPhaseAuditReportFindingSummarySchema,
  evaluator: CrossPhaseAuditEvaluationSchema,
  evidence_summary: CrossPhaseAuditEvidenceSummarySchema,
  governance_summary: GovernanceAuditSummarySchema,
  disabled_feature_summary: DisabledFeatureAuditSummarySchema,
  authority_surface_summary: AuthoritySurfaceAuditSummarySchema,
  blocking_findings: z.array(z.string().trim().min(1).max(240)),
  warnings: z.array(z.string().trim().min(1).max(240)),
  deferred_items: z.array(z.string().trim().min(1).max(240)),
  final_audit_statement: z.string().trim().min(1).max(700),
  phase20e_closeout_ready: z.boolean(),
  phase20e_report_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export type CrossPhaseAuditReportSection = z.infer<
  typeof CrossPhaseAuditReportSectionSchema
>;
export type CrossPhaseAuditReportCoverageSummary = z.infer<
  typeof CrossPhaseAuditReportCoverageSummarySchema
>;
export type CrossPhaseAuditReportFindingSummary = z.infer<
  typeof CrossPhaseAuditReportFindingSummarySchema
>;
export type CrossPhaseAuditReport = z.infer<typeof CrossPhaseAuditReportSchema>;

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

function determineVerdict(
  blockingCount: number,
  pendingCount: number,
  warningCount: number,
  deferredCount: number,
): CrossPhaseAuditReportVerdict {
  if (blockingCount > 0) {
    return "blocked";
  }

  if (pendingCount > 0) {
    return "pending";
  }

  if (warningCount > 0 || deferredCount > 0) {
    return "pass_with_warnings";
  }

  return "pass";
}

function section(
  section_id: CrossPhaseAuditReportSectionId,
  title: string,
  summary: string,
  evidence_ids: readonly string[] = [],
): CrossPhaseAuditReportSection {
  return CrossPhaseAuditReportSectionSchema.parse({
    section_id,
    title,
    summary,
    evidence_ids: [...evidence_ids],
    posture: POSTURE,
  });
}

export function buildCrossPhaseAuditReport(): CrossPhaseAuditReport {
  const evaluator = evaluateCrossPhaseAudit();
  const evidenceSummary = summarizeCrossPhaseAuditEvidence();
  const governance = buildGovernanceAuditReport();
  const disabledFeature = buildDisabledFeatureAuditReport();
  const authoritySurface = buildAuthoritySurfaceAuditReport();

  const blockingFindings = [
    ...governance.blocking_findings.map((finding) => finding.finding_id),
    ...disabledFeature.blocking_findings.map((finding) => finding.finding_id),
    ...authoritySurface.blocking_findings.map((finding) => finding.finding_id),
  ];
  const warnings = [
    ...governance.warnings.map((finding) => finding.finding_id),
    ...authoritySurface.warnings.map((finding) => finding.finding_id),
  ];
  const deferredItems = [
    ...disabledFeature.deferred_findings.map((finding) => finding.finding_id),
    ...authoritySurface.deferred_findings.map((finding) => finding.finding_id),
  ];
  const pendingCount =
    evaluator.summary.pending_count +
    governance.summary.pending_count +
    disabledFeature.summary.pending_count +
    authoritySurface.summary.pending_count;
  const blockingCount =
    evaluator.summary.blocking_count +
    governance.summary.blocking_count +
    disabledFeature.summary.blocking_count +
    authoritySurface.summary.blocking_count;
  const warningCount =
    evaluator.summary.warning_count +
    governance.summary.warning_count +
    disabledFeature.summary.warning_count +
    authoritySurface.summary.warning_count;
  const deferredCount =
    evaluator.summary.deferred_count +
    governance.summary.deferred_count +
    disabledFeature.summary.deferred_count +
    authoritySurface.summary.deferred_count;
  const verdict = determineVerdict(
    blockingCount,
    pendingCount,
    warningCount,
    deferredCount,
  );
  const closeoutReady = blockingCount === 0 && pendingCount === 0;

  return CrossPhaseAuditReportSchema.parse({
    report_version: CROSS_PHASE_AUDIT_REPORT_VERSION,
    report_id: "phase-20e8-cross-phase-audit-report",
    phase: "20E.8",
    verdict,
    sections: [
      section(
        "cross-phase-audit-report:overall-verdict",
        "Overall audit verdict",
        `Overall cross-phase audit verdict is ${verdict}.`,
      ),
      section(
        "cross-phase-audit-report:surface-coverage",
        "Surface coverage",
        `${evaluator.summary.represented_surface_count} audit surfaces are represented in evaluator output.`,
      ),
      section(
        "cross-phase-audit-report:dimension-coverage",
        "Dimension coverage",
        `${evaluator.summary.represented_dimension_count} audit dimensions are represented in evaluator output.`,
      ),
      section(
        "cross-phase-audit-report:governance-audit",
        "Governance audit",
        `${governance.summary.finding_count} governance findings are represented with ${governance.summary.blocking_count} blocking findings.`,
        ["audit-evidence:governance-readiness-summary"],
      ),
      section(
        "cross-phase-audit-report:disabled-feature-audit",
        "Disabled-feature audit",
        `${disabledFeature.summary.finding_count} disabled-feature findings are represented with ${disabledFeature.summary.deferred_count} deferred findings.`,
        ["audit-evidence:disabled-feature-matrix"],
      ),
      section(
        "cross-phase-audit-report:authority-surface-audit",
        "Authority-surface audit",
        `${authoritySurface.summary.finding_count} authority-surface findings are represented with ${authoritySurface.summary.blocking_count} blocking findings.`,
        ["audit-evidence:authority-surface-inventory"],
      ),
      section(
        "cross-phase-audit-report:blocking-findings",
        "Blocking findings",
        `${blockingFindings.length} blocking findings are present across the final audit report.`,
      ),
      section(
        "cross-phase-audit-report:warnings",
        "Warnings",
        `${warnings.length} warning findings are present and remain metadata-only review notes.`,
      ),
      section(
        "cross-phase-audit-report:deferred-items",
        "Deferred items",
        `${deferredItems.length} deferred findings remain intentionally disabled, gated, or architecture-amendment-bound.`,
      ),
      section(
        "cross-phase-audit-report:evidence-coverage",
        "Evidence coverage",
        `${evidenceSummary.evidence_count} evidence records support final cross-phase audit reporting.`,
      ),
      section(
        "cross-phase-audit-report:final-audit-statement",
        "Final audit statement",
        "Phase 20E audit reporting is metadata-only, local-first, approval-aware, source-material-safe, and capability-neutral.",
      ),
      section(
        "cross-phase-audit-report:phase-20e-closeout-readiness",
        "Phase 20E closeout readiness",
        closeoutReady
          ? "Phase 20E is ready for closeout guard evaluation."
          : "Phase 20E requires blocking or pending findings to be resolved before closeout.",
      ),
    ],
    coverage_summary: {
      surface_count: evaluator.summary.represented_surface_count,
      dimension_count: evaluator.summary.represented_dimension_count,
      evidence_count: evidenceSummary.evidence_count,
      result_count: evaluator.summary.result_count,
      represented_surface_count: evaluator.summary.represented_surface_count,
      represented_dimension_count:
        evaluator.summary.represented_dimension_count,
    },
    finding_summary: {
      blocking_count: blockingCount,
      warning_count: warningCount,
      deferred_count: deferredCount,
      pending_count: pendingCount,
      source_material_exposure_count: 0,
      new_authority_surface_count: 0,
    },
    evaluator,
    evidence_summary: evidenceSummary,
    governance_summary: governance.summary,
    disabled_feature_summary: disabledFeature.summary,
    authority_surface_summary: authoritySurface.summary,
    blocking_findings: blockingFindings,
    warnings,
    deferred_items: deferredItems,
    final_audit_statement:
      "The final cross-phase audit report composes existing metadata only and confirms JARVIS remains governed, local-first, approval-aware, disabled-feature-preserving, authority-bounded, source-material-safe, and ready for Phase 20E closeout evaluation.",
    phase20e_closeout_ready: closeoutReady,
    phase20e_report_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}
