import { describe, expect, it } from "vitest";

import * as finalCloseoutModule from "./index";
import {
  FINAL_PROJECT_COMPLETED_SUBSYSTEM_IDS,
  FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT,
  FINAL_PROJECT_FUTURE_EXPANSION_IDS,
  FinalProjectDeclarationReportSchema,
  buildFinalProjectDeclarationReport,
  type FinalProjectDeclarationReport,
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

let cachedReport: FinalProjectDeclarationReport | undefined;

function report(): FinalProjectDeclarationReport {
  cachedReport ??= buildFinalProjectDeclarationReport();
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

describe("Phase 20H.3 final project declaration", () => {
  it("produces deterministic typed metadata-only final declaration PASS output", () => {
    const declaration = report();

    expect(
      FinalProjectDeclarationReportSchema.safeParse(declaration).success,
    ).toBe(true);
    expect(JSON.stringify(declaration)).toBe(JSON.stringify(report()));
    expect(declaration).toMatchObject({
      declaration_version: "20H.3",
      report_id: "phase-20h3-final-project-declaration",
      phase: "20H.3",
      roadmap_status: "phase_1_20_complete",
      completion_verdict: "pass",
      final_declaration_timestamp_surrogate:
        "phase-20h3-final-project-declaration-v1",
    });
  });

  it("declares Phase 1-20 roadmap completion with aligned summary counts", () => {
    const declaration = report();

    expect(declaration.completed_phase_count).toBe(20);
    expect(declaration.total_test_count).toBe(
      FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT,
    );
    expect(declaration.summary).toMatchObject({
      roadmap_status: "phase_1_20_complete",
      completion_verdict: "pass",
      completed_phase_count: 20,
      completed_subsystem_count: 10,
      future_expansion_count: 7,
      total_test_count: FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT,
      blocking_issue_count: 0,
    });
  });

  it("covers every required completed subsystem without ambiguity", () => {
    const declaration = report();

    expect(
      declaration.completed_subsystems.map((system) => system.subsystem_id),
    ).toEqual([...FINAL_PROJECT_COMPLETED_SUBSYSTEM_IDS]);
    expect(declaration.completed_subsystems).toHaveLength(10);
    expect(declaration.final_declaration_statement).toContain("Core JARVIS OS");
    expect(declaration.summary).toMatchObject({
      core_jarvis_os_complete: true,
      fortress_layer_complete: true,
      final_hardening_complete: true,
      documentation_complete: true,
      final_readiness_complete: true,
      no_complete_future_ambiguity: true,
    });
  });

  it("covers every future expansion item as not complete and not shipped", () => {
    const declaration = report();

    expect(
      declaration.future_expansion_items.map(
        (item) => item.future_expansion_id,
      ),
    ).toEqual([...FINAL_PROJECT_FUTURE_EXPANSION_IDS]);
    expect(
      declaration.future_expansion_items.every(
        (item) => item.not_complete_in_roadmap && !item.shipped_capability,
      ),
    ).toBe(true);
    expect(declaration.future_expansion_summary).toContain(
      "real CAI execution enablement",
    );
  });

  it("keeps complete and future work explicitly separated", () => {
    const declaration = report();
    const completedTitles = new Set(
      declaration.completed_subsystems.map((system) => system.title),
    );
    const futureTitles = new Set(
      declaration.future_expansion_items.map((item) => item.title),
    );

    for (const futureTitle of futureTitles) {
      expect(completedTitles.has(futureTitle)).toBe(false);
    }
    expect(declaration.evidence_summary.complete_vs_future_boundary).toContain(
      "explicitly separated",
    );
  });

  it("aggregates final readiness, master closeout, hardening, documentation, and system completion evidence", () => {
    const declaration = report();

    expect(declaration.evidence_summary).toMatchObject({
      final_project_readiness_audit: expect.stringContaining("Phase 20H.1"),
      master_roadmap_closeout: expect.stringContaining("Phase 20H.2"),
      final_hardening_closeout: expect.stringContaining("Phase 20F"),
      documentation_closeout: expect.stringContaining("Phase 20G"),
      system_completion_audit: expect.stringContaining("core JARVIS OS"),
    });
  });

  it("declares no runtime, packaging, provider, network, filesystem, database, UI, authority, approval, source-material, or capability affordances", () => {
    const declaration = report();

    for (const posture of [
      declaration.posture,
      declaration.summary.posture,
      ...declaration.completed_subsystems.map((system) => system.posture),
      ...declaration.future_expansion_items.map((item) => item.posture),
    ]) {
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.packaging_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.database_inspection_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.authority_creation_enabled).toBe(false);
      expect(posture.approval_creation_enabled).toBe(false);
      expect(posture.capability_expansion_enabled).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
      expect(posture.roadmap_completion_declared).toBe(true);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(declaration)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution, packaging, provider, UI, approval, authority, or mutation affordance names", () => {
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
        "buildFinalProjectDeclarationReport",
      ]),
    );
  });
});
