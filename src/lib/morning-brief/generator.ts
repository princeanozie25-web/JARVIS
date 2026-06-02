import { z } from "zod";
import {
  MORNING_BRIEF_SECTIONS,
  MorningBriefPrioritySchema,
  MorningBriefRequestSchema,
  MorningBriefSectionTypeSchema,
  MorningBriefSourceReferenceSchema,
  type MorningBriefPriority,
  type MorningBriefRequest,
  type MorningBriefSectionType,
  type MorningBriefVerificationMetadata,
} from "./contract";
import {
  MorningBriefPlanSchema,
  type MorningBriefItemDecision,
  type MorningBriefPlan,
  type MorningBriefSectionPlan,
} from "./planner";

export const MORNING_BRIEF_GENERATOR_VERSION =
  "phase21c.morning-brief-generator.v1" as const;

export const MORNING_BRIEF_GENERATION_STATUSES = [
  "generated",
  "failed_closed",
] as const;

export const MORNING_BRIEF_GENERATOR_RUNTIME_MODES = [
  "deterministic_mock",
  "injected_mock",
  "live",
] as const;

export const MORNING_BRIEF_GENERATOR_WARNINGS = [
  "metadata_only",
  "runtime_unavailable",
  "live_generation_not_enabled",
  "request_plan_mismatch",
  "section_generation_failed_closed",
  "verification_caveats_present",
] as const;

const GeneratorIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const BoundedGeneratedTextSchema = z.string().trim().min(1).max(500);

export const MorningBriefGenerationStatusSchema = z.enum(
  MORNING_BRIEF_GENERATION_STATUSES,
);

export const MorningBriefGeneratorRuntimeModeSchema = z.enum(
  MORNING_BRIEF_GENERATOR_RUNTIME_MODES,
);

export const MorningBriefGeneratorWarningSchema = z.enum(
  MORNING_BRIEF_GENERATOR_WARNINGS,
);

export const MorningBriefGeneratorInputSchema = z.strictObject({
  request: MorningBriefRequestSchema,
  plan: MorningBriefPlanSchema,
  runtime_mode:
    MorningBriefGeneratorRuntimeModeSchema.default("deterministic_mock"),
  metadata_only: z.literal(true),
  delivery_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  notification_requested: z.literal(false),
  live_model_requested: z.boolean().default(false),
});

export const MorningBriefGeneratedSectionSchema = z.strictObject({
  section_type: MorningBriefSectionTypeSchema,
  title: BoundedGeneratedTextSchema,
  priority: MorningBriefPrioritySchema,
  bullets: z.array(BoundedGeneratedTextSchema),
  item_ids: z.array(GeneratorIdSchema),
  source_refs: z.array(MorningBriefSourceReferenceSchema),
  verification_ref_ids: z.array(GeneratorIdSchema),
  librarian_update_ids: z.array(GeneratorIdSchema),
  risk_flags: z.array(z.string().trim().min(1).max(80)),
  caveats: z.array(BoundedGeneratedTextSchema),
  generated_by: z.enum(["deterministic_mock", "injected_mock"]),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefPrioritySummarySchema = z.strictObject({
  top_priority: MorningBriefPrioritySchema,
  critical_count: z.number().int().nonnegative(),
  high_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  low_count: z.number().int().nonnegative(),
});

export const MorningBriefAdvisoryMetadataSchema = z.strictObject({
  advisory_only: z.literal(true),
  source_refs: z.array(MorningBriefSourceReferenceSchema),
  verification_ref_ids: z.array(GeneratorIdSchema),
  librarian_update_ids: z.array(GeneratorIdSchema),
  risk_flags: z.array(z.string().trim().min(1).max(80)),
  caveat_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefGeneratorGovernanceSchema = z.strictObject({
  scheduling_attempted: z.literal(false),
  delivery_attempted: z.literal(false),
  notification_attempted: z.literal(false),
  gmail_access_attempted: z.literal(false),
  calendar_access_attempted: z.literal(false),
  drive_access_attempted: z.literal(false),
  live_model_call_attempted: z.literal(false),
  background_job_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
  obsidian_note_write_attempted: z.literal(false),
  write_attempted: z.literal(false),
  raw_bodies_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const MorningBriefGenerationResultSchema = z.strictObject({
  kind: z.literal("morning_brief.generated"),
  generator_version: z.literal(MORNING_BRIEF_GENERATOR_VERSION),
  request_id: GeneratorIdSchema,
  brief_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  title: BoundedGeneratedTextSchema,
  generation_status: MorningBriefGenerationStatusSchema,
  runtime_mode: MorningBriefGeneratorRuntimeModeSchema,
  sections: z.array(MorningBriefGeneratedSectionSchema),
  priority_summary: MorningBriefPrioritySummarySchema,
  caveats: z.array(BoundedGeneratedTextSchema),
  advisory_metadata: MorningBriefAdvisoryMetadataSchema,
  warnings: z.array(MorningBriefGeneratorWarningSchema),
  governance: MorningBriefGeneratorGovernanceSchema,
  delivery_attempted: z.literal(false),
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export type MorningBriefGeneratorRuntimeMode = z.infer<
  typeof MorningBriefGeneratorRuntimeModeSchema
>;
export type MorningBriefGeneratedSection = z.infer<
  typeof MorningBriefGeneratedSectionSchema
>;
export type MorningBriefPrioritySummary = z.infer<
  typeof MorningBriefPrioritySummarySchema
>;
export type MorningBriefAdvisoryMetadata = z.infer<
  typeof MorningBriefAdvisoryMetadataSchema
>;
export type MorningBriefGeneratorGovernance = z.infer<
  typeof MorningBriefGeneratorGovernanceSchema
>;
export type MorningBriefGenerationResult = z.infer<
  typeof MorningBriefGenerationResultSchema
>;
export type MorningBriefGeneratorInput = z.infer<
  typeof MorningBriefGeneratorInputSchema
>;
export type MorningBriefGeneratorWarning = z.infer<
  typeof MorningBriefGeneratorWarningSchema
>;

export interface MorningBriefSectionGeneratorInput {
  readonly request: MorningBriefRequest;
  readonly plan: MorningBriefPlan;
  readonly section_plan: MorningBriefSectionPlan;
  readonly item_decisions: readonly MorningBriefItemDecision[];
  readonly caveats: readonly string[];
}

export interface MorningBriefGeneratorRuntime {
  readonly runtime_kind: "mock";
  generateSection(
    input: MorningBriefSectionGeneratorInput,
  ): MorningBriefGeneratedSection | Promise<MorningBriefGeneratedSection>;
}

export interface GenerateMorningBriefDependencies {
  readonly runtime?: MorningBriefGeneratorRuntime;
}

const PRIORITY_RANK: Record<MorningBriefPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SECTION_TITLES: Record<MorningBriefSectionType, string> = {
  today_overview: "Today Overview",
  calendar_summary: "Calendar Summary",
  inbox_summary: "Inbox Summary",
  project_focus: "Project Focus",
  knowledge_updates: "Knowledge Updates",
  risk_alerts: "Risk Alerts",
  recommended_actions: "Recommended Actions",
};

export async function generateMorningBrief(
  input: unknown,
  dependencies: GenerateMorningBriefDependencies = {},
): Promise<MorningBriefGenerationResult> {
  const parsed = MorningBriefGeneratorInputSchema.parse(input);
  const mismatch = parsed.request.request_id !== parsed.plan.request_id;
  const runtimeUnavailable =
    parsed.runtime_mode === "injected_mock" && !dependencies.runtime;
  const liveRequested =
    parsed.runtime_mode === "live" || parsed.live_model_requested;
  const shouldFailClosed = mismatch || runtimeUnavailable || liveRequested;
  const caveats = caveatsFor(parsed.request);
  const warnings = generatorWarnings({
    caveats,
    mismatch,
    runtimeUnavailable,
    liveRequested,
    sectionFailedClosed: shouldFailClosed,
  });

  if (shouldFailClosed) {
    return MorningBriefGenerationResultSchema.parse({
      kind: "morning_brief.generated",
      generator_version: MORNING_BRIEF_GENERATOR_VERSION,
      request_id: parsed.request.request_id,
      brief_date: parsed.request.brief_date,
      title: titleFor(parsed.request),
      generation_status: "failed_closed",
      runtime_mode: parsed.runtime_mode,
      sections: [],
      priority_summary: prioritySummary([]),
      caveats,
      advisory_metadata: advisoryMetadata([], caveats),
      warnings,
      governance: governanceSummary(),
      delivery_attempted: false,
      write_attempted: false,
      metadata_only: true,
      raw_body_included: false,
    });
  }

  const sections: MorningBriefGeneratedSection[] = [];
  for (const sectionPlan of parsed.plan.section_plans) {
    const sectionInput = {
      request: parsed.request,
      plan: parsed.plan,
      section_plan: sectionPlan,
      item_decisions: itemDecisionsFor(parsed.plan, sectionPlan.item_ids),
      caveats,
    };
    const section =
      parsed.runtime_mode === "injected_mock" && dependencies.runtime
        ? await dependencies.runtime.generateSection(sectionInput)
        : deterministicSection(sectionInput);
    sections.push(MorningBriefGeneratedSectionSchema.parse(section));
  }

  return MorningBriefGenerationResultSchema.parse({
    kind: "morning_brief.generated",
    generator_version: MORNING_BRIEF_GENERATOR_VERSION,
    request_id: parsed.request.request_id,
    brief_date: parsed.request.brief_date,
    title: titleFor(parsed.request),
    generation_status: "generated",
    runtime_mode: parsed.runtime_mode,
    sections,
    priority_summary: prioritySummary(sections),
    caveats,
    advisory_metadata: advisoryMetadata(sections, caveats),
    warnings,
    governance: governanceSummary(),
    delivery_attempted: false,
    write_attempted: false,
    metadata_only: true,
    raw_body_included: false,
  });
}

function deterministicSection(
  input: MorningBriefSectionGeneratorInput,
): MorningBriefGeneratedSection {
  const sectionType = input.section_plan.section.section_type;
  const sectionCaveats = caveatsForSection(input.caveats, input.item_decisions);
  const riskFlags = unique(
    input.item_decisions.flatMap((item) => item.risk_flags),
  );
  const bullets = input.item_decisions.length
    ? input.item_decisions.map((item) => bulletFor(item))
    : [`No included metadata items for ${sectionType}.`];

  return MorningBriefGeneratedSectionSchema.parse({
    section_type: sectionType,
    title: SECTION_TITLES[sectionType],
    priority: input.section_plan.section.priority,
    bullets,
    item_ids: input.section_plan.item_ids,
    source_refs: input.section_plan.section.source_refs,
    verification_ref_ids: input.section_plan.section.verification_ref_ids,
    librarian_update_ids: input.section_plan.section.librarian_update_ids,
    risk_flags: riskFlags,
    caveats: sectionCaveats,
    generated_by: "deterministic_mock",
    metadata_only: true,
    raw_body_included: false,
  });
}

function bulletFor(item: MorningBriefItemDecision): string {
  const riskSuffix = item.risk_flags.length
    ? ` risks:${item.risk_flags.join(",")}`
    : "";
  return `${item.item_kind} ${item.item_id} priority:${item.priority}${riskSuffix}`;
}

function itemDecisionsFor(
  plan: MorningBriefPlan,
  itemIds: readonly string[],
): MorningBriefItemDecision[] {
  const byId = new Map(plan.item_decisions.map((item) => [item.item_id, item]));
  return itemIds
    .map((itemId) => byId.get(itemId))
    .filter((item): item is MorningBriefItemDecision => item !== undefined);
}

function caveatsFor(request: MorningBriefRequest): string[] {
  return request.verification_metadata
    .map((item) => item.caveat_summary)
    .filter((caveat): caveat is string => caveat !== null);
}

function caveatsForSection(
  caveats: readonly string[],
  decisions: readonly MorningBriefItemDecision[],
): string[] {
  if (!decisions.some((decision) => decision.verification_ref_ids.length > 0)) {
    return [];
  }
  return [...caveats];
}

function prioritySummary(
  sections: readonly MorningBriefGeneratedSection[],
): MorningBriefPrioritySummary {
  const priorities = sections.map((section) => section.priority);
  return MorningBriefPrioritySummarySchema.parse({
    top_priority: priorities.length ? maxPriority(...priorities) : "low",
    critical_count: priorities.filter((priority) => priority === "critical")
      .length,
    high_count: priorities.filter((priority) => priority === "high").length,
    medium_count: priorities.filter((priority) => priority === "medium").length,
    low_count: priorities.filter((priority) => priority === "low").length,
  });
}

function advisoryMetadata(
  sections: readonly MorningBriefGeneratedSection[],
  caveats: readonly string[],
): MorningBriefAdvisoryMetadata {
  return MorningBriefAdvisoryMetadataSchema.parse({
    advisory_only: true,
    source_refs: sections.flatMap((section) => section.source_refs),
    verification_ref_ids: unique(
      sections.flatMap((section) => section.verification_ref_ids),
    ),
    librarian_update_ids: unique(
      sections.flatMap((section) => section.librarian_update_ids),
    ),
    risk_flags: unique(sections.flatMap((section) => section.risk_flags)),
    caveat_count: caveats.length,
    metadata_only: true,
    raw_body_included: false,
  });
}

function generatorWarnings(input: {
  readonly caveats: readonly string[];
  readonly mismatch: boolean;
  readonly runtimeUnavailable: boolean;
  readonly liveRequested: boolean;
  readonly sectionFailedClosed: boolean;
}): MorningBriefGeneratorWarning[] {
  return unique([
    "metadata_only",
    ...(input.caveats.length > 0
      ? ["verification_caveats_present" as const]
      : []),
    ...(input.mismatch ? ["request_plan_mismatch" as const] : []),
    ...(input.runtimeUnavailable ? ["runtime_unavailable" as const] : []),
    ...(input.liveRequested ? ["live_generation_not_enabled" as const] : []),
    ...(input.sectionFailedClosed
      ? ["section_generation_failed_closed" as const]
      : []),
  ]);
}

function governanceSummary(): MorningBriefGeneratorGovernance {
  return {
    scheduling_attempted: false,
    delivery_attempted: false,
    notification_attempted: false,
    gmail_access_attempted: false,
    calendar_access_attempted: false,
    drive_access_attempted: false,
    live_model_call_attempted: false,
    background_job_attempted: false,
    vault_write_attempted: false,
    obsidian_note_write_attempted: false,
    write_attempted: false,
    raw_bodies_included: false,
    metadata_only: true,
  };
}

function titleFor(request: MorningBriefRequest): string {
  return `Morning Brief ${request.brief_date}`;
}

function maxPriority(
  ...priorities: readonly MorningBriefPriority[]
): MorningBriefPriority {
  return priorities.reduce<MorningBriefPriority>(
    (best, priority) =>
      PRIORITY_RANK[priority] < PRIORITY_RANK[best] ? priority : best,
    "low",
  );
}

function unique<const T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
