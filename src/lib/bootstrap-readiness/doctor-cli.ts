import { z } from "zod";

import {
  DoctorRuntimeEvaluationSchema,
  type DoctorRuntimeEvaluation,
} from "./doctor-runtime";

export const DOCTOR_CLI_ADAPTER_VERSION = "20B.7" as const;

export const DOCTOR_CLI_FORMATS = ["text", "json"] as const;

export type DoctorCliFormat = (typeof DOCTOR_CLI_FORMATS)[number];

export const DoctorCliFormatSchema = z.enum(DOCTOR_CLI_FORMATS);

export const DoctorCliAdapterResultSchema = z.strictObject({
  adapter_version: z.literal(DOCTOR_CLI_ADAPTER_VERSION),
  format: DoctorCliFormatSchema,
  output: z.string(),
  exit_code: z.union([z.literal(0), z.literal(1)]),
  evaluation: DoctorRuntimeEvaluationSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  cli_adapter_only: z.literal(true),
  installation_enabled: z.literal(false),
  auto_fix_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  ollama_call_enabled: z.literal(false),
  tauri_execution_enabled: z.literal(false),
  voice_runtime_execution_enabled: z.literal(false),
  vision_runtime_execution_enabled: z.literal(false),
  approval_bypass_created: z.literal(false),
  ui_route_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
  raw_payload_included: z.literal(false),
});

export type DoctorCliAdapterResult = z.infer<
  typeof DoctorCliAdapterResultSchema
>;

export type DoctorCliAdapterOptions = {
  argv?: readonly string[];
  runRuntime: () => DoctorRuntimeEvaluation;
};

function parseFormat(argv: readonly string[] = []): DoctorCliFormat {
  return argv.includes("--json") ? "json" : "text";
}

export function getDoctorCliExitCode(
  evaluation: DoctorRuntimeEvaluation,
): 0 | 1 {
  return evaluation.report.blocking_failures.length > 0 ? 1 : 0;
}

export function renderDoctorReportText(
  evaluation: DoctorRuntimeEvaluation,
): string {
  const report = evaluation.report;
  const lines = [
    "JARVIS Doctor",
    `Verdict: ${report.verdict}`,
    `Readiness: ${report.readiness_statement}`,
    "",
    "Summary",
    `- total: ${report.summary.total_count}`,
    `- passed: ${report.summary.status_counts.passed}`,
    `- failed: ${report.summary.status_counts.failed}`,
    `- warning: ${report.summary.status_counts.warning}`,
    `- pending: ${report.summary.status_counts.pending}`,
    `- skipped: ${report.summary.status_counts.skipped}`,
    `- blocking failures: ${report.blocking_failures.length}`,
    "",
    "Posture",
    `- local-first checks: ${report.local_first_cloud_gated_posture.local_first_count}`,
    `- cloud-gated checks: ${report.local_first_cloud_gated_posture.cloud_gated_count}`,
    `- provider disabled-by-default checks: ${report.disabled_provider_posture.provider_disabled_by_default_count}`,
    "",
    "Blocking failures",
    ...renderResultLines(report.blocking_failures),
    "",
    "Warnings",
    ...renderResultLines(report.warnings),
    "",
    "Pending checks",
    ...renderResultLines(report.pending_checks),
    "",
    "Skipped checks",
    ...renderResultLines(report.skipped_checks),
    "",
    "Category breakdown",
    ...report.category_breakdown.map(
      (item) =>
        `- ${item.category}: total=${item.total_count}, passed=${item.passed_count}, failed=${item.failed_count}, warning=${item.warning_count}, pending=${item.pending_count}, skipped=${item.skipped_count}`,
    ),
    "",
    "Read-only posture",
    `- installation: ${evaluation.installation_enabled}`,
    `- auto-fix: ${evaluation.auto_fix_enabled}`,
    `- filesystem mutation: ${evaluation.filesystem_mutation_enabled}`,
    `- network calls: ${evaluation.network_call_enabled}`,
    `- provider calls: ${evaluation.provider_call_enabled}`,
    `- UI route: ${evaluation.ui_route_created}`,
    "",
    "Model registry EOL",
    `- ${evaluation.model_registry_staleness.summary}`,
    ...renderModelRegistryStalenessRows(evaluation),
  ];

  return lines.join("\n");
}

export function serializeDoctorReportJson(
  evaluation: DoctorRuntimeEvaluation,
): string {
  return JSON.stringify(
    {
      adapter_version: DOCTOR_CLI_ADAPTER_VERSION,
      exit_code: getDoctorCliExitCode(evaluation),
      evaluation,
    },
    null,
    2,
  );
}

export function runDoctorCliAdapter(
  options: DoctorCliAdapterOptions,
): DoctorCliAdapterResult {
  const evaluation = DoctorRuntimeEvaluationSchema.parse(options.runRuntime());
  const format = parseFormat(options.argv);
  const output =
    format === "json"
      ? serializeDoctorReportJson(evaluation)
      : renderDoctorReportText(evaluation);

  return DoctorCliAdapterResultSchema.parse({
    adapter_version: DOCTOR_CLI_ADAPTER_VERSION,
    format,
    output,
    exit_code: getDoctorCliExitCode(evaluation),
    evaluation,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    cli_adapter_only: true,
    installation_enabled: false,
    auto_fix_enabled: false,
    filesystem_mutation_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    ollama_call_enabled: false,
    tauri_execution_enabled: false,
    voice_runtime_execution_enabled: false,
    vision_runtime_execution_enabled: false,
    approval_bypass_created: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
    raw_payload_included: false,
  });
}

function renderResultLines(
  results: readonly DoctorRuntimeEvaluation["results"][number][],
): string[] {
  if (results.length === 0) {
    return ["- none"];
  }

  return results.map(
    (result) =>
      `- ${result.check_id}: ${result.status} (${result.remediation_hint.summary})`,
  );
}

function renderModelRegistryStalenessRows(
  evaluation: DoctorRuntimeEvaluation,
): string[] {
  const rows = evaluation.model_registry_staleness.rows;

  if (rows.length === 0) {
    return ["- rows: none"];
  }

  return [
    "- rows:",
    "  id | model_name | tier | eol_date | daysRemaining | status | replacement_id",
    ...rows.map(
      (row) =>
        `  ${row.id} | ${row.model_name} | ${row.tier} | ${row.eol_date ?? "n/a"} | ${row.daysRemaining ?? "n/a"} | ${row.status} | ${row.replacement_id ?? "n/a"}`,
    ),
  ];
}
