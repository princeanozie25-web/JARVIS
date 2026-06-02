import process from "node:process";

import {
  ObsidianVaultPathError,
  buildObsidianVaultIndex,
  getObsidianNoteSnippet,
  type ObsidianVaultIndex,
} from "./pull-indexer";
import {
  deriveKnowledgeSnapshots,
  type DerivedKnowledgeSnapshots,
} from "./knowledge-detect-cli";
import { detectKnowledgeCompoundingCandidatesFromSnapshots } from "./knowledge-compounding-detector";
import { planKnowledgeCompoundingWikiBridge } from "./compounding-wiki-bridge";
import {
  planLlmWikiGeneration,
  type LlmWikiGenerationPlan,
} from "./llm-wiki-generation-planner";
import {
  LLM_WIKI_DRAFT_MODEL_ID,
  generateLlmWikiDraft,
  type GenerateLlmWikiDraftDependencies,
  type LlmWikiDraftResult,
} from "./llm-wiki-draft-generator";
import type { KnowledgeCompoundingProposal } from "./knowledge-compounding-contract";
import {
  createDeepSeekHttpClient,
  createDeepSeekModelProvider,
  createModelRuntime,
  createModelRuntimeProviderKey,
  applyDeepSeekLiveRegistryOverride,
  loadDefaultModelRegistry,
  type DeepSeekClient,
  type ModelProvider,
  type ModelRegistryLoader,
  type ModelRuntime,
} from "../../models";

export const LLM_WIKI_DRAFT_CLI_VERSION =
  "phase21.llm-wiki-draft-cli.v1" as const;

const MIN_NOTES_FOR_DRAFT_GRAPH = 3;
const MIN_WIKI_PAGES_FOR_DRAFT_GRAPH = 2;
const DRAFT_PREVIEW_MAX_CHARS = 1_600;
const SOURCE_SNIPPET_CHARS = 900;

export interface LlmWikiDraftCliDependencies extends GenerateLlmWikiDraftDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly buildIndex?: typeof buildObsidianVaultIndex;
  readonly writeLine?: (line: string) => void;
  readonly now?: () => Date;
}

export const LLM_WIKI_DRAFT_RUNTIME_DIAGNOSTIC_REASONS = [
  "injected_runtime",
  "configured",
  "missing_deepseek_api_key",
  "registry_entry_missing",
  "registry_entry_not_deepseek_cloud",
  "registry_entry_disabled",
  "invalid_deepseek_base_url",
] as const;

export type LlmWikiDraftRuntimeDiagnosticReason =
  (typeof LLM_WIKI_DRAFT_RUNTIME_DIAGNOSTIC_REASONS)[number];

export interface LlmWikiDraftRuntimeDiagnostic {
  readonly status: "ready" | "unavailable";
  readonly reason: LlmWikiDraftRuntimeDiagnosticReason;
  readonly model_id: typeof LLM_WIKI_DRAFT_MODEL_ID;
  readonly provider_kind: "deepseek";
}

export interface CreateConfiguredLlmWikiDraftRuntimeDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly loadRegistry?: () => ModelRegistryLoader;
  readonly createClient?: (config: {
    readonly api_key: string;
    readonly base_url?: string;
  }) => DeepSeekClient;
  readonly createProvider?: (client: DeepSeekClient) => ModelProvider;
  readonly now?: () => number;
}

export interface ConfiguredLlmWikiDraftRuntime {
  readonly runtime: ModelRuntime | null;
  readonly diagnostic: LlmWikiDraftRuntimeDiagnostic;
}

export type LlmWikiDraftCliReport =
  | {
      readonly cli_version: typeof LLM_WIKI_DRAFT_CLI_VERSION;
      readonly status: "ok";
      readonly reason:
        | "draft_preview_ready"
        | "insufficient_knowledge_graph"
        | "no_candidates"
        | "draft_provider_unavailable";
      readonly total_notes_scanned: number;
      readonly wiki_pages_scanned: number;
      readonly candidate_type: string | null;
      readonly confidence: number | null;
      readonly proposed_action: string | null;
      readonly target_page: string | null;
      readonly source_coverage: number | null;
      readonly attribution_status: "ready" | "missing" | "not_applicable";
      readonly provider_status: "ready" | "unavailable";
      readonly provider_reason: LlmWikiDraftRuntimeDiagnosticReason;
      readonly model_id: string | null;
      readonly provider_used: string | null;
      readonly draft_preview: string | null;
      readonly draft_generated: boolean;
      readonly write_attempted: false;
      readonly vault_mutated: false;
      readonly gateway_execution_called: false;
    }
  | {
      readonly cli_version: typeof LLM_WIKI_DRAFT_CLI_VERSION;
      readonly status: "skipped";
      readonly reason: "vault_not_configured";
      readonly total_notes_scanned: 0;
      readonly wiki_pages_scanned: 0;
      readonly candidate_type: null;
      readonly confidence: null;
      readonly proposed_action: null;
      readonly target_page: null;
      readonly source_coverage: null;
      readonly attribution_status: "not_applicable";
      readonly provider_status: "unavailable";
      readonly provider_reason: "missing_deepseek_api_key";
      readonly model_id: null;
      readonly provider_used: null;
      readonly draft_preview: null;
      readonly draft_generated: false;
      readonly write_attempted: false;
      readonly vault_mutated: false;
      readonly gateway_execution_called: false;
    }
  | {
      readonly cli_version: typeof LLM_WIKI_DRAFT_CLI_VERSION;
      readonly status: "failed";
      readonly reason: string;
      readonly total_notes_scanned: 0;
      readonly wiki_pages_scanned: 0;
      readonly candidate_type: null;
      readonly confidence: null;
      readonly proposed_action: null;
      readonly target_page: null;
      readonly source_coverage: null;
      readonly attribution_status: "not_applicable";
      readonly provider_status: "unavailable";
      readonly provider_reason: "missing_deepseek_api_key";
      readonly model_id: null;
      readonly provider_used: null;
      readonly draft_preview: null;
      readonly draft_generated: false;
      readonly write_attempted: false;
      readonly vault_mutated: false;
      readonly gateway_execution_called: false;
    };

export async function runLlmWikiDraftCli(
  dependencies: LlmWikiDraftCliDependencies = {},
): Promise<LlmWikiDraftCliReport> {
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const buildIndex = dependencies.buildIndex ?? buildObsidianVaultIndex;
  const env = dependencies.env ?? process.env;

  writeLine("JARVIS LLM Wiki draft preview");

  try {
    const index = await buildIndex({ env });
    const report = await createLlmWikiDraftPreviewFromIndex(index, {
      ...dependencies,
      env,
    });
    printLlmWikiDraftCliReport(report, writeLine);
    return report;
  } catch (error) {
    const report = reportForDraftCliError(error);
    printLlmWikiDraftCliReport(report, writeLine);
    return report;
  }
}

export async function createLlmWikiDraftPreviewFromIndex(
  index: ObsidianVaultIndex,
  dependencies: Omit<LlmWikiDraftCliDependencies, "buildIndex"> = {},
): Promise<LlmWikiDraftCliReport> {
  const detectedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const snapshots = deriveKnowledgeSnapshots(index, detectedAt);
  const runtimeActivation = resolveDraftRuntime(dependencies);

  if (
    index.notes.length < MIN_NOTES_FOR_DRAFT_GRAPH ||
    snapshots.wikiPages.length < MIN_WIKI_PAGES_FOR_DRAFT_GRAPH
  ) {
    return okReport({
      reason: "insufficient_knowledge_graph",
      totalNotes: index.notes.length,
      wikiPages: snapshots.wikiPages.length,
      attributionStatus: "not_applicable",
      runtimeDiagnostic: runtimeActivation.diagnostic,
    });
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
  planKnowledgeCompoundingWikiBridge({
    candidates: detection.candidates,
    llm_wiki_metadata_snapshot: {
      pages: snapshots.wikiPages.map((page) => ({
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

  const proposal = detection.proposals[0] ?? null;
  if (!proposal) {
    return okReport({
      reason: "no_candidates",
      totalNotes: index.notes.length,
      wikiPages: snapshots.wikiPages.length,
      attributionStatus: "not_applicable",
      runtimeDiagnostic: runtimeActivation.diagnostic,
    });
  }

  const generationPlan = planLlmWikiGeneration({
    proposal,
    wiki_metadata_snapshot: {
      pages: snapshots.wikiPages.map((page) => ({
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
    source_metadata_snapshot: sourceSnapshotForGeneration(snapshots),
  });

  if (!generationPlan.page_plan) {
    return previewFailureReport({
      index,
      proposal,
      generationPlan,
      draftResult: null,
      runtimeDiagnostic: runtimeActivation.diagnostic,
    });
  }

  const sourceSnippets = await snippetsForProposal(index, proposal, snapshots);
  const draftDependencies = runtimeActivation.runtime
    ? { ...dependencies, runtime: runtimeActivation.runtime }
    : dependencies;
  const draftResult = await generateLlmWikiDraft(
    {
      page_plan: generationPlan.page_plan,
      supporting_sources: supportingSourcesForDraft(proposal, snapshots, index),
      source_snippets: sourceSnippets,
      generation_scope: generationPlan.generation_scope ?? "create_new_page",
      unsupported_synthesis:
        generationPlan.source_coverage?.unsupported_synthesis ?? false,
      include_gateway_proposal_draft: false,
      approval_status: "pending",
      approval_id: null,
      created_at: detectedAt,
    },
    draftDependencies,
  );

  if (!draftResult.accepted) {
    return previewFailureReport({
      index,
      proposal,
      generationPlan,
      draftResult,
      runtimeDiagnostic: runtimeActivation.diagnostic,
    });
  }

  return {
    cli_version: LLM_WIKI_DRAFT_CLI_VERSION,
    status: "ok",
    reason: "draft_preview_ready",
    total_notes_scanned: index.notes.length,
    wiki_pages_scanned: snapshots.wikiPages.length,
    candidate_type: proposal.candidate_type,
    confidence: draftResult.confidence,
    proposed_action: proposal.proposed_action,
    target_page: generationPlan.target_location,
    source_coverage: draftResult.source_coverage_score,
    attribution_status:
      draftResult.source_attribution.length > 0 ? "ready" : "missing",
    provider_status: "ready",
    provider_reason: runtimeActivation.diagnostic.reason,
    model_id: draftResult.provider_result.successful_model,
    provider_used: draftResult.provider_result.provider_id,
    draft_preview: draftResult.markdown_draft.slice(0, DRAFT_PREVIEW_MAX_CHARS),
    draft_generated: true,
    write_attempted: false,
    vault_mutated: false,
    gateway_execution_called: false,
  };
}

export function printLlmWikiDraftCliReport(
  report: LlmWikiDraftCliReport,
  writeLine: (line: string) => void,
): void {
  writeLine(`status: ${report.status}`);
  writeLine(`reason: ${report.reason}`);
  writeLine(`total_notes_scanned: ${report.total_notes_scanned}`);
  writeLine(`wiki_pages_scanned: ${report.wiki_pages_scanned}`);
  writeLine(`candidate_type: ${report.candidate_type ?? "none"}`);
  writeLine(`confidence: ${report.confidence?.toFixed(3) ?? "none"}`);
  writeLine(`proposed_action: ${report.proposed_action ?? "none"}`);
  writeLine(`target_page: ${report.target_page ?? "none"}`);
  writeLine(`source_coverage: ${report.source_coverage?.toFixed(3) ?? "none"}`);
  writeLine(`attribution_status: ${report.attribution_status}`);
  writeLine(`provider_status: ${report.provider_status}`);
  writeLine(`provider_reason: ${report.provider_reason}`);
  writeLine(`model_id: ${report.model_id ?? "none"}`);
  writeLine(`provider_used: ${report.provider_used ?? "none"}`);
  writeLine(`draft_generated: ${String(report.draft_generated)}`);
  if (report.draft_preview) {
    writeLine("draft_preview:");
    writeLine(report.draft_preview);
  }
  writeLine(`write_attempted: ${String(report.write_attempted)}`);
  writeLine(`vault_mutated: ${String(report.vault_mutated)}`);
  writeLine(
    `gateway_execution_called: ${String(report.gateway_execution_called)}`,
  );
}

function previewFailureReport(input: {
  readonly index: ObsidianVaultIndex;
  readonly proposal: KnowledgeCompoundingProposal;
  readonly generationPlan: LlmWikiGenerationPlan;
  readonly draftResult: LlmWikiDraftResult | null;
  readonly runtimeDiagnostic: LlmWikiDraftRuntimeDiagnostic;
}): LlmWikiDraftCliReport {
  return {
    cli_version: LLM_WIKI_DRAFT_CLI_VERSION,
    status: "ok",
    reason: "draft_provider_unavailable",
    total_notes_scanned: input.index.notes.length,
    wiki_pages_scanned: input.index.notes.filter((note) =>
      note.path.startsWith("10-wiki/"),
    ).length,
    candidate_type: input.proposal.candidate_type,
    confidence:
      input.draftResult?.confidence ?? input.generationPlan.confidence ?? null,
    proposed_action: input.proposal.proposed_action,
    target_page: input.generationPlan.target_location,
    source_coverage:
      input.draftResult?.source_coverage_score ??
      coverageScore(input.generationPlan),
    attribution_status:
      (input.draftResult?.source_attribution.length ?? 0) > 0
        ? "ready"
        : "missing",
    provider_status: input.runtimeDiagnostic.status,
    provider_reason: input.runtimeDiagnostic.reason,
    model_id:
      input.draftResult?.provider_result.selected_model_id ??
      input.runtimeDiagnostic.model_id,
    provider_used: input.draftResult?.provider_result.provider_id ?? null,
    draft_preview: null,
    draft_generated: false,
    write_attempted: false,
    vault_mutated: false,
    gateway_execution_called: false,
  };
}

function okReport(input: {
  readonly reason: Extract<
    LlmWikiDraftCliReport,
    { readonly status: "ok" }
  >["reason"];
  readonly totalNotes: number;
  readonly wikiPages: number;
  readonly attributionStatus: "ready" | "missing" | "not_applicable";
  readonly runtimeDiagnostic: LlmWikiDraftRuntimeDiagnostic;
}): LlmWikiDraftCliReport {
  return {
    cli_version: LLM_WIKI_DRAFT_CLI_VERSION,
    status: "ok",
    reason: input.reason,
    total_notes_scanned: input.totalNotes,
    wiki_pages_scanned: input.wikiPages,
    candidate_type: null,
    confidence: null,
    proposed_action: null,
    target_page: null,
    source_coverage: null,
    attribution_status: input.attributionStatus,
    provider_status: input.runtimeDiagnostic.status,
    provider_reason: input.runtimeDiagnostic.reason,
    model_id:
      input.runtimeDiagnostic.status === "ready"
        ? input.runtimeDiagnostic.model_id
        : null,
    provider_used: null,
    draft_preview: null,
    draft_generated: false,
    write_attempted: false,
    vault_mutated: false,
    gateway_execution_called: false,
  };
}

function reportForDraftCliError(error: unknown): LlmWikiDraftCliReport {
  if (
    error instanceof ObsidianVaultPathError &&
    error.reason === "missing_env"
  ) {
    return {
      cli_version: LLM_WIKI_DRAFT_CLI_VERSION,
      status: "skipped",
      reason: "vault_not_configured",
      total_notes_scanned: 0,
      wiki_pages_scanned: 0,
      candidate_type: null,
      confidence: null,
      proposed_action: null,
      target_page: null,
      source_coverage: null,
      attribution_status: "not_applicable",
      provider_status: "unavailable",
      provider_reason: "missing_deepseek_api_key",
      model_id: null,
      provider_used: null,
      draft_preview: null,
      draft_generated: false,
      write_attempted: false,
      vault_mutated: false,
      gateway_execution_called: false,
    };
  }

  return {
    cli_version: LLM_WIKI_DRAFT_CLI_VERSION,
    status: "failed",
    reason: error instanceof Error ? error.message : String(error),
    total_notes_scanned: 0,
    wiki_pages_scanned: 0,
    candidate_type: null,
    confidence: null,
    proposed_action: null,
    target_page: null,
    source_coverage: null,
    attribution_status: "not_applicable",
    provider_status: "unavailable",
    provider_reason: "missing_deepseek_api_key",
    model_id: null,
    provider_used: null,
    draft_preview: null,
    draft_generated: false,
    write_attempted: false,
    vault_mutated: false,
    gateway_execution_called: false,
  };
}

export function createConfiguredLlmWikiDraftRuntime(
  dependencies: CreateConfiguredLlmWikiDraftRuntimeDependencies = {},
): ConfiguredLlmWikiDraftRuntime {
  const env = dependencies.env ?? {};
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return unavailableRuntime("missing_deepseek_api_key");
  }

  const registryOverride = applyDeepSeekLiveRegistryOverride(
    (dependencies.loadRegistry ?? loadDefaultModelRegistry)(),
    env,
  );
  const registry = registryOverride.registry;
  const entry = registry.getModel(LLM_WIKI_DRAFT_MODEL_ID);
  if (!entry) return unavailableRuntime("registry_entry_missing");
  if (entry.provider !== "deepseek" || entry.runtime_class !== "cloud") {
    return unavailableRuntime("registry_entry_not_deepseek_cloud");
  }
  if (entry.visibility !== "enabled") {
    return unavailableRuntime("registry_entry_disabled");
  }

  const baseUrl = env.DEEPSEEK_BASE_URL?.trim();
  const clientConfig = {
    api_key: apiKey,
    ...(baseUrl ? { base_url: baseUrl } : {}),
  };

  try {
    const client =
      dependencies.createClient?.(clientConfig) ??
      createDeepSeekHttpClient(clientConfig);
    const provider =
      dependencies.createProvider?.(client) ??
      createDeepSeekModelProvider({ client });
    return {
      runtime: createModelRuntime({
        registry,
        providers: {
          [createModelRuntimeProviderKey(entry)]: provider,
        },
        cloudExecutionPolicy: {
          enabled_provider_kinds: ["deepseek"],
          enabled_model_ids: [LLM_WIKI_DRAFT_MODEL_ID],
        },
        now: dependencies.now,
      }),
      diagnostic: {
        status: "ready",
        reason: "configured",
        model_id: LLM_WIKI_DRAFT_MODEL_ID,
        provider_kind: "deepseek",
      },
    };
  } catch {
    return unavailableRuntime("invalid_deepseek_base_url");
  }
}

function resolveDraftRuntime(
  dependencies: Omit<LlmWikiDraftCliDependencies, "buildIndex">,
): ConfiguredLlmWikiDraftRuntime {
  if (dependencies.runtime) {
    return {
      runtime: dependencies.runtime,
      diagnostic: {
        status: "ready",
        reason: "injected_runtime",
        model_id: LLM_WIKI_DRAFT_MODEL_ID,
        provider_kind: "deepseek",
      },
    };
  }
  return createConfiguredLlmWikiDraftRuntime({ env: dependencies.env });
}

function unavailableRuntime(
  reason: Exclude<
    LlmWikiDraftRuntimeDiagnosticReason,
    "configured" | "injected_runtime"
  >,
): ConfiguredLlmWikiDraftRuntime {
  return {
    runtime: null,
    diagnostic: {
      status: "unavailable",
      reason,
      model_id: LLM_WIKI_DRAFT_MODEL_ID,
      provider_kind: "deepseek",
    },
  };
}

function sourceSnapshotForGeneration(snapshots: DerivedKnowledgeSnapshots) {
  return {
    sources: snapshots.sources.sources.map((source) => ({
      source_id: source.source_id,
      source_type: source.source_type,
      content_hash: source.content_hash,
      path: snapshots.sourcePathById.get(source.source_id) ?? null,
      captured_at: source.captured_at,
    })),
  };
}

function supportingSourcesForDraft(
  proposal: KnowledgeCompoundingProposal,
  snapshots: DerivedKnowledgeSnapshots,
  index: ObsidianVaultIndex,
) {
  return proposal.supporting_sources.map((sourceId, indexInProposal) => {
    const path = snapshots.sourcePathById.get(sourceId) ?? null;
    const note = path ? index.by_path.get(path) : null;
    const source = snapshots.sources.sources.find(
      (entry) => entry.source_id === sourceId,
    );
    return {
      source_id: sourceId,
      source_type: source?.source_type ?? "user_note",
      content_hash:
        source?.content_hash ??
        proposal.source_hashes[indexInProposal] ??
        proposal.source_hashes[0],
      path,
      title: note?.title ?? null,
    };
  });
}

async function snippetsForProposal(
  index: ObsidianVaultIndex,
  proposal: KnowledgeCompoundingProposal,
  snapshots: DerivedKnowledgeSnapshots,
) {
  const snippets = [];
  for (const sourceId of proposal.supporting_sources) {
    const path = snapshots.sourcePathById.get(sourceId);
    if (!path) continue;
    const snippet = await getObsidianNoteSnippet(index, {
      path,
      maxChars: SOURCE_SNIPPET_CHARS,
    });
    if (!snippet) continue;
    snippets.push({
      source_id: sourceId,
      snippet: snippet.snippet,
      bounded: true as const,
      raw_body: false as const,
    });
  }
  return snippets;
}

function coverageScore(plan: LlmWikiGenerationPlan): number | null {
  const coverage = plan.source_coverage;
  if (!coverage || coverage.required_source_ids.length === 0) return null;
  return Math.min(
    1,
    coverage.required_source_hashes.length /
      coverage.required_source_ids.length,
  );
}
