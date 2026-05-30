import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_VERIFICATION_METHODS,
  APPROVAL_EXECUTION_VERIFICATION_STATUSES,
  ApprovalExecutionVerificationContractSchema,
  ApprovalExecutionVerificationMetadataSchema,
  DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionVerificationMetadataShape,
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
  "compensate",
  "rollback",
  "persist",
  "writeTelemetry",
  "readState",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function proposalAuditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:execution-verification-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:execution-verification-item",
    proposal_id: "proposal:execution-verification-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:execution-verification-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-verification-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:execution-verification-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:execution-verification-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-verification-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18f1",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18f1-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18f1",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18f1",
    redacted_reference: "redacted:phase-18f1-evidence",
    hash_reference: "hash:phase-18f1-evidence",
    observed_at_metadata_ms: 3_000,
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

describe("Phase 18F.1 execution verification contract", () => {
  it("defines the metadata-only execution verification contract", () => {
    expect(DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT).toMatchObject({
      contract_version: "18F.1",
      contract_id: "approval_execution_verification_contract",
      phase: 18,
      slice: "18F.1",
      metadata_only: true,
      verification_shape_only: true,
      non_authoritative: true,
      non_executing: true,
      non_dispatching: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      operational_verification_status_supported: false,
      real_verification_supported: false,
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
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      event_store_writes_supported: false,
      telemetry_writes_supported: false,
      ui_rendering_supported: false,
      api_routes_supported: false,
      runtime_wiring_supported: false,
      network_cloud_calls_supported: false,
    });
    expect(
      ApprovalExecutionVerificationContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18E.4");
  });

  it("declares only inert verification statuses and rejects operational statuses", () => {
    expect(APPROVAL_EXECUTION_VERIFICATION_STATUSES).toEqual([
      "unavailable",
      "pending_metadata_only",
      "blocked",
      "invalid",
      "expired",
      "not_performed",
    ]);

    for (const forbiddenStatus of ["verified", "succeeded", "failed"]) {
      expect(APPROVAL_EXECUTION_VERIFICATION_STATUSES).not.toContain(
        forbiddenStatus as never,
      );
      expect(APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES).toContain(
        forbiddenStatus as never,
      );
      expect(
        validateApprovalExecutionVerificationMetadataShape({
          ...verificationMetadata(),
          status: forbiddenStatus,
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_verification_status",
        metadata_only: true,
        real_verification_performed: false,
        action_executed: false,
        dispatch_performed: false,
        persisted: false,
      });
    }
  });

  it("declares verification methods as metadata-only", () => {
    expect(APPROVAL_EXECUTION_VERIFICATION_METHODS).toEqual([
      "state_diff_metadata",
      "dry_run_comparison_metadata",
      "audit_trace_metadata",
      "manual_review_metadata",
    ]);
    expect(verificationMetadata().method_metadata).toEqual({
      method: "dry_run_comparison_metadata",
      method_is_metadata_only: true,
      real_state_read_enabled: false,
      real_evidence_collection_enabled: false,
      verification_logic_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    });
  });

  it("builds replay-safe and redaction-safe verification metadata only", () => {
    expect(verificationMetadata()).toMatchObject({
      contract_version: "18F.1",
      verification_id: "verification:phase-18f1",
      execution_plan_id: "execution-plan:phase-18f1",
      proposal_id: "proposal:execution-verification-item",
      review_session_id: "review-session:execution-verification-session",
      decision_record_id: "decision-record:execution-verification-record",
      proposal_kind: "note_create",
      status: "pending_metadata_only",
      status_is_operational: false,
      status_performs_real_verification: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      real_verification_performed: false,
      real_state_read_performed: false,
      real_evidence_collected: false,
      execution_performed: false,
      dispatch_performed: false,
      persisted: false,
      telemetry_written: false,
      runtime_wired: false,
    });
    expect(
      ApprovalExecutionVerificationMetadataSchema.safeParse(
        verificationMetadata(),
      ).success,
    ).toBe(true);
  });

  it("keeps verification evidence metadata redacted and metadata-only", () => {
    expect(verificationMetadata().evidence_metadata).toEqual([
      {
        evidence_id: "verification-evidence:phase-18f1",
        evidence_kind: "dry_run_comparison_reference_metadata",
        redacted_reference: "redacted:phase-18f1-evidence",
        hash_reference: "hash:phase-18f1-evidence",
        confidence_band: "medium_metadata",
        freshness_metadata: {
          freshness_ref_hash: "hash:execution-plan-phase-18f1",
          observed_at_metadata_ms: 3_000,
          real_state_observed: false,
          timers_registered: false,
          scheduler_registered: false,
          metadata_only: true,
        },
        replay_safe: true,
        redaction_status: verificationMetadata().redaction_status,
      },
    ]);
  });

  it("keeps verification target metadata descriptive and state-read-free", () => {
    expect(verificationMetadata().target_metadata).toEqual({
      execution_plan_ref_hash: "hash:execution-plan-phase-18f1",
      proposal_kind: "note_create",
      target_class: "obsidian_note",
      target_ref_hash: "hash:target-note",
      risk_class: "medium",
      real_state_read_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      room_action_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      metadata_only: true,
    });
  });

  it("keeps disabled authority flags false", () => {
    expect(verificationMetadata().disabled_authority_flags).toEqual({
      verification_enabled: false,
      real_state_read_enabled: false,
      execution_enabled: false,
      dispatch_enabled: false,
      tool_runtime_enabled: false,
      room_action_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      lifecycle_advancement_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      authority_grant_enabled: false,
      token_issue_enabled: false,
      event_store_write_enabled: false,
      ui_rendering_enabled: false,
      api_route_enabled: false,
      runtime_wiring_enabled: false,
      scheduler_triggered_action_enabled: false,
      network_cloud_calls_enabled: false,
    });
  });

  it("excludes raw payloads, tool args, prompts, outputs, contents, and secrets", () => {
    const keys = collectKeys(verificationMetadata());
    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    expect(verificationMetadata()).toMatchObject({
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

  it("validates verification metadata shape only", () => {
    expect(
      validateApprovalExecutionVerificationMetadataShape(
        verificationMetadata(),
      ),
    ).toEqual({
      valid: true,
      reason: "valid_verification_metadata",
      metadata_only: true,
      shape_validation_only: true,
      real_verification_performed: false,
      real_state_read_performed: false,
      real_evidence_collected: false,
      approval_created: false,
      approval_decision_handled: false,
      lifecycle_advanced: false,
      authority_granted: false,
      token_issued: false,
      action_executed: false,
      dispatch_performed: false,
      compensation_performed: false,
      rollback_performed: false,
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

  it("exposes no operational public exports for execution verification", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
