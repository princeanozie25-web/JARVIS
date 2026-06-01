import { describe, expect, it } from "vitest";

import * as finalCloseoutModule from "./index";
import {
  FINAL_PROJECT_READINESS_AREA_IDS,
  FinalProjectReadinessAuditReportSchema,
  buildFinalProjectReadinessAuditReport,
  type FinalProjectReadinessAuditReport,
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

let cachedReport: FinalProjectReadinessAuditReport | undefined;

function report(): FinalProjectReadinessAuditReport {
  cachedReport ??= buildFinalProjectReadinessAuditReport();
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

describe("Phase 20H.1 final project readiness audit", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES output", () => {
    const auditReport = report();

    expect(
      FinalProjectReadinessAuditReportSchema.safeParse(auditReport).success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(JSON.stringify(report()));
    expect(auditReport).toMatchObject({
      report_version: "20H.1",
      report_id: "phase-20h1-final-project-readiness-audit",
      phase: "20H.1",
      verdict: "pass_with_notes",
    });
  }, 240000);

  it("covers every final project readiness area", () => {
    const auditReport = report();

    expect(
      auditReport.readiness_areas.map((area) => area.readiness_area_id),
    ).toEqual([...FINAL_PROJECT_READINESS_AREA_IDS]);
    expect(auditReport.summary).toMatchObject({
      readiness_area_count: 14,
      complete_count: 8,
      complete_with_notes_count: 6,
      blocked_count: 0,
      blocking_area_count: 0,
      non_blocking_note_count: 6,
    });
    expect(auditReport.notes).toHaveLength(6);
    expect(auditReport.blocking_areas).toHaveLength(0);
  });

  it("aggregates final hardening closeout evidence", () => {
    const auditReport = report();
    const hardeningArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "final-project-readiness:final-hardening-complete",
    );

    expect(hardeningArea?.completion_status).toBe("complete");
    expect(hardeningArea?.evidence_ids).toEqual(
      expect.arrayContaining([
        "phase-20f10-final-hardening-closeout",
        "phase-20f-closeout:final-hardening-status-complete",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      final_hardening_complete: true,
      final_hardening_audit_count: 9,
      core_jarvis_os_complete: true,
      system_area_count: 39,
    });
  });

  it("aggregates final documentation closeout evidence", () => {
    const auditReport = report();
    const documentationArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "final-project-readiness:final-documentation-complete",
    );

    expect(documentationArea?.completion_status).toBe("complete");
    expect(documentationArea?.evidence_ids).toEqual(
      expect.arrayContaining([
        "phase-20g3-final-documentation-closeout",
        "phase-20g-closeout:no-premature-final-project-complete-claim",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      final_documentation_complete: true,
      final_documentation_audit_count: 2,
      documentation_area_count: 17,
      combined_documentation_readiness_area_count: 29,
    });
  });

  it("covers core operationalization, fortress, and read-only demo surface readiness", () => {
    const auditReport = report();
    const ids = auditReport.readiness_areas.map(
      (area) => area.readiness_area_id,
    );

    expect(ids).toEqual(
      expect.arrayContaining([
        "final-project-readiness:core-jarvis-os-roadmap-complete",
        "final-project-readiness:operationalization-systems-complete",
        "final-project-readiness:fortress-surfaces-complete",
        "final-project-readiness:visible-demo-surfaces-read-only",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      operationalization_system_count: 13,
      demo_surface_count: 18,
      demo_safe_surface_count: 18,
    });
  });

  it("preserves disabled capability, CAI, and expansion-era continuity", () => {
    const auditReport = report();
    const disabledArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "final-project-readiness:disabled-capabilities-remain-disabled",
    );
    const caiArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "final-project-readiness:cai-governed-non-executing",
    );
    const expansionArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "final-project-readiness:expansion-era-future-only",
    );

    expect(disabledArea?.completion_status).toBe("complete");
    expect(caiArea?.completion_status).toBe("complete_with_notes");
    expect(expansionArea?.completion_status).toBe("complete_with_notes");
    expect(auditReport.summary).toMatchObject({
      disabled_feature_count: 18,
      disabled_capability_continuity: true,
      cai_governed_non_executing: true,
      expansion_era_count: 7,
      expansion_era_future_only: true,
    });
  });

  it("does not claim final project closeout or introduce source exposure/capability expansion", () => {
    const auditReport = report();
    const noPrematureClaimArea = auditReport.readiness_areas.find(
      (area) =>
        area.readiness_area_id ===
        "final-project-readiness:no-premature-final-project-completion-claim",
    );

    expect(noPrematureClaimArea?.completion_status).toBe("complete_with_notes");
    expect(auditReport.final_closeout_readiness_statement).toContain(
      "does not claim final project closeout",
    );
    expect(auditReport.summary).toMatchObject({
      source_material_exposure_count: 0,
      premature_final_project_completion_claim_count: 0,
      capability_expansion_count: 0,
      packaging_execution_count: 0,
      runtime_execution_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      authority_creation_count: 0,
      approval_creation_count: 0,
      final_project_readiness_audit_only: true,
      phase20h_capability_neutral: true,
    });
  });

  it("declares no packaging, runtime, provider, network, filesystem, database, UI, authority, approval, source-material, completion-claim, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.readiness_areas.map((area) => area.posture),
    ]) {
      expect(posture.packaging_execution_enabled).toBe(false);
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

  it("exports no execution, packaging, provider, UI, approval, authority, closeout, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalCloseoutModule)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildFinalProjectReadinessAuditReport"]),
    );
  });
});
