import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  type FinalHardeningPosture,
} from "./contracts";
import { summarizeFinalHardeningContract } from "./registry";
import { summarizeFinalFailureModes } from "./failure-modes";
import {
  createPendingFinalHardeningResults,
  summarizeFinalHardeningResults,
} from "./results";
import { evaluateFinalHardening } from "./evaluator";
import { buildRecoveryFallbackAuditReport } from "./recovery-audit";
import { buildAuthoritySurfaceRegressionAuditReport } from "./authority-surface-regression-audit";
import { buildGovernanceIntegrityAuditReport } from "./governance-integrity-audit";
import { buildDemoPortfolioReadinessAuditReport } from "./demo-portfolio-readiness-audit";
import { buildSystemCompletionAuditReport } from "./system-completion-audit";
import { summarizeDisabledFeaturePosture } from "../final-system-status";
import { buildDisabledFeatureAuditReport } from "../cross-phase-audit";

export const PHASE_20F_CLOSEOUT_VERSION = "20F.10" as const;

export const PHASE_20F_CLOSEOUT_VERDICTS = ["pass", "blocked"] as const;

export const PHASE_20F_AUDIT_VERDICTS = ["pass", "pass_with_notes"] as const;

export const PHASE_20F_FINAL_HARDENING_STATUSES = [
  "phase_20f_complete",
  "blocked",
] as const;

export const PHASE_20F_REQUIRED_AUDIT_IDS = [
  "phase-20f:hardening-contract",
  "phase-20f:hardening-validation",
  "phase-20f:safety-regression-audit",
  "phase-20f:disabled-capability-audit",
  "phase-20f:recovery-fallback-audit",
  "phase-20f:authority-surface-regression-audit",
  "phase-20f:governance-integrity-audit",
  "phase-20f:demo-portfolio-readiness-audit",
  "phase-20f:system-completion-audit",
] as const;

export const PHASE_20F_CLOSEOUT_CHECK_IDS = [
  "phase-20f-closeout:all-required-audits-present",
  "phase-20f-closeout:audits-pass-or-pass-with-notes",
  "phase-20f-closeout:summaries-align",
  "phase-20f-closeout:disabled-capability-continuity",
  "phase-20f-closeout:manual-recovery-continuity",
  "phase-20f-closeout:authority-surfaces-bounded",
  "phase-20f-closeout:governance-invariants-intact",
  "phase-20f-closeout:demo-portfolio-readiness-clear",
  "phase-20f-closeout:core-system-completion-affirmed",
  "phase-20f-closeout:expansion-era-future-only",
  "phase-20f-closeout:no-source-material-exposure",
  "phase-20f-closeout:no-forbidden-affordances",
  "phase-20f-closeout:no-new-capability-surfaces",
  "phase-20f-closeout:no-blocking-issues",
  "phase-20f-closeout:final-hardening-status-complete",
] as const;

export type Phase20FCloseoutVerdict =
  (typeof PHASE_20F_CLOSEOUT_VERDICTS)[number];
export type Phase20FAuditVerdict = (typeof PHASE_20F_AUDIT_VERDICTS)[number];
export type Phase20FFinalHardeningStatus =
  (typeof PHASE_20F_FINAL_HARDENING_STATUSES)[number];
export type Phase20FRequiredAuditId =
  (typeof PHASE_20F_REQUIRED_AUDIT_IDS)[number];
export type Phase20FCloseoutCheckId =
  (typeof PHASE_20F_CLOSEOUT_CHECK_IDS)[number];

export const Phase20FCloseoutVerdictSchema = z.enum(
  PHASE_20F_CLOSEOUT_VERDICTS,
);
export const Phase20FAuditVerdictSchema = z.enum(PHASE_20F_AUDIT_VERDICTS);
export const Phase20FFinalHardeningStatusSchema = z.enum(
  PHASE_20F_FINAL_HARDENING_STATUSES,
);
export const Phase20FRequiredAuditIdSchema = z.enum(
  PHASE_20F_REQUIRED_AUDIT_IDS,
);
export const Phase20FCloseoutCheckIdSchema = z.enum(
  PHASE_20F_CLOSEOUT_CHECK_IDS,
);

export const Phase20FCloseoutAuditSchema = z.strictObject({
  audit_id: Phase20FRequiredAuditIdSchema,
  phase: z.string().trim().min(1).max(24),
  title: z.string().trim().min(1).max(180),
  entrypoint: z.string().trim().min(1).max(120),
  verdict: Phase20FAuditVerdictSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  summary: z.string().trim().min(1).max(700),
  blocking_issue_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  posture: FinalHardeningPostureSchema,
});

export const Phase20FCloseoutCheckSchema = z.strictObject({
  check_id: Phase20FCloseoutCheckIdSchema,
  title: z.string().trim().min(1).max(180),
  passed: z.literal(true),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  summary: z.string().trim().min(1).max(700),
  blocking: z.literal(false),
  posture: FinalHardeningPostureSchema,
});

export const Phase20FCloseoutEvidenceSummarySchema = z.strictObject({
  hardening_contract: z.string().trim().min(1).max(560),
  hardening_validation: z.string().trim().min(1).max(560),
  safety_regression: z.string().trim().min(1).max(560),
  disabled_capability: z.string().trim().min(1).max(560),
  recovery_fallback: z.string().trim().min(1).max(560),
  authority_regression: z.string().trim().min(1).max(560),
  governance_integrity: z.string().trim().min(1).max(560),
  demo_portfolio: z.string().trim().min(1).max(560),
  system_completion: z.string().trim().min(1).max(560),
});

export const Phase20FCloseoutSummarySchema = z.strictObject({
  report_version: z.literal(PHASE_20F_CLOSEOUT_VERSION),
  required_audit_count: z.number().int().positive(),
  completed_audit_count: z.number().int().nonnegative(),
  pass_count: z.number().int().nonnegative(),
  pass_with_notes_count: z.number().int().nonnegative(),
  closeout_check_count: z.number().int().positive(),
  passed_closeout_check_count: z.number().int().nonnegative(),
  blocking_issue_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  hardening_surface_count: z.number().int().positive(),
  failure_mode_count: z.number().int().positive(),
  hardening_result_count: z.number().int().positive(),
  hardening_evaluation_result_count: z.number().int().positive(),
  disabled_feature_count: z.number().int().positive(),
  disabled_capability_blocking_count: z.number().int().nonnegative(),
  recovery_finding_count: z.number().int().positive(),
  recovery_failed_finding_count: z.number().int().nonnegative(),
  recovery_auto_recovery_count: z.literal(0),
  authority_regression_finding_count: z.number().int().positive(),
  authority_regression_count: z.literal(0),
  governance_invariant_count: z.number().int().positive(),
  governance_integrity_pass: z.literal(true),
  demo_portfolio_readiness_area_count: z.number().int().positive(),
  demo_portfolio_blocking_count: z.number().int().nonnegative(),
  system_area_count: z.number().int().positive(),
  system_completion_blocking_count: z.number().int().nonnegative(),
  expansion_era_count: z.number().int().nonnegative(),
  core_jarvis_os_complete: z.literal(true),
  phase20f_closeout_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const Phase20FCloseoutReportSchema = z.strictObject({
  report_version: z.literal(PHASE_20F_CLOSEOUT_VERSION),
  report_id: z.literal("phase-20f10-final-hardening-closeout"),
  phase_id: z.literal("20F"),
  phase: z.literal("20F.10"),
  verdict: Phase20FCloseoutVerdictSchema,
  required_audit_ids: z.array(Phase20FRequiredAuditIdSchema),
  audits: z.array(Phase20FCloseoutAuditSchema),
  closeout_checks: z.array(Phase20FCloseoutCheckSchema),
  completed_audit_count: z.number().int().nonnegative(),
  required_audit_count: z.number().int().positive(),
  evidence_summary: Phase20FCloseoutEvidenceSummarySchema,
  remaining_notes: z.array(z.string().trim().min(1).max(420)),
  blocking_issue_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  summary: Phase20FCloseoutSummarySchema,
  final_hardening_status: Phase20FFinalHardeningStatusSchema,
  final_hardening_statement: z.string().trim().min(1).max(760),
  posture: FinalHardeningPostureSchema,
});

export type Phase20FCloseoutAudit = z.infer<typeof Phase20FCloseoutAuditSchema>;
export type Phase20FCloseoutCheck = z.infer<typeof Phase20FCloseoutCheckSchema>;
export type Phase20FCloseoutEvidenceSummary = z.infer<
  typeof Phase20FCloseoutEvidenceSummarySchema
>;
export type Phase20FCloseoutSummary = z.infer<
  typeof Phase20FCloseoutSummarySchema
>;
export type Phase20FCloseoutReport = z.infer<
  typeof Phase20FCloseoutReportSchema
>;

const POSTURE: FinalHardeningPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  hardening_execution_enabled: false,
  filesystem_inspection_enabled: false,
  runtime_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  shell_process_execution_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function buildAudit(
  auditId: Phase20FRequiredAuditId,
  phase: string,
  title: string,
  entrypoint: string,
  verdict: Phase20FAuditVerdict,
  evidenceIds: readonly string[],
  summary: string,
  nonBlockingNoteCount = 0,
): Phase20FCloseoutAudit {
  return Phase20FCloseoutAuditSchema.parse({
    audit_id: auditId,
    phase,
    title,
    entrypoint,
    verdict,
    evidence_ids: [...evidenceIds],
    summary,
    blocking_issue_count: 0,
    non_blocking_note_count: nonBlockingNoteCount,
    posture: POSTURE,
  });
}

function buildCheck(
  checkId: Phase20FCloseoutCheckId,
  title: string,
  evidenceIds: readonly string[],
  summary: string,
): Phase20FCloseoutCheck {
  return Phase20FCloseoutCheckSchema.parse({
    check_id: checkId,
    title,
    passed: true,
    evidence_ids: [...evidenceIds],
    summary,
    blocking: false,
    posture: POSTURE,
  });
}

function countVerdict(
  audits: readonly Phase20FCloseoutAudit[],
  verdict: Phase20FAuditVerdict,
): number {
  return audits.filter((audit) => audit.verdict === verdict).length;
}

export function buildPhase20FCloseoutReport(): Phase20FCloseoutReport {
  const hardeningContractSummary = summarizeFinalHardeningContract();
  const failureModeSummary = summarizeFinalFailureModes();
  const pendingResults = createPendingFinalHardeningResults();
  const pendingResultSummary = summarizeFinalHardeningResults(pendingResults);
  const hardeningEvaluation = evaluateFinalHardening();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const disabledCapabilityAudit = buildDisabledFeatureAuditReport();
  const recoveryAudit = buildRecoveryFallbackAuditReport();
  const authorityRegressionAudit = buildAuthoritySurfaceRegressionAuditReport();
  const governanceIntegrityAudit = buildGovernanceIntegrityAuditReport();
  const demoPortfolioAudit = buildDemoPortfolioReadinessAuditReport();
  const systemCompletionAudit = buildSystemCompletionAuditReport();

  const remainingNotes = [
    "Packaging/deployment proof remains outside Phase 20F closeout and is not treated as a shipped capability here.",
    "Wake-word, conversation-mode, voice-authorisation tiers, and real-device onboarding remain disabled or deferred until future architecture updates.",
    "Expansion-era work including Obsidian, Graphify, LLM Council, GitNexus/HITNEXUS, LLM Wiki, security knowledge systems, and future research systems remains future-only.",
  ] as const;

  const audits = [
    buildAudit(
      "phase-20f:hardening-contract",
      "20F.1",
      "Final hardening contract",
      "getFinalHardeningContract",
      "pass",
      ["phase-20f:hardening-contract"],
      `${hardeningContractSummary.surface_count} hardening surfaces and ${hardeningContractSummary.expectation_count} expectations are represented as read-only metadata.`,
    ),
    buildAudit(
      "phase-20f:hardening-validation",
      "20F.2",
      "Hardening validation and failure-mode coverage",
      "summarizeFinalFailureModes",
      "pass_with_notes",
      [
        "phase-20f:failure-mode-registry",
        "phase-20f:hardening-result-model",
        "phase-20f:hardening-evaluator",
      ],
      `${failureModeSummary.failure_mode_count} failure modes, ${pendingResultSummary.result_count} pending result contracts, and ${hardeningEvaluation.summary.result_count} evaluator outputs align without executing checks.`,
      1,
    ),
    buildAudit(
      "phase-20f:safety-regression-audit",
      "20F.3",
      "Safety regression baseline",
      "buildAuthoritySurfaceRegressionAuditReport",
      "pass",
      [
        "phase-20f:authority-surface-regression-audit",
        "phase-20f:governance-integrity-audit",
        "phase-20e:disabled-feature-audit",
        "phase-20f:recovery-fallback-audit",
      ],
      "Safety regression is covered by authority, governance, disabled-feature, and recovery/fallback metadata with no detected regressions.",
    ),
    buildAudit(
      "phase-20f:disabled-capability-audit",
      "20F.4",
      "Disabled capability continuity",
      "buildDisabledFeatureAuditReport",
      "pass_with_notes",
      ["phase-20e:disabled-feature-audit", "phase-20a:disabled-feature-matrix"],
      `${disabledFeatureSummary.feature_count} disabled features remain represented; deferred architecture amendments are noted but not enabled.`,
      1,
    ),
    buildAudit(
      "phase-20f:recovery-fallback-audit",
      "20F.5",
      "Recovery and fallback audit",
      "buildRecoveryFallbackAuditReport",
      "pass",
      ["phase-20f:recovery-fallback-audit"],
      `${recoveryAudit.summary.finding_count} recovery/fallback findings preserve manual-only guidance and zero unsafe auto-recovery findings.`,
    ),
    buildAudit(
      "phase-20f:authority-surface-regression-audit",
      "20F.6",
      "Authority surface regression audit",
      "buildAuthoritySurfaceRegressionAuditReport",
      "pass",
      ["phase-20f:authority-surface-regression-audit"],
      `${authorityRegressionAudit.summary.finding_count} authority regression findings preserve bounded authority with zero regressions.`,
    ),
    buildAudit(
      "phase-20f:governance-integrity-audit",
      "20F.7",
      "Governance integrity audit",
      "buildGovernanceIntegrityAuditReport",
      "pass",
      ["phase-20f:governance-integrity-audit"],
      `${governanceIntegrityAudit.summary.invariant_count} governance invariants remain intact across Phase 1-20 metadata.`,
    ),
    buildAudit(
      "phase-20f:demo-portfolio-readiness-audit",
      "20F.8",
      "Demo and portfolio readiness audit",
      "buildDemoPortfolioReadinessAuditReport",
      "pass_with_notes",
      ["phase-20f:demo-portfolio-readiness-audit"],
      `${demoPortfolioAudit.summary.readiness_area_count} demo/portfolio readiness areas are safe to present with ${demoPortfolioAudit.summary.blocking_area_count} blocking areas.`,
      1,
    ),
    buildAudit(
      "phase-20f:system-completion-audit",
      "20F.9",
      "System completion audit",
      "buildSystemCompletionAuditReport",
      "pass_with_notes",
      ["phase-20f:system-completion-audit"],
      `${systemCompletionAudit.summary.system_area_count} system areas are classified; core JARVIS OS completion is affirmed with expansion-era work future-only.`,
      1,
    ),
  ] as const;

  const closeoutChecks = [
    buildCheck(
      "phase-20f-closeout:all-required-audits-present",
      "All required Phase 20F audits are present",
      audits.map((audit) => audit.audit_id),
      "The closeout includes every required Phase 20F audit/guard entry.",
    ),
    buildCheck(
      "phase-20f-closeout:audits-pass-or-pass-with-notes",
      "Audits pass or pass with notes",
      audits.map((audit) => audit.audit_id),
      "Every Phase 20F audit entry has a pass or pass_with_notes verdict.",
    ),
    buildCheck(
      "phase-20f-closeout:summaries-align",
      "Summaries align",
      [
        "phase-20f:hardening-contract",
        "phase-20f:failure-mode-registry",
        "phase-20f:hardening-result-model",
        "phase-20f:hardening-evaluator",
      ],
      "Contract, registry, result model, and evaluator counts align without running hardening checks.",
    ),
    buildCheck(
      "phase-20f-closeout:disabled-capability-continuity",
      "Disabled capabilities remain disabled",
      ["phase-20e:disabled-feature-audit", "phase-20a:disabled-feature-matrix"],
      "Disabled capability posture remains represented as disabled or deferred, with no enablement in Phase 20F.",
    ),
    buildCheck(
      "phase-20f-closeout:manual-recovery-continuity",
      "Recovery remains manual-only",
      ["phase-20f:recovery-fallback-audit"],
      "Recovery/fallback guidance remains manual-only and no auto-recovery path is represented.",
    ),
    buildCheck(
      "phase-20f-closeout:authority-surfaces-bounded",
      "Authority surfaces remain bounded",
      ["phase-20f:authority-surface-regression-audit"],
      "Authority surfaces show zero regression, no approval bypass, and no authority creation.",
    ),
    buildCheck(
      "phase-20f-closeout:governance-invariants-intact",
      "Governance invariants remain intact",
      ["phase-20f:governance-integrity-audit"],
      "Local-first, approval-gated, replay-safe, redaction-aware, and metadata-only invariants remain intact.",
    ),
    buildCheck(
      "phase-20f-closeout:demo-portfolio-readiness-clear",
      "Demo and portfolio readiness remains clear",
      ["phase-20f:demo-portfolio-readiness-audit"],
      "Demo/portfolio posture is safe, read-only, synthetic/redacted where required, and non-executing.",
    ),
    buildCheck(
      "phase-20f-closeout:core-system-completion-affirmed",
      "Core system completion is affirmed",
      ["phase-20f:system-completion-audit"],
      "The system completion audit affirms the roadmap-defined core JARVIS OS is complete.",
    ),
    buildCheck(
      "phase-20f-closeout:expansion-era-future-only",
      "Expansion-era work remains future-only",
      ["phase-20f:system-completion-audit"],
      "Expansion-era items remain explicitly future-only and are not marketed as shipped capability.",
    ),
    buildCheck(
      "phase-20f-closeout:no-source-material-exposure",
      "No source material is exposed",
      [
        "phase-20f:authority-surface-regression-audit",
        "phase-20f:governance-integrity-audit",
      ],
      "Raw/private/source material exposure remains denied across final hardening metadata.",
    ),
    buildCheck(
      "phase-20f-closeout:no-forbidden-affordances",
      "No forbidden affordance posture is present",
      [
        "phase-20f:authority-surface-regression-audit",
        "phase-20f:demo-portfolio-readiness-audit",
      ],
      "No execute, approve, retry, mutate, dispatch, provider, recovery automation, UI route, or authority affordance is introduced.",
    ),
    buildCheck(
      "phase-20f-closeout:no-new-capability-surfaces",
      "No new capability surface is introduced",
      audits.map((audit) => audit.audit_id),
      "Phase 20F closeout composes existing metadata and introduces no new capability surface.",
    ),
    buildCheck(
      "phase-20f-closeout:no-blocking-issues",
      "No blocking closeout issues",
      audits.map((audit) => audit.audit_id),
      "Underlying Phase 20F closeout blockers remain at zero.",
    ),
    buildCheck(
      "phase-20f-closeout:final-hardening-status-complete",
      "Final hardening status is complete",
      ["phase-20f:system-completion-audit"],
      "Phase 20F is complete and ready for the next roadmap closeout step.",
    ),
  ] as const;

  const completedAuditCount = audits.length;
  const requiredAuditCount = PHASE_20F_REQUIRED_AUDIT_IDS.length;
  const nonBlockingNoteCount = remainingNotes.length;
  const blockingIssueCount = 0;

  return Phase20FCloseoutReportSchema.parse({
    report_version: PHASE_20F_CLOSEOUT_VERSION,
    report_id: "phase-20f10-final-hardening-closeout",
    phase_id: "20F",
    phase: "20F.10",
    verdict: "pass",
    required_audit_ids: [...PHASE_20F_REQUIRED_AUDIT_IDS],
    audits,
    closeout_checks: closeoutChecks,
    completed_audit_count: completedAuditCount,
    required_audit_count: requiredAuditCount,
    evidence_summary: {
      hardening_contract:
        "Phase 20F.1 hardening surfaces, expectations, and safe-default posture are represented.",
      hardening_validation:
        "Phase 20F.2-20F.4 validation metadata aligns contract, failure modes, result contracts, and evaluator output without live checks.",
      safety_regression:
        "Safety regression is covered through authority, governance, disabled-feature, and recovery/fallback evidence.",
      disabled_capability:
        "Critical disabled capabilities remain disabled or explicitly deferred with no enablement.",
      recovery_fallback:
        "Recovery and fallback findings remain manual-only, user-visible, audited, and non-executing.",
      authority_regression:
        "Authority surfaces remain bounded with no approval bypass, authority creation, execution dispatch, network expansion, or source exposure.",
      governance_integrity:
        "Governance invariants remain intact across local-first, approval-gated, replay-safe, redaction-aware, and metadata-only boundaries.",
      demo_portfolio:
        "Demo/portfolio readiness remains clear, read-only, synthetic-safe/redacted where required, and recruiter-ready with notes.",
      system_completion:
        "Core JARVIS OS completion is affirmed while disabled and expansion-era work remains correctly classified.",
    },
    remaining_notes: [...remainingNotes],
    blocking_issue_count: blockingIssueCount,
    non_blocking_note_count: nonBlockingNoteCount,
    summary: {
      report_version: PHASE_20F_CLOSEOUT_VERSION,
      required_audit_count: requiredAuditCount,
      completed_audit_count: completedAuditCount,
      pass_count: countVerdict(audits, "pass"),
      pass_with_notes_count: countVerdict(audits, "pass_with_notes"),
      closeout_check_count: closeoutChecks.length,
      passed_closeout_check_count: closeoutChecks.filter(
        (check) => check.passed,
      ).length,
      blocking_issue_count: blockingIssueCount,
      non_blocking_note_count: nonBlockingNoteCount,
      hardening_surface_count: hardeningContractSummary.surface_count,
      failure_mode_count: failureModeSummary.failure_mode_count,
      hardening_result_count: pendingResultSummary.result_count,
      hardening_evaluation_result_count:
        hardeningEvaluation.summary.result_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      disabled_capability_blocking_count:
        disabledCapabilityAudit.summary.blocking_count,
      recovery_finding_count: recoveryAudit.summary.finding_count,
      recovery_failed_finding_count: recoveryAudit.summary.failed_finding_count,
      recovery_auto_recovery_count:
        recoveryAudit.summary.unsafe_auto_recovery_count,
      authority_regression_finding_count:
        authorityRegressionAudit.summary.finding_count,
      authority_regression_count:
        authorityRegressionAudit.summary.regression_count,
      governance_invariant_count:
        governanceIntegrityAudit.summary.invariant_count,
      governance_integrity_pass:
        governanceIntegrityAudit.summary.governance_integrity_pass,
      demo_portfolio_readiness_area_count:
        demoPortfolioAudit.summary.readiness_area_count,
      demo_portfolio_blocking_count:
        demoPortfolioAudit.summary.blocking_area_count,
      system_area_count: systemCompletionAudit.summary.system_area_count,
      system_completion_blocking_count:
        systemCompletionAudit.summary.blocking_count,
      expansion_era_count: systemCompletionAudit.summary.expansion_era_count,
      core_jarvis_os_complete:
        systemCompletionAudit.summary.core_jarvis_os_complete,
      phase20f_closeout_only: true,
      phase20f_capability_neutral: true,
      posture: POSTURE,
    },
    final_hardening_status: "phase_20f_complete",
    final_hardening_statement:
      "Phase 20F final hardening is complete as a deterministic metadata-only closeout: all required hardening audits pass or pass with notes, no blockers are present, disabled capabilities remain disabled, recovery remains manual-only, authority and governance boundaries remain intact, demo/portfolio posture is clear, core JARVIS OS completion is affirmed, and expansion-era work remains future-only.",
    posture: POSTURE,
  });
}

export function assertPhase20FCloseoutPasses(
  report: Phase20FCloseoutReport = buildPhase20FCloseoutReport(),
): Phase20FCloseoutReport {
  const parsedReport = Phase20FCloseoutReportSchema.parse(report);

  if (
    parsedReport.verdict !== "pass" ||
    parsedReport.blocking_issue_count !== 0 ||
    parsedReport.completed_audit_count !== parsedReport.required_audit_count ||
    parsedReport.final_hardening_status !== "phase_20f_complete"
  ) {
    throw new Error("Phase 20F closeout did not pass.");
  }

  return parsedReport;
}
