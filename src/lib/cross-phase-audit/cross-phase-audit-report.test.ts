import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  CROSS_PHASE_AUDIT_REPORT_SECTION_IDS,
  CrossPhaseAuditReportSchema,
  buildCrossPhaseAuditReport,
  type CrossPhaseAuditReport,
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

let cachedReport: CrossPhaseAuditReport | undefined;

function report(): CrossPhaseAuditReport {
  cachedReport ??= buildCrossPhaseAuditReport();
  return cachedReport;
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

describe("Phase 20E.8 cross-phase audit report", () => {
  it("produces deterministic typed metadata-only report output", () => {
    const auditReport = report();

    expect(CrossPhaseAuditReportSchema.safeParse(auditReport).success).toBe(
      true,
    );
    expect(JSON.stringify(auditReport)).toBe(
      JSON.stringify(buildCrossPhaseAuditReport()),
    );
    expect(auditReport).toMatchObject({
      report_version: "20E.8",
      report_id: "phase-20e8-cross-phase-audit-report",
      phase: "20E.8",
      verdict: "pass_with_warnings",
      phase20e_closeout_ready: true,
      phase20e_report_only: true,
      phase20e_capability_neutral: true,
    });
  }, 45000);

  it("represents every expected report section", () => {
    const auditReport = report();

    expect(auditReport.sections.map((section) => section.section_id)).toEqual([
      ...CROSS_PHASE_AUDIT_REPORT_SECTION_IDS,
    ]);
    expect(auditReport.sections).toHaveLength(12);
  });

  it("aligns overall verdict with underlying audit summaries", () => {
    const auditReport = report();

    expect(auditReport.finding_summary.blocking_count).toBe(0);
    expect(auditReport.finding_summary.pending_count).toBe(0);
    expect(
      auditReport.finding_summary.warning_count +
        auditReport.finding_summary.deferred_count,
    ).toBeGreaterThan(0);
    expect(auditReport.verdict).toBe("pass_with_warnings");
    expect(auditReport.phase20e_closeout_ready).toBe(true);
  });

  it("populates and aligns blocking, warning, and deferred sections", () => {
    const auditReport = report();

    expect(auditReport.blocking_findings).toEqual([]);
    expect(auditReport.warnings.length).toBeGreaterThan(0);
    expect(auditReport.deferred_items.length).toBeGreaterThan(0);
    expect(auditReport.finding_summary.warning_count).toBe(
      auditReport.evaluator.summary.warning_count +
        auditReport.governance_summary.warning_count +
        auditReport.disabled_feature_summary.warning_count +
        auditReport.authority_surface_summary.warning_count,
    );
    expect(auditReport.finding_summary.deferred_count).toBe(
      auditReport.evaluator.summary.deferred_count +
        auditReport.governance_summary.deferred_count +
        auditReport.disabled_feature_summary.deferred_count +
        auditReport.authority_surface_summary.deferred_count,
    );
  });

  it("represents evidence, surface, and dimension coverage", () => {
    const auditReport = report();

    expect(auditReport.coverage_summary).toMatchObject({
      surface_count: 14,
      dimension_count: 12,
      evidence_count: 23,
      result_count: 168,
      represented_surface_count: 14,
      represented_dimension_count: 12,
    });
    expect(auditReport.evidence_summary.metadata_safe_count).toBe(23);
  });

  it("includes governance, disabled-feature, and authority summaries", () => {
    const auditReport = report();

    expect(auditReport.governance_summary.finding_count).toBe(15);
    expect(auditReport.disabled_feature_summary.finding_count).toBe(17);
    expect(auditReport.authority_surface_summary.finding_count).toBe(17);
    expect(auditReport.governance_summary.blocking_count).toBe(0);
    expect(auditReport.disabled_feature_summary.blocking_count).toBe(0);
    expect(auditReport.authority_surface_summary.blocking_count).toBe(0);
  });

  it("includes final audit statement and closeout readiness", () => {
    const auditReport = report();

    expect(auditReport.final_audit_statement).toContain(
      "ready for Phase 20E closeout evaluation",
    );
    expect(
      auditReport.sections.find(
        (section) =>
          section.section_id ===
          "cross-phase-audit-report:phase-20e-closeout-readiness",
      ),
    ).toMatchObject({
      summary: "Phase 20E is ready for closeout guard evaluation.",
    });
  });

  it("declares no runtime, filesystem, network, provider, UI, authority, source material, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      ...auditReport.sections.map((section) => section.posture),
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
      expect(collectKeys(auditReport)).not.toContain(forbiddenFieldName);
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
      expect.arrayContaining(["buildCrossPhaseAuditReport"]),
    );
  });
});
