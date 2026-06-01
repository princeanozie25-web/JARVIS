import { describe, expect, it } from "vitest";

import * as portfolioReadiness from "./index";
import {
  PORTFOLIO_REPORT,
  PORTFOLIO_REPORT_FUTURE_EXPANSION_TARGETS,
  PORTFOLIO_REPORT_SECTION_IDS,
  PortfolioReportSchema,
  buildPortfolioReport,
  getDemoFlowRegistry,
  getDemoSurfaceRegistry,
  getPortfolioReadinessEvidence,
  getRecruiterNarrativeRegistry,
  summarizePortfolioReport,
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

describe("Phase 20D.5 portfolio report generator", () => {
  it("builds a deterministic typed metadata-only portfolio report", () => {
    const report = buildPortfolioReport();

    expect(PortfolioReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(JSON.stringify(buildPortfolioReport()));
    expect(report).toMatchObject({
      report_version: "20D.5",
      report_id: "phase-20d5-portfolio-report",
      phase: "20D.5",
      verdict: "portfolio_ready_metadata_only",
      source_summaries: {
        portfolio_contract: expect.objectContaining({
          contract_version: "20D.1",
        }),
        recruiter_narratives: expect.objectContaining({
          registry_version: "20D.2",
        }),
        demo_surfaces: expect.objectContaining({
          registry_version: "20D.3",
        }),
        demo_flows: expect.objectContaining({
          registry_version: "20D.4",
        }),
      },
      posture: {
        metadata_only: true,
        read_only: true,
        deterministic: true,
        presentation_generation_enabled: false,
        demo_execution_enabled: false,
        ui_route_created: false,
        automation_enabled: false,
        filesystem_mutation_enabled: false,
        network_call_enabled: false,
        provider_call_enabled: false,
        runtime_execution_enabled: false,
        approval_bypass_created: false,
        authority_surface_created: false,
        capability_created: false,
      },
    });
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(PORTFOLIO_REPORT)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_REPORT.sections)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_REPORT.sections[0])).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_REPORT.evidence)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_REPORT.evidence[0])).toBe(true);

    const report = buildPortfolioReport();
    report.sections[0].title = "Mutated";
    report.sections[0].narrative_ids.push(
      "recruiter-narrative:future-gitnexus",
    );
    report.evidence[0].label = "Mutated evidence";

    const restored = buildPortfolioReport();
    expect(restored.sections[0]).toMatchObject({
      section_id: "portfolio-report-section:overall-portfolio-verdict",
      title: "Overall portfolio verdict",
      narrative_ids: ["recruiter-narrative:portfolio-value"],
    });
    expect(restored.evidence[0]).toMatchObject({
      evidence_id: "portfolio-report-evidence:portfolio-readiness-contract",
      metadata_only: true,
    });

    const evidence = getPortfolioReadinessEvidence();
    evidence[0].label = "Mutated helper evidence";
    expect(getPortfolioReadinessEvidence()[0].label).not.toBe(
      "Mutated helper evidence",
    );
    expect(getPortfolioReadinessEvidence()[0].label).toContain(
      "Phase 20D.1 portfolio readiness contract",
    );
  });

  it("represents all major portfolio report sections", () => {
    const report = buildPortfolioReport();

    expect(report.sections.map((section) => section.section_id)).toEqual([
      ...PORTFOLIO_REPORT_SECTION_IDS,
    ]);
    expect(report.sections.every((section) => section.summary.length > 0)).toBe(
      true,
    );
    expect(
      report.sections.every(
        (section) => section.readiness_statement.length > 0,
      ),
    ).toBe(true);
  });

  it("references existing narratives, demo surfaces, and demo flows", () => {
    const narrativeIds = new Set(
      getRecruiterNarrativeRegistry().narratives.map(
        (narrative) => narrative.narrative_id,
      ),
    );
    const surfaceIds = new Set(
      getDemoSurfaceRegistry().surfaces.map((surface) => surface.surface_id),
    );
    const flowIds = new Set(
      getDemoFlowRegistry().flows.map((flow) => flow.flow_id),
    );

    for (const item of [
      ...buildPortfolioReport().sections,
      ...getPortfolioReadinessEvidence(),
    ]) {
      for (const narrativeId of item.narrative_ids) {
        expect(narrativeIds.has(narrativeId)).toBe(true);
      }
      for (const surfaceId of item.demo_surface_ids) {
        expect(surfaceIds.has(surfaceId)).toBe(true);
      }
      for (const flowId of item.demo_flow_ids) {
        expect(flowIds.has(flowId)).toBe(true);
      }
    }
  });

  it("represents future expansion posture and targets", () => {
    const report = buildPortfolioReport();
    const futureSection = report.sections.find(
      (section) =>
        section.section_id ===
        "portfolio-report-section:future-expansion-summary",
    );

    expect(futureSection).toMatchObject({
      category: "future_expansion",
      narrative_ids: expect.arrayContaining([
        "recruiter-narrative:future-gitnexus",
        "recruiter-narrative:future-graphify",
        "recruiter-narrative:future-llm-council",
        "recruiter-narrative:future-obsidian",
        "recruiter-narrative:future-security-project-integration",
      ]),
      demo_flow_ids: ["demo-flow:expansion-era"],
    });
    expect(report.future_expansion_summary).toMatchObject({
      posture: "future_expansion_metadata_only_not_enabled",
      targets: [...PORTFOLIO_REPORT_FUTURE_EXPANSION_TARGETS],
      metadata_only: true,
    });

    expect(summarizePortfolioReport()).toMatchObject({
      future_expansion_target_count: 5,
    });
  });

  it("summarizes portfolio report counts consistently", () => {
    const report = buildPortfolioReport();
    const summary = summarizePortfolioReport();

    expect(summary).toMatchObject({
      report_version: "20D.5",
      verdict: "portfolio_ready_metadata_only",
      section_count: 11,
      evidence_count: 5,
      narrative_reference_count: 25,
      demo_surface_reference_count: 31,
      demo_flow_reference_count: 16,
      phase20d_portfolio_report_only: true,
      phase20d_capability_neutral: true,
    });
    expect(summary.section_count).toBe(report.sections.length);
    expect(summary.evidence_count).toBe(report.evidence.length);
    expect(summary.narrative_reference_count).toBe(
      report.sections.reduce(
        (count, section) => count + section.narrative_ids.length,
        0,
      ),
    );
    expect(summary.demo_surface_reference_count).toBe(
      report.sections.reduce(
        (count, section) => count + section.demo_surface_ids.length,
        0,
      ),
    );
    expect(summary.demo_flow_reference_count).toBe(
      report.sections.reduce(
        (count, section) => count + section.demo_flow_ids.length,
        0,
      ),
    );
  });

  it("declares no presentation, UI, demo, runtime, provider, network, authority, raw payload, or capability affordances", () => {
    const report = buildPortfolioReport();
    const summary = summarizePortfolioReport();

    for (const posture of [report.posture, summary.posture]) {
      expect(posture.presentation_generation_enabled).toBe(false);
      expect(posture.demo_execution_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.automation_enabled).toBe(false);
      expect(posture.shell_execution_enabled).toBe(false);
      expect(posture.process_spawn_enabled).toBe(false);
      expect(posture.filesystem_mutation_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.approval_bypass_created).toBe(false);
      expect(posture.authority_surface_created).toBe(false);
      expect(posture.capability_created).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
    }

    expect(report.sections.every((section) => section.metadata_only)).toBe(
      true,
    );
    expect(report.evidence.every((item) => item.metadata_only)).toBe(true);

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys({ report, summary })).not.toContain(
        forbiddenFieldName,
      );
    }
  });

  it("exports no presentation, UI route, demo execution, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(portfolioReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "buildPortfolioReport",
        "getPortfolioReadinessEvidence",
        "summarizePortfolioReport",
      ]),
    );
  });
});
