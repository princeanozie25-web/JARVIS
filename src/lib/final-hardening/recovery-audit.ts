import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  HardeningSeveritySchema,
  HardeningSurfaceIdSchema,
  type FinalHardeningPosture,
} from "./contracts";
import {
  FailureModeBlockingPostureSchema,
  FinalFailureModeIdSchema,
  getFinalFailureModeRegistry,
} from "./failure-modes";
import {
  FinalHardeningRunSummarySchema,
  FinalHardeningStatusSchema,
  type FinalHardeningResult,
} from "./results";
import { evaluateFinalHardening } from "./evaluator";

export const RECOVERY_FALLBACK_AUDIT_VERSION = "20F.5" as const;

export const RECOVERY_FALLBACK_AUDIT_CLASSIFICATIONS = [
  "blocking",
  "warning",
  "deferred",
] as const;

export type RecoveryFallbackAuditClassification =
  (typeof RECOVERY_FALLBACK_AUDIT_CLASSIFICATIONS)[number];
export type RecoveryFallbackAuditSeverity = z.infer<
  typeof HardeningSeveritySchema
>;

export const RecoveryFallbackAuditClassificationSchema = z.enum(
  RECOVERY_FALLBACK_AUDIT_CLASSIFICATIONS,
);

export const RecoveryFallbackAuditFindingSchema = z.strictObject({
  finding_id: z.string().trim().min(1).max(180),
  failure_mode_id: FinalFailureModeIdSchema,
  hardening_surface_id: HardeningSurfaceIdSchema,
  severity: HardeningSeveritySchema,
  classification: RecoveryFallbackAuditClassificationSchema,
  result_status: FinalHardeningStatusSchema,
  blocking_posture: FailureModeBlockingPostureSchema,
  fallback_behavior: z.string().trim().min(1).max(560),
  safe_default: z.string().trim().min(1).max(560),
  user_visible_error_posture: z.string().trim().min(1).max(560),
  audit_log_posture: z.string().trim().min(1).max(560),
  recovery_guidance: z.array(z.string().trim().min(1).max(260)).min(1),
  deferred_limitation_posture: z.string().trim().min(1).max(560),
  cloud_fallback_posture: z.string().trim().min(1).max(560),
  unsafe_auto_recovery_represented: z.literal(false),
  recovery_execution_enabled: z.literal(false),
  passed: z.boolean(),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  summary: z.string().trim().min(1).max(700),
  posture: FinalHardeningPostureSchema,
});

export const RecoveryFallbackAuditSummarySchema = z.strictObject({
  report_version: z.literal(RECOVERY_FALLBACK_AUDIT_VERSION),
  finding_count: z.number().int().nonnegative(),
  covered_failure_mode_count: z.number().int().nonnegative(),
  covered_surface_count: z.number().int().nonnegative(),
  blocking_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  fallback_behavior_count: z.number().int().nonnegative(),
  safe_default_count: z.number().int().nonnegative(),
  recovery_guidance_count: z.number().int().nonnegative(),
  user_visible_error_count: z.number().int().nonnegative(),
  audit_log_posture_count: z.number().int().nonnegative(),
  cloud_gated_posture_count: z.number().int().nonnegative(),
  unsafe_auto_recovery_count: z.literal(0),
  failed_finding_count: z.number().int().nonnegative(),
  phase20f_recovery_audit_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const RecoveryFallbackAuditReportSchema = z.strictObject({
  report_version: z.literal(RECOVERY_FALLBACK_AUDIT_VERSION),
  report_id: z.literal("phase-20f5-recovery-fallback-audit"),
  phase: z.literal("20F.5"),
  findings: z.array(RecoveryFallbackAuditFindingSchema),
  blocking_findings: z.array(RecoveryFallbackAuditFindingSchema),
  warnings: z.array(RecoveryFallbackAuditFindingSchema),
  deferred_findings: z.array(RecoveryFallbackAuditFindingSchema),
  evaluator_summary: FinalHardeningRunSummarySchema,
  summary: RecoveryFallbackAuditSummarySchema,
  final_recovery_statement: z.string().trim().min(1).max(700),
  posture: FinalHardeningPostureSchema,
});

export type RecoveryFallbackAuditFinding = z.infer<
  typeof RecoveryFallbackAuditFindingSchema
>;
export type RecoveryFallbackAuditSummary = z.infer<
  typeof RecoveryFallbackAuditSummarySchema
>;
export type RecoveryFallbackAuditReport = z.infer<
  typeof RecoveryFallbackAuditReportSchema
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

function classificationFor(
  result: FinalHardeningResult,
): RecoveryFallbackAuditClassification {
  if (result.blocking_posture === "deferred") {
    return "deferred";
  }

  if (result.blocking_posture === "warning_only") {
    return "warning";
  }

  return "blocking";
}

function findingIdFor(failureModeId: string): string {
  return `recovery-fallback-audit:${failureModeId.replace(
    "final-failure-mode:",
    "",
  )}`;
}

function cloudFallbackPostureFor(result: FinalHardeningResult): string {
  if (
    result.failure_mode_id.includes("cloud") ||
    result.safe_default.toLowerCase().includes("cloud") ||
    result.deferred_limitation_posture.toLowerCase().includes("cloud")
  ) {
    return "Cloud fallback remains opt-in, disabled by default, and governance-gated.";
  }

  return "No cloud fallback is introduced by this failure mode.";
}

function findingForResult(
  result: FinalHardeningResult,
): RecoveryFallbackAuditFinding {
  const fallbackCovered = result.expected_fallback_behavior.length > 0;
  const safeDefaultCovered = result.safe_default.length > 0;
  const recoveryCovered = result.recovery_guidance.length > 0;
  const userVisibleCovered = result.user_visible_error_posture.length > 0;
  const auditLogCovered =
    result.audit_log_posture.length > 0 &&
    result.audit_log_posture.includes("metadata-only");
  const passed =
    fallbackCovered &&
    safeDefaultCovered &&
    recoveryCovered &&
    userVisibleCovered &&
    auditLogCovered &&
    !result.remediation_hint.automation_enabled;

  return RecoveryFallbackAuditFindingSchema.parse({
    finding_id: findingIdFor(result.failure_mode_id),
    failure_mode_id: result.failure_mode_id,
    hardening_surface_id: result.hardening_surface_id,
    severity: result.severity,
    classification: classificationFor(result),
    result_status: result.status,
    blocking_posture: result.blocking_posture,
    fallback_behavior: result.expected_fallback_behavior,
    safe_default: result.safe_default,
    user_visible_error_posture: result.user_visible_error_posture,
    audit_log_posture: result.audit_log_posture,
    recovery_guidance: [...result.recovery_guidance],
    deferred_limitation_posture: result.deferred_limitation_posture,
    cloud_fallback_posture: cloudFallbackPostureFor(result),
    unsafe_auto_recovery_represented: false,
    recovery_execution_enabled: false,
    passed,
    evidence_ids: [
      result.failure_mode_id,
      result.hardening_surface_id,
      result.result_id,
    ],
    summary:
      "Recovery/fallback posture is represented as metadata with no automatic recovery execution.",
    posture: POSTURE,
  });
}

export function buildRecoveryFallbackAuditReport(): RecoveryFallbackAuditReport {
  const failureModes = getFinalFailureModeRegistry();
  const evaluation = evaluateFinalHardening();
  const findings = evaluation.results.map(findingForResult);
  const allFailureModesCovered = findings.length === failureModes.length;
  const failureModeIds = new Set(
    findings.map((finding) => finding.failure_mode_id),
  );
  const surfaceIds = new Set(
    findings.map((finding) => finding.hardening_surface_id),
  );
  const blockingFindings = findings.filter(
    (finding) => finding.classification === "blocking",
  );
  const warnings = findings.filter(
    (finding) => finding.classification === "warning",
  );
  const deferredFindings = findings.filter(
    (finding) => finding.classification === "deferred",
  );

  return RecoveryFallbackAuditReportSchema.parse({
    report_version: RECOVERY_FALLBACK_AUDIT_VERSION,
    report_id: "phase-20f5-recovery-fallback-audit",
    phase: "20F.5",
    findings,
    blocking_findings: blockingFindings,
    warnings,
    deferred_findings: deferredFindings,
    evaluator_summary: evaluation.summary,
    summary: {
      report_version: RECOVERY_FALLBACK_AUDIT_VERSION,
      finding_count: findings.length,
      covered_failure_mode_count: failureModeIds.size,
      covered_surface_count: surfaceIds.size,
      blocking_count: blockingFindings.length,
      warning_count: warnings.length,
      deferred_count: deferredFindings.length,
      fallback_behavior_count: findings.filter(
        (finding) => finding.fallback_behavior.length > 0,
      ).length,
      safe_default_count: findings.filter(
        (finding) => finding.safe_default.length > 0,
      ).length,
      recovery_guidance_count: findings.filter(
        (finding) => finding.recovery_guidance.length > 0,
      ).length,
      user_visible_error_count: findings.filter(
        (finding) => finding.user_visible_error_posture.length > 0,
      ).length,
      audit_log_posture_count: findings.filter((finding) =>
        finding.audit_log_posture.includes("metadata-only"),
      ).length,
      cloud_gated_posture_count: findings.filter((finding) =>
        finding.cloud_fallback_posture.includes("governance-gated"),
      ).length,
      unsafe_auto_recovery_count: 0,
      failed_finding_count: findings.filter((finding) => !finding.passed)
        .length,
      phase20f_recovery_audit_only: true,
      phase20f_capability_neutral: true,
      posture: POSTURE,
    },
    final_recovery_statement: allFailureModesCovered
      ? "Phase 20F recovery and fallback posture is represented as deterministic metadata only; no recovery action, runtime check, provider call, or automation is enabled."
      : "Phase 20F recovery and fallback posture is incomplete and requires metadata coverage review.",
    posture: POSTURE,
  });
}
