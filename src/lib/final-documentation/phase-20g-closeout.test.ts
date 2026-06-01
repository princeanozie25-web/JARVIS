import { describe, expect, it } from "vitest";

import * as finalDocumentation from "./index";
import {
  PHASE_20G_AUDIT_IDS,
  PHASE_20G_DOCUMENTATION_AREA_IDS,
  Phase20GCloseoutReportSchema,
  buildPhase20GCloseoutReport,
  type Phase20GCloseoutReport,
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

let cachedReport: Phase20GCloseoutReport | undefined;

function report(): Phase20GCloseoutReport {
  cachedReport ??= buildPhase20GCloseoutReport();
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

describe("Phase 20G.3 final documentation closeout", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES output", () => {
    const closeoutReport = report();

    expect(Phase20GCloseoutReportSchema.safeParse(closeoutReport).success).toBe(
      true,
    );
    expect(JSON.stringify(closeoutReport)).toBe(JSON.stringify(report()));
    expect(closeoutReport).toMatchObject({
      report_version: "20G.3",
      report_id: "phase-20g3-final-documentation-closeout",
      phase: "20G.3",
      verdict: "pass_with_notes",
    });
  }, 180000);

  it("aggregates Phase 20G packaging and onboarding runbook audits", () => {
    const closeoutReport = report();

    expect(closeoutReport.audits.map((audit) => audit.audit_id)).toEqual([
      ...PHASE_20G_AUDIT_IDS,
    ]);
    expect(
      closeoutReport.audits.every(
        (audit) => audit.verdict === "pass_with_notes",
      ),
    ).toBe(true);
    expect(closeoutReport.summary).toMatchObject({
      aggregated_audit_count: 2,
      packaging_readiness_area_count: 13,
      runbook_area_count: 16,
      combined_readiness_area_count: 29,
    });
  });

  it("covers every final documentation readiness area", () => {
    const closeoutReport = report();

    expect(
      closeoutReport.documentation_areas.map(
        (area) => area.documentation_area_id,
      ),
    ).toEqual([...PHASE_20G_DOCUMENTATION_AREA_IDS]);
    expect(closeoutReport.summary).toMatchObject({
      documentation_area_count: 17,
      ready_count: 10,
      ready_with_notes_count: 7,
      blocked_count: 0,
      blocking_area_count: 0,
    });
  });

  it("covers documentation posture for purpose, status, setup, tests, demos, viewers, approvals, CAI, troubleshooting, and contributors", () => {
    const closeoutReport = report();
    const ids = closeoutReport.documentation_areas.map(
      (area) => area.documentation_area_id,
    );

    expect(ids).toEqual(
      expect.arrayContaining([
        "phase-20g-closeout:project-purpose-documented",
        "phase-20g-closeout:roadmap-completion-status-documented",
        "phase-20g-closeout:core-jarvis-os-status-documented",
        "phase-20g-closeout:setup-bootstrap-guidance-documented",
        "phase-20g-closeout:test-validation-guidance-documented",
        "phase-20g-closeout:demo-route-guidance-documented",
        "phase-20g-closeout:read-only-viewer-guidance-documented",
        "phase-20g-closeout:approval-gated-execution-documented",
        "phase-20g-closeout:cai-governed-non-executing-documented",
        "phase-20g-closeout:troubleshooting-documented",
        "phase-20g-closeout:contributor-guidance-documented",
      ]),
    );
  });

  it("preserves disabled capability and expansion-era continuity", () => {
    const closeoutReport = report();
    const disabledArea = closeoutReport.documentation_areas.find(
      (area) =>
        area.documentation_area_id ===
        "phase-20g-closeout:disabled-capabilities-documented",
    );
    const expansionArea = closeoutReport.documentation_areas.find(
      (area) =>
        area.documentation_area_id ===
        "phase-20g-closeout:future-expansion-documented",
    );

    expect(disabledArea?.readiness_status).toBe("ready");
    expect(expansionArea?.readiness_status).toBe("ready");
    expect(closeoutReport.summary).toMatchObject({
      disabled_capability_continuity: true,
      expansion_era_continuity: true,
      disabled_capability_market_active_count: 0,
      expansion_era_market_complete_count: 0,
    });
  });

  it("preserves final safety posture and avoids premature final project completion", () => {
    const closeoutReport = report();

    expect(closeoutReport.summary).toMatchObject({
      source_material_exposure_count: 0,
      premature_final_project_complete_claim_count: 0,
      packaging_execution_count: 0,
      install_execution_count: 0,
      runtime_execution_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      authority_creation_count: 0,
      approval_creation_count: 0,
      capability_expansion_count: 0,
    });
    expect(closeoutReport.final_documentation_readiness_statement).toContain(
      "passes with notes",
    );
  });

  it("aligns notes and blocking areas with the PASS WITH NOTES verdict", () => {
    const closeoutReport = report();

    expect(closeoutReport.blocking_areas).toHaveLength(0);
    expect(closeoutReport.notes).toHaveLength(
      closeoutReport.summary.ready_with_notes_count,
    );
    expect(closeoutReport.summary.non_blocking_note_count).toBe(7);
    expect(closeoutReport.verdict).toBe("pass_with_notes");
  });

  it("declares no packaging, install, runtime, provider, network, filesystem, database, UI, authority, approval, source-material, or capability affordances", () => {
    const closeoutReport = report();

    for (const posture of [
      closeoutReport.posture,
      closeoutReport.summary.posture,
      ...closeoutReport.audits.map((audit) => audit.posture),
      ...closeoutReport.documentation_areas.map((area) => area.posture),
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
      expect(collectKeys(closeoutReport)).not.toContain(forbiddenFieldName);
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
      expect.arrayContaining([
        "buildPackagingReadinessAuditReport",
        "buildOnboardingRunbookAuditReport",
        "buildPhase20GCloseoutReport",
      ]),
    );
  });
});
