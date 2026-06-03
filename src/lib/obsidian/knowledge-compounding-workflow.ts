import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";
import { ApprovalIdSchema, ProposalIdSchema } from "../approval-runtime/types";
import { VAULT_FRONTMATTER_SCHEMA_VERSION } from "./frontmatter";
import {
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  planVaultWriteProposalDryRun,
  type VaultWriteProposal,
} from "./write-gateway";

export const KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION =
  "phase21g.knowledge-compounding-workflow.v1" as const;

export const KNOWLEDGE_APPROVED_WRITE_EXECUTION_VERSION =
  "phase21g.knowledge-approved-write-execution.v1" as const;

export const KNOWLEDGE_HUB_REASONS = [
  "concept_cluster_detected",
  "high_cross_reference_count",
  "backlink_cluster_detected",
  "sparse_pages_detected",
  "missing_hub_detected",
] as const;

export const KNOWLEDGE_WRITE_EXECUTION_STATUSES = [
  "written",
  "rejected_by_policy",
  "deferred",
  "missing_vault_path",
  "path_escape_rejected",
  "writer_rejected",
  "writer_error",
] as const;

export const KNOWLEDGE_WRITE_APPROVAL_STATUSES = [
  "approved",
  "denied",
  "expired",
  "pending",
  "deferred",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(800);
const BoundedIdSchema = z.string().trim().min(1).max(220);
const RelativeVaultPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !value.startsWith("/") && !/^[a-zA-Z]:[\\/]/.test(value), {
    message: "Vault paths must be relative.",
  });

export const KnowledgeHubReasonSchema = z.enum(KNOWLEDGE_HUB_REASONS);
export const KnowledgeWriteExecutionStatusSchema = z.enum(
  KNOWLEDGE_WRITE_EXECUTION_STATUSES,
);
export const KnowledgeWriteExecutionApprovalStatusSchema = z.enum(
  KNOWLEDGE_WRITE_APPROVAL_STATUSES,
);

export const KnowledgeVaultPageMetadataSchema = z.strictObject({
  page_id: BoundedIdSchema,
  title: BoundedTextSchema,
  path: RelativeVaultPathSchema,
  note_type: z.enum([
    "hub",
    "concept",
    "system",
    "source",
    "decision",
    "project",
  ]),
  word_count: z.number().int().nonnegative(),
  cross_references: z.array(BoundedIdSchema).default([]),
  backlinks: z.array(BoundedIdSchema).default([]),
  concept_tags: z
    .array(z.string().trim().min(1).max(80).toLowerCase())
    .default([]),
  source_ids: z.array(BoundedIdSchema).default([]),
  existing_hub_path: RelativeVaultPathSchema.nullable().default(null),
  metadata_only: z.literal(true),
});

export const KnowledgeHubScoreSchema = z.strictObject({
  total_score: z.number().min(0),
  cross_reference_count: z.number().int().nonnegative(),
  backlink_count: z.number().int().nonnegative(),
  sparse_page_count: z.number().int().nonnegative(),
  cluster_size: z.number().int().positive(),
});

export const KnowledgeHubCandidateSchema = z.strictObject({
  candidate_id: BoundedIdSchema,
  hub_key: z.string().trim().min(1).max(120),
  proposed_hub_title: BoundedTextSchema,
  source_page_ids: z.array(BoundedIdSchema),
  source_paths: z.array(RelativeVaultPathSchema),
  score: KnowledgeHubScoreSchema,
  reasons: z.array(KnowledgeHubReasonSchema),
  rank: z.number().int().positive(),
  metadata_only: z.literal(true),
  model_call_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
});

export const KnowledgeHubSelectionSummarySchema = z.strictObject({
  workflow_version: z.literal(KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION),
  candidate_count: z.number().int().nonnegative(),
  selected_candidate_ids: z.array(BoundedIdSchema),
  top_candidate_id: BoundedIdSchema.nullable(),
  metadata_only: z.literal(true),
  deterministic: z.literal(true),
  model_call_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
});

export const KnowledgeDraftSourceSchema = z.strictObject({
  source_id: BoundedIdSchema,
  page_id: BoundedIdSchema,
  title: BoundedTextSchema,
  path: RelativeVaultPathSchema,
  snippet: BoundedTextSchema,
  source_hash: z.string().trim().min(1).max(120),
  metadata_only: z.literal(true),
});

export const KnowledgeDraftSectionSchema = z.strictObject({
  section_id: BoundedIdSchema,
  heading: BoundedTextSchema,
  body: BoundedTextSchema,
  source_ids: z.array(BoundedIdSchema).min(1),
  unsupported_claims: z.array(BoundedTextSchema),
  metadata_only: z.literal(true),
});

export const KnowledgeDraftSchema = z.strictObject({
  draft_id: BoundedIdSchema,
  workflow_version: z.literal(KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION),
  candidate: KnowledgeHubCandidateSchema,
  title: BoundedTextSchema,
  sections: z.array(KnowledgeDraftSectionSchema),
  sources: z.array(KnowledgeDraftSourceSchema),
  unsupported_claims_rejected: z.literal(true),
  external_knowledge_used: z.literal(false),
  model_call_attempted: z.literal(false),
  metadata_only: z.literal(true),
  write_attempted: z.literal(false),
});

export const KnowledgeDraftSummarySchema = z.strictObject({
  draft_id: BoundedIdSchema,
  title: BoundedTextSchema,
  section_count: z.number().int().nonnegative(),
  source_count: z.number().int().nonnegative(),
  source_paths: z.array(RelativeVaultPathSchema),
  unsupported_claim_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const KnowledgeWriteTargetSchema = z.strictObject({
  vault_path: RelativeVaultPathSchema,
  filename: z.string().trim().min(1).max(180),
  note_type: z.literal("hub"),
  overwrite_allowed: z.literal(false),
});

export const KnowledgeWriteApprovalBoundarySchema = z.strictObject({
  approval_required: z.literal(true),
  approval_status: z.literal("awaiting_human_approval"),
  approval_gate: z.literal("vault_write_gateway_required"),
  gateway_execution_attempted: z.literal(false),
  approval_execution_attempted: z.literal(false),
});

export const KnowledgeWritePlanSchema = z.strictObject({
  write_plan_id: BoundedIdSchema,
  workflow_version: z.literal(KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION),
  draft_id: BoundedIdSchema,
  target: KnowledgeWriteTargetSchema,
  source_attribution: z.array(KnowledgeDraftSourceSchema),
  approval_boundary: KnowledgeWriteApprovalBoundarySchema,
  reindex_required: z.literal(true),
  vault_write_attempted: z.literal(false),
  gateway_execution_attempted: z.literal(false),
  filesystem_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const KnowledgeWritePlanSummarySchema = z.strictObject({
  write_plan_id: BoundedIdSchema,
  target_path: RelativeVaultPathSchema,
  approval_required: z.literal(true),
  source_count: z.number().int().nonnegative(),
  reindex_required: z.literal(true),
  execution_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const KnowledgeReindexTargetSchema = z.strictObject({
  target_id: BoundedIdSchema,
  target_path: RelativeVaultPathSchema,
  target_kind: z.enum([
    "planned_hub",
    "source_page",
    "semantic_index",
    "wiki_index",
  ]),
  reason: z.string().trim().min(1).max(180),
  execution_attempted: z.literal(false),
});

export const KnowledgeReindexPlanSchema = z.strictObject({
  reindex_plan_id: BoundedIdSchema,
  workflow_version: z.literal(KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION),
  write_plan_id: BoundedIdSchema,
  targets: z.array(KnowledgeReindexTargetSchema),
  summary: z.strictObject({
    target_count: z.number().int().nonnegative(),
    semantic_reindex_required: z.literal(true),
    wiki_index_update_required: z.literal(true),
    execution_attempted: z.literal(false),
    filesystem_write_attempted: z.literal(false),
    database_write_attempted: z.literal(false),
    metadata_only: z.literal(true),
  }),
});

export const KnowledgeWriteExecutionApprovalSchema = z.strictObject({
  approval_id: ApprovalIdSchema.nullable(),
  approval_status: KnowledgeWriteExecutionApprovalStatusSchema,
  approved_target_path: RelativeVaultPathSchema.nullable().default(null),
  decided_at: z.string().trim().datetime({ offset: true }).nullable(),
});

export const KnowledgeApprovedVaultWriterResultSchema = z.strictObject({
  write_status: z.enum(["written", "rejected"]),
  target_path: RelativeVaultPathSchema,
  bytes_written: z.number().int().nonnegative(),
  content_hash: z
    .string()
    .trim()
    .regex(/^sha256:[a-f0-9]{64}$/),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const KnowledgeBoundedReindexRunMetadataSchema = z.strictObject({
  reindex_run_id: BoundedIdSchema,
  workflow_version: z.literal(KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION),
  write_plan_id: BoundedIdSchema,
  reindex_plan_id: BoundedIdSchema,
  status: z.literal("metadata_emitted_after_approved_write"),
  bounded: z.literal(true),
  max_targets: z.number().int().positive().max(20),
  target_count: z.number().int().nonnegative(),
  skipped_target_count: z.number().int().nonnegative(),
  target_paths: z.array(RelativeVaultPathSchema),
  execution_attempted: z.literal(true),
  filesystem_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_vault_body_included: z.literal(false),
});

export const KnowledgeWriteTelemetrySummarySchema = z.strictObject({
  metadata_only: z.literal(true),
  raw_draft_body_included: z.literal(false),
  raw_vault_body_included: z.literal(false),
  raw_writer_payload_included: z.literal(false),
  draft_section_count: z.number().int().nonnegative(),
  source_count: z.number().int().nonnegative(),
  markdown_body_char_count: z.number().int().nonnegative(),
});

export const KnowledgeApprovedWriteExecutionResultSchema = z.strictObject({
  execution_version: z.literal(KNOWLEDGE_APPROVED_WRITE_EXECUTION_VERSION),
  write_plan_id: BoundedIdSchema,
  draft_id: BoundedIdSchema,
  proposal_id: ProposalIdSchema,
  approval_id: ApprovalIdSchema.nullable(),
  target_path: RelativeVaultPathSchema.nullable(),
  write_status: KnowledgeWriteExecutionStatusSchema,
  writer_invoked: z.boolean(),
  vault_mutated: z.boolean(),
  bytes_written: z.number().int().nonnegative(),
  content_hash: z
    .string()
    .trim()
    .regex(/^sha256:[a-f0-9]{64}$/),
  reindex_plan: KnowledgeReindexPlanSchema.nullable(),
  reindex_run: KnowledgeBoundedReindexRunMetadataSchema.nullable(),
  telemetry: KnowledgeWriteTelemetrySummarySchema,
});

export const KnowledgeCompoundingCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION),
  title: z.literal(
    "Knowledge Compounding workflow complete through human approval boundary",
  ),
  status: z.literal("workflow_complete_through_human_approval_boundary"),
  components: z.array(BoundedTextSchema),
  governance: z.strictObject({
    no_vault_writes: z.literal(true),
    no_gateway_execution: z.literal(true),
    no_provider_model_calls: z.literal(true),
    no_deepseek_calls: z.literal(true),
    no_external_knowledge: z.literal(true),
    no_web_access: z.literal(true),
    no_network_calls: z.literal(true),
    no_filesystem_writes: z.literal(true),
    no_database_writes: z.literal(true),
    no_scheduler_execution: z.literal(true),
    no_approval_execution: z.literal(true),
    no_auto_write: z.literal(true),
    no_new_authority_surface: z.literal(true),
  }),
  readme_safe_wording: z.array(BoundedTextSchema),
});

export type KnowledgeVaultPageMetadata = z.infer<
  typeof KnowledgeVaultPageMetadataSchema
>;
export type KnowledgeHubReason = z.infer<typeof KnowledgeHubReasonSchema>;
export type KnowledgeWriteExecutionStatus = z.infer<
  typeof KnowledgeWriteExecutionStatusSchema
>;
export type KnowledgeWriteExecutionApprovalStatus = z.infer<
  typeof KnowledgeWriteExecutionApprovalStatusSchema
>;
export type KnowledgeHubScore = z.infer<typeof KnowledgeHubScoreSchema>;
export type KnowledgeHubCandidate = z.infer<typeof KnowledgeHubCandidateSchema>;
export type KnowledgeHubSelectionSummary = z.infer<
  typeof KnowledgeHubSelectionSummarySchema
>;
export type KnowledgeDraftSource = z.infer<typeof KnowledgeDraftSourceSchema>;
export type KnowledgeDraftSection = z.infer<typeof KnowledgeDraftSectionSchema>;
export type KnowledgeDraft = z.infer<typeof KnowledgeDraftSchema>;
export type KnowledgeDraftSummary = z.infer<typeof KnowledgeDraftSummarySchema>;
export type KnowledgeWriteTarget = z.infer<typeof KnowledgeWriteTargetSchema>;
export type KnowledgeWriteApprovalBoundary = z.infer<
  typeof KnowledgeWriteApprovalBoundarySchema
>;
export type KnowledgeWritePlan = z.infer<typeof KnowledgeWritePlanSchema>;
export type KnowledgeWritePlanSummary = z.infer<
  typeof KnowledgeWritePlanSummarySchema
>;
export type KnowledgeReindexTarget = z.infer<
  typeof KnowledgeReindexTargetSchema
>;
export type KnowledgeReindexPlan = z.infer<typeof KnowledgeReindexPlanSchema>;
export type KnowledgeWriteExecutionApproval = z.infer<
  typeof KnowledgeWriteExecutionApprovalSchema
>;
export type KnowledgeApprovedVaultWriterResult = z.infer<
  typeof KnowledgeApprovedVaultWriterResultSchema
>;
export type KnowledgeBoundedReindexRunMetadata = z.infer<
  typeof KnowledgeBoundedReindexRunMetadataSchema
>;
export type KnowledgeWriteTelemetrySummary = z.infer<
  typeof KnowledgeWriteTelemetrySummarySchema
>;
export type KnowledgeApprovedWriteExecutionResult = z.infer<
  typeof KnowledgeApprovedWriteExecutionResultSchema
>;
export type KnowledgeCompoundingCloseoutReport = z.infer<
  typeof KnowledgeCompoundingCloseoutReportSchema
>;

export interface KnowledgeApprovedVaultWriterInput {
  readonly proposal: VaultWriteProposal;
  readonly vault_root: string;
  readonly target_path: string;
  readonly resolved_target_path: string;
  readonly allow_overwrite: false;
}

export type KnowledgeApprovedVaultWriter = (
  input: KnowledgeApprovedVaultWriterInput,
) => Promise<KnowledgeApprovedVaultWriterResult>;

export interface ExecuteApprovedKnowledgeWriteInput {
  readonly draft: KnowledgeDraft;
  readonly writePlan: KnowledgeWritePlan;
  readonly approval: KnowledgeWriteExecutionApproval;
  readonly vaultRoot: string | null | undefined;
  readonly writer: KnowledgeApprovedVaultWriter;
  readonly maxReindexTargets?: number;
  readonly now?: string;
}

export function identifyKnowledgeHubCandidates(
  pages: readonly KnowledgeVaultPageMetadata[],
): KnowledgeHubCandidate[] {
  const parsed = pages.map((page) =>
    KnowledgeVaultPageMetadataSchema.parse(page),
  );
  const groups = new Map<string, KnowledgeVaultPageMetadata[]>();
  for (const page of parsed) {
    for (const tag of page.concept_tags) {
      groups.set(tag, [...(groups.get(tag) ?? []), page]);
    }
  }

  const candidates = [...groups.entries()]
    .filter(([, groupedPages]) => groupedPages.length >= 2)
    .map(([tag, groupedPages]) => candidateFor(tag, groupedPages))
    .filter((candidate) => candidate.score.total_score > 0);

  return rankKnowledgeHubCandidates(candidates);
}

export function rankKnowledgeHubCandidates(
  candidates: readonly KnowledgeHubCandidate[],
): KnowledgeHubCandidate[] {
  return candidates
    .map((candidate) => KnowledgeHubCandidateSchema.parse(candidate))
    .sort((left, right) => {
      if (right.score.total_score !== left.score.total_score) {
        return right.score.total_score - left.score.total_score;
      }
      return left.proposed_hub_title.localeCompare(right.proposed_hub_title);
    })
    .map((candidate, index) =>
      KnowledgeHubCandidateSchema.parse({ ...candidate, rank: index + 1 }),
    );
}

export function summarizeKnowledgeHubCandidates(
  candidates: readonly KnowledgeHubCandidate[],
): KnowledgeHubSelectionSummary {
  const ranked = rankKnowledgeHubCandidates(candidates);
  return KnowledgeHubSelectionSummarySchema.parse({
    workflow_version: KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION,
    candidate_count: ranked.length,
    selected_candidate_ids: ranked.map((candidate) => candidate.candidate_id),
    top_candidate_id: ranked[0]?.candidate_id ?? null,
    metadata_only: true,
    deterministic: true,
    model_call_attempted: false,
    vault_write_attempted: false,
  });
}

export function validateKnowledgeDraftSources(
  sources: readonly KnowledgeDraftSource[],
): boolean {
  return sources.every((source) => {
    const parsed = KnowledgeDraftSourceSchema.parse(source);
    return parsed.snippet.length > 0 && parsed.source_hash.length > 0;
  });
}

export function buildKnowledgeDraft(input: {
  readonly candidate: KnowledgeHubCandidate;
  readonly sources: readonly KnowledgeDraftSource[];
}): KnowledgeDraft {
  const candidate = KnowledgeHubCandidateSchema.parse(input.candidate);
  const sources = input.sources.map((source) =>
    KnowledgeDraftSourceSchema.parse(source),
  );
  if (!validateKnowledgeDraftSources(sources)) {
    throw new Error(
      "Knowledge draft sources must include snippets and hashes.",
    );
  }
  const sourceIds = sources.map((source) => source.source_id);

  return KnowledgeDraftSchema.parse({
    draft_id: `knowledge-draft:${candidate.hub_key}`,
    workflow_version: KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION,
    candidate,
    title: candidate.proposed_hub_title,
    sections: [
      {
        section_id: `knowledge-draft:${candidate.hub_key}:overview`,
        heading: "Overview",
        body: `This hub draft connects ${sources.length} supplied vault sources for ${candidate.proposed_hub_title}.`,
        source_ids: sourceIds,
        unsupported_claims: [],
        metadata_only: true,
      },
      {
        section_id: `knowledge-draft:${candidate.hub_key}:source-map`,
        heading: "Source Map",
        body: sources
          .map((source) => `${source.title}: ${source.snippet}`)
          .join(" | ")
          .slice(0, 800),
        source_ids: sourceIds,
        unsupported_claims: [],
        metadata_only: true,
      },
    ],
    sources,
    unsupported_claims_rejected: true,
    external_knowledge_used: false,
    model_call_attempted: false,
    metadata_only: true,
    write_attempted: false,
  });
}

export function summarizeKnowledgeDraft(
  draft: KnowledgeDraft,
): KnowledgeDraftSummary {
  const parsed = KnowledgeDraftSchema.parse(draft);
  return KnowledgeDraftSummarySchema.parse({
    draft_id: parsed.draft_id,
    title: parsed.title,
    section_count: parsed.sections.length,
    source_count: parsed.sources.length,
    source_paths: parsed.sources.map((source) => source.path).sort(),
    unsupported_claim_count: parsed.sections.reduce(
      (sum, section) => sum + section.unsupported_claims.length,
      0,
    ),
    metadata_only: true,
  });
}

export function buildKnowledgeWritePlan(
  draft: KnowledgeDraft,
): KnowledgeWritePlan {
  const parsed = KnowledgeDraftSchema.parse(draft);
  const filename = `${slug(parsed.candidate.hub_key)}.md`;
  const vaultPath = `10-wiki/hubs/${filename}`;

  return KnowledgeWritePlanSchema.parse({
    write_plan_id: `knowledge-write-plan:${parsed.candidate.hub_key}`,
    workflow_version: KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION,
    draft_id: parsed.draft_id,
    target: {
      vault_path: vaultPath,
      filename,
      note_type: "hub",
      overwrite_allowed: false,
    },
    source_attribution: parsed.sources,
    approval_boundary: {
      approval_required: true,
      approval_status: "awaiting_human_approval",
      approval_gate: "vault_write_gateway_required",
      gateway_execution_attempted: false,
      approval_execution_attempted: false,
    },
    reindex_required: true,
    vault_write_attempted: false,
    gateway_execution_attempted: false,
    filesystem_write_attempted: false,
    metadata_only: true,
  });
}

export function summarizeKnowledgeWritePlan(
  plan: KnowledgeWritePlan,
): KnowledgeWritePlanSummary {
  const parsed = KnowledgeWritePlanSchema.parse(plan);
  return KnowledgeWritePlanSummarySchema.parse({
    write_plan_id: parsed.write_plan_id,
    target_path: parsed.target.vault_path,
    approval_required: true,
    source_count: parsed.source_attribution.length,
    reindex_required: true,
    execution_attempted: false,
    metadata_only: true,
  });
}

export function buildKnowledgeReindexPlan(
  writePlan: KnowledgeWritePlan,
): KnowledgeReindexPlan {
  const parsed = KnowledgeWritePlanSchema.parse(writePlan);
  const targets = [
    {
      target_id: `reindex:planned-hub:${parsed.target.filename}`,
      target_path: parsed.target.vault_path,
      target_kind: "planned_hub" as const,
      reason: "planned_hub_requires_indexing_after_approval",
      execution_attempted: false,
    },
    ...parsed.source_attribution.map((source) => ({
      target_id: `reindex:source:${source.page_id}`,
      target_path: source.path,
      target_kind: "source_page" as const,
      reason: "source_page_backlinks_may_change_after_approval",
      execution_attempted: false,
    })),
    {
      target_id: "reindex:semantic-index",
      target_path: "derived-indexes/semantic",
      target_kind: "semantic_index" as const,
      reason: "semantic_index_refresh_required_after_hub_creation",
      execution_attempted: false,
    },
    {
      target_id: "reindex:wiki-index",
      target_path: "10-wiki/index.md",
      target_kind: "wiki_index" as const,
      reason: "wiki_index_update_required_after_hub_creation",
      execution_attempted: false,
    },
  ];

  return KnowledgeReindexPlanSchema.parse({
    reindex_plan_id: `knowledge-reindex-plan:${parsed.target.filename}`,
    workflow_version: KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION,
    write_plan_id: parsed.write_plan_id,
    targets,
    summary: {
      target_count: targets.length,
      semantic_reindex_required: true,
      wiki_index_update_required: true,
      execution_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      metadata_only: true,
    },
  });
}

export function buildBoundedKnowledgeReindexPlan(
  writePlan: KnowledgeWritePlan,
  maxTargets = 8,
): KnowledgeReindexPlan {
  const parsedMaxTargets = z
    .number()
    .int()
    .positive()
    .max(20)
    .parse(maxTargets);
  const plan = buildKnowledgeReindexPlan(writePlan);
  const targets = plan.targets.slice(0, parsedMaxTargets);

  return KnowledgeReindexPlanSchema.parse({
    ...plan,
    targets,
    summary: {
      ...plan.summary,
      target_count: targets.length,
    },
  });
}

export async function executeApprovedKnowledgeCompoundingWrite(
  input: ExecuteApprovedKnowledgeWriteInput,
): Promise<KnowledgeApprovedWriteExecutionResult> {
  const draft = KnowledgeDraftSchema.parse(input.draft);
  const writePlan = KnowledgeWritePlanSchema.parse(input.writePlan);
  const approval = KnowledgeWriteExecutionApprovalSchema.parse(input.approval);
  const maxReindexTargets = z
    .number()
    .int()
    .positive()
    .max(20)
    .parse(input.maxReindexTargets ?? 8);
  const markdownBody = renderKnowledgeDraftMarkdown(draft);
  const contentHash = sha256(markdownBody);

  if (draft.draft_id !== writePlan.draft_id) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "rejected_by_policy",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  if (approval.approval_status === "deferred") {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "deferred",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  if (approval.approval_status !== "approved" || !approval.approval_id) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "rejected_by_policy",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  if (
    approval.approved_target_path &&
    approval.approved_target_path !== writePlan.target.vault_path
  ) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "rejected_by_policy",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  const vaultRoot = input.vaultRoot?.trim();
  if (!vaultRoot) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "missing_vault_path",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  const target = resolveKnowledgeVaultTarget(
    vaultRoot,
    writePlan.target.vault_path,
  );
  if (!target) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "path_escape_rejected",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  const proposal = buildKnowledgeGatewayProposal({
    draft,
    writePlan,
    approval,
    markdownBody,
    contentHash,
    createdAt: input.now ?? approval.decided_at ?? new Date(0).toISOString(),
  });
  const dryRun = planVaultWriteProposalDryRun(proposal);
  if (
    !dryRun.accepted ||
    dryRun.state !== "ready_to_write" ||
    dryRun.target_path !== writePlan.target.vault_path
  ) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "rejected_by_policy",
      writerInvoked: false,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  let writerResult: KnowledgeApprovedVaultWriterResult;
  try {
    writerResult = KnowledgeApprovedVaultWriterResultSchema.parse(
      await input.writer({
        proposal,
        vault_root: vaultRoot,
        target_path: writePlan.target.vault_path,
        resolved_target_path: target.resolvedTargetPath,
        allow_overwrite: false,
      }),
    );
  } catch {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "writer_error",
      writerInvoked: true,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  if (
    writerResult.write_status !== "written" ||
    writerResult.target_path !== writePlan.target.vault_path ||
    writerResult.content_hash !== contentHash
  ) {
    return knowledgeWriteExecutionResult({
      draft,
      writePlan,
      approval,
      status: "writer_rejected",
      writerInvoked: true,
      vaultMutated: false,
      bytesWritten: 0,
      contentHash,
      reindexPlan: null,
      reindexRun: null,
      markdownBody,
    });
  }

  const reindexPlan = buildBoundedKnowledgeReindexPlan(
    writePlan,
    maxReindexTargets,
  );
  const unboundedPlan = buildKnowledgeReindexPlan(writePlan);
  const reindexRun = KnowledgeBoundedReindexRunMetadataSchema.parse({
    reindex_run_id: `knowledge-reindex-run:${slug(writePlan.write_plan_id)}`,
    workflow_version: KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION,
    write_plan_id: writePlan.write_plan_id,
    reindex_plan_id: reindexPlan.reindex_plan_id,
    status: "metadata_emitted_after_approved_write",
    bounded: true,
    max_targets: maxReindexTargets,
    target_count: reindexPlan.targets.length,
    skipped_target_count: Math.max(
      0,
      unboundedPlan.targets.length - reindexPlan.targets.length,
    ),
    target_paths: reindexPlan.targets.map((target) => target.target_path),
    execution_attempted: true,
    filesystem_write_attempted: false,
    database_write_attempted: false,
    metadata_only: true,
    raw_vault_body_included: false,
  });

  return knowledgeWriteExecutionResult({
    draft,
    writePlan,
    approval,
    status: "written",
    writerInvoked: true,
    vaultMutated: true,
    bytesWritten: writerResult.bytes_written,
    contentHash,
    reindexPlan,
    reindexRun,
    markdownBody,
  });
}

export function buildKnowledgeCompoundingCloseoutReport(): KnowledgeCompoundingCloseoutReport {
  return KnowledgeCompoundingCloseoutReportSchema.parse({
    closeout_version: KNOWLEDGE_COMPOUNDING_WORKFLOW_VERSION,
    title:
      "Knowledge Compounding workflow complete through human approval boundary",
    status: "workflow_complete_through_human_approval_boundary",
    components: [
      "hub_candidate_selection",
      "candidate_ranking",
      "vault_sourced_draft_generation",
      "source_attribution",
      "approval_gated_write_planning",
      "reindex_planning",
    ],
    governance: {
      no_vault_writes: true,
      no_gateway_execution: true,
      no_provider_model_calls: true,
      no_deepseek_calls: true,
      no_external_knowledge: true,
      no_web_access: true,
      no_network_calls: true,
      no_filesystem_writes: true,
      no_database_writes: true,
      no_scheduler_execution: true,
      no_approval_execution: true,
      no_auto_write: true,
      no_new_authority_surface: true,
    },
    readme_safe_wording: [
      "Knowledge Compounding workflow complete through human approval boundary.",
      "It supports hub candidate selection, vault-sourced drafts, write planning, and re-index planning without mutating the vault.",
      "Actual vault writes, automatic wiki creation, scheduler-driven mutation, and autonomous knowledge growth remain future work.",
    ],
  });
}

function candidateFor(
  hubKey: string,
  pages: readonly KnowledgeVaultPageMetadata[],
): KnowledgeHubCandidate {
  const crossReferenceCount = pages.reduce(
    (sum, page) => sum + page.cross_references.length,
    0,
  );
  const backlinkCount = pages.reduce(
    (sum, page) => sum + page.backlinks.length,
    0,
  );
  const sparsePageCount = pages.filter((page) => page.word_count < 250).length;
  const missingHub = pages.every((page) => !page.existing_hub_path);
  const totalScore =
    pages.length * 3 +
    crossReferenceCount +
    backlinkCount +
    sparsePageCount * 2;
  const reasons = [
    "concept_cluster_detected" as const,
    ...(crossReferenceCount >= 4
      ? ["high_cross_reference_count" as const]
      : []),
    ...(backlinkCount >= 2 ? ["backlink_cluster_detected" as const] : []),
    ...(sparsePageCount > 0 ? ["sparse_pages_detected" as const] : []),
    ...(missingHub ? ["missing_hub_detected" as const] : []),
  ];

  return KnowledgeHubCandidateSchema.parse({
    candidate_id: `knowledge-hub:${slug(hubKey)}`,
    hub_key: slug(hubKey),
    proposed_hub_title: titleCase(hubKey),
    source_page_ids: pages.map((page) => page.page_id).sort(),
    source_paths: pages.map((page) => page.path).sort(),
    score: {
      total_score: totalScore,
      cross_reference_count: crossReferenceCount,
      backlink_count: backlinkCount,
      sparse_page_count: sparsePageCount,
      cluster_size: pages.length,
    },
    reasons,
    rank: 1,
    metadata_only: true,
    model_call_attempted: false,
    vault_write_attempted: false,
  });
}

function buildKnowledgeGatewayProposal(input: {
  readonly draft: KnowledgeDraft;
  readonly writePlan: KnowledgeWritePlan;
  readonly approval: KnowledgeWriteExecutionApproval;
  readonly markdownBody: string;
  readonly contentHash: string;
  readonly createdAt: string;
}): VaultWriteProposal {
  const approvalId = ApprovalIdSchema.parse(input.approval.approval_id);
  const frontmatter = {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: `note:${slug(input.draft.draft_id)}`,
    title: input.draft.title,
    note_type: "hub" as const,
    domain: "wiki" as const,
    status: "active" as const,
    created_at: input.createdAt,
    updated_at: input.createdAt,
    tags: ["knowledge-compounding", "hub"],
    sensitivity: "private" as const,
    project: null,
    provenance: {
      source_type: "agent" as const,
      source_id: input.draft.draft_id,
      source_url: null,
      content_hash: input.contentHash,
    },
    agent: {
      created_by: "knowledge-compounding",
      run_id: input.writePlan.write_plan_id,
      model_id: null,
      promotion_status: "human_approved" as const,
    },
    links: {
      related: input.draft.candidate.source_page_ids,
      sources: input.draft.sources.map((source) => source.source_id),
      decisions: [approvalId],
    },
    lifecycle: {
      durable: true,
      canonical: false,
      approval_status: "approved" as const,
      approval_id: approvalId,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
  };

  return {
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    proposal_id: `proposal:${slug(input.writePlan.write_plan_id)}`,
    note_type: "hub",
    target_path: input.writePlan.target.vault_path,
    frontmatter,
    markdown_body: input.markdownBody,
    provenance: frontmatter.provenance,
    proposing_agent: {
      agent_id: "knowledge-compounding",
      agent_kind: "knowledge-compounding",
      run_id: input.writePlan.write_plan_id,
    },
    approval_required: true,
    approval_status: "approved",
    approval_id: approvalId,
    sensitivity: "private",
    content_hash: input.contentHash,
    created_at: input.createdAt,
  };
}

function renderKnowledgeDraftMarkdown(draft: KnowledgeDraft): string {
  const sections = draft.sections
    .map((section) => `## ${section.heading}\n\n${section.body.trim()}`)
    .join("\n\n");
  const sources = draft.sources
    .map((source) => `- ${source.title} (${source.path})`)
    .join("\n");

  return `# ${draft.title}\n\n${sections}\n\n## Sources\n\n${sources}`.trim();
}

function resolveKnowledgeVaultTarget(
  vaultRoot: string,
  targetPath: string,
): {
  readonly resolvedVaultRoot: string;
  readonly resolvedTargetPath: string;
} | null {
  if (!isAbsolute(vaultRoot)) return null;
  if (
    isAbsolute(targetPath) ||
    targetPath.includes("\\") ||
    targetPath.split("/").includes("..") ||
    !targetPath.endsWith(".md")
  ) {
    return null;
  }

  const resolvedVaultRoot = resolve(vaultRoot);
  const resolvedTargetPath = resolve(resolvedVaultRoot, targetPath);
  const relativePath = relative(resolvedVaultRoot, resolvedTargetPath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    return null;
  }

  return { resolvedVaultRoot, resolvedTargetPath };
}

function knowledgeWriteExecutionResult(input: {
  readonly draft: KnowledgeDraft;
  readonly writePlan: KnowledgeWritePlan;
  readonly approval: KnowledgeWriteExecutionApproval;
  readonly status: KnowledgeWriteExecutionStatus;
  readonly writerInvoked: boolean;
  readonly vaultMutated: boolean;
  readonly bytesWritten: number;
  readonly contentHash: string;
  readonly reindexPlan: KnowledgeReindexPlan | null;
  readonly reindexRun: KnowledgeBoundedReindexRunMetadata | null;
  readonly markdownBody: string;
}): KnowledgeApprovedWriteExecutionResult {
  return KnowledgeApprovedWriteExecutionResultSchema.parse({
    execution_version: KNOWLEDGE_APPROVED_WRITE_EXECUTION_VERSION,
    write_plan_id: input.writePlan.write_plan_id,
    draft_id: input.draft.draft_id,
    proposal_id: `proposal:${slug(input.writePlan.write_plan_id)}`,
    approval_id: input.approval.approval_id,
    target_path: input.writePlan.target.vault_path,
    write_status: input.status,
    writer_invoked: input.writerInvoked,
    vault_mutated: input.vaultMutated,
    bytes_written: input.bytesWritten,
    content_hash: input.contentHash,
    reindex_plan: input.reindexPlan,
    reindex_run: input.reindexRun,
    telemetry: {
      metadata_only: true,
      raw_draft_body_included: false,
      raw_vault_body_included: false,
      raw_writer_payload_included: false,
      draft_section_count: input.draft.sections.length,
      source_count: input.draft.sources.length,
      markdown_body_char_count: input.markdownBody.length,
    },
  });
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
