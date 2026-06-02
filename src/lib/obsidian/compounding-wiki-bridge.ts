import { z } from "zod";
import {
  KnowledgeCompoundingCandidateSchema,
  KnowledgeCompoundingCandidateTypeSchema,
  type KnowledgeCompoundingCandidate,
  type KnowledgeCompoundingCandidateType,
} from "./knowledge-compounding-contract";
import {
  LLM_WIKI_DRY_RUN_PLANNER_VERSION,
  LlmWikiMaintenanceDryRunPlanSchema,
  planLlmWikiMaintenanceDryRun,
  type LlmWikiMaintenanceDryRunPlan,
  type LlmWikiSnapshot,
} from "./llm-wiki-dry-run-planner";
import { LlmWikiRawSourceSchema } from "./llm-wiki-contract";

export const COMPOUNDING_WIKI_BRIDGE_VERSION =
  "phase21.compounding-wiki-bridge.v1" as const;

export const COMPOUNDING_WIKI_BRIDGE_REASONS = [
  "accepted",
  "input_invalid",
  "no_candidates",
  "wiki_plans_created",
  "gateway_drafts_created",
] as const;

export const COMPOUNDING_WIKI_BRIDGE_WARNINGS = [
  "bridge_only_no_write_executed",
  "llm_wiki_planner_reused",
  "librarian_envelopes_are_drafts",
  "gateway_proposals_are_drafts",
  "no_llm_calls",
  "no_vault_mutation",
] as const;

export const COMPOUNDING_TO_WIKI_ACTION_MAP = {
  missing_hub: "create_hub",
  sparse_hub: "update_hub",
  fragmented_concept: "merge_pages",
  missing_backlinks: "create_backlinks",
  weak_source_coverage: "update_hub",
  duplicate_concept: "merge_pages",
  stale_wiki_page: "refresh_stale_page",
  underlinked_system: "create_backlinks",
} as const;

const WikiBridgeSnapshotSchema = z.strictObject({
  pages: z
    .array(
      z.strictObject({
        page_id: z.string().trim().min(1),
        page_type: z.enum([
          "hub_page",
          "concept_page",
          "system_page",
          "person_page",
          "project_page",
          "source_page",
          "decision_page",
          "comparison_page",
          "synthesis_page",
        ]),
        title: z.string().trim().min(1),
        path: z.string().trim().min(1),
        source_ids: z.array(z.string().trim().min(1)).default([]),
        source_hashes: z
          .array(z.string().trim().regex(/^sha256:[a-f0-9]{64}$/))
          .default([]),
        backlinks: z.array(z.string().trim().min(1)).default([]),
        hub_id: z.string().trim().min(1).nullable().default(null),
        updated_at: z
          .string()
          .trim()
          .datetime({ offset: true })
          .nullable()
          .default(null),
      }),
    )
    .default([]),
  index_entries: z.array(z.string().trim().min(1)).default([]),
  log_entry_ids: z.array(z.string().trim().min(1)).default([]),
});

const BridgeRoutingPreferenceSchema = z.strictObject({
  include_gateway_proposal_drafts: z.boolean().default(false),
  proposal_markdown_body: z.string().nullable().default(null),
});

export const CompoundingWikiBridgeInputSchema = z.strictObject({
  candidates: z.array(KnowledgeCompoundingCandidateSchema),
  llm_wiki_metadata_snapshot: WikiBridgeSnapshotSchema.default({
    pages: [],
    index_entries: [],
    log_entry_ids: [],
  }),
  routing_preferences: BridgeRoutingPreferenceSchema.nullable().default(null),
});

export const CompoundingWikiBridgeRecommendationSchema = z.strictObject({
  candidate_id: z.string().trim().min(1),
  candidate_type: KnowledgeCompoundingCandidateTypeSchema,
  wiki_action: z.enum([
    "create_hub",
    "update_hub",
    "merge_pages",
    "create_backlinks",
    "refresh_stale_page",
  ]),
  requested_operation: z.enum([
    "ingest_source",
    "update_entity_concept_pages",
    "update_index",
    "append_log_entry",
    "answer_query",
    "file_useful_answer_back_into_wiki",
    "lint_wiki",
  ]),
  page_type: z.enum([
    "hub_page",
    "concept_page",
    "system_page",
    "person_page",
    "project_page",
    "source_page",
    "decision_page",
    "comparison_page",
    "synthesis_page",
  ]),
  reason: z.string().trim().min(1),
});

export const CompoundingWikiBridgePlanSchema = z.strictObject({
  bridge_version: z.literal(COMPOUNDING_WIKI_BRIDGE_VERSION),
  llm_wiki_planner_version: z.literal(LLM_WIKI_DRY_RUN_PLANNER_VERSION),
  accepted: z.boolean(),
  recommendations: z.array(CompoundingWikiBridgeRecommendationSchema),
  wiki_maintenance_plans: z.array(LlmWikiMaintenanceDryRunPlanSchema),
  librarian_envelope_drafts: z.array(z.unknown()),
  gateway_proposal_drafts: z.array(z.unknown()),
  lint_findings: z.array(z.unknown()),
  reasons: z.array(z.enum(COMPOUNDING_WIKI_BRIDGE_REASONS)),
  warnings: z.array(z.enum(COMPOUNDING_WIKI_BRIDGE_WARNINGS)),
  governance: z.strictObject({
    write_attempted: z.literal(false),
    vault_mutated: z.literal(false),
    execution_authority: z.literal(false),
    llm_calls_made: z.literal(false),
    deepseek_calls_made: z.literal(false),
    ollama_calls_made: z.literal(false),
    network_used: z.literal(false),
    scheduler_started: z.literal(false),
    watcher_started: z.literal(false),
    background_job_started: z.literal(false),
  }),
  write_attempted: z.literal(false),
});

export type CompoundingWikiBridgeInput = z.infer<
  typeof CompoundingWikiBridgeInputSchema
>;
export type CompoundingWikiBridgeRecommendation = z.infer<
  typeof CompoundingWikiBridgeRecommendationSchema
>;
export type CompoundingWikiBridgePlan = z.infer<
  typeof CompoundingWikiBridgePlanSchema
>;
export type CompoundingWikiBridgeReason =
  (typeof COMPOUNDING_WIKI_BRIDGE_REASONS)[number];
export type CompoundingWikiBridgeWarning =
  (typeof COMPOUNDING_WIKI_BRIDGE_WARNINGS)[number];
export type CompoundingWikiAction =
  (typeof COMPOUNDING_TO_WIKI_ACTION_MAP)[KnowledgeCompoundingCandidateType];

export function planKnowledgeCompoundingWikiBridge(
  input: unknown,
): CompoundingWikiBridgePlan {
  const parsed = CompoundingWikiBridgeInputSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedPlan("input_invalid");
  }

  const request = parsed.data;
  const recommendations = request.candidates.map(recommendationForCandidate);
  const wikiPlans = request.candidates.map((candidate, index) =>
    wikiPlanForCandidate(
      candidate,
      recommendations[index],
      request.llm_wiki_metadata_snapshot,
      request.routing_preferences,
    ),
  );
  const reasons: CompoundingWikiBridgeReason[] = [];

  if (request.candidates.length === 0) {
    reasons.push("no_candidates");
  }
  if (wikiPlans.length > 0) {
    reasons.push("wiki_plans_created");
  }
  if (wikiPlans.some((plan) => plan.gateway_proposal_drafts.length > 0)) {
    reasons.push("gateway_drafts_created");
  }
  if (reasons.length === 0) {
    reasons.push("accepted");
  }

  return CompoundingWikiBridgePlanSchema.parse({
    bridge_version: COMPOUNDING_WIKI_BRIDGE_VERSION,
    llm_wiki_planner_version: LLM_WIKI_DRY_RUN_PLANNER_VERSION,
    accepted: request.candidates.length > 0,
    recommendations,
    wiki_maintenance_plans: wikiPlans,
    librarian_envelope_drafts: wikiPlans.flatMap(
      (plan) => plan.librarian_envelope_drafts,
    ),
    gateway_proposal_drafts: wikiPlans.flatMap(
      (plan) => plan.gateway_proposal_drafts,
    ),
    lint_findings: wikiPlans.flatMap((plan) => plan.lint_findings),
    reasons: unique(reasons),
    warnings: [
      "bridge_only_no_write_executed",
      "llm_wiki_planner_reused",
      "librarian_envelopes_are_drafts",
      "gateway_proposals_are_drafts",
      "no_llm_calls",
      "no_vault_mutation",
    ],
    governance: governanceSummary(),
    write_attempted: false,
  });
}

function wikiPlanForCandidate(
  candidate: KnowledgeCompoundingCandidate,
  recommendation: CompoundingWikiBridgeRecommendation,
  snapshot: LlmWikiSnapshot,
  routingPreference: CompoundingWikiBridgeInput["routing_preferences"],
): LlmWikiMaintenanceDryRunPlan {
  return planLlmWikiMaintenanceDryRun({
    source_envelope: rawSourceForCandidate(candidate),
    existing_wiki_snapshot: snapshot,
    requested_operation: recommendation.requested_operation,
    page_preference: {
      page_type: recommendation.page_type,
      title: titleForCandidate(candidate),
      durable_requested: candidate.confidence >= 0.75,
      approval_status: "approved",
      approval_id:
        candidate.confidence >= 0.75
          ? "approval:compounding-wiki.bridge"
          : null,
      synthesis_supported: true,
    },
    include_gateway_proposal_draft:
      routingPreference?.include_gateway_proposal_drafts ?? false,
    proposal_markdown_body: routingPreference?.proposal_markdown_body ?? null,
  });
}

function recommendationForCandidate(
  candidate: KnowledgeCompoundingCandidate,
): CompoundingWikiBridgeRecommendation {
  const wikiAction = COMPOUNDING_TO_WIKI_ACTION_MAP[candidate.candidate_type];
  return CompoundingWikiBridgeRecommendationSchema.parse({
    candidate_id: candidate.candidate_id,
    candidate_type: candidate.candidate_type,
    wiki_action: wikiAction,
    requested_operation: operationForAction(wikiAction),
    page_type: pageTypeForAction(wikiAction, candidate.candidate_type),
    reason: candidate.rationale,
  });
}

function operationForAction(action: CompoundingWikiAction): z.infer<
  typeof CompoundingWikiBridgeRecommendationSchema
>["requested_operation"] {
  if (action === "create_hub") return "ingest_source";
  if (action === "update_hub") return "update_entity_concept_pages";
  if (action === "merge_pages") return "update_entity_concept_pages";
  if (action === "create_backlinks") return "update_entity_concept_pages";
  return "update_entity_concept_pages";
}

function pageTypeForAction(
  action: CompoundingWikiAction,
  candidateType: KnowledgeCompoundingCandidateType,
): z.infer<typeof CompoundingWikiBridgeRecommendationSchema>["page_type"] {
  if (action === "create_hub" || action === "update_hub") return "hub_page";
  if (candidateType === "underlinked_system") return "system_page";
  return "concept_page";
}

function rawSourceForCandidate(
  candidate: KnowledgeCompoundingCandidate,
): z.infer<typeof LlmWikiRawSourceSchema> {
  return LlmWikiRawSourceSchema.parse({
    source_type: "agent_output",
    source_id: candidate.candidate_id,
    source_ref: candidate.affected_pages[0] ?? null,
    content_hash: candidate.source_hashes[0],
    captured_at: new Date(0).toISOString(),
    immutable: true,
    source_of_truth: true,
    raw_mutation_supported: false,
  });
}

function titleForCandidate(candidate: KnowledgeCompoundingCandidate): string {
  return `Knowledge Compounding ${candidate.candidate_type.replaceAll(
    "_",
    " ",
  )}`;
}

function rejectedPlan(
  reason: CompoundingWikiBridgeReason,
): CompoundingWikiBridgePlan {
  return CompoundingWikiBridgePlanSchema.parse({
    bridge_version: COMPOUNDING_WIKI_BRIDGE_VERSION,
    llm_wiki_planner_version: LLM_WIKI_DRY_RUN_PLANNER_VERSION,
    accepted: false,
    recommendations: [],
    wiki_maintenance_plans: [],
    librarian_envelope_drafts: [],
    gateway_proposal_drafts: [],
    lint_findings: [],
    reasons: [reason],
    warnings: [
      "bridge_only_no_write_executed",
      "llm_wiki_planner_reused",
      "no_llm_calls",
      "no_vault_mutation",
    ],
    governance: governanceSummary(),
    write_attempted: false,
  });
}

function governanceSummary(): z.infer<
  typeof CompoundingWikiBridgePlanSchema
>["governance"] {
  return {
    write_attempted: false,
    vault_mutated: false,
    execution_authority: false,
    llm_calls_made: false,
    deepseek_calls_made: false,
    ollama_calls_made: false,
    network_used: false,
    scheduler_started: false,
    watcher_started: false,
    background_job_started: false,
  };
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}
