import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  DEMO_PORTFOLIO_READINESS_AREA_IDS,
  DemoPortfolioReadinessAuditReportSchema,
  buildDemoPortfolioReadinessAuditReport,
  type DemoPortfolioReadinessAuditReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "approve",
  "dispatch",
  "toolCall",
  "callProvider",
  "createUiRoute",
  "createAuthority",
  "executeDemo",
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
  "raw_prompt",
  "raw_output",
  "raw_audio",
  "raw_ocr",
  "raw_frame",
  "project_body",
] as const;

let cachedReport: DemoPortfolioReadinessAuditReport | undefined;

function report(): DemoPortfolioReadinessAuditReport {
  cachedReport ??= buildDemoPortfolioReadinessAuditReport();
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

describe("Phase 20F.8 demo portfolio readiness audit", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES audit output", () => {
    const auditReport = report();

    expect(
      DemoPortfolioReadinessAuditReportSchema.safeParse(auditReport).success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(
      JSON.stringify(buildDemoPortfolioReadinessAuditReport()),
    );
    expect(auditReport).toMatchObject({
      report_version: "20F.8",
      report_id: "phase-20f8-demo-portfolio-readiness-audit",
      phase: "20F.8",
      verdict: "pass_with_notes",
    });
  }, 45000);

  it("covers every required demo and portfolio readiness area", () => {
    const auditReport = report();

    expect(
      auditReport.readiness_areas.map((area) => area.readiness_area_id),
    ).toEqual([...DEMO_PORTFOLIO_READINESS_AREA_IDS]);
    expect(auditReport.summary).toMatchObject({
      readiness_area_count: 13,
      pass_count: 8,
      pass_with_notes_count: 5,
      blocked_count: 0,
      blocking_area_count: 0,
    });
  });

  it("covers visible portfolio surfaces for command center, architecture, telemetry, governance, and red-team", () => {
    const auditReport = report();
    const visibleSurfaceIds = new Set(
      auditReport.readiness_areas.flatMap((area) => area.visible_surface_ids),
    );

    expect([...visibleSurfaceIds]).toEqual(
      expect.arrayContaining([
        "demo-surface:rest-orb",
        "demo-surface:working-cockpit",
        "demo-surface:audit-timeline",
        "demo-surface:architecture-graph",
        "demo-surface:runtime-dependency-graph",
        "demo-surface:telemetry-cockpit",
        "demo-surface:governance-boundary-visualizer",
        "demo-surface:red-team-sandbox",
      ]),
    );
    expect(auditReport.summary.visible_surface_count).toBe(18);
  });

  it("proves demo safety, synthetic data, redaction, and no viewer mutation posture", () => {
    const auditReport = report();
    const byId = new Map(
      auditReport.readiness_areas.map((area) => [area.readiness_area_id, area]),
    );

    expect(
      byId.get("demo-portfolio:synthetic-demo-posture-clear"),
    ).toMatchObject({
      demo_safe_classification: "synthetic_safe",
      status: "pass",
    });
    expect(
      byId.get("demo-portfolio:no-viewer-mutation-affordances"),
    ).toMatchObject({
      demo_safe_classification: "read_only_visible",
      status: "pass",
    });
    expect(
      byId.get("demo-portfolio:no-raw-private-source-material"),
    ).toMatchObject({
      demo_safe_classification: "redacted_metadata_only",
      status: "pass",
    });
    expect(auditReport.summary).toMatchObject({
      demo_safe_surface_count: 18,
      synthetic_only_surface_count: 3,
      redacted_metadata_surface_count: 3,
    });
  });

  it("documents README/status alignment, disabled capability clarity, CAI non-execution, and expansion future-only posture", () => {
    const auditReport = report();
    const byId = new Map(
      auditReport.readiness_areas.map((area) => [area.readiness_area_id, area]),
    );

    expect(
      byId.get("demo-portfolio:readme-current-status-aligned"),
    ).toMatchObject({
      portfolio_value_classification: "recruiter_ready",
      status: "pass_with_notes",
    });
    expect(
      byId.get("demo-portfolio:disabled-capabilities-not-marketed-active"),
    ).toMatchObject({
      demo_safe_classification: "future_only",
      status: "pass",
    });
    expect(byId.get("demo-portfolio:cai-governed-not-executing")).toMatchObject(
      {
        demo_safe_classification: "governed_sandboxed",
        status: "pass_with_notes",
      },
    );
    expect(byId.get("demo-portfolio:expansion-era-future-only")).toMatchObject({
      portfolio_value_classification: "future_expansion_story_ready",
      status: "pass_with_notes",
    });
  });

  it("aligns with portfolio report, disabled features, governance integrity, and authority regression evidence", () => {
    const auditReport = report();

    expect(auditReport.summary).toMatchObject({
      portfolio_report_section_count: 11,
      portfolio_report_evidence_count: 5,
      recruiter_narrative_count: 19,
      disabled_feature_count: 18,
      authority_regression_count: 0,
      governance_integrity_pass: true,
      phase20d_complete: true,
      phase20f_demo_portfolio_audit_only: true,
      phase20f_capability_neutral: true,
    });
    expect(auditReport.final_demo_portfolio_statement).toContain(
      "safe and coherent to demo as a portfolio system",
    );
  });

  it("declares no runtime, provider, network, filesystem, process, UI, approval, authority, source-material, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.readiness_areas.map((area) => area.posture),
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
      expect(collectKeys(auditReport)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no demo execution, provider, UI, approval, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildDemoPortfolioReadinessAuditReport"]),
    );
  });
});
