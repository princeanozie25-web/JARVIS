import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  FinalHardeningEvaluationSchema,
  FinalHardeningObservationSchema,
  evaluateFinalHardening,
  summarizeFinalHardeningResults,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "executeHardening",
  "recover",
  "autoFix",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
] as const;

const MIXED_OBSERVATIONS = [
  {
    failure_mode_id: "final-failure-mode:sqlite-event-store-unavailable",
    status: "fail",
    observed_fallback_posture: "metadata-only persistence blocker observed",
    finding_summary:
      "SQLite/event store remains unavailable in supplied metadata.",
    remediation_guidance: "Manual remediation only: verify SQLite readiness.",
  },
  {
    failure_mode_id: "final-failure-mode:local-first-fallback-unavailable",
    status: "fail",
    observed_fallback_posture: "metadata-only local fallback blocker observed",
  },
  {
    failure_mode_id: "final-failure-mode:model-runtime-unavailable",
    status: "pass",
    observed_fallback_posture: "metadata-only model runtime posture satisfied",
  },
  {
    failure_mode_id: "final-failure-mode:projection-read-failure",
    status: "warning",
    observed_fallback_posture: "metadata-only projection warning observed",
  },
  {
    failure_mode_id: "final-failure-mode:voice-runtime-unavailable",
    status: "deferred",
    observed_fallback_posture: "metadata-only voice runtime deferred",
    deferred_limitation_posture:
      "Voice hardening remains deferred until runtime prerequisites are available.",
  },
  {
    failure_mode_id: "final-failure-mode:telemetry-audit-report-unavailable",
    status: "skipped",
    observed_fallback_posture: "metadata-only telemetry audit skipped",
  },
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

describe("Phase 20F.4 hardening evaluator", () => {
  it("produces deterministic typed metadata-only evaluation output", () => {
    const evaluation = evaluateFinalHardening();

    expect(FinalHardeningEvaluationSchema.safeParse(evaluation).success).toBe(
      true,
    );
    expect(JSON.stringify(evaluation)).toBe(
      JSON.stringify(evaluateFinalHardening()),
    );
    expect(evaluation).toMatchObject({
      evaluator_version: "20F.4",
      evaluation_id: "phase-20f4-final-hardening-evaluation",
      source: "metadata_only",
      contract_version: "20F.1",
      failure_mode_registry_version: "20F.2",
      result_model_version: "20F.3",
      input_observation_count: 0,
      evaluated_observation_count: 0,
    });
  });

  it("produces pending results for all failure modes by default", () => {
    const evaluation = evaluateFinalHardening();

    expect(evaluation.results).toHaveLength(24);
    expect(
      evaluation.results.every((result) => result.status === "pending"),
    ).toBe(true);
    expect(evaluation.summary).toMatchObject({
      result_count: 24,
      pending_count: 24,
      pass_count: 0,
      fail_count: 0,
      warning_count: 0,
      deferred_count: 0,
      skipped_count: 0,
      blocking_result_count: 14,
      critical_count: 10,
      high_count: 7,
      medium_count: 7,
      low_count: 0,
      represented_failure_mode_count: 24,
      represented_surface_count: 21,
    });
  });

  it("classifies supplied metadata observations and leaves missing observations pending", () => {
    const evaluation = evaluateFinalHardening({
      observations: [...MIXED_OBSERVATIONS],
      source: "phase-20f4-supplied-metadata-observations",
    });
    const resultByFailureMode = new Map(
      evaluation.results.map((result) => [result.failure_mode_id, result]),
    );

    expect(evaluation.input_observation_count).toBe(6);
    expect(evaluation.evaluated_observation_count).toBe(6);
    expect(
      resultByFailureMode.get(
        "final-failure-mode:sqlite-event-store-unavailable",
      ),
    ).toMatchObject({
      status: "fail",
      observed_fallback_placeholder: "metadata_observation_supplied",
      blocking: true,
    });
    expect(
      resultByFailureMode.get(
        "final-failure-mode:local-first-fallback-unavailable",
      ),
    ).toMatchObject({
      status: "fail",
      blocking: true,
    });
    expect(
      resultByFailureMode.get("final-failure-mode:model-runtime-unavailable"),
    ).toMatchObject({
      status: "pass",
      blocking: false,
    });
    expect(
      resultByFailureMode.get("final-failure-mode:projection-read-failure"),
    ).toMatchObject({
      status: "warning",
      blocking: false,
    });
    expect(
      resultByFailureMode.get("final-failure-mode:voice-runtime-unavailable"),
    ).toMatchObject({
      status: "deferred",
      blocking: false,
    });
    expect(
      resultByFailureMode.get(
        "final-failure-mode:telemetry-audit-report-unavailable",
      ),
    ).toMatchObject({
      status: "skipped",
      blocking: false,
    });
    expect(
      resultByFailureMode.get("final-failure-mode:local-model-missing"),
    ).toMatchObject({
      status: "pending",
      observed_fallback_placeholder: "not_evaluated",
    });
  });

  it("classifies blocking failures and aligns summary counts", () => {
    const evaluation = evaluateFinalHardening({
      observations: [...MIXED_OBSERVATIONS],
    });

    expect(evaluation.summary).toMatchObject({
      result_count: 24,
      pass_count: 1,
      fail_count: 2,
      warning_count: 1,
      pending_count: 18,
      skipped_count: 1,
      deferred_count: 1,
      blocking_result_count: 13,
    });
    expect(evaluation.summary).toEqual(
      summarizeFinalHardeningResults(evaluation.results),
    );
    expect(
      evaluation.results.filter(
        (result) => result.status === "fail" && result.blocking,
      ),
    ).toHaveLength(2);
  });

  it("preserves fallback, safe-default, user-visible, audit, recovery, and limitation posture", () => {
    const evaluation = evaluateFinalHardening({
      observations: [...MIXED_OBSERVATIONS],
    });

    for (const result of evaluation.results) {
      expect(result.expected_fallback_behavior.length).toBeGreaterThan(0);
      expect(result.safe_default.length).toBeGreaterThan(0);
      expect(result.user_visible_error_posture.length).toBeGreaterThan(0);
      expect(result.audit_log_posture).toContain("metadata-only");
      expect(result.recovery_guidance.length).toBeGreaterThan(0);
      expect(result.remediation_hint.guidance.length).toBeGreaterThan(0);
      expect(result.remediation_hint.manual_only).toBe(true);
      expect(result.remediation_hint.automation_enabled).toBe(false);
      expect(result.deferred_limitation_posture.length).toBeGreaterThan(0);
    }

    expect(
      evaluation.results.find(
        (result) =>
          result.failure_mode_id ===
          "final-failure-mode:model-runtime-unavailable",
      ),
    ).toMatchObject({
      expected_fallback_behavior:
        "Disable model-dependent actions and keep local readiness reporting available.",
      safe_default:
        "Keep model execution disabled until local runtime readiness is restored.",
    });
  });

  it("rejects observation raw payload and mutation affordance fields", () => {
    expect(
      FinalHardeningObservationSchema.safeParse({
        failure_mode_id: "final-failure-mode:model-runtime-unavailable",
        status: "pass",
        raw_payload: "not allowed",
      }).success,
    ).toBe(false);
    expect(
      FinalHardeningObservationSchema.safeParse({
        failure_mode_id: "final-failure-mode:model-runtime-unavailable",
        status: "pass",
        shell_command: "not allowed",
      }).success,
    ).toBe(false);
  });

  it("returns defensive evaluation output", () => {
    const evaluation = evaluateFinalHardening();
    evaluation.results[0].status = "fail";
    evaluation.results[0].recovery_guidance.push("mutation");
    evaluation.summary.pending_count = 0;

    expect(evaluateFinalHardening().results[0]).toMatchObject({
      status: "pending",
      recovery_guidance: [
        "Review local model readiness",
        "Use doctor report metadata",
      ],
    });
    expect(evaluateFinalHardening().summary.pending_count).toBe(24);
  });

  it("declares no hardening execution, filesystem, runtime, provider, network, process, UI, authority, source material, recovery automation, or capability affordances", () => {
    const evaluation = evaluateFinalHardening({
      observations: [...MIXED_OBSERVATIONS],
    });

    for (const posture of [
      evaluation.posture,
      evaluation.summary.posture,
      ...evaluation.results.map((result) => result.posture),
      ...evaluation.results.map((result) => result.finding.posture),
      ...evaluation.results.map((result) => result.remediation_hint.posture),
    ]) {
      expect(posture.hardening_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.shell_process_execution_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.approval_bypass_created).toBe(false);
      expect(posture.authority_surface_created).toBe(false);
      expect(posture.capability_created).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(evaluation)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no hardening execution, UI route, provider, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["evaluateFinalHardening"]),
    );
  });
});
