import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_DIMENSION_IDS,
  AUDIT_EVIDENCE_IDS,
  AUDIT_SURFACE_IDS,
  CrossPhaseAuditEvaluationSchema,
  evaluateCrossPhaseAudit,
  summarizeCrossPhaseAuditResults,
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

describe("Phase 20E.4 cross-phase audit evaluator", () => {
  it("produces deterministic metadata-only evaluation output", () => {
    const evaluation = evaluateCrossPhaseAudit();

    expect(CrossPhaseAuditEvaluationSchema.safeParse(evaluation).success).toBe(
      true,
    );
    expect(JSON.stringify(evaluation)).toBe(
      JSON.stringify(evaluateCrossPhaseAudit()),
    );
    expect(evaluation).toMatchObject({
      evaluator_version: "20E.4",
      evaluation_id: "phase-20e4-cross-phase-audit-evaluation",
      phase: "20E.4",
      source_metadata: {
        contract_version: "20E.1",
        evidence_registry_version: "20E.2",
        result_model_version: "20E.3",
        phase20a_complete: true,
        phase20b_complete: true,
        phase20c_complete: true,
        phase20d_complete: true,
        governance_ready: true,
        source_modules_metadata_only: true,
      },
      posture: {
        metadata_only: true,
        read_only: true,
        deterministic: true,
        audit_execution_enabled: false,
      },
    });
  });

  it("evaluates expected audit surfaces and dimensions", () => {
    const evaluation = evaluateCrossPhaseAudit();

    expect(evaluation.results).toHaveLength(168);
    expect(
      new Set(evaluation.results.map((result) => result.audit_surface_id)),
    ).toEqual(new Set(AUDIT_SURFACE_IDS));
    expect(
      new Set(evaluation.results.map((result) => result.audit_dimension_id)),
    ).toEqual(new Set(AUDIT_DIMENSION_IDS));
    expect(evaluation.summary.represented_surface_count).toBe(14);
    expect(evaluation.summary.represented_dimension_count).toBe(12);
  });

  it("attaches known supporting evidence ids to every result", () => {
    const evidenceIds = new Set(AUDIT_EVIDENCE_IDS);
    const evaluation = evaluateCrossPhaseAudit();

    expect(
      evaluation.results.every((result) => result.evidence_ids.length > 0),
    ).toBe(true);

    for (const result of evaluation.results) {
      for (const evidenceId of result.evidence_ids) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }

    expect(
      evaluation.results.find(
        (result) =>
          result.audit_surface_id === "audit-surface:phase-20a-readiness" &&
          result.audit_dimension_id === "audit-dimension:governance",
      ),
    ).toMatchObject({
      evidence_ids: expect.arrayContaining([
        "audit-evidence:phase-20a-readiness-governance-closeout",
        "audit-evidence:governance-readiness-summary",
      ]),
    });
  });

  it("classifies pass, warning, deferred, and blocking posture from metadata", () => {
    const evaluation = evaluateCrossPhaseAudit();
    const statuses = new Set(evaluation.results.map((result) => result.status));

    expect(statuses.has("pass")).toBe(true);
    expect(statuses.has("warning")).toBe(true);
    expect(statuses.has("deferred")).toBe(true);
    expect(statuses.has("fail")).toBe(false);
    expect(evaluation.blocking_findings).toEqual([]);
    expect(evaluation.summary.blocking_count).toBe(0);
    expect(
      evaluation.results.every((result) =>
        result.status === "fail" ? result.blocking : !result.blocking,
      ),
    ).toBe(true);
  });

  it("keeps pending/deferred posture represented and filterable", () => {
    const deferredIncluded = evaluateCrossPhaseAudit({
      surface_ids: ["audit-surface:phase-14-voice-runtime"],
      dimension_ids: ["audit-dimension:disabled-features"],
    });
    const deferredExcluded = evaluateCrossPhaseAudit({
      surface_ids: ["audit-surface:phase-14-voice-runtime"],
      dimension_ids: ["audit-dimension:disabled-features"],
      include_deferred_results: false,
    });

    expect(deferredIncluded.results).toHaveLength(1);
    expect(deferredIncluded.results[0]).toMatchObject({
      status: "deferred",
      deferred_limitation_posture:
        "Deferred posture is intentional and sourced from existing disabled-feature or onboarding metadata.",
    });
    expect(deferredExcluded.results).toHaveLength(0);
    expect(deferredExcluded.summary.result_count).toBe(0);
  });

  it("aligns summary with evaluated results", () => {
    const evaluation = evaluateCrossPhaseAudit();
    const summary = summarizeCrossPhaseAuditResults(evaluation.results);

    expect(evaluation.summary).toEqual(summary);
    expect(
      evaluation.summary.pass_count +
        evaluation.summary.fail_count +
        evaluation.summary.warning_count +
        evaluation.summary.pending_count +
        evaluation.summary.skipped_count +
        evaluation.summary.deferred_count,
    ).toBe(evaluation.results.length);
  });

  it("declares no filesystem, runtime, provider, network, shell, UI, authority, source material, or capability affordances", () => {
    const evaluation = evaluateCrossPhaseAudit();

    for (const posture of [
      evaluation.posture,
      evaluation.summary.posture,
      ...evaluation.results.map((result) => result.posture),
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
      expect(collectKeys(evaluation)).not.toContain(forbiddenFieldName);
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
      expect.arrayContaining(["evaluateCrossPhaseAudit"]),
    );
  });
});
