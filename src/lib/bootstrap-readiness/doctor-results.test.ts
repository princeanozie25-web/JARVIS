import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  DOCTOR_CHECK_IDS,
  DOCTOR_CHECK_STATUSES,
  DoctorCheckResultSchema,
  DoctorRunSummarySchema,
  createPendingDoctorResults,
  getBlockingDoctorResults,
  getDoctorCheckRegistry,
  getDoctorResultsByStatus,
  summarizeDoctorResults,
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

describe("Phase 20B.3 doctor result contract", () => {
  it("creates pending result placeholders for every doctor check", () => {
    const registry = getDoctorCheckRegistry();
    const results = createPendingDoctorResults();

    expect(results.map((result) => result.check_id)).toEqual([
      ...DOCTOR_CHECK_IDS,
    ]);
    expect(results.map((result) => result.check_id)).toEqual(
      registry.checks.map((check) => check.check_id),
    );

    for (const result of results) {
      expect(DoctorCheckResultSchema.safeParse(result).success).toBe(true);
      expect(result.status).toBe("pending");
      expect(result.observed_posture).toMatchObject({
        observation_status: "not_observed",
        local_first: null,
        cloud_gated: null,
        disabled_by_default: null,
        provider_disabled_by_default: null,
      });
      expect(result.source).toMatchObject({
        contract_version: "20B.3",
        source_kind: "doctor-check-registry-placeholder",
        source_registry_version: "20B.2",
        observed_at: null,
        generated_at: null,
        deterministic_placeholder: true,
      });
    }
  });

  it("is deterministic and defensive-copy safe", () => {
    expect(JSON.stringify(createPendingDoctorResults())).toBe(
      JSON.stringify(createPendingDoctorResults()),
    );

    const results = createPendingDoctorResults();
    results[0].status = "failed";
    results[0].observed_posture.observation_status = "not_observed";
    results[0].remediation_hint.summary = "Mutated By Test";

    expect(createPendingDoctorResults()[0]).toMatchObject({
      check_id: "doctor-check:node-version",
      status: "pending",
      remediation_hint: {
        summary:
          "Future doctor output should describe the unmet prerequisite manually without executing installation, mutation, provider, or network behavior.",
      },
    });
  });

  it("summarizes pending results from input metadata", () => {
    const results = createPendingDoctorResults();
    const summary = summarizeDoctorResults(results);

    expect(DoctorRunSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary).toMatchObject({
      contract_version: "20B.3",
      source_registry_version: "20B.2",
      total_count: results.length,
      status_counts: {
        pending: results.length,
        passed: 0,
        warning: 0,
        failed: 0,
        skipped: 0,
        unknown: 0,
      },
      category_counts: {
        environment: 4,
        runtime: 5,
        project: 4,
        validation: 2,
      },
      severity_counts: {
        blocking: 12,
        warning: 3,
        info: 0,
      },
      blocking_count: 12,
      local_first_count: results.length,
      cloud_gated_count: 7,
      disabled_by_default_count: 5,
      provider_disabled_by_default_count: results.length,
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
  });

  it("summarizes mixed in-memory statuses without executing checks", () => {
    const results = createPendingDoctorResults().map((result) => ({
      ...result,
    }));
    results[0].status = "passed";
    results[1].status = "failed";
    results[2].status = "warning";
    results[3].status = "skipped";

    const summary = summarizeDoctorResults(results);

    expect(summary.status_counts).toEqual({
      pending: results.length - 4,
      passed: 1,
      warning: 1,
      failed: 1,
      skipped: 1,
      unknown: 0,
    });
    expect(summary.checks_executed).toBe(false);
  });

  it("returns blocking doctor results as defensive copies", () => {
    const blockingResults = getBlockingDoctorResults(
      createPendingDoctorResults(),
    );

    expect(blockingResults).toHaveLength(12);
    expect(blockingResults.every((result) => result.blocking)).toBe(true);

    blockingResults[0].status = "failed";
    expect(
      getBlockingDoctorResults(createPendingDoctorResults())[0],
    ).toHaveProperty("status", "pending");
  });

  it("returns doctor results by status", () => {
    const results = createPendingDoctorResults().map((result) => ({
      ...result,
    }));
    results[0].status = "passed";
    results[1].status = "failed";

    expect(getDoctorResultsByStatus(results, "pending")).toHaveLength(
      results.length - 2,
    );
    expect(
      getDoctorResultsByStatus(results, "passed").map(
        (result) => result.check_id,
      ),
    ).toEqual(["doctor-check:node-version"]);
    expect(
      getDoctorResultsByStatus(results, "failed").map(
        (result) => result.check_id,
      ),
    ).toEqual(["doctor-check:package-manager-availability"]);
  });

  it("represents local-first, cloud-gated, disabled, blocking, remediation, and source metadata", () => {
    const results = createPendingDoctorResults();
    const cloudGated = results.filter((result) => result.cloud_gated);
    const disabledByDefault = results.filter(
      (result) => result.disabled_by_default,
    );

    expect(results.every((result) => result.local_first)).toBe(true);
    expect(cloudGated).toHaveLength(7);
    expect(disabledByDefault).toHaveLength(5);
    expect(results.every((result) => result.provider_disabled_by_default)).toBe(
      true,
    );

    for (const result of results) {
      expect(result.remediation_hint.automation_available).toBe(false);
      expect(result.remediation_hint.shell_instruction_included).toBe(false);
      expect(result.remediation_hint.install_instruction_included).toBe(false);
      expect(result.remediation_hint.provider_instruction_included).toBe(false);
      expect(result.source.filesystem_inspection_enabled).toBe(false);
      expect(result.source.shell_execution_enabled).toBe(false);
      expect(result.source.process_spawn_enabled).toBe(false);
      expect(result.source.network_call_enabled).toBe(false);
      expect(result.source.provider_call_enabled).toBe(false);
      expect(result.source.install_action_enabled).toBe(false);
      expect(result.source.mutation_enabled).toBe(false);
    }
  });

  it("declares no execution, install, shell, filesystem, process, network, provider, mutation, UI, authority, or capability affordances", () => {
    for (const result of createPendingDoctorResults()) {
      expect(result.check_executed).toBe(false);
      expect(result.filesystem_inspection_enabled).toBe(false);
      expect(result.shell_execution_enabled).toBe(false);
      expect(result.process_spawn_enabled).toBe(false);
      expect(result.network_call_enabled).toBe(false);
      expect(result.provider_call_enabled).toBe(false);
      expect(result.install_action_enabled).toBe(false);
      expect(result.mutation_enabled).toBe(false);
      expect(result.ui_route_created).toBe(false);
      expect(result.authority_surface_created).toBe(false);
      expect(result.capability_created).toBe(false);
      expect(result.observed_posture.filesystem_inspection_observed).toBe(
        false,
      );
      expect(result.observed_posture.shell_execution_observed).toBe(false);
      expect(result.observed_posture.process_spawn_observed).toBe(false);
      expect(result.observed_posture.network_call_observed).toBe(false);
      expect(result.observed_posture.provider_call_observed).toBe(false);
      expect(result.observed_posture.install_action_observed).toBe(false);
      expect(result.observed_posture.mutation_observed).toBe(false);
    }
  });

  it("does not expose raw payload fields", () => {
    const keys = collectKeys({
      results: createPendingDoctorResults(),
      summary: summarizeDoctorResults(createPendingDoctorResults()),
    });

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(keys).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no runtime check execution affordance names", () => {
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect([...DOCTOR_CHECK_STATUSES]).toEqual([
      "pending",
      "passed",
      "warning",
      "failed",
      "skipped",
      "unknown",
    ]);
  });
});
