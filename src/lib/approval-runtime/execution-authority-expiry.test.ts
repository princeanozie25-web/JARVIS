import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS,
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS,
  ApprovalExecutionAuthorityExpiryPolicyContractSchema,
  ApprovalExecutionAuthorityExpiryWindowMetadataSchema,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalAuthorityExpiryWindowMetadata,
  buildApprovalAuthorityTokenMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  evaluateApprovalAuthorityExpiryMetadataShape,
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
    preview_id_hash: "hash:authority-expiry-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:authority-expiry-item",
    proposal_id: "proposal:authority-expiry-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function decisionMetadata() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:authority-expiry-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:authority-expiry-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:authority-expiry-session",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: decisionMetadata(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function token() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:phase-18c3",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 302_000,
  });
}

function expiryWindow(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalAuthorityExpiryWindowMetadata({
      authority_token: token(),
      issued_at_ms: 2_000,
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

describe("Phase 18C.3 execution authority expiry contract", () => {
  it("defines the metadata-only expiry policy contract", () => {
    expect(DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT).toMatchObject({
      contract_version: "18C.3",
      contract_id: "approval_execution_authority_expiry_contract",
      token_contract_version: "18C.1",
      phase: 18,
      slice: "18C.3",
      metadata_only: true,
      expiry_policy_only: true,
      non_authoritative: true,
      non_executing: true,
      replay_safe: true,
      redaction_safe: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      authority_grant_supported: false,
      usable_authority_supported: false,
      active_token_supported: false,
      renewal_supported: false,
      refresh_supported: false,
      expiry_extension_supported: false,
      token_signing_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      lifecycle_advancement_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      network_cloud_calls_supported: false,
    });
    expect(
      ApprovalExecutionAuthorityExpiryPolicyContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("asserts fixed expiry policy values", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS).toBe(300_000);
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS).toBe(300_000);
    expect(DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT.policy).toEqual(
      {
        default_expiry_ms: 300_000,
        max_expiry_ms: 300_000,
        cross_session_valid: false,
        renewal_allowed: false,
        refresh_allowed: false,
        indefinite_authority_allowed: false,
        background_expiry_extension_allowed: false,
        voice_extension_allowed: false,
        scheduler_extension_allowed: false,
        network_extension_allowed: false,
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
      },
    );
  });

  it("declares the inert expiry reason vocabulary", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS).toEqual([
      "expired_by_policy",
      "expired_by_window",
      "expired_by_session_boundary",
      "expired_by_scope_violation",
      "expired_by_review_closure",
      "invalid_expiry_metadata",
    ]);
    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT.expiry_reasons,
    ).toEqual(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS);
  });

  it("builds expiry window metadata with a 300000 ms maximum", () => {
    expect(expiryWindow()).toEqual({
      token_ref_hash: "hash:authority-token-phase-18c3",
      issued_at_ms: 2_000,
      expires_at_ms: 302_000,
      expiry_window_ms: 300_000,
      default_expiry_ms: 300_000,
      max_expiry_ms: 300_000,
      cross_session_valid: false,
      renewal_allowed: false,
      refresh_allowed: false,
      indefinite_authority_allowed: false,
      background_expiry_extension_allowed: false,
      voice_extension_allowed: false,
      scheduler_extension_allowed: false,
      network_extension_allowed: false,
      timers_registered: false,
      scheduler_registered: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
    });
    expect(
      ApprovalExecutionAuthorityExpiryWindowMetadataSchema.safeParse(
        expiryWindow(),
      ).success,
    ).toBe(true);
  });

  it("keeps guard disabled flags false", () => {
    const output = evaluateApprovalAuthorityExpiryMetadataShape(expiryWindow());

    expect(output.disabled_authority).toEqual({
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      renewal_enabled: false,
      refresh_enabled: false,
      extension_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      usable_authority_enabled: false,
      active_token_enabled: false,
      token_signing_enabled: false,
      persistence_enabled: false,
      event_store_write_enabled: false,
      telemetry_write_enabled: false,
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
    expect(output).toMatchObject({
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      renewal_enabled: false,
      refresh_enabled: false,
      extension_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
    });
  });

  it("validates expiry metadata shape only", () => {
    expect(
      evaluateApprovalAuthorityExpiryMetadataShape(expiryWindow()),
    ).toMatchObject({
      contract_version: "18C.3",
      guard_output_id: "approval_execution_authority_expiry_guard",
      passed: true,
      expiry_reason: null,
      token_ref_hash: "hash:authority-token-phase-18c3",
      metadata_only: true,
      shape_validation_only: true,
      replay_safe: true,
      redaction_safe: true,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
    });
  });

  it("rejects expiry windows above max_expiry_ms", () => {
    expect(
      evaluateApprovalAuthorityExpiryMetadataShape(
        expiryWindow({ expiry_window_ms: 300_001 }),
      ),
    ).toMatchObject({
      passed: false,
      expiry_reason: "expired_by_policy",
      token_ref_hash: "hash:authority-token-phase-18c3",
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
    });
  });

  it("rejects indefinite authority", () => {
    expect(
      evaluateApprovalAuthorityExpiryMetadataShape(
        expiryWindow({ indefinite_authority_allowed: true }),
      ),
    ).toMatchObject({
      passed: false,
      expiry_reason: "invalid_expiry_metadata",
      token_ref_hash: "hash:authority-token-phase-18c3",
      authority_granted: false,
      execution_enabled: false,
    });
  });

  it("rejects cross-session authority", () => {
    expect(
      evaluateApprovalAuthorityExpiryMetadataShape(
        expiryWindow({ cross_session_valid: true }),
      ),
    ).toMatchObject({
      passed: false,
      expiry_reason: "expired_by_session_boundary",
      token_ref_hash: "hash:authority-token-phase-18c3",
      authority_granted: false,
      execution_enabled: false,
    });
  });

  it("rejects renewal, refresh, and extension metadata", () => {
    for (const override of [
      { renewal_allowed: true },
      { refresh_allowed: true },
      { background_expiry_extension_allowed: true },
      { voice_extension_allowed: true },
      { scheduler_extension_allowed: true },
      { network_extension_allowed: true },
    ]) {
      expect(
        evaluateApprovalAuthorityExpiryMetadataShape(expiryWindow(override)),
      ).toMatchObject({
        passed: false,
        expiry_reason: "invalid_expiry_metadata",
        authority_granted: false,
        execution_enabled: false,
      });
    }
  });

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, memory contents, and secrets", () => {
    const keys = collectKeys({
      window: expiryWindow(),
      output: evaluateApprovalAuthorityExpiryMetadataShape(expiryWindow()),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
  });

  it("exposes no approve, deny, createApproval, grantAuthority, execute, dispatch, run, verify, compensate, rollback, renew, or refresh functions", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|grantAuthority|execute|dispatch|run|verify|compensate|rollback|renew|refresh)/i;
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
