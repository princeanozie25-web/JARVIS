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

export const RESEARCH_AGENT_PREVIEW_VERSION =
  "phase21h.research-agent-preview.v1" as const;

export const RESEARCH_TOPIC_CATEGORIES = [
  "ai_systems",
  "agent_architecture",
  "career",
  "product_design",
  "technical_reference",
] as const;

export const RESEARCH_SOURCE_TYPES = [
  "paper",
  "article",
  "documentation",
  "repository",
  "note",
] as const;

export const RESEARCH_RECOMMENDED_ACTIONS = [
  "read",
  "file_to_librarian",
  "monitor",
  "ignore",
] as const;

export const RESEARCH_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_web_search",
  "no_external_api_calls",
  "no_model_calls",
  "no_raw_article_bodies",
  "no_inbox_write",
  "librarian_required_for_persistence",
] as const;

const ResearchIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const ResearchTextSchema = z.string().trim().min(1).max(360);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const ResearchTopicCategorySchema = z.enum(RESEARCH_TOPIC_CATEGORIES);
export const ResearchSourceTypeSchema = z.enum(RESEARCH_SOURCE_TYPES);
export const ResearchRecommendedActionSchema = z.enum(
  RESEARCH_RECOMMENDED_ACTIONS,
);
export const ResearchPreviewCaveatSchema = z.enum(RESEARCH_PREVIEW_CAVEATS);

export const ResearchTopicMetadataSchema = z.strictObject({
  topic_id: ResearchIdSchema,
  title: ResearchTextSchema,
  category: ResearchTopicCategorySchema,
  interest_level: AgentOutputPrioritySchema,
  source_count: z.number().int().nonnegative(),
  freshness: z.enum(["fresh", "recent", "stale", "unknown"]),
  related_wiki_refs: z.array(ResearchIdSchema).default([]),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const ResearchSourceMetadataSchema = z.strictObject({
  source_id: ResearchIdSchema,
  title: ResearchTextSchema,
  source_type: ResearchSourceTypeSchema,
  url_hash: HashReferenceSchema.nullable().default(null),
  published_at: z.string().trim().datetime({ offset: true }).nullable(),
  trust_level: z.enum(["high", "medium", "low", "unknown"]),
  summary_metadata_only: z.literal(true),
  raw_article_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ResearchLibrarianMetadataSchema = z.strictObject({
  envelope_count: z.number().int().nonnegative(),
  draft_envelope_ids: z.array(ResearchIdSchema).default([]),
  librarian_required_for_persistence: z.literal(true),
  librarian_bypass_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const ResearchVerificationMetadataSchema = z.strictObject({
  verification_ref_id: ResearchIdSchema,
  verification_status: z.enum([
    "not_requested",
    "pending",
    "completed_metadata_only",
    "failed_closed",
  ]),
  risk_flag_count: z.number().int().nonnegative(),
  raw_verifier_response_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ResearchPreviewInputSchema = z.strictObject({
  preview_version: z.literal(RESEARCH_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  topic_metadata: z.array(ResearchTopicMetadataSchema).min(1),
  source_metadata: z.array(ResearchSourceMetadataSchema).default([]),
  librarian_metadata: ResearchLibrarianMetadataSchema.nullable().default(null),
  verification_metadata:
    ResearchVerificationMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  raw_article_bodies_included: z.literal(false),
  web_search_requested: z.literal(false),
  external_api_requested: z.literal(false),
  model_call_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
  librarian_bypass_requested: z.literal(false),
});

export const ResearchTopicSummarySchema = z.strictObject({
  topic_id: ResearchIdSchema,
  title: ResearchTextSchema,
  category: ResearchTopicCategorySchema,
  interest_level: AgentOutputPrioritySchema,
  source_count: z.number().int().nonnegative(),
  freshness: z.enum(["fresh", "recent", "stale", "unknown"]),
  related_wiki_refs: z.array(ResearchIdSchema),
  metadata_only: z.literal(true),
});

export const ResearchSourceSummarySchema = z.strictObject({
  source_count: z.number().int().nonnegative(),
  high_trust_count: z.number().int().nonnegative(),
  source_types: z.array(ResearchSourceTypeSchema),
  newest_published_at: z.string().trim().datetime({ offset: true }).nullable(),
  metadata_only: z.literal(true),
  raw_article_bodies_included: z.literal(false),
});

export const ResearchNoveltySignalSchema = z.strictObject({
  topic_id: ResearchIdSchema,
  signal: z.enum([
    "fresh_high_interest",
    "stale_high_interest",
    "low_source_coverage",
  ]),
  reason: ResearchTextSchema,
  priority: AgentOutputPrioritySchema,
  metadata_only: z.literal(true),
});

export const ResearchRecommendationSchema = z.strictObject({
  title: ResearchTextSchema,
  reason: ResearchTextSchema,
  priority: AgentOutputPrioritySchema,
  related_topic_id: ResearchIdSchema,
  suggested_action: ResearchRecommendedActionSchema,
  approval_required: z.boolean(),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const ResearchPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  web_search_attempted: z.literal(false),
  external_api_call_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  raw_article_bodies_included: z.literal(false),
  librarian_bypass_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const ResearchAgentPreviewSchema = z.strictObject({
  kind: z.literal("research_agent.digest_preview"),
  preview_version: z.literal(RESEARCH_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("research_agent"),
  research_digest_preview: z.strictObject({
    title: ResearchTextSchema,
    summary: ResearchTextSchema,
    topic_summaries: z.array(ResearchTopicSummarySchema),
    source_summary: ResearchSourceSummarySchema,
    novelty_signals: z.array(ResearchNoveltySignalSchema),
    follow_up_recommendations: z.array(ResearchRecommendationSchema),
    caveats: z.array(ResearchPreviewCaveatSchema),
    source_refs: z.array(AgentOutputSourceReferenceSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  librarian_metadata: ResearchLibrarianMetadataSchema.nullable(),
  verification_metadata: ResearchVerificationMetadataSchema.nullable(),
  governance: ResearchPreviewGovernanceSchema,
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type ResearchTopicMetadata = z.infer<typeof ResearchTopicMetadataSchema>;
export type ResearchSourceMetadata = z.infer<
  typeof ResearchSourceMetadataSchema
>;
export type ResearchRecommendation = z.infer<
  typeof ResearchRecommendationSchema
>;
export type ResearchAgentPreview = z.infer<typeof ResearchAgentPreviewSchema>;
export type ResearchPreviewInput = z.infer<typeof ResearchPreviewInputSchema>;

export function previewResearchAgent(input: unknown): ResearchAgentPreview {
  const parsed = ResearchPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "research_agent") {
    throw new Error(
      "Research Agent preview requires the research_agent registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "research_agent") {
    throw new Error(
      "Research Agent preview requires a research_agent dry-run.",
    );
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Research Agent preview requires a planned dry-run.");
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
  const topicSummaries = parsed.topic_metadata.map(topicSummaryFor);
  const noveltySignals = noveltySignalsFor(parsed.topic_metadata);
  const recommendations = recommendationsFor(parsed.topic_metadata);

  return ResearchAgentPreviewSchema.parse({
    kind: "research_agent.digest_preview",
    preview_version: RESEARCH_AGENT_PREVIEW_VERSION,
    agent_id: "research_agent",
    research_digest_preview: {
      title: "Research Agent digest preview",
      summary: summaryFor(parsed.topic_metadata, parsed.source_metadata),
      topic_summaries: topicSummaries,
      source_summary: sourceSummaryFor(parsed.source_metadata),
      novelty_signals: noveltySignals,
      follow_up_recommendations: recommendations,
      caveats: [
        "metadata_only",
        "fixture_metadata_only",
        "no_web_search",
        "no_external_api_calls",
        "no_model_calls",
        "no_raw_article_bodies",
        "no_inbox_write",
        "librarian_required_for_persistence",
      ],
      source_refs: outputPreview.source_refs,
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    librarian_metadata: parsed.librarian_metadata,
    verification_metadata: parsed.verification_metadata,
    governance: governanceSummary(),
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function topicSummaryFor(topic: ResearchTopicMetadata) {
  return ResearchTopicSummarySchema.parse({
    topic_id: topic.topic_id,
    title: topic.title,
    category: topic.category,
    interest_level: topic.interest_level,
    source_count: topic.source_count,
    freshness: topic.freshness,
    related_wiki_refs: topic.related_wiki_refs,
    metadata_only: true,
  });
}

function sourceSummaryFor(sources: readonly ResearchSourceMetadata[]) {
  const newest =
    sources
      .map((source) => source.published_at)
      .filter((date): date is string => date !== null)
      .sort()
      .at(-1) ?? null;
  return ResearchSourceSummarySchema.parse({
    source_count: sources.length,
    high_trust_count: sources.filter((source) => source.trust_level === "high")
      .length,
    source_types: unique(sources.map((source) => source.source_type)),
    newest_published_at: newest,
    metadata_only: true,
    raw_article_bodies_included: false,
  });
}

function noveltySignalsFor(
  topics: readonly ResearchTopicMetadata[],
): z.infer<typeof ResearchNoveltySignalSchema>[] {
  return topics
    .map((topic) => {
      if (topic.source_count <= 1) {
        return ResearchNoveltySignalSchema.parse({
          topic_id: topic.topic_id,
          signal: "low_source_coverage",
          reason: `${topic.title} has limited source coverage.`,
          priority: topic.interest_level,
          metadata_only: true,
        });
      }
      if (topic.interest_level === "high" && topic.freshness === "fresh") {
        return ResearchNoveltySignalSchema.parse({
          topic_id: topic.topic_id,
          signal: "fresh_high_interest",
          reason: `${topic.title} is fresh and high interest.`,
          priority: "high",
          metadata_only: true,
        });
      }
      if (topic.interest_level === "high" && topic.freshness === "stale") {
        return ResearchNoveltySignalSchema.parse({
          topic_id: topic.topic_id,
          signal: "stale_high_interest",
          reason: `${topic.title} is high interest but stale.`,
          priority: "medium",
          metadata_only: true,
        });
      }
      return null;
    })
    .filter(
      (signal): signal is z.infer<typeof ResearchNoveltySignalSchema> =>
        signal !== null,
    );
}

function recommendationsFor(
  topics: readonly ResearchTopicMetadata[],
): ResearchRecommendation[] {
  return [...topics]
    .sort(
      (a, b) => priorityRank(b.interest_level) - priorityRank(a.interest_level),
    )
    .slice(0, 4)
    .map((topic) =>
      ResearchRecommendationSchema.parse({
        title: `Follow up on ${topic.title}`,
        reason: recommendationReasonFor(topic),
        priority: topic.interest_level,
        related_topic_id: topic.topic_id,
        suggested_action: recommendedActionFor(topic),
        approval_required: recommendedActionFor(topic) === "file_to_librarian",
        metadata_only: true,
        raw_body_included: false,
      }),
    );
}

function recommendedActionFor(
  topic: ResearchTopicMetadata,
): z.infer<typeof ResearchRecommendedActionSchema> {
  if (topic.interest_level === "low") return "ignore";
  if (topic.freshness === "fresh" && topic.source_count >= 2) {
    return "file_to_librarian";
  }
  if (topic.freshness === "stale") return "monitor";
  return "read";
}

function recommendationReasonFor(topic: ResearchTopicMetadata): string {
  if (topic.source_count <= 1) {
    return `${topic.title} needs more metadata-backed sources before synthesis.`;
  }
  if (topic.freshness === "fresh") {
    return `${topic.title} has fresh source metadata worth reviewing.`;
  }
  return `${topic.title} should stay visible for future monitoring.`;
}

function summaryFor(
  topics: readonly ResearchTopicMetadata[],
  sources: readonly ResearchSourceMetadata[],
) {
  return `Metadata-only research preview across ${topics.length} topics and ${sources.length} sources.`;
}

function priorityRank(priority: z.infer<typeof AgentOutputPrioritySchema>) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

function governanceSummary() {
  return ResearchPreviewGovernanceSchema.parse({
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    web_search_attempted: false,
    external_api_call_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    scheduling_attempted: false,
    raw_article_bodies_included: false,
    librarian_bypass_attempted: false,
    obsidian_write_attempted: false,
    metadata_only: true,
  });
}

function unique<const T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
