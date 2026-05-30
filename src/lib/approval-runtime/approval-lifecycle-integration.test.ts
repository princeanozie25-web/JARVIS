import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES,
  APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS,
  APPROVAL_LIFECYCLE_INTEGRATION_STATUSES,
  ApprovalLifecycleIntegrationContractSchema,
  ApprovalLifecycleIntegrationSnapshotSchema,
  DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalAuthorityTokenMetadata,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionCompensationAuditPreviewContract,
  buildApprovalExecutionCompensationMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalLifecycleIntegrationSnapshot,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionCompensationPolicyMetadata,
  validateApprovalLifecycleIntegrationSnapshotShape,
  validateApprovalProposalMetadataGuards,
} from "./index";

const FORBIDDEN_RAW_KEYS = [
  "raw_payload",
  "payload",
  "tool_args",
  "tool_arguments",
  "tool_output",
  "tool_outputs",
  "prompt",
  "prompts",
  "model_output",
  "model_outputs",
  "device_payload",
  "project_contents",
  "memory_contents",
  "raw_state",
  "secret",
  "secrets",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "approve",
  "deny",
  "createApproval",
  "grantAuthority",
  "issueToken",
  "execute",
  "dispatch",
  "run",
  "verify",
  "readState",
  "compensate",
  "rollback",
  "restore",
  "persist",
  "writeTelemetry",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function proposalAuditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:lifecycle-integration-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:lifecycle-integration-item",
    proposal_id: "proposal:lifecycle-integration-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:lifecycle-integration-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:lifecycle-integration-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:lifecycle-integration-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:lifecycle-integration-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:lifecycle-integration-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function authorityToken() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:lifecycle-integration-token",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 3_000,
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18h1",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18h1-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18h1",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18h1",
    redacted_reference: "redacted:phase-18h1-verification-evidence",
    hash_reference: "hash:phase-18h1-verification-evidence",
    observed_at_metadata_ms: 4_000,
  });
}

function compensationMetadata() {
  return buildApprovalExecutionCompensationMetadata({
    compensation_id: "compensation:phase-18h1",
    verification_metadata: verificationMetadata(),
    hint_id: "compensation-hint:phase-18h1",
    evidence_id: "compensation-evidence:phase-18h1",
    redacted_reference: "redacted:phase-18h1-compensation",
    hash_reference: "hash:phase-18h1-compensation",
  });
}

function compensationAuditPreview() {
  const compensation = compensationMetadata();
  return buildApprovalExecutionCompensationAuditPreviewContract({
    preview_id_hash: "hash:lifecycle-integration-compensation-preview",
    compensation_metadata: compensation,
    validation_results:
      validateApprovalExecutionCompensationPolicyMetadata(compensation),
  });
}

function integratedSnapshot() {
  return buildApprovalLifecycleIntegrationSnapshot({
    integrated_lifecycle_id: "integrated-lifecycle:phase-18h1",
    proposal: proposal(),
    review_session: reviewSession(),
    decision_record: decisionRecord(),
    authority_token: authorityToken(),
    execution_plan: executionPlan(),
    verification_metadata: verificationMetadata(),
    compensation_metadata: compensationMetadata(),
    audit_preview_metadata: compensationAuditPreview(),
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

describe("Phase 18H.1 approval lifecycle integration contract", () => {
  it("defines the metadata-only integrated lifecycle contract", () => {
    expect(DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT).toMatchObject({
      contract_version: "18H.1",
      contract_id: "approval_lifecycle_integration_contract",
      phase: 18,
      slice: "18H.1",
      metadata_only: true,
      integrated_lifecycle_shape_only: true,
      non_authoritative: true,
      non_executing: true,
      non_dispatching: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      operational_lifecycle_status_supported: false,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_advancement_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      usable_token_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      verification_supported: false,
      real_state_reads_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      restore_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      runtime_wiring_supported: false,
    });
    expect(
      ApprovalLifecycleIntegrationContractSchema.safeParse(
        DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("declares all required lifecycle segments", () => {
    expect(APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS).toEqual([
      "proposal",
      "review",
      "decision_record",
      "authority_token",
      "execution_plan",
      "verification",
      "compensation",
      "audit_preview",
    ]);
    expect(
      integratedSnapshot().segment_metadata.map((item) => item.segment),
    ).toEqual(APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS);

    for (const segment of integratedSnapshot().segment_metadata) {
      expect(segment).toMatchObject({
        present: true,
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
        operational_behavior_enabled: false,
        lifecycle_advancement_enabled: false,
        raw_payload_included: false,
        secret_material_included: false,
      });
    }
  });

  it("declares only inert lifecycle statuses and rejects operational statuses", () => {
    expect(APPROVAL_LIFECYCLE_INTEGRATION_STATUSES).toEqual([
      "unavailable",
      "metadata_assembled",
      "blocked",
      "invalid",
      "expired",
      "incomplete",
    ]);
    for (const status of [
      "active",
      "running",
      "executed",
      "verified",
      "compensated",
      "completed",
    ]) {
      expect(APPROVAL_LIFECYCLE_INTEGRATION_STATUSES).not.toContain(
        status as never,
      );
      expect(APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES).toContain(
        status as never,
      );
      expect(
        validateApprovalLifecycleIntegrationSnapshotShape({
          ...integratedSnapshot(),
          status,
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_integrated_lifecycle_status",
        metadata_only: true,
        action_executed: false,
        dispatch_performed: false,
        real_verification_performed: false,
        real_compensation_performed: false,
        persisted: false,
      });
    }
  });

  it("references every Phase 18A-G closeout foundation", () => {
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18A.6");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18B.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18C.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18D.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18E.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18F.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18G.4");
    expect(integratedSnapshot()).toMatchObject({
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      phase_18c_foundation_closeout_version: "18C.4",
      phase_18d_foundation_closeout_version: "18D.4",
      phase_18e_foundation_closeout_version: "18E.4",
      phase_18f_foundation_closeout_version: "18F.4",
      phase_18g_foundation_closeout_version: "18G.4",
    });
  });

  it("keeps disabled authority flags false", () => {
    expect(integratedSnapshot().disabled_authority_flags).toEqual({
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      authority_grant_enabled: false,
      token_issue_enabled: false,
      usable_token_enabled: false,
      execution_enabled: false,
      dispatch_enabled: false,
      tool_runtime_enabled: false,
      room_action_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      real_state_read_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
    });
  });

  it("builds a replay-safe and redaction-safe integrated lifecycle snapshot", () => {
    expect(integratedSnapshot()).toMatchObject({
      contract_version: "18H.1",
      integrated_lifecycle_id: "integrated-lifecycle:phase-18h1",
      proposal_id: "proposal:lifecycle-integration-item",
      review_session_id: "review-session:lifecycle-integration-session",
      decision_record_id: "decision-record:lifecycle-integration-record",
      authority_token_id: "authority-token:lifecycle-integration-token",
      execution_plan_id: "execution-plan:phase-18h1",
      verification_id: "verification:phase-18h1",
      compensation_id: "compensation:phase-18h1",
      proposal_kind: "note_create",
      status: "metadata_assembled",
      status_is_operational: false,
      replay_safe: true,
      redaction_safe: true,
      metadata_only: true,
      approval_created: false,
      approval_decision_handled: false,
      authority_granted: false,
      token_issued: false,
      usable_token_issued: false,
      action_executed: false,
      dispatch_performed: false,
      real_verification_performed: false,
      real_state_read_performed: false,
      real_compensation_performed: false,
      rollback_performed: false,
      restore_performed: false,
      persisted: false,
      telemetry_written: false,
      runtime_wired: false,
    });
    expect(
      ApprovalLifecycleIntegrationSnapshotSchema.safeParse(integratedSnapshot())
        .success,
    ).toBe(true);
    expect(
      validateApprovalLifecycleIntegrationSnapshotShape(integratedSnapshot()),
    ).toMatchObject({
      valid: true,
      reason: "valid_integrated_lifecycle_metadata",
      metadata_only: true,
      shape_validation_only: true,
      authority_granted: false,
      token_issued: false,
      action_executed: false,
      dispatch_performed: false,
      real_state_read_performed: false,
      real_compensation_performed: false,
      rollback_performed: false,
      restore_performed: false,
      persisted: false,
      telemetry_written: false,
    });
  });

  it("excludes raw payloads, tool args, prompts, outputs, contents, secrets, and raw state", () => {
    const keys = collectKeys(integratedSnapshot());
    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }
    expect(integratedSnapshot()).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      raw_state_included: false,
      secret_material_included: false,
    });
  });

  it("exposes no operational public exports for lifecycle integration", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
