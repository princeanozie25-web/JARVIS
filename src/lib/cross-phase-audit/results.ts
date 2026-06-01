import { z } from "zod";

import {
  AuditDimensionIdSchema,
  AuditExpectationIdSchema,
  AuditSeveritySchema,
  AuditSurfaceIdSchema,
  CrossPhaseAuditPostureSchema,
  type AuditDimensionId,
  type AuditDimension,
  type AuditSurfaceId,
  type CrossPhaseAuditPosture,
} from "./contracts";
import {
  AuditEvidenceIdSchema,
  CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY,
  type AuditEvidenceId,
  type AuditEvidenceRecord,
} from "./evidence";
import { CROSS_PHASE_AUDIT_CONTRACT } from "./registry";

export const CROSS_PHASE_AUDIT_RESULTS_VERSION = "20E.3" as const;

export const CROSS_PHASE_AUDIT_STATUSES = [
  "pass",
  "fail",
  "warning",
  "pending",
  "skipped",
  "deferred",
] as const;

export type CrossPhaseAuditStatus = (typeof CROSS_PHASE_AUDIT_STATUSES)[number];

export const CrossPhaseAuditStatusSchema = z.enum(CROSS_PHASE_AUDIT_STATUSES);

export const CrossPhaseAuditFindingSchema = z.strictObject({
  summary: z.string().trim().min(1).max(420),
  expected_posture: z.string().trim().min(1).max(420),
  observed_posture_placeholder: z.string().trim().min(1).max(420),
});

export const CrossPhaseAuditRemediationHintSchema = z.strictObject({
  summary: z.string().trim().min(1).max(420),
  blocking_resolution_required: z.boolean(),
  deferred_resolution_allowed: z.boolean(),
});

export const CrossPhaseAuditResultSchema = z.strictObject({
  result_id: z.string().trim().min(1).max(220),
  audit_surface_id: AuditSurfaceIdSchema,
  audit_dimension_id: AuditDimensionIdSchema,
  audit_expectation_id: AuditExpectationIdSchema,
  status: CrossPhaseAuditStatusSchema,
  severity: AuditSeveritySchema,
  evidence_ids: z.array(AuditEvidenceIdSchema),
  finding: CrossPhaseAuditFindingSchema,
  remediation_hint: CrossPhaseAuditRemediationHintSchema,
  blocking: z.boolean(),
  deferred_limitation_posture: z.string().trim().min(1).max(420),
  posture: CrossPhaseAuditPostureSchema,
});

export const CrossPhaseAuditRunSummarySchema = z.strictObject({
  results_version: z.literal(CROSS_PHASE_AUDIT_RESULTS_VERSION),
  result_count: z.number().int().nonnegative(),
  pass_count: z.number().int().nonnegative(),
  fail_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  pending_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  critical_count: z.number().int().nonnegative(),
  high_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  low_count: z.number().int().nonnegative(),
  blocking_count: z.number().int().nonnegative(),
  represented_surface_count: z.number().int().nonnegative(),
  represented_dimension_count: z.number().int().nonnegative(),
  evidence_reference_count: z.number().int().nonnegative(),
  phase20e_result_model_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export type CrossPhaseAuditFinding = z.infer<
  typeof CrossPhaseAuditFindingSchema
>;
export type CrossPhaseAuditRemediationHint = z.infer<
  typeof CrossPhaseAuditRemediationHintSchema
>;
export type CrossPhaseAuditResult = z.infer<typeof CrossPhaseAuditResultSchema>;
export type CrossPhaseAuditRunSummary = z.infer<
  typeof CrossPhaseAuditRunSummarySchema
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

function copyResult(result: CrossPhaseAuditResult): CrossPhaseAuditResult {
  return CrossPhaseAuditResultSchema.parse(JSON.parse(JSON.stringify(result)));
}

function normalizeResults(
  results: readonly CrossPhaseAuditResult[],
): readonly CrossPhaseAuditResult[] {
  return results.map((result) => CrossPhaseAuditResultSchema.parse(result));
}

function getEvidenceIdsForResult(
  evidence: readonly AuditEvidenceRecord[],
  surfaceId: AuditSurfaceId,
  dimensionId: AuditDimensionId,
): AuditEvidenceId[] {
  const exactEvidenceIds = evidence
    .filter(
      (record) =>
        record.related_audit_surface_ids.includes(surfaceId) &&
        record.audit_dimension_ids.includes(dimensionId),
    )
    .map((record) => record.evidence_id);

  if (exactEvidenceIds.length > 0) {
    return exactEvidenceIds;
  }

  return evidence
    .filter(
      (record) =>
        record.related_audit_surface_ids.includes(surfaceId) ||
        record.audit_dimension_ids.includes(dimensionId),
    )
    .map((record) => record.evidence_id);
}

function buildPendingResult(
  surfaceId: AuditSurfaceId,
  dimension: AuditDimension,
  evidence: readonly AuditEvidenceRecord[],
): CrossPhaseAuditResult {
  return CrossPhaseAuditResultSchema.parse({
    result_id: `audit-result:${surfaceId}:${dimension.dimension_id}`,
    audit_surface_id: surfaceId,
    audit_dimension_id: dimension.dimension_id,
    audit_expectation_id: dimension.expectation_id,
    status: "pending",
    severity: dimension.severity,
    evidence_ids: getEvidenceIdsForResult(
      evidence,
      surfaceId,
      dimension.dimension_id,
    ),
    finding: {
      summary:
        "Pending final cross-phase audit result placeholder; no audit has been executed.",
      expected_posture: dimension.audit_goal,
      observed_posture_placeholder:
        "Observation intentionally absent until a future audit evaluator supplies metadata-only findings.",
    },
    remediation_hint: {
      summary:
        "Run a future approved metadata-only audit evaluator and attach findings without raw payloads or side effects.",
      blocking_resolution_required: false,
      deferred_resolution_allowed: true,
    },
    blocking: false,
    deferred_limitation_posture:
      "Result is pending by design; Phase 20E.3 defines contracts only and does not inspect or execute anything.",
    posture: POSTURE,
  });
}

export function createPendingCrossPhaseAuditResults(): readonly CrossPhaseAuditResult[] {
  const contract = CROSS_PHASE_AUDIT_CONTRACT;
  const evidence = CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence;
  const dimensionsById = new Map(
    contract.dimensions.map((dimension) => [dimension.dimension_id, dimension]),
  );

  return contract.surfaces.flatMap((surface) =>
    surface.dimension_ids.map((dimensionId) => {
      const dimension = dimensionsById.get(dimensionId);

      if (!dimension) {
        throw new Error(`Unknown audit dimension for result: ${dimensionId}`);
      }

      return buildPendingResult(surface.surface_id, dimension, evidence);
    }),
  );
}

export function summarizeCrossPhaseAuditResults(
  results: readonly CrossPhaseAuditResult[],
): CrossPhaseAuditRunSummary {
  const normalizedResults = normalizeResults(results);

  return CrossPhaseAuditRunSummarySchema.parse({
    results_version: CROSS_PHASE_AUDIT_RESULTS_VERSION,
    result_count: normalizedResults.length,
    pass_count: normalizedResults.filter((result) => result.status === "pass")
      .length,
    fail_count: normalizedResults.filter((result) => result.status === "fail")
      .length,
    warning_count: normalizedResults.filter(
      (result) => result.status === "warning",
    ).length,
    pending_count: normalizedResults.filter(
      (result) => result.status === "pending",
    ).length,
    skipped_count: normalizedResults.filter(
      (result) => result.status === "skipped",
    ).length,
    deferred_count: normalizedResults.filter(
      (result) => result.status === "deferred",
    ).length,
    critical_count: normalizedResults.filter(
      (result) => result.severity === "critical",
    ).length,
    high_count: normalizedResults.filter((result) => result.severity === "high")
      .length,
    medium_count: normalizedResults.filter(
      (result) => result.severity === "medium",
    ).length,
    low_count: normalizedResults.filter((result) => result.severity === "low")
      .length,
    blocking_count: normalizedResults.filter((result) => result.blocking)
      .length,
    represented_surface_count: new Set(
      normalizedResults.map((result) => result.audit_surface_id),
    ).size,
    represented_dimension_count: new Set(
      normalizedResults.map((result) => result.audit_dimension_id),
    ).size,
    evidence_reference_count: normalizedResults.reduce(
      (count, result) => count + result.evidence_ids.length,
      0,
    ),
    phase20e_result_model_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}

export function getCrossPhaseAuditResultsByStatus(
  results: readonly CrossPhaseAuditResult[],
  status: CrossPhaseAuditStatus,
): readonly CrossPhaseAuditResult[] {
  return normalizeResults(results)
    .filter((result) => result.status === status)
    .map(copyResult);
}

export function getBlockingCrossPhaseAuditResults(
  results: readonly CrossPhaseAuditResult[],
): readonly CrossPhaseAuditResult[] {
  return normalizeResults(results)
    .filter((result) => result.blocking)
    .map(copyResult);
}

export function getCrossPhaseAuditResultsBySurface(
  results: readonly CrossPhaseAuditResult[],
  surfaceId: AuditSurfaceId,
): readonly CrossPhaseAuditResult[] {
  return normalizeResults(results)
    .filter((result) => result.audit_surface_id === surfaceId)
    .map(copyResult);
}

export function getCrossPhaseAuditResultsByDimension(
  results: readonly CrossPhaseAuditResult[],
  dimensionId: AuditDimensionId,
): readonly CrossPhaseAuditResult[] {
  return normalizeResults(results)
    .filter((result) => result.audit_dimension_id === dimensionId)
    .map(copyResult);
}
