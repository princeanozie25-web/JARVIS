import { z } from "zod";

import {
  DOCTOR_CHECK_REGISTRY_VERSION,
  DoctorCheckCategorySchema,
  DoctorCheckExpectedPostureSchema,
  DoctorCheckIdSchema,
  DoctorCheckSeveritySchema,
  type DoctorCheck,
  type DoctorCheckCategory,
  type DoctorCheckSeverity,
} from "./doctor-checks";
import { getDoctorCheckRegistry } from "./doctor-checks";

export const DOCTOR_RESULT_CONTRACT_VERSION = "20B.3" as const;

export const DOCTOR_CHECK_STATUSES = [
  "pending",
  "passed",
  "warning",
  "failed",
  "skipped",
  "unknown",
] as const;

export type DoctorCheckStatus = (typeof DOCTOR_CHECK_STATUSES)[number];

export const DoctorCheckStatusSchema = z.enum(DOCTOR_CHECK_STATUSES);

export const DoctorObservedPostureSchema = z.strictObject({
  observation_status: z.literal("not_observed"),
  local_first: z.literal(null),
  cloud_gated: z.literal(null),
  disabled_by_default: z.literal(null),
  provider_disabled_by_default: z.literal(null),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  shell_execution_observed: z.literal(false),
  filesystem_inspection_observed: z.literal(false),
  process_spawn_observed: z.literal(false),
  network_call_observed: z.literal(false),
  provider_call_observed: z.literal(false),
  install_action_observed: z.literal(false),
  mutation_observed: z.literal(false),
});

export const DoctorResultSourceSchema = z.strictObject({
  contract_version: z.literal(DOCTOR_RESULT_CONTRACT_VERSION),
  source_kind: z.literal("doctor-check-registry-placeholder"),
  source_registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  observed_at: z.literal(null),
  generated_at: z.literal(null),
  deterministic_placeholder: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  filesystem_inspection_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const DoctorRemediationHintSchema = z.strictObject({
  hint_id: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(300),
  manual_action_required: z.boolean(),
  automation_available: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  shell_instruction_included: z.literal(false),
  install_instruction_included: z.literal(false),
  provider_instruction_included: z.literal(false),
});

export const DoctorCheckResultSchema = z.strictObject({
  check_id: DoctorCheckIdSchema,
  status: DoctorCheckStatusSchema,
  severity: DoctorCheckSeveritySchema,
  category: DoctorCheckCategorySchema,
  expected_posture: DoctorCheckExpectedPostureSchema,
  observed_posture: DoctorObservedPostureSchema,
  remediation_hint: DoctorRemediationHintSchema,
  blocking: z.boolean(),
  local_first: z.boolean(),
  cloud_gated: z.boolean(),
  disabled_by_default: z.boolean(),
  provider_disabled_by_default: z.boolean(),
  source: DoctorResultSourceSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  check_executed: z.literal(false),
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

export const DoctorRunSummarySchema = z.strictObject({
  contract_version: z.literal(DOCTOR_RESULT_CONTRACT_VERSION),
  source_registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  total_count: z.number().int().nonnegative(),
  status_counts: z.record(
    DoctorCheckStatusSchema,
    z.number().int().nonnegative(),
  ),
  category_counts: z.record(
    DoctorCheckCategorySchema,
    z.number().int().nonnegative(),
  ),
  severity_counts: z.record(
    DoctorCheckSeveritySchema,
    z.number().int().nonnegative(),
  ),
  blocking_count: z.number().int().nonnegative(),
  local_first_count: z.number().int().nonnegative(),
  cloud_gated_count: z.number().int().nonnegative(),
  disabled_by_default_count: z.number().int().nonnegative(),
  provider_disabled_by_default_count: z.number().int().nonnegative(),
  generated_at: z.literal(null),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  checks_executed: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export type DoctorObservedPosture = z.infer<typeof DoctorObservedPostureSchema>;
export type DoctorResultSource = z.infer<typeof DoctorResultSourceSchema>;
export type DoctorRemediationHint = z.infer<typeof DoctorRemediationHintSchema>;
export type DoctorCheckResult = z.infer<typeof DoctorCheckResultSchema>;
export type DoctorRunSummary = z.infer<typeof DoctorRunSummarySchema>;

function source(): DoctorResultSource {
  return DoctorResultSourceSchema.parse({
    contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
    source_kind: "doctor-check-registry-placeholder",
    source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    observed_at: null,
    generated_at: null,
    deterministic_placeholder: true,
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

function observedPosture(): DoctorObservedPosture {
  return DoctorObservedPostureSchema.parse({
    observation_status: "not_observed",
    local_first: null,
    cloud_gated: null,
    disabled_by_default: null,
    provider_disabled_by_default: null,
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

function remediationHint(check: DoctorCheck): DoctorRemediationHint {
  return DoctorRemediationHintSchema.parse({
    hint_id: `doctor-remediation:${check.check_id}`,
    summary:
      "Future doctor output should describe the unmet prerequisite manually without executing installation, mutation, provider, or network behavior.",
    manual_action_required: check.required,
    automation_available: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    shell_instruction_included: false,
    install_instruction_included: false,
    provider_instruction_included: false,
  });
}

function pendingResult(check: DoctorCheck): DoctorCheckResult {
  return DoctorCheckResultSchema.parse({
    check_id: check.check_id,
    status: "pending",
    severity: check.severity,
    category: check.category,
    expected_posture: check.expected_posture,
    observed_posture: observedPosture(),
    remediation_hint: remediationHint(check),
    blocking: check.required && check.severity === "blocking",
    local_first: check.expected_posture.local_first,
    cloud_gated: check.expected_posture.cloud_gated,
    disabled_by_default: check.expected_posture.disabled_by_default,
    provider_disabled_by_default:
      check.expected_posture.provider_disabled_by_default,
    source: source(),
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

function copyResult(result: DoctorCheckResult): DoctorCheckResult {
  return DoctorCheckResultSchema.parse(JSON.parse(JSON.stringify(result)));
}

function emptyStatusCounts(): Record<DoctorCheckStatus, number> {
  return Object.fromEntries(
    DOCTOR_CHECK_STATUSES.map((status) => [status, 0]),
  ) as Record<DoctorCheckStatus, number>;
}

function emptyCategoryCounts(): Record<DoctorCheckCategory, number> {
  const categories = getDoctorCheckRegistry().categories;

  return Object.fromEntries(
    categories.map((category) => [category, 0]),
  ) as Record<DoctorCheckCategory, number>;
}

function emptySeverityCounts(): Record<DoctorCheckSeverity, number> {
  return {
    blocking: 0,
    warning: 0,
    info: 0,
  };
}

export function createPendingDoctorResults(): readonly DoctorCheckResult[] {
  return getDoctorCheckRegistry().checks.map(pendingResult).map(copyResult);
}

export function summarizeDoctorResults(
  results: readonly DoctorCheckResult[],
): DoctorRunSummary {
  const parsedResults = results.map((result) =>
    DoctorCheckResultSchema.parse(result),
  );
  const statusCounts = emptyStatusCounts();
  const categoryCounts = emptyCategoryCounts();
  const severityCounts = emptySeverityCounts();

  for (const result of parsedResults) {
    statusCounts[result.status] += 1;
    categoryCounts[result.category] += 1;
    severityCounts[result.severity] += 1;
  }

  return DoctorRunSummarySchema.parse({
    contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
    source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    total_count: parsedResults.length,
    status_counts: statusCounts,
    category_counts: categoryCounts,
    severity_counts: severityCounts,
    blocking_count: parsedResults.filter((result) => result.blocking).length,
    local_first_count: parsedResults.filter((result) => result.local_first)
      .length,
    cloud_gated_count: parsedResults.filter((result) => result.cloud_gated)
      .length,
    disabled_by_default_count: parsedResults.filter(
      (result) => result.disabled_by_default,
    ).length,
    provider_disabled_by_default_count: parsedResults.filter(
      (result) => result.provider_disabled_by_default,
    ).length,
    generated_at: null,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    checks_executed: false,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    authority_surface_created: false,
    capability_created: false,
  });
}

export function getBlockingDoctorResults(
  results: readonly DoctorCheckResult[],
): readonly DoctorCheckResult[] {
  return results
    .map((result) => DoctorCheckResultSchema.parse(result))
    .filter((result) => result.blocking)
    .map(copyResult);
}

export function getDoctorResultsByStatus(
  results: readonly DoctorCheckResult[],
  status: DoctorCheckStatus,
): readonly DoctorCheckResult[] {
  return results
    .map((result) => DoctorCheckResultSchema.parse(result))
    .filter((result) => result.status === status)
    .map(copyResult);
}
