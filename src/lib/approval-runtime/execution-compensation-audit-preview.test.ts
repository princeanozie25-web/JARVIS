import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS,
  ApprovalExecutionCompensationAuditPreviewContractSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionCompensationAuditPreviewContract,
  buildApprovalExecutionCompensationMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionCompensationPolicyMetadata,
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
    preview_id_hash: "hash:compensation-audit-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:compensation-audit-item",
    proposal_id: "proposal:compensation-audit-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:compensation-audit-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:compensation-audit-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:compensation-audit-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:compensation-audit-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:compensation-audit-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18g3",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18g3-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18g3",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18g3",
    redacted_reference: "redacted:phase-18g3-verification-evidence",
    hash_reference: "hash:phase-18g3-verification-evidence",
    observed_at_metadata_ms: 3_000,
  });
}

function compensationMetadata() {
  return buildApprovalExecutionCompensationMetadata({
    compensation_id: "compensation:phase-18g3",
    verification_metadata: verificationMetadata(),
    hint_id: "compensation-hint:phase-18g3",
    evidence_id: "compensation-evidence:phase-18g3",
    redacted_reference: "redacted:phase-18g3-compensation",
    hash_reference: "hash:phase-18g3-compensation",
  });
}

function auditPreview() {
  const compensation = compensationMetadata();
  return buildApprovalExecutionCompensationAuditPreviewContract({
    preview_id_hash: "hash:compensation-audit-preview",
    compensation_metadata: compensation,
    validation_results:
      validateApprovalExecutionCompensationPolicyMetadata(compensation),
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

describe("Phase 18G.3 execution compensation audit preview", () => {
  it("defines the metadata-only compensation audit preview contract", () => {
    expect(auditPreview()).toMatchObject({
      contract_version: "18G.3",
      preview_id_hash: "hash:compensation-audit-preview",
      phase: 18,
      slice: "18G.3",
      preview_kind: "approval_execution_compensation_audit_preview",
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_safe_later: true,
      ui_wired: false,
      audit_shaped: true,
      audit_db_write_enabled: false,
    });
    expect(
      ApprovalExecutionCompensationAuditPreviewContractSchema.safeParse(
        auditPreview(),
      ).success,
    ).toBe(true);
  });

  it("declares all required audit preview sections", () => {
    expect(APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS).toEqual([
      "compensation_summary",
      "verification_reference",
      "execution_plan_reference",
      "strategy_summary",
      "eligibility_summary",
      "hint_summary",
      "evidence_summary",
      "validation_results",
      "disabled_compensation_status",
      "redaction_status",
      "replay_status",
    ]);
    expect(auditPreview().sections.map((section) => section.section)).toEqual(
      APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS,
    );

    for (const section of auditPreview().sections) {
      expect(section).toMatchObject({
        included: true,
        metadata_only: true,
        ui_safe_later: true,
        ui_wired: false,
        audit_shaped: true,
        audit_db_write_enabled: false,
        raw_payload_included: false,
      });
    }
  });

  it("includes disabled compensation and authority status", () => {
    expect(auditPreview().disabled_compensation_status).toEqual({
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
      real_state_read_enabled: false,
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

  it("includes validation result metadata only", () => {
    expect(auditPreview().validation_results).toMatchObject({
      result_count: 42,
      passed_count: 42,
      failed_count: 0,
      max_severity: "info",
      metadata_only: true,
      raw_payload_included: false,
    });

    for (const result of auditPreview().validation_results.results) {
      expect(result).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_tool_output_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_state_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
        real_compensation_performed: false,
        rollback_performed: false,
        restore_performed: false,
        real_state_read_performed: false,
        action_executed: false,
        dispatch_performed: false,
        verification_performed: false,
        persisted: false,
        telemetry_written: false,
      });
    }
  });

  it("includes hint and evidence summary metadata only", () => {
    expect(auditPreview().hint_summary).toEqual({
      hint_count: 1,
      hints: [
        {
          hint_id: "compensation-hint:phase-18g3",
          hint_kind: "manual_repair_hint_metadata",
          redacted_reference: "redacted:phase-18g3-compensation",
          hash_reference: "hash:phase-18g3-compensation",
          eligibility_ref_hash: "hash:verification-phase-18g3",
          risk_class: "medium",
          replay_safe: true,
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
          raw_tool_arguments_included: false,
          raw_tool_output_included: false,
          raw_prompt_included: false,
          raw_model_output_included: false,
          raw_state_included: false,
          raw_device_payload_included: false,
          raw_project_content_included: false,
          raw_memory_content_included: false,
          secret_material_included: false,
        },
      ],
      metadata_only: true,
      real_compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      raw_payload_included: false,
    });

    expect(auditPreview().evidence_summary).toEqual({
      evidence_count: 1,
      evidence: [
        {
          evidence_id: "compensation-evidence:phase-18g3",
          evidence_kind: "verification_reference_metadata",
          redacted_reference: "redacted:phase-18g3-compensation",
          hash_reference: "hash:phase-18g3-compensation",
          replay_safe: true,
          redaction_status: "metadata_only",
          metadata_only: true,
          real_evidence_collected: false,
          raw_payload_included: false,
          raw_tool_arguments_included: false,
          raw_tool_output_included: false,
          raw_prompt_included: false,
          raw_model_output_included: false,
          raw_state_included: false,
          raw_device_payload_included: false,
          raw_project_content_included: false,
          raw_memory_content_included: false,
          secret_material_included: false,
        },
      ],
      metadata_only: true,
      real_evidence_collection_enabled: false,
      raw_payload_included: false,
    });
  });

  it("summarizes compensation, verification, plan, strategy, and eligibility metadata only", () => {
    expect(auditPreview()).toMatchObject({
      compensation_summary: {
        compensation_ref_hash: "hash:compensation-phase-18g3",
        proposal_kind: "note_create",
        status: "hint_only",
        status_is_operational: false,
        status_performs_real_compensation: false,
        hint_count: 1,
        evidence_count: 1,
        compensation_enabled: false,
        rollback_enabled: false,
        restore_enabled: false,
        metadata_only: true,
      },
      verification_reference: {
        verification_id: "verification:phase-18g3",
        verification_ref_hash: "hash:verification-phase-18g3",
        real_state_read_enabled: false,
        verification_logic_enabled: false,
        metadata_only: true,
        raw_payload_included: false,
      },
      execution_plan_reference: {
        execution_plan_id: "execution-plan:phase-18g3",
        execution_plan_ref_hash: "hash:execution-plan-phase-18g3",
        decision_record_id: "decision-record:compensation-audit-record",
        review_session_id: "review-session:compensation-audit-session",
        metadata_only: true,
        raw_payload_included: false,
      },
      strategy_summary: {
        strategy: "manual_repair_hint_metadata",
        strategy_is_metadata_only: true,
        real_compensation_enabled: false,
        rollback_enabled: false,
        restore_enabled: false,
        inverse_operation_execution_enabled: false,
        execution_required: false,
        dispatch_required: false,
        metadata_only: true,
      },
      eligibility_summary: {
        eligibility_ref_hash: "hash:verification-phase-18g3",
        future_compensation_hint_available: true,
        real_eligibility_evaluated: false,
        real_state_read_enabled: false,
        restore_point_validated: false,
        metadata_only: true,
      },
    });
  });

  it("excludes raw payloads, tool args, prompts, model outputs, contents, secrets, and raw state", () => {
    const keys = collectKeys(auditPreview());
    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    expect(auditPreview().redaction_status).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_tool_output_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_state_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
      pii_included: false,
      metadata_only: true,
    });
  });

  it("is replay-safe and redaction-safe", () => {
    expect(auditPreview()).toMatchObject({
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

  it("marks failed validation metadata without enabling compensation", () => {
    const compensation = {
      ...compensationMetadata(),
      disabled_authority_flags: {
        ...compensationMetadata().disabled_authority_flags,
        compensation_enabled: true,
      },
    };
    const preview = buildApprovalExecutionCompensationAuditPreviewContract({
      preview_id_hash: "hash:compensation-audit-failed-preview",
      compensation_metadata: compensationMetadata(),
      validation_results:
        validateApprovalExecutionCompensationPolicyMetadata(compensation),
    });

    expect(preview.validation_results).toMatchObject({
      failed_count: 3,
      max_severity: "error",
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(preview.disabled_compensation_status.compensation_enabled).toBe(
      false,
    );
  });

  it("exposes no operational public exports for compensation audit previews", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
