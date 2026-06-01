import { describe, expect, it } from "vitest";

import * as portfolioReadiness from "./index";
import {
  DEMO_READINESS_SURFACE_IDS,
  PORTFOLIO_AREA_IDS,
  PORTFOLIO_NARRATIVE_IDS,
  PORTFOLIO_READINESS_CATEGORIES,
  PORTFOLIO_READINESS_CONTRACT,
  PortfolioReadinessContractSchema,
  getDemoReadinessSurfaces,
  getPortfolioReadinessAreas,
  getPortfolioReadinessContract,
  getPortfolioReadinessNarratives,
  summarizePortfolioReadiness,
} from "./index";

const REQUIRED_AREA_IDS = [
  "portfolio-area:architecture-visibility",
  "portfolio-area:governance-visibility",
  "portfolio-area:command-center-visibility",
  "portfolio-area:room-os-visibility",
  "portfolio-area:model-runtime-visibility",
  "portfolio-area:voice-runtime-visibility",
  "portfolio-area:vision-runtime-visibility",
  "portfolio-area:approval-runtime-visibility",
  "portfolio-area:observability-visibility",
  "portfolio-area:red-team-visibility",
  "portfolio-area:onboarding-visibility",
  "portfolio-area:move-in-readiness-visibility",
] as const;

const REQUIRED_NARRATIVE_IDS = [
  "portfolio-narrative:project",
  "portfolio-narrative:architecture",
  "portfolio-narrative:governance",
  "portfolio-narrative:technical-complexity",
  "portfolio-narrative:safety",
  "portfolio-narrative:local-first",
] as const;

const REQUIRED_DEMO_SURFACE_IDS = [
  "demo-surface:demo-mode-availability",
  "demo-surface:synthetic-data-posture",
  "demo-surface:fake-room-posture",
  "demo-surface:replay-visibility",
  "demo-surface:architecture-graph-visibility",
  "demo-surface:governance-graph-visibility",
  "demo-surface:telemetry-cockpit-visibility",
] as const;

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

describe("Phase 20D.1 portfolio readiness contract", () => {
  it("exposes a typed deterministic metadata-only portfolio contract", () => {
    const contract = getPortfolioReadinessContract();

    expect(PortfolioReadinessContractSchema.safeParse(contract).success).toBe(
      true,
    );
    expect(JSON.stringify(contract)).toBe(
      JSON.stringify(getPortfolioReadinessContract()),
    );
    expect(contract).toMatchObject({
      contract_version: "20D.1",
      contract_id: "phase-20d1-portfolio-readiness-contract",
      phase: "20D.1",
      categories: [...PORTFOLIO_READINESS_CATEGORIES],
      posture: {
        contract_only: true,
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
      },
    });
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(PORTFOLIO_READINESS_CONTRACT)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_READINESS_CONTRACT.portfolio_areas)).toBe(
      true,
    );
    expect(
      Object.isFrozen(PORTFOLIO_READINESS_CONTRACT.portfolio_areas[0]),
    ).toBe(true);

    const contract = getPortfolioReadinessContract();
    contract.portfolio_areas[0].label = "Mutated";
    contract.recruiter_narratives[0].talking_points.push("mutation");
    contract.demo_surfaces[0].label = "Mutated Demo";

    expect(getPortfolioReadinessContract().portfolio_areas[0]).toMatchObject({
      area_id: "portfolio-area:architecture-visibility",
      label: "Architecture visibility",
    });
    expect(
      getPortfolioReadinessContract().recruiter_narratives[0],
    ).toMatchObject({
      narrative_id: "portfolio-narrative:project",
      talking_points: [
        "Local-first assistant operating system, not a thin chatbot wrapper.",
        "Final readiness is expressed as typed metadata rather than ad hoc claims.",
      ],
    });
    expect(getPortfolioReadinessContract().demo_surfaces[0]).toMatchObject({
      surface_id: "demo-surface:demo-mode-availability",
      label: "Demo mode availability",
    });
  });

  it("represents required portfolio visibility areas", () => {
    const areas = getPortfolioReadinessAreas();

    expect(areas.map((area) => area.area_id)).toEqual([...REQUIRED_AREA_IDS]);
    expect(areas.map((area) => area.area_id)).toEqual([...PORTFOLIO_AREA_IDS]);
    expect(areas.every((area) => area.category === "portfolio_area")).toBe(
      true,
    );
    expect(areas.every((area) => area.local_first_relevance)).toBe(true);
    expect(areas.every((area) => area.safety_relevance)).toBe(true);
  });

  it("represents recruiter readiness narratives", () => {
    const narratives = getPortfolioReadinessNarratives();

    expect(narratives.map((narrative) => narrative.narrative_id)).toEqual([
      ...REQUIRED_NARRATIVE_IDS,
    ]);
    expect(narratives.map((narrative) => narrative.narrative_id)).toEqual([
      ...PORTFOLIO_NARRATIVE_IDS,
    ]);
    expect(narratives.every((narrative) => narrative.recruiter_ready)).toBe(
      true,
    );
    expect(
      narratives.find(
        (narrative) =>
          narrative.narrative_id === "portfolio-narrative:governance",
      ),
    ).toMatchObject({
      talking_points: expect.arrayContaining([
        "Risky surfaces are documented and intentionally disabled.",
      ]),
    });
  });

  it("represents demo readiness surfaces", () => {
    const surfaces = getDemoReadinessSurfaces();

    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...REQUIRED_DEMO_SURFACE_IDS,
    ]);
    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...DEMO_READINESS_SURFACE_IDS,
    ]);
    expect(surfaces.every((surface) => !surface.demo_execution_required)).toBe(
      true,
    );
    expect(surfaces.every((surface) => surface.fake_room_safe)).toBe(true);
    expect(surfaces.every((surface) => surface.replay_safe)).toBe(true);
  });

  it("represents architecture, governance, and demo visibility", () => {
    expect(
      getPortfolioReadinessAreas().find(
        (area) => area.area_id === "portfolio-area:architecture-visibility",
      )?.evidence_ids,
    ).toEqual(
      expect.arrayContaining([
        "phase-19a:architecture-graph",
        "phase-20a1:final-system-status-registry",
      ]),
    );
    expect(
      getPortfolioReadinessAreas().find(
        (area) => area.area_id === "portfolio-area:governance-visibility",
      )?.evidence_ids,
    ).toEqual(
      expect.arrayContaining([
        "phase-18:approval-gated-execution-layer",
        "phase-20a5:final-governance-readiness-summary",
      ]),
    );
    expect(
      getDemoReadinessSurfaces().find(
        (surface) =>
          surface.surface_id === "demo-surface:demo-mode-availability",
      ),
    ).toMatchObject({
      synthetic_data_required: true,
      fake_room_safe: true,
      replay_safe: true,
    });
  });

  it("summarizes portfolio readiness from the contract", () => {
    const summary = summarizePortfolioReadiness();

    expect(summary).toMatchObject({
      contract_version: "20D.1",
      area_count: 12,
      narrative_count: 6,
      demo_surface_count: 7,
      category_counts: {
        portfolio_area: 12,
        recruiter_narrative: 6,
        demo_surface: 7,
      },
      local_first_area_count: 12,
      safety_relevant_area_count: 12,
      synthetic_data_surface_count: 5,
      fake_room_safe_surface_count: 7,
      replay_safe_surface_count: 7,
      recruiter_ready_narrative_count: 6,
      phase20d_contract_only: true,
      phase20d_capability_neutral: true,
    });
  });

  it("declares no UI, automation, runtime, provider, network, authority, raw payload, or capability affordances", () => {
    const contract = getPortfolioReadinessContract();
    const summary = summarizePortfolioReadiness();

    for (const posture of [
      contract.posture,
      summary.posture,
      ...contract.portfolio_areas.map((area) => area.posture),
      ...contract.recruiter_narratives.map((narrative) => narrative.posture),
      ...contract.demo_surfaces.map((surface) => surface.posture),
    ]) {
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

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys({ contract, summary })).not.toContain(
        forbiddenFieldName,
      );
    }
  });

  it("exports no presentation, demo execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(portfolioReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "getPortfolioReadinessContract",
        "getPortfolioReadinessAreas",
        "getPortfolioReadinessNarratives",
        "getDemoReadinessSurfaces",
        "summarizePortfolioReadiness",
      ]),
    );
  });
});
