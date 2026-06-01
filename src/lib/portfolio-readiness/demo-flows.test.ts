import { describe, expect, it } from "vitest";

import * as portfolioReadiness from "./index";
import {
  DEMO_FLOW_AUDIENCES,
  DEMO_FLOW_DURATION_BANDS,
  DEMO_FLOW_IDS,
  DEMO_FLOW_REGISTRY,
  DemoFlowRegistrySchema,
  getDemoFlowRegistry,
  getDemoFlowsByAudience,
  getDemoFlowsByDurationBand,
  getDemoFlowsBySurfaceId,
  getDemoSurfaceRegistry,
  getRecruiterNarrativeRegistry,
  summarizeDemoFlows,
} from "./index";

const REQUIRED_FLOW_IDS = [
  "demo-flow:sixty-second-recruiter",
  "demo-flow:three-minute-technical",
  "demo-flow:governance-first",
  "demo-flow:architecture-deep-dive",
  "demo-flow:voice-vision-room",
  "demo-flow:approval-runtime",
  "demo-flow:red-team-safety",
  "demo-flow:onboarding-move-in",
  "demo-flow:expansion-era",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
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

describe("Phase 20D.4 demo flow registry", () => {
  it("exposes a deterministic typed metadata-only demo flow registry", () => {
    const registry = getDemoFlowRegistry();

    expect(DemoFlowRegistrySchema.safeParse(registry).success).toBe(true);
    expect(JSON.stringify(registry)).toBe(
      JSON.stringify(getDemoFlowRegistry()),
    );
    expect(registry).toMatchObject({
      registry_version: "20D.4",
      source_narrative_registry_version: "20D.2",
      source_demo_surface_registry_version: "20D.3",
      registry_id: "phase-20d4-demo-flow-registry",
      phase: "20D.4",
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
    expect(Object.isFrozen(DEMO_FLOW_REGISTRY)).toBe(true);
    expect(Object.isFrozen(DEMO_FLOW_REGISTRY.flows)).toBe(true);
    expect(Object.isFrozen(DEMO_FLOW_REGISTRY.flows[0])).toBe(true);
    expect(Object.isFrozen(DEMO_FLOW_REGISTRY.flows[0].ordered_steps)).toBe(
      true,
    );

    const registry = getDemoFlowRegistry();
    registry.flows[0].title = "Mutated";
    registry.flows[0].ordered_steps[0].title = "Mutated step";

    const restoredFlow = getDemoFlowRegistry().flows[0];
    expect(restoredFlow).toMatchObject({
      flow_id: "demo-flow:sixty-second-recruiter",
      title: "60-second recruiter demo",
    });
    expect(restoredFlow.ordered_steps[0]).toMatchObject({
      title: "Open with the product signal",
      metadata_only: true,
      executes_demo: false,
    });
  });

  it("represents the required demo flows in stable order", () => {
    const flows = getDemoFlowRegistry().flows;

    expect(flows.map((flow) => flow.flow_id)).toEqual([...REQUIRED_FLOW_IDS]);
    expect(flows.map((flow) => flow.flow_id)).toEqual([...DEMO_FLOW_IDS]);
    expect(flows.every((flow) => flow.goal.length > 0)).toBe(true);
    expect(flows.every((flow) => flow.opening_pitch.length > 0)).toBe(true);
    expect(flows.every((flow) => flow.expected_outcome.metadata_only)).toBe(
      true,
    );
  });

  it("keeps ordered steps aligned to known 20D.3 demo surface ids", () => {
    const knownSurfaceIds = new Set(
      getDemoSurfaceRegistry().surfaces.map((surface) => surface.surface_id),
    );

    for (const flow of getDemoFlowRegistry().flows) {
      expect(flow.ordered_steps.map((step) => step.order)).toEqual(
        Array.from(
          { length: flow.ordered_steps.length },
          (_, index) => index + 1,
        ),
      );
      expect(flow.ordered_surface_ids).toEqual(
        flow.ordered_steps.map((step) => step.surface_id),
      );

      for (const step of flow.ordered_steps) {
        expect(knownSurfaceIds.has(step.surface_id)).toBe(true);
        expect(step.metadata_only).toBe(true);
        expect(step.executes_demo).toBe(false);
      }
    }
  });

  it("keeps narrative references aligned to 20D.2 or explicit future-expansion posture", () => {
    const knownNarrativeIds = new Set(
      getRecruiterNarrativeRegistry().narratives.map(
        (narrative) => narrative.narrative_id,
      ),
    );
    const flows = getDemoFlowRegistry().flows;

    for (const flow of flows) {
      expect(flow.narrative_posture).toBe(
        "linked_to_recruiter_narrative_registry",
      );
      for (const narrativeId of flow.narrative_ids) {
        expect(knownNarrativeIds.has(narrativeId)).toBe(true);
      }
    }

    expect(
      flows.find((flow) => flow.flow_id === "demo-flow:expansion-era"),
    ).toMatchObject({
      future_expansion_posture: "future_expansion_metadata_only_not_enabled",
      narrative_ids: expect.arrayContaining([
        "recruiter-narrative:future-gitnexus",
        "recruiter-narrative:future-graphify",
        "recruiter-narrative:future-llm-council",
        "recruiter-narrative:future-obsidian",
        "recruiter-narrative:future-security-project-integration",
      ]),
    });
  });

  it("represents required audiences and duration bands", () => {
    expect(
      getDemoFlowsByAudience("recruiter").map((flow) => flow.flow_id),
    ).toEqual([
      "demo-flow:sixty-second-recruiter",
      "demo-flow:onboarding-move-in",
    ]);
    expect(
      getDemoFlowsByAudience("technical_interviewer").map(
        (flow) => flow.flow_id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "demo-flow:three-minute-technical",
        "demo-flow:architecture-deep-dive",
        "demo-flow:voice-vision-room",
        "demo-flow:red-team-safety",
      ]),
    );
    expect(
      getDemoFlowsByDurationBand("sixty_seconds").map((flow) => flow.flow_id),
    ).toEqual(["demo-flow:sixty-second-recruiter"]);
    expect(
      getDemoFlowsByDurationBand("deep_dive").map((flow) => flow.flow_id),
    ).toEqual(["demo-flow:architecture-deep-dive", "demo-flow:expansion-era"]);

    const summary = summarizeDemoFlows();
    for (const audience of DEMO_FLOW_AUDIENCES) {
      expect(summary.audience_counts[audience]).toBeGreaterThan(0);
    }
    expect(summary.duration_band_counts.five_minutes).toBe(0);
    for (const durationBand of DEMO_FLOW_DURATION_BANDS) {
      expect(summary.duration_band_counts[durationBand]).toBe(
        getDemoFlowsByDurationBand(durationBand).length,
      );
    }
  });

  it("filters flows by demo surface id", () => {
    expect(
      getDemoFlowsBySurfaceId("demo-surface:approval-lifecycle").map(
        (flow) => flow.flow_id,
      ),
    ).toEqual([
      "demo-flow:three-minute-technical",
      "demo-flow:governance-first",
      "demo-flow:approval-runtime",
    ]);
    expect(
      getDemoFlowsBySurfaceId("demo-surface:doctor-cli-report").map(
        (flow) => flow.flow_id,
      ),
    ).toEqual(["demo-flow:onboarding-move-in"]);
  });

  it("represents proof points, governance notes, and deferred limitations", () => {
    const flows = getDemoFlowRegistry().flows;

    for (const flow of flows) {
      expect(flow.proof_points.length).toBeGreaterThanOrEqual(2);
      expect(flow.safety_governance_notes.length).toBeGreaterThan(0);
      expect(flow.deferred_limitation_notes.length).toBeGreaterThan(0);
    }

    expect(
      flows.find((flow) => flow.flow_id === "demo-flow:voice-vision-room")
        ?.safety_governance_notes,
    ).toEqual(
      expect.arrayContaining([
        "No microphone, camera, or room/device action is invoked.",
      ]),
    );
  });

  it("summarizes demo flows from the registry", () => {
    const registry = getDemoFlowRegistry();
    const summary = summarizeDemoFlows();

    expect(summary).toMatchObject({
      registry_version: "20D.4",
      flow_count: 9,
      duration_band_counts: {
        sixty_seconds: 1,
        three_minutes: 6,
        five_minutes: 0,
        deep_dive: 2,
      },
      future_expansion_flow_count: 1,
      ordered_step_count: 41,
      surface_reference_count: 41,
      narrative_reference_count: 37,
      proof_point_count: 18,
      phase20d_demo_flow_registry_only: true,
      phase20d_capability_neutral: true,
    });
    expect(summary.flow_count).toBe(registry.flows.length);

    for (const audience of DEMO_FLOW_AUDIENCES) {
      expect(summary.audience_counts[audience]).toBe(
        registry.flows.filter((flow) => flow.audiences.includes(audience))
          .length,
      );
    }
  });

  it("declares no UI, demo, runtime, provider, network, authority, source material, or capability affordances", () => {
    const registry = getDemoFlowRegistry();
    const summary = summarizeDemoFlows();

    for (const posture of [
      registry.posture,
      summary.posture,
      ...registry.flows.map((flow) => flow.posture),
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
      expect(collectKeys({ registry, summary })).not.toContain(
        forbiddenFieldName,
      );
    }
  });

  it("exports no UI route, demo execution, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(portfolioReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "getDemoFlowRegistry",
        "getDemoFlowsByAudience",
        "getDemoFlowsByDurationBand",
        "getDemoFlowsBySurfaceId",
        "summarizeDemoFlows",
      ]),
    );
  });
});
