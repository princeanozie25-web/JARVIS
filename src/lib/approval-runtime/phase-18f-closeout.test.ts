import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS,
  APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_VERIFICATION_METHODS,
  APPROVAL_EXECUTION_VERIFICATION_STATUSES,
  APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS,
  APPROVAL_RUNTIME_PHASE_18F_SLICES,
  ApprovalExecutionVerificationAuditPreviewContractSchema,
  ApprovalExecutionVerificationContractSchema,
  ApprovalExecutionVerificationValidationPolicyMatrixSchema,
  ApprovalRuntimePhase18FCloseoutGuardSchema,
  DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationAuditPreviewContract,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionVerificationMetadataShape,
  validateApprovalExecutionVerificationPolicyMetadata,
  validateApprovalProposalMetadataGuards,
} from "./index";

const FORBIDDEN_RAW_KEYS = [
  "raw_payload",
  "payload",
  "raw_body",
  "body",
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

const DISABLED_FLAG_KEYS = [
  "verification_enabled",
  "real_state_read_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "tool_runtime_enabled",
  "room_action_enabled",
  "project_mutation_enabled",
  "obsidian_write_enabled",
  "memory_write_enabled",
  "network_call_enabled",
  "lifecycle_advancement_enabled",
  "compensation_enabled",
  "rollback_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
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
    preview_id_hash: "hash:phase-18f-closeout-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18f-closeout",
    proposal_id: "proposal:phase-18f-closeout",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18f-closeout",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18f-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18f-closeout",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:phase-18f-closeout",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18f-decision-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18f-closeout",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:phase-18f-target-note",
    risk_class: "medium",
    step_id: "step:phase-18f-closeout",
  });
}

function verificationMetadata(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalExecutionVerificationMetadata({
      verification_id: "verification:phase-18f-closeout",
      execution_plan: executionPlan(),
      evidence_id: "verification-evidence:phase-18f-closeout",
      redacted_reference: "redacted:phase-18f-evidence",
      hash_reference: "hash:phase-18f-evidence",
      observed_at_metadata_ms: 3_000,
    }),
    ...overrides,
  };
}

function validationResults(verification: unknown = verificationMetadata()) {
  return validateApprovalExecutionVerificationPolicyMetadata(verification);
}

function verificationAuditPreview(
  verification: unknown = verificationMetadata(),
) {
  return buildApprovalExecutionVerificationAuditPreviewContract({
    preview_id_hash: "hash:phase-18f-closeout-preview",
    verification_metadata: verificationMetadata(),
    validation_results: validationResults(verification),
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

describe("Phase 18F.4 execution verification closeout guard", () => {
  it("declares the Phase 18F closeout guard as inert metadata", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18F.4",
      closeout_id: "approval_runtime_phase_18f_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      phase_18c_foundation_closeout_version: "18C.4",
      phase_18d_foundation_closeout_version: "18D.4",
      phase_18e_foundation_closeout_version: "18E.4",
      execution_verification_contract_version: "18F.1",
      execution_verification_validation_contract_version: "18F.2",
      execution_verification_audit_preview_contract_version: "18F.3",
      metadata_only: true,
      execution_verification_layer_only: true,
      inert: true,
      non_verifying: true,
      non_state_reading: true,
      non_executing: true,
      non_dispatching: true,
      non_authoritative: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      real_verification_supported: false,
      real_state_reads_supported: false,
      real_evidence_collection_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      write_telemetry_supported: false,
      runtime_wiring_supported: false,
    });
    expect(
      ApprovalRuntimePhase18FCloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18F_SLICES);
  });

  it("proves Phase 18A through 18F foundations exist", () => {
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
      ApprovalExecutionVerificationContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionVerificationValidationPolicyMatrixSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionVerificationAuditPreviewContractSchema.safeParse(
        verificationAuditPreview(),
      ).success,
    ).toBe(true);
  });

  it("keeps verification statuses inert and rejects operational statuses", () => {
    expect(APPROVAL_EXECUTION_VERIFICATION_STATUSES).toEqual([
      "unavailable",
      "pending_metadata_only",
      "blocked",
      "invalid",
      "expired",
      "not_performed",
    ]);
    expect(APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES).toEqual([
      "verified",
      "succeeded",
      "failed",
    ]);

    for (const status of APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_VERIFICATION_STATUSES).not.toContain(
        status as never,
      );
      expect(
        validateApprovalExecutionVerificationMetadataShape({
          ...verificationMetadata(),
          status,
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_verification_status",
        metadata_only: true,
        real_verification_performed: false,
        real_state_read_performed: false,
        action_executed: false,
        dispatch_performed: false,
        persisted: false,
      });
    }
  });

  it("keeps verification methods metadata-only", () => {
    expect(APPROVAL_EXECUTION_VERIFICATION_METHODS).toEqual([
      "state_diff_metadata",
      "dry_run_comparison_metadata",
      "audit_trace_metadata",
      "manual_review_metadata",
    ]);
    expect(verificationMetadata().method_metadata).toMatchObject({
      method_is_metadata_only: true,
      real_state_read_enabled: false,
      real_evidence_collection_enabled: false,
      verification_logic_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    });
    expect(
      verificationAuditPreview().verification_method_summary,
    ).toMatchObject({
      method_is_metadata_only: true,
      real_state_read_enabled: false,
      real_evidence_collection_enabled: false,
      verification_logic_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    });
  });

  it("keeps evidence metadata free of raw payloads, raw state, and secrets", () => {
    const keys = collectKeys({
      verification: verificationMetadata(),
      validation: validationResults(),
      audit: verificationAuditPreview(),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
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
    expect(
      verificationAuditPreview().evidence_summary.evidence[0],
    ).toMatchObject({
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
    });
  });

  it("keeps all disabled verification and authority flags false", () => {
    for (const output of [
      verificationMetadata(),
      verificationMetadata().disabled_authority_flags,
      validationResults(),
      verificationAuditPreview(),
      verificationAuditPreview().disabled_verification_status,
      DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
    ]) {
      assertDisabledFlags(output);
    }
  });

  it("keeps verification validation guards declared and inert", () => {
    expect(APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS).toEqual([
      "known_inert_verification_status_only",
      "operational_status_rejected",
      "known_metadata_only_verification_method_only",
      "verification_replay_safe",
      "verification_redaction_safe",
      "raw_payloads_forbidden",
      "secrets_forbidden",
      "evidence_metadata_only",
      "evidence_redacted_reference_only",
      "evidence_hash_reference_only",
      "evidence_no_raw_state",
      "evidence_no_raw_device_payload",
      "evidence_no_raw_tool_output",
      "evidence_no_raw_project_content",
      "evidence_no_raw_memory_content",
      "evidence_no_model_output",
      "evidence_no_prompts",
      "verification_disabled",
      "real_state_read_disabled",
      "execution_disabled",
      "dispatch_disabled",
      "tool_runtime_disabled",
      "room_action_disabled",
      "project_mutation_disabled",
      "obsidian_write_disabled",
      "memory_write_disabled",
      "network_call_disabled",
      "lifecycle_advancement_disabled",
      "compensation_disabled",
      "rollback_disabled",
      "persistence_disabled",
      "telemetry_write_disabled",
    ]);
    for (const result of validationResults()) {
      expect(result).toMatchObject({
        passed: true,
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        real_verification_performed: false,
        real_state_read_performed: false,
        real_evidence_collected: false,
        approval_created: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        dispatch_performed: false,
        compensation_performed: false,
        rollback_performed: false,
        persisted: false,
        telemetry_written: false,
        runtime_wired: false,
      });
    }
  });

  it("keeps verification audit preview sections and disabled status complete", () => {
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
    expect(
      verificationAuditPreview().sections.map((section) => section.section),
    ).toEqual(APPROVAL_EXECUTION_VERIFICATION_AUDIT_PREVIEW_SECTIONS);
    expect(
      verificationAuditPreview().disabled_verification_status,
    ).toMatchObject({
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
    });
  });

  it("keeps verification, validation, and audit outputs replay-safe and redaction-safe", () => {
    expect(verificationMetadata()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
    });
    for (const result of validationResults()) {
      expect(result).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
      });
    }
    expect(verificationAuditPreview()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      replay_status: {
        replay_safe: true,
        metadata_only: true,
      },
      redaction_status: {
        redaction_safe: true,
        metadata_only: true,
      },
    });
  });

  it("public exports expose no operational or persistence function names", () => {
    const exportedFunctionNames = Object.entries(approvalRuntime)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
