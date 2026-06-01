import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_DIMENSION_IDS,
  AUDIT_EVIDENCE_IDS,
  AUDIT_EXPECTATION_IDS,
  AUDIT_SURFACE_IDS,
  CROSS_PHASE_AUDIT_STATUSES,
  CrossPhaseAuditResultSchema,
  createPendingCrossPhaseAuditResults,
  getBlockingCrossPhaseAuditResults,
  getCrossPhaseAuditResultsByDimension,
  getCrossPhaseAuditResultsByStatus,
  getCrossPhaseAuditResultsBySurface,
  summarizeCrossPhaseAuditResults,
  type CrossPhaseAuditResult,
  type CrossPhaseAuditStatus,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "executeAudit",
  "inspectFilesystem",
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

function withStatus(
  result: CrossPhaseAuditResult,
  status: CrossPhaseAuditStatus,
  blocking = false,
): CrossPhaseAuditResult {
  return CrossPhaseAuditResultSchema.parse({
    ...result,
    result_id: `${result.result_id}:${status}`,
    status,
    blocking,
    remediation_hint: {
      ...result.remediation_hint,
      blocking_resolution_required: blocking,
      deferred_resolution_allowed: !blocking,
    },
  });
}

describe("Phase 20E.3 cross-phase audit result model", () => {
  it("creates deterministic pending results for every audit surface and dimension", () => {
    const results = createPendingCrossPhaseAuditResults();

    expect(JSON.stringify(results)).toBe(
      JSON.stringify(createPendingCrossPhaseAuditResults()),
    );
    expect(results).toHaveLength(168);
    expect(new Set(results.map((result) => result.audit_surface_id))).toEqual(
      new Set(AUDIT_SURFACE_IDS),
    );
    expect(new Set(results.map((result) => result.audit_dimension_id))).toEqual(
      new Set(AUDIT_DIMENSION_IDS),
    );
    expect(
      new Set(results.map((result) => result.audit_expectation_id)),
    ).toEqual(new Set(AUDIT_EXPECTATION_IDS));
    expect(results.every((result) => result.status === "pending")).toBe(true);
  });

  it("returns defensive copies for pending results and helper output", () => {
    const results = createPendingCrossPhaseAuditResults();
    const firstResultId = results[0].result_id;

    results[0].finding.summary = "Mutated";
    results[0].evidence_ids.push("audit-evidence:bootstrap-doctor-report-path");

    expect(createPendingCrossPhaseAuditResults()[0]).toMatchObject({
      result_id: firstResultId,
      status: "pending",
      finding: {
        summary:
          "Pending final cross-phase audit result placeholder; no audit has been executed.",
      },
    });
    expect(createPendingCrossPhaseAuditResults()[0].evidence_ids).not.toContain(
      "audit-evidence:bootstrap-doctor-report-path",
    );

    const filtered = getCrossPhaseAuditResultsByStatus(
      createPendingCrossPhaseAuditResults(),
      "pending",
    );
    filtered[0].status = "fail";

    expect(
      getCrossPhaseAuditResultsByStatus(
        createPendingCrossPhaseAuditResults(),
        "pending",
      )[0].status,
    ).toBe("pending");
  });

  it("represents supported statuses and summarizes counts from supplied results", () => {
    const baseResult = createPendingCrossPhaseAuditResults()[0];
    const suppliedResults = CROSS_PHASE_AUDIT_STATUSES.map((status) =>
      withStatus(baseResult, status, status === "fail"),
    );
    const summary = summarizeCrossPhaseAuditResults(suppliedResults);

    expect(suppliedResults.map((result) => result.status)).toEqual([
      "pass",
      "fail",
      "warning",
      "pending",
      "skipped",
      "deferred",
    ]);
    expect(summary).toMatchObject({
      results_version: "20E.3",
      result_count: 6,
      pass_count: 1,
      fail_count: 1,
      warning_count: 1,
      pending_count: 1,
      skipped_count: 1,
      deferred_count: 1,
      blocking_count: 1,
      represented_surface_count: 1,
      represented_dimension_count: 1,
      phase20e_result_model_only: true,
      phase20e_capability_neutral: true,
    });
  });

  it("filters by blocking, status, surface, and dimension", () => {
    const pendingResults = createPendingCrossPhaseAuditResults();
    const suppliedResults = [
      withStatus(pendingResults[0], "fail", true),
      withStatus(pendingResults[1], "warning"),
      ...pendingResults.slice(2),
    ];

    expect(getBlockingCrossPhaseAuditResults(suppliedResults)).toHaveLength(1);
    expect(
      getCrossPhaseAuditResultsByStatus(suppliedResults, "warning"),
    ).toHaveLength(1);
    expect(
      getCrossPhaseAuditResultsBySurface(
        pendingResults,
        "audit-surface:phase-10-room-os",
      ),
    ).toHaveLength(12);
    expect(
      getCrossPhaseAuditResultsByDimension(
        pendingResults,
        "audit-dimension:governance",
      ),
    ).toHaveLength(14);
  });

  it("references known evidence ids for pending results", () => {
    const evidenceIds = new Set(AUDIT_EVIDENCE_IDS);
    const results = createPendingCrossPhaseAuditResults();

    expect(results.every((result) => result.evidence_ids.length > 0)).toBe(
      true,
    );

    for (const result of results) {
      for (const evidenceId of result.evidence_ids) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });

  it("summarizes the pending model consistently", () => {
    const results = createPendingCrossPhaseAuditResults();
    const summary = summarizeCrossPhaseAuditResults(results);

    expect(summary).toMatchObject({
      results_version: "20E.3",
      result_count: 168,
      pass_count: 0,
      fail_count: 0,
      warning_count: 0,
      pending_count: 168,
      skipped_count: 0,
      deferred_count: 0,
      critical_count: 56,
      high_count: 56,
      medium_count: 56,
      low_count: 0,
      blocking_count: 0,
      represented_surface_count: 14,
      represented_dimension_count: 12,
      phase20e_result_model_only: true,
      phase20e_capability_neutral: true,
    });
    expect(summary.evidence_reference_count).toBe(
      results.reduce((count, result) => count + result.evidence_ids.length, 0),
    );
  });

  it("declares no audit execution, filesystem inspection, runtime, provider, network, UI, authority, source material, or capability affordances", () => {
    const results = createPendingCrossPhaseAuditResults();
    const summary = summarizeCrossPhaseAuditResults(results);

    for (const posture of [
      summary.posture,
      ...results.map((result) => result.posture),
    ]) {
      expect(posture.audit_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
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

  it("exports no audit execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(crossPhaseAudit)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "createPendingCrossPhaseAuditResults",
        "summarizeCrossPhaseAuditResults",
        "getCrossPhaseAuditResultsByStatus",
        "getBlockingCrossPhaseAuditResults",
        "getCrossPhaseAuditResultsBySurface",
        "getCrossPhaseAuditResultsByDimension",
      ]),
    );
  });
});
