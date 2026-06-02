import { z } from "zod";
import {
  createModelRuntime,
  createModelRegistryFromYaml,
  type ModelRuntime,
  type ModelRuntimeExecuteResult,
} from "../../models";
import {
  VAULT_FRONTMATTER_SCHEMA_VERSION,
  type VaultFrontmatter,
} from "./frontmatter";
import {
  LLM_WIKI_CONTRACT_VERSION,
  LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE,
  LlmWikiPageDraftSchema,
  LlmWikiRawSourceSchema,
  createLlmWikiLibrarianEnvelope,
  type LlmWikiPageType,
} from "./llm-wiki-contract";
import {
  LlmWikiGenerationScopeSchema,
  LlmWikiPageDraftPlanSchema,
  type LlmWikiGenerationScope,
  type LlmWikiPageDraftPlan,
} from "./llm-wiki-generation-planner";
import { planLibrarianIngestionDryRun } from "./librarian-dry-run-planner";
import { slugPathSegment } from "./routing";
import {
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  VaultWriteProposalSchema,
} from "./write-gateway";
import {
  VAULT_LLM_WIKI_ROUTE_SUBFOLDERS,
  type VaultLlmWikiNoteType,
} from "./taxonomy";

export const LLM_WIKI_DRAFT_GENERATOR_VERSION =
  "phase21.llm-wiki-draft-generator.v1" as const;

export const LLM_WIKI_DRAFT_MODEL_ID = "deepseek-v4-flash" as const;

export const LLM_WIKI_DRAFT_GENERATOR_REASONS = [
  "accepted",
  "input_invalid",
  "missing_sources",
  "missing_source_snippets",
  "unsupported_synthesis",
  "provider_disabled_or_unavailable",
  "provider_returned_non_text",
  "attribution_required",
  "gateway_draft_created",
  "gateway_draft_not_requested",
] as const;

export const LLM_WIKI_DRAFT_GENERATOR_WARNINGS = [
  "draft_only_no_write_executed",
  "approval_required_before_persistence",
  "source_snippets_used",
  "attribution_appended",
  "unsupported_synthesis_flagged",
  "deepseek_disabled_by_default",
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
  title: z.string().trim().min(1).nullable().default(null),
});

const SourceSnippetSchema = z.strictObject({
  source_id: z.string().trim().min(1),
  snippet: z.string().trim().min(1),
  bounded: z.literal(true),
  raw_body: z.literal(false).default(false),
});

export const LlmWikiDraftGeneratorInputSchema = z.strictObject({
  page_plan: LlmWikiPageDraftPlanSchema,
  supporting_sources: z.array(SourceMetadataSchema),
  source_snippets: z.array(SourceSnippetSchema),
  generation_scope: LlmWikiGenerationScopeSchema,
  unsupported_synthesis: z.boolean().default(false),
  include_gateway_proposal_draft: z.boolean().default(false),
  approval_status: z
    .enum(["not_required", "pending", "approved", "denied", "expired"])
    .default("pending"),
  approval_id: z
    .string()
    .trim()
    .regex(/^approval:[a-z0-9]+(?:[._:-][a-z0-9]+)*$/)
    .nullable()
    .default(null),
  created_at: z.string().trim().datetime({ offset: true }),
});

export const LlmWikiDraftGeneratorRuntimeOptionsSchema = z.strictObject({
  timeout_ms: z.number().int().positive().default(30_000),
  max_output_tokens: z.number().int().positive().default(1_200),
});

export const LlmWikiDraftSourceAttributionSchema = z.strictObject({
  source_id: z.string().trim().min(1),
  source_hash: ContentHashSchema,
  path: z.string().trim().min(1).nullable(),
  title: z.string().trim().min(1).nullable(),
});

export const LlmWikiDraftResultSchema = z.strictObject({
  generator_version: z.literal(LLM_WIKI_DRAFT_GENERATOR_VERSION),
  model_id: z.literal(LLM_WIKI_DRAFT_MODEL_ID),
  accepted: z.boolean(),
  markdown_draft: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
  source_coverage_score: z.number().min(0).max(1),
  source_attribution: z.array(LlmWikiDraftSourceAttributionSchema),
  unsupported_synthesis_warning: z.boolean(),
  librarian_envelope_draft: z.unknown().nullable(),
  librarian_dry_run_plan: z.unknown().nullable(),
  gateway_proposal_draft: z.unknown().nullable(),
  provider_result: z.strictObject({
    attempted: z.boolean(),
    ok: z.boolean(),
    failure_class: z.string().trim().min(1).nullable(),
    selected_model_id: z.string().trim().min(1).nullable(),
    successful_model: z.string().trim().min(1).nullable(),
    provider_id: z.string().trim().min(1).nullable(),
    redaction_status: z.string().trim().min(1).nullable(),
  }),
  reasons: z.array(z.enum(LLM_WIKI_DRAFT_GENERATOR_REASONS)),
  warnings: z.array(z.enum(LLM_WIKI_DRAFT_GENERATOR_WARNINGS)),
  governance: z.strictObject({
    draft_generated: z.boolean(),
    write_attempted: z.literal(false),
    vault_mutated: z.literal(false),
    vault_write_executed: z.literal(false),
    gateway_execution_called: z.literal(false),
    approval_bypassed: z.literal(false),
    scheduler_started: z.literal(false),
    watcher_started: z.literal(false),
    background_job_started: z.literal(false),
  }),
  write_attempted: z.literal(false),
});

export type LlmWikiDraftGeneratorInput = z.infer<
  typeof LlmWikiDraftGeneratorInputSchema
>;
export type LlmWikiDraftGeneratorRuntimeOptions = z.infer<
  typeof LlmWikiDraftGeneratorRuntimeOptionsSchema
>;
export type LlmWikiDraftSourceAttribution = z.infer<
  typeof LlmWikiDraftSourceAttributionSchema
>;
export type LlmWikiDraftResult = z.infer<typeof LlmWikiDraftResultSchema>;
export type LlmWikiDraftGeneratorReason =
  (typeof LLM_WIKI_DRAFT_GENERATOR_REASONS)[number];
export type LlmWikiDraftGeneratorWarning =
  (typeof LLM_WIKI_DRAFT_GENERATOR_WARNINGS)[number];

export interface GenerateLlmWikiDraftDependencies {
  readonly runtime?: ModelRuntime;
  readonly runtimeOptions?: Partial<LlmWikiDraftGeneratorRuntimeOptions>;
}

export async function generateLlmWikiDraft(
  input: unknown,
  dependencies: GenerateLlmWikiDraftDependencies = {},
): Promise<LlmWikiDraftResult> {
  const parsed = LlmWikiDraftGeneratorInputSchema.safeParse(input);
  if (!parsed.success) return rejectedDraft("input_invalid");

  const request = parsed.data;
  const runtimeOptions = LlmWikiDraftGeneratorRuntimeOptionsSchema.parse(
    dependencies.runtimeOptions ?? {},
  );
  const sourceCoverage = sourceCoverageScore(request);
  const attribution = attributionFor(request);
  const reasons: LlmWikiDraftGeneratorReason[] = [];
  const warnings: LlmWikiDraftGeneratorWarning[] = [
    "draft_only_no_write_executed",
    "approval_required_before_persistence",
    "source_snippets_used",
    "deepseek_disabled_by_default",
  ];

  if (request.supporting_sources.length === 0) reasons.push("missing_sources");
  if (request.source_snippets.length === 0) {
    reasons.push("missing_source_snippets");
  }
  if (request.unsupported_synthesis) {
    reasons.push("unsupported_synthesis");
    warnings.push("unsupported_synthesis_flagged");
  }
  if (attribution.length === 0) reasons.push("attribution_required");

  const blockingBeforeProvider = reasons.some((reason) =>
    [
      "missing_sources",
      "missing_source_snippets",
      "unsupported_synthesis",
      "attribution_required",
    ].includes(reason),
  );
  if (blockingBeforeProvider) {
    return LlmWikiDraftResultSchema.parse({
      ...baseResult({
        request,
        attribution,
        sourceCoverage,
        reasons,
        warnings,
      }),
      rationale: "Draft generation rejected before provider call.",
    });
  }

  const runtime = dependencies.runtime ?? createFailClosedDeepSeekRuntime();
  const executeModelDraft = runtime.execute.bind(runtime);
  const providerResult = await executeModelDraft({
    request_id: `llm-wiki-draft:${slugPathSegment(request.page_plan.page_id)}`,
    capability: "chat",
    input: {
      kind: "messages",
      messages: [
        {
          role: "system",
          content:
            "Generate an attributed Markdown draft using only supplied snippets. Do not invent claims.",
        },
        {
          role: "user",
          content: promptFor(request, attribution),
        },
      ],
    },
    resolver_options: {
      allow_cloud: true,
      allow_disabled: false,
      runtime_class: "cloud",
      preferred_tier: "T2",
      max_priority: 90,
      excluded_model_ids: ["deepseek-v4-pro"],
    },
    options: {
      temperature: 0.2,
      max_output_tokens: runtimeOptions.max_output_tokens,
    },
    timeout_ms: runtimeOptions.timeout_ms,
  });

  if (!providerResult.ok || providerResult.response === null) {
    return LlmWikiDraftResultSchema.parse({
      ...baseResult({
        request,
        attribution,
        sourceCoverage,
        reasons: [...reasons, "provider_disabled_or_unavailable"],
        warnings,
        providerResult,
      }),
      rationale: "DeepSeek draft provider failed closed.",
    });
  }

  const output = providerResult.response.output;
  if (output.kind !== "text" || !output.content.trim()) {
    return LlmWikiDraftResultSchema.parse({
      ...baseResult({
        request,
        attribution,
        sourceCoverage,
        reasons: [...reasons, "provider_returned_non_text"],
        warnings,
        providerResult,
      }),
      rationale: "DeepSeek provider did not return a text draft.",
    });
  }

  const markdownDraft = withAttributionBlock(output.content, attribution);
  warnings.push("attribution_appended");
  const pageDraft = pageDraftFor(request);
  const rawSources = rawSourcesFor(request, attribution);
  const librarianEnvelope = createLlmWikiLibrarianEnvelope({
    page: pageDraft,
    raw_sources: rawSources,
  });
  const librarianPlan = planLibrarianIngestionDryRun({
    envelope: librarianEnvelope,
    include_markdown_body_for_gateway_proposal:
      request.include_gateway_proposal_draft,
    proposal_markdown_body: request.include_gateway_proposal_draft
      ? markdownDraft
      : null,
    proposing_agent_id: "llm-wiki-draft-generator",
    proposing_agent_run_id: null,
  });
  const gatewayDraft = request.include_gateway_proposal_draft
    ? gatewayProposalDraft(request, markdownDraft)
    : null;
  if (gatewayDraft) reasons.push("gateway_draft_created");
  else reasons.push("gateway_draft_not_requested");

  return LlmWikiDraftResultSchema.parse({
    generator_version: LLM_WIKI_DRAFT_GENERATOR_VERSION,
    model_id: LLM_WIKI_DRAFT_MODEL_ID,
    accepted: true,
    markdown_draft: markdownDraft,
    confidence: confidenceFor(sourceCoverage, request.generation_scope),
    rationale: "Markdown draft generated from bounded source snippets.",
    source_coverage_score: sourceCoverage,
    source_attribution: attribution,
    unsupported_synthesis_warning: false,
    librarian_envelope_draft: librarianEnvelope,
    librarian_dry_run_plan: librarianPlan,
    gateway_proposal_draft: gatewayDraft,
    provider_result: providerSummary(providerResult),
    reasons: unique(reasons.length > 0 ? reasons : ["accepted"]),
    warnings: unique(warnings),
    governance: governanceSummary(true),
    write_attempted: false,
  });
}

function createFailClosedDeepSeekRuntime(): ModelRuntime {
  return createModelRuntime({
    registry: createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: deepseek-v4-flash
    provider: deepseek
    tier: T2
    runtime_class: cloud
    capabilities:
      - chat
      - summarize
      - classify
      - tool_reasoning
    context_window: 128000
    visibility: disabled
    priority: 90
    supports_streaming: true
    supports_tools: true
    supports_vision: false
    metadata:
      display_name: DeepSeek V4 Flash
      description: Fail-closed draft target metadata.
      approximate_memory_mb: null
      cost_class: cloud_metered_unverified
      governance_notes: Disabled by default; real execution requires explicit CLI runtime activation.
`),
    providers: {},
  });
}

function promptFor(
  request: LlmWikiDraftGeneratorInput,
  attribution: readonly LlmWikiDraftSourceAttribution[],
): string {
  const snippets = request.source_snippets
    .map(
      (snippet, index) =>
        `Source ${index + 1} (${snippet.source_id}):\n${snippet.snippet}`,
    )
    .join("\n\n");
  return [
    `Page title: ${request.page_plan.title}`,
    `Page type: ${request.page_plan.page_type}`,
    `Generation scope: ${request.generation_scope}`,
    "Required source attribution:",
    ...attribution.map(
      (source) => `- ${source.source_id} (${source.source_hash})`,
    ),
    "Source snippets:",
    snippets,
  ].join("\n");
}

function withAttributionBlock(
  content: string,
  attribution: readonly LlmWikiDraftSourceAttribution[],
): string {
  const block = [
    "## Source Attribution",
    ...attribution.map((source) =>
      [
        `- ${source.source_id}`,
        `hash: ${source.source_hash}`,
        source.path ? `path: ${source.path}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join("; "),
    ),
  ].join("\n");
  return `${content.trim()}\n\n${block}`.trim();
}

function attributionFor(
  request: LlmWikiDraftGeneratorInput,
): LlmWikiDraftSourceAttribution[] {
  const hashBySource = new Map(
    request.supporting_sources.map((source) => [
      source.source_id,
      source.content_hash,
    ]),
  );
  return request.page_plan.source_ids
    .map((sourceId, index) => {
      const source = request.supporting_sources.find(
        (entry) => entry.source_id === sourceId,
      );
      const sourceHash =
        source?.content_hash ??
        hashBySource.get(sourceId) ??
        request.page_plan.source_hashes[index];
      if (!sourceHash) return null;
      return LlmWikiDraftSourceAttributionSchema.parse({
        source_id: sourceId,
        source_hash: sourceHash,
        path: source?.path ?? null,
        title: source?.title ?? null,
      });
    })
    .filter((entry): entry is LlmWikiDraftSourceAttribution => entry !== null);
}

function sourceCoverageScore(request: LlmWikiDraftGeneratorInput): number {
  if (request.page_plan.source_ids.length === 0) return 0;
  const available = new Set(
    request.source_snippets.map((snippet) => snippet.source_id),
  );
  const covered = request.page_plan.source_ids.filter((sourceId) =>
    available.has(sourceId),
  ).length;
  return Math.min(1, covered / request.page_plan.source_ids.length);
}

function pageDraftFor(request: LlmWikiDraftGeneratorInput) {
  return LlmWikiPageDraftSchema.parse({
    contract_version: LLM_WIKI_CONTRACT_VERSION,
    page_id: request.page_plan.page_id,
    page_type: request.page_plan.page_type,
    title: request.page_plan.title,
    project: null,
    source_refs: request.page_plan.source_ids,
    source_hashes: request.page_plan.source_hashes,
    synthesis_supported: !request.unsupported_synthesis,
    derived_from_raw_sources: true,
    durable_requested: false,
    canonical_requested: false,
    approval_status: request.approval_status,
    approval_id: request.approval_id,
    sensitivity: "private",
    generated_at: request.created_at,
  });
}

function rawSourcesFor(
  request: LlmWikiDraftGeneratorInput,
  attribution: readonly LlmWikiDraftSourceAttribution[],
) {
  return attribution.map((source) =>
    LlmWikiRawSourceSchema.parse({
      source_type: rawSourceTypeForPage(request.page_plan.page_type),
      source_id: source.source_id,
      source_ref: source.path,
      content_hash: source.source_hash,
      captured_at: request.created_at,
      immutable: true,
      source_of_truth: true,
      raw_mutation_supported: false,
    }),
  );
}

function rawSourceTypeForPage(pageType: LlmWikiPageDraftPlan["page_type"]) {
  if (pageType === "system_page" || pageType === "project_page") {
    return "gitnexus";
  }
  return "user_note";
}

function gatewayProposalDraft(
  request: LlmWikiDraftGeneratorInput,
  markdownDraft: string,
): unknown {
  const frontmatter = frontmatterFor(request);
  return VaultWriteProposalSchema.parse({
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    proposal_id: `proposal:llm-wiki-draft.${slugPathSegment(
      request.page_plan.page_id,
    )}`,
    note_type: frontmatter.note_type,
    target_path: request.page_plan.target_path,
    frontmatter,
    markdown_body: markdownDraft,
    provenance: frontmatter.provenance,
    proposing_agent: {
      agent_id: "llm-wiki-draft-generator",
      agent_kind: "llm_wiki",
      run_id: null,
    },
    approval_required: true,
    approval_status: request.approval_status,
    approval_id: request.approval_id,
    sensitivity: "private",
    content_hash: request.page_plan.source_hashes[0],
    created_at: request.created_at,
  });
}

function frontmatterFor(request: LlmWikiDraftGeneratorInput): VaultFrontmatter {
  const noteType = LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE[request.page_plan.page_type];
  return {
    schema_version: VAULT_FRONTMATTER_SCHEMA_VERSION,
    id: `note:${slugPathSegment(request.page_plan.page_id)}`,
    title: request.page_plan.title,
    note_type: noteType,
    domain: "wiki",
    status: "candidate",
    created_at: request.created_at,
    updated_at: request.created_at,
    tags: ["llm-wiki", request.page_plan.page_type, request.generation_scope],
    sensitivity: "private",
    project: null,
    provenance: {
      source_type: "system",
      source_id: request.page_plan.page_id,
      source_url: null,
      content_hash: request.page_plan.source_hashes[0],
    },
    agent: {
      created_by: "llm-wiki-draft-generator",
      run_id: null,
      model_id: LLM_WIKI_DRAFT_MODEL_ID,
      promotion_status: "candidate",
    },
    links: {
      related: [],
      sources: request.page_plan.source_ids,
      decisions: [],
    },
    lifecycle: {
      durable: false,
      canonical: false,
      approval_status: request.approval_status,
      approval_id: approvalIdForFrontmatter(request.approval_id),
      review_after: null,
      supersedes: [],
      superseded_by: [],
    },
  };
}

function approvalIdForFrontmatter(
  approvalId: string | null,
): `approval:${string}` | null {
  if (approvalId === null) return null;
  return approvalId as `approval:${string}`;
}

function confidenceFor(
  sourceCoverage: number,
  scope: LlmWikiGenerationScope,
): number {
  const scopePenalty =
    scope === "merge_pages" || scope === "refresh_page" ? 0.1 : 0;
  return Math.max(0.2, Math.min(0.95, sourceCoverage - scopePenalty));
}

function providerSummary(
  result: ModelRuntimeExecuteResult | null,
): z.infer<typeof LlmWikiDraftResultSchema>["provider_result"] {
  return {
    attempted: result !== null,
    ok: result?.ok ?? false,
    failure_class: result?.metadata.failure_class ?? null,
    selected_model_id: result?.metadata.selected_model_id ?? null,
    successful_model: result?.metadata.successful_model ?? null,
    provider_id: result?.response?.provider_id ?? null,
    redaction_status:
      result?.response?.redaction_status ??
      result?.metadata.execution_summary.redaction_status ??
      null,
  };
}

function baseResult(input: {
  readonly request: LlmWikiDraftGeneratorInput;
  readonly attribution: readonly LlmWikiDraftSourceAttribution[];
  readonly sourceCoverage: number;
  readonly reasons: readonly LlmWikiDraftGeneratorReason[];
  readonly warnings: readonly LlmWikiDraftGeneratorWarning[];
  readonly providerResult?: ModelRuntimeExecuteResult | null;
}) {
  return {
    generator_version: LLM_WIKI_DRAFT_GENERATOR_VERSION,
    model_id: LLM_WIKI_DRAFT_MODEL_ID,
    accepted: false,
    markdown_draft: "",
    confidence: 0,
    rationale: "Draft generation failed closed.",
    source_coverage_score: input.sourceCoverage,
    source_attribution: input.attribution,
    unsupported_synthesis_warning:
      input.request.unsupported_synthesis ||
      input.reasons.includes("unsupported_synthesis"),
    librarian_envelope_draft: null,
    librarian_dry_run_plan: null,
    gateway_proposal_draft: null,
    provider_result: providerSummary(input.providerResult ?? null),
    reasons: unique(input.reasons),
    warnings: unique(input.warnings),
    governance: governanceSummary(false),
    write_attempted: false,
  };
}

function rejectedDraft(
  reason: LlmWikiDraftGeneratorReason,
): LlmWikiDraftResult {
  return LlmWikiDraftResultSchema.parse({
    generator_version: LLM_WIKI_DRAFT_GENERATOR_VERSION,
    model_id: LLM_WIKI_DRAFT_MODEL_ID,
    accepted: false,
    markdown_draft: "",
    confidence: 0,
    rationale: "Draft generation input was invalid.",
    source_coverage_score: 0,
    source_attribution: [],
    unsupported_synthesis_warning: false,
    librarian_envelope_draft: null,
    librarian_dry_run_plan: null,
    gateway_proposal_draft: null,
    provider_result: providerSummary(null),
    reasons: [reason],
    warnings: ["draft_only_no_write_executed", "deepseek_disabled_by_default"],
    governance: governanceSummary(false),
    write_attempted: false,
  });
}

function governanceSummary(
  draftGenerated: boolean,
): z.infer<typeof LlmWikiDraftResultSchema>["governance"] {
  return {
    draft_generated: draftGenerated,
    write_attempted: false,
    vault_mutated: false,
    vault_write_executed: false,
    gateway_execution_called: false,
    approval_bypassed: false,
    scheduler_started: false,
    watcher_started: false,
    background_job_started: false,
  };
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}
