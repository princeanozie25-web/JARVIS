import { z } from "zod";
import type { VaultApprovalStatus } from "./taxonomy";
import {
  LIBRARIAN_CONTRACT_VERSION,
  LibrarianIngestionEnvelopeSchema,
  planLibrarianIngestion,
  type LibrarianClassification,
  type LibrarianIngestionEnvelope,
} from "./librarian-contract";
import { slugPathSegment } from "./routing";
import {
  VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
  VaultWriteProposalSchema,
  type VaultWriteProposal,
} from "./write-gateway";

export const LIBRARIAN_DRY_RUN_PLANNER_VERSION =
  "phase21.librarian-dry-run.v1" as const;

export const LIBRARIAN_DEDUPE_STATUSES = [
  "not_checked",
  "no_match",
  "exact_duplicate",
  "source_duplicate",
  "possible_duplicate",
] as const;

export const LIBRARIAN_PROMOTION_RECOMMENDATIONS = [
  "stay_transient",
  "promote_to_candidate",
  "propose_durable_write",
  "reject",
] as const;

export const LIBRARIAN_DRY_RUN_REASONS = [
  "accepted",
  "envelope_invalid",
  "duplicate_exact_content",
  "duplicate_source",
  "possible_duplicate_metadata",
  "route_preference_mismatch",
  "librarian_contract_rejected",
  "proposal_body_required",
  "gateway_proposal_ready",
  "gateway_proposal_not_applicable",
] as const;

export const LIBRARIAN_DRY_RUN_WARNINGS = [
  "dry_run_only_no_write_executed",
  "metadata_only_output",
  "duplicate_warning",
  "approval_required_before_durable_write",
  "proposal_draft_contains_markdown_body",
  "proposal_draft_omitted_without_body",
] as const;

const ExistingMetadataEntrySchema = z.strictObject({
  note_id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  path: z.string().trim().min(1),
  content_hash: z
    .string()
    .trim()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .nullable()
    .default(null),
  source_type: z.string().trim().min(1).nullable().default(null),
  source_id: z.string().trim().min(1).nullable().default(null),
  note_type: z.string().trim().min(1).nullable().default(null),
});

const RoutePreferenceSchema = z.strictObject({
  route_target: z
    .enum([
      "inbox",
      "wiki",
      "project",
      "research",
      "learning",
      "career",
      "agent",
      "reference",
      "review",
      "archive",
      "meta",
    ])
    .nullable()
    .default(null),
  target_folder: z.string().trim().min(1).nullable().default(null),
});

export const LibrarianDryRunPlannerInputSchema = z.strictObject({
  envelope: LibrarianIngestionEnvelopeSchema,
  existing_metadata_index: z
    .array(ExistingMetadataEntrySchema)
    .default([]),
  route_preference: RoutePreferenceSchema.nullable().default(null),
  proposal_markdown_body: z.string().nullable().default(null),
  include_markdown_body_for_gateway_proposal: z.boolean().default(false),
  proposing_agent_id: z.string().trim().min(1).default("librarian"),
  proposing_agent_run_id: z.string().trim().min(1).nullable().default(null),
});

export const LibrarianDedupeResultSchema = z.strictObject({
  status: z.enum(LIBRARIAN_DEDUPE_STATUSES),
  duplicate_note_ids: z.array(z.string()),
  duplicate_paths: z.array(z.string()),
  checked_content_hash: z.boolean(),
  checked_source_id: z.boolean(),
  checked_title_path: z.boolean(),
  embedding_execution_used: z.literal(false),
  vector_lookup_used: z.literal(false),
});

export const LibrarianPromotionRecommendationSchema = z.strictObject({
  recommendation: z.enum(LIBRARIAN_PROMOTION_RECOMMENDATIONS),
  required_approval: z.boolean(),
  approval_status: z.enum([
    "not_required",
    "pending",
    "approved",
    "denied",
    "expired",
  ]),
  human_approval_required: z.boolean(),
  gateway_proposal_recommended: z.boolean(),
});

export const LibrarianDryRunPlanSchema = z.strictObject({
  planner_version: z.literal(LIBRARIAN_DRY_RUN_PLANNER_VERSION),
  contract_version: z.literal(LIBRARIAN_CONTRACT_VERSION),
  accepted: z.boolean(),
  classification: z
    .enum(["transient", "candidate", "durable", "canonical"])
    .nullable(),
  target_route: z.strictObject({
    route_target: z
      .enum([
        "inbox",
        "wiki",
        "project",
        "research",
        "learning",
        "career",
        "agent",
        "reference",
        "review",
        "archive",
        "meta",
      ])
      .nullable(),
    target_folder: z.string().trim().min(1).nullable(),
  }),
  dedupe: LibrarianDedupeResultSchema,
  promotion: LibrarianPromotionRecommendationSchema,
  gateway_proposal_draft: VaultWriteProposalSchema.nullable(),
  reasons: z.array(z.enum(LIBRARIAN_DRY_RUN_REASONS)),
  warnings: z.array(z.enum(LIBRARIAN_DRY_RUN_WARNINGS)),
  redaction_summary: z.strictObject({
    metadata_only: z.literal(true),
    raw_body_included: z.literal(false),
    markdown_body_included: z.boolean(),
    markdown_body_included_only_in_gateway_proposal: z.boolean(),
  }),
  write_attempted: z.literal(false),
  vault_mutated: z.literal(false),
});

export type LibrarianExistingMetadataEntry = z.infer<
  typeof ExistingMetadataEntrySchema
>;
export type LibrarianDryRunPlannerInput = z.infer<
  typeof LibrarianDryRunPlannerInputSchema
>;
export type LibrarianDedupeStatus =
  (typeof LIBRARIAN_DEDUPE_STATUSES)[number];
export type LibrarianPromotionRecommendation =
  (typeof LIBRARIAN_PROMOTION_RECOMMENDATIONS)[number];
export type LibrarianDryRunReason =
  (typeof LIBRARIAN_DRY_RUN_REASONS)[number];
export type LibrarianDryRunWarning =
  (typeof LIBRARIAN_DRY_RUN_WARNINGS)[number];
export type LibrarianDryRunPlan = z.infer<typeof LibrarianDryRunPlanSchema>;

export function planLibrarianIngestionDryRun(
  input: unknown,
): LibrarianDryRunPlan {
  const parsed = LibrarianDryRunPlannerInputSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedDryRun("envelope_invalid");
  }

  const plannerInput = parsed.data;
  const envelope = plannerInput.envelope;
  const contractDecision = planLibrarianIngestion(envelope);
  const dedupe = dedupeEnvelope(
    envelope,
    plannerInput.existing_metadata_index,
  );
  const reasons: LibrarianDryRunReason[] = [];
  const warnings: LibrarianDryRunWarning[] = [
    "dry_run_only_no_write_executed",
    "metadata_only_output",
  ];

  if (!contractDecision.accepted) {
    reasons.push("librarian_contract_rejected");
  }
  if (dedupe.status === "exact_duplicate") {
    reasons.push("duplicate_exact_content");
  } else if (dedupe.status === "source_duplicate") {
    reasons.push("duplicate_source");
  } else if (dedupe.status === "possible_duplicate") {
    reasons.push("possible_duplicate_metadata");
    warnings.push("duplicate_warning");
  }
  if (routePreferenceMismatch(plannerInput, contractDecision)) {
    reasons.push("route_preference_mismatch");
  }

  const recommendation = promotionRecommendation(
    contractDecision.classification,
    contractDecision.promotion.approval_required,
    contractDecision.promotion.approval_status,
    contractDecision.promotion.human_approval_required,
    reasons,
  );
  const gatewayProposal = gatewayProposalDraft(
    plannerInput,
    recommendation,
    reasons,
    warnings,
  );

  if (gatewayProposal) {
    reasons.push("gateway_proposal_ready");
    warnings.push("proposal_draft_contains_markdown_body");
  } else if (recommendation.gateway_proposal_recommended) {
    reasons.push("proposal_body_required");
    warnings.push("proposal_draft_omitted_without_body");
  } else {
    reasons.push("gateway_proposal_not_applicable");
  }
  if (recommendation.required_approval) {
    warnings.push("approval_required_before_durable_write");
  }
  if (reasons.length === 0) {
    reasons.push("accepted");
  }

  const blockingReasons = reasons.filter((reason) =>
    [
      "librarian_contract_rejected",
      "duplicate_exact_content",
      "duplicate_source",
      "route_preference_mismatch",
      "proposal_body_required",
    ].includes(reason),
  );

  return LibrarianDryRunPlanSchema.parse({
    planner_version: LIBRARIAN_DRY_RUN_PLANNER_VERSION,
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    accepted: blockingReasons.length === 0,
    classification: contractDecision.classification,
    target_route: {
      route_target: contractDecision.route_target,
      target_folder: contractDecision.target_folder,
    },
    dedupe,
    promotion: recommendation,
    gateway_proposal_draft: gatewayProposal,
    reasons: unique(reasons),
    warnings: unique(warnings),
    redaction_summary: {
      metadata_only: true,
      raw_body_included: false,
      markdown_body_included: gatewayProposal !== null,
      markdown_body_included_only_in_gateway_proposal: gatewayProposal !== null,
    },
    write_attempted: false,
    vault_mutated: false,
  });
}

function dedupeEnvelope(
  envelope: LibrarianIngestionEnvelope,
  index: readonly LibrarianExistingMetadataEntry[],
): z.infer<typeof LibrarianDedupeResultSchema> {
  if (index.length === 0) {
    return dedupeResult("no_match", []);
  }

  const exact = index.filter(
    (entry) =>
      entry.content_hash !== null && entry.content_hash === envelope.content_hash,
  );
  if (exact.length > 0) {
    return dedupeResult("exact_duplicate", exact);
  }

  const sourceDuplicate = index.filter(
    (entry) =>
      entry.source_id !== null &&
      entry.source_id === envelope.source.source_id &&
      entry.source_type === envelope.source.source_type,
  );
  if (sourceDuplicate.length > 0) {
    return dedupeResult("source_duplicate", sourceDuplicate);
  }

  const titleSlug = slugPathSegment(envelope.proposed_frontmatter.title);
  const titleMatch = index.filter(
    (entry) =>
      slugPathSegment(entry.title) === titleSlug ||
      entry.path.endsWith(`/${titleSlug}.md`),
  );
  if (titleMatch.length > 0) {
    return dedupeResult("possible_duplicate", titleMatch);
  }

  return dedupeResult("no_match", []);
}

function dedupeResult(
  status: LibrarianDedupeStatus,
  matches: readonly LibrarianExistingMetadataEntry[],
): z.infer<typeof LibrarianDedupeResultSchema> {
  return {
    status,
    duplicate_note_ids: matches.map((match) => match.note_id),
    duplicate_paths: matches.map((match) => match.path),
    checked_content_hash: true,
    checked_source_id: true,
    checked_title_path: true,
    embedding_execution_used: false,
    vector_lookup_used: false,
  };
}

function routePreferenceMismatch(
  plannerInput: LibrarianDryRunPlannerInput,
  contractDecision: ReturnType<typeof planLibrarianIngestion>,
): boolean {
  const routePreference = plannerInput.route_preference;
  if (!routePreference) {
    return false;
  }
  if (
    routePreference.route_target !== null &&
    routePreference.route_target !== contractDecision.route_target
  ) {
    return true;
  }
  return (
    routePreference.target_folder !== null &&
    routePreference.target_folder !== contractDecision.target_folder
  );
}

function promotionRecommendation(
  classification: LibrarianClassification | null,
  requiredApproval: boolean,
  approvalStatus: VaultApprovalStatus,
  humanApprovalRequired: boolean,
  reasons: readonly LibrarianDryRunReason[],
): z.infer<typeof LibrarianPromotionRecommendationSchema> {
  if (
    classification === null ||
    reasons.some((reason) =>
      [
        "librarian_contract_rejected",
        "duplicate_exact_content",
        "duplicate_source",
        "route_preference_mismatch",
      ].includes(reason),
    )
  ) {
    return recommendation("reject", requiredApproval, approvalStatus, true);
  }
  if (classification === "transient") {
    return recommendation(
      "stay_transient",
      false,
      approvalStatus,
      humanApprovalRequired,
    );
  }
  if (classification === "candidate") {
    return recommendation(
      "promote_to_candidate",
      false,
      approvalStatus,
      humanApprovalRequired,
    );
  }
  return recommendation(
    "propose_durable_write",
    true,
    approvalStatus,
    humanApprovalRequired || approvalStatus !== "approved",
  );
}

function recommendation(
  value: LibrarianPromotionRecommendation,
  requiredApproval: boolean,
  approvalStatus: VaultApprovalStatus,
  humanApprovalRequired: boolean,
): z.infer<typeof LibrarianPromotionRecommendationSchema> {
  return {
    recommendation: value,
    required_approval: requiredApproval,
    approval_status: approvalStatus,
    human_approval_required: humanApprovalRequired,
    gateway_proposal_recommended: value === "propose_durable_write",
  };
}

function gatewayProposalDraft(
  plannerInput: LibrarianDryRunPlannerInput,
  recommendationResult: z.infer<typeof LibrarianPromotionRecommendationSchema>,
  reasons: readonly LibrarianDryRunReason[],
  warnings: LibrarianDryRunWarning[],
): VaultWriteProposal | null {
  if (
    !recommendationResult.gateway_proposal_recommended ||
    reasons.some((reason) =>
      [
        "librarian_contract_rejected",
        "duplicate_exact_content",
        "duplicate_source",
        "route_preference_mismatch",
      ].includes(reason),
    )
  ) {
    return null;
  }
  if (
    !plannerInput.include_markdown_body_for_gateway_proposal ||
    !plannerInput.proposal_markdown_body?.trim()
  ) {
    warnings.push("proposal_draft_omitted_without_body");
    return null;
  }

  const envelope = plannerInput.envelope;
  const proposal = {
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    proposal_id: proposalIdFromEnvelope(envelope.envelope_id),
    note_type: envelope.proposed_frontmatter.note_type,
    target_path: targetPathForEnvelope(envelope),
    frontmatter: envelope.proposed_frontmatter,
    markdown_body: plannerInput.proposal_markdown_body,
    provenance: envelope.proposed_frontmatter.provenance,
    proposing_agent: {
      agent_id: plannerInput.proposing_agent_id,
      agent_kind: "librarian",
      run_id: plannerInput.proposing_agent_run_id,
    },
    approval_required: recommendationResult.required_approval,
    approval_status: recommendationResult.approval_status,
    approval_id: envelope.proposed_frontmatter.lifecycle.approval_id,
    sensitivity: envelope.proposed_frontmatter.sensitivity,
    content_hash: envelope.content_hash,
    created_at: envelope.received_at,
  };

  return VaultWriteProposalSchema.parse(proposal);
}

function targetPathForEnvelope(envelope: LibrarianIngestionEnvelope): string {
  const decision = planLibrarianIngestion(envelope);
  const folder = decision.target_folder ?? "01-inbox";
  return `${folder}/${slugPathSegment(envelope.proposed_frontmatter.title)}.md`;
}

function proposalIdFromEnvelope(envelopeId: string): `proposal:${string}` {
  return `proposal:${slugPathSegment(envelopeId).padEnd(8, "0")}`;
}

function rejectedDryRun(reason: LibrarianDryRunReason): LibrarianDryRunPlan {
  return LibrarianDryRunPlanSchema.parse({
    planner_version: LIBRARIAN_DRY_RUN_PLANNER_VERSION,
    contract_version: LIBRARIAN_CONTRACT_VERSION,
    accepted: false,
    classification: null,
    target_route: {
      route_target: null,
      target_folder: null,
    },
    dedupe: dedupeResult("not_checked", []),
    promotion: recommendation("reject", true, "pending", true),
    gateway_proposal_draft: null,
    reasons: [reason],
    warnings: ["dry_run_only_no_write_executed", "metadata_only_output"],
    redaction_summary: {
      metadata_only: true,
      raw_body_included: false,
      markdown_body_included: false,
      markdown_body_included_only_in_gateway_proposal: false,
    },
    write_attempted: false,
    vault_mutated: false,
  });
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}

export type LibrarianDryRunRoutePreference = z.infer<
  typeof RoutePreferenceSchema
>;
