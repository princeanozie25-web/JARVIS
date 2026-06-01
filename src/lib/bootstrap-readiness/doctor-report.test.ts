import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  DoctorReportSchema,
  buildDoctorReportFromDryRun,
  buildDoctorReportFromResults,
  createPendingDoctorResults,
  type DoctorCheckId,
  type DoctorCheckResult,
  type DoctorCheckStatus,
  type DoctorDryRunInput,
  type DoctorDryRunObservation,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "bootstrap",
  "run",
  "exec",
  "spawn",
  "mutate",
  "probe",
  "callProvider",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
] as const;

function observation(
  checkId: DoctorCheckId,
  status: DoctorCheckStatus,
): DoctorDryRunObservation {
  return {
    check_id: checkId,
    status,
    observed_at: "doctor-report-fixture",
    observed_posture: {
      local_first: true,
      cloud_gated: null,
      disabled_by_default: null,
      provider_disabled_by_default: true,
    },
    remediation_summary:
      "Doctor report fixture remediation hint with no command or install instruction.",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
  };
}

function dryRunInput(
  observations: readonly DoctorDryRunObservation[],
): DoctorDryRunInput {
  return {
    observations: [...observations],
    metadata_only: true,
    read_only: true,
    deterministic: true,
    dry_run_only: true,
    input_driven_only: true,
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
  };
}

function allResultsAs(status: DoctorCheckStatus): DoctorCheckResult[] {
  return createPendingDoctorResults().map((result) => ({
    ...result,
    status,
    observed_posture: {
      ...result.observed_posture,
      observation_status: "supplied_dry_run_observation",
      local_first: result.local_first,
      cloud_gated: result.cloud_gated,
      disabled_by_default: result.disabled_by_default,
      provider_disabled_by_default: result.provider_disabled_by_default,
    },
  }));
}

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 20B.5 doctor report generator", () => {
  it("builds a structured report from explicit results", () => {
    const results = allResultsAs("passed");
    const report = buildDoctorReportFromResults(results);

    expect(DoctorReportSchema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      report_version: "20B.5",
      report_id: "phase-20b5-doctor-report",
      verdict: "ready",
      source_metadata: {
        source_kind: "explicit-results",
        report_contract_version: "20B.5",
        result_contract_version: "20B.3",
        source_registry_version: "20B.2",
      },
      metadata_only: true,
      read_only: true,
      deterministic: true,
      report_generation_only: true,
      checks_executed: false,
      raw_payload_included: false,
    });
    expect(report.summary.total_count).toBe(results.length);
    expect(report.blocking_failures).toEqual([]);
  });

  it("builds a structured report from dry-run input", () => {
    const report = buildDoctorReportFromDryRun(
      dryRunInput([
        observation("doctor-check:node-version", "passed"),
        observation("doctor-check:package-manager-availability", "failed"),
      ]),
    );

    expect(report.source_metadata.source_kind).toBe("dry-run-evaluation");
    expect(report.summary.status_counts).toMatchObject({
      passed: 1,
      failed: 1,
      pending: 13,
    });
    expect(report.verdict).toBe("blocked");
  });

  it("reports ready when every supplied result passes", () => {
    const report = buildDoctorReportFromResults(allResultsAs("passed"));

    expect(report.verdict).toBe("ready");
    expect(report.readiness_statement).toContain("satisfied");
    expect(report.summary.status_counts.passed).toBe(
      report.summary.total_count,
    );
  });

  it("reports blocked when blocking failures exist", () => {
    const results = allResultsAs("passed");
    results[0].status = "failed";

    const report = buildDoctorReportFromResults(results);

    expect(report.verdict).toBe("blocked");
    expect(report.blocking_failures.map((result) => result.check_id)).toEqual([
      "doctor-check:node-version",
    ]);
    expect(report.readiness_statement).toContain("blocked");
  });

  it("does not block when only non-blocking warning checks fail", () => {
    const results = allResultsAs("passed");
    const ollama = results.find(
      (result) => result.check_id === "doctor-check:ollama-local-model-runtime",
    );

    if (!ollama) {
      throw new Error("Missing Ollama check result");
    }

    ollama.status = "failed";
    const report = buildDoctorReportFromResults(results);

    expect(report.verdict).toBe("ready_with_warnings");
    expect(report.blocking_failures).toEqual([]);
    expect(report.summary.status_counts.failed).toBe(1);
  });

  it("populates warning, pending, and skipped sections", () => {
    const results = allResultsAs("passed");
    results[1].status = "warning";
    results[2].status = "pending";
    results[3].status = "skipped";

    const report = buildDoctorReportFromResults(results);

    expect(report.verdict).toBe("pending");
    expect(report.warnings.map((result) => result.check_id)).toEqual([
      "doctor-check:package-manager-availability",
    ]);
    expect(report.pending_checks.map((result) => result.check_id)).toEqual([
      "doctor-check:typescript-tooling",
    ]);
    expect(report.skipped_checks.map((result) => result.check_id)).toEqual([
      "doctor-check:platform-support",
    ]);
    expect(
      report.sections.find((section) => section.section_id === "warnings"),
    ).toMatchObject({ item_count: 1 });
  });

  it("builds category breakdown from result statuses", () => {
    const results = allResultsAs("passed");
    results[0].status = "failed";
    results[4].status = "pending";
    results[8].status = "warning";

    const report = buildDoctorReportFromResults(results);

    expect(report.category_breakdown).toEqual([
      expect.objectContaining({
        category: "environment",
        total_count: 4,
        failed_count: 1,
        blocking_failure_count: 1,
      }),
      expect.objectContaining({
        category: "project",
        total_count: 4,
        pending_count: 1,
      }),
      expect.objectContaining({
        category: "runtime",
        total_count: 5,
        warning_count: 1,
      }),
      expect.objectContaining({
        category: "validation",
        total_count: 2,
      }),
    ]);
  });

  it("surfaces remediation hints for non-passing checks", () => {
    const results = allResultsAs("passed");
    results[0].status = "failed";
    results[1].status = "warning";

    const report = buildDoctorReportFromResults(results);

    expect(report.remediation_hints.map((hint) => hint.check_id)).toEqual([
      "doctor-check:node-version",
      "doctor-check:package-manager-availability",
    ]);
    expect(
      report.remediation_hints.every((hint) => !hint.automation_available),
    ).toBe(true);
    expect(
      report.remediation_hints.every(
        (hint) =>
          !hint.shell_instruction_included &&
          !hint.install_instruction_included &&
          !hint.provider_instruction_included,
      ),
    ).toBe(true);
  });

  it("summarizes local-first, cloud-gated, and disabled-provider posture", () => {
    const report = buildDoctorReportFromResults(allResultsAs("passed"));

    expect(report.local_first_cloud_gated_posture).toMatchObject({
      local_first_count: report.summary.total_count,
      cloud_gated_count: 7,
      all_results_local_first: true,
    });
    expect(report.disabled_provider_posture).toMatchObject({
      provider_disabled_by_default_count: report.summary.total_count,
      all_providers_disabled_by_default: true,
      disabled_by_default_count: 5,
    });
  });

  it("is deterministic and returns defensive copies", () => {
    const results = allResultsAs("passed");

    expect(JSON.stringify(buildDoctorReportFromResults(results))).toBe(
      JSON.stringify(buildDoctorReportFromResults(results)),
    );

    const report = buildDoctorReportFromResults(results);
    report.blocking_failures.push(results[0]);
    report.remediation_hints.push({
      check_id: "mutated",
      status: "failed",
      severity: "blocking",
      blocking: true,
      summary: "Mutated By Test",
      manual_action_required: true,
      automation_available: false,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      shell_instruction_included: false,
      install_instruction_included: false,
      provider_instruction_included: false,
    });

    expect(buildDoctorReportFromResults(results).blocking_failures).toEqual([]);
    expect(buildDoctorReportFromResults(results).remediation_hints).toEqual([]);
  });

  it("declares no raw payload, execution, install, filesystem, shell, network, provider, mutation, UI, authority, or capability affordances", () => {
    const report = buildDoctorReportFromResults(allResultsAs("passed"));

    expect(report).toMatchObject({
      checks_executed: false,
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
    expect(report.source_metadata).toMatchObject({
      checks_executed: false,
      filesystem_inspection_enabled: false,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      install_action_enabled: false,
      mutation_enabled: false,
    });

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(report)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no UI route or runtime execution affordance names", () => {
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toContain("buildDoctorReportFromResults");
    expect(exportedFunctionNames).toContain("buildDoctorReportFromDryRun");
  });
});
