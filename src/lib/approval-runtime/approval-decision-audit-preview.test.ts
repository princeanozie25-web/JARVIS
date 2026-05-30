import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS,
  ApprovalDecisionAuditPreviewContractSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalDecisionRecordPolicyMetadata,
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
  "secret",
  "secrets",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:decision-audit-preview-source",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:decision-audit-preview-item",
    proposal_id: "proposal:decision-audit-preview-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:decision-audit-preview-request",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:decision-audit-request-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:decision-audit-preview-session",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalDecisionRecordMetadata({
      decision_record_id: "decision-record:phase-18d3",
      review_session: reviewSession(),
      outcome: "approved_recorded",
      channel: "typed_confirmation",
      actor_ref_hash: "hash:local-user",
      reason_ref_hash: "hash:decision-audit-reason",
      reason_kind: "user_intent_metadata",
    }),
    ...overrides,
  };
}

function decisionAuditPreview(record: unknown = decisionRecord()) {
  return buildApprovalDecisionAuditPreviewContract({
    preview_id_hash: "hash:phase-18d3-preview",
    decision_record: record,
    validation_results: validateApprovalDecisionRecordPolicyMetadata(record),
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

describe("Phase 18D.3 approval decision audit preview", () => {
  it("defines the metadata-only decision audit preview contract", () => {
    const preview = decisionAuditPreview();

    expect(preview).toMatchObject({
      contract_version: "18D.3",
      preview_id_hash: "hash:phase-18d3-preview",
      phase: 18,
      slice: "18D.3",
      preview_kind: "approval_decision_audit_preview",
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_safe_later: true,
      ui_wired: false,
      audit_shaped: true,
      audit_db_write_enabled: false,
    });
    expect(
      ApprovalDecisionAuditPreviewContractSchema.safeParse(preview).success,
    ).toBe(true);
  });

  it("declares all required audit preview sections", () => {
    expect(APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS).toEqual([
      "decision_summary",
      "proposal_reference",
      "review_session_reference",
      "channel_policy",
      "validation_results",
      "forbidden_channels",
      "disabled_authority_status",
      "redaction_status",
      "replay_status",
    ]);
    expect(
      decisionAuditPreview().sections.map((section) => section.section),
    ).toEqual(APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS);
  });

  it("includes decision, proposal, and review session metadata summaries", () => {
    expect(decisionAuditPreview()).toMatchObject({
      decision_summary: {
        decision_record_ref_hash: "hash:decision-record-phase-18d3",
        proposal_kind: "note_create",
        outcome: "approved_recorded",
        outcome_is_record_metadata_only: true,
        performs_lifecycle_transition: false,
        creates_approval: false,
        handles_approval_decision: false,
        metadata_only: true,
      },
      proposal_reference: {
        proposal_id: "proposal:decision-audit-preview-item",
        proposal_ref_hash: "hash:proposal-decision-audit-preview-item",
        proposal_kind: "note_create",
        metadata_only: true,
        raw_payload_included: false,
      },
      review_session_reference: {
        review_session_id: "review-session:decision-audit-preview-session",
        review_session_ref_hash:
          "hash:review-session-decision-audit-preview-session",
        metadata_only: true,
        raw_payload_included: false,
      },
    });
  });

  it("includes disabled authority status block", () => {
    expect(decisionAuditPreview().disabled_authority_status).toEqual({
      lifecycle_advancement_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      authority_grant_enabled: false,
      token_issue_enabled: false,
      execution_enabled: false,
      dispatch_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      event_store_write_enabled: false,
      ui_rendering_enabled: false,
      api_route_enabled: false,
      tool_runtime_wiring_enabled: false,
      room_adapter_wiring_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      scheduler_triggered_action_enabled: false,
      network_cloud_calls_enabled: false,
    });
  });

  it("includes validation result metadata only", () => {
    const validation = decisionAuditPreview().validation_results;

    expect(validation).toMatchObject({
      result_count: 21,
      passed_count: 21,
      failed_count: 0,
      max_severity: "info",
      metadata_only: true,
      raw_payload_included: false,
    });
    for (const result of validation.results) {
      expect(result).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        secret_material_included: false,
        approval_created: false,
        approval_decision_handled: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        persisted: false,
      });
    }
  });

  it("marks forbidden channels without enabling decision handling", () => {
    const forbiddenRecord = {
      ...decisionRecord(),
      channel_metadata: {
        ...decisionRecord().channel_metadata,
        channel: "voice_only",
      },
    };
    const preview = decisionAuditPreview(forbiddenRecord);

    expect(preview.channel_policy).toMatchObject({
      observed_channel: "voice_only",
      channel_allowed: false,
      forbidden_channel_detected: "voice_only",
      voice_only_approval_enabled: false,
      auto_approval_enabled: false,
      metadata_only: true,
    });
    expect(preview.forbidden_channels).toMatchObject({
      rejected: true,
      detected_forbidden_channel: "voice_only",
      metadata_only: true,
    });
    expect(preview.validation_results.failed_count).toBeGreaterThan(0);
  });

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, memory contents, and secrets", () => {
    const keys = collectKeys(decisionAuditPreview());

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(decisionAuditPreview().redaction_status).toMatchObject({
      redaction_safe: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
      metadata_only: true,
    });
  });

  it("is replay-safe and redaction-safe", () => {
    expect(decisionAuditPreview()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      replay_status: {
        replay_safe: true,
        deterministic_replay_key_hash: "hash:approval-audit-preview",
        source_event_hash: "hash:approval-audit-preview-source",
        metadata_only: true,
      },
      redaction_status: {
        redaction_status: "metadata_only",
        redaction_safe: true,
        metadata_only: true,
      },
    });
  });

  it("exposes no approve, deny, createApproval, grantAuthority, issueToken, execute, dispatch, run, verify, compensate, rollback, or persist functions", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|grantAuthority|issueToken|execute|dispatch|run|verify|compensate|rollback|persist)/i;
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
