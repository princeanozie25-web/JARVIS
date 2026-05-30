import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS,
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS,
  APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS,
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES,
  APPROVAL_RUNTIME_PHASE_18C_SLICES,
  ApprovalExecutionAuthorityExpiryPolicyContractSchema,
  ApprovalExecutionAuthorityScopeGuardContractSchema,
  ApprovalExecutionAuthorityTokenContractSchema,
  ApprovalExecutionAuthorityTokenMetadataSchema,
  ApprovalRuntimePhase18CCloseoutGuardSchema,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalAuthorityExpiryWindowMetadata,
  buildApprovalAuthorityScopeConstraints,
  buildApprovalAuthorityTokenMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  evaluateApprovalAuthorityExpiryMetadataShape,
  validateApprovalAuthorityTokenScopeMetadata,
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

const DISABLED_FLAG_KEYS = [
  "authority_granted",
  "execution_enabled",
  "dispatch_enabled",
  "lifecycle_advancement_enabled",
  "verification_enabled",
  "compensation_enabled",
  "rollback_enabled",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:phase-18c-closeout-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18c-closeout",
    proposal_id: "proposal:phase-18c-closeout",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18c-closeout",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18c-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18c-closeout",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function token() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:phase-18c-closeout",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 302_000,
  });
}

function scopeConstraints() {
  return buildApprovalAuthorityScopeConstraints({
    authority_token: token(),
  });
}

function expiryWindow() {
  return buildApprovalAuthorityExpiryWindowMetadata({
    authority_token: token(),
    issued_at_ms: 2_000,
  });
}

function scopeResult() {
  return validateApprovalAuthorityTokenScopeMetadata(token());
}

function expiryOutput() {
  return evaluateApprovalAuthorityExpiryMetadataShape(expiryWindow());
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

function assertDisabledFlags(input: unknown) {
  if (!input || typeof input !== "object") {
    return;
  }

  const record = input as Record<string, unknown>;
  for (const key of DISABLED_FLAG_KEYS) {
    if (key in record) {
      expect(record[key]).toBe(false);
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      assertDisabledFlags(value);
    }
  }
}

describe("Phase 18C.4 execution authority closeout guard", () => {
  it("declares the Phase 18C closeout guard as inert metadata", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18C.4",
      closeout_id: "approval_runtime_phase_18c_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      execution_authority_token_contract_version: "18C.1",
      execution_authority_scope_guard_contract_version: "18C.2",
      execution_authority_expiry_contract_version: "18C.3",
      metadata_only: true,
      authority_layer_only: true,
      inert: true,
      non_executing: true,
      non_authoritative: true,
      non_renewable: true,
      replay_safe: true,
      redaction_safe: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_state_advancement_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      authority_grant_supported: false,
      usable_authority_tokens_supported: false,
      active_authority_tokens_supported: false,
      renewal_supported: false,
      refresh_supported: false,
      expiry_extension_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
    });
    expect(
      ApprovalRuntimePhase18CCloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18C_SLICES);
  });

  it("proves Phase 18A, Phase 18B, and Phase 18C contracts exist", () => {
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18A.6");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18B.4");
    expect(
      ApprovalExecutionAuthorityTokenContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionAuthorityScopeGuardContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionAuthorityExpiryPolicyContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("keeps token statuses inert and excludes active authority states", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES).toEqual([
      "unavailable",
      "reserved",
      "expired",
      "revoked",
      "invalid",
    ]);
    expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES).toEqual([
      "usable",
      "active",
      "granted",
      "executable",
    ]);

    for (const forbiddenStatus of [
      "active",
      "granted",
      "usable",
      "executable",
    ]) {
      expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES).not.toContain(
        forbiddenStatus as never,
      );
    }
    expect(token()).toMatchObject({
      status_is_usable: false,
      status_is_authority_grant: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
    });
    expect(
      ApprovalExecutionAuthorityTokenMetadataSchema.safeParse(token()).success,
    ).toBe(true);
  });

  it("keeps authority, execution, dispatch, lifecycle, verification, compensation, and rollback disabled everywhere", () => {
    for (const output of [
      token(),
      token().disabled_use_flags,
      scopeConstraints(),
      scopeResult(),
      scopeResult().disabled_authority,
      expiryWindow(),
      expiryOutput(),
      expiryOutput().disabled_authority,
      DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
    ]) {
      assertDisabledFlags(output);
    }
  });

  it("enforces all authority scope constraints", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS).toEqual([
      "single_action_only",
      "cross_session_valid",
      "multi_step_graph_allowed",
      "voice_grant_allowed",
      "auto_grant_allowed",
      "approval_inheritance_allowed",
      "reusable_token_allowed",
      "delegated_authority_allowed",
      "background_execution_allowed",
      "scheduler_grant_allowed",
      "network_grant_allowed",
    ]);
    expect(scopeConstraints()).toMatchObject({
      single_action_only: true,
      cross_session_valid: false,
      multi_step_graph_allowed: false,
      voice_grant_allowed: false,
      auto_grant_allowed: false,
      approval_inheritance_allowed: false,
      reusable_token_allowed: false,
      delegated_authority_allowed: false,
      background_execution_allowed: false,
      scheduler_grant_allowed: false,
      network_grant_allowed: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
    });
    expect(scopeResult()).toMatchObject({
      passed: true,
      metadata_only: true,
      shape_validation_only: true,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
    });
  });

  it("enforces expiry constraints and inert expiry reasons", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS).toBe(300_000);
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS).toBe(300_000);
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_REASONS).toEqual([
      "expired_by_policy",
      "expired_by_window",
      "expired_by_session_boundary",
      "expired_by_scope_violation",
      "expired_by_review_closure",
      "invalid_expiry_metadata",
    ]);
    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT.policy,
    ).toMatchObject({
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
    });
    expect(expiryWindow()).toMatchObject({
      expiry_window_ms: 300_000,
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
    });
  });

  it("keeps token, scope, and expiry metadata free of raw payloads and secrets", () => {
    const keys = collectKeys({
      token: token(),
      scope: scopeConstraints(),
      scope_result: scopeResult(),
      expiry_window: expiryWindow(),
      expiry_output: expiryOutput(),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    for (const output of [
      token(),
      scopeConstraints(),
      scopeResult(),
      expiryWindow(),
      expiryOutput(),
    ]) {
      expect(output).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
      });
    }
  });

  it("keeps expiry output non-renewable and non-extensible", () => {
    expect(expiryOutput()).toMatchObject({
      passed: true,
      renewal_enabled: false,
      refresh_enabled: false,
      extension_enabled: false,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
    });
    expect(expiryOutput().disabled_authority).toMatchObject({
      renewal_enabled: false,
      refresh_enabled: false,
      extension_enabled: false,
      token_signing_enabled: false,
      active_token_enabled: false,
      usable_authority_enabled: false,
    });
  });

  it("public exports expose no operational or renewal function names", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|grantAuthority|execute|dispatch|run|verify|compensate|rollback|renew|refresh|extend)/i;
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
