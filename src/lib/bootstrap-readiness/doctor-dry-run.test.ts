import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  DOCTOR_CHECK_IDS,
  DoctorDryRunEvaluationSchema,
  evaluateDoctorDryRun,
  getBlockingDoctorResults,
  getDoctorCheckRegistry,
  getDoctorResultsByStatus,
  type DoctorCheckId,
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
    observed_at: "dry-run-fixture",
    observed_posture: {
      local_first: true,
      cloud_gated: null,
      disabled_by_default: null,
      provider_disabled_by_default: true,
    },
    remediation_summary:
      "Dry-run fixture remediation hint; no command or install action is included.",
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

function input(
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

function collectKeys(inputValue: unknown): string[] {
  if (Array.isArray(inputValue)) {
    return inputValue.flatMap(collectKeys);
  }

  if (!inputValue || typeof inputValue !== "object") {
    return [];
  }

  return Object.entries(inputValue).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 20B.4 doctor dry-run evaluator", () => {
  it("evaluates all checks from supplied observations", () => {
    const statuses: DoctorCheckStatus[] = [
      "passed",
      "failed",
      "warning",
      "skipped",
      "pending",
    ];
    const observations = DOCTOR_CHECK_IDS.map((checkId, index) =>
      observation(checkId, statuses[index % statuses.length]),
    );
    const evaluation = evaluateDoctorDryRun(input(observations));

    expect(DoctorDryRunEvaluationSchema.safeParse(evaluation).success).toBe(
      true,
    );
    expect(evaluation.results.map((result) => result.check_id)).toEqual([
      ...DOCTOR_CHECK_IDS,
    ]);
    expect(evaluation.results.map((result) => result.status)).toEqual(
      observations.map((item) => item.status),
    );
    expect(evaluation.input_observation_count).toBe(observations.length);
  });

  it("turns missing observations into pending placeholder results", () => {
    const evaluation = evaluateDoctorDryRun(
      input([
        observation("doctor-check:node-version", "passed"),
        observation("doctor-check:package-manager-availability", "failed"),
      ]),
    );

    expect(evaluation.results[0]).toMatchObject({
      check_id: "doctor-check:node-version",
      status: "passed",
      source: {
        source_kind: "doctor-dry-run-input",
        observed_at: "dry-run-fixture",
      },
      observed_posture: {
        observation_status: "supplied_dry_run_observation",
      },
    });
    expect(evaluation.results[2]).toMatchObject({
      check_id: "doctor-check:typescript-tooling",
      status: "pending",
      source: {
        source_kind: "doctor-check-registry-placeholder",
        observed_at: null,
      },
      observed_posture: {
        observation_status: "not_observed",
      },
    });
  });

  it("supports pass, fail, warning, skipped, and pending statuses", () => {
    const evaluation = evaluateDoctorDryRun(
      input([
        observation("doctor-check:node-version", "passed"),
        observation("doctor-check:package-manager-availability", "failed"),
        observation("doctor-check:typescript-tooling", "warning"),
        observation("doctor-check:platform-support", "skipped"),
        observation("doctor-check:required-project-directories", "pending"),
      ]),
    );

    expect(getDoctorResultsByStatus(evaluation.results, "passed")).toHaveLength(
      1,
    );
    expect(getDoctorResultsByStatus(evaluation.results, "failed")).toHaveLength(
      1,
    );
    expect(
      getDoctorResultsByStatus(evaluation.results, "warning"),
    ).toHaveLength(1);
    expect(
      getDoctorResultsByStatus(evaluation.results, "skipped"),
    ).toHaveLength(1);
    expect(
      getDoctorResultsByStatus(evaluation.results, "pending"),
    ).toHaveLength(evaluation.results.length - 4);
  });

  it("classifies blocking and non-blocking failures from check metadata", () => {
    const evaluation = evaluateDoctorDryRun(
      input([
        observation("doctor-check:node-version", "failed"),
        observation("doctor-check:ollama-local-model-runtime", "failed"),
      ]),
    );
    const nodeResult = evaluation.results.find(
      (result) => result.check_id === "doctor-check:node-version",
    );
    const ollamaResult = evaluation.results.find(
      (result) => result.check_id === "doctor-check:ollama-local-model-runtime",
    );

    expect(nodeResult).toMatchObject({
      status: "failed",
      severity: "blocking",
      blocking: true,
      remediation_hint: {
        manual_action_required: true,
      },
    });
    expect(ollamaResult).toMatchObject({
      status: "failed",
      severity: "warning",
      blocking: false,
      remediation_hint: {
        manual_action_required: false,
      },
    });
    expect(
      getBlockingDoctorResults(evaluation.results).some(
        (result) =>
          result.check_id === "doctor-check:node-version" &&
          result.status === "failed",
      ),
    ).toBe(true);
  });

  it("summarizes dry-run output through existing result helpers", () => {
    const evaluation = evaluateDoctorDryRun(
      input([
        observation("doctor-check:node-version", "passed"),
        observation("doctor-check:package-manager-availability", "failed"),
        observation("doctor-check:typescript-tooling", "warning"),
        observation("doctor-check:platform-support", "skipped"),
      ]),
    );

    expect(evaluation.summary).toMatchObject({
      total_count: getDoctorCheckRegistry().checks.length,
      status_counts: {
        pending: getDoctorCheckRegistry().checks.length - 4,
        passed: 1,
        warning: 1,
        failed: 1,
        skipped: 1,
        unknown: 0,
      },
      category_counts: {
        environment: 4,
        runtime: 5,
        project: 4,
        validation: 2,
      },
      checks_executed: false,
      filesystem_inspection_enabled: false,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      install_action_enabled: false,
      mutation_enabled: false,
    });
  });

  it("is deterministic and returns defensive result copies", () => {
    const dryRunInput = input([
      observation("doctor-check:node-version", "passed"),
      observation("doctor-check:package-manager-availability", "failed"),
    ]);

    expect(JSON.stringify(evaluateDoctorDryRun(dryRunInput))).toBe(
      JSON.stringify(evaluateDoctorDryRun(dryRunInput)),
    );

    const evaluation = evaluateDoctorDryRun(dryRunInput);
    evaluation.results[0].status = "failed";
    evaluation.results[0].remediation_hint.summary = "Mutated By Test";

    expect(evaluateDoctorDryRun(dryRunInput).results[0]).toMatchObject({
      check_id: "doctor-check:node-version",
      status: "passed",
      remediation_hint: {
        summary:
          "Dry-run fixture remediation hint; no command or install action is included.",
      },
    });
  });

  it("declares dry-run only posture and no real environment side effects", () => {
    const evaluation = evaluateDoctorDryRun(input([]));

    expect(evaluation).toMatchObject({
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

    for (const result of evaluation.results) {
      expect(result.check_executed).toBe(false);
      expect(result.filesystem_inspection_enabled).toBe(false);
      expect(result.shell_execution_enabled).toBe(false);
      expect(result.process_spawn_enabled).toBe(false);
      expect(result.network_call_enabled).toBe(false);
      expect(result.provider_call_enabled).toBe(false);
      expect(result.install_action_enabled).toBe(false);
      expect(result.mutation_enabled).toBe(false);
    }
  });

  it("does not expose raw payload fields", () => {
    const keys = collectKeys(
      evaluateDoctorDryRun(
        input([observation("doctor-check:node-version", "passed")]),
      ),
    );

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(keys).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toContain("evaluateDoctorDryRun");
  });
});
