import { z } from "zod";

export const PORTFOLIO_READINESS_CONTRACT_VERSION = "20D.1" as const;

export const PORTFOLIO_READINESS_CATEGORIES = [
  "portfolio_area",
  "recruiter_narrative",
  "demo_surface",
] as const;

export const PORTFOLIO_AREA_IDS = [
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

export const PORTFOLIO_NARRATIVE_IDS = [
  "portfolio-narrative:project",
  "portfolio-narrative:architecture",
  "portfolio-narrative:governance",
  "portfolio-narrative:technical-complexity",
  "portfolio-narrative:safety",
  "portfolio-narrative:local-first",
] as const;

export const DEMO_READINESS_SURFACE_IDS = [
  "demo-surface:demo-mode-availability",
  "demo-surface:synthetic-data-posture",
  "demo-surface:fake-room-posture",
  "demo-surface:replay-visibility",
  "demo-surface:architecture-graph-visibility",
  "demo-surface:governance-graph-visibility",
  "demo-surface:telemetry-cockpit-visibility",
] as const;

export type PortfolioReadinessCategory =
  (typeof PORTFOLIO_READINESS_CATEGORIES)[number];
export type PortfolioReadinessAreaId = (typeof PORTFOLIO_AREA_IDS)[number];
export type PortfolioReadinessNarrativeId =
  (typeof PORTFOLIO_NARRATIVE_IDS)[number];
export type DemoReadinessSurfaceId =
  (typeof DEMO_READINESS_SURFACE_IDS)[number];

export const PortfolioReadinessCategorySchema = z.enum(
  PORTFOLIO_READINESS_CATEGORIES,
);
export const PortfolioReadinessAreaIdSchema = z.enum(PORTFOLIO_AREA_IDS);
export const PortfolioReadinessNarrativeIdSchema = z.enum(
  PORTFOLIO_NARRATIVE_IDS,
);
export const DemoReadinessSurfaceIdSchema = z.enum(DEMO_READINESS_SURFACE_IDS);

export const PortfolioReadinessPostureSchema = z.strictObject({
  contract_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  presentation_generation_enabled: z.literal(false),
  demo_execution_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  automation_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  runtime_execution_enabled: z.literal(false),
  approval_bypass_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
  source_material_exposure_enabled: z.literal(false),
});

export const PortfolioReadinessAreaSchema = z.strictObject({
  area_id: PortfolioReadinessAreaIdSchema,
  label: z.string().trim().min(1).max(160),
  category: z.literal("portfolio_area"),
  visibility_goal: z.string().trim().min(1).max(420),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  recruiter_relevance: z.string().trim().min(1).max(320),
  demo_relevance: z.string().trim().min(1).max(320),
  local_first_relevance: z.boolean(),
  safety_relevance: z.boolean(),
  posture: PortfolioReadinessPostureSchema,
});

export const PortfolioReadinessNarrativeSchema = z.strictObject({
  narrative_id: PortfolioReadinessNarrativeIdSchema,
  label: z.string().trim().min(1).max(160),
  category: z.literal("recruiter_narrative"),
  narrative_goal: z.string().trim().min(1).max(420),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  talking_points: z.array(z.string().trim().min(1).max(220)).min(1),
  recruiter_ready: z.literal(true),
  posture: PortfolioReadinessPostureSchema,
});

export const DemoReadinessSurfaceSchema = z.strictObject({
  surface_id: DemoReadinessSurfaceIdSchema,
  label: z.string().trim().min(1).max(160),
  category: z.literal("demo_surface"),
  surface_goal: z.string().trim().min(1).max(420),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  synthetic_data_required: z.boolean(),
  fake_room_safe: z.boolean(),
  replay_safe: z.boolean(),
  demo_execution_required: z.literal(false),
  posture: PortfolioReadinessPostureSchema,
});

export const PortfolioReadinessContractSchema = z.strictObject({
  contract_version: z.literal(PORTFOLIO_READINESS_CONTRACT_VERSION),
  contract_id: z.literal("phase-20d1-portfolio-readiness-contract"),
  phase: z.literal("20D.1"),
  summary: z.string().trim().min(1).max(420),
  categories: z.array(PortfolioReadinessCategorySchema),
  portfolio_areas: z.array(PortfolioReadinessAreaSchema),
  recruiter_narratives: z.array(PortfolioReadinessNarrativeSchema),
  demo_surfaces: z.array(DemoReadinessSurfaceSchema),
  posture: PortfolioReadinessPostureSchema,
});

export const PortfolioReadinessSummarySchema = z.strictObject({
  contract_version: z.literal(PORTFOLIO_READINESS_CONTRACT_VERSION),
  area_count: z.number().int().positive(),
  narrative_count: z.number().int().positive(),
  demo_surface_count: z.number().int().positive(),
  category_counts: z.record(
    PortfolioReadinessCategorySchema,
    z.number().int().nonnegative(),
  ),
  local_first_area_count: z.number().int().nonnegative(),
  safety_relevant_area_count: z.number().int().nonnegative(),
  synthetic_data_surface_count: z.number().int().nonnegative(),
  fake_room_safe_surface_count: z.number().int().nonnegative(),
  replay_safe_surface_count: z.number().int().nonnegative(),
  recruiter_ready_narrative_count: z.number().int().nonnegative(),
  phase20d_contract_only: z.literal(true),
  phase20d_capability_neutral: z.literal(true),
  posture: PortfolioReadinessPostureSchema,
});

export type PortfolioReadinessPosture = z.infer<
  typeof PortfolioReadinessPostureSchema
>;
export type PortfolioReadinessArea = z.infer<
  typeof PortfolioReadinessAreaSchema
>;
export type PortfolioReadinessNarrative = z.infer<
  typeof PortfolioReadinessNarrativeSchema
>;
export type DemoReadinessSurface = z.infer<typeof DemoReadinessSurfaceSchema>;
export type PortfolioReadinessContract = z.infer<
  typeof PortfolioReadinessContractSchema
>;
export type PortfolioReadinessSummary = z.infer<
  typeof PortfolioReadinessSummarySchema
>;
