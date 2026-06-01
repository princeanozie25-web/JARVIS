import { z } from "zod";

import {
  FINAL_HARDENING_CONTRACT_VERSION,
  FinalHardeningPostureSchema,
  type FinalHardeningPosture,
} from "./contracts";
import {
  FINAL_FAILURE_MODE_REGISTRY_VERSION,
  FinalFailureModeIdSchema,
  getFinalFailureModeRegistry,
  type FailureModeBlockingPosture,
  type FinalFailureModeId,
} from "./failure-modes";
import { getFinalHardeningContract } from "./registry";
import {
  FINAL_HARDENING_RESULTS_VERSION,
  FinalHardeningResultSchema,
  FinalHardeningResultsSchema,
  FinalHardeningRunSummarySchema,
  FinalHardeningStatusSchema,
  createPendingFinalHardeningResults,
  summarizeFinalHardeningResults,
  type FinalHardeningResult,
  type FinalHardeningRunSummary,
  type FinalHardeningStatus,
} from "./results";

export const FINAL_HARDENING_EVALUATOR_VERSION = "20F.4" as const;

export const FinalHardeningObservationSchema = z.strictObject({
  failure_mode_id: FinalFailureModeIdSchema,
  status: FinalHardeningStatusSchema,
  observed_fallback_posture: z.string().trim().min(1).max(360).optional(),
  finding_summary: z.string().trim().min(1).max(640).optional(),
  remediation_guidance: z.string().trim().min(1).max(560).optional(),
  deferred_limitation_posture: z.string().trim().min(1).max(560).optional(),
});

export const FinalHardeningEvaluatorInputSchema = z.strictObject({
  observations: z.array(FinalHardeningObservationSchema).default([]),
  source: z.literal("phase-20f4-supplied-metadata-observations").optional(),
});

export const FinalHardeningEvaluationSchema = z.strictObject({
  evaluator_version: z.literal(FINAL_HARDENING_EVALUATOR_VERSION),
  evaluation_id: z.literal("phase-20f4-final-hardening-evaluation"),
  source: z.literal("metadata_only"),
  contract_version: z.literal(FINAL_HARDENING_CONTRACT_VERSION),
  failure_mode_registry_version: z.literal(FINAL_FAILURE_MODE_REGISTRY_VERSION),
  result_model_version: z.literal(FINAL_HARDENING_RESULTS_VERSION),
  input_observation_count: z.number().int().nonnegative(),
  evaluated_observation_count: z.number().int().nonnegative(),
  results: FinalHardeningResultsSchema,
  summary: FinalHardeningRunSummarySchema,
  posture: FinalHardeningPostureSchema,
});

export type FinalHardeningObservation = z.infer<
  typeof FinalHardeningObservationSchema
>;
export type FinalHardeningEvaluatorInput = z.infer<
  typeof FinalHardeningEvaluatorInputSchema
>;
export type FinalHardeningEvaluation = z.infer<
  typeof FinalHardeningEvaluationSchema
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

function isBlockingStatus(
  status: FinalHardeningStatus,
  blockingPosture: FailureModeBlockingPosture,
): boolean {
  return (
    ["fail", "pending"].includes(status) &&
    ["blocks_startup", "blocks_surface"].includes(blockingPosture)
  );
}

function defaultFindingSummary(
  title: string,
  status: FinalHardeningStatus,
): string {
  switch (status) {
    case "pass":
      return `${title} satisfies final hardening metadata observation.`;
    case "fail":
      return `${title} failed final hardening metadata observation.`;
    case "warning":
      return `${title} produced a non-blocking final hardening warning.`;
    case "deferred":
      return `${title} remains deferred by final hardening posture.`;
    case "skipped":
      return `${title} was skipped by explicit metadata observation.`;
    case "pending":
      return `${title} remains pending final hardening evaluation.`;
  }
}

function applyObservation(
  result: FinalHardeningResult,
  observation: FinalHardeningObservation,
  titleByFailureMode: ReadonlyMap<FinalFailureModeId, string>,
): FinalHardeningResult {
  const title =
    titleByFailureMode.get(observation.failure_mode_id) ?? "Failure mode";
  const status = observation.status;
  const blocking = isBlockingStatus(status, result.blocking_posture);
  const deferredLimitationPosture =
    observation.deferred_limitation_posture ??
    result.deferred_limitation_posture;
  const findingSummary =
    observation.finding_summary ?? defaultFindingSummary(title, status);
  const remediationGuidance =
    observation.remediation_guidance ?? result.remediation_hint.guidance;

  return FinalHardeningResultSchema.parse({
    ...result,
    status,
    observed_fallback_placeholder: "metadata_observation_supplied",
    blocking,
    remediation_hint: {
      ...result.remediation_hint,
      guidance: remediationGuidance,
    },
    finding: {
      ...result.finding,
      status,
      finding_summary: findingSummary,
      blocking,
      deferred_limitation_posture: deferredLimitationPosture,
    },
    deferred_limitation_posture: deferredLimitationPosture,
  });
}

export function evaluateFinalHardening(
  input?: FinalHardeningEvaluatorInput,
): FinalHardeningEvaluation {
  const parsedInput = FinalHardeningEvaluatorInputSchema.parse(
    input ?? { observations: [] },
  );
  const contract = getFinalHardeningContract();
  const failureModes = getFinalFailureModeRegistry();
  const titleByFailureMode = new Map(
    failureModes.map((failureMode) => [
      failureMode.failure_id,
      failureMode.title,
    ]),
  );
  const observationsByFailureMode = new Map(
    parsedInput.observations.map((observation) => [
      observation.failure_mode_id,
      observation,
    ]),
  );
  const results = createPendingFinalHardeningResults().map((result) => {
    const observation = observationsByFailureMode.get(result.failure_mode_id);

    return observation
      ? applyObservation(result, observation, titleByFailureMode)
      : copyResult(result);
  });
  const evaluatedObservationCount = results.filter((result) =>
    observationsByFailureMode.has(result.failure_mode_id),
  ).length;
  const summary: FinalHardeningRunSummary =
    summarizeFinalHardeningResults(results);

  return FinalHardeningEvaluationSchema.parse({
    evaluator_version: FINAL_HARDENING_EVALUATOR_VERSION,
    evaluation_id: "phase-20f4-final-hardening-evaluation",
    source: "metadata_only",
    contract_version: contract.contract_version,
    failure_mode_registry_version: FINAL_FAILURE_MODE_REGISTRY_VERSION,
    result_model_version: FINAL_HARDENING_RESULTS_VERSION,
    input_observation_count: parsedInput.observations.length,
    evaluated_observation_count: evaluatedObservationCount,
    results,
    summary,
    posture: POSTURE,
  });
}
