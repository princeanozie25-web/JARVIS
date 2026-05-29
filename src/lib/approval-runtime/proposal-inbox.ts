import { z } from "zod";

import {
  ApprovalAuditPreviewContractSchema,
  type ApprovalAuditPreviewContract,
} from "./audit-preview";
import {
  ApprovalProposalKindDeclarationSchema,
  ApprovalProposalRegistryKindSchema,
} from "./proposal-registry";
import {
  ApprovalRedactionMetadataSchema,
  ApprovalReplayMetadataSchema,
  ApprovalRiskClassSchema,
  ProposalIdSchema,
} from "./types";

export const APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION = "18B.1" as const;

export const APPROVAL_PROPOSAL_INBOX_STATUSES = [
  "visible",
  "hidden",
  "expired",
  "dismissed",
  "review_required",
] as const;

export const APPROVAL_PROPOSAL_INBOX_FILTER_KINDS = [
  "status",
  "proposal_kind",
  "risk_class",
  "source_class",
  "target_class",
] as const;

export const APPROVAL_PROPOSAL_INBOX_SORT_KINDS = [
  "created_at_desc",
  "created_at_asc",
  "risk_desc",
  "expiry_asc",
] as const;

export type ApprovalProposalInboxStatus =
  (typeof APPROVAL_PROPOSAL_INBOX_STATUSES)[number];
export type ApprovalProposalInboxFilterKind =
  (typeof APPROVAL_PROPOSAL_INBOX_FILTER_KINDS)[number];
export type ApprovalProposalInboxSortKind =
  (typeof APPROVAL_PROPOSAL_INBOX_SORT_KINDS)[number];

export const ApprovalProposalInboxStatusSchema = z.enum(
  APPROVAL_PROPOSAL_INBOX_STATUSES,
);
export const ApprovalProposalInboxFilterKindSchema = z.enum(
  APPROVAL_PROPOSAL_INBOX_FILTER_KINDS,
);
export const ApprovalProposalInboxSortKindSchema = z.enum(
  APPROVAL_PROPOSAL_INBOX_SORT_KINDS,
);

export const ApprovalProposalInboxDisabledAuthorityFlagsSchema = z.strictObject(
  {
    execution_enabled: z.literal(false),
    approval_creation_enabled: z.literal(false),
    authority_grant_enabled: z.literal(false),
    verification_enabled: z.literal(false),
    compensation_enabled: z.literal(false),
    auto_approval_enabled: z.literal(false),
    voice_only_approval_enabled: z.literal(false),
    dispatch_enabled: z.literal(false),
    approval_decision_enabled: z.literal(false),
    lifecycle_state_advancement_enabled: z.literal(false),
    rollback_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    event_store_writes_enabled: z.literal(false),
    telemetry_writes_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    api_route_enabled: z.literal(false),
    tool_runtime_wiring_enabled: z.literal(false),
    room_adapter_wiring_enabled: z.literal(false),
    project_mutation_enabled: z.literal(false),
    obsidian_write_enabled: z.literal(false),
    memory_write_enabled: z.literal(false),
    scheduler_triggered_creation_enabled: z.literal(false),
    network_cloud_calls_enabled: z.literal(false),
  },
);

export const ApprovalProposalInboxCreatedAtMetadataSchema = z.strictObject({
  created_at_ms: z.number().int().nonnegative(),
  source_clock_trusted: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalInboxExpiryMetadataSchema = z.strictObject({
  expires_after_ms: z.literal(300_000),
  expires_at_ms: z.number().int().nonnegative(),
  expiry_display_only: z.literal(true),
  lifecycle_expiry_decision: z.literal(false),
  timers_registered: z.literal(false),
  scheduler_registered: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalInboxValidationSummarySchema = z.strictObject({
  result_count: z.number().int().nonnegative(),
  passed_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
});

export const ApprovalProposalInboxFilterMetadataSchema = z.strictObject({
  filter_kind: ApprovalProposalInboxFilterKindSchema,
  enabled_for_display: z.literal(true),
  mutates_inbox: z.literal(false),
  persists_filter: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalInboxSortMetadataSchema = z.strictObject({
  sort_kind: ApprovalProposalInboxSortKindSchema,
  enabled_for_display: z.literal(true),
  mutates_inbox: z.literal(false),
  persists_sort: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApprovalProposalInboxSummaryMetadataSchema = z.strictObject({
  total_count: z.number().int().nonnegative(),
  visible_count: z.number().int().nonnegative(),
  review_required_count: z.number().int().nonnegative(),
  expired_count: z.number().int().nonnegative(),
  dismissed_count: z.number().int().nonnegative(),
  hidden_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  persisted: z.literal(false),
  telemetry_written: z.literal(false),
});

export const ApprovalProposalInboxItemSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION),
  inbox_item_id: z
    .string()
    .trim()
    .regex(/^inbox:[a-z0-9._:-]+$/),
  proposal_id: ProposalIdSchema,
  proposal_kind: ApprovalProposalRegistryKindSchema,
  proposal_summary: z.string().trim().min(1).max(120),
  risk_class: ApprovalRiskClassSchema,
  source_class: z.string().trim().min(1).max(80),
  target_class: z.string().trim().min(1).max(80),
  created_at_metadata: ApprovalProposalInboxCreatedAtMetadataSchema,
  expiry_metadata: ApprovalProposalInboxExpiryMetadataSchema,
  status: ApprovalProposalInboxStatusSchema,
  status_display_only: z.literal(true),
  status_is_lifecycle_decision: z.literal(false),
  audit_preview_id: z
    .string()
    .trim()
    .regex(/^hash:[a-z0-9._:-]+$/),
  validation_summary: ApprovalProposalInboxValidationSummarySchema,
  disabled_authority: ApprovalProposalInboxDisabledAuthorityFlagsSchema,
  redaction_status: ApprovalRedactionMetadataSchema,
  replay: ApprovalReplayMetadataSchema,
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  metadata_only: z.literal(true),
  ui_rendered: z.literal(false),
  persisted: z.literal(false),
  event_store_written: z.literal(false),
  telemetry_written: z.literal(false),
  raw_payload_included: z.literal(false),
  raw_tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_device_payload_included: z.literal(false),
  raw_project_content_included: z.literal(false),
  raw_memory_content_included: z.literal(false),
});

export const ApprovalProposalInboxContractSchema = z.strictObject({
  contract_version: z.literal(APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION),
  inbox_id: z.literal("approval_proposal_metadata_inbox"),
  phase: z.literal(18),
  slice: z.literal("18B.1"),
  statuses: z.array(ApprovalProposalInboxStatusSchema),
  filters: z.array(ApprovalProposalInboxFilterMetadataSchema),
  sorts: z.array(ApprovalProposalInboxSortMetadataSchema),
  summary: ApprovalProposalInboxSummaryMetadataSchema,
  metadata_only: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  display_only: z.literal(true),
  approval_decision_surface: z.literal(false),
  execution_surface: z.literal(false),
  ui_wired: z.literal(false),
  persistence_wired: z.literal(false),
});

export type ApprovalProposalInboxDisabledAuthorityFlags = z.infer<
  typeof ApprovalProposalInboxDisabledAuthorityFlagsSchema
>;
export type ApprovalProposalInboxCreatedAtMetadata = z.infer<
  typeof ApprovalProposalInboxCreatedAtMetadataSchema
>;
export type ApprovalProposalInboxExpiryMetadata = z.infer<
  typeof ApprovalProposalInboxExpiryMetadataSchema
>;
export type ApprovalProposalInboxValidationSummary = z.infer<
  typeof ApprovalProposalInboxValidationSummarySchema
>;
export type ApprovalProposalInboxFilterMetadata = z.infer<
  typeof ApprovalProposalInboxFilterMetadataSchema
>;
export type ApprovalProposalInboxSortMetadata = z.infer<
  typeof ApprovalProposalInboxSortMetadataSchema
>;
export type ApprovalProposalInboxSummaryMetadata = z.infer<
  typeof ApprovalProposalInboxSummaryMetadataSchema
>;
export type ApprovalProposalInboxItem = z.infer<
  typeof ApprovalProposalInboxItemSchema
>;
export type ApprovalProposalInboxContract = z.infer<
  typeof ApprovalProposalInboxContractSchema
>;

export const DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT =
  ApprovalProposalInboxContractSchema.parse({
    contract_version: APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION,
    inbox_id: "approval_proposal_metadata_inbox",
    phase: 18,
    slice: "18B.1",
    statuses: APPROVAL_PROPOSAL_INBOX_STATUSES,
    filters: APPROVAL_PROPOSAL_INBOX_FILTER_KINDS.map((filter_kind) => ({
      filter_kind,
      enabled_for_display: true,
      mutates_inbox: false,
      persists_filter: false,
      metadata_only: true,
    })),
    sorts: APPROVAL_PROPOSAL_INBOX_SORT_KINDS.map((sort_kind) => ({
      sort_kind,
      enabled_for_display: true,
      mutates_inbox: false,
      persists_sort: false,
      metadata_only: true,
    })),
    summary: {
      total_count: 0,
      visible_count: 0,
      review_required_count: 0,
      expired_count: 0,
      dismissed_count: 0,
      hidden_count: 0,
      metadata_only: true,
      persisted: false,
      telemetry_written: false,
    },
    metadata_only: true,
    replay_safe: true,
    redaction_safe: true,
    display_only: true,
    approval_decision_surface: false,
    execution_surface: false,
    ui_wired: false,
    persistence_wired: false,
  });

export function buildApprovalProposalInboxItem(input: {
  readonly inbox_item_id: `inbox:${string}`;
  readonly proposal_id: `proposal:${string}`;
  readonly proposal: unknown;
  readonly audit_preview: ApprovalAuditPreviewContract;
  readonly status?: ApprovalProposalInboxStatus;
  readonly created_at_ms: number;
}): ApprovalProposalInboxItem {
  const proposal = ApprovalProposalKindDeclarationSchema.parse(input.proposal);
  const auditPreview = ApprovalAuditPreviewContractSchema.parse(
    input.audit_preview,
  );
  const status = ApprovalProposalInboxStatusSchema.parse(
    input.status ?? "review_required",
  );

  return ApprovalProposalInboxItemSchema.parse({
    contract_version: APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION,
    inbox_item_id: input.inbox_item_id,
    proposal_id: input.proposal_id,
    proposal_kind: proposal.proposal_kind,
    proposal_summary: proposal.display_name,
    risk_class: proposal.risk.risk_class,
    source_class: proposal.source.source_kind,
    target_class: proposal.target.target_kind,
    created_at_metadata: {
      created_at_ms: input.created_at_ms,
      source_clock_trusted: false,
      metadata_only: true,
    },
    expiry_metadata: {
      expires_after_ms: proposal.expiry.expires_after_ms,
      expires_at_ms: input.created_at_ms + proposal.expiry.expires_after_ms,
      expiry_display_only: true,
      lifecycle_expiry_decision: false,
      timers_registered: false,
      scheduler_registered: false,
      metadata_only: true,
    },
    status,
    status_display_only: true,
    status_is_lifecycle_decision: false,
    audit_preview_id: auditPreview.preview_id_hash,
    validation_summary: {
      result_count: auditPreview.validation_results.result_count,
      passed_count: auditPreview.validation_results.passed_count,
      failed_count: auditPreview.validation_results.failed_count,
      metadata_only: true,
      raw_payload_included: false,
    },
    disabled_authority: {
      execution_enabled: false,
      approval_creation_enabled: false,
      authority_grant_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      dispatch_enabled: false,
      approval_decision_enabled: false,
      lifecycle_state_advancement_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      event_store_writes_enabled: false,
      telemetry_writes_enabled: false,
      ui_rendering_enabled: false,
      api_route_enabled: false,
      tool_runtime_wiring_enabled: false,
      room_adapter_wiring_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      scheduler_triggered_creation_enabled: false,
      network_cloud_calls_enabled: false,
    },
    redaction_status: auditPreview.redaction,
    replay: auditPreview.replay,
    replay_safe: true,
    redaction_safe: true,
    metadata_only: true,
    ui_rendered: false,
    persisted: false,
    event_store_written: false,
    telemetry_written: false,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_device_payload_included: false,
    raw_project_content_included: false,
    raw_memory_content_included: false,
  });
}
