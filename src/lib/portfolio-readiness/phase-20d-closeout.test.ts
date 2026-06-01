import { describe, expect, it } from "vitest";

import * as portfolioReadiness from "./index";
import {
  PHASE_20D_CLOSEOUT_CHECK_IDS,
  PHASE_20D_FUTURE_EXPANSION_TARGETS,
  PHASE_20D_MODULE_IDS,
  Phase20DCloseoutReportSchema,
  buildPhase20DCloseoutReport,
  summarizeDemoFlows,
  summarizeDemoSurfaces,
  summarizePortfolioReport,
  summarizeRecruiterNarratives,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "generatePresentation",
  "executeDemo",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
  "raw_payload_exposure_enabled",
  "raw_payload_exposure_absent",
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

describe("Phase 20D.6 portfolio readiness closeout", () => {
  it("builds a deterministic typed closeout report", () => {
    const report = buildPhase20DCloseoutReport();

    expect(Phase20DCloseoutReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildPhase20DCloseoutReport()),
    );
    expect(report).toMatchObject({
      closeout_version: "20D.6",
      closeout_id: "phase-20d6-portfolio-readiness-closeout",
      phase: "20D",
      verdict: "passed",
      phase_20d_complete: true,
      phase_20e_ready: true,
      module_presence: {
        portfolio_readiness_contract: true,
        recruiter_narrative_registry: true,
        demo_surface_registry: true,
        demo_flow_registry: true,
        portfolio_report_generator: true,
      },
    });
  });

  it("includes all Phase 20D modules and closeout checks", () => {
    const report = buildPhase20DCloseoutReport();

    expect(report.module_ids).toEqual([...PHASE_20D_MODULE_IDS]);
    expect(report.checks.map((check) => check.check_id)).toEqual([
      ...PHASE_20D_CLOSEOUT_CHECK_IDS,
    ]);
    expect(report.checks.every((check) => check.status === "passed")).toBe(
      true,
    );
    expect(report.checks.every((check) => check.metadata_only)).toBe(true);
    expect(report.summary).toMatchObject({
      module_count: 5,
      closeout_check_count: PHASE_20D_CLOSEOUT_CHECK_IDS.length,
    });
  });

  it("represents recruiter narratives, demo surfaces, demo flows, and the portfolio report generator", () => {
    const report = buildPhase20DCloseoutReport();

    expect(report.representation_summary).toMatchObject({
      recruiter_narratives_represented: true,
      demo_surfaces_represented: true,
      demo_flows_represented: true,
      portfolio_report_composes_existing_metadata: true,
    });
    expect(report.summary).toMatchObject({
      recruiter_narrative_count: summarizeRecruiterNarratives().narrative_count,
      demo_surface_count: summarizeDemoSurfaces().surface_count,
      demo_flow_count: summarizeDemoFlows().flow_count,
      portfolio_report_section_count: summarizePortfolioReport().section_count,
      portfolio_report_evidence_count:
        summarizePortfolioReport().evidence_count,
    });
  });

  it("represents future expansion posture for GitNexus, Graphify, LLM Council, Obsidian, and security project integration", () => {
    const report = buildPhase20DCloseoutReport();

    expect(report.future_expansion_posture).toEqual({
      future_expansion_metadata_only_not_enabled: true,
      targets: [...PHASE_20D_FUTURE_EXPANSION_TARGETS],
      report_target_label: "Security integrations",
    });
    expect(report.summary.future_expansion_target_count).toBe(5);
    expect(
      report.checks.find(
        (check) =>
          check.check_id === "phase-20d:future-expansion-posture-represented",
      )?.evidence_ids,
    ).toEqual([...PHASE_20D_FUTURE_EXPANSION_TARGETS]);
  });

  it("represents architecture, governance, Command Center/demo, local-first, and safety visibility", () => {
    const report = buildPhase20DCloseoutReport();

    expect(report.representation_summary).toMatchObject({
      architecture_visibility_represented: true,
      governance_visibility_represented: true,
      command_center_demo_visibility_represented: true,
      local_first_safety_narrative_represented: true,
    });
    expect(
      report.checks.find(
        (check) =>
          check.check_id === "phase-20d:architecture-visibility-represented",
      )?.evidence_ids,
    ).toEqual([
      "portfolio-area:architecture-visibility",
      "demo-surface:architecture-graph",
    ]);
    expect(
      report.checks.find(
        (check) =>
          check.check_id === "phase-20d:governance-visibility-represented",
      )?.evidence_ids,
    ).toEqual([
      "portfolio-area:governance-visibility",
      "demo-surface:governance-boundary-visualizer",
    ]);
  });

  it("declares no presentation, UI, demo, automation, network/provider, runtime, approval, authority, or source exposure posture", () => {
    const report = buildPhase20DCloseoutReport();

    expect(report.safety_posture_summary).toMatchObject({
      presentation_generation_absent: true,
      ui_route_absent: true,
      demo_execution_absent: true,
      automation_absent: true,
      shell_process_execution_absent: true,
      filesystem_mutation_absent: true,
      network_provider_calls_absent: true,
      runtime_execution_absent: true,
      approval_bypass_absent: true,
      authority_surface_absent: true,
      source_material_exposure_absent: true,
      metadata_only: true,
    });
    expect(report.posture).toMatchObject({
      metadata_only: true,
      read_only: true,
      deterministic: true,
      presentation_generation_enabled: false,
      demo_execution_enabled: false,
      ui_route_created: false,
      automation_enabled: false,
      shell_execution_enabled: false,
      process_spawn_enabled: false,
      filesystem_mutation_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      runtime_execution_enabled: false,
      approval_bypass_created: false,
      authority_surface_created: false,
      capability_created: false,
      source_material_exposure_enabled: false,
    });

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(report)).not.toContain(forbiddenFieldName);
    }
  });

  it("declares Phase 20D complete and Phase 20E-ready", () => {
    const report = buildPhase20DCloseoutReport();

    expect(report.phase_20d_complete).toBe(true);
    expect(report.phase_20e_ready).toBe(true);
    expect(report.next_phase_readiness_statement).toContain(
      "Phase 20E cross-phase audit sweep",
    );
  });

  it("exports no presentation, UI route, demo execution, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(portfolioReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildPhase20DCloseoutReport"]),
    );
  });
});
