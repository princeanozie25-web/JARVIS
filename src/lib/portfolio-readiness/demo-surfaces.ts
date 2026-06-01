import { z } from "zod";

import {
  PortfolioReadinessPostureSchema,
  type PortfolioReadinessPosture,
} from "./contracts";
import {
  RecruiterNarrativeIdSchema,
  RecruiterNarrativePhaseIdSchema,
  getRecruiterNarrativeRegistry,
  type RecruiterNarrativeId,
} from "./narratives";

export const DEMO_SURFACE_REGISTRY_VERSION = "20D.3" as const;

export const DEMO_SURFACE_IDS = [
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

export const DEMO_SURFACE_CATEGORIES = [
  "command_center",
  "architecture",
  "governance",
  "observability",
  "security",
  "bootstrap_onboarding",
  "room_os",
  "runtime",
  "scheduler",
  "demo_data",
] as const;

export const DEMO_SURFACE_AUDIENCES = [
  "recruiter",
  "hiring_manager",
  "technical_interviewer",
  "portfolio_viewer",
] as const;

export const DEMO_SURFACE_DATA_POSTURES = [
  "metadata_only",
  "synthetic_only",
  "redacted_metadata_only",
  "local_status_reference_only",
] as const;

export const DEMO_SURFACE_AUTHORITY_POSTURES = [
  "read_only",
  "approval_gated_visibility",
  "sandboxed_only",
  "deferred_disabled",
] as const;

export const DEMO_SURFACE_ENTRYPOINT_KINDS = [
  "existing_route",
  "existing_cli",
  "existing_module",
  "metadata_reference",
] as const;

export const DEMO_SURFACE_SOURCE_MATERIAL_POSTURES = [
  "source_material_redacted",
  "source_material_synthetic_only",
  "source_material_not_included",
] as const;

export type DemoSurfaceId = (typeof DEMO_SURFACE_IDS)[number];
export type DemoSurfaceCategory = (typeof DEMO_SURFACE_CATEGORIES)[number];
export type DemoSurfaceAudience = (typeof DEMO_SURFACE_AUDIENCES)[number];
export type DemoSurfaceDataPosture =
  (typeof DEMO_SURFACE_DATA_POSTURES)[number];
export type DemoSurfaceAuthorityPosture =
  (typeof DEMO_SURFACE_AUTHORITY_POSTURES)[number];
export type DemoSurfaceEntrypointKind =
  (typeof DEMO_SURFACE_ENTRYPOINT_KINDS)[number];
export type DemoSurfaceSourceMaterialPosture =
  (typeof DEMO_SURFACE_SOURCE_MATERIAL_POSTURES)[number];

export const DemoSurfaceIdSchema = z.enum(DEMO_SURFACE_IDS);
export const DemoSurfaceCategorySchema = z.enum(DEMO_SURFACE_CATEGORIES);
export const DemoSurfaceAudienceSchema = z.enum(DEMO_SURFACE_AUDIENCES);
export const DemoSurfaceDataPostureSchema = z.enum(DEMO_SURFACE_DATA_POSTURES);
export const DemoSurfaceAuthorityPostureSchema = z.enum(
  DEMO_SURFACE_AUTHORITY_POSTURES,
);
export const DemoSurfaceEntrypointKindSchema = z.enum(
  DEMO_SURFACE_ENTRYPOINT_KINDS,
);
export const DemoSurfaceSourceMaterialPostureSchema = z.enum(
  DEMO_SURFACE_SOURCE_MATERIAL_POSTURES,
);

export const DemoSurfaceEntrypointSchema = z.strictObject({
  kind: DemoSurfaceEntrypointKindSchema,
  reference: z.string().trim().min(1).max(220),
  already_exists: z.boolean(),
  creates_new_route: z.literal(false),
  executes_demo: z.literal(false),
  metadata_only: z.literal(true),
});

export const DemoSurfaceSchema = z.strictObject({
  surface_id: DemoSurfaceIdSchema,
  title: z.string().trim().min(1).max(180),
  entrypoint: DemoSurfaceEntrypointSchema,
  category: DemoSurfaceCategorySchema,
  audiences: z.array(DemoSurfaceAudienceSchema).min(1),
  narrative_ids: z.array(RecruiterNarrativeIdSchema).min(1),
  narrative_posture: z.literal("linked_to_recruiter_narrative_registry"),
  related_phases: z.array(RecruiterNarrativePhaseIdSchema).min(1),
  required_data_posture: DemoSurfaceDataPostureSchema,
  synthetic_demo_safe: z.boolean(),
  source_material_posture: DemoSurfaceSourceMaterialPostureSchema,
  authority_posture: DemoSurfaceAuthorityPostureSchema,
  demo_value: z.string().trim().min(1).max(420),
  limitations_deferred_posture: z.string().trim().min(1).max(420),
  posture: PortfolioReadinessPostureSchema,
});

export const DemoSurfaceRegistrySchema = z.strictObject({
  registry_version: z.literal(DEMO_SURFACE_REGISTRY_VERSION),
  source_narrative_registry_version: z.literal("20D.2"),
  registry_id: z.literal("phase-20d3-demo-surface-registry"),
  phase: z.literal("20D.3"),
  surfaces: z.array(DemoSurfaceSchema),
  posture: PortfolioReadinessPostureSchema,
});

export const DemoSurfaceSummarySchema = z.strictObject({
  registry_version: z.literal(DEMO_SURFACE_REGISTRY_VERSION),
  surface_count: z.number().int().positive(),
  category_counts: z.record(
    DemoSurfaceCategorySchema,
    z.number().int().nonnegative(),
  ),
  audience_counts: z.record(
    DemoSurfaceAudienceSchema,
    z.number().int().nonnegative(),
  ),
  demo_safe_count: z.number().int().nonnegative(),
  synthetic_only_count: z.number().int().nonnegative(),
  redacted_metadata_count: z.number().int().nonnegative(),
  read_only_authority_count: z.number().int().nonnegative(),
  gated_or_sandboxed_authority_count: z.number().int().nonnegative(),
  narrative_reference_count: z.number().int().positive(),
  phase_reference_count: z.number().int().positive(),
  phase20d_demo_surface_registry_only: z.literal(true),
  phase20d_capability_neutral: z.literal(true),
  posture: PortfolioReadinessPostureSchema,
});

export type DemoSurfaceEntrypoint = z.infer<typeof DemoSurfaceEntrypointSchema>;
export type DemoSurface = z.infer<typeof DemoSurfaceSchema>;
export type DemoSurfaceRegistry = z.infer<typeof DemoSurfaceRegistrySchema>;
export type DemoSurfaceSummary = z.infer<typeof DemoSurfaceSummarySchema>;

const POSTURE: PortfolioReadinessPosture = {
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
};

function entrypoint(
  kind: DemoSurfaceEntrypointKind,
  reference: string,
  already_exists: boolean,
): DemoSurfaceEntrypoint {
  return DemoSurfaceEntrypointSchema.parse({
    kind,
    reference,
    already_exists,
    creates_new_route: false,
    executes_demo: false,
    metadata_only: true,
  });
}

const SURFACES = [
  {
    surface_id: "demo-surface:rest-orb",
    title: "Rest orb",
    entrypoint: entrypoint("existing_route", "command-center/rest", true),
    category: "command_center",
    audiences: ["recruiter", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:command-center-ui"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-12"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "read_only",
    demo_value:
      "Shows the quiet resting state of the Command Center as a product surface.",
    limitations_deferred_posture:
      "Does not add a route or turn the resting state into an action surface.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:working-cockpit",
    title: "Working cockpit",
    entrypoint: entrypoint("existing_route", "command-center/working", true),
    category: "command_center",
    audiences: ["hiring_manager", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:command-center-ui"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-12"],
    required_data_posture: "redacted_metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_redacted",
    authority_posture: "read_only",
    demo_value:
      "Highlights operational workflow visibility without creating run or retry affordances.",
    limitations_deferred_posture:
      "Working-state controls remain observational and do not execute routines.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:audit-timeline",
    title: "Audit timeline",
    entrypoint: entrypoint("existing_route", "command-center/audit", true),
    category: "observability",
    audiences: ["technical_interviewer", "hiring_manager"],
    narrative_ids: [
      "recruiter-narrative:command-center-ui",
      "recruiter-narrative:telemetry-cockpit",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-12", "phase-19"],
    required_data_posture: "redacted_metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_redacted",
    authority_posture: "read_only",
    demo_value:
      "Shows auditability, replay posture, and metadata-only event explanation.",
    limitations_deferred_posture:
      "Audit data must remain redacted and cannot expose source material.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:architecture-graph",
    title: "Architecture graph",
    entrypoint: entrypoint(
      "existing_module",
      "src/lib/architecture-graph",
      true,
    ),
    category: "architecture",
    audiences: ["technical_interviewer", "hiring_manager", "portfolio_viewer"],
    narrative_ids: [
      "recruiter-narrative:architecture-graph",
      "recruiter-narrative:local-first-ai-operating-system",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-19a", "phase-20a"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "read_only",
    demo_value:
      "Makes subsystem boundaries, layers, and forbidden edges explainable.",
    limitations_deferred_posture:
      "Graph visibility remains non-executable and cannot drive tools or routines.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:runtime-dependency-graph",
    title: "Runtime dependency graph",
    entrypoint: entrypoint(
      "metadata_reference",
      "portfolio/runtime-dependencies",
      false,
    ),
    category: "architecture",
    audiences: ["technical_interviewer"],
    narrative_ids: [
      "recruiter-narrative:local-model-runtime",
      "recruiter-narrative:architecture-graph",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-13", "phase-14", "phase-15", "phase-20b"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "read_only",
    demo_value:
      "Explains runtime dependencies and local-first prerequisites for model, voice, and vision surfaces.",
    limitations_deferred_posture:
      "This is a metadata target only and does not create a graph UI or runtime inspector.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:governance-boundary-visualizer",
    title: "Governance boundary visualizer",
    entrypoint: entrypoint(
      "metadata_reference",
      "portfolio/governance-boundaries",
      false,
    ),
    category: "governance",
    audiences: ["hiring_manager", "technical_interviewer"],
    narrative_ids: [
      "recruiter-narrative:governance-visualizer",
      "recruiter-narrative:governance-first-architecture",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-18", "phase-20a"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "approval_gated_visibility",
    demo_value:
      "Shows approval, authority, and disabled-feature boundaries as an interview story.",
    limitations_deferred_posture:
      "No visualizer route is created and approval posture cannot be bypassed.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:telemetry-cockpit",
    title: "Telemetry cockpit",
    entrypoint: entrypoint(
      "metadata_reference",
      "portfolio/telemetry-cockpit",
      false,
    ),
    category: "observability",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:telemetry-cockpit"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-19", "phase-20a"],
    required_data_posture: "redacted_metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_redacted",
    authority_posture: "read_only",
    demo_value:
      "Shows production-minded observability, redaction, and replay-safe telemetry posture.",
    limitations_deferred_posture:
      "No telemetry route is added and source material remains excluded.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:red-team-sandbox",
    title: "Red-team sandbox",
    entrypoint: entrypoint(
      "metadata_reference",
      "portfolio/red-team-sandbox",
      false,
    ),
    category: "security",
    audiences: ["technical_interviewer", "hiring_manager"],
    narrative_ids: ["recruiter-narrative:red-team-sandbox"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-19", "phase-20a"],
    required_data_posture: "synthetic_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_synthetic_only",
    authority_posture: "sandboxed_only",
    demo_value:
      "Communicates adversarial thinking without executing attacks or contacting targets.",
    limitations_deferred_posture:
      "CAI non-whitelisted targets, provider escalation, and attack execution remain disabled.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:doctor-cli-report",
    title: "Doctor CLI/report",
    entrypoint: entrypoint("existing_cli", "npm run doctor", true),
    category: "bootstrap_onboarding",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:bootstrap-onboarding-readiness"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-20b"],
    required_data_posture: "local_status_reference_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "read_only",
    demo_value:
      "Shows fresh-machine readiness and safe local doctor reporting.",
    limitations_deferred_posture:
      "This registry does not invoke the CLI or inspect the current machine.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:onboarding-report",
    title: "Onboarding report",
    entrypoint: entrypoint(
      "existing_module",
      "src/lib/onboarding-readiness/report.ts",
      true,
    ),
    category: "bootstrap_onboarding",
    audiences: ["recruiter", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:bootstrap-onboarding-readiness"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-20c"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "read_only",
    demo_value:
      "Explains clone to first-safe-run onboarding in a structured report.",
    limitations_deferred_posture:
      "No onboarding steps are executed and no result collection is added.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:move-in-checklist",
    title: "Move-in checklist",
    entrypoint: entrypoint(
      "existing_module",
      "src/lib/onboarding-readiness/move-in-checklist.ts",
      true,
    ),
    category: "bootstrap_onboarding",
    audiences: ["recruiter", "hiring_manager", "portfolio_viewer"],
    narrative_ids: [
      "recruiter-narrative:bootstrap-onboarding-readiness",
      "recruiter-narrative:room-os",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-20c"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "deferred_disabled",
    demo_value:
      "Shows bedroom or room-ready posture with deferred hardware boundaries.",
    limitations_deferred_posture:
      "Real Hue/device onboarding and voice authorisation tiers remain deferred.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:fake-room-room-os",
    title: "Fake room / Room OS",
    entrypoint: entrypoint("metadata_reference", "room-os/fake-room", false),
    category: "room_os",
    audiences: ["recruiter", "hiring_manager", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:room-os"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-10", "phase-16", "phase-20c"],
    required_data_posture: "synthetic_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_synthetic_only",
    authority_posture: "sandboxed_only",
    demo_value:
      "Gives the demo a concrete room context without touching real hardware.",
    limitations_deferred_posture:
      "Real room adapters and Hue/device onboarding remain deferred.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:approval-lifecycle",
    title: "Approval lifecycle",
    entrypoint: entrypoint(
      "metadata_reference",
      "approval-runtime/lifecycle",
      false,
    ),
    category: "governance",
    audiences: ["technical_interviewer", "hiring_manager"],
    narrative_ids: [
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:governance-first-architecture",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-18"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "approval_gated_visibility",
    demo_value:
      "Shows how intent, approval, and execution authority stay separated.",
    limitations_deferred_posture:
      "No approval bypass, auto-approval, or execution path is added.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:voice-runtime",
    title: "Voice runtime",
    entrypoint: entrypoint(
      "metadata_reference",
      "voice-runtime/readiness",
      false,
    ),
    category: "runtime",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:voice-runtime"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-14", "phase-20c"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "deferred_disabled",
    demo_value:
      "Explains voice readiness, local-first posture, and deferred wake-word scope.",
    limitations_deferred_posture:
      "No microphone, wake-word, always-listening, or voice-only approval is enabled.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:vision-runtime",
    title: "Vision runtime",
    entrypoint: entrypoint(
      "metadata_reference",
      "vision-runtime/readiness",
      false,
    ),
    category: "runtime",
    audiences: ["technical_interviewer", "portfolio_viewer"],
    narrative_ids: ["recruiter-narrative:vision-runtime"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-15"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "deferred_disabled",
    demo_value:
      "Explains vision readiness while hidden and background capture remain disabled.",
    limitations_deferred_posture:
      "No camera, capture runtime, or provider-backed vision path is enabled.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:model-runtime",
    title: "Model runtime",
    entrypoint: entrypoint(
      "metadata_reference",
      "model-runtime/readiness",
      false,
    ),
    category: "runtime",
    audiences: ["technical_interviewer", "hiring_manager"],
    narrative_ids: ["recruiter-narrative:local-model-runtime"],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-13", "phase-20b"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "read_only",
    demo_value:
      "Shows local model readiness and cloud-gated provider boundaries.",
    limitations_deferred_posture:
      "No model invocation, provider call, or network routing occurs.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:scheduled-assistance",
    title: "Scheduled assistance",
    entrypoint: entrypoint(
      "metadata_reference",
      "scheduled-assistance/readiness",
      false,
    ),
    category: "scheduler",
    audiences: ["technical_interviewer", "hiring_manager"],
    narrative_ids: [
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:governance-first-architecture",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-17", "phase-18"],
    required_data_posture: "metadata_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_not_included",
    authority_posture: "approval_gated_visibility",
    demo_value:
      "Explains scheduled assistance and routine boundaries without side effects.",
    limitations_deferred_posture:
      "Scheduler side effects, routine chaining, and unapproved room actions remain disabled.",
    posture: POSTURE,
  },
  {
    surface_id: "demo-surface:demo-mode-synthetic-dataset",
    title: "Demo mode / synthetic dataset",
    entrypoint: entrypoint(
      "metadata_reference",
      "demo-mode/synthetic-dataset",
      false,
    ),
    category: "demo_data",
    audiences: ["recruiter", "portfolio_viewer", "hiring_manager"],
    narrative_ids: [
      "recruiter-narrative:portfolio-value",
      "recruiter-narrative:bootstrap-onboarding-readiness",
    ],
    narrative_posture: "linked_to_recruiter_narrative_registry",
    related_phases: ["phase-20c", "phase-20d1"],
    required_data_posture: "synthetic_only",
    synthetic_demo_safe: true,
    source_material_posture: "source_material_synthetic_only",
    authority_posture: "sandboxed_only",
    demo_value:
      "Provides a safe data posture for future demo or portfolio rendering.",
    limitations_deferred_posture:
      "No dataset is generated and no demo automation is executed by this registry.",
    posture: POSTURE,
  },
] satisfies readonly DemoSurface[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copySurface(surface: DemoSurface): DemoSurface {
  return DemoSurfaceSchema.parse(JSON.parse(JSON.stringify(surface)));
}

function copyRegistry(registry: DemoSurfaceRegistry): DemoSurfaceRegistry {
  return DemoSurfaceRegistrySchema.parse(JSON.parse(JSON.stringify(registry)));
}

function assertAlignedWithNarrativeRegistry(): void {
  const narrativeIds = new Set<RecruiterNarrativeId>(
    getRecruiterNarrativeRegistry().narratives.map(
      (narrative) => narrative.narrative_id,
    ),
  );

  for (const surface of DEMO_SURFACE_REGISTRY.surfaces) {
    for (const narrativeId of surface.narrative_ids) {
      if (!narrativeIds.has(narrativeId)) {
        throw new Error(
          `Unknown recruiter narrative for demo surface: ${narrativeId}`,
        );
      }
    }
  }
}

export const DEMO_SURFACE_REGISTRY = deepFreeze(
  DemoSurfaceRegistrySchema.parse({
    registry_version: DEMO_SURFACE_REGISTRY_VERSION,
    source_narrative_registry_version: "20D.2",
    registry_id: "phase-20d3-demo-surface-registry",
    phase: "20D.3",
    surfaces: SURFACES,
    posture: POSTURE,
  }),
);

export function getDemoSurfaceRegistry(): DemoSurfaceRegistry {
  assertAlignedWithNarrativeRegistry();
  return copyRegistry(DEMO_SURFACE_REGISTRY);
}

export function getDemoSurfacesByCategory(
  category: DemoSurfaceCategory,
): readonly DemoSurface[] {
  return DEMO_SURFACE_REGISTRY.surfaces
    .filter((surface) => surface.category === category)
    .map(copySurface);
}

export function getDemoSurfacesByAudience(
  audience: DemoSurfaceAudience,
): readonly DemoSurface[] {
  return DEMO_SURFACE_REGISTRY.surfaces
    .filter((surface) => surface.audiences.includes(audience))
    .map(copySurface);
}

export function getDemoSafeSurfaces(): readonly DemoSurface[] {
  return DEMO_SURFACE_REGISTRY.surfaces
    .filter((surface) => surface.synthetic_demo_safe)
    .map(copySurface);
}

export function summarizeDemoSurfaces(): DemoSurfaceSummary {
  const surfaces = DEMO_SURFACE_REGISTRY.surfaces;
  const categoryCounts = Object.fromEntries(
    DEMO_SURFACE_CATEGORIES.map((category) => [
      category,
      surfaces.filter((surface) => surface.category === category).length,
    ]),
  ) as Record<DemoSurfaceCategory, number>;
  const audienceCounts = Object.fromEntries(
    DEMO_SURFACE_AUDIENCES.map((audience) => [
      audience,
      surfaces.filter((surface) => surface.audiences.includes(audience)).length,
    ]),
  ) as Record<DemoSurfaceAudience, number>;

  return DemoSurfaceSummarySchema.parse({
    registry_version: DEMO_SURFACE_REGISTRY_VERSION,
    surface_count: surfaces.length,
    category_counts: categoryCounts,
    audience_counts: audienceCounts,
    demo_safe_count: getDemoSafeSurfaces().length,
    synthetic_only_count: surfaces.filter(
      (surface) => surface.required_data_posture === "synthetic_only",
    ).length,
    redacted_metadata_count: surfaces.filter(
      (surface) => surface.required_data_posture === "redacted_metadata_only",
    ).length,
    read_only_authority_count: surfaces.filter(
      (surface) => surface.authority_posture === "read_only",
    ).length,
    gated_or_sandboxed_authority_count: surfaces.filter((surface) =>
      [
        "approval_gated_visibility",
        "sandboxed_only",
        "deferred_disabled",
      ].includes(surface.authority_posture),
    ).length,
    narrative_reference_count: surfaces.reduce(
      (count, surface) => count + surface.narrative_ids.length,
      0,
    ),
    phase_reference_count: surfaces.reduce(
      (count, surface) => count + surface.related_phases.length,
      0,
    ),
    phase20d_demo_surface_registry_only: true,
    phase20d_capability_neutral: true,
    posture: POSTURE,
  });
}
