import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS,
  APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_IDS,
  ApprovalExecutionAuthorityScopeConstraintMetadataSchema,
  ApprovalExecutionAuthorityScopeGuardContractSchema,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalAuthorityScopeConstraints,
  buildApprovalAuthorityTokenMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
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
  "secrets",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:authority-scope-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:authority-scope-item",
    proposal_id: "proposal:authority-scope-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function decisionMetadata() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:authority-scope-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:authority-scope-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:authority-scope-session",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: decisionMetadata(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function token() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:phase-18c2",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 302_000,
  });
}

function tokenWithScopeOverride(scopeOverride: Record<string, unknown>) {
  return {
    ...token(),
    scope_metadata: {
      ...token().scope_metadata,
      ...scopeOverride,
    },
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

describe("Phase 18C.2 execution authority scope guard", () => {
  it("defines the metadata-only scope guard contract", () => {
    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT,
    ).toMatchObject({
      contract_version: "18C.2",
      contract_id: "approval_execution_authority_scope_guard_contract",
      token_contract_version: "18C.1",
      phase: 18,
      slice: "18C.2",
      metadata_only: true,
      scope_guard_only: true,
      non_authoritative: true,
      non_executing: true,
      replay_safe: true,
      redaction_safe: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      authority_grant_supported: false,
      usable_authority_supported: false,
      active_token_supported: false,
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
      ApprovalExecutionAuthorityScopeGuardContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("declares all required guard ids and scope constraints", () => {
    expect(APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_IDS).toEqual([
      "single_action_only_required",
      "cross_session_valid_forbidden",
      "multi_step_graph_forbidden",
      "voice_grant_forbidden",
      "auto_grant_forbidden",
      "approval_inheritance_forbidden",
      "reusable_token_forbidden",
      "delegated_authority_forbidden",
      "background_execution_forbidden",
      "scheduler_grant_forbidden",
      "network_grant_forbidden",
    ]);
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
    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT.constraints.map(
        (constraint) => constraint.constraint_key,
      ),
    ).toEqual(APPROVAL_EXECUTION_AUTHORITY_SCOPE_CONSTRAINT_KEYS);
  });

  it("builds scope constraint metadata with all required bounds", () => {
    const constraints = buildApprovalAuthorityScopeConstraints({
      authority_token: token(),
    });

    expect(constraints).toEqual({
      proposal_kind: "note_create",
      target_class: "obsidian_note",
      risk_class: "medium",
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
      ApprovalExecutionAuthorityScopeConstraintMetadataSchema.safeParse(
        constraints,
      ).success,
    ).toBe(true);
  });

  it("validates token scope metadata shape only", () => {
    expect(validateApprovalAuthorityTokenScopeMetadata(token())).toEqual({
      contract_version: "18C.2",
      guard_result_id: "approval_execution_authority_scope_guard",
      passed: true,
      reason: "valid_token_scope",
      violated_constraint: null,
      token_ref_hash: "hash:authority-token-phase-18c2",
      metadata_only: true,
      shape_validation_only: true,
      replay_safe: true,
      redaction_safe: true,
      disabled_authority:
        DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT.disabled_authority,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
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

  it.each([
    ["single_action_only", false],
    ["cross_session_valid", true],
    ["multi_step_graph_allowed", true],
    ["voice_grant_allowed", true],
    ["auto_grant_allowed", true],
    ["approval_inheritance_allowed", true],
    ["reusable_token_allowed", true],
    ["delegated_authority_allowed", true],
    ["background_execution_allowed", true],
    ["scheduler_grant_allowed", true],
    ["network_grant_allowed", true],
  ] as const)("rejects violating %s=%s", (constraintKey, value) => {
    expect(
      validateApprovalAuthorityTokenScopeMetadata(
        tokenWithScopeOverride({ [constraintKey]: value }),
      ),
    ).toMatchObject({
      passed: false,
      reason: "scope_constraint_violation",
      violated_constraint: constraintKey,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
    });
  });

  it("keeps guard result disabled authority flags false", () => {
    expect(
      validateApprovalAuthorityTokenScopeMetadata(token()).disabled_authority,
    ).toEqual({
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      usable_authority_enabled: false,
      active_token_enabled: false,
      token_signing_enabled: false,
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

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, memory contents, and secrets", () => {
    const keys = collectKeys({
      constraints: buildApprovalAuthorityScopeConstraints({
        authority_token: token(),
      }),
      result: validateApprovalAuthorityTokenScopeMetadata(token()),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
  });

  it("rejects invalid token metadata without granting authority", () => {
    expect(validateApprovalAuthorityTokenScopeMetadata({})).toMatchObject({
      passed: false,
      reason: "invalid_token_metadata",
      token_ref_hash: null,
      metadata_only: true,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
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
