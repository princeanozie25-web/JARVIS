import { z } from "zod";
import {
  AgentOutputSourceReferenceSchema,
  AgentSuggestionInboxTargetSchema,
} from "./contract";
import { AgentDryRunEnvelopeSchema } from "./dry-run-executor";
import {
  AGENT_OUTPUT_FACTORY_VERSION,
  AgentOutputPreviewSchema,
  AgentOutputPrioritySchema,
  createAgentOutputPreview,
} from "./output-factory";
import { AgentRegistryEntrySchema } from "./registry";

export const LIFE_COACH_AGENT_PREVIEW_VERSION =
  "phase21h.life-coach-preview.v1" as const;

export const LIFE_COACH_PROGRESS_CATEGORIES = [
  "learning",
  "career",
  "fitness",
  "jarvis_build",
  "admin_life",
] as const;

export const LIFE_COACH_ACTIONABILITY = [
  "read_only",
  "suggestion",
  "proposal_required",
] as const;

export const LIFE_COACH_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_raw_note_bodies",
  "no_scheduling",
  "no_model_calls",
  "no_inbox_write",
  "approval_required_for_proposals",
] as const;

const LifeCoachIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const LifeCoachTextSchema = z.string().trim().min(1).max(320);

export const LifeCoachProgressCategorySchema = z.enum(
  LIFE_COACH_PROGRESS_CATEGORIES,
);
export const LifeCoachActionabilitySchema = z.enum(LIFE_COACH_ACTIONABILITY);
export const LifeCoachPreviewCaveatSchema = z.enum(LIFE_COACH_PREVIEW_CAVEATS);

export const LifeCoachProgressMetadataSchema = z.strictObject({
  progress_id: LifeCoachIdSchema,
  category: LifeCoachProgressCategorySchema,
  title: LifeCoachTextSchema,
  signal_count: z.number().int().nonnegative(),
  priority: AgentOutputPrioritySchema,
  trend: z.enum(["improving", "steady", "stalled", "needs_attention"]),
  source_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_note_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const LifeCoachLibrarianMetadataSchema = z.strictObject({
  librarian_update_count: z.number().int().nonnegative(),
  envelope_ids: z.array(LifeCoachIdSchema).default([]),
  durable_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const LifeCoachMorningBriefMetadataSchema = z.strictObject({
  brief_ref_id: LifeCoachIdSchema,
  high_priority_item_count: z.number().int().nonnegative(),
  caveat_count: z.number().int().nonnegative(),
  delivery_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const LifeCoachPreviewInputSchema = z.strictObject({
  preview_version: z.literal(LIFE_COACH_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  progress_metadata: z.array(LifeCoachProgressMetadataSchema).min(1),
  librarian_metadata: LifeCoachLibrarianMetadataSchema.nullable().default(null),
  morning_brief_metadata:
    LifeCoachMorningBriefMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  raw_note_bodies_included: z.literal(false),
  model_call_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
  source_reads_requested: z.literal(false),
});

export const LifeCoachProgressCategorySummarySchema = z.strictObject({
  category: LifeCoachProgressCategorySchema,
  item_count: z.number().int().nonnegative(),
  highest_priority: AgentOutputPrioritySchema,
  trend: z.enum(["improving", "steady", "stalled", "needs_attention"]),
  metadata_only: z.literal(true),
});

export const LifeCoachFocusItemSchema = z.strictObject({
  title: LifeCoachTextSchema,
  reason: LifeCoachTextSchema,
  priority: AgentOutputPrioritySchema,
  category: LifeCoachProgressCategorySchema,
  source_refs: z.array(AgentOutputSourceReferenceSchema),
  actionability: LifeCoachActionabilitySchema,
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const LifeCoachPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  source_reads_attempted: z.literal(false),
  raw_note_bodies_included: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  approval_bypass_attempted: z.literal(false),
  obsidian_read_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  project_registry_mutation_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const LifeCoachAgentPreviewSchema = z.strictObject({
  kind: z.literal("life_coach.weekly_progress_preview"),
  preview_version: z.literal(LIFE_COACH_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("life_coach"),
  weekly_progress_digest_preview: z.strictObject({
    title: LifeCoachTextSchema,
    summary: LifeCoachTextSchema,
    progress_categories: z.array(LifeCoachProgressCategorySummarySchema),
    focus_items: z.array(LifeCoachFocusItemSchema).length(3),
    caveats: z.array(LifeCoachPreviewCaveatSchema),
    source_refs: z.array(AgentOutputSourceReferenceSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  librarian_metadata: LifeCoachLibrarianMetadataSchema.nullable(),
  morning_brief_metadata: LifeCoachMorningBriefMetadataSchema.nullable(),
  governance: LifeCoachPreviewGovernanceSchema,
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type LifeCoachProgressCategory = z.infer<
  typeof LifeCoachProgressCategorySchema
>;
export type LifeCoachActionability = z.infer<
  typeof LifeCoachActionabilitySchema
>;
export type LifeCoachProgressMetadata = z.infer<
  typeof LifeCoachProgressMetadataSchema
>;
export type LifeCoachFocusItem = z.infer<typeof LifeCoachFocusItemSchema>;
export type LifeCoachAgentPreview = z.infer<typeof LifeCoachAgentPreviewSchema>;
export type LifeCoachPreviewInput = z.infer<typeof LifeCoachPreviewInputSchema>;

export function previewLifeCoachAgent(input: unknown): LifeCoachAgentPreview {
  const parsed = LifeCoachPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "life_coach") {
    throw new Error(
      "Life Coach preview requires the life_coach registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "life_coach") {
    throw new Error("Life Coach preview requires a life_coach dry-run.");
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Life Coach preview requires a planned dry-run.");
  }

  const outputPreview = createAgentOutputPreview({
    factory_version: AGENT_OUTPUT_FACTORY_VERSION,
    dry_run: parsed.dry_run,
    registry_entry: parsed.registry_entry,
    fixture_metadata: parsed.dry_run.fixture_metadata,
    metadata_only: true,
    inbox_write_requested: false,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    model_call_requested: false,
  });
  const focusItems = buildFocusItems(parsed.progress_metadata);
  const sourceRefs = uniqueSources([
    ...outputPreview.source_refs,
    ...focusItems.flatMap((item) => item.source_refs),
  ]);

  return LifeCoachAgentPreviewSchema.parse({
    kind: "life_coach.weekly_progress_preview",
    preview_version: LIFE_COACH_AGENT_PREVIEW_VERSION,
    agent_id: "life_coach",
    weekly_progress_digest_preview: {
      title: "Life Coach weekly progress preview",
      summary: summaryFor(parsed.progress_metadata, focusItems),
      progress_categories: categorySummaries(parsed.progress_metadata),
      focus_items: focusItems,
      caveats: caveatsFor(parsed),
      source_refs: sourceRefs,
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    librarian_metadata: parsed.librarian_metadata,
    morning_brief_metadata: parsed.morning_brief_metadata,
    governance: governanceSummary(),
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function buildFocusItems(
  progressMetadata: readonly LifeCoachProgressMetadata[],
): LifeCoachFocusItem[] {
  const sorted = [...progressMetadata].sort((a, b) => {
    const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDelta !== 0) return priorityDelta;
    const trendDelta = trendRank(b.trend) - trendRank(a.trend);
    if (trendDelta !== 0) return trendDelta;
    return b.signal_count - a.signal_count;
  });
  const selected = [...sorted];
  while (selected.length < 3) {
    selected.push(sorted[selected.length % sorted.length]);
  }
  return selected.slice(0, 3).map((item) =>
    LifeCoachFocusItemSchema.parse({
      title: item.title,
      reason: reasonFor(item),
      priority: item.priority,
      category: item.category,
      source_refs: item.source_refs,
      actionability: actionabilityFor(item),
      metadata_only: true,
      raw_body_included: false,
    }),
  );
}

function categorySummaries(
  progressMetadata: readonly LifeCoachProgressMetadata[],
): z.infer<typeof LifeCoachProgressCategorySummarySchema>[] {
  return LIFE_COACH_PROGRESS_CATEGORIES.map((category) => {
    const items = progressMetadata.filter((item) => item.category === category);
    return LifeCoachProgressCategorySummarySchema.parse({
      category,
      item_count: items.length,
      highest_priority: items.length
        ? highestPriority(items.map((item) => item.priority))
        : "low",
      trend: items.length
        ? strongestTrend(items.map((item) => item.trend))
        : "steady",
      metadata_only: true,
    });
  });
}

function summaryFor(
  progressMetadata: readonly LifeCoachProgressMetadata[],
  focusItems: readonly LifeCoachFocusItem[],
): string {
  const activeCategories = new Set(
    progressMetadata.map((item) => item.category),
  );
  return `Metadata-only weekly digest preview across ${activeCategories.size} categories with ${focusItems.length} focus items.`;
}

function caveatsFor(
  input: z.infer<typeof LifeCoachPreviewInputSchema>,
): z.infer<typeof LifeCoachPreviewCaveatSchema>[] {
  return [
    "metadata_only",
    "fixture_metadata_only",
    "no_raw_note_bodies",
    "no_scheduling",
    "no_model_calls",
    "no_inbox_write",
    ...(input.registry_entry.requires_approval
      ? (["approval_required_for_proposals"] as const)
      : []),
  ];
}

function reasonFor(item: LifeCoachProgressMetadata): string {
  if (item.trend === "needs_attention") {
    return `${item.category} needs attention based on ${item.signal_count} metadata signals.`;
  }
  if (item.trend === "stalled") {
    return `${item.category} appears stalled across ${item.signal_count} metadata signals.`;
  }
  return `${item.category} has ${item.trend} progress across ${item.signal_count} metadata signals.`;
}

function actionabilityFor(
  item: LifeCoachProgressMetadata,
): LifeCoachActionability {
  if (item.priority === "critical" || item.priority === "high") {
    return "proposal_required";
  }
  if (item.trend === "needs_attention" || item.trend === "stalled") {
    return "suggestion";
  }
  return "read_only";
}

function highestPriority(
  priorities: readonly z.infer<typeof AgentOutputPrioritySchema>[],
) {
  return priorities.reduce((highest, priority) =>
    priorityRank(priority) > priorityRank(highest) ? priority : highest,
  );
}

function strongestTrend(
  trends: readonly LifeCoachProgressMetadata["trend"][],
): LifeCoachProgressMetadata["trend"] {
  return trends.reduce((strongest, trend) =>
    trendRank(trend) > trendRank(strongest) ? trend : strongest,
  );
}

function priorityRank(priority: z.infer<typeof AgentOutputPrioritySchema>) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

function trendRank(trend: LifeCoachProgressMetadata["trend"]) {
  return { steady: 0, improving: 1, stalled: 2, needs_attention: 3 }[trend];
}

function uniqueSources(
  sources: readonly z.infer<typeof AgentOutputSourceReferenceSchema>[],
) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.source_kind}:${source.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function governanceSummary() {
  return LifeCoachPreviewGovernanceSchema.parse({
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    source_reads_attempted: false,
    raw_note_bodies_included: false,
    model_call_attempted: false,
    network_call_attempted: false,
    scheduling_attempted: false,
    approval_bypass_attempted: false,
    obsidian_read_attempted: false,
    obsidian_write_attempted: false,
    project_registry_mutation_attempted: false,
    metadata_only: true,
  });
}
