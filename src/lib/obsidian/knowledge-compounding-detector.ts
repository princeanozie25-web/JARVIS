import { z } from "zod";
import {
  KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION,
  KnowledgeCompoundingCandidateSchema,
  KnowledgeCompoundingCandidateTypeSchema,
  KnowledgeCompoundingDetectionInputSchema,
  KnowledgeCompoundingProposalSchema,
  KnowledgeCompoundingProposedActionSchema,
  createKnowledgeCompoundingProposal,
  detectKnowledgeCompoundingCandidates,
  type KnowledgeCompoundingCandidate,
  type KnowledgeCompoundingCandidateType,
  type KnowledgeCompoundingProposal,
  type KnowledgeCompoundingProposedAction,
} from "./knowledge-compounding-contract";
import { slugPathSegment } from "./routing";

export const KNOWLEDGE_COMPOUNDING_DETECTOR_VERSION =
  "phase21.knowledge-compounding-detector.v1" as const;

export const KNOWLEDGE_COMPOUNDING_DETECTOR_REASONS = [
  "accepted",
  "no_candidates",
  "snapshot_invalid",
  "proposal_generation_skipped",
  "proposals_generated",
] as const;

export const KNOWLEDGE_COMPOUNDING_DETECTOR_WARNINGS = [
  "dry_run_only_no_write_executed",
  "metadata_only_detection",
  "proposals_are_drafts_only",
  "no_llm_calls",
  "no_vault_mutation",
] as const;

const ContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const WikiPageSnapshotSchema = z.strictObject({
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
  backlinks: z.array(z.string().trim().min(1)).default([]),
  page_word_count: z.number().int().nonnegative(),
  source_ids: z.array(z.string().trim().min(1)).default([]),
  source_hashes: z.array(ContentHashSchema).default([]),
  updated_at: z.string().trim().datetime({ offset: true }),
  hub_id: z.string().trim().min(1).nullable().default(null),
  related_page_ids: z.array(z.string().trim().min(1)).default([]),
});

const LibrarianMetadataSnapshotSchema = z.strictObject({
  pending_approval_page_ids: z.array(z.string().trim().min(1)).default([]),
  rejected_page_ids: z.array(z.string().trim().min(1)).default([]),
  durable_page_ids: z.array(z.string().trim().min(1)).default([]),
  canonical_page_ids: z.array(z.string().trim().min(1)).default([]),
});

const SourceMetadataSnapshotSchema = z.strictObject({
  sources: z
    .array(
      z.strictObject({
        source_id: z.string().trim().min(1),
        source_type: z.string().trim().min(1),
        content_hash: ContentHashSchema,
        referenced_by_page_ids: z.array(z.string().trim().min(1)).default([]),
        captured_at: z.string().trim().datetime({ offset: true }).nullable(),
      }),
    )
    .default([]),
});

export const KnowledgeCompoundingDetectorInputSchema = z.strictObject({
  wiki_metadata_snapshot: z.strictObject({
    detected_at: z.string().trim().datetime({ offset: true }),
    pages: z.array(WikiPageSnapshotSchema),
  }),
  librarian_metadata_snapshot: LibrarianMetadataSnapshotSchema.default({
    pending_approval_page_ids: [],
    rejected_page_ids: [],
    durable_page_ids: [],
    canonical_page_ids: [],
  }),
  source_metadata_snapshot: SourceMetadataSnapshotSchema.default({
    sources: [],
  }),
  generate_proposals: z.boolean().default(true),
  durable_proposals: z.boolean().default(true),
});

export const KnowledgeCompoundingEvidenceSchema = z.strictObject({
  candidate_id: z.string().trim().min(1),
  candidate_type: KnowledgeCompoundingCandidateTypeSchema,
  why_detected: z.string().trim().min(1),
  supporting_pages: z.array(z.string().trim().min(1)),
  supporting_sources: z.array(z.string().trim().min(1)),
  metrics: z.strictObject({
    references_count: z.number().int().nonnegative(),
    backlinks_count: z.number().int().nonnegative(),
    page_word_count: z.number().int().nonnegative(),
    source_count: z.number().int().nonnegative(),
    update_age_days: z.number().int().nonnegative(),
    duplicate_title_count: z.number().int().nonnegative(),
    related_page_count: z.number().int().nonnegative(),
  }),
  confidence: z.number().min(0).max(1),
  proposed_action: KnowledgeCompoundingProposedActionSchema,
  write_attempted: z.literal(false),
});

export const KnowledgeCompoundingDetectionResultSchema = z.strictObject({
  detector_version: z.literal(KNOWLEDGE_COMPOUNDING_DETECTOR_VERSION),
  contract_version: z.literal(KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION),
  accepted: z.boolean(),
  candidates: z.array(KnowledgeCompoundingCandidateSchema),
  evidence: z.array(KnowledgeCompoundingEvidenceSchema),
  proposals: z.array(KnowledgeCompoundingProposalSchema),
  reasons: z.array(z.enum(KNOWLEDGE_COMPOUNDING_DETECTOR_REASONS)),
  warnings: z.array(z.enum(KNOWLEDGE_COMPOUNDING_DETECTOR_WARNINGS)),
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
});

export type KnowledgeCompoundingWikiPageSnapshot = z.infer<
  typeof WikiPageSnapshotSchema
>;
export type KnowledgeCompoundingLibrarianMetadataSnapshot = z.infer<
  typeof LibrarianMetadataSnapshotSchema
>;
export type KnowledgeCompoundingSourceMetadataSnapshot = z.infer<
  typeof SourceMetadataSnapshotSchema
>;
export type KnowledgeCompoundingDetectorInput = z.infer<
  typeof KnowledgeCompoundingDetectorInputSchema
>;
export type KnowledgeCompoundingEvidence = z.infer<
  typeof KnowledgeCompoundingEvidenceSchema
>;
export type KnowledgeCompoundingDetectionResult = z.infer<
  typeof KnowledgeCompoundingDetectionResultSchema
>;
export type KnowledgeCompoundingDetectorReason =
  (typeof KNOWLEDGE_COMPOUNDING_DETECTOR_REASONS)[number];
export type KnowledgeCompoundingDetectorWarning =
  (typeof KNOWLEDGE_COMPOUNDING_DETECTOR_WARNINGS)[number];

export function detectKnowledgeCompoundingCandidatesFromSnapshots(
  input: unknown,
): KnowledgeCompoundingDetectionResult {
  const parsed = KnowledgeCompoundingDetectorInputSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedResult("snapshot_invalid");
  }

  const request = parsed.data;
  const titleCounts = titleDuplicateCounts(
    request.wiki_metadata_snapshot.pages,
  );
  const hubIds = new Set(
    request.wiki_metadata_snapshot.pages
      .filter((page) => page.page_type === "hub_page")
      .map((page) => page.page_id),
  );
  const detectionInputs = request.wiki_metadata_snapshot.pages.map((page) =>
    KnowledgeCompoundingDetectionInputSchema.parse({
      page_id: page.page_id,
      page_type: page.page_type,
      title: page.title,
      path: page.path,
      references_count: page.references_count,
      backlinks_count: page.backlinks.length,
      page_word_count: page.page_word_count,
      source_count: sourceCount(page, request.source_metadata_snapshot),
      update_age_days: updateAgeDays(
        request.wiki_metadata_snapshot.detected_at,
        page.updated_at,
      ),
      duplicate_title_count: titleCounts.get(slugPathSegment(page.title)) ?? 0,
      hub_exists: page.hub_id !== null && hubIds.has(page.hub_id),
      related_page_count: page.related_page_ids.length,
      source_ids: supportingSources(page, request.source_metadata_snapshot),
      source_hashes: supportingHashes(page, request.source_metadata_snapshot),
    }),
  );
  const candidates = detectKnowledgeCompoundingCandidates(detectionInputs);
  const evidence = candidates.map((candidate) =>
    evidenceFor(candidate, request.wiki_metadata_snapshot.pages),
  );
  const proposals = request.generate_proposals
    ? candidates.map((candidate) =>
        createKnowledgeCompoundingProposal({
          candidate,
          proposal_id: proposalIdFor(candidate),
          created_at: request.wiki_metadata_snapshot.detected_at,
          durable_candidate: request.durable_proposals,
        }),
      )
    : [];
  const reasons: KnowledgeCompoundingDetectorReason[] = [];
  if (candidates.length === 0) {
    reasons.push("no_candidates");
  }
  if (request.generate_proposals && proposals.length > 0) {
    reasons.push("proposals_generated");
  }
  if (!request.generate_proposals) {
    reasons.push("proposal_generation_skipped");
  }
  if (reasons.length === 0) {
    reasons.push("accepted");
  }

  return KnowledgeCompoundingDetectionResultSchema.parse({
    detector_version: KNOWLEDGE_COMPOUNDING_DETECTOR_VERSION,
    contract_version: KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION,
    accepted: true,
    candidates,
    evidence,
    proposals,
    reasons: unique(reasons),
    warnings: [
      "dry_run_only_no_write_executed",
      "metadata_only_detection",
      "proposals_are_drafts_only",
      "no_llm_calls",
      "no_vault_mutation",
    ],
    governance: governanceSummary(),
  });
}

function sourceCount(
  page: KnowledgeCompoundingWikiPageSnapshot,
  sourceSnapshot: KnowledgeCompoundingSourceMetadataSnapshot,
): number {
  return supportingSources(page, sourceSnapshot).length;
}

function supportingSources(
  page: KnowledgeCompoundingWikiPageSnapshot,
  sourceSnapshot: KnowledgeCompoundingSourceMetadataSnapshot,
): string[] {
  const sourceIds = new Set(page.source_ids);
  for (const source of sourceSnapshot.sources) {
    if (source.referenced_by_page_ids.includes(page.page_id)) {
      sourceIds.add(source.source_id);
    }
  }
  return Array.from(sourceIds);
}

function supportingHashes(
  page: KnowledgeCompoundingWikiPageSnapshot,
  sourceSnapshot: KnowledgeCompoundingSourceMetadataSnapshot,
): string[] {
  const hashes = new Set(page.source_hashes);
  for (const source of sourceSnapshot.sources) {
    if (source.referenced_by_page_ids.includes(page.page_id)) {
      hashes.add(source.content_hash);
    }
  }
  return Array.from(hashes);
}

function updateAgeDays(detectedAt: string, updatedAt: string): number {
  const ageMs = Date.parse(detectedAt) - Date.parse(updatedAt);
  return Math.max(0, Math.floor(ageMs / 86_400_000));
}

function titleDuplicateCounts(
  pages: readonly KnowledgeCompoundingWikiPageSnapshot[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const slug = slugPathSegment(page.title);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return new Map(
    Array.from(counts.entries()).map(([slug, count]) => [
      slug,
      Math.max(0, count - 1),
    ]),
  );
}

function evidenceFor(
  candidate: KnowledgeCompoundingCandidate,
  pages: readonly KnowledgeCompoundingWikiPageSnapshot[],
): KnowledgeCompoundingEvidence {
  const page = pages.find(
    (snapshotPage) =>
      snapshotPage.page_id === candidate.detection_inputs.page_id,
  );
  return KnowledgeCompoundingEvidenceSchema.parse({
    candidate_id: candidate.candidate_id,
    candidate_type: candidate.candidate_type,
    why_detected: whyDetected(candidate.candidate_type),
    supporting_pages: unique([
      ...candidate.affected_pages,
      ...(page?.related_page_ids ?? []),
    ]),
    supporting_sources: candidate.supporting_sources,
    metrics: {
      references_count: candidate.detection_inputs.references_count,
      backlinks_count: candidate.detection_inputs.backlinks_count,
      page_word_count: candidate.detection_inputs.page_word_count,
      source_count: candidate.detection_inputs.source_count,
      update_age_days: candidate.detection_inputs.update_age_days,
      duplicate_title_count: candidate.detection_inputs.duplicate_title_count,
      related_page_count: candidate.detection_inputs.related_page_count,
    },
    confidence: candidate.confidence,
    proposed_action: candidate.proposed_action,
    write_attempted: false,
  });
}

function whyDetected(candidateType: KnowledgeCompoundingCandidateType): string {
  const messages: Record<KnowledgeCompoundingCandidateType, string> = {
    missing_hub: "No valid hub page is linked for this wiki page.",
    sparse_hub: "Hub page word count is below the density threshold.",
    fragmented_concept:
      "Concept has multiple related pages and may need consolidation.",
    missing_backlinks:
      "Page has references but no backlinks in the metadata snapshot.",
    weak_source_coverage:
      "Page is backed by fewer than two source records.",
    duplicate_concept:
      "Multiple pages share the same normalized title.",
    stale_wiki_page: "Page update age exceeds the stale threshold.",
    underlinked_system:
      "System page has fewer than two backlinks in the wiki graph.",
  };
  return messages[candidateType];
}

function proposalIdFor(
  candidate: KnowledgeCompoundingCandidate,
): `proposal:${string}` {
  return `proposal:knowledge-compounding.${slugPathSegment(
    candidate.candidate_id,
  )}`;
}

function rejectedResult(
  reason: KnowledgeCompoundingDetectorReason,
): KnowledgeCompoundingDetectionResult {
  return KnowledgeCompoundingDetectionResultSchema.parse({
    detector_version: KNOWLEDGE_COMPOUNDING_DETECTOR_VERSION,
    contract_version: KNOWLEDGE_COMPOUNDING_CONTRACT_VERSION,
    accepted: false,
    candidates: [],
    evidence: [],
    proposals: [],
    reasons: [reason],
    warnings: [
      "dry_run_only_no_write_executed",
      "metadata_only_detection",
      "no_llm_calls",
      "no_vault_mutation",
    ],
    governance: governanceSummary(),
  });
}

function governanceSummary(): z.infer<
  typeof KnowledgeCompoundingDetectionResultSchema
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

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
