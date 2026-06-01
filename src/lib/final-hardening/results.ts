import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  HardeningSeveritySchema,
  HardeningSurfaceIdSchema,
  type FinalHardeningPosture,
  type HardeningSurfaceId,
} from "./contracts";
import {
  FailureModeBlockingPostureSchema,
  FinalFailureModeIdSchema,
  getFinalFailureModeRegistry,
  type FailureModeBlockingPosture,
  type FinalFailureModeId,
  type FinalFailureModeRecord,
} from "./failure-modes";
import { getHardeningSurfaces } from "./registry";

export const FINAL_HARDENING_RESULTS_VERSION = "20F.3" as const;

export const FINAL_HARDENING_STATUSES = [
  "pass",
  "fail",
  "warning",
  "pending",
  "skipped",
  "deferred",
] as const;

export const FINAL_HARDENING_OBSERVED_FALLBACK_PLACEHOLDERS = [
  "not_evaluated",
  "metadata_observation_supplied",
] as const;

export type FinalHardeningStatus = (typeof FINAL_HARDENING_STATUSES)[number];
export type FinalHardeningObservedFallbackPlaceholder =
  (typeof FINAL_HARDENING_OBSERVED_FALLBACK_PLACEHOLDERS)[number];

export const FinalHardeningStatusSchema = z.enum(FINAL_HARDENING_STATUSES);
export const FinalHardeningObservedFallbackPlaceholderSchema = z.enum(
  FINAL_HARDENING_OBSERVED_FALLBACK_PLACEHOLDERS,
);

export const FinalHardeningRemediationHintSchema = z.strictObject({
  hint_id: z.string().trim().min(1).max(180),
  failure_mode_id: FinalFailureModeIdSchema,
  guidance: z.string().trim().min(1).max(560),
  manual_only: z.literal(true),
  automation_enabled: z.literal(false),
  posture: FinalHardeningPostureSchema,
});

export const FinalHardeningFindingSchema = z.strictObject({
  finding_id: z.string().trim().min(1).max(180),
  failure_mode_id: FinalFailureModeIdSchema,
  hardening_surface_id: HardeningSurfaceIdSchema,
  status: FinalHardeningStatusSchema,
  severity: HardeningSeveritySchema,
  finding_summary: z.string().trim().min(1).max(640),
  blocking: z.boolean(),
  deferred_limitation_posture: z.string().trim().min(1).max(560),
  posture: FinalHardeningPostureSchema,
});

export const FinalHardeningResultSchema = z.strictObject({
  result_id: z.string().trim().min(1).max(180),
  failure_mode_id: FinalFailureModeIdSchema,
  hardening_surface_id: HardeningSurfaceIdSchema,
  status: FinalHardeningStatusSchema,
  severity: HardeningSeveritySchema,
  expected_fallback_behavior: z.string().trim().min(1).max(560),
  observed_fallback_placeholder:
    FinalHardeningObservedFallbackPlaceholderSchema,
  safe_default: z.string().trim().min(1).max(560),
  user_visible_error_posture: z.string().trim().min(1).max(560),
  audit_log_posture: z.string().trim().min(1).max(560),
  recovery_guidance: z.array(z.string().trim().min(1).max(260)).min(1),
  blocking_posture: FailureModeBlockingPostureSchema,
  blocking: z.boolean(),
  remediation_hint: FinalHardeningRemediationHintSchema,
  finding: FinalHardeningFindingSchema,
  deferred_limitation_posture: z.string().trim().min(1).max(560),
  posture: FinalHardeningPostureSchema,
});

export const FinalHardeningResultsSchema = z.array(FinalHardeningResultSchema);

export const FinalHardeningRunSummarySchema = z.strictObject({
  results_version: z.literal(FINAL_HARDENING_RESULTS_VERSION),
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
  blocking_result_count: z.number().int().nonnegative(),
  represented_failure_mode_count: z.number().int().nonnegative(),
  represented_surface_count: z.number().int().nonnegative(),
  remediation_hint_count: z.number().int().nonnegative(),
  phase20f_result_model_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export type FinalHardeningRemediationHint = z.infer<
  typeof FinalHardeningRemediationHintSchema
>;
export type FinalHardeningFinding = z.infer<typeof FinalHardeningFindingSchema>;
export type FinalHardeningResult = z.infer<typeof FinalHardeningResultSchema>;
export type FinalHardeningRunSummary = z.infer<
  typeof FinalHardeningRunSummarySchema
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

function copyResult(result: FinalHardeningResult): FinalHardeningResult {
  return FinalHardeningResultSchema.parse(JSON.parse(JSON.stringify(result)));
}

function isBlockingPosture(
  blockingPosture: FailureModeBlockingPosture,
): boolean {
  return ["blocks_startup", "blocks_surface"].includes(blockingPosture);
}

function resultIdFor(failureModeId: FinalFailureModeId): string {
  return `final-hardening-result:${failureModeId.replace(
    "final-failure-mode:",
    "",
  )}`;
}

function findingIdFor(failureModeId: FinalFailureModeId): string {
  return `final-hardening-finding:${failureModeId.replace(
    "final-failure-mode:",
    "",
  )}`;
}

function hintIdFor(failureModeId: FinalFailureModeId): string {
  return `final-hardening-remediation:${failureModeId.replace(
    "final-failure-mode:",
    "",
  )}`;
}

function createPendingResult(
  failureMode: FinalFailureModeRecord,
): FinalHardeningResult {
  const blocking = isBlockingPosture(failureMode.blocking_posture);
  const remediationHint = FinalHardeningRemediationHintSchema.parse({
    hint_id: hintIdFor(failureMode.failure_id),
    failure_mode_id: failureMode.failure_id,
    guidance: `Manual remediation only: ${failureMode.recovery_guidance[0]}`,
    manual_only: true,
    automation_enabled: false,
    posture: POSTURE,
  });
  const finding = FinalHardeningFindingSchema.parse({
    finding_id: findingIdFor(failureMode.failure_id),
    failure_mode_id: failureMode.failure_id,
    hardening_surface_id: failureMode.hardening_surface_id,
    status: "pending",
    severity: failureMode.severity,
    finding_summary:
      "Pending final hardening placeholder; no hardening check has executed.",
    blocking,
    deferred_limitation_posture: failureMode.deferred_limitation_posture,
    posture: POSTURE,
  });

  return FinalHardeningResultSchema.parse({
    result_id: resultIdFor(failureMode.failure_id),
    failure_mode_id: failureMode.failure_id,
    hardening_surface_id: failureMode.hardening_surface_id,
    status: "pending",
    severity: failureMode.severity,
    expected_fallback_behavior: failureMode.expected_fallback_behavior,
    observed_fallback_placeholder: "not_evaluated",
    safe_default: failureMode.safe_default,
    user_visible_error_posture: failureMode.user_visible_error_posture,
    audit_log_posture: failureMode.audit_log_posture,
    recovery_guidance: [...failureMode.recovery_guidance],
    blocking_posture: failureMode.blocking_posture,
    blocking,
    remediation_hint: remediationHint,
    finding,
    deferred_limitation_posture: failureMode.deferred_limitation_posture,
    posture: POSTURE,
  });
}

function assertResultsAlignWithHardeningSurfaces(
  failureModes: readonly FinalFailureModeRecord[],
): void {
  const knownSurfaceIds = new Set(
    getHardeningSurfaces().map((surface) => surface.surface_id),
  );

  for (const failureMode of failureModes) {
    if (!knownSurfaceIds.has(failureMode.hardening_surface_id)) {
      throw new Error(
        `Failure mode ${failureMode.failure_id} references unknown hardening surface ${failureMode.hardening_surface_id}`,
      );
    }
  }
}

export function createPendingFinalHardeningResults(): readonly FinalHardeningResult[] {
  const failureModes = getFinalFailureModeRegistry();
  assertResultsAlignWithHardeningSurfaces(failureModes);

  return failureModes.map(createPendingResult).map(copyResult);
}

export function summarizeFinalHardeningResults(
  results: readonly FinalHardeningResult[],
): FinalHardeningRunSummary {
  const parsedResults = results.map((result) =>
    FinalHardeningResultSchema.parse(result),
  );
  const failureModeIds = new Set(
    parsedResults.map((result) => result.failure_mode_id),
  );
  const surfaceIds = new Set(
    parsedResults.map((result) => result.hardening_surface_id),
  );

  return FinalHardeningRunSummarySchema.parse({
    results_version: FINAL_HARDENING_RESULTS_VERSION,
    result_count: parsedResults.length,
    pass_count: parsedResults.filter((result) => result.status === "pass")
      .length,
    fail_count: parsedResults.filter((result) => result.status === "fail")
      .length,
    warning_count: parsedResults.filter((result) => result.status === "warning")
      .length,
    pending_count: parsedResults.filter((result) => result.status === "pending")
      .length,
    skipped_count: parsedResults.filter((result) => result.status === "skipped")
      .length,
    deferred_count: parsedResults.filter(
      (result) => result.status === "deferred",
    ).length,
    critical_count: parsedResults.filter(
      (result) => result.severity === "critical",
    ).length,
    high_count: parsedResults.filter((result) => result.severity === "high")
      .length,
    medium_count: parsedResults.filter((result) => result.severity === "medium")
      .length,
    low_count: parsedResults.filter((result) => result.severity === "low")
      .length,
    blocking_result_count: parsedResults.filter((result) => result.blocking)
      .length,
    represented_failure_mode_count: failureModeIds.size,
    represented_surface_count: surfaceIds.size,
    remediation_hint_count: parsedResults.filter(
      (result) => result.remediation_hint.manual_only,
    ).length,
    phase20f_result_model_only: true,
    phase20f_capability_neutral: true,
    posture: POSTURE,
  });
}

export function getFinalHardeningResultsByStatus(
  results: readonly FinalHardeningResult[],
  status: FinalHardeningStatus,
): readonly FinalHardeningResult[] {
  return results
    .map((result) => FinalHardeningResultSchema.parse(result))
    .filter((result) => result.status === status)
    .map(copyResult);
}

export function getBlockingFinalHardeningResults(
  results: readonly FinalHardeningResult[],
): readonly FinalHardeningResult[] {
  return results
    .map((result) => FinalHardeningResultSchema.parse(result))
    .filter((result) => result.blocking)
    .map(copyResult);
}

export function getFinalHardeningResultsBySurface(
  results: readonly FinalHardeningResult[],
  surfaceId: HardeningSurfaceId,
): readonly FinalHardeningResult[] {
  return results
    .map((result) => FinalHardeningResultSchema.parse(result))
    .filter((result) => result.hardening_surface_id === surfaceId)
    .map(copyResult);
}

export function getFinalHardeningResultsByFailureMode(
  results: readonly FinalHardeningResult[],
  failureModeId: FinalFailureModeId,
): readonly FinalHardeningResult[] {
  return results
    .map((result) => FinalHardeningResultSchema.parse(result))
    .filter((result) => result.failure_mode_id === failureModeId)
    .map(copyResult);
}
