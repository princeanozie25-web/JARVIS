import { describe, expect, it } from "vitest";

import * as portfolioReadiness from "./index";
import {
  DEMO_READINESS_SURFACE_IDS,
  RECRUITER_NARRATIVE_AUDIENCES,
  RECRUITER_NARRATIVE_CATEGORIES,
  RECRUITER_NARRATIVE_IDS,
  RECRUITER_NARRATIVE_PHASE_IDS,
  RECRUITER_NARRATIVE_REGISTRY,
  RecruiterNarrativeRegistrySchema,
  getFutureExpansionNarratives,
  getRecruiterNarrativeRegistry,
  getRecruiterNarrativesByAudience,
  getRecruiterNarrativesByCategory,
  summarizeRecruiterNarratives,
} from "./index";

const REQUIRED_NARRATIVE_IDS = [
  "recruiter-narrative:local-first-ai-operating-system",
  "recruiter-narrative:governance-first-architecture",
  "recruiter-narrative:approval-gated-execution",
  "recruiter-narrative:voice-runtime",
  "recruiter-narrative:vision-runtime",
  "recruiter-narrative:room-os",
  "recruiter-narrative:local-model-runtime",
  "recruiter-narrative:command-center-ui",
  "recruiter-narrative:architecture-graph",
  "recruiter-narrative:governance-visualizer",
  "recruiter-narrative:telemetry-cockpit",
  "recruiter-narrative:red-team-sandbox",
  "recruiter-narrative:bootstrap-onboarding-readiness",
  "recruiter-narrative:portfolio-value",
  "recruiter-narrative:future-gitnexus",
  "recruiter-narrative:future-graphify",
  "recruiter-narrative:future-llm-council",
  "recruiter-narrative:future-obsidian",
  "recruiter-narrative:future-security-project-integration",
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

describe("Phase 20D.2 recruiter narrative registry", () => {
  it("exposes a deterministic typed metadata-only narrative registry", () => {
    const registry = getRecruiterNarrativeRegistry();

    expect(RecruiterNarrativeRegistrySchema.safeParse(registry).success).toBe(
      true,
    );
    expect(JSON.stringify(registry)).toBe(
      JSON.stringify(getRecruiterNarrativeRegistry()),
    );
    expect(registry).toMatchObject({
      registry_version: "20D.2",
      source_contract_version: "20D.1",
      registry_id: "phase-20d2-recruiter-narrative-registry",
      phase: "20D.2",
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
    expect(Object.isFrozen(RECRUITER_NARRATIVE_REGISTRY)).toBe(true);
    expect(Object.isFrozen(RECRUITER_NARRATIVE_REGISTRY.narratives)).toBe(true);
    expect(Object.isFrozen(RECRUITER_NARRATIVE_REGISTRY.narratives[0])).toBe(
      true,
    );

    const registry = getRecruiterNarrativeRegistry();
    registry.narratives[0].title = "Mutated";
    registry.narratives[0].technical_proof_points[0].label = "Mutated Proof";

    expect(getRecruiterNarrativeRegistry().narratives[0]).toMatchObject({
      narrative_id: "recruiter-narrative:local-first-ai-operating-system",
      title: "JARVIS as a local-first AI operating system",
      technical_proof_points: [
        expect.objectContaining({
          proof_id: "proof:local-first-os:phase-20a",
          label: "Final readiness registry covers core system phases.",
        }),
        expect.any(Object),
      ],
    });
  });

  it("represents the required recruiter narratives", () => {
    const narratives = getRecruiterNarrativeRegistry().narratives;

    expect(narratives.map((narrative) => narrative.narrative_id)).toEqual([
      ...REQUIRED_NARRATIVE_IDS,
    ]);
    expect(narratives.map((narrative) => narrative.narrative_id)).toEqual([
      ...RECRUITER_NARRATIVE_IDS,
    ]);
    expect(
      narratives.every((narrative) => narrative.short_summary.length > 0),
    ).toBe(true);
    expect(
      narratives.every((narrative) => narrative.recruiter_value.length > 0),
    ).toBe(true);
    expect(
      narratives.every((narrative) => narrative.risk_safety_posture.length > 0),
    ).toBe(true);
  });

  it("includes future expansion narratives for GitNexus, Graphify, LLM Council, Obsidian, and security integration", () => {
    const futureNarratives = getFutureExpansionNarratives();

    expect(futureNarratives.map((narrative) => narrative.narrative_id)).toEqual(
      [
        "recruiter-narrative:future-gitnexus",
        "recruiter-narrative:future-graphify",
        "recruiter-narrative:future-llm-council",
        "recruiter-narrative:future-obsidian",
        "recruiter-narrative:future-security-project-integration",
      ],
    );
    expect(
      futureNarratives.flatMap(
        (narrative) => narrative.future_expansion_targets,
      ),
    ).toEqual(
      expect.arrayContaining([
        "GitNexus",
        "Graphify",
        "LLM Council",
        "Obsidian",
        "security project integration",
      ]),
    );
    expect(
      futureNarratives.every(
        (narrative) =>
          narrative.future_expansion_posture ===
            "future_expansion_metadata_only_not_enabled" &&
          narrative.related_phases.includes("future-expansion"),
      ),
    ).toBe(true);
  });

  it("references known completed phases or explicit future-expansion posture", () => {
    const knownPhaseIds = new Set(RECRUITER_NARRATIVE_PHASE_IDS);

    for (const narrative of getRecruiterNarrativeRegistry().narratives) {
      for (const phase of narrative.related_phases) {
        expect(knownPhaseIds.has(phase)).toBe(true);
      }

      if (narrative.related_phases.includes("future-expansion")) {
        expect(narrative.category).toBe("future_expansion");
        expect(narrative.future_expansion_posture).toBe(
          "future_expansion_metadata_only_not_enabled",
        );
        expect(narrative.future_expansion_targets.length).toBeGreaterThan(0);
      } else {
        expect(narrative.future_expansion_posture).toBe("not_applicable");
        expect(narrative.future_expansion_targets).toEqual([]);
      }
    }
  });

  it("represents proof points and demo surfaces", () => {
    const narratives = getRecruiterNarrativeRegistry().narratives;
    const knownDemoSurfaceIds = new Set(DEMO_READINESS_SURFACE_IDS);

    for (const narrative of narratives) {
      expect(narrative.technical_proof_points.length).toBeGreaterThan(0);
      expect(narrative.demo_surface_ids.length).toBeGreaterThan(0);

      for (const proofPoint of narrative.technical_proof_points) {
        expect(proofPoint.metadata_only).toBe(true);
        expect(proofPoint.evidence_ids.length).toBeGreaterThan(0);
        expect(proofPoint.related_phases.length).toBeGreaterThan(0);
      }

      for (const demoSurfaceId of narrative.demo_surface_ids) {
        expect(knownDemoSurfaceIds.has(demoSurfaceId)).toBe(true);
      }
    }
  });

  it("filters narratives by category and audience", () => {
    expect(
      getRecruiterNarrativesByCategory("future_expansion").map(
        (narrative) => narrative.narrative_id,
      ),
    ).toEqual([
      "recruiter-narrative:future-gitnexus",
      "recruiter-narrative:future-graphify",
      "recruiter-narrative:future-llm-council",
      "recruiter-narrative:future-obsidian",
      "recruiter-narrative:future-security-project-integration",
    ]);
    expect(
      getRecruiterNarrativesByAudience("recruiter").map(
        (narrative) => narrative.narrative_id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "recruiter-narrative:local-first-ai-operating-system",
        "recruiter-narrative:room-os",
        "recruiter-narrative:portfolio-value",
      ]),
    );
  });

  it("summarizes recruiter narratives from the registry", () => {
    const registry = getRecruiterNarrativeRegistry();
    const summary = summarizeRecruiterNarratives();

    expect(summary).toMatchObject({
      registry_version: "20D.2",
      narrative_count: 19,
      category_counts: {
        positioning: 2,
        architecture: 1,
        governance: 3,
        runtime: 3,
        product_surface: 2,
        observability: 2,
        readiness: 1,
        future_expansion: 5,
      },
      future_expansion_count: 5,
      proof_point_count: 33,
      demo_surface_reference_count: 26,
      phase_reference_count: 43,
      phase20d_narrative_registry_only: true,
      phase20d_capability_neutral: true,
    });
    expect(summary.narrative_count).toBe(registry.narratives.length);

    for (const category of RECRUITER_NARRATIVE_CATEGORIES) {
      expect(summary.category_counts[category]).toBe(
        registry.narratives.filter(
          (narrative) => narrative.category === category,
        ).length,
      );
    }

    for (const audience of RECRUITER_NARRATIVE_AUDIENCES) {
      expect(summary.audience_counts[audience]).toBe(
        registry.narratives.filter((narrative) =>
          narrative.audiences.includes(audience),
        ).length,
      );
    }
  });

  it("declares no presentation, UI, demo, runtime, provider, network, authority, raw payload, or capability affordances", () => {
    const registry = getRecruiterNarrativeRegistry();
    const summary = summarizeRecruiterNarratives();

    for (const posture of [
      registry.posture,
      summary.posture,
      ...registry.narratives.map((narrative) => narrative.posture),
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

  it("exports no presentation, UI route, demo execution, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(portfolioReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "getRecruiterNarrativeRegistry",
        "getRecruiterNarrativesByCategory",
        "getRecruiterNarrativesByAudience",
        "getFutureExpansionNarratives",
        "summarizeRecruiterNarratives",
      ]),
    );
  });
});
