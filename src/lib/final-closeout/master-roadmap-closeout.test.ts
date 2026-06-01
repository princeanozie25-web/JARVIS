import { describe, expect, it } from "vitest";

import * as finalCloseoutModule from "./index";
import {
  MASTER_ROADMAP_SOURCE_AUDIT_IDS,
  MasterRoadmapCloseoutReportSchema,
  buildMasterRoadmapCloseoutReport,
  type MasterRoadmapCloseoutReport,
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

let cachedReport: MasterRoadmapCloseoutReport | undefined;

function report(): MasterRoadmapCloseoutReport {
  cachedReport ??= buildMasterRoadmapCloseoutReport();
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

describe("Phase 20H.2 master roadmap closeout report", () => {
  it("produces deterministic typed metadata-only PASS WITH NOTES output", () => {
    const closeoutReport = report();

    expect(
      MasterRoadmapCloseoutReportSchema.safeParse(closeoutReport).success,
    ).toBe(true);
    expect(JSON.stringify(closeoutReport)).toBe(JSON.stringify(report()));
    expect(closeoutReport).toMatchObject({
      roadmap_id: "jarvis-operationalization-roadmap",
      closeout_version: "20H.2",
      report_id: "phase-20h2-master-roadmap-closeout-report",
      phase: "20H.2",
      aggregated_verdict: "pass_with_notes",
      final_declaration_readiness: "ready_for_final_declaration",
    });
  });

  it("represents all source audits required by the master roadmap closeout", () => {
    const closeoutReport = report();

    expect(
      closeoutReport.source_audits.map((audit) => audit.source_audit_id),
    ).toEqual([...MASTER_ROADMAP_SOURCE_AUDIT_IDS]);
    expect(closeoutReport.summary).toMatchObject({
      source_audit_count: 5,
      final_project_readiness_pass_with_notes: true,
      final_hardening_complete: true,
      final_documentation_complete: true,
    });
  });

  it("covers completed roadmap phase and system/demo/documentation evidence counts", () => {
    const closeoutReport = report();

    expect(closeoutReport.completed_phase_count).toBe(20);
    expect(closeoutReport.summary).toMatchObject({
      completed_phase_count: 20,
      represented_core_roadmap_phase_count: 20,
      core_roadmap_system_count: 13,
      final_project_readiness_area_count: 14,
      final_hardening_audit_count: 9,
      final_documentation_audit_count: 2,
      system_completion_area_count: 39,
      demo_portfolio_readiness_area_count: 13,
    });
  });

  it("aligns summary counts with source audits and remaining notes", () => {
    const closeoutReport = report();
    const noteCount = closeoutReport.source_audits.reduce(
      (total, audit) => total + audit.non_blocking_note_count,
      0,
    );

    expect(closeoutReport.blocking_issue_count).toBe(0);
    expect(closeoutReport.non_blocking_note_count).toBe(noteCount);
    expect(closeoutReport.summary.non_blocking_note_count).toBe(noteCount);
    expect(closeoutReport.remaining_notes).toHaveLength(3);
    expect(closeoutReport.summary.blocking_issue_count).toBe(0);
  });

  it("preserves disabled capability, CAI, and expansion-era continuity", () => {
    const closeoutReport = report();

    expect(
      closeoutReport.evidence_summary.disabled_capability_continuity,
    ).toContain("Disabled capability continuity");
    expect(closeoutReport.evidence_summary.expansion_era_boundary).toContain(
      "future-only",
    );
    expect(closeoutReport.summary).toMatchObject({
      disabled_capability_continuity: true,
      cai_governed_non_executing: true,
      expansion_era_future_only: true,
    });
  });

  it("does not emit the final project declaration or introduce capability expansion", () => {
    const closeoutReport = report();

    expect(closeoutReport.final_declaration_readiness).toBe(
      "ready_for_final_declaration",
    );
    expect(closeoutReport.final_declaration_readiness_statement).toContain(
      "no final declaration has been emitted yet",
    );
    expect(closeoutReport.summary).toMatchObject({
      final_declaration_emitted: false,
      source_material_exposure_count: 0,
      capability_expansion_count: 0,
      packaging_execution_count: 0,
      runtime_execution_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      authority_creation_count: 0,
      approval_creation_count: 0,
      master_roadmap_closeout_only: true,
      phase20h_capability_neutral: true,
    });
  });

  it("declares no packaging, runtime, provider, network, filesystem, database, UI, authority, approval, source-material, completion-claim, or capability affordances", () => {
    const closeoutReport = report();

    for (const posture of [
      closeoutReport.posture,
      closeoutReport.summary.posture,
      ...closeoutReport.source_audits.map((audit) => audit.posture),
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
      expect(collectKeys(closeoutReport)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution, packaging, provider, UI, approval, authority, final declaration, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalCloseoutModule)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "buildFinalProjectReadinessAuditReport",
        "buildMasterRoadmapCloseoutReport",
      ]),
    );
  });
});
