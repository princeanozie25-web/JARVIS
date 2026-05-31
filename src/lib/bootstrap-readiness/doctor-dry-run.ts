import { z } from "zod";

import {
  DOCTOR_CHECK_REGISTRY_VERSION,
  DoctorCheckIdSchema,
  type DoctorCheck,
  type DoctorCheckId,
} from "./doctor-checks";
import { getDoctorCheckRegistry } from "./doctor-checks";
import {
  DOCTOR_RESULT_CONTRACT_VERSION,
  DoctorCheckResultSchema,
  DoctorCheckStatusSchema,
  DoctorObservedPostureSchema,
  DoctorRemediationHintSchema,
  DoctorResultSourceSchema,
  DoctorRunSummarySchema,
  createPendingDoctorResults,
  summarizeDoctorResults,
  type DoctorCheckResult,
  type DoctorObservedPosture,
  type DoctorRemediationHint,
  type DoctorResultSource,
  type DoctorRunSummary,
} from "./doctor-results";

export const DOCTOR_DRY_RUN_EVALUATOR_VERSION = "20B.4" as const;

export const DoctorDryRunObservedPostureInputSchema = z.strictObject({
  local_first: z.boolean().nullable(),
  cloud_gated: z.boolean().nullable(),
  disabled_by_default: z.boolean().nullable(),
  provider_disabled_by_default: z.boolean().nullable(),
});

export const DoctorDryRunObservationSchema = z.strictObject({
  check_id: DoctorCheckIdSchema,
  status: DoctorCheckStatusSchema,
  observed_at: z.string().trim().min(1).max(80).nullable(),
  observed_posture: DoctorDryRunObservedPostureInputSchema.nullable(),
  remediation_summary: z.string().trim().min(1).max(300).nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  filesystem_inspection_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const DoctorDryRunInputSchema = z.strictObject({
  observations: z.array(DoctorDryRunObservationSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  dry_run_only: z.literal(true),
  input_driven_only: z.literal(true),
  filesystem_inspection_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export const DoctorDryRunEvaluationSchema = z.strictObject({
  evaluator_version: z.literal(DOCTOR_DRY_RUN_EVALUATOR_VERSION),
  source_registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  result_contract_version: z.literal(DOCTOR_RESULT_CONTRACT_VERSION),
  results: z.array(DoctorCheckResultSchema),
  summary: DoctorRunSummarySchema,
  input_observation_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  dry_run_only: z.literal(true),
  input_driven_only: z.literal(true),
  real_environment_inspected: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  approval_bypass_created: z.literal(false),
  ui_route_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export type DoctorDryRunObservedPostureInput = z.infer<
  typeof DoctorDryRunObservedPostureInputSchema
>;
export type DoctorDryRunObservation = z.infer<
  typeof DoctorDryRunObservationSchema
>;
export type DoctorDryRunInput = z.infer<typeof DoctorDryRunInputSchema>;
export type DoctorDryRunEvaluation = z.infer<
  typeof DoctorDryRunEvaluationSchema
>;

function copyResult(result: DoctorCheckResult): DoctorCheckResult {
  return DoctorCheckResultSchema.parse(JSON.parse(JSON.stringify(result)));
}

function source(observation: DoctorDryRunObservation): DoctorResultSource {
  return DoctorResultSourceSchema.parse({
    contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
    source_kind: "doctor-dry-run-input",
    source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    observed_at: observation.observed_at,
    generated_at: null,
    deterministic_placeholder: false,
    metadata_only: true,
    read_only: true,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
  });
}

function observedPosture(
  observation: DoctorDryRunObservation,
): DoctorObservedPosture {
  return DoctorObservedPostureSchema.parse({
    observation_status: "supplied_dry_run_observation",
    local_first: observation.observed_posture?.local_first ?? null,
    cloud_gated: observation.observed_posture?.cloud_gated ?? null,
    disabled_by_default:
      observation.observed_posture?.disabled_by_default ?? null,
    provider_disabled_by_default:
      observation.observed_posture?.provider_disabled_by_default ?? null,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    shell_execution_observed: false,
    filesystem_inspection_observed: false,
    process_spawn_observed: false,
    network_call_observed: false,
    provider_call_observed: false,
    install_action_observed: false,
    mutation_observed: false,
  });
}

function remediationHint(
  check: DoctorCheck,
  observation: DoctorDryRunObservation,
): DoctorRemediationHint {
  return DoctorRemediationHintSchema.parse({
    hint_id: `doctor-remediation:${check.check_id}`,
    summary:
      observation.remediation_summary ??
      "Dry-run output should describe the supplied observation without executing installation, mutation, provider, or network behavior.",
    manual_action_required:
      observation.status === "failed" &&
      check.required &&
      check.severity === "blocking",
    automation_available: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    shell_instruction_included: false,
    install_instruction_included: false,
    provider_instruction_included: false,
  });
}

function resultFromObservation(
  check: DoctorCheck,
  observation: DoctorDryRunObservation,
): DoctorCheckResult {
  return DoctorCheckResultSchema.parse({
    check_id: check.check_id,
    status: observation.status,
    severity: check.severity,
    category: check.category,
    expected_posture: check.expected_posture,
    observed_posture: observedPosture(observation),
    remediation_hint: remediationHint(check, observation),
    blocking: check.required && check.severity === "blocking",
    local_first: check.expected_posture.local_first,
    cloud_gated: check.expected_posture.cloud_gated,
    disabled_by_default: check.expected_posture.disabled_by_default,
    provider_disabled_by_default:
      check.expected_posture.provider_disabled_by_default,
    source: source(observation),
    metadata_only: true,
    read_only: true,
    deterministic: true,
    check_executed: false,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
  });
}

function observationMap(
  observations: readonly DoctorDryRunObservation[],
): ReadonlyMap<DoctorCheckId, DoctorDryRunObservation> {
  return new Map(
    observations.map((observation) => [observation.check_id, observation]),
  );
}

export function evaluateDoctorDryRun(
  input: DoctorDryRunInput,
): DoctorDryRunEvaluation {
  const parsedInput = DoctorDryRunInputSchema.parse(input);
  const observations = observationMap(parsedInput.observations);
  const pendingById = new Map(
    createPendingDoctorResults().map((result) => [result.check_id, result]),
  );
  const results = getDoctorCheckRegistry().checks.map((check) => {
    const observation = observations.get(check.check_id);
    const result = observation
      ? resultFromObservation(check, observation)
      : pendingById.get(check.check_id);

    if (!result) {
      throw new Error(`Missing doctor result for ${check.check_id}`);
    }

    return copyResult(result);
  });
  const summary: DoctorRunSummary = summarizeDoctorResults(results);

  return DoctorDryRunEvaluationSchema.parse({
    evaluator_version: DOCTOR_DRY_RUN_EVALUATOR_VERSION,
    source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    result_contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
    results,
    summary,
    input_observation_count: parsedInput.observations.length,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    dry_run_only: true,
    input_driven_only: true,
    real_environment_inspected: false,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    approval_bypass_created: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
  });
}
