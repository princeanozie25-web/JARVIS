import { z } from "zod";
import {
  ApprovalIdSchema,
  ProposalIdSchema,
} from "../approval-runtime/types";
import {
  VaultFrontmatterSchema,
  VaultNoteTypeSchema,
  VaultProvenanceSchema,
  VaultSensitivitySchema,
} from "./frontmatter";
import { routeVaultNote } from "./routing";
import { VAULT_APPROVAL_STATUSES } from "./taxonomy";

export const VAULT_WRITE_GATEWAY_CONTRACT_VERSION = "phase21.vault-write-gateway.v1" as const;

export const VAULT_WRITE_PROPOSAL_STATES = [
  "proposed",
  "rejected_by_policy",
  "awaiting_approval",
  "approved",
  "denied",
  "expired",
  "ready_to_write",
] as const;

export const VAULT_WRITE_PROPOSAL_REASONS = [
  "accepted",
  "frontmatter_invalid",
  "note_type_mismatch",
  "sensitivity_mismatch",
  "provenance_missing",
  "markdown_body_empty",
  "content_hash_invalid",
  "target_path_invalid",
  "target_path_routing_mismatch",
  "durable_note_requires_approval",
  "durable_agent_note_requires_human_approval",
  "gitnexus_project_required",
  "approval_denied",
  "approval_expired",
  "approval_required_mismatch",
  "approval_id_mismatch",
] as const;

export const VAULT_WRITE_PROPOSAL_WARNINGS = [
  "proposal_only_no_write_executed",
  "approval_required_before_write",
  "librarian_review_required",
  "transient_output_not_durable",
  "metadata_only_redaction",
] as const;

const ContentHashSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const RelativeMarkdownPathSchema = z
  .string()
  .trim()
  .min(4)
  .max(500)
  .regex(/^[^\\]+$/)
  .regex(/^(?!\/|[a-zA-Z]:|.*(?:^|\/)\.\.(?:\/|$)).+\.md$/);

export const VaultWriteProposalStateSchema = z.enum(
  VAULT_WRITE_PROPOSAL_STATES,
);
export const VaultWriteProposalReasonSchema = z.enum(
  VAULT_WRITE_PROPOSAL_REASONS,
);
export const VaultWriteProposalWarningSchema = z.enum(
  VAULT_WRITE_PROPOSAL_WARNINGS,
);

export const VaultWriteProposingAgentSchema = z.strictObject({
  agent_id: z.string().trim().min(1),
  agent_kind: z.string().trim().min(1),
  run_id: z.string().trim().min(1).nullable(),
});

export const VaultWriteProposalSchema = z.strictObject({
  contract_version: z.literal(VAULT_WRITE_GATEWAY_CONTRACT_VERSION),
  proposal_id: ProposalIdSchema,
  note_type: VaultNoteTypeSchema,
  target_path: RelativeMarkdownPathSchema,
  frontmatter: VaultFrontmatterSchema,
  markdown_body: z.string(),
  provenance: VaultProvenanceSchema,
  proposing_agent: VaultWriteProposingAgentSchema,
  approval_required: z.boolean(),
  approval_status: z.enum(VAULT_APPROVAL_STATUSES),
  approval_id: ApprovalIdSchema.nullable().default(null),
  sensitivity: VaultSensitivitySchema,
  content_hash: ContentHashSchema,
  created_at: z.string().trim().datetime({ offset: true }),
});

export const VaultWriteRedactionSummarySchema = z.strictObject({
  metadata_only: z.literal(true),
  markdown_body_included: z.literal(false),
  raw_body_retained: z.literal(false),
  body_char_count: z.number().int().nonnegative(),
  content_hash_included: z.literal(true),
  provenance_included: z.boolean(),
});

export const VaultWriteApprovalGateSchema = z.strictObject({
  proposal_kind: z.literal("obsidian_write"),
  approval_required: z.boolean(),
  approval_status: z.enum(VAULT_APPROVAL_STATUSES),
  approval_id: ApprovalIdSchema.nullable(),
  lifecycle_stage: z.enum([
    "PROPOSED",
    "REVIEW_PENDING",
    "APPROVED",
    "DENIED",
    "EXPIRED",
  ]),
  execution_supported: z.literal(false),
});

export const VaultWriteDryRunPlanSchema = z.strictObject({
  contract_version: z.literal(VAULT_WRITE_GATEWAY_CONTRACT_VERSION),
  accepted: z.boolean(),
  state: VaultWriteProposalStateSchema,
  target_path: RelativeMarkdownPathSchema.nullable(),
  route_folder: z.string().trim().min(1).nullable(),
  reasons: z.array(VaultWriteProposalReasonSchema),
  warnings: z.array(VaultWriteProposalWarningSchema),
  required_approval_gate: VaultWriteApprovalGateSchema,
  redaction_summary: VaultWriteRedactionSummarySchema,
  write_attempted: z.literal(false),
  vault_mutated: z.literal(false),
});

export type VaultWriteProposalState = z.infer<
  typeof VaultWriteProposalStateSchema
>;
export type VaultWriteProposalReason = z.infer<
  typeof VaultWriteProposalReasonSchema
>;
export type VaultWriteProposalWarning = z.infer<
  typeof VaultWriteProposalWarningSchema
>;
export type VaultWriteProposal = z.infer<typeof VaultWriteProposalSchema>;
export type VaultWriteDryRunPlan = z.infer<typeof VaultWriteDryRunPlanSchema>;

export function planVaultWriteProposalDryRun(
  input: unknown,
): VaultWriteDryRunPlan {
  const parsed = VaultWriteProposalSchema.safeParse(input);
  if (!parsed.success) {
    return rejectedPlan({
      approvalStatus: "pending",
      reason: classifyParseFailure(parsed.error),
      bodyCharCount: estimateBodyCharCount(input),
    });
  }

  const proposal = parsed.data;
  const route = routeVaultNote(proposal.frontmatter);
  const policyApprovalRequired =
    route.requires_approval ||
    proposal.frontmatter.lifecycle.durable ||
    proposal.frontmatter.lifecycle.canonical ||
    route.durable;
  const reasons: VaultWriteProposalReason[] = [];
  const warnings: VaultWriteProposalWarning[] = [
    "proposal_only_no_write_executed",
    "metadata_only_redaction",
  ];

  if (proposal.note_type !== proposal.frontmatter.note_type) {
    reasons.push("note_type_mismatch");
  }
  if (proposal.sensitivity !== proposal.frontmatter.sensitivity) {
    reasons.push("sensitivity_mismatch");
  }
  if (!hasProvenance(proposal)) {
    reasons.push("provenance_missing");
  }
  if (!proposal.markdown_body.trim()) {
    reasons.push("markdown_body_empty");
  }
  if (!proposal.target_path.endsWith(".md")) {
    reasons.push("target_path_invalid");
  }
  if (proposal.content_hash !== proposal.frontmatter.provenance.content_hash) {
    reasons.push("content_hash_invalid");
  }
  if (policyApprovalRequired !== proposal.approval_required) {
    reasons.push("approval_required_mismatch");
  }
  if (proposal.approval_id !== proposal.frontmatter.lifecycle.approval_id) {
    reasons.push("approval_id_mismatch");
  }
  if (proposal.approval_status === "approved" && !proposal.approval_id) {
    reasons.push("approval_id_mismatch");
  }
  if (!targetPathMatchesRoute(proposal.target_path, route.folder)) {
    reasons.push("target_path_routing_mismatch");
  }
  if (policyApprovalRequired) {
    warnings.push("approval_required_before_write");
  }
  if (route.requires_librarian_review) {
    warnings.push("librarian_review_required");
  }
  if (!route.durable) {
    warnings.push("transient_output_not_durable");
  }
  for (const routeReason of route.governance_reasons) {
    if (routeReason === "durable_note_requires_approval") {
      reasons.push("durable_note_requires_approval");
    }
    if (routeReason === "durable_agent_note_requires_human_approval") {
      reasons.push("durable_agent_note_requires_human_approval");
    }
    if (routeReason === "gitnexus_project_required") {
      reasons.push("gitnexus_project_required");
    }
  }
  if (proposal.approval_status === "denied") {
    reasons.push("approval_denied");
  }
  if (proposal.approval_status === "expired") {
    reasons.push("approval_expired");
  }

  const state = proposalState(proposal, route.durable_write_allowed, reasons);
  const accepted = [
    "proposed",
    "awaiting_approval",
    "approved",
    "ready_to_write",
  ].includes(state);
  if (reasons.length === 0) {
    reasons.push("accepted");
  }

  return VaultWriteDryRunPlanSchema.parse({
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    accepted,
    state,
    target_path: proposal.target_path,
    route_folder: route.folder,
    reasons: unique(reasons),
    warnings: unique(warnings),
    required_approval_gate: approvalGate(proposal),
    redaction_summary: redactionSummary(proposal.markdown_body),
    write_attempted: false,
    vault_mutated: false,
  });
}

function proposalState(
  proposal: VaultWriteProposal,
  durableWriteAllowed: boolean,
  reasons: readonly VaultWriteProposalReason[],
): VaultWriteProposalState {
  if (reasons.includes("approval_denied")) return "denied";
  if (reasons.includes("approval_expired")) return "expired";
  if (
    reasons.some(
      (reason) =>
        reason !== "durable_note_requires_approval",
    )
  ) {
    return "rejected_by_policy";
  }
  if (durableWriteAllowed && proposal.approval_status === "approved") {
    return "ready_to_write";
  }
  if (proposal.approval_status === "approved") {
    return "approved";
  }
  if (proposal.approval_required) {
    return "awaiting_approval";
  }
  return "proposed";
}

function approvalGate(proposal: VaultWriteProposal): z.infer<
  typeof VaultWriteApprovalGateSchema
> {
  const route = routeVaultNote(proposal.frontmatter);
  const policyApprovalRequired =
    route.requires_approval ||
    proposal.frontmatter.lifecycle.durable ||
    proposal.frontmatter.lifecycle.canonical ||
    route.durable;
  return {
    proposal_kind: "obsidian_write",
    approval_required: policyApprovalRequired,
    approval_status: proposal.approval_status,
    approval_id: proposal.approval_id,
    lifecycle_stage: approvalLifecycleStage(proposal.approval_status),
    execution_supported: false,
  };
}

function approvalLifecycleStage(
  approvalStatus: VaultWriteProposal["approval_status"],
): z.infer<typeof VaultWriteApprovalGateSchema>["lifecycle_stage"] {
  if (approvalStatus === "approved") return "APPROVED";
  if (approvalStatus === "denied") return "DENIED";
  if (approvalStatus === "expired") return "EXPIRED";
  if (approvalStatus === "pending") return "REVIEW_PENDING";
  return "PROPOSED";
}

function hasProvenance(proposal: VaultWriteProposal): boolean {
  return (
    proposal.provenance.source_type === proposal.frontmatter.provenance.source_type &&
    proposal.provenance.content_hash === proposal.frontmatter.provenance.content_hash
  );
}

function targetPathMatchesRoute(targetPath: string, routeFolder: string): boolean {
  const normalized = targetPath.replace(/\\/g, "/");
  return normalized.startsWith(`${routeFolder}/`) && normalized.endsWith(".md");
}

function redactionSummary(markdownBody: string): z.infer<
  typeof VaultWriteRedactionSummarySchema
> {
  return {
    metadata_only: true,
    markdown_body_included: false,
    raw_body_retained: false,
    body_char_count: markdownBody.length,
    content_hash_included: true,
    provenance_included: true,
  };
}

function rejectedPlan(input: {
  readonly approvalStatus: VaultWriteProposal["approval_status"];
  readonly reason: VaultWriteProposalReason;
  readonly bodyCharCount: number;
}): VaultWriteDryRunPlan {
  return VaultWriteDryRunPlanSchema.parse({
    contract_version: VAULT_WRITE_GATEWAY_CONTRACT_VERSION,
    accepted: false,
    state: "rejected_by_policy",
    target_path: null,
    route_folder: null,
    reasons: [input.reason],
    warnings: ["proposal_only_no_write_executed", "metadata_only_redaction"],
    required_approval_gate: {
      proposal_kind: "obsidian_write",
      approval_required: true,
      approval_status: input.approvalStatus,
      approval_id: null,
      lifecycle_stage: "REVIEW_PENDING",
      execution_supported: false,
    },
    redaction_summary: {
      metadata_only: true,
      markdown_body_included: false,
      raw_body_retained: false,
      body_char_count: input.bodyCharCount,
      content_hash_included: true,
      provenance_included: false,
    },
    write_attempted: false,
    vault_mutated: false,
  });
}

function estimateBodyCharCount(input: unknown): number {
  if (
    input &&
    typeof input === "object" &&
    "markdown_body" in input &&
    typeof input.markdown_body === "string"
  ) {
    return input.markdown_body.length;
  }
  return 0;
}

function classifyParseFailure(error: z.ZodError): VaultWriteProposalReason {
  const paths = error.issues.map((issue) => String(issue.path[0] ?? ""));
  if (paths.includes("target_path")) return "target_path_invalid";
  if (paths.includes("content_hash")) return "content_hash_invalid";
  if (paths.includes("provenance")) return "provenance_missing";
  return "frontmatter_invalid";
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}
