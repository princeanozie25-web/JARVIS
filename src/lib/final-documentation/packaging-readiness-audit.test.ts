import { describe, expect, it } from "vitest";

import * as finalDocumentation from "./index";
import {
  PACKAGING_READINESS_AREA_IDS,
  PackagingReadinessAuditReportSchema,
  buildPackagingReadinessAuditReport,
  type PackagingReadinessAuditReport,
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
  "executePackaging",
  "finalCloseout",
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

let cachedReport: PackagingReadinessAuditReport | undefined;

function report(): PackagingReadinessAuditReport {
  cachedReport ??= buildPackagingReadinessAuditReport();
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

describe("Phase 20G.1 packaging readiness audit", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES output", () => {
    const auditReport = report();

    expect(
      PackagingReadinessAuditReportSchema.safeParse(auditReport).success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(JSON.stringify(report()));
    expect(auditReport).toMatchObject({
      report_version: "20G.1",
      report_id: "phase-20g1-documentation-packaging-readiness-audit",
      phase: "20G.1",
      verdict: "pass_with_notes",
    });
  }, 180000);

  it("covers every required documentation and packaging readiness area", () => {
    const auditReport = report();

    expect(
      auditReport.readiness_areas.map((area) => area.readiness_area_id),
    ).toEqual([...PACKAGING_READINESS_AREA_IDS]);
    expect(auditReport.summary).toMatchObject({
      readiness_area_count: 13,
      pass_count: 7,
      pass_with_notes_count: 6,
      blocked_count: 0,
      blocking_area_count: 0,
    });
  });

  it("captures README and Phase 20F status alignment", () => {
    const auditReport = report();
    const readmeArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "packaging-readiness:readme-phase-20f-completion",
    );

    expect(readmeArea).toBeDefined();
    expect(readmeArea?.status).toBe("pass");
    expect(readmeArea?.evidence_ids).toEqual(
      expect.arrayContaining([
        "README.md:current-status",
        "README.md:phase-20f-final-hardening",
        "phase-20f:final-hardening-closeout",
      ]),
    );
    expect(auditReport.summary.phase20f_complete).toBe(true);
  });

  it("covers visible demo route and entrypoint documentation", () => {
    const auditReport = report();
    const routeArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id === "packaging-readiness:visible-demo-routes",
    );

    expect(routeArea).toBeDefined();
    expect(routeArea?.status).toBe("pass_with_notes");
    expect(routeArea?.evidence_ids).toEqual(
      expect.arrayContaining([
        "phase-20d:demo-surface-registry",
        "phase-20f:demo-portfolio-readiness-audit",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      demo_surface_count: 18,
      demo_safe_surface_count: 18,
      portfolio_report_section_count: 11,
    });
  });

  it("keeps disabled capabilities clear and not marketed as active", () => {
    const auditReport = report();
    const disabledArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id === "packaging-readiness:disabled-capabilities",
    );
    const marketingArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "packaging-readiness:no-disabled-capability-marketed-active",
    );

    expect(disabledArea?.status).toBe("pass");
    expect(marketingArea?.status).toBe("pass");
    expect(auditReport.summary.disabled_feature_count).toBe(18);
    expect(disabledArea?.evidence_summary).toContain("documented as disabled");
    expect(marketingArea?.evidence_summary).toContain("not marketed as active");
  });

  it("keeps expansion-era and CAI posture clear", () => {
    const auditReport = report();
    const expansionArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "packaging-readiness:expansion-era-future-only",
    );
    const caiArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "packaging-readiness:cai-governed-not-executing",
    );

    expect(expansionArea?.status).toBe("pass");
    expect(caiArea?.status).toBe("pass_with_notes");
    expect(auditReport.summary.expansion_era_count).toBe(7);
    expect(expansionArea?.evidence_summary).toContain("future work");
    expect(caiArea?.evidence_summary).toContain("non-executing");
  });

  it("keeps setup, tests, packaging, and move-in readiness clear", () => {
    const auditReport = report();
    const areaIds = auditReport.readiness_areas.map(
      (area) => area.readiness_area_id,
    );

    expect(areaIds).toEqual(
      expect.arrayContaining([
        "packaging-readiness:setup-bootstrap-expectations",
        "packaging-readiness:test-command-documentation",
        "packaging-readiness:packaging-status",
        "packaging-readiness:move-in-readiness-status",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      doctor_check_count: 15,
      move_in_checklist_item_count: 16,
      phase20b_complete: true,
      phase20c_complete: true,
      packaging_execution_count: 0,
      final_closeout_claim_count: 0,
    });
  });

  it("does not claim final project closeout prematurely", () => {
    const auditReport = report();
    const closeoutArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "packaging-readiness:no-premature-final-closeout",
    );

    expect(closeoutArea?.status).toBe("pass_with_notes");
    expect(closeoutArea?.evidence_summary).toContain(
      "does not claim final project closeout",
    );
    expect(auditReport.final_readiness_statement).toContain(
      "no premature final project closeout claimed",
    );
  });

  it("declares no packaging, install, runtime, provider, network, filesystem, database, UI, authority, approval, source-material, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.readiness_areas.map((area) => area.posture),
    ]) {
      expect(posture.packaging_execution_enabled).toBe(false);
      expect(posture.install_script_execution_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.database_inspection_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.authority_creation_enabled).toBe(false);
      expect(posture.approval_creation_enabled).toBe(false);
      expect(posture.capability_expansion_enabled).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
      expect(posture.final_project_closeout_claimed).toBe(false);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(auditReport)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution, packaging, provider, UI, approval, authority, final-closeout, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalDocumentation)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildPackagingReadinessAuditReport"]),
    );
  });
});
