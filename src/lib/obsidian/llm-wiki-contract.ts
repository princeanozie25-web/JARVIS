import { z } from "zod";
import { ApprovalIdSchema } from "../approval-runtime/types";
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
import {
  VAULT_LLM_WIKI_NOTE_TYPES,
  VAULT_LLM_WIKI_ROUTE_SUBFOLDERS,
  type VaultLlmWikiNoteType,
} from "./taxonomy";

export const LLM_WIKI_CONTRACT_VERSION =
  "phase21.llm-wiki-contract.v1" as const;

export const LLM_WIKI_PATTERN_SOURCE_URL =
  "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f" as const;

export const LLM_WIKI_RAW_SOURCE_TYPES = [
  "user_note",
  "imported_document",
  "external_research",
  "gitnexus",
  "agent_output",
] as const;

export const LLM_WIKI_PAGE_TYPES = [
  "hub_page",
  "concept_page",
  "system_page",
  "person_page",
  "project_page",
  "source_page",
  "decision_page",
  "comparison_page",
  "synthesis_page",
] as const;

export const LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE = {
  hub_page: "hub",
  concept_page: "concept",
  system_page: "system",
  person_page: "person",
  project_page: "project",
  source_page: "source",
  decision_page: "decision",
  comparison_page: "comparison",
  synthesis_page: "synthesis",
} as const;

export const LLM_WIKI_SPECIAL_FILES = [
  {
    kind: "index",
    path: "10-wiki/index.md",
    orientation: "content",
    future_write_model: "update",
    write_supported: false,
  },
  {
    kind: "log",
    path: "10-wiki/log.md",
    orientation: "chronological",
    future_write_model: "append_only",
    write_supported: false,
  },
] as const;

export const LLM_WIKI_MAINTENANCE_OPERATIONS = [
  "ingest_source",
  "update_entity_concept_pages",
  "update_index",
  "append_log_entry",
  "answer_query",
  "file_useful_answer_back_into_wiki",
  "lint_wiki",
] as const;

export const LLM_WIKI_LINT_FINDINGS = [
  "contradiction",
  "stale_claim",
  "orphan_page",
  "missing_backlink",
  "missing_hub_page",
  "weak_source_attribution",
  "unsupported_synthesis",
  "duplicate_page",
  "outdated_index_entry",
] as const;

export const LLM_WIKI_GOVERNANCE_CONTRACT = {
  raw_sources_immutable: true,
  raw_sources_are_truth: true,
  wiki_pages_are_derived: true,
  write_authority: false,
  vault_write_execution_supported: false,
  scheduler_supported: false,
  watcher_supported: false,
  background_jobs_supported: false,
  knowledge_compounding_implemented: false,
  source_ingestion_implemented: false,
  autonomous_agents_implemented: false,
  requires_librarian_envelope: true,
  durable_requires_approval: true,
  index_modeled_not_written: true,
  log_modeled_not_written: true,
} as const;

const ContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const LlmWikiIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

export const LlmWikiRawSourceTypeSchema = z.enum(
  LLM_WIKI_RAW_SOURCE_TYPES,
);
export const LlmWikiPageTypeSchema = z.enum(LLM_WIKI_PAGE_TYPES);
export const LlmWikiMaintenanceOperationSchema = z.enum(
  LLM_WIKI_MAINTENANCE_OPERATIONS,
);
export const LlmWikiLintFindingSchema = z.enum(LLM_WIKI_LINT_FINDINGS);

export const LlmWikiRawSourceSchema = z.strictObject({
  source_type: LlmWikiRawSourceTypeSchema,
  source_id: z.string().trim().min(1),
  source_ref: z.string().trim().min(1).nullable().default(null),
  content_hash: ContentHashSchema,
  captured_at: z.string().trim().datetime({ offset: true }),
  immutable: z.literal(true),
  source_of_truth: z.literal(true),
  raw_mutation_supported: z.literal(false),
});

export const LlmWikiPageDraftSchema = z.strictObject({
  contract_version: z.literal(LLM_WIKI_CONTRACT_VERSION),
  page_id: LlmWikiIdSchema,
  page_type: LlmWikiPageTypeSchema,
  title: z.string().trim().min(1).max(200),
  project: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)
    .nullable()
    .default(null),
  source_refs: z.array(z.string().trim().min(1)).default([]),
  source_hashes: z.array(ContentHashSchema).default([]),
  synthesis_supported: z.boolean().default(true),
  derived_from_raw_sources: z.literal(true),
  durable_requested: z.boolean().default(false),
  canonical_requested: z.boolean().default(false),
  approval_status: z
    .enum(["not_required", "pending", "approved", "denied", "expired"])
    .default("pending"),
  approval_id: ApprovalIdSchema.nullable().default(null),
  sensitivity: VaultSensitivitySchema.default("private"),
  generated_at: z.string().trim().datetime({ offset: true }),
});

export const LlmWikiLintFindingResultSchema = z.strictObject({
  finding: LlmWikiLintFindingSchema,
  severity: z.enum(["info", "warning", "error"]),
  page_id: LlmWikiIdSchema,
  reason: z.string().trim().min(1),
  write_attempted: z.literal(false),
});

export const LlmWikiMaintenanceOperationContractSchema = z.strictObject({
  operation: LlmWikiMaintenanceOperationSchema,
  dry_run_only: z.literal(true),
  write_supported: z.literal(false),
  requires_librarian: z.boolean(),
  requires_approval_for_durable: z.literal(true),
  raw_source_mutation_supported: z.literal(false),
});

export type LlmWikiRawSourceType = z.infer<
  typeof LlmWikiRawSourceTypeSchema
>;
export type LlmWikiPageType = z.infer<typeof LlmWikiPageTypeSchema>;
export type LlmWikiMaintenanceOperation = z.infer<
  typeof LlmWikiMaintenanceOperationSchema
>;
export type LlmWikiLintFinding = z.infer<typeof LlmWikiLintFindingSchema>;
export type LlmWikiRawSource = z.infer<typeof LlmWikiRawSourceSchema>;
export type LlmWikiPageDraft = z.infer<typeof LlmWikiPageDraftSchema>;
export type LlmWikiLintFindingResult = z.infer<
  typeof LlmWikiLintFindingResultSchema
>;
export type LlmWikiMaintenanceOperationContract = z.infer<
  typeof LlmWikiMaintenanceOperationContractSchema
>;

export function createLlmWikiLibrarianEnvelope(input: {
  readonly page: unknown;
  readonly raw_sources: readonly unknown[];
}): LibrarianIngestionEnvelope {
  const page = LlmWikiPageDraftSchema.parse(input.page);
  const rawSources = z.array(LlmWikiRawSourceSchema).min(1).parse(
    input.raw_sources,
  );
  const frontmatter = llmWikiFrontmatter(page, rawSources);
  const route = routeVaultNote(frontmatter);
  const expectedFolder = wikiFolderForPage(page.page_type);
  if (route.route_kind !== "pending_approval" && route.folder !== expectedFolder) {
    throw new Error("LLM Wiki page route does not match vault taxonomy.");
  }

  return LibrarianIngestionEnvelopeSchema.parse({
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    envelope_id: `llm_wiki:${slugPathSegment(page.page_id)}`,
    source: {
      source_type: "llm_wiki",
      source_id: page.page_id,
      source_ref: page.source_refs[0] ?? rawSources[0]?.source_id ?? null,
      captured_at: page.generated_at,
      provenance_source_type: "system",
      content_hash: primaryContentHash(page, rawSources),
    },
    proposed_frontmatter: frontmatter,
    declared_classification: page.durable_requested ? "durable" : "candidate",
    requested_route_target: "wiki",
    requested_target_folder: route.folder,
    content_hash: primaryContentHash(page, rawSources),
    body_ref: null,
    raw_body_included: false,
    received_at: page.generated_at,
  });
}

export function planLlmWikiMaintenanceOperation(
  operation: unknown,
): LlmWikiMaintenanceOperationContract {
  const parsedOperation = LlmWikiMaintenanceOperationSchema.parse(operation);
  return LlmWikiMaintenanceOperationContractSchema.parse({
    operation: parsedOperation,
    dry_run_only: true,
    write_supported: false,
    requires_librarian: [
      "ingest_source",
      "update_entity_concept_pages",
      "update_index",
      "append_log_entry",
      "file_useful_answer_back_into_wiki",
    ].includes(parsedOperation),
    requires_approval_for_durable: true,
    raw_source_mutation_supported: false,
  });
}

export function lintLlmWikiPageDraft(
  input: unknown,
): LlmWikiLintFindingResult[] {
  const page = LlmWikiPageDraftSchema.parse(input);
  const findings: LlmWikiLintFindingResult[] = [];

  if (page.source_refs.length === 0 || page.source_hashes.length === 0) {
    findings.push(
      lintFinding(
        "weak_source_attribution",
        "error",
        page.page_id,
        "Wiki pages require source references and source content hashes.",
      ),
    );
  }
  if (page.page_type === "synthesis_page" && !page.synthesis_supported) {
    findings.push(
      lintFinding(
        "unsupported_synthesis",
        "error",
        page.page_id,
        "Synthesis pages must be backed by supported source attribution.",
      ),
    );
  }

  return findings;
}

function llmWikiFrontmatter(
  page: LlmWikiPageDraft,
  rawSources: readonly LlmWikiRawSource[],
): VaultFrontmatter {
  const approved = page.approval_status === "approved";
  const durableRequested = page.durable_requested || page.canonical_requested;
  const contentHash = primaryContentHash(page, rawSources);
  const sourceRefs = unique([
    ...page.source_refs,
    ...rawSources.map((source) => source.source_id),
  ]);

  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: `note:${slugPathSegment(page.page_id)}`,
    title: page.title,
    note_type: LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE[page.page_type],
    domain: "wiki",
    status: durableRequested ? "active" : "candidate",
    created_at: page.generated_at,
    updated_at: page.generated_at,
    tags: ["llm-wiki", page.page_type],
    sensitivity: page.sensitivity,
    project: page.project,
    provenance: {
      source_type: "system",
      source_id: page.page_id,
      source_url: LLM_WIKI_PATTERN_SOURCE_URL,
      content_hash: contentHash,
    },
    agent: {
      created_by: "llm-wiki",
      run_id: null,
      model_id: null,
      promotion_status: approved ? "human_approved" : "candidate",
    },
    links: {
      related: [],
      sources: sourceRefs,
      decisions: [],
    },
    lifecycle: {
      durable: page.durable_requested && approved,
      canonical: page.canonical_requested && approved,
      approval_status: page.approval_status,
      approval_id: page.approval_id,
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
  };
}

function wikiFolderForPage(pageType: LlmWikiPageType): string {
  const noteType = LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE[pageType];
  return `10-wiki/${
    VAULT_LLM_WIKI_ROUTE_SUBFOLDERS[noteType as VaultLlmWikiNoteType]
  }`;
}

function primaryContentHash(
  page: LlmWikiPageDraft,
  rawSources: readonly LlmWikiRawSource[],
): string {
  return page.source_hashes[0] ?? rawSources[0]?.content_hash;
}

function lintFinding(
  finding: LlmWikiLintFinding,
  severity: LlmWikiLintFindingResult["severity"],
  pageId: string,
  reason: string,
): LlmWikiLintFindingResult {
  return LlmWikiLintFindingResultSchema.parse({
    finding,
    severity,
    page_id: pageId,
    reason,
    write_attempted: false,
  });
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
