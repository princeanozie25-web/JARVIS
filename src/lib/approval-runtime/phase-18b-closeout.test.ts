import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_LIFECYCLE_STAGES,
  APPROVAL_PROPOSAL_INBOX_STATUSES,
  APPROVAL_REVIEW_CHANNELS,
  APPROVAL_REVIEW_DECISION_REQUESTS,
  APPROVAL_REVIEW_FORBIDDEN_CHANNELS,
  APPROVAL_REVIEW_SESSION_STATUSES,
  APPROVAL_RUNTIME_PHASE_18B_SLICES,
  ApprovalProposalInboxContractSchema,
  ApprovalReviewChannelMetadataSchema,
  ApprovalReviewDecisionMetadataSchema,
  ApprovalReviewSessionSnapshotSchema,
  ApprovalRuntimePhase18BCloseoutGuardSchema,
  DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalProposalMetadataGuards,
} from "./index";

const FORBIDDEN_RAW_KEYS = [
  "raw_payload",
  "payload",
  "raw_body",
  "body",
  "tool_args",
  "tool_arguments",
  "prompt",
  "prompts",
  "model_output",
  "model_outputs",
  "device_payload",
  "project_contents",
  "memory_contents",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:phase-18b-closeout-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18b-closeout",
    proposal_id: "proposal:phase-18b-closeout",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18b-closeout",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "ui_click",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18b-closeout",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

function expectDisabledAuthority(flags: Record<string, unknown>) {
  expect(flags).toMatchObject({
    execution_enabled: false,
    authority_grant_enabled: false,
    verification_enabled: false,
    compensation_enabled: false,
    dispatch_enabled: false,
    auto_approval_enabled: false,
    voice_only_approval_enabled: false,
    rollback_enabled: false,
    persistence_enabled: false,
    event_store_writes_enabled: false,
    telemetry_writes_enabled: false,
    tool_runtime_wiring_enabled: false,
    room_adapter_wiring_enabled: false,
    project_mutation_enabled: false,
    obsidian_write_enabled: false,
    memory_write_enabled: false,
    network_cloud_calls_enabled: false,
  });
}

describe("Phase 18B.4 approval review closeout guard", () => {
  it("declares the Phase 18B closeout guard as review-only metadata", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18B.4",
      closeout_id: "approval_runtime_phase_18b_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      proposal_inbox_contract_version: "18B.1",
      review_decision_contract_version: "18B.2",
      review_session_contract_version: "18B.3",
      metadata_only: true,
      review_only: true,
      non_executing: true,
      non_authoritative: true,
      replay_safe: true,
      redaction_safe: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      approve_deny_handlers_supported: false,
      lifecycle_state_advancement_supported: false,
      execution_supported: false,
      authority_grant_supported: false,
      verification_supported: false,
      compensation_supported: false,
      voice_only_approval_supported: false,
    });
    expect(
      ApprovalRuntimePhase18BCloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18B_SLICES);
  });

  it("proves the Phase 18A foundation and Phase 18B contracts exist", () => {
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18A.6");
    expect(
      ApprovalProposalInboxContractSchema.safeParse(
        DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalReviewDecisionMetadataSchema.safeParse(reviewDecision()).success,
    ).toBe(true);
    expect(
      ApprovalReviewSessionSnapshotSchema.safeParse(reviewSession()).success,
    ).toBe(true);
  });

  it("keeps inbox statuses display-only and separate from lifecycle decisions", () => {
    expect(APPROVAL_PROPOSAL_INBOX_STATUSES).toEqual([
      "visible",
      "hidden",
      "expired",
      "dismissed",
      "review_required",
    ]);
    for (const status of APPROVAL_PROPOSAL_INBOX_STATUSES) {
      expect(APPROVAL_LIFECYCLE_STAGES).not.toContain(status as never);
    }
    expect(inboxItem()).toMatchObject({
      status_display_only: true,
      status_is_lifecycle_decision: false,
    });
  });

  it("keeps review decision values as request metadata only", () => {
    expect(APPROVAL_REVIEW_DECISION_REQUESTS).toEqual([
      "approve_requested",
      "deny_requested",
      "dismiss_requested",
      "expire_requested",
      "request_changes",
    ]);
    expect(reviewDecision()).toMatchObject({
      request_is_intention_only: true,
      performs_lifecycle_transition: false,
      writes_approval_record: false,
      metadata_only: true,
    });
  });

  it("keeps review session statuses display-only and not lifecycle stages", () => {
    expect(APPROVAL_REVIEW_SESSION_STATUSES).toEqual([
      "opened",
      "awaiting_review",
      "decision_requested",
      "changes_requested",
      "closed",
      "expired",
    ]);
    for (const status of APPROVAL_REVIEW_SESSION_STATUSES) {
      expect(APPROVAL_LIFECYCLE_STAGES).not.toContain(status as never);
    }
    expect(reviewSession()).toMatchObject({
      status_display_only: true,
      status_is_lifecycle_stage: false,
    });
  });

  it("keeps voice_only review channel forbidden", () => {
    expect(APPROVAL_REVIEW_CHANNELS).toEqual([
      "ui_click",
      "keyboard",
      "typed_confirmation",
    ]);
    expect(APPROVAL_REVIEW_FORBIDDEN_CHANNELS).toEqual(["voice_only"]);
    expect(
      ApprovalReviewChannelMetadataSchema.safeParse({
        channel: "voice_only",
        voice_only_channel: false,
        voice_only_approval_allowed: false,
        ui_wiring_enabled: false,
        api_route_enabled: false,
        metadata_only: true,
      }).success,
    ).toBe(false);
  });

  it("keeps inbox, decision, and session authority disabled", () => {
    expectDisabledAuthority(inboxItem().disabled_authority);
    expectDisabledAuthority(reviewDecision().disabled_authority);
    expect(reviewDecision().disabled_authority).toMatchObject({
      lifecycle_advancement_enabled: false,
      approval_record_write_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
    });
    expectDisabledAuthority(reviewSession().disabled_authority);
    expect(reviewSession().disabled_authority).toMatchObject({
      lifecycle_advancement_enabled: false,
      approval_record_write_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
    });
  });

  it("keeps evidence metadata free of raw payloads", () => {
    const evidence = reviewSession().evidence_metadata;

    expect(evidence).toMatchObject({
      metadata_only: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
    });
    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(collectKeys(evidence)).not.toContain(key);
    }
  });

  it("keeps audit, review decision, and review session outputs replay-safe and redaction-safe", () => {
    for (const output of [auditPreview(), reviewDecision(), reviewSession()]) {
      expect(output).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
      });
    }
    expect(auditPreview().redaction_status).toMatchObject({
      redaction_safe: true,
      metadata_only: true,
    });
    expect(reviewDecision().redaction).toMatchObject({
      redaction_safe: true,
      metadata_only: true,
    });
    expect(reviewSession().redaction_status).toMatchObject({
      redaction_safe: true,
      metadata_only: true,
    });
  });

  it("public exports expose no operational function names", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|execute|dispatch|run|verify|compensate|rollback)/i;
    const exportedFunctionNames = Object.entries(approvalRuntime)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    expect(exportedFunctionNames).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(forbiddenFunctionNamePattern),
      ]),
    );
  });
});
