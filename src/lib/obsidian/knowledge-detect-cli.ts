import { createHash } from "node:crypto";

import {
  ObsidianVaultPathError,
  buildObsidianVaultIndex,
  type ObsidianNoteMetadata,
  type ObsidianVaultIndex,
} from "./pull-indexer";
import {
  detectKnowledgeCompoundingCandidatesFromSnapshots,
  type KnowledgeCompoundingDetectionResult,
  type KnowledgeCompoundingSourceMetadataSnapshot,
  type KnowledgeCompoundingWikiPageSnapshot,
} from "./knowledge-compounding-detector";
import {
  planKnowledgeCompoundingWikiBridge,
  type CompoundingWikiBridgePlan,
} from "./compounding-wiki-bridge";

export const KNOWLEDGE_DETECT_CLI_VERSION =
  "phase21.knowledge-detect-cli.v1" as const;

const MIN_NOTES_FOR_KNOWLEDGE_GRAPH = 3;
const MIN_WIKI_PAGES_FOR_KNOWLEDGE_GRAPH = 2;

export interface KnowledgeDetectCliDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly buildIndex?: typeof buildObsidianVaultIndex;
  readonly writeLine?: (line: string) => void;
  readonly now?: () => Date;
}

export interface KnowledgeDetectCandidateReport {
  readonly candidate_id: string;
  readonly candidate_type: string;
  readonly confidence: number;
  readonly proposed_action: string;
  readonly affected_pages: readonly string[];
  readonly supporting_sources: readonly string[];
  readonly supporting_source_paths: readonly string[];
  readonly write_attempted: false;
}

export interface KnowledgeDetectBridgeRecommendationReport {
  readonly candidate_id: string;
  readonly candidate_type: string;
  readonly wiki_action: string;
  readonly page_type: string;
  readonly requested_operation: string;
}

export type KnowledgeDetectCliReport =
  | {
      readonly cli_version: typeof KNOWLEDGE_DETECT_CLI_VERSION;
      readonly status: "ok";
      readonly reason: "detected" | "insufficient_knowledge_graph";
      readonly total_notes_scanned: number;
      readonly wiki_pages_scanned: number;
      readonly source_notes_scanned: number;
      readonly candidate_count: number;
      readonly candidates: readonly KnowledgeDetectCandidateReport[];
      readonly bridge_recommendations: readonly KnowledgeDetectBridgeRecommendationReport[];
      readonly warnings: readonly string[];
      readonly write_attempted: false;
      readonly vault_mutated: false;
    }
  | {
      readonly cli_version: typeof KNOWLEDGE_DETECT_CLI_VERSION;
      readonly status: "skipped";
      readonly reason: "vault_not_configured";
      readonly total_notes_scanned: 0;
      readonly wiki_pages_scanned: 0;
      readonly source_notes_scanned: 0;
      readonly candidate_count: 0;
      readonly candidates: readonly [];
      readonly bridge_recommendations: readonly [];
      readonly warnings: readonly string[];
      readonly write_attempted: false;
      readonly vault_mutated: false;
    }
  | {
      readonly cli_version: typeof KNOWLEDGE_DETECT_CLI_VERSION;
      readonly status: "failed";
      readonly reason: string;
      readonly total_notes_scanned: 0;
      readonly wiki_pages_scanned: 0;
      readonly source_notes_scanned: 0;
      readonly candidate_count: 0;
      readonly candidates: readonly [];
      readonly bridge_recommendations: readonly [];
      readonly warnings: readonly string[];
      readonly write_attempted: false;
      readonly vault_mutated: false;
    };

export interface DerivedKnowledgeSnapshots {
  readonly wikiPages: readonly KnowledgeCompoundingWikiPageSnapshot[];
  readonly sources: KnowledgeCompoundingSourceMetadataSnapshot;
  readonly sourcePathById: ReadonlyMap<string, string>;
}

export async function runKnowledgeDetectCli(
  dependencies: KnowledgeDetectCliDependencies = {},
): Promise<KnowledgeDetectCliReport> {
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const buildIndex = dependencies.buildIndex ?? buildObsidianVaultIndex;

  writeLine("JARVIS Knowledge Compounding detection");

  try {
    const index = await buildIndex({ env: dependencies.env });
    const report = planKnowledgeDetectionFromIndex(index, dependencies.now);
    printKnowledgeDetectReport(report, writeLine);
    return report;
  } catch (error) {
    const report = reportForIndexError(error);
    printKnowledgeDetectReport(report, writeLine);
    return report;
  }
}

export function planKnowledgeDetectionFromIndex(
  index: ObsidianVaultIndex,
  now: (() => Date) | undefined = undefined,
): KnowledgeDetectCliReport {
  const detectedAt = (now?.() ?? new Date()).toISOString();
  const snapshots = deriveKnowledgeSnapshots(index, detectedAt);
  const sourceNotesScanned = index.notes.length - snapshots.wikiPages.length;

  if (
    index.notes.length < MIN_NOTES_FOR_KNOWLEDGE_GRAPH ||
    snapshots.wikiPages.length < MIN_WIKI_PAGES_FOR_KNOWLEDGE_GRAPH
  ) {
    return {
      cli_version: KNOWLEDGE_DETECT_CLI_VERSION,
      status: "ok",
      reason: "insufficient_knowledge_graph",
      total_notes_scanned: index.notes.length,
      wiki_pages_scanned: snapshots.wikiPages.length,
      source_notes_scanned: sourceNotesScanned,
      candidate_count: 0,
      candidates: [],
      bridge_recommendations: [],
      warnings: [
        "metadata_only_detection",
        "insufficient_knowledge_graph",
        "no_llm_calls",
        "no_vault_mutation",
      ],
      write_attempted: false,
      vault_mutated: false,
    };
  }

  const detection = detectKnowledgeCompoundingCandidatesFromSnapshots({
    wiki_metadata_snapshot: {
      detected_at: detectedAt,
      pages: snapshots.wikiPages,
    },
    librarian_metadata_snapshot: {
      pending_approval_page_ids: [],
      rejected_page_ids: [],
      durable_page_ids: snapshots.wikiPages.map((page) => page.page_id),
      canonical_page_ids: [],
    },
    source_metadata_snapshot: snapshots.sources,
    generate_proposals: true,
    durable_proposals: true,
  });
  const bridge = planBridge(detection, snapshots.wikiPages);
  const candidates = detection.candidates.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    candidate_type: candidate.candidate_type,
    confidence: candidate.confidence,
    proposed_action: candidate.proposed_action,
    affected_pages: candidate.affected_pages,
    supporting_sources: candidate.supporting_sources,
    supporting_source_paths: candidate.supporting_sources.map(
      (sourceId) => snapshots.sourcePathById.get(sourceId) ?? "unknown",
    ),
    write_attempted: false as const,
  }));

  return {
    cli_version: KNOWLEDGE_DETECT_CLI_VERSION,
    status: "ok",
    reason:
      detection.candidates.length > 0
        ? "detected"
        : "insufficient_knowledge_graph",
    total_notes_scanned: index.notes.length,
    wiki_pages_scanned: snapshots.wikiPages.length,
    source_notes_scanned: sourceNotesScanned,
    candidate_count: candidates.length,
    candidates,
    bridge_recommendations: bridge.recommendations.map((recommendation) => ({
      candidate_id: recommendation.candidate_id,
      candidate_type: recommendation.candidate_type,
      wiki_action: recommendation.wiki_action,
      page_type: recommendation.page_type,
      requested_operation: recommendation.requested_operation,
    })),
    warnings: unique([
      ...detection.warnings,
      ...bridge.warnings,
      "metadata_only_output",
    ]),
    write_attempted: false,
    vault_mutated: false,
  };
}

export function printKnowledgeDetectReport(
  report: KnowledgeDetectCliReport,
  writeLine: (line: string) => void,
): void {
  writeLine(`status: ${report.status}`);
  writeLine(`reason: ${report.reason}`);
  writeLine(`total_notes_scanned: ${report.total_notes_scanned}`);
  writeLine(`wiki_pages_scanned: ${report.wiki_pages_scanned}`);
  writeLine(`source_notes_scanned: ${report.source_notes_scanned}`);
  writeLine(`candidate_count: ${report.candidate_count}`);

  for (const candidate of report.candidates) {
    writeLine(
      [
        "candidate:",
        `type=${candidate.candidate_type}`,
        `confidence=${candidate.confidence.toFixed(3)}`,
        `proposed_action=${candidate.proposed_action}`,
        `affected_pages=${candidate.affected_pages.join(",") || "none"}`,
        `supporting_sources=${
          candidate.supporting_sources.join(",") || "none"
        }`,
        `supporting_source_paths=${
          candidate.supporting_source_paths.join(",") || "none"
        }`,
        "write_attempted=false",
      ].join(" "),
    );
  }

  for (const recommendation of report.bridge_recommendations) {
    writeLine(
      [
        "bridge_recommendation:",
        `candidate_id=${recommendation.candidate_id}`,
        `wiki_action=${recommendation.wiki_action}`,
        `page_type=${recommendation.page_type}`,
        `requested_operation=${recommendation.requested_operation}`,
      ].join(" "),
    );
  }

  writeLine(`warnings: ${report.warnings.join(",") || "none"}`);
  writeLine(`write_attempted: ${String(report.write_attempted)}`);
  writeLine(`vault_mutated: ${String(report.vault_mutated)}`);
}

export function deriveKnowledgeSnapshots(
  index: ObsidianVaultIndex,
  detectedAt: string,
): DerivedKnowledgeSnapshots {
  const wikiNotes = index.notes
    .map((note) => ({ note, pageType: wikiPageTypeForPath(note.path) }))
    .filter(
      (
        entry,
      ): entry is {
        readonly note: ObsidianNoteMetadata;
        readonly pageType: KnowledgeCompoundingWikiPageSnapshot["page_type"];
      } => entry.pageType !== null,
    );
  const sourcePathById = new Map<string, string>();
  const pages = wikiNotes.map(({ note, pageType }) => {
    const sourceId = sourceIdForNote(note);
    sourcePathById.set(sourceId, note.path);
    return {
      page_id: note.id,
      page_type: pageType,
      title: note.title,
      path: note.path,
      references_count: Math.max(1, sourceIdsForNote(note).length),
      backlinks: backlinkIdsForNote(
        note,
        wikiNotes.map((entry) => entry.note),
      ),
      page_word_count: estimatedWordCount(note),
      source_ids: sourceIdsForNote(note),
      source_hashes: [metadataHash(note)],
      updated_at: dateFromMs(note.modified_at_ms, detectedAt),
      hub_id: hubIdForNote(
        note,
        wikiNotes.map((entry) => entry.note),
      ),
      related_page_ids: relatedPageIdsForNote(
        note,
        wikiNotes.map((entry) => entry.note),
      ),
    } satisfies KnowledgeCompoundingWikiPageSnapshot;
  });
  const sources = index.notes.map((note) => {
    const sourceId = sourceIdForNote(note);
    sourcePathById.set(sourceId, note.path);
    return {
      source_id: sourceId,
      source_type: sourceTypeForNote(note),
      content_hash: metadataHash(note),
      referenced_by_page_ids: pages
        .filter((page) => page.source_ids.includes(sourceId))
        .map((page) => page.page_id),
      captured_at: dateFromMs(note.modified_at_ms, detectedAt),
    };
  });

  return {
    wikiPages: pages,
    sources: { sources },
    sourcePathById,
  };
}

function planBridge(
  detection: KnowledgeCompoundingDetectionResult,
  pages: readonly KnowledgeCompoundingWikiPageSnapshot[],
): CompoundingWikiBridgePlan {
  return planKnowledgeCompoundingWikiBridge({
    candidates: detection.candidates,
    llm_wiki_metadata_snapshot: {
      pages: pages.map((page) => ({
        page_id: page.page_id,
        page_type: page.page_type,
        title: page.title,
        path: page.path,
        source_ids: page.source_ids,
        source_hashes: page.source_hashes,
        backlinks: page.backlinks,
        hub_id: page.hub_id,
        updated_at: page.updated_at,
      })),
      index_entries: [],
      log_entry_ids: [],
    },
  });
}

function reportForIndexError(error: unknown): KnowledgeDetectCliReport {
  if (
    error instanceof ObsidianVaultPathError &&
    error.reason === "missing_env"
  ) {
    return {
      cli_version: KNOWLEDGE_DETECT_CLI_VERSION,
      status: "skipped",
      reason: "vault_not_configured",
      total_notes_scanned: 0,
      wiki_pages_scanned: 0,
      source_notes_scanned: 0,
      candidate_count: 0,
      candidates: [],
      bridge_recommendations: [],
      warnings: [
        "set_OBSIDIAN_VAULT_PATH_to_enable_real_vault_detection",
        "no_llm_calls",
        "no_vault_mutation",
      ],
      write_attempted: false,
      vault_mutated: false,
    };
  }

  return {
    cli_version: KNOWLEDGE_DETECT_CLI_VERSION,
    status: "failed",
    reason: error instanceof Error ? error.message : String(error),
    total_notes_scanned: 0,
    wiki_pages_scanned: 0,
    source_notes_scanned: 0,
    candidate_count: 0,
    candidates: [],
    bridge_recommendations: [],
    warnings: ["metadata_only_detection", "no_llm_calls", "no_vault_mutation"],
    write_attempted: false,
    vault_mutated: false,
  };
}

function wikiPageTypeForPath(
  path: string,
): KnowledgeCompoundingWikiPageSnapshot["page_type"] | null {
  if (path === "10-wiki/index.md" || path === "10-wiki/log.md") {
    return null;
  }
  if (path.startsWith("10-wiki/hubs/")) return "hub_page";
  if (path.startsWith("10-wiki/concepts/")) return "concept_page";
  if (path.startsWith("10-wiki/systems/")) return "system_page";
  if (path.startsWith("10-wiki/people/")) return "person_page";
  if (path.startsWith("10-wiki/projects/")) return "project_page";
  if (path.startsWith("10-wiki/sources/")) return "source_page";
  if (path.startsWith("10-wiki/decisions/")) return "decision_page";
  return null;
}

function sourceTypeForNote(note: ObsidianNoteMetadata): string {
  if (note.path.startsWith("20-projects/")) return "gitnexus";
  if (note.path.startsWith("30-research/")) return "external_research";
  if (note.path.startsWith("70-references/")) return "imported_document";
  if (note.path.startsWith("60-agents/")) return "agent_output";
  return "user_note";
}

function sourceIdForNote(note: ObsidianNoteMetadata): string {
  return `source:${note.id.replace(/^obsidian:/, "obsidian.")}`;
}

function sourceIdsForNote(note: ObsidianNoteMetadata): string[] {
  const taggedSources = note.tags
    .filter((tag) => tag.startsWith("source/"))
    .map((tag) => `source:${tag.slice("source/".length).replace(/\//g, ".")}`);
  return unique([sourceIdForNote(note), ...taggedSources]);
}

function metadataHash(note: ObsidianNoteMetadata): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(
      [
        note.id,
        note.path,
        note.title,
        String(note.size_bytes),
        String(note.modified_at_ms),
        note.tags.join(","),
      ].join("\n"),
      "utf8",
    )
    .digest("hex")}`;
}

function backlinkIdsForNote(
  note: ObsidianNoteMetadata,
  notes: readonly ObsidianNoteMetadata[],
): string[] {
  return relatedPageIdsForNote(note, notes).slice(0, 6);
}

function relatedPageIdsForNote(
  note: ObsidianNoteMetadata,
  notes: readonly ObsidianNoteMetadata[],
): string[] {
  const tags = new Set(note.tags);
  if (tags.size === 0) return [];
  return notes
    .filter(
      (candidate) =>
        candidate.id !== note.id && candidate.tags.some((tag) => tags.has(tag)),
    )
    .map((candidate) => candidate.id)
    .sort();
}

function hubIdForNote(
  note: ObsidianNoteMetadata,
  notes: readonly ObsidianNoteMetadata[],
): string | null {
  if (wikiPageTypeForPath(note.path) === "hub_page") return null;
  const noteTags = new Set(note.tags);
  if (noteTags.size === 0) return null;
  return (
    notes.find(
      (candidate) =>
        wikiPageTypeForPath(candidate.path) === "hub_page" &&
        candidate.tags.some((tag) => noteTags.has(tag)),
    )?.id ?? null
  );
}

function estimatedWordCount(note: ObsidianNoteMetadata): number {
  return Math.max(1, Math.floor(note.size_bytes / 6));
}

function dateFromMs(value: number, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}
