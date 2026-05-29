import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES,
  ApprovalExecutionAuthorityTokenMetadataSchema,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalAuthorityTokenMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalAuthorityTokenMetadataShape,
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
  "secrets",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:authority-token-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:authority-token-item",
    proposal_id: "proposal:authority-token-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function decisionMetadata() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:authority-token-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:authority-token-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:authority-token-session",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: decisionMetadata(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function token() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:phase-18c1",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 302_000,
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

describe("Phase 18C.1 execution authority token contract", () => {
  it("defines the metadata-only token contract", () => {
    expect(DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT).toMatchObject({
      contract_version: "18C.1",
      contract_id: "approval_execution_authority_token_contract",
      phase: 18,
      slice: "18C.1",
      metadata_only: true,
      authority_token_shape_only: true,
      non_authoritative: true,
      non_executing: true,
      replay_safe: true,
      redaction_safe: true,
      usable_authority_supported: false,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_advancement_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      token_signing_supported: false,
      secret_material_supported: false,
    });
  });

  it("declares only inert statuses and no usable status vocabulary", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES).toEqual([
      "unavailable",
      "reserved",
      "expired",
      "revoked",
      "invalid",
    ]);
    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT.token_statuses,
    ).toEqual(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES);

    for (const forbiddenStatus of [
      "active",
      "granted",
      "usable",
      "executable",
    ]) {
      expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES).not.toContain(
        forbiddenStatus as never,
      );
      expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES).toContain(
        forbiddenStatus as never,
      );
    }
  });

  it("builds token metadata with all disabled-use flags set to false", () => {
    expect(token()).toMatchObject({
      contract_version: "18C.1",
      token_id: "authority-token:phase-18c1",
      proposal_id: "proposal:authority-token-item",
      review_session_id: "review-session:authority-token-session",
      proposal_kind: "note_create",
      status: "reserved",
      status_is_usable: false,
      status_is_authority_grant: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      disabled_use_flags: {
        authority_granted: false,
        execution_enabled: false,
        dispatch_enabled: false,
        tool_runtime_enabled: false,
        room_action_enabled: false,
        project_mutation_enabled: false,
        obsidian_write_enabled: false,
        memory_write_enabled: false,
        verification_enabled: false,
        compensation_enabled: false,
        rollback_enabled: false,
        approval_creation_enabled: false,
        approval_decision_handling_enabled: false,
        lifecycle_advancement_enabled: false,
        usable_authority_enabled: false,
        active_token_enabled: false,
        token_signing_enabled: false,
        persistence_enabled: false,
        event_store_writes_enabled: false,
        telemetry_writes_enabled: false,
        ui_rendering_enabled: false,
        api_route_enabled: false,
        scheduler_triggered_action_enabled: false,
        network_cloud_calls_enabled: false,
      },
    });
    expect(
      ApprovalExecutionAuthorityTokenMetadataSchema.safeParse(token()),
    ).toHaveProperty("success", true);
  });

  it("keeps scope metadata constrained to future single-action bounds", () => {
    expect(token().scope_metadata).toEqual({
      proposal_kind: "note_create",
      target_class: "obsidian_note",
      risk_class: "medium",
      single_action_only: true,
      cross_session_valid: false,
      multi_step_graph_allowed: false,
      voice_grant_allowed: false,
      auto_grant_allowed: false,
      metadata_only: true,
    });
  });

  it("keeps expiry and provenance metadata inert and replay-safe", () => {
    expect(token()).toMatchObject({
      expiry_metadata: {
        expires_at_ms: 302_000,
        expiry_display_only: true,
        usable_after_expiry: false,
        lifecycle_expiry_decision: false,
        timers_registered: false,
        scheduler_registered: false,
        metadata_only: true,
      },
      provenance_metadata: {
        proposal_ref_hash: "hash:proposal-authority-token-item",
        review_session_ref_hash: "hash:review-session-authority-token-session",
        audit_preview_ref_hash: "hash:authority-token-preview",
        decision_request_ref_hash: "hash:review-authority-token-decision",
        token_signed: false,
        secret_material_included: false,
        metadata_only: true,
      },
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

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, memory contents, and secrets", () => {
    const keys = collectKeys(token());

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(token()).toMatchObject({
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

  it("validates token metadata shape only", () => {
    expect(validateApprovalAuthorityTokenMetadataShape(token())).toEqual({
      valid: true,
      reason: "valid_token_metadata",
      metadata_only: true,
      shape_validation_only: true,
      authority_granted: false,
      approval_created: false,
      approval_decision_handled: false,
      lifecycle_advanced: false,
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
      token_signed: false,
      secret_material_included: false,
    });
  });

  it("rejects forbidden token statuses during shape validation", () => {
    expect(
      validateApprovalAuthorityTokenMetadataShape({
        ...token(),
        status: "active",
      }),
    ).toMatchObject({
      valid: false,
      reason: "forbidden_token_status",
      metadata_only: true,
      authority_granted: false,
      action_executed: false,
      dispatch_performed: false,
    });
  });

  it("rejects metadata that tries to enable authority use", () => {
    expect(
      validateApprovalAuthorityTokenMetadataShape({
        ...token(),
        disabled_use_flags: {
          ...token().disabled_use_flags,
          authority_granted: true,
        },
      }),
    ).toMatchObject({
      valid: false,
      reason: "invalid_token_metadata",
      metadata_only: true,
      shape_validation_only: true,
    });
  });

  it("exposes no approve, deny, createApproval, grantAuthority, execute, dispatch, run, verify, compensate, or rollback functions", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|grantAuthority|execute|dispatch|run|verify|compensate|rollback)/i;
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
