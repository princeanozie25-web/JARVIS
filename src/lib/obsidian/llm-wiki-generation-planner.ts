import { z } from "zod";
import {
  KnowledgeCompoundingProposalSchema,
  type KnowledgeCompoundingProposal,
} from "./knowledge-compounding-contract";
import {
  LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE,
  LlmWikiRawSourceSchema,
  type LlmWikiPageType,
} from "./llm-wiki-contract";
import {
  planLlmWikiMaintenanceDryRun,
  type LlmWikiMaintenanceDryRunPlan,
  type LlmWikiSnapshot,
} from "./llm-wiki-dry-run-planner";
import { slugPathSegment } from "./routing";
import { VAULT_LLM_WIKI_ROUTE_SUBFOLDERS } from "./taxonomy";

export const LLM_WIKI_GENERATION_PLANNER_VERSION =
  "phase21.llm-wiki-generation-planner.v1" as const;

export const LLM_WIKI_GENERATION_SCOPES = [
  "create_new_page",
  "update_existing_page",
  "merge_pages",
  "refresh_page",
  "create_hub",
  "create_backlinks",
] as const;

export const LLM_WIKI_GENERATION_PLANNER_REASONS = [
  "accepted",
  "input_invalid",
  "source_coverage_sufficient",
  "source_coverage_weak",
  "conflicting_sources",
  "unsupported_synthesis",
  "maintenance_plan_rejected",
  "gateway_body_not_generated",
] as const;

export const LLM_WIKI_GENERATION_PLANNER_WARNINGS = [
  "planning_only_no_text_generated",
  "dry_run_only_no_write_executed",
  "librarian_compatible_draft_only",
  "gateway_compatible_without_execution",
  "approval_required_before_write",
  "weak_source_coverage",
  "conflicting_sources_flagged",
] as const;

const ContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const SourceMetadataSchema = z.strictObject({
  source_id: z.string().trim().min(1),
  source_type: z.string().trim().min(1),
  content_hash: ContentHashSchema,
  path: z.string().trim().min(1).nullable().default(null),
  captured_at: z.string().trim().datetime({ offset: true }).nullable(),
});

const SourceMetadataSnapshotSchema = z.strictObject({
  sources: z.array(SourceMetadataSchema).default([]),
});

export const LlmWikiGenerationScopeSchema = z.enum(LLM_WIKI_GENERATION_SCOPES);

export const LlmWikiGenerationPlannerInputSchema = z.strictObject({
  proposal: KnowledgeCompoundingProposalSchema,
  wiki_metadata_snapshot: z.strictObject({
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
          source_hashes: z.array(ContentHashSchema).default([]),
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
  }),
  source_metadata_snapshot: SourceMetadataSnapshotSchema.default({
    sources: [],
  }),
});

export const LlmWikiGenerationSourceCoverageSchema = z.strictObject({
  sufficient_source_coverage: z.boolean(),
  weak_source_coverage: z.boolean(),
  unsupported_synthesis: z.boolean(),
  conflicting_sources: z.boolean(),
  source_count: z.number().int().nonnegative(),
  source_hash_count: z.number().int().nonnegative(),
  required_source_ids: z.array(z.string().trim().min(1)),
  required_source_hashes: z.array(ContentHashSchema),
});

export const LlmWikiPageDraftPlanSchema = z.strictObject({
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
  target_path: z.string().trim().min(1),
  title: z.string().trim().min(1),
  generation_scope: LlmWikiGenerationScopeSchema,
  source_ids: z.array(z.string().trim().min(1)),
  source_hashes: z.array(ContentHashSchema),
  text_generation_supported: z.literal(false),
  markdown_body_generated: z.literal(false),
  write_attempted: z.literal(false),
});

export const LlmWikiGenerationGatewayCompatibilitySchema = z.strictObject({
  compatible_with_gateway_contract: z.boolean(),
  gateway_proposal_draft_available: z.boolean(),
  gateway_body_required: z.literal(true),
  target_path: z.string().trim().min(1),
  note_type: z.string().trim().min(1),
  approval_required: z.boolean(),
  execution_supported: z.literal(false),
});

export const LlmWikiGenerationPlanSchema = z.strictObject({
  planner_version: z.literal(LLM_WIKI_GENERATION_PLANNER_VERSION),
  accepted: z.boolean(),
  proposal_id: z.string().trim().min(1).nullable(),
  generation_scope: LlmWikiGenerationScopeSchema.nullable(),
  page_type: z
    .enum([
      "hub_page",
      "concept_page",
      "system_page",
      "person_page",
      "project_page",
      "source_page",
      "decision_page",
      "comparison_page",
      "synthesis_page",
    ])
    .nullable(),
  target_location: z.string().trim().min(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  approval_required: z.boolean(),
  required_source_set: z.array(SourceMetadataSchema),
  source_coverage: LlmWikiGenerationSourceCoverageSchema.nullable(),
  page_plan: LlmWikiPageDraftPlanSchema.nullable(),
  wiki_maintenance_plan: z.unknown().nullable(),
  librarian_envelope_draft: z.unknown().nullable(),
  librarian_dry_run_plan: z.unknown().nullable(),
  gateway_proposal_draft: z.null(),
  gateway_compatibility: LlmWikiGenerationGatewayCompatibilitySchema.nullable(),
  reasons: z.array(z.enum(LLM_WIKI_GENERATION_PLANNER_REASONS)),
  warnings: z.array(z.enum(LLM_WIKI_GENERATION_PLANNER_WARNINGS)),
  governance: z.strictObject({
    text_generated: z.literal(false),
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

export type LlmWikiGenerationScope = z.infer<
  typeof LlmWikiGenerationScopeSchema
>;
export type LlmWikiGenerationPlannerInput = z.infer<
  typeof LlmWikiGenerationPlannerInputSchema
>;
export type LlmWikiGenerationSourceCoverage = z.infer<
  typeof LlmWikiGenerationSourceCoverageSchema
>;
export type LlmWikiPageDraftPlan = z.infer<typeof LlmWikiPageDraftPlanSchema>;
export type LlmWikiGenerationGatewayCompatibility = z.infer<
  typeof LlmWikiGenerationGatewayCompatibilitySchema
>;
export type LlmWikiGenerationPlan = z.infer<typeof LlmWikiGenerationPlanSchema>;
export type LlmWikiGenerationPlannerReason =
  (typeof LLM_WIKI_GENERATION_PLANNER_REASONS)[number];
export type LlmWikiGenerationPlannerWarning =
  (typeof LLM_WIKI_GENERATION_PLANNER_WARNINGS)[number];

export function planLlmWikiGeneration(input: unknown): LlmWikiGenerationPlan {
  const parsed = LlmWikiGenerationPlannerInputSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedPlan("input_invalid");
  }

  const request = parsed.data;
  const proposal = request.proposal;
  const scope = generationScopeForProposal(proposal);
  const pageType = pageTypeForProposal(proposal);
  const targetPath = targetPathForProposal(proposal, pageType);
  const coverage = sourceCoverage(proposal, request.source_metadata_snapshot);
  const maintenancePlan = planMaintenance(proposal, request, pageType);
  const pagePlan = pageDraftPlan(
    proposal,
    scope,
    pageType,
    targetPath,
    coverage,
  );
  const reasons: LlmWikiGenerationPlannerReason[] = [];
  const warnings: LlmWikiGenerationPlannerWarning[] = [
    "planning_only_no_text_generated",
    "dry_run_only_no_write_executed",
    "librarian_compatible_draft_only",
    "gateway_compatible_without_execution",
  ];

  if (coverage.sufficient_source_coverage) {
    reasons.push("source_coverage_sufficient");
  }
  if (coverage.weak_source_coverage) {
    reasons.push("source_coverage_weak");
    warnings.push("weak_source_coverage");
  }
  if (coverage.conflicting_sources) {
    reasons.push("conflicting_sources");
    warnings.push("conflicting_sources_flagged");
  }
  if (coverage.unsupported_synthesis) {
    reasons.push("unsupported_synthesis");
  }
  if (!maintenancePlan.accepted) {
    reasons.push("maintenance_plan_rejected");
  }
  if (proposal.approval_required) {
    warnings.push("approval_required_before_write");
  }
  reasons.push("gateway_body_not_generated");

  const blockingReasons = reasons.filter((reason) =>
    [
      "unsupported_synthesis",
      "conflicting_sources",
      "maintenance_plan_rejected",
    ].includes(reason),
  );

  return LlmWikiGenerationPlanSchema.parse({
    planner_version: LLM_WIKI_GENERATION_PLANNER_VERSION,
    accepted: blockingReasons.length === 0,
    proposal_id: proposal.proposal_id,
    generation_scope: scope,
    page_type: pageType,
    target_location: targetPath,
    confidence: proposal.confidence,
    approval_required: proposal.approval_required,
    required_source_set: requiredSources(
      proposal,
      request.source_metadata_snapshot,
    ),
    source_coverage: coverage,
    page_plan: pagePlan,
    wiki_maintenance_plan: maintenancePlan,
    librarian_envelope_draft:
      maintenancePlan.librarian_envelope_drafts[0] ?? null,
    librarian_dry_run_plan: maintenancePlan.librarian_dry_run_plans[0] ?? null,
    gateway_proposal_draft: null,
    gateway_compatibility: {
      compatible_with_gateway_contract: true,
      gateway_proposal_draft_available: false,
      gateway_body_required: true,
      target_path: targetPath,
      note_type: LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE[pageType],
      approval_required: proposal.approval_required,
      execution_supported: false,
    },
    reasons: unique(reasons.length > 0 ? reasons : ["accepted"]),
    warnings: unique(warnings),
    governance: governanceSummary(),
    write_attempted: false,
  });
}

function generationScopeForProposal(
  proposal: KnowledgeCompoundingProposal,
): LlmWikiGenerationScope {
  if (proposal.proposed_action === "create_hub") return "create_hub";
  if (proposal.proposed_action === "merge_pages") return "merge_pages";
  if (proposal.proposed_action === "refresh_stale_page") return "refresh_page";
  if (proposal.proposed_action === "create_backlinks") {
    return "create_backlinks";
  }
  if (proposal.proposed_action === "update_hub") {
    return existingPageId(proposal)
      ? "update_existing_page"
      : "create_new_page";
  }
  return "create_new_page";
}

function pageTypeForProposal(
  proposal: KnowledgeCompoundingProposal,
): LlmWikiPageType {
  if (
    proposal.proposed_action === "create_hub" ||
    proposal.proposed_action === "update_hub"
  ) {
    return "hub_page";
  }
  if (proposal.candidate_type === "underlinked_system") return "system_page";
  return "concept_page";
}

function targetPathForProposal(
  proposal: KnowledgeCompoundingProposal,
  pageType: LlmWikiPageType,
): string {
  const existing = existingPageId(proposal);
  if (
    existing &&
    proposal.proposed_action !== "create_hub" &&
    proposal.proposed_action !== "merge_pages"
  ) {
    return `${folderForPageType(pageType)}/${slugPathSegment(existing)}.md`;
  }
  return `${folderForPageType(pageType)}/${slugPathSegment(
    titleForProposal(proposal, pageType),
  )}.md`;
}

function folderForPageType(pageType: LlmWikiPageType): string {
  const noteType = LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE[pageType];
  return `10-wiki/${VAULT_LLM_WIKI_ROUTE_SUBFOLDERS[noteType]}`;
}

function sourceCoverage(
  proposal: KnowledgeCompoundingProposal,
  sourceSnapshot: z.infer<typeof SourceMetadataSnapshotSchema>,
): LlmWikiGenerationSourceCoverage {
  const sourceIds = unique(proposal.supporting_sources);
  const hashes = unique(proposal.source_hashes);
  const conflictingSources = hasConflictingSources(sourceSnapshot);
  const sourceCount = sourceIds.length;
  const hashCount = hashes.length;
  const weak = sourceCount < 2 || hashCount < 2;
  const synthesisScope =
    proposal.proposed_action === "merge_pages" ||
    proposal.proposed_action === "refresh_stale_page";

  return LlmWikiGenerationSourceCoverageSchema.parse({
    sufficient_source_coverage: !weak && !conflictingSources,
    weak_source_coverage: weak,
    unsupported_synthesis: synthesisScope && weak,
    conflicting_sources: conflictingSources,
    source_count: sourceCount,
    source_hash_count: hashCount,
    required_source_ids: sourceIds,
    required_source_hashes: hashes,
  });
}

function requiredSources(
  proposal: KnowledgeCompoundingProposal,
  sourceSnapshot: z.infer<typeof SourceMetadataSnapshotSchema>,
): z.infer<typeof SourceMetadataSchema>[] {
  const sourceById = new Map(
    sourceSnapshot.sources.map((source) => [source.source_id, source]),
  );
  return proposal.supporting_sources.map((sourceId, index) => {
    const existing = sourceById.get(sourceId);
    if (existing) return existing;
    return SourceMetadataSchema.parse({
      source_id: sourceId,
      source_type: "unknown",
      content_hash: proposal.source_hashes[index] ?? proposal.source_hashes[0],
      path: null,
      captured_at: proposal.created_at,
    });
  });
}

function planMaintenance(
  proposal: KnowledgeCompoundingProposal,
  request: LlmWikiGenerationPlannerInput,
  pageType: LlmWikiPageType,
): LlmWikiMaintenanceDryRunPlan {
  const source = LlmWikiRawSourceSchema.parse({
    source_type: "agent_output",
    source_id: proposal.proposal_id,
    source_ref: proposal.affected_pages[0] ?? null,
    content_hash: proposal.source_hashes[0],
    captured_at: proposal.created_at,
    immutable: true,
    source_of_truth: true,
    raw_mutation_supported: false,
  });

  return planLlmWikiMaintenanceDryRun({
    source_envelope: source,
    existing_wiki_snapshot:
      request.wiki_metadata_snapshot satisfies LlmWikiSnapshot,
    requested_operation: "update_entity_concept_pages",
    page_preference: {
      page_type: pageType,
      title: titleForProposal(proposal, pageType),
      durable_requested: proposal.durable_candidate,
      approval_status: proposal.approval_status,
      approval_id: proposal.approval_id,
      synthesis_supported: true,
    },
    include_gateway_proposal_draft: false,
    proposal_markdown_body: null,
  });
}

function pageDraftPlan(
  proposal: KnowledgeCompoundingProposal,
  scope: LlmWikiGenerationScope,
  pageType: LlmWikiPageType,
  targetPath: string,
  coverage: LlmWikiGenerationSourceCoverage,
): LlmWikiPageDraftPlan {
  return LlmWikiPageDraftPlanSchema.parse({
    page_id: `llm-wiki:${slugPathSegment(titleForProposal(proposal, pageType))}`,
    page_type: pageType,
    target_path: targetPath,
    title: titleForProposal(proposal, pageType),
    generation_scope: scope,
    source_ids: coverage.required_source_ids,
    source_hashes: coverage.required_source_hashes,
    text_generation_supported: false,
    markdown_body_generated: false,
    write_attempted: false,
  });
}

function titleForProposal(
  proposal: KnowledgeCompoundingProposal,
  pageType: LlmWikiPageType,
): string {
  const affected = existingPageId(proposal);
  if (proposal.proposed_action === "create_hub") {
    return `Hub for ${readableName(affected ?? proposal.candidate_type)}`;
  }
  if (proposal.proposed_action === "merge_pages") {
    return `Merged ${readableName(affected ?? proposal.candidate_type)}`;
  }
  if (pageType === "system_page") {
    return `System Links for ${readableName(affected ?? proposal.candidate_type)}`;
  }
  return readableName(affected ?? proposal.candidate_type);
}

function readableName(value: string): string {
  const last = value.split(":").at(-1) ?? value;
  return last
    .replace(/[._/-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function existingPageId(proposal: KnowledgeCompoundingProposal): string | null {
  return proposal.affected_pages[0] ?? null;
}

function hasConflictingSources(
  sourceSnapshot: z.infer<typeof SourceMetadataSnapshotSchema>,
): boolean {
  const hashesBySource = new Map<string, Set<string>>();
  for (const source of sourceSnapshot.sources) {
    const hashes = hashesBySource.get(source.source_id) ?? new Set<string>();
    hashes.add(source.content_hash);
    hashesBySource.set(source.source_id, hashes);
  }
  return Array.from(hashesBySource.values()).some((hashes) => hashes.size > 1);
}

function governanceSummary(): z.infer<
  typeof LlmWikiGenerationPlanSchema
>["governance"] {
  return {
    text_generated: false,
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

function rejectedPlan(
  reason: LlmWikiGenerationPlannerReason,
): LlmWikiGenerationPlan {
  return LlmWikiGenerationPlanSchema.parse({
    planner_version: LLM_WIKI_GENERATION_PLANNER_VERSION,
    accepted: false,
    proposal_id: null,
    generation_scope: null,
    page_type: null,
    target_location: null,
    confidence: null,
    approval_required: true,
    required_source_set: [],
    source_coverage: null,
    page_plan: null,
    wiki_maintenance_plan: null,
    librarian_envelope_draft: null,
    librarian_dry_run_plan: null,
    gateway_proposal_draft: null,
    gateway_compatibility: null,
    reasons: [reason],
    warnings: [
      "planning_only_no_text_generated",
      "dry_run_only_no_write_executed",
    ],
    governance: governanceSummary(),
    write_attempted: false,
  });
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}
