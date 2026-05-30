import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_DECISION_RECORD_CHANNELS,
  APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
  APPROVAL_DECISION_RECORD_OUTCOMES,
  ApprovalDecisionRecordChannelMetadataSchema,
  ApprovalDecisionRecordContractSchema,
  ApprovalDecisionRecordMetadataSchema,
  DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalDecisionRecordMetadataShape,
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
    preview_id_hash: "hash:decision-record-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:decision-record-item",
    proposal_id: "proposal:decision-record-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:decision-record-request",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:decision-record-request-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:decision-record-session",
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
      decision_record_id: "decision-record:phase-18d1",
      review_session: reviewSession(),
      outcome: "approved_recorded",
      channel: "typed_confirmation",
      actor_ref_hash: "hash:local-user",
      reason_ref_hash: "hash:decision-record-reason",
      reason_kind: "user_intent_metadata",
    }),
    ...overrides,
  };
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

describe("Phase 18D.1 approval decision record contract", () => {
  it("defines the metadata-only decision record contract", () => {
    expect(DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT).toMatchObject({
      contract_version: "18D.1",
      contract_id: "approval_decision_record_contract",
      phase: 18,
      slice: "18D.1",
      metadata_only: true,
      record_shape_only: true,
      non_authoritative: true,
      non_executing: true,
      replay_safe: true,
      redaction_safe: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      approve_deny_handlers_supported: false,
      lifecycle_advancement_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      event_store_writes_supported: false,
      telemetry_writes_supported: false,
      ui_rendering_supported: false,
      api_routes_supported: false,
      network_cloud_calls_supported: false,
      voice_only_approval_supported: false,
      auto_approval_supported: false,
    });
    expect(
      ApprovalDecisionRecordContractSchema.safeParse(
        DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("declares all inert decision outcome values", () => {
    expect(APPROVAL_DECISION_RECORD_OUTCOMES).toEqual([
      "approved_recorded",
      "denied_recorded",
      "expired_recorded",
      "dismissed_recorded",
      "changes_requested_recorded",
    ]);
    expect(DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT.outcomes).toEqual(
      APPROVAL_DECISION_RECORD_OUTCOMES,
    );
    expect(decisionRecord()).toMatchObject({
      outcome: "approved_recorded",
      outcome_is_record_metadata_only: true,
      performs_lifecycle_transition: false,
      creates_approval: false,
      handles_approval_decision: false,
    });
  });

  it("declares allowed channels and rejects forbidden channels", () => {
    expect(APPROVAL_DECISION_RECORD_CHANNELS).toEqual([
      "ui_click",
      "keyboard",
      "typed_confirmation",
    ]);
    expect(APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS).toEqual([
      "voice_only",
      "auto_approval",
      "scheduler_decision",
      "background_decision",
      "network_decision",
    ]);

    for (const channel of APPROVAL_DECISION_RECORD_CHANNELS) {
      expect(
        ApprovalDecisionRecordChannelMetadataSchema.safeParse({
          channel,
          voice_only_channel: false,
          auto_approval_channel: false,
          scheduler_decision_channel: false,
          background_decision_channel: false,
          network_decision_channel: false,
          ui_wiring_enabled: false,
          api_route_enabled: false,
          metadata_only: true,
        }).success,
      ).toBe(true);
    }

    for (const channel of APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS) {
      expect(
        validateApprovalDecisionRecordMetadataShape({
          ...decisionRecord(),
          channel_metadata: {
            ...decisionRecord().channel_metadata,
            channel,
          },
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_decision_channel",
        approval_created: false,
        approval_decision_handled: false,
        lifecycle_advanced: false,
        authority_granted: false,
        token_issued: false,
      });
    }
  });

  it("builds decision records with disabled authority flags set to false", () => {
    expect(decisionRecord()).toMatchObject({
      contract_version: "18D.1",
      decision_record_id: "decision-record:phase-18d1",
      proposal_id: "proposal:decision-record-item",
      review_session_id: "review-session:decision-record-session",
      proposal_kind: "note_create",
      disabled_authority_flags: {
        lifecycle_advancement_enabled: false,
        authority_grant_enabled: false,
        execution_enabled: false,
        dispatch_enabled: false,
        verification_enabled: false,
        compensation_enabled: false,
        rollback_enabled: false,
        token_issue_enabled: false,
        persistence_enabled: false,
        telemetry_write_enabled: false,
        approval_creation_enabled: false,
        approval_decision_handling_enabled: false,
        approve_deny_handler_enabled: false,
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
        voice_only_approval_enabled: false,
        auto_approval_enabled: false,
      },
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
      ui_rendered: false,
      api_route_called: false,
    });
    expect(
      ApprovalDecisionRecordMetadataSchema.safeParse(decisionRecord()).success,
    ).toBe(true);
  });

  it("keeps actor, reason, and provenance metadata inert", () => {
    expect(decisionRecord()).toMatchObject({
      actor_metadata: {
        actor_ref_hash: "hash:local-user",
        actor_kind: "local_user_reviewer",
        actor_present_required: true,
        actor_identity_verified: false,
        voice_only_actor: false,
        metadata_only: true,
        raw_actor_identifier_included: false,
      },
      reason_metadata: {
        reason_kind: "user_intent_metadata",
        reason_ref_hash: "hash:decision-record-reason",
        raw_reason_included: false,
        prompt_included: false,
        model_output_included: false,
        metadata_only: true,
      },
      provenance_metadata: {
        proposal_ref_hash: "hash:proposal-decision-record-item",
        review_session_ref_hash: "hash:review-session-decision-record-session",
        review_decision_request_ref_hash: "hash:review-decision-record-request",
        audit_preview_ref_hash: "hash:decision-record-preview",
        record_shape_only: true,
        approval_created: false,
        approval_decision_handled: false,
        lifecycle_state_advanced: false,
        authority_granted: false,
        token_issued: false,
        persisted: false,
        event_store_written: false,
        telemetry_written: false,
        metadata_only: true,
      },
    });
  });

  it("rejects unknown proposal kinds", () => {
    expect(
      validateApprovalDecisionRecordMetadataShape({
        ...decisionRecord(),
        proposal_kind: "unknown_kind",
      }),
    ).toMatchObject({
      valid: false,
      reason: "unknown_proposal_kind",
      metadata_only: true,
      shape_validation_only: true,
      approval_created: false,
      authority_granted: false,
      token_issued: false,
    });
  });

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, memory contents, and secrets", () => {
    const keys = collectKeys(decisionRecord());

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(decisionRecord()).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
    });
  });

  it("validates decision record metadata shape only", () => {
    expect(
      validateApprovalDecisionRecordMetadataShape(decisionRecord()),
    ).toEqual({
      valid: true,
      reason: "valid_decision_record_metadata",
      metadata_only: true,
      shape_validation_only: true,
      approval_created: false,
      approval_decision_handled: false,
      lifecycle_advanced: false,
      authority_granted: false,
      token_issued: false,
      action_executed: false,
      dispatch_performed: false,
      verification_performed: false,
      compensation_performed: false,
      rollback_performed: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
      ui_rendered: false,
      api_route_called: false,
      network_called: false,
      cloud_called: false,
    });
  });

  it("keeps decision records replay-safe and redaction-safe", () => {
    expect(decisionRecord()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      replay: {
        replay_safe: true,
        local_first: true,
      },
      redaction_status: {
        redaction_safe: true,
        metadata_only: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_execution_command_included: false,
        secret_material_included: false,
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
