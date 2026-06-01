import { z } from "zod";

import {
  DOCTOR_CHECK_REGISTRY_VERSION,
  DoctorCheckCategorySchema,
  type DoctorCheckCategory,
} from "./doctor-checks";
import {
  DoctorDryRunInputSchema,
  evaluateDoctorDryRun,
  type DoctorDryRunInput,
} from "./doctor-dry-run";
import {
  DOCTOR_RESULT_CONTRACT_VERSION,
  DoctorCheckResultSchema,
  DoctorRunSummarySchema,
  getBlockingDoctorResults,
  getDoctorResultsByStatus,
  summarizeDoctorResults,
  type DoctorCheckResult,
  type DoctorRunSummary,
} from "./doctor-results";

export const DOCTOR_REPORT_CONTRACT_VERSION = "20B.5" as const;

export const DOCTOR_REPORT_VERDICTS = [
  "ready",
  "ready_with_warnings",
  "pending",
  "blocked",
] as const;

export const DOCTOR_REPORT_SECTION_IDS = [
  "summary",
  "blocking_failures",
  "warnings",
  "pending_checks",
  "skipped_checks",
  "category_breakdown",
  "local_first_cloud_gated_posture",
  "disabled_provider_posture",
  "remediation_hints",
  "readiness_statement",
] as const;

export type DoctorReportVerdict = (typeof DOCTOR_REPORT_VERDICTS)[number];
export type DoctorReportSectionId = (typeof DOCTOR_REPORT_SECTION_IDS)[number];

export const DoctorReportVerdictSchema = z.enum(DOCTOR_REPORT_VERDICTS);
export const DoctorReportSectionIdSchema = z.enum(DOCTOR_REPORT_SECTION_IDS);

export const DoctorReportSectionSchema = z.strictObject({
  section_id: DoctorReportSectionIdSchema,
  title: z.string().trim().min(1).max(120),
  item_count: z.number().int().nonnegative(),
  check_ids: z.array(z.string().trim().min(1).max(160)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  raw_payload_included: z.literal(false),
});

export const DoctorReportCategoryBreakdownSchema = z.strictObject({
  category: DoctorCheckCategorySchema,
  total_count: z.number().int().nonnegative(),
  passed_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  pending_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  blocking_failure_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export const DoctorReportRemediationHintSchema = z.strictObject({
  check_id: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(40),
  severity: z.string().trim().min(1).max(40),
  blocking: z.boolean(),
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

export const DoctorReportSourceMetadataSchema = z.strictObject({
  report_contract_version: z.literal(DOCTOR_REPORT_CONTRACT_VERSION),
  result_contract_version: z.literal(DOCTOR_RESULT_CONTRACT_VERSION),
  source_registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  source_kind: z.enum(["explicit-results", "dry-run-evaluation"]),
  generated_at: z.literal(null),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  checks_executed: z.boolean(),
  filesystem_inspection_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const DoctorReportSchema = z.strictObject({
  report_version: z.literal(DOCTOR_REPORT_CONTRACT_VERSION),
  report_id: z.literal("phase-20b5-doctor-report"),
  verdict: DoctorReportVerdictSchema,
  summary: DoctorRunSummarySchema,
  blocking_failures: z.array(DoctorCheckResultSchema),
  warnings: z.array(DoctorCheckResultSchema),
  pending_checks: z.array(DoctorCheckResultSchema),
  skipped_checks: z.array(DoctorCheckResultSchema),
  category_breakdown: z.array(DoctorReportCategoryBreakdownSchema),
  local_first_cloud_gated_posture: z.strictObject({
    local_first_count: z.number().int().nonnegative(),
    cloud_gated_count: z.number().int().nonnegative(),
    all_results_local_first: z.boolean(),
    metadata_only: z.literal(true),
    read_only: z.literal(true),
    deterministic: z.literal(true),
  }),
  disabled_provider_posture: z.strictObject({
    provider_disabled_by_default_count: z.number().int().nonnegative(),
    all_providers_disabled_by_default: z.boolean(),
    disabled_by_default_count: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
    read_only: z.literal(true),
    deterministic: z.literal(true),
  }),
  remediation_hints: z.array(DoctorReportRemediationHintSchema),
  readiness_statement: z.string().trim().min(1).max(360),
  sections: z.array(DoctorReportSectionSchema),
  source_metadata: DoctorReportSourceMetadataSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  report_generation_only: z.literal(true),
  checks_executed: z.boolean(),
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
  raw_payload_included: z.literal(false),
});

export type DoctorReportSection = z.infer<typeof DoctorReportSectionSchema>;
export type DoctorReportCategoryBreakdown = z.infer<
  typeof DoctorReportCategoryBreakdownSchema
>;
export type DoctorReport = z.infer<typeof DoctorReportSchema>;

function copyResult(result: DoctorCheckResult): DoctorCheckResult {
  return DoctorCheckResultSchema.parse(JSON.parse(JSON.stringify(result)));
}

function determineVerdict(
  summary: DoctorRunSummary,
  blockingFailures: readonly DoctorCheckResult[],
): DoctorReportVerdict {
  if (blockingFailures.length > 0) {
    return "blocked";
  }

  if (summary.status_counts.pending > 0) {
    return "pending";
  }

  if (summary.status_counts.warning > 0 || summary.status_counts.failed > 0) {
    return "ready_with_warnings";
  }

  return "ready";
}

function readinessStatement(verdict: DoctorReportVerdict): string {
  if (verdict === "blocked") {
    return "Doctor readiness is blocked by one or more blocking failed checks in the supplied metadata.";
  }

  if (verdict === "pending") {
    return "Doctor readiness remains pending because one or more checks do not yet have supplied observations.";
  }

  if (verdict === "ready_with_warnings") {
    return "Doctor readiness is not blocked, but supplied metadata includes non-blocking failures or warnings.";
  }

  return "Doctor readiness is satisfied by the supplied metadata with no blocking failures, warnings, or pending checks.";
}

function categoryBreakdown(
  results: readonly DoctorCheckResult[],
): readonly DoctorReportCategoryBreakdown[] {
  const categories = Array.from(
    new Set(results.map((result) => result.category)),
  );

  return categories.map((category: DoctorCheckCategory) => {
    const categoryResults = results.filter(
      (result) => result.category === category,
    );

    return DoctorReportCategoryBreakdownSchema.parse({
      category,
      total_count: categoryResults.length,
      passed_count: categoryResults.filter(
        (result) => result.status === "passed",
      ).length,
      warning_count: categoryResults.filter(
        (result) => result.status === "warning",
      ).length,
      failed_count: categoryResults.filter(
        (result) => result.status === "failed",
      ).length,
      pending_count: categoryResults.filter(
        (result) => result.status === "pending",
      ).length,
      skipped_count: categoryResults.filter(
        (result) => result.status === "skipped",
      ).length,
      blocking_failure_count: categoryResults.filter(
        (result) => result.status === "failed" && result.blocking,
      ).length,
      metadata_only: true,
      read_only: true,
      deterministic: true,
    });
  });
}

function section(
  sectionId: DoctorReportSectionId,
  title: string,
  results: readonly DoctorCheckResult[],
): DoctorReportSection {
  return DoctorReportSectionSchema.parse({
    section_id: sectionId,
    title,
    item_count: results.length,
    check_ids: results.map((result) => result.check_id),
    metadata_only: true,
    read_only: true,
    deterministic: true,
    raw_payload_included: false,
  });
}

function remediationHints(results: readonly DoctorCheckResult[]) {
  return results
    .filter((result) => result.status !== "passed")
    .map((result) =>
      DoctorReportRemediationHintSchema.parse({
        check_id: result.check_id,
        status: result.status,
        severity: result.severity,
        blocking: result.blocking,
        summary: result.remediation_hint.summary,
        manual_action_required: result.remediation_hint.manual_action_required,
        automation_available: false,
        metadata_only: true,
        read_only: true,
        deterministic: true,
        shell_instruction_included: false,
        install_instruction_included: false,
        provider_instruction_included: false,
      }),
    );
}

function buildReport(
  results: readonly DoctorCheckResult[],
  sourceKind: "explicit-results" | "dry-run-evaluation",
): DoctorReport {
  const parsedResults = results.map((result) =>
    DoctorCheckResultSchema.parse(result),
  );
  const summary = summarizeDoctorResults(parsedResults);
  const blockingFailures = getBlockingDoctorResults(parsedResults).filter(
    (result) => result.status === "failed",
  );
  const warnings = getDoctorResultsByStatus(parsedResults, "warning");
  const pendingChecks = getDoctorResultsByStatus(parsedResults, "pending");
  const skippedChecks = getDoctorResultsByStatus(parsedResults, "skipped");
  const verdict = determineVerdict(summary, blockingFailures);
  const breakdown = categoryBreakdown(parsedResults);
  const hints = remediationHints(parsedResults);

  return DoctorReportSchema.parse({
    report_version: DOCTOR_REPORT_CONTRACT_VERSION,
    report_id: "phase-20b5-doctor-report",
    verdict,
    summary,
    blocking_failures: blockingFailures.map(copyResult),
    warnings: warnings.map(copyResult),
    pending_checks: pendingChecks.map(copyResult),
    skipped_checks: skippedChecks.map(copyResult),
    category_breakdown: breakdown,
    local_first_cloud_gated_posture: {
      local_first_count: summary.local_first_count,
      cloud_gated_count: summary.cloud_gated_count,
      all_results_local_first:
        summary.local_first_count === summary.total_count,
      metadata_only: true,
      read_only: true,
      deterministic: true,
    },
    disabled_provider_posture: {
      provider_disabled_by_default_count:
        summary.provider_disabled_by_default_count,
      all_providers_disabled_by_default:
        summary.provider_disabled_by_default_count === summary.total_count,
      disabled_by_default_count: summary.disabled_by_default_count,
      metadata_only: true,
      read_only: true,
      deterministic: true,
    },
    remediation_hints: hints,
    readiness_statement: readinessStatement(verdict),
    sections: [
      section("summary", "Summary", parsedResults),
      section("blocking_failures", "Blocking failures", blockingFailures),
      section("warnings", "Warnings", warnings),
      section("pending_checks", "Pending checks", pendingChecks),
      section("skipped_checks", "Skipped checks", skippedChecks),
      section("category_breakdown", "Category breakdown", parsedResults),
      section(
        "local_first_cloud_gated_posture",
        "Local-first and cloud-gated posture",
        parsedResults.filter((result) => result.cloud_gated),
      ),
      section(
        "disabled_provider_posture",
        "Disabled-provider posture",
        parsedResults.filter((result) => result.provider_disabled_by_default),
      ),
      section("remediation_hints", "Remediation hints", parsedResults),
      section("readiness_statement", "Readiness statement", parsedResults),
    ],
    source_metadata: {
      report_contract_version: DOCTOR_REPORT_CONTRACT_VERSION,
      result_contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
      source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
      source_kind: sourceKind,
      generated_at: null,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      checks_executed: summary.checks_executed,
      filesystem_inspection_enabled: false,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      install_action_enabled: false,
      mutation_enabled: false,
    },
    metadata_only: true,
    read_only: true,
    deterministic: true,
    report_generation_only: true,
    checks_executed: summary.checks_executed,
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
    raw_payload_included: false,
  });
}

export function buildDoctorReportFromResults(
  results: readonly DoctorCheckResult[],
): DoctorReport {
  return DoctorReportSchema.parse(
    JSON.parse(JSON.stringify(buildReport(results, "explicit-results"))),
  );
}

export function buildDoctorReportFromDryRun(
  input: DoctorDryRunInput,
): DoctorReport {
  const evaluation = evaluateDoctorDryRun(DoctorDryRunInputSchema.parse(input));

  return DoctorReportSchema.parse(
    JSON.parse(
      JSON.stringify(buildReport(evaluation.results, "dry-run-evaluation")),
    ),
  );
}
