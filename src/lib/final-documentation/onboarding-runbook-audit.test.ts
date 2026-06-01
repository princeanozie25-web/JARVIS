import { describe, expect, it } from "vitest";

import * as finalDocumentation from "./index";
import {
  ONBOARDING_RUNBOOK_AREA_IDS,
  OnboardingRunbookAuditReportSchema,
  buildOnboardingRunbookAuditReport,
  type OnboardingRunbookAuditReport,
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

let cachedReport: OnboardingRunbookAuditReport | undefined;

function report(): OnboardingRunbookAuditReport {
  cachedReport ??= buildOnboardingRunbookAuditReport();
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

describe("Phase 20G.2 onboarding runbook readiness audit", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES output", () => {
    const auditReport = report();

    expect(
      OnboardingRunbookAuditReportSchema.safeParse(auditReport).success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(JSON.stringify(report()));
    expect(auditReport).toMatchObject({
      report_version: "20G.2",
      report_id: "phase-20g2-onboarding-runbook-readiness-audit",
      phase: "20G.2",
      verdict: "pass_with_notes",
    });
  }, 180000);

  it("covers every required runbook area", () => {
    const auditReport = report();

    expect(
      auditReport.runbook_areas.map((area) => area.runbook_area_id),
    ).toEqual([...ONBOARDING_RUNBOOK_AREA_IDS]);
    expect(auditReport.summary).toMatchObject({
      runbook_area_count: 16,
      pass_count: 9,
      pass_with_notes_count: 7,
      blocked_count: 0,
      blocking_area_count: 0,
    });
  });

  it("covers project purpose and core OS status", () => {
    const auditReport = report();
    const ids = auditReport.runbook_areas.map((area) => area.runbook_area_id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "onboarding-runbook:project-purpose",
        "onboarding-runbook:core-jarvis-os-status",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      phase20f_complete: true,
      phase20g1_packaging_ready: true,
      core_jarvis_os_complete: true,
    });
  });

  it("covers setup, environment, install, test, and demo guidance", () => {
    const auditReport = report();
    const ids = auditReport.runbook_areas.map((area) => area.runbook_area_id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "onboarding-runbook:safe-local-first-setup",
        "onboarding-runbook:environment-safe-defaults",
        "onboarding-runbook:install-bootstrap-expectations",
        "onboarding-runbook:test-validation-commands",
        "onboarding-runbook:demo-routes",
      ]),
    );
    expect(auditReport.summary).toMatchObject({
      doctor_check_count: 15,
      onboarding_step_count: 15,
      move_in_checklist_item_count: 16,
      demo_surface_count: 18,
      demo_safe_surface_count: 18,
      portfolio_report_section_count: 11,
    });
    expect(auditReport.summary.bootstrap_requirement_count).toBeGreaterThan(0);
  });

  it("covers read-only viewers, disabled capabilities, and approval-gated execution", () => {
    const auditReport = report();
    const readOnlyArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id === "onboarding-runbook:read-only-viewer-surfaces",
    );
    const disabledArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id === "onboarding-runbook:disabled-capabilities",
    );
    const approvalArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id === "onboarding-runbook:approval-gated-execution",
    );

    expect(readOnlyArea?.status).toBe("pass");
    expect(disabledArea?.status).toBe("pass");
    expect(approvalArea?.status).toBe("pass");
    expect(auditReport.summary.disabled_feature_count).toBe(18);
    expect(readOnlyArea?.evidence_summary).toContain("read-only");
    expect(disabledArea?.evidence_summary).toContain("disabled/deferred");
    expect(approvalArea?.evidence_summary).toContain("approval bypass");
  });

  it("keeps CAI and expansion-era posture clear", () => {
    const auditReport = report();
    const caiArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id ===
        "onboarding-runbook:cai-governed-non-executing",
    );
    const expansionArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id === "onboarding-runbook:expansion-era-future-work",
    );

    expect(caiArea?.status).toBe("pass_with_notes");
    expect(expansionArea?.status).toBe("pass");
    expect(caiArea?.evidence_summary).toContain("non-executing");
    expect(expansionArea?.evidence_summary).toContain("future-only");
    expect(auditReport.summary.expansion_era_count).toBe(7);
  });

  it("covers troubleshooting and contributor extension guidance", () => {
    const auditReport = report();
    const troubleshootingArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id ===
        "onboarding-runbook:troubleshooting-known-warnings",
    );
    const contributorArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id ===
        "onboarding-runbook:contributor-extension-guidance",
    );

    expect(troubleshootingArea?.status).toBe("pass_with_notes");
    expect(contributorArea?.status).toBe("pass_with_notes");
    expect(auditReport.summary).toMatchObject({
      troubleshooting_note_count: 1,
      contributor_guidance_count: 1,
    });
    expect(troubleshootingArea?.evidence_summary).toContain(
      "manual-only recovery",
    );
    expect(contributorArea?.evidence_summary).toContain(
      "governance-before-capability",
    );
  });

  it("does not claim final completion and exposes no source material", () => {
    const auditReport = report();
    const closeoutArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id ===
        "onboarding-runbook:no-premature-final-completion",
    );
    const sourceArea = auditReport.runbook_areas.find(
      (area) =>
        area.runbook_area_id ===
        "onboarding-runbook:no-source-material-exposure",
    );

    expect(closeoutArea?.status).toBe("pass_with_notes");
    expect(sourceArea?.status).toBe("pass");
    expect(auditReport.summary).toMatchObject({
      final_completion_claim_count: 0,
      source_material_exposure_count: 0,
    });
    expect(auditReport.final_runbook_statement).toContain(
      "no premature final completion claim",
    );
  });

  it("declares no packaging, install, runtime, provider, network, filesystem, database, UI, authority, approval, source-material, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.runbook_areas.map((area) => area.posture),
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
      expect.arrayContaining([
        "buildPackagingReadinessAuditReport",
        "buildOnboardingRunbookAuditReport",
      ]),
    );
  });
});
