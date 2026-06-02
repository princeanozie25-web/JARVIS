import { z } from "zod";
import {
  LLM_WIKI_CONTRACT_VERSION,
  LLM_WIKI_LINT_FINDINGS,
  LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE,
  LLM_WIKI_SPECIAL_FILES,
  LlmWikiLintFindingResultSchema,
  LlmWikiMaintenanceOperationSchema,
  LlmWikiPageDraftSchema,
  LlmWikiPageTypeSchema,
  LlmWikiRawSourceSchema,
  createLlmWikiLibrarianEnvelope,
  lintLlmWikiPageDraft,
  planLlmWikiMaintenanceOperation,
  type LlmWikiLintFindingResult,
  type LlmWikiMaintenanceOperation,
  type LlmWikiPageDraft,
  type LlmWikiPageType,
  type LlmWikiRawSource,
} from "./llm-wiki-contract";
import {
  LIBRARIAN_DRY_RUN_PLANNER_VERSION,
  LibrarianDryRunPlanSchema,
  planLibrarianIngestionDryRun,
  type LibrarianDryRunPlan,
} from "./librarian-dry-run-planner";
import {
  VaultWriteProposalSchema,
  type VaultWriteProposal,
} from "./write-gateway";
import { slugPathSegment } from "./routing";

export const LLM_WIKI_DRY_RUN_PLANNER_VERSION =
  "phase21.llm-wiki-dry-run.v1" as const;

export const LLM_WIKI_DRY_RUN_REASONS = [
  "accepted",
  "input_invalid",
  "source_not_immutable",
  "operation_not_supported",
  "unsupported_synthesis",
  "weak_source_attribution",
  "duplicate_page",
  "durable_requires_approval",
  "gateway_proposal_ready",
  "gateway_proposal_not_requested",
  "gateway_proposal_body_required",
] as const;

export const LLM_WIKI_DRY_RUN_WARNINGS = [
  "dry_run_only_no_write_executed",
  "index_modeled_not_written",
  "log_modeled_not_written",
  "raw_source_not_mutated",
  "metadata_only_output",
  "librarian_envelope_draft_only",
  "gateway_proposal_draft_only",
  "unsupported_synthesis_flagged",
  "duplicate_page_warning",
] as const;

const WikiSnapshotPageSchema = z.strictObject({
  page_id: z.string().trim().min(1),
  page_type: LlmWikiPageTypeSchema,
  title: z.string().trim().min(1),
  path: z.string().trim().min(1),
  source_ids: z.array(z.string().trim().min(1)).default([]),
  source_hashes: z
    .array(z.string().trim().regex(/^sha256:[a-f0-9]{64}$/))
    .default([]),
  backlinks: z.array(z.string().trim().min(1)).default([]),
  hub_id: z.string().trim().min(1).nullable().default(null),
  updated_at: z.string().trim().datetime({ offset: true }).nullable().default(null),
});

const WikiSnapshotSchema = z.strictObject({
  pages: z.array(WikiSnapshotPageSchema).default([]),
  index_entries: z.array(z.string().trim().min(1)).default([]),
  log_entry_ids: z.array(z.string().trim().min(1)).default([]),
});

const PagePreferenceSchema = z.strictObject({
  page_type: LlmWikiPageTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  project: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)
    .nullable()
    .optional(),
  durable_requested: z.boolean().optional(),
  canonical_requested: z.boolean().optional(),
  approval_status: z
    .enum(["not_required", "pending", "approved", "denied", "expired"])
    .optional(),
  approval_id: z
    .string()
    .trim()
    .regex(/^approval:[a-z0-9]+(?:[._:-][a-z0-9]+)*$/)
    .nullable()
    .optional(),
  synthesis_supported: z.boolean().optional(),
});

export const LlmWikiMaintenanceDryRunInputSchema = z.strictObject({
  source_envelope: LlmWikiRawSourceSchema,
  existing_wiki_snapshot: WikiSnapshotSchema.default({
    pages: [],
    index_entries: [],
    log_entry_ids: [],
  }),
  requested_operation: LlmWikiMaintenanceOperationSchema,
  page_preference: PagePreferenceSchema.nullable().default(null),
  include_gateway_proposal_draft: z.boolean().default(false),
  proposal_markdown_body: z.string().nullable().default(null),
});

export const LlmWikiIndexDraftSchema = z.strictObject({
  path: z.literal("10-wiki/index.md"),
  operation: z.enum(["none", "add_or_update_entry"]),
  entry_title: z.string().trim().min(1).nullable(),
  target_page_id: z.string().trim().min(1).nullable(),
  write_supported: z.literal(false),
});

export const LlmWikiLogDraftSchema = z.strictObject({
  path: z.literal("10-wiki/log.md"),
  operation: z.enum(["none", "append_entry"]),
  entry_id: z.string().trim().min(1).nullable(),
  entry_summary: z.string().trim().min(1).nullable(),
  append_only_future_slice: z.literal(true),
  write_supported: z.literal(false),
});

export const LlmWikiPagePlanSchema = z.strictObject({
  action: z.enum(["create_page_draft", "update_page_draft", "none"]),
  page: LlmWikiPageDraftSchema.nullable(),
  source_ids: z.array(z.string().trim().min(1)),
  source_hashes: z.array(z.string().trim().regex(/^sha256:[a-f0-9]{64}$/)),
  source_type: z.string().trim().min(1),
  unsupported_synthesis: z.boolean(),
  write_supported: z.literal(false),
});

export const LlmWikiMaintenanceDryRunPlanSchema = z.strictObject({
  planner_version: z.literal(LLM_WIKI_DRY_RUN_PLANNER_VERSION),
  contract_version: z.literal(LLM_WIKI_CONTRACT_VERSION),
  librarian_planner_version: z.literal(LIBRARIAN_DRY_RUN_PLANNER_VERSION),
  accepted: z.boolean(),
  maintenance_operation: LlmWikiMaintenanceOperationSchema,
  page_plans: z.array(LlmWikiPagePlanSchema),
  index_draft: LlmWikiIndexDraftSchema,
  log_draft: LlmWikiLogDraftSchema,
  lint_findings: z.array(LlmWikiLintFindingResultSchema),
  librarian_envelope_drafts: z.array(z.unknown()),
  librarian_dry_run_plans: z.array(LibrarianDryRunPlanSchema),
  gateway_proposal_drafts: z.array(VaultWriteProposalSchema),
  reasons: z.array(z.enum(LLM_WIKI_DRY_RUN_REASONS)),
  warnings: z.array(z.enum(LLM_WIKI_DRY_RUN_WARNINGS)),
  governance: z.strictObject({
    raw_sources_immutable: z.literal(true),
    raw_source_mutated: z.literal(false),
    write_attempted: z.literal(false),
    vault_mutated: z.literal(false),
    vault_write_executed: z.literal(false),
    llm_calls_made: z.literal(false),
    network_used: z.literal(false),
    scheduler_started: z.literal(false),
    watcher_started: z.literal(false),
    background_job_started: z.literal(false),
    index_log_modeled_only: z.literal(true),
  }),
  write_attempted: z.literal(false),
});

export type LlmWikiSnapshotPage = z.infer<typeof WikiSnapshotPageSchema>;
export type LlmWikiSnapshot = z.infer<typeof WikiSnapshotSchema>;
export type LlmWikiPagePreference = z.infer<typeof PagePreferenceSchema>;
export type LlmWikiMaintenanceDryRunInput = z.infer<
  typeof LlmWikiMaintenanceDryRunInputSchema
>;
export type LlmWikiIndexDraft = z.infer<typeof LlmWikiIndexDraftSchema>;
export type LlmWikiLogDraft = z.infer<typeof LlmWikiLogDraftSchema>;
export type LlmWikiPagePlan = z.infer<typeof LlmWikiPagePlanSchema>;
export type LlmWikiMaintenanceDryRunPlan = z.infer<
  typeof LlmWikiMaintenanceDryRunPlanSchema
>;
export type LlmWikiDryRunReason =
  (typeof LLM_WIKI_DRY_RUN_REASONS)[number];
export type LlmWikiDryRunWarning =
  (typeof LLM_WIKI_DRY_RUN_WARNINGS)[number];

export function planLlmWikiMaintenanceDryRun(
  input: unknown,
): LlmWikiMaintenanceDryRunPlan {
  const parsed = LlmWikiMaintenanceDryRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedPlan("input_invalid");
  }

  const request = parsed.data;
  const source = request.source_envelope;
  const operationContract = planLlmWikiMaintenanceOperation(
    request.requested_operation,
  );
  const page = pageDraftForRequest(request);
  const pagePlan = pagePlanForRequest(request, page);
  const lintFindings = [
    ...lintLlmWikiPageDraft(page),
    ...snapshotLintFindings(request, page),
  ];
  const indexDraft = indexDraftForPage(page);
  const logDraft = logDraftForPage(request.requested_operation, page);
  const librarianEnvelope = createLlmWikiLibrarianEnvelope({
    page,
    raw_sources: [source],
  });
  const librarianPlan = planLibrarianIngestionDryRun({
    envelope: librarianEnvelope,
    include_markdown_body_for_gateway_proposal:
      request.include_gateway_proposal_draft,
    proposal_markdown_body: request.proposal_markdown_body,
    proposing_agent_id: "llm-wiki",
    proposing_agent_run_id: null,
  });
  const reasons: LlmWikiDryRunReason[] = [];
  const warnings: LlmWikiDryRunWarning[] = [
    "dry_run_only_no_write_executed",
    "index_modeled_not_written",
    "log_modeled_not_written",
    "raw_source_not_mutated",
    "metadata_only_output",
    "librarian_envelope_draft_only",
  ];

  if (!source.immutable || !source.source_of_truth) {
    reasons.push("source_not_immutable");
  }
  if (!operationContract.dry_run_only) {
    reasons.push("operation_not_supported");
  }
  if (page.page_type === "synthesis_page" && !page.synthesis_supported) {
    reasons.push("unsupported_synthesis");
    warnings.push("unsupported_synthesis_flagged");
  }
  if (page.source_refs.length === 0 || page.source_hashes.length === 0) {
    reasons.push("weak_source_attribution");
  }
  if (
    lintFindings.some((finding) => finding.finding === "duplicate_page")
  ) {
    reasons.push("duplicate_page");
    warnings.push("duplicate_page_warning");
  }
  if (
    (page.durable_requested || page.canonical_requested) &&
    page.approval_status !== "approved"
  ) {
    reasons.push("durable_requires_approval");
  }
  if (librarianPlan.gateway_proposal_draft) {
    reasons.push("gateway_proposal_ready");
    warnings.push("gateway_proposal_draft_only");
  } else if (request.include_gateway_proposal_draft) {
    reasons.push("gateway_proposal_body_required");
  } else {
    reasons.push("gateway_proposal_not_requested");
  }
  if (reasons.length === 0) {
    reasons.push("accepted");
  }

  const gatewayDrafts = librarianPlan.gateway_proposal_draft
    ? [librarianPlan.gateway_proposal_draft]
    : [];

  return LlmWikiMaintenanceDryRunPlanSchema.parse({
    planner_version: LLM_WIKI_DRY_RUN_PLANNER_VERSION,
    contract_version: LLM_WIKI_CONTRACT_VERSION,
    librarian_planner_version: LIBRARIAN_DRY_RUN_PLANNER_VERSION,
    accepted: accepted(reasons),
    maintenance_operation: request.requested_operation,
    page_plans: [pagePlan],
    index_draft: indexDraft,
    log_draft: logDraft,
    lint_findings: lintFindings,
    librarian_envelope_drafts: [librarianEnvelope],
    librarian_dry_run_plans: [librarianPlan],
    gateway_proposal_drafts: gatewayDrafts,
    reasons: unique(reasons),
    warnings: unique(warnings),
    governance: governanceSummary(),
    write_attempted: false,
  });
}

function pageDraftForRequest(
  request: LlmWikiMaintenanceDryRunInput,
): LlmWikiPageDraft {
  const source = request.source_envelope;
  const preference = request.page_preference;
  const pageType = pageTypeForOperation(request.requested_operation, preference);
  const title =
    preference?.title ??
    titleFromSource(source.source_id, pageType);
  const pageId = `llm-wiki:${slugPathSegment(title)}`;

  return LlmWikiPageDraftSchema.parse({
    contract_version: LLM_WIKI_CONTRACT_VERSION,
    page_id: pageId,
    page_type: pageType,
    title,
    project: preference?.project ?? null,
    source_refs: [source.source_id],
    source_hashes: [source.content_hash],
    synthesis_supported: preference?.synthesis_supported ?? true,
    derived_from_raw_sources: true,
    durable_requested: preference?.durable_requested ?? false,
    canonical_requested: preference?.canonical_requested ?? false,
    approval_status: preference?.approval_status ?? "pending",
    approval_id: preference?.approval_id ?? null,
    sensitivity: "private",
    generated_at: source.captured_at,
  });
}

function pagePlanForRequest(
  request: LlmWikiMaintenanceDryRunInput,
  page: LlmWikiPageDraft,
): LlmWikiPagePlan {
  const existing = findExistingPage(request.existing_wiki_snapshot, page);
  return LlmWikiPagePlanSchema.parse({
    action: existing ? "update_page_draft" : "create_page_draft",
    page,
    source_ids: page.source_refs,
    source_hashes: page.source_hashes,
    source_type: request.source_envelope.source_type,
    unsupported_synthesis:
      page.page_type === "synthesis_page" && !page.synthesis_supported,
    write_supported: false,
  });
}

function pageTypeForOperation(
  operation: LlmWikiMaintenanceOperation,
  preference: LlmWikiPagePreference | null,
): LlmWikiPageType {
  if (preference?.page_type) {
    return preference.page_type;
  }
  if (operation === "ingest_source") return "source_page";
  if (operation === "update_entity_concept_pages") return "concept_page";
  if (operation === "file_useful_answer_back_into_wiki") {
    return "synthesis_page";
  }
  return "concept_page";
}

function titleFromSource(
  sourceId: string,
  pageType: LlmWikiPageType,
): string {
  const base = sourceId.split(":").at(-1) ?? sourceId;
  const readable = base
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  const suffix = LLM_WIKI_PAGE_TYPE_TO_NOTE_TYPE[pageType].replace("_", " ");
  return readable || `Untitled ${suffix}`;
}

function indexDraftForPage(page: LlmWikiPageDraft): LlmWikiIndexDraft {
  return LlmWikiIndexDraftSchema.parse({
    path: specialFilePath("index"),
    operation: "add_or_update_entry",
    entry_title: page.title,
    target_page_id: page.page_id,
    write_supported: false,
  });
}

function logDraftForPage(
  operation: LlmWikiMaintenanceOperation,
  page: LlmWikiPageDraft,
): LlmWikiLogDraft {
  return LlmWikiLogDraftSchema.parse({
    path: specialFilePath("log"),
    operation: "append_entry",
    entry_id: `llm-wiki-log:${slugPathSegment(`${operation}-${page.page_id}`)}`,
    entry_summary: `${operation}: ${page.title}`,
    append_only_future_slice: true,
    write_supported: false,
  });
}

function snapshotLintFindings(
  request: LlmWikiMaintenanceDryRunInput,
  page: LlmWikiPageDraft,
): LlmWikiLintFindingResult[] {
  const findings: LlmWikiLintFindingResult[] = [];
  const existing = findExistingPage(request.existing_wiki_snapshot, page);

  if (existing) {
    findings.push(
      lintFinding(
        "duplicate_page",
        "warning",
        page.page_id,
        `Existing page already matches ${existing.path}.`,
      ),
    );
  }
  if (
    !request.existing_wiki_snapshot.pages.some(
      (snapshotPage) => snapshotPage.page_type === "hub_page",
    ) &&
    page.page_type !== "hub_page"
  ) {
    findings.push(
      lintFinding(
        "missing_hub_page",
        "warning",
        page.page_id,
        "Wiki snapshot has no hub page for this planned page.",
      ),
    );
  }
  if (
    request.requested_operation === "update_index" &&
    !request.existing_wiki_snapshot.index_entries.includes(page.page_id)
  ) {
    findings.push(
      lintFinding(
        "outdated_index_entry",
        "warning",
        page.page_id,
        "Index snapshot does not contain this planned page.",
      ),
    );
  }
  if (
    page.page_type !== "hub_page" &&
    existing &&
    existing.backlinks.length === 0
  ) {
    findings.push(
      lintFinding(
        "missing_backlink",
        "warning",
        page.page_id,
        "Existing matching page has no backlinks in the snapshot.",
      ),
    );
  }

  return findings;
}

function findExistingPage(
  snapshot: LlmWikiSnapshot,
  page: LlmWikiPageDraft,
): LlmWikiSnapshotPage | undefined {
  const plannedSlug = slugPathSegment(page.title);
  return snapshot.pages.find(
    (snapshotPage) =>
      snapshotPage.page_id === page.page_id ||
      slugPathSegment(snapshotPage.title) === plannedSlug,
  );
}

function lintFinding(
  finding: (typeof LLM_WIKI_LINT_FINDINGS)[number],
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

function specialFilePath(kind: "index" | "log"): string {
  const file = LLM_WIKI_SPECIAL_FILES.find((entry) => entry.kind === kind);
  if (!file) {
    throw new Error(`Missing LLM Wiki special file contract for ${kind}.`);
  }
  return file.path;
}

function accepted(reasons: readonly LlmWikiDryRunReason[]): boolean {
  return !reasons.some((reason) =>
    [
      "input_invalid",
      "source_not_immutable",
      "operation_not_supported",
      "unsupported_synthesis",
      "weak_source_attribution",
      "duplicate_page",
    ].includes(reason),
  );
}

function rejectedPlan(
  reason: LlmWikiDryRunReason,
): LlmWikiMaintenanceDryRunPlan {
  return LlmWikiMaintenanceDryRunPlanSchema.parse({
    planner_version: LLM_WIKI_DRY_RUN_PLANNER_VERSION,
    contract_version: LLM_WIKI_CONTRACT_VERSION,
    librarian_planner_version: LIBRARIAN_DRY_RUN_PLANNER_VERSION,
    accepted: false,
    maintenance_operation: "lint_wiki",
    page_plans: [],
    index_draft: {
      path: "10-wiki/index.md",
      operation: "none",
      entry_title: null,
      target_page_id: null,
      write_supported: false,
    },
    log_draft: {
      path: "10-wiki/log.md",
      operation: "none",
      entry_id: null,
      entry_summary: null,
      append_only_future_slice: true,
      write_supported: false,
    },
    lint_findings: [],
    librarian_envelope_drafts: [],
    librarian_dry_run_plans: [],
    gateway_proposal_drafts: [],
    reasons: [reason],
    warnings: [
      "dry_run_only_no_write_executed",
      "index_modeled_not_written",
      "log_modeled_not_written",
      "metadata_only_output",
    ],
    governance: governanceSummary(),
    write_attempted: false,
  });
}

function governanceSummary(): z.infer<
  typeof LlmWikiMaintenanceDryRunPlanSchema
>["governance"] {
  return {
    raw_sources_immutable: true,
    raw_source_mutated: false,
    write_attempted: false,
    vault_mutated: false,
    vault_write_executed: false,
    llm_calls_made: false,
    network_used: false,
    scheduler_started: false,
    watcher_started: false,
    background_job_started: false,
    index_log_modeled_only: true,
  };
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}

export type LlmWikiGatewayProposalDraft = VaultWriteProposal;
