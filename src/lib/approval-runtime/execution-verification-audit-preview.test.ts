import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS,
  ApprovalExecutionVerificationAuditPreviewContractSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationAuditPreviewContract,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionVerificationPolicyMetadata,
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
  "persist",
  "writeTelemetry",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function proposalAuditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:verification-audit-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:verification-audit-item",
    proposal_id: "proposal:verification-audit-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:verification-audit-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:verification-audit-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:verification-audit-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:verification-audit-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:verification-audit-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18f3",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18f3-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18f3",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18f3",
    redacted_reference: "redacted:phase-18f3-evidence",
    hash_reference: "hash:phase-18f3-evidence",
    observed_at_metadata_ms: 3_000,
  });
}

function auditPreview() {
  const verification = verificationMetadata();
  return buildApprovalExecutionVerificationAuditPreviewContract({
    preview_id_hash: "hash:verification-audit-preview",
    verification_metadata: verification,
    validation_results:
      validateApprovalExecutionVerificationPolicyMetadata(verification),
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

describe("Phase 18F.3 execution verification audit preview", () => {
  it("defines the metadata-only verification audit preview contract", () => {
    expect(auditPreview()).toMatchObject({
      contract_version: "18F.3",
      preview_id_hash: "hash:verification-audit-preview",
      phase: 18,
      slice: "18F.3",
      preview_kind: "approval_execution_verification_audit_preview",
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_safe_later: true,
      ui_wired: false,
      audit_shaped: true,
      audit_db_write_enabled: false,
    });
    expect(
      ApprovalExecutionVerificationAuditPreviewContractSchema.safeParse(
        auditPreview(),
      ).success,
    ).toBe(true);
  });

  it("declares all required audit preview sections", () => {
    expect(APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS).toEqual([
      "verification_summary",
      "execution_plan_reference",
      "proposal_reference",
      "verification_method_summary",
      "evidence_summary",
      "validation_results",
      "disabled_verification_status",
      "redaction_status",
      "replay_status",
    ]);
    expect(auditPreview().sections.map((section) => section.section)).toEqual(
      APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS,
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

  it("includes disabled verification and authority status", () => {
    expect(auditPreview().disabled_verification_status).toEqual({
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

  it("includes validation result metadata only", () => {
    expect(auditPreview().validation_results).toMatchObject({
      result_count: 32,
      passed_count: 32,
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
        real_verification_performed: false,
        real_state_read_performed: false,
        action_executed: false,
        dispatch_performed: false,
        compensation_performed: false,
        persisted: false,
        telemetry_written: false,
      });
    }
  });

  it("includes evidence summary metadata only", () => {
    expect(auditPreview().evidence_summary).toEqual({
      evidence_count: 1,
      evidence: [
        {
          evidence_id: "verification-evidence:phase-18f3",
          evidence_kind: "dry_run_comparison_reference_metadata",
          redacted_reference: "redacted:phase-18f3-evidence",
          hash_reference: "hash:phase-18f3-evidence",
          confidence_band: "medium_metadata",
          freshness_ref_hash: "hash:execution-plan-phase-18f3",
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
      real_evidence_collection_enabled: false,
      raw_payload_included: false,
    });
  });

  it("summarizes verification, plan, proposal, and method metadata only", () => {
    expect(auditPreview()).toMatchObject({
      verification_summary: {
        verification_ref_hash: "hash:verification-phase-18f3",
        proposal_kind: "note_create",
        status: "pending_metadata_only",
        status_is_operational: false,
        status_performs_real_verification: false,
        evidence_count: 1,
        verification_enabled: false,
        real_state_read_enabled: false,
        metadata_only: true,
      },
      execution_plan_reference: {
        execution_plan_id: "execution-plan:phase-18f3",
        execution_plan_ref_hash: "hash:execution-plan-phase-18f3",
        decision_record_id: "decision-record:verification-audit-record",
        review_session_id: "review-session:verification-audit-session",
        metadata_only: true,
        raw_payload_included: false,
      },
      proposal_reference: {
        proposal_id: "proposal:verification-audit-item",
        proposal_ref_hash: "hash:proposal-verification-audit-item",
        proposal_kind: "note_create",
        metadata_only: true,
        raw_payload_included: false,
      },
      verification_method_summary: {
        method: "dry_run_comparison_metadata",
        method_is_metadata_only: true,
        real_state_read_enabled: false,
        real_evidence_collection_enabled: false,
        verification_logic_enabled: false,
        execution_required: false,
        dispatch_required: false,
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

  it("marks failed validation metadata without enabling verification", () => {
    const verification = {
      ...verificationMetadata(),
      disabled_authority_flags: {
        ...verificationMetadata().disabled_authority_flags,
        verification_enabled: true,
      },
    };
    const preview = buildApprovalExecutionVerificationAuditPreviewContract({
      preview_id_hash: "hash:verification-audit-failed-preview",
      verification_metadata: verificationMetadata(),
      validation_results:
        validateApprovalExecutionVerificationPolicyMetadata(verification),
    });

    expect(preview.validation_results).toMatchObject({
      failed_count: 3,
      max_severity: "error",
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(preview.disabled_verification_status.verification_enabled).toBe(
      false,
    );
  });

  it("exposes no operational public exports for verification audit previews", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
