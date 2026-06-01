import { z } from "zod";

import {
  AuditDimensionIdSchema,
  AuditSurfaceIdSchema,
  CrossPhaseAuditPostureSchema,
  type CrossPhaseAuditPosture,
} from "./contracts";
import {
  CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY,
  type AuditEvidenceRecord,
} from "./evidence";
import {
  CrossPhaseAuditResultSchema,
  CrossPhaseAuditRunSummarySchema,
  createPendingCrossPhaseAuditResults,
  summarizeCrossPhaseAuditResults,
  type CrossPhaseAuditResult,
  type CrossPhaseAuditStatus,
} from "./results";
import {
  buildFinalGovernanceReadinessSummary,
  buildPhase20ACloseoutReport,
} from "../final-system-status";
import { buildPhase20BCloseoutReport } from "../bootstrap-readiness";
import { buildPhase20CCloseoutReport } from "../onboarding-readiness";
import { buildPhase20DCloseoutReport } from "../portfolio-readiness";

export const CROSS_PHASE_AUDIT_EVALUATOR_VERSION = "20E.4" as const;

export const CrossPhaseAuditEvaluatorInputSchema = z.strictObject({
  surface_ids: z.array(AuditSurfaceIdSchema).optional(),
  dimension_ids: z.array(AuditDimensionIdSchema).optional(),
  include_deferred_results: z.boolean().optional(),
});

export const CrossPhaseAuditEvaluationSourceMetadataSchema = z.strictObject({
  evaluator_version: z.literal(CROSS_PHASE_AUDIT_EVALUATOR_VERSION),
  contract_version: z.literal("20E.1"),
  evidence_registry_version: z.literal("20E.2"),
  result_model_version: z.literal("20E.3"),
  phase20a_complete: z.boolean(),
  phase20b_complete: z.boolean(),
  phase20c_complete: z.boolean(),
  phase20d_complete: z.boolean(),
  governance_ready: z.boolean(),
  source_modules_metadata_only: z.literal(true),
});

export const CrossPhaseAuditEvaluationSchema = z.strictObject({
  evaluator_version: z.literal(CROSS_PHASE_AUDIT_EVALUATOR_VERSION),
  evaluation_id: z.literal("phase-20e4-cross-phase-audit-evaluation"),
  phase: z.literal("20E.4"),
  input: CrossPhaseAuditEvaluatorInputSchema,
  results: z.array(CrossPhaseAuditResultSchema),
  summary: CrossPhaseAuditRunSummarySchema,
  blocking_findings: z.array(CrossPhaseAuditResultSchema),
  source_metadata: CrossPhaseAuditEvaluationSourceMetadataSchema,
  posture: CrossPhaseAuditPostureSchema,
});

export type CrossPhaseAuditEvaluatorInput = z.infer<
  typeof CrossPhaseAuditEvaluatorInputSchema
>;
export type CrossPhaseAuditEvaluationSourceMetadata = z.infer<
  typeof CrossPhaseAuditEvaluationSourceMetadataSchema
>;
export type CrossPhaseAuditEvaluation = z.infer<
  typeof CrossPhaseAuditEvaluationSchema
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

function sourceMetadata(): CrossPhaseAuditEvaluationSourceMetadata {
  const phase20a = buildPhase20ACloseoutReport();
  const phase20b = buildPhase20BCloseoutReport();
  const phase20c = buildPhase20CCloseoutReport();
  const phase20d = buildPhase20DCloseoutReport();
  const governance = buildFinalGovernanceReadinessSummary();

  return CrossPhaseAuditEvaluationSourceMetadataSchema.parse({
    evaluator_version: CROSS_PHASE_AUDIT_EVALUATOR_VERSION,
    contract_version: "20E.1",
    evidence_registry_version: "20E.2",
    result_model_version: "20E.3",
    phase20a_complete: phase20a.phase20a_complete,
    phase20b_complete: phase20b.phase_20b_complete,
    phase20c_complete: phase20c.phase_20c_complete,
    phase20d_complete: phase20d.phase_20d_complete,
    governance_ready: governance.governance_ready_for_phase20_hardening,
    source_modules_metadata_only: true,
  });
}

function evidenceForResult(
  result: CrossPhaseAuditResult,
): readonly AuditEvidenceRecord[] {
  const evidenceById = new Map(
    CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence.map((record) => [
      record.evidence_id,
      record,
    ]),
  );

  return result.evidence_ids.flatMap((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    return evidence ? [evidence] : [];
  });
}

function determineStatus(
  result: CrossPhaseAuditResult,
  evidence: readonly AuditEvidenceRecord[],
  metadata: CrossPhaseAuditEvaluationSourceMetadata,
): CrossPhaseAuditStatus {
  const closeoutsReady =
    metadata.phase20a_complete &&
    metadata.phase20b_complete &&
    metadata.phase20c_complete &&
    metadata.phase20d_complete &&
    metadata.governance_ready;

  if (!closeoutsReady || evidence.length === 0) {
    return "pending";
  }

  const exactEvidence = evidence.filter(
    (record) =>
      record.related_audit_surface_ids.includes(result.audit_surface_id) &&
      record.audit_dimension_ids.includes(result.audit_dimension_id),
  );

  if (
    result.audit_dimension_id === "audit-dimension:disabled-features" ||
    exactEvidence.some(
      (record) => record.authority_posture === "deferred_disabled_reference",
    )
  ) {
    return "deferred";
  }

  if (
    (exactEvidence.length > 0 ? exactEvidence : evidence).every(
      (record) => record.confidence === "medium",
    )
  ) {
    return "warning";
  }

  return "pass";
}

function findingSummary(status: CrossPhaseAuditStatus): string {
  if (status === "pass") {
    return "Existing metadata evidence supports this audit expectation without live inspection.";
  }

  if (status === "warning") {
    return "Existing metadata evidence supports this expectation with lower-confidence or visibility-only evidence.";
  }

  if (status === "deferred") {
    return "Existing metadata evidence confirms this surface remains intentionally deferred or disabled.";
  }

  return "Existing metadata is incomplete for this expectation; no live audit was executed.";
}

function remediationSummary(status: CrossPhaseAuditStatus): string {
  if (status === "pass") {
    return "No remediation is required by the metadata-only evaluator.";
  }

  if (status === "warning") {
    return "Review the supporting metadata during the final manual audit sweep before treating this as fully closed.";
  }

  if (status === "deferred") {
    return "Preserve the deferred or disabled posture unless a future architecture amendment explicitly changes it.";
  }

  return "Attach approved metadata evidence in a future audit slice without filesystem, runtime, provider, or network inspection.";
}

function evaluateResult(
  result: CrossPhaseAuditResult,
  metadata: CrossPhaseAuditEvaluationSourceMetadata,
): CrossPhaseAuditResult {
  const evidence = evidenceForResult(result);
  const status = determineStatus(result, evidence, metadata);
  const blocking =
    status === "fail" &&
    (result.severity === "critical" || result.severity === "high");

  return CrossPhaseAuditResultSchema.parse({
    ...result,
    status,
    finding: {
      summary: findingSummary(status),
      expected_posture: result.finding.expected_posture,
      observed_posture_placeholder:
        "Observed posture is derived only from existing typed metadata registries, closeouts, and readiness summaries.",
    },
    remediation_hint: {
      summary: remediationSummary(status),
      blocking_resolution_required: blocking,
      deferred_resolution_allowed:
        status === "deferred" || status === "pending",
    },
    blocking,
    deferred_limitation_posture:
      status === "deferred"
        ? "Deferred posture is intentional and sourced from existing disabled-feature or onboarding metadata."
        : "No live audit evidence was collected; evaluator output is metadata-derived only.",
    posture: POSTURE,
  });
}

function filterResults(
  results: readonly CrossPhaseAuditResult[],
  input: CrossPhaseAuditEvaluatorInput,
): readonly CrossPhaseAuditResult[] {
  const surfaceIds = new Set(input.surface_ids ?? []);
  const dimensionIds = new Set(input.dimension_ids ?? []);
  const includeDeferredResults = input.include_deferred_results ?? true;

  return results.filter((result) => {
    if (surfaceIds.size > 0 && !surfaceIds.has(result.audit_surface_id)) {
      return false;
    }

    if (dimensionIds.size > 0 && !dimensionIds.has(result.audit_dimension_id)) {
      return false;
    }

    return includeDeferredResults || result.status !== "deferred";
  });
}

export function evaluateCrossPhaseAudit(
  input: CrossPhaseAuditEvaluatorInput = {},
): CrossPhaseAuditEvaluation {
  const parsedInput = CrossPhaseAuditEvaluatorInputSchema.parse(input);
  const metadata = sourceMetadata();
  const evaluatedResults = createPendingCrossPhaseAuditResults().map((result) =>
    evaluateResult(result, metadata),
  );
  const results = filterResults(evaluatedResults, parsedInput);
  const summary = summarizeCrossPhaseAuditResults(results);

  return CrossPhaseAuditEvaluationSchema.parse({
    evaluator_version: CROSS_PHASE_AUDIT_EVALUATOR_VERSION,
    evaluation_id: "phase-20e4-cross-phase-audit-evaluation",
    phase: "20E.4",
    input: parsedInput,
    results,
    summary,
    blocking_findings: results.filter((result) => result.blocking),
    source_metadata: metadata,
    posture: POSTURE,
  });
}
