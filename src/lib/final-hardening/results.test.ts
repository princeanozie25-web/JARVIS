import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  FINAL_FAILURE_MODE_IDS,
  FINAL_HARDENING_STATUSES,
  FinalHardeningResultSchema,
  FinalHardeningResultsSchema,
  createPendingFinalHardeningResults,
  getBlockingFinalHardeningResults,
  getFinalFailureModeRegistry,
  getFinalHardeningResultsByFailureMode,
  getFinalHardeningResultsByStatus,
  getFinalHardeningResultsBySurface,
  summarizeFinalHardeningResults,
  type FinalHardeningResult,
  type FinalHardeningStatus,
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

function statusFixtureResults(): FinalHardeningResult[] {
  const pendingResults = createPendingFinalHardeningResults();
  const statuses: FinalHardeningStatus[] = [
    "pass",
    "fail",
    "warning",
    "pending",
    "skipped",
    "deferred",
  ];

  return statuses.map((status, index) =>
    FinalHardeningResultSchema.parse({
      ...pendingResults[index],
      status,
      finding: {
        ...pendingResults[index].finding,
        status,
      },
    }),
  );
}

describe("Phase 20F.3 hardening result model", () => {
  it("creates deterministic typed pending results for every final failure mode", () => {
    const results = createPendingFinalHardeningResults();

    expect(FinalHardeningResultsSchema.safeParse(results).success).toBe(true);
    expect(JSON.stringify(results)).toBe(
      JSON.stringify(createPendingFinalHardeningResults()),
    );
    expect(results).toHaveLength(24);
    expect(results.map((result) => result.failure_mode_id)).toEqual([
      ...FINAL_FAILURE_MODE_IDS,
    ]);
    expect(results.every((result) => result.status === "pending")).toBe(true);
    expect(
      results.every(
        (result) => result.observed_fallback_placeholder === "not_evaluated",
      ),
    ).toBe(true);
  });

  it("returns defensive copies", () => {
    const results = createPendingFinalHardeningResults();
    results[0].status = "fail";
    results[0].recovery_guidance.push("mutation");
    results[0].remediation_hint.guidance = "Mutated";
    results[0].finding.finding_summary = "Mutated";

    expect(createPendingFinalHardeningResults()[0]).toMatchObject({
      failure_mode_id: "final-failure-mode:model-runtime-unavailable",
      status: "pending",
      recovery_guidance: [
        "Review local model readiness",
        "Use doctor report metadata",
      ],
      remediation_hint: {
        guidance: "Manual remediation only: Review local model readiness",
      },
      finding: {
        finding_summary:
          "Pending final hardening placeholder; no hardening check has executed.",
      },
    });
  });

  it("represents all supported statuses in summaries", () => {
    const fixtureResults = statusFixtureResults();
    const summary = summarizeFinalHardeningResults(fixtureResults);

    expect(FINAL_HARDENING_STATUSES).toEqual([
      "pass",
      "fail",
      "warning",
      "pending",
      "skipped",
      "deferred",
    ]);
    expect(summary).toMatchObject({
      result_count: 6,
      pass_count: 1,
      fail_count: 1,
      warning_count: 1,
      pending_count: 1,
      skipped_count: 1,
      deferred_count: 1,
    });
  });

  it("aligns pending results with known final failure mode records", () => {
    const results = createPendingFinalHardeningResults();
    const failureModes = new Map(
      getFinalFailureModeRegistry().map((failureMode) => [
        failureMode.failure_id,
        failureMode,
      ]),
    );

    for (const result of results) {
      const failureMode = failureModes.get(result.failure_mode_id);

      expect(failureMode).toBeDefined();
      expect(result.hardening_surface_id).toBe(
        failureMode?.hardening_surface_id,
      );
      expect(result.severity).toBe(failureMode?.severity);
      expect(result.expected_fallback_behavior).toBe(
        failureMode?.expected_fallback_behavior,
      );
      expect(result.safe_default).toBe(failureMode?.safe_default);
    }
  });

  it("summarizes pending results consistently", () => {
    const results = createPendingFinalHardeningResults();
    const summary = summarizeFinalHardeningResults(results);

    expect(summary).toMatchObject({
      results_version: "20F.3",
      result_count: 24,
      pass_count: 0,
      fail_count: 0,
      warning_count: 0,
      pending_count: 24,
      skipped_count: 0,
      deferred_count: 0,
      critical_count: 10,
      high_count: 7,
      medium_count: 7,
      low_count: 0,
      blocking_result_count: 14,
      represented_failure_mode_count: 24,
      represented_surface_count: 21,
      remediation_hint_count: 24,
      phase20f_result_model_only: true,
      phase20f_capability_neutral: true,
    });
  });

  it("filters blocking results", () => {
    const blockingResults = getBlockingFinalHardeningResults(
      createPendingFinalHardeningResults(),
    );

    expect(blockingResults).toHaveLength(14);
    expect(blockingResults.every((result) => result.blocking)).toBe(true);
    expect(blockingResults.map((result) => result.failure_mode_id)).toEqual(
      expect.arrayContaining([
        "final-failure-mode:sqlite-event-store-unavailable",
        "final-failure-mode:approval-runtime-unavailable",
        "final-failure-mode:unsafe-cloud-fallback-request",
      ]),
    );
  });

  it("filters by status, surface, and failure mode", () => {
    const results = createPendingFinalHardeningResults();

    expect(getFinalHardeningResultsByStatus(results, "pending")).toHaveLength(
      24,
    );
    expect(
      getFinalHardeningResultsByStatus(statusFixtureResults(), "pass"),
    ).toHaveLength(1);
    expect(
      getFinalHardeningResultsBySurface(
        results,
        "hardening-surface:model-runtime-unavailable",
      ),
    ).toHaveLength(2);
    expect(
      getFinalHardeningResultsBySurface(
        results,
        "hardening-surface:cloud-provider-opt-in-gated",
      ),
    ).toHaveLength(2);
    expect(
      getFinalHardeningResultsByFailureMode(
        results,
        "final-failure-mode:unsafe-cloud-fallback-request",
      ),
    ).toHaveLength(1);
  });

  it("represents fallback, safe default, user-visible, audit, recovery, remediation, and limitation posture", () => {
    const results = createPendingFinalHardeningResults();

    for (const result of results) {
      expect(result.expected_fallback_behavior.length).toBeGreaterThan(0);
      expect(result.observed_fallback_placeholder).toBe("not_evaluated");
      expect(result.safe_default.length).toBeGreaterThan(0);
      expect(result.user_visible_error_posture.length).toBeGreaterThan(0);
      expect(result.audit_log_posture).toContain("metadata-only");
      expect(result.recovery_guidance.length).toBeGreaterThan(0);
      expect(result.remediation_hint.guidance.length).toBeGreaterThan(0);
      expect(result.remediation_hint.manual_only).toBe(true);
      expect(result.remediation_hint.automation_enabled).toBe(false);
      expect(result.deferred_limitation_posture.length).toBeGreaterThan(0);
    }
  });

  it("declares no hardening execution, filesystem, runtime, provider, network, process, UI, authority, source material, recovery automation, or capability affordances", () => {
    const results = createPendingFinalHardeningResults();
    const summary = summarizeFinalHardeningResults(results);

    for (const posture of [
      summary.posture,
      ...results.map((result) => result.posture),
      ...results.map((result) => result.finding.posture),
      ...results.map((result) => result.remediation_hint.posture),
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
      expect(collectKeys({ results, summary })).not.toContain(
        forbiddenFieldName,
      );
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
      expect.arrayContaining([
        "createPendingFinalHardeningResults",
        "summarizeFinalHardeningResults",
        "getFinalHardeningResultsByStatus",
        "getBlockingFinalHardeningResults",
        "getFinalHardeningResultsBySurface",
        "getFinalHardeningResultsByFailureMode",
      ]),
    );
  });
});
