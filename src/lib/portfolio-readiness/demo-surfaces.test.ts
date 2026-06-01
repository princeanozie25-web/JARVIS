import { describe, expect, it } from "vitest";

import * as portfolioReadiness from "./index";
import {
  DEMO_SURFACE_AUDIENCES,
  DEMO_SURFACE_CATEGORIES,
  DEMO_SURFACE_IDS,
  DEMO_SURFACE_REGISTRY,
  DemoSurfaceRegistrySchema,
  getDemoSafeSurfaces,
  getDemoSurfaceRegistry,
  getDemoSurfacesByAudience,
  getDemoSurfacesByCategory,
  summarizeDemoSurfaces,
} from "./index";

const REQUIRED_SURFACE_IDS = [
  "demo-surface:rest-orb",
  "demo-surface:working-cockpit",
  "demo-surface:audit-timeline",
  "demo-surface:architecture-graph",
  "demo-surface:runtime-dependency-graph",
  "demo-surface:governance-boundary-visualizer",
  "demo-surface:telemetry-cockpit",
  "demo-surface:red-team-sandbox",
  "demo-surface:doctor-cli-report",
  "demo-surface:onboarding-report",
  "demo-surface:move-in-checklist",
  "demo-surface:fake-room-room-os",
  "demo-surface:approval-lifecycle",
  "demo-surface:voice-runtime",
  "demo-surface:vision-runtime",
  "demo-surface:model-runtime",
  "demo-surface:scheduled-assistance",
  "demo-surface:demo-mode-synthetic-dataset",
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

describe("Phase 20D.3 demo surface registry", () => {
  it("exposes a deterministic typed metadata-only demo surface registry", () => {
    const registry = getDemoSurfaceRegistry();

    expect(DemoSurfaceRegistrySchema.safeParse(registry).success).toBe(true);
    expect(JSON.stringify(registry)).toBe(
      JSON.stringify(getDemoSurfaceRegistry()),
    );
    expect(registry).toMatchObject({
      registry_version: "20D.3",
      source_narrative_registry_version: "20D.2",
      registry_id: "phase-20d3-demo-surface-registry",
      phase: "20D.3",
      posture: {
        metadata_only: true,
        read_only: true,
        deterministic: true,
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
    expect(Object.isFrozen(DEMO_SURFACE_REGISTRY)).toBe(true);
    expect(Object.isFrozen(DEMO_SURFACE_REGISTRY.surfaces)).toBe(true);
    expect(Object.isFrozen(DEMO_SURFACE_REGISTRY.surfaces[0])).toBe(true);

    const registry = getDemoSurfaceRegistry();
    registry.surfaces[0].title = "Mutated";
    registry.surfaces[0].entrypoint.reference = "mutated";

    expect(getDemoSurfaceRegistry().surfaces[0]).toMatchObject({
      surface_id: "demo-surface:rest-orb",
      title: "Rest orb",
      entrypoint: {
        reference: "command-center/rest",
        metadata_only: true,
      },
    });
  });

  it("represents the required demo surfaces", () => {
    const surfaces = getDemoSurfaceRegistry().surfaces;

    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...REQUIRED_SURFACE_IDS,
    ]);
    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...DEMO_SURFACE_IDS,
    ]);
    expect(surfaces.every((surface) => surface.demo_value.length > 0)).toBe(
      true,
    );
    expect(
      surfaces.every(
        (surface) => surface.limitations_deferred_posture.length > 0,
      ),
    ).toBe(true);
  });

  it("keeps existing routes and entrypoints metadata-only", () => {
    const surfaces = getDemoSurfaceRegistry().surfaces;

    expect(
      surfaces
        .filter((surface) => surface.entrypoint.kind === "existing_route")
        .map((surface) => surface.surface_id),
    ).toEqual([
      "demo-surface:rest-orb",
      "demo-surface:working-cockpit",
      "demo-surface:audit-timeline",
    ]);

    for (const surface of surfaces) {
      expect(surface.entrypoint.creates_new_route).toBe(false);
      expect(surface.entrypoint.executes_demo).toBe(false);
      expect(surface.entrypoint.metadata_only).toBe(true);
    }
  });

  it("links every surface to recruiter narrative ids", () => {
    for (const surface of getDemoSurfaceRegistry().surfaces) {
      expect(surface.narrative_ids.length).toBeGreaterThan(0);
      expect(surface.narrative_posture).toBe(
        "linked_to_recruiter_narrative_registry",
      );
    }

    expect(
      getDemoSurfaceRegistry().surfaces.find(
        (surface) => surface.surface_id === "demo-surface:approval-lifecycle",
      )?.narrative_ids,
    ).toEqual(
      expect.arrayContaining([
        "recruiter-narrative:approval-gated-execution",
        "recruiter-narrative:governance-first-architecture",
      ]),
    );
  });

  it("represents synthetic/demo-safe and source-material posture", () => {
    const surfaces = getDemoSurfaceRegistry().surfaces;

    expect(surfaces.every((surface) => surface.synthetic_demo_safe)).toBe(true);
    expect(
      surfaces.every(
        (surface) => !surface.source_material_posture.includes("allowed"),
      ),
    ).toBe(true);
    expect(
      surfaces
        .filter((surface) => surface.required_data_posture === "synthetic_only")
        .map((surface) => surface.surface_id),
    ).toEqual([
      "demo-surface:red-team-sandbox",
      "demo-surface:fake-room-room-os",
      "demo-surface:demo-mode-synthetic-dataset",
    ]);
  });

  it("keeps authority posture read-only, gated, sandboxed, or deferred", () => {
    const surfaces = getDemoSurfaceRegistry().surfaces;

    for (const surface of surfaces) {
      expect([
        "read_only",
        "approval_gated_visibility",
        "sandboxed_only",
        "deferred_disabled",
      ]).toContain(surface.authority_posture);
    }

    expect(
      surfaces
        .filter((surface) => surface.authority_posture === "deferred_disabled")
        .map((surface) => surface.surface_id),
    ).toEqual([
      "demo-surface:move-in-checklist",
      "demo-surface:voice-runtime",
      "demo-surface:vision-runtime",
    ]);
  });

  it("filters by category, audience, and demo-safe posture", () => {
    expect(
      getDemoSurfacesByCategory("runtime").map((surface) => surface.surface_id),
    ).toEqual([
      "demo-surface:voice-runtime",
      "demo-surface:vision-runtime",
      "demo-surface:model-runtime",
    ]);
    expect(
      getDemoSurfacesByAudience("recruiter").map(
        (surface) => surface.surface_id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "demo-surface:rest-orb",
        "demo-surface:onboarding-report",
        "demo-surface:demo-mode-synthetic-dataset",
      ]),
    );
    expect(getDemoSafeSurfaces().length).toBe(18);
  });

  it("summarizes demo surfaces from the registry", () => {
    const registry = getDemoSurfaceRegistry();
    const summary = summarizeDemoSurfaces();

    expect(summary).toMatchObject({
      registry_version: "20D.3",
      surface_count: 18,
      category_counts: {
        command_center: 2,
        architecture: 2,
        governance: 2,
        observability: 2,
        security: 1,
        bootstrap_onboarding: 3,
        room_os: 1,
        runtime: 3,
        scheduler: 1,
        demo_data: 1,
      },
      demo_safe_count: 18,
      synthetic_only_count: 3,
      redacted_metadata_count: 3,
      read_only_authority_count: 9,
      gated_or_sandboxed_authority_count: 9,
      narrative_reference_count: 26,
      phase_reference_count: 32,
      phase20d_demo_surface_registry_only: true,
      phase20d_capability_neutral: true,
    });
    expect(summary.surface_count).toBe(registry.surfaces.length);

    for (const category of DEMO_SURFACE_CATEGORIES) {
      expect(summary.category_counts[category]).toBe(
        registry.surfaces.filter((surface) => surface.category === category)
          .length,
      );
    }

    for (const audience of DEMO_SURFACE_AUDIENCES) {
      expect(summary.audience_counts[audience]).toBe(
        registry.surfaces.filter((surface) =>
          surface.audiences.includes(audience),
        ).length,
      );
    }
  });

  it("declares no UI, demo, runtime, provider, network, authority, source material, or capability affordances", () => {
    const registry = getDemoSurfaceRegistry();
    const summary = summarizeDemoSurfaces();

    for (const posture of [
      registry.posture,
      summary.posture,
      ...registry.surfaces.map((surface) => surface.posture),
    ]) {
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
        "getDemoSurfaceRegistry",
        "getDemoSurfacesByCategory",
        "getDemoSurfacesByAudience",
        "getDemoSafeSurfaces",
        "summarizeDemoSurfaces",
      ]),
    );
  });
});
