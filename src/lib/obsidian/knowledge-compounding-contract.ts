import { z } from "zod";
import { ApprovalIdSchema, ProposalIdSchema } from "../approval-runtime/types";
import {
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  VaultSensitivitySchema,
  type VaultFrontmatter,
} from "./frontmatter";
import {
  LIBRARIAN_CONTRACT_VERSION,
  LibrarianIngestionEnvelopeSchema,
  type LibrarianIngestionEnvelope,
} from "./librarian-contract";
import { routeVaultNote, slugPathSegment } from "./routing";

export const KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION =
  "phase21.knowledge-compounding-contract.v1" as const;

export const KNOWLEDGE_COMPOUNDING_CANDIDATE_TYPES = [
  "missing_hub",
  "sparse_hub",
  "fragmented_concept",
  "missing_backlinks",
  "weak_source_coverage",
  "duplicate_concept",
  "stale_wiki_page",
  "underlinked_system",
] as const;

export const KNOWLEDGE_COMPOUNDING_PROPOSED_ACTIONS = [
  "create_hub",
  "update_hub",
  "merge_pages",
  "create_backlinks",
  "refresh_stale_page",
] as const;

export const KNOWLEDGE_COMPOUNDING_DETECTION_INPUTS = [
  "references_count",
  "backlinks_count",
  "page_word_count",
  "source_count",
  "update_age_days",
  "duplicate_title_count",
  "hub_exists",
  "related_page_count",
] as const;

export const KNOWLEDGE_COMPOUNDING_GOVERNANCE_CONTRACT = {
  proposal_only: true,
  write_authority: false,
  execution_authority: false,
  approval_authority: false,
  scheduler_supported: false,
  watcher_supported: false,
  background_jobs_supported: false,
  network_supported: false,
  llm_calls_supported: false,
  obsidian_mutation_supported: false,
  bypass_librarian_supported: false,
  bypass_vault_write_gateway_supported: false,
  wiki_page_generation_supported: false,
} as const;

const ContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const IsoTimestampSchema = z.string().trim().datetime({ offset: true });

export const KnowledgeCompoundingCandidateTypeSchema = z.enum(
  KNOWLEDGE_COMPOUNDING_CANDIDATE_TYPES,
);

export const KnowledgeCompoundingProposedActionSchema = z.enum(
  KNOWLEDGE_COMPOUNDING_PROPOSED_ACTIONS,
);

export const KnowledgeCompoundingDetectionInputSchema = z.strictObject({
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
  references_count: z.number().int().nonnegative(),
  backlinks_count: z.number().int().nonnegative(),
  page_word_count: z.number().int().nonnegative(),
  source_count: z.number().int().nonnegative(),
  update_age_days: z.number().int().nonnegative(),
  duplicate_title_count: z.number().int().nonnegative(),
  hub_exists: z.boolean(),
  related_page_count: z.number().int().nonnegative(),
  source_ids: z.array(z.string().trim().min(1)).default([]),
  source_hashes: z.array(ContentHashSchema).default([]),
});

export const KnowledgeCompoundingCandidateSchema = z.strictObject({
  candidate_id: z.string().trim().min(1),
  candidate_type: KnowledgeCompoundingCandidateTypeSchema,
  affected_pages: z.array(z.string().trim().min(1)).min(1),
  supporting_sources: z.array(z.string().trim().min(1)).default([]),
  source_hashes: z.array(ContentHashSchema).default([]),
  detection_inputs: KnowledgeCompoundingDetectionInputSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
  proposed_action: KnowledgeCompoundingProposedActionSchema,
  write_attempted: z.literal(false),
});

export const KnowledgeCompoundingProposalSchema = z.strictObject({
  contract_version: z.literal(KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION),
  proposal_id: ProposalIdSchema,
  candidate_type: KnowledgeCompoundingCandidateTypeSchema,
  affected_pages: z.array(z.string().trim().min(1)).min(1),
  supporting_sources: z.array(z.string().trim().min(1)).min(1),
  source_hashes: z.array(ContentHashSchema).min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
  proposed_action: KnowledgeCompoundingProposedActionSchema,
  approval_required: z.boolean(),
  approval_status: z
    .enum(["not_required", "pending", "approved", "denied", "expired"])
    .default("pending"),
  approval_id: ApprovalIdSchema.nullable().default(null),
  sensitivity: VaultSensitivitySchema.default("private"),
  created_at: IsoTimestampSchema,
  durable_candidate: z.boolean().default(false),
  write_attempted: z.literal(false),
  execution_supported: z.literal(false),
});

export type KnowledgeCompoundingCandidateType = z.infer<
  typeof KnowledgeCompoundingCandidateTypeSchema
>;
export type KnowledgeCompoundingProposedAction = z.infer<
  typeof KnowledgeCompoundingProposedActionSchema
>;
export type KnowledgeCompoundingDetectionInput = z.infer<
  typeof KnowledgeCompoundingDetectionInputSchema
>;
export type KnowledgeCompoundingCandidate = z.infer<
  typeof KnowledgeCompoundingCandidateSchema
>;
export type KnowledgeCompoundingProposal = z.infer<
  typeof KnowledgeCompoundingProposalSchema
>;

export function detectKnowledgeCompoundingCandidates(
  inputs: readonly unknown[],
): KnowledgeCompoundingCandidate[] {
  return inputs.flatMap((input) => {
    const page = KnowledgeCompoundingDetectionInputSchema.parse(input);
    const candidates: KnowledgeCompoundingCandidate[] = [];

    if (!page.hub_exists && page.page_type !== "hub_page") {
      candidates.push(candidate(page, "missing_hub", "create_hub", 0.82));
    }
    if (page.page_type === "hub_page" && page.page_word_count < 250) {
      candidates.push(candidate(page, "sparse_hub", "update_hub", 0.74));
    }
    if (page.page_type === "concept_page" && page.related_page_count >= 3) {
      candidates.push(
        candidate(page, "fragmented_concept", "merge_pages", 0.68),
      );
    }
    if (page.backlinks_count === 0 && page.references_count > 0) {
      candidates.push(
        candidate(page, "missing_backlinks", "create_backlinks", 0.79),
      );
    }
    if (page.source_count < 2) {
      candidates.push(
        candidate(page, "weak_source_coverage", "refresh_stale_page", 0.64),
      );
    }
    if (page.duplicate_title_count > 0) {
      candidates.push(
        candidate(page, "duplicate_concept", "merge_pages", 0.8),
      );
    }
    if (page.update_age_days >= 180) {
      candidates.push(
        candidate(page, "stale_wiki_page", "refresh_stale_page", 0.7),
      );
    }
    if (page.page_type === "system_page" && page.backlinks_count < 2) {
      candidates.push(
        candidate(page, "underlinked_system", "create_backlinks", 0.76),
      );
    }

    return candidates;
  });
}

export function createKnowledgeCompoundingProposal(input: {
  readonly candidate: unknown;
  readonly proposal_id: `proposal:${string}`;
  readonly created_at: string;
  readonly durable_candidate?: boolean;
  readonly approval_status?: KnowledgeCompoundingProposal["approval_status"];
  readonly approval_id?: KnowledgeCompoundingProposal["approval_id"];
}): KnowledgeCompoundingProposal {
  const candidateInput = KnowledgeCompoundingCandidateSchema.parse(
    input.candidate,
  );
  const durable = input.durable_candidate ?? true;
  return KnowledgeCompoundingProposalSchema.parse({
    contract_version: KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION,
    proposal_id: input.proposal_id,
    candidate_type: candidateInput.candidate_type,
    affected_pages: candidateInput.affected_pages,
    supporting_sources: candidateInput.supporting_sources,
    source_hashes: candidateInput.source_hashes,
    confidence: candidateInput.confidence,
    rationale: candidateInput.rationale,
    proposed_action: candidateInput.proposed_action,
    approval_required: durable,
    approval_status: input.approval_status ?? "pending",
    approval_id: input.approval_id ?? null,
    sensitivity: "private",
    created_at: input.created_at,
    durable_candidate: durable,
    write_attempted: false,
    execution_supported: false,
  });
}

export function createKnowledgeCompoundingLibrarianEnvelope(
  input: unknown,
): LibrarianIngestionEnvelope {
  const proposal = KnowledgeCompoundingProposalSchema.parse(input);
  const frontmatter = knowledgeCompoundingFrontmatter(proposal);
  const route = routeVaultNote(frontmatter);

  return LibrarianIngestionEnvelopeSchema.parse({
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    envelope_id: `knowledge_compounding:${slugPathSegment(
      proposal.proposal_id,
    )}`,
    source: {
      source_type: "knowledge_compounding",
      source_id: proposal.proposal_id,
      source_ref: proposal.affected_pages[0] ?? null,
      captured_at: proposal.created_at,
      provenance_source_type: "system",
      content_hash: proposal.source_hashes[0],
    },
    proposed_frontmatter: frontmatter,
    declared_classification: proposal.durable_candidate
      ? "durable"
      : "candidate",
    requested_route_target: route.route_kind === "pending_approval"
      ? "inbox"
      : "wiki",
    requested_target_folder: route.folder,
    content_hash: proposal.source_hashes[0],
    body_ref: null,
    raw_body_included: false,
    received_at: proposal.created_at,
  });
}

function candidate(
  page: KnowledgeCompoundingDetectionInput,
  candidateType: KnowledgeCompoundingCandidateType,
  proposedAction: KnowledgeCompoundingProposedAction,
  confidence: number,
): KnowledgeCompoundingCandidate {
  return KnowledgeCompoundingCandidateSchema.parse({
    candidate_id: `kc:${slugPathSegment(`${candidateType}-${page.page_id}`)}`,
    candidate_type: candidateType,
    affected_pages: [page.page_id],
    supporting_sources: page.source_ids,
    source_hashes: page.source_hashes,
    detection_inputs: page,
    confidence,
    rationale: rationaleFor(candidateType, page),
    proposed_action: proposedAction,
    write_attempted: false,
  });
}

function rationaleFor(
  candidateType: KnowledgeCompoundingCandidateType,
  page: KnowledgeCompoundingDetectionInput,
): string {
  return `${candidateType} detected for ${page.page_id} using metadata-only signals.`;
}

function knowledgeCompoundingFrontmatter(
  proposal: KnowledgeCompoundingProposal,
): VaultFrontmatter {
  const approved = proposal.approval_status === "approved";
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: `note:${slugPathSegment(proposal.proposal_id)}`,
    title: `Knowledge Compounding: ${proposal.candidate_type}`,
    note_type: "decision",
    domain: "wiki",
    status: proposal.durable_candidate ? "active" : "candidate",
    created_at: proposal.created_at,
    updated_at: proposal.created_at,
    tags: ["knowledge-compounding", proposal.candidate_type],
    sensitivity: proposal.sensitivity,
    project: null,
    provenance: {
      source_type: "system",
      source_id: proposal.proposal_id,
      source_url: null,
      content_hash: proposal.source_hashes[0],
    },
    agent: {
      created_by: "knowledge-compounding",
      run_id: null,
      model_id: null,
      promotion_status: approved ? "human_approved" : "candidate",
    },
    links: {
      related: proposal.affected_pages,
      sources: proposal.supporting_sources,
      decisions: [],
    },
    lifecycle: {
      durable: proposal.durable_candidate && approved,
      canonical: false,
      approval_status: proposal.approval_status,
      approval_id: proposal.approval_id,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
  };
}
