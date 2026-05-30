import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_COMPENSATION_STATUSES,
  APPROVAL_EXECUTION_COMPENSATION_STRATEGIES,
  ApprovalExecutionCompensationContractSchema,
  ApprovalExecutionCompensationMetadataSchema,
  DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionCompensationMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionCompensationMetadataShape,
  validateApprovalProposalMetadataGuards,
} from "./index";

const FORBIDDEN_RAW_KEYS = [
  "raw_payload",
  "payload",
  "tool_args",
  "tool_arguments",
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
    preview_id_hash: "hash:execution-compensation-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:execution-compensation-item",
    proposal_id: "proposal:execution-compensation-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:execution-compensation-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-compensation-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:execution-compensation-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:execution-compensation-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-compensation-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18g1",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18g1-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18g1",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18g1",
    redacted_reference: "redacted:phase-18g1-verification-evidence",
    hash_reference: "hash:phase-18g1-verification-evidence",
    observed_at_metadata_ms: 3_000,
  });
}

function compensationMetadata() {
  return buildApprovalExecutionCompensationMetadata({
    compensation_id: "compensation:phase-18g1",
    verification_metadata: verificationMetadata(),
    hint_id: "compensation-hint:phase-18g1",
    evidence_id: "compensation-evidence:phase-18g1",
    redacted_reference: "redacted:phase-18g1-compensation",
    hash_reference: "hash:phase-18g1-compensation",
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

describe("Phase 18G.1 execution compensation contract", () => {
  it("defines the metadata-only execution compensation contract", () => {
    expect(DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT).toMatchObject({
      contract_version: "18G.1",
      contract_id: "approval_execution_compensation_contract",
      phase: 18,
      slice: "18G.1",
      metadata_only: true,
      compensation_shape_only: true,
      non_authoritative: true,
      non_executing: true,
      non_dispatching: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      operational_compensation_status_supported: false,
      real_compensation_supported: false,
      rollback_supported: false,
      restore_supported: false,
      inverse_operation_execution_supported: false,
      real_state_reads_supported: false,
      real_evidence_collection_supported: false,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_advancement_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      tool_calls_supported: false,
      verification_supported: false,
      persistence_supported: false,
      event_store_writes_supported: false,
      telemetry_writes_supported: false,
      ui_rendering_supported: false,
      api_routes_supported: false,
      runtime_wiring_supported: false,
      network_cloud_calls_supported: false,
    });
    expect(
      ApprovalExecutionCompensationContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18F.4");
  });

  it("declares only inert compensation statuses and rejects operational statuses", () => {
    expect(APPROVAL_EXECUTION_COMPENSATION_STATUSES).toEqual([
      "unavailable",
      "hint_only",
      "blocked",
      "invalid",
      "expired",
      "not_performed",
    ]);

    for (const forbiddenStatus of [
      "compensated",
      "rolled_back",
      "restored",
      "succeeded",
      "failed",
    ]) {
      expect(APPROVAL_EXECUTION_COMPENSATION_STATUSES).not.toContain(
        forbiddenStatus as never,
      );
      expect(APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES).toContain(
        forbiddenStatus as never,
      );
      expect(
        validateApprovalExecutionCompensationMetadataShape({
          ...compensationMetadata(),
          status: forbiddenStatus,
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_compensation_status",
        metadata_only: true,
        real_compensation_performed: false,
        rollback_performed: false,
        restore_performed: false,
        action_executed: false,
        dispatch_performed: false,
        persisted: false,
      });
    }
  });

  it("declares compensation strategies as metadata-only", () => {
    expect(APPROVAL_EXECUTION_COMPENSATION_STRATEGIES).toEqual([
      "inverse_operation_hint_metadata",
      "manual_repair_hint_metadata",
      "restore_snapshot_hint_metadata",
      "no_compensation_available_metadata",
    ]);
    expect(compensationMetadata().strategy_metadata).toEqual({
      strategy: "manual_repair_hint_metadata",
      strategy_is_metadata_only: true,
      real_compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      inverse_operation_execution_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    });
  });

  it("builds replay-safe and redaction-safe compensation metadata only", () => {
    expect(compensationMetadata()).toMatchObject({
      contract_version: "18G.1",
      compensation_id: "compensation:phase-18g1",
      verification_id: "verification:phase-18g1",
      execution_plan_id: "execution-plan:phase-18g1",
      proposal_id: "proposal:execution-compensation-item",
      review_session_id: "review-session:execution-compensation-session",
      decision_record_id: "decision-record:execution-compensation-record",
      proposal_kind: "note_create",
      status: "hint_only",
      status_is_operational: false,
      status_performs_real_compensation: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      real_compensation_performed: false,
      rollback_performed: false,
      restore_performed: false,
      inverse_operation_executed: false,
      execution_performed: false,
      dispatch_performed: false,
      real_state_read_performed: false,
      persisted: false,
      telemetry_written: false,
      runtime_wired: false,
    });
    expect(
      ApprovalExecutionCompensationMetadataSchema.safeParse(
        compensationMetadata(),
      ).success,
    ).toBe(true);
  });

  it("keeps compensation hint metadata redacted and metadata-only", () => {
    expect(compensationMetadata().hint_metadata).toEqual([
      {
        hint_id: "compensation-hint:phase-18g1",
        hint_kind: "manual_repair_hint_metadata",
        redacted_reference: "redacted:phase-18g1-compensation",
        hash_reference: "hash:phase-18g1-compensation",
        eligibility_metadata: compensationMetadata().eligibility_metadata,
        risk_class: "medium",
        replay_safe: true,
        redaction_status: compensationMetadata().redaction_status,
      },
    ]);
  });

  it("keeps eligibility and evidence metadata inert", () => {
    expect(compensationMetadata().eligibility_metadata).toEqual({
      eligibility_ref_hash: "hash:verification-phase-18g1",
      eligibility_is_metadata_only: true,
      future_compensation_hint_available: true,
      real_eligibility_evaluated: false,
      real_state_read_enabled: false,
      restore_point_validated: false,
      metadata_only: true,
    });
    expect(compensationMetadata().evidence_metadata).toEqual([
      {
        evidence_id: "compensation-evidence:phase-18g1",
        evidence_kind: "verification_reference_metadata",
        redacted_reference: "redacted:phase-18g1-compensation",
        hash_reference: "hash:phase-18g1-compensation",
        replay_safe: true,
        redaction_status: compensationMetadata().redaction_status,
        real_evidence_collected: false,
        raw_payload_included: false,
        raw_state_included: false,
        secret_material_included: false,
        metadata_only: true,
      },
    ]);
  });

  it("keeps disabled authority flags false", () => {
    expect(compensationMetadata().disabled_authority_flags).toEqual({
      compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      execution_enabled: false,
      dispatch_enabled: false,
      tool_runtime_enabled: false,
      room_action_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      lifecycle_advancement_enabled: false,
      verification_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      authority_grant_enabled: false,
      token_issue_enabled: false,
      real_state_read_enabled: false,
      event_store_write_enabled: false,
      ui_rendering_enabled: false,
      api_route_enabled: false,
      runtime_wiring_enabled: false,
      scheduler_triggered_action_enabled: false,
      network_cloud_calls_enabled: false,
    });
  });

  it("excludes raw payloads, state, tool args, prompts, outputs, contents, and secrets", () => {
    const keys = collectKeys(compensationMetadata());
    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    expect(compensationMetadata()).toMatchObject({
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

  it("validates compensation metadata shape only", () => {
    expect(
      validateApprovalExecutionCompensationMetadataShape(
        compensationMetadata(),
      ),
    ).toEqual({
      valid: true,
      reason: "valid_compensation_metadata",
      metadata_only: true,
      shape_validation_only: true,
      real_compensation_performed: false,
      rollback_performed: false,
      restore_performed: false,
      approval_created: false,
      approval_decision_handled: false,
      lifecycle_advanced: false,
      authority_granted: false,
      token_issued: false,
      action_executed: false,
      dispatch_performed: false,
      verification_performed: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
      ui_rendered: false,
      api_route_called: false,
      network_called: false,
      cloud_called: false,
      secret_material_included: false,
    });
  });

  it("exposes no operational public exports for execution compensation", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
