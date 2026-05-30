import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS,
  APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_COMPENSATION_STATUSES,
  APPROVAL_EXECUTION_COMPENSATION_STRATEGIES,
  APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_IDS,
  APPROVAL_RUNTIME_PHASE_18G_SLICES,
  ApprovalExecutionCompensationAuditPreviewContractSchema,
  ApprovalExecutionCompensationContractSchema,
  ApprovalExecutionCompensationValidationPolicyMatrixSchema,
  ApprovalRuntimePhase18GCloseoutGuardSchema,
  DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_COMPENSATION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionCompensationAuditPreviewContract,
  buildApprovalExecutionCompensationMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionCompensationMetadataShape,
  validateApprovalExecutionCompensationPolicyMetadata,
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
  "compensation_enabled",
  "rollback_enabled",
  "restore_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "tool_runtime_enabled",
  "room_action_enabled",
  "project_mutation_enabled",
  "obsidian_write_enabled",
  "memory_write_enabled",
  "network_call_enabled",
  "lifecycle_advancement_enabled",
  "verification_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
  "real_state_read_enabled",
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
    preview_id_hash: "hash:phase-18g-closeout-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18g-closeout",
    proposal_id: "proposal:phase-18g-closeout",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18g-closeout",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18g-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18g-closeout",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:phase-18g-closeout",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18g-decision-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18g-closeout",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:phase-18g-target-note",
    risk_class: "medium",
    step_id: "step:phase-18g-closeout",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18g-closeout",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18g-closeout",
    redacted_reference: "redacted:phase-18g-verification-evidence",
    hash_reference: "hash:phase-18g-verification-evidence",
    observed_at_metadata_ms: 3_000,
  });
}

function compensationMetadata(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalExecutionCompensationMetadata({
      compensation_id: "compensation:phase-18g-closeout",
      verification_metadata: verificationMetadata(),
      hint_id: "compensation-hint:phase-18g-closeout",
      evidence_id: "compensation-evidence:phase-18g-closeout",
      redacted_reference: "redacted:phase-18g-compensation",
      hash_reference: "hash:phase-18g-compensation",
    }),
    ...overrides,
  };
}

function validationResults(compensation: unknown = compensationMetadata()) {
  return validateApprovalExecutionCompensationPolicyMetadata(compensation);
}

function compensationAuditPreview(
  compensation: unknown = compensationMetadata(),
) {
  return buildApprovalExecutionCompensationAuditPreviewContract({
    preview_id_hash: "hash:phase-18g-closeout-preview",
    compensation_metadata: compensationMetadata(),
    validation_results: validationResults(compensation),
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

describe("Phase 18G.4 execution compensation closeout guard", () => {
  it("declares the Phase 18G closeout guard as inert metadata", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18G.4",
      closeout_id: "approval_runtime_phase_18g_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      phase_18c_foundation_closeout_version: "18C.4",
      phase_18d_foundation_closeout_version: "18D.4",
      phase_18e_foundation_closeout_version: "18E.4",
      phase_18f_foundation_closeout_version: "18F.4",
      execution_compensation_contract_version: "18G.1",
      execution_compensation_validation_contract_version: "18G.2",
      execution_compensation_audit_preview_contract_version: "18G.3",
      metadata_only: true,
      execution_compensation_layer_only: true,
      inert: true,
      non_compensating: true,
      non_rollback: true,
      non_restoring: true,
      non_state_reading: true,
      non_executing: true,
      non_dispatching: true,
      non_authoritative: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      real_compensation_supported: false,
      rollback_supported: false,
      restore_supported: false,
      inverse_operation_execution_supported: false,
      real_state_reads_supported: false,
      real_evidence_collection_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      verification_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      write_telemetry_supported: false,
      runtime_wiring_supported: false,
    });
    expect(
      ApprovalRuntimePhase18GCloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18G_SLICES);
  });

  it("proves Phase 18A through 18G foundations exist", () => {
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
      ApprovalExecutionCompensationContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionCompensationValidationPolicyMatrixSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_COMPENSATION_VALIDATION_POLICY_MATRIX,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionCompensationAuditPreviewContractSchema.safeParse(
        compensationAuditPreview(),
      ).success,
    ).toBe(true);
  });

  it("keeps compensation statuses inert and rejects operational statuses", () => {
    expect(APPROVAL_EXECUTION_COMPENSATION_STATUSES).toEqual([
      "unavailable",
      "hint_only",
      "blocked",
      "invalid",
      "expired",
      "not_performed",
    ]);
    expect(APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES).toEqual([
      "compensated",
      "rolled_back",
      "restored",
      "succeeded",
      "failed",
    ]);

    for (const status of APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_COMPENSATION_STATUSES).not.toContain(
        status as never,
      );
      expect(
        validateApprovalExecutionCompensationMetadataShape({
          ...compensationMetadata(),
          status,
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

  it("keeps compensation strategies metadata-only", () => {
    expect(APPROVAL_EXECUTION_COMPENSATION_STRATEGIES).toEqual([
      "inverse_operation_hint_metadata",
      "manual_repair_hint_metadata",
      "restore_snapshot_hint_metadata",
      "no_compensation_available_metadata",
    ]);
    expect(compensationMetadata().strategy_metadata).toMatchObject({
      strategy_is_metadata_only: true,
      real_compensation_enabled: false,
      rollback_enabled: false,
      restore_enabled: false,
      inverse_operation_execution_enabled: false,
      execution_required: false,
      dispatch_required: false,
      metadata_only: true,
    });
    expect(compensationAuditPreview().strategy_summary).toMatchObject({
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

  it("keeps hint and evidence metadata free of raw payloads, raw state, and secrets", () => {
    const keys = collectKeys({
      compensation: compensationMetadata(),
      validation: validationResults(),
      audit: compensationAuditPreview(),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
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
    expect(compensationAuditPreview().hint_summary.hints[0]).toMatchObject({
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
    expect(
      compensationAuditPreview().evidence_summary.evidence[0],
    ).toMatchObject({
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
    });
  });

  it("keeps all disabled compensation and authority flags false", () => {
    for (const output of [
      compensationMetadata(),
      compensationMetadata().disabled_authority_flags,
      validationResults(),
      compensationAuditPreview(),
      compensationAuditPreview().disabled_compensation_status,
      DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD,
    ]) {
      assertDisabledFlags(output);
    }
  });

  it("keeps compensation validation guards declared and inert", () => {
    expect(APPROVAL_EXECUTION_COMPENSATION_VALIDATION_GUARD_IDS).toEqual([
      "known_inert_compensation_status_only",
      "operational_status_rejected",
      "known_metadata_only_compensation_strategy_only",
      "compensation_replay_safe",
      "compensation_redaction_safe",
      "raw_payloads_forbidden",
      "secrets_forbidden",
      "hint_metadata_only",
      "hint_redacted_reference_only",
      "hint_hash_reference_only",
      "hint_no_raw_state",
      "hint_no_raw_device_payload",
      "hint_no_raw_tool_output",
      "hint_no_raw_project_content",
      "hint_no_raw_memory_content",
      "hint_no_model_output",
      "hint_no_prompts",
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
      "compensation_disabled",
      "rollback_disabled",
      "restore_disabled",
      "execution_disabled",
      "dispatch_disabled",
      "tool_runtime_disabled",
      "room_action_disabled",
      "project_mutation_disabled",
      "obsidian_write_disabled",
      "memory_write_disabled",
      "network_call_disabled",
      "lifecycle_advancement_disabled",
      "verification_disabled",
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
        real_compensation_performed: false,
        rollback_performed: false,
        restore_performed: false,
        inverse_operation_executed: false,
        real_state_read_performed: false,
        real_evidence_collected: false,
        approval_created: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        dispatch_performed: false,
        verification_performed: false,
        persisted: false,
        telemetry_written: false,
        runtime_wired: false,
      });
    }
  });

  it("keeps compensation audit preview sections and disabled status complete", () => {
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
    expect(
      compensationAuditPreview().sections.map((section) => section.section),
    ).toEqual(APPROVAL_EXECUTION_COMPENSATION_AUDIT_PREVIEW_SECTIONS);
    expect(
      compensationAuditPreview().disabled_compensation_status,
    ).toMatchObject({
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
    });
  });

  it("keeps compensation, validation, and audit outputs replay-safe and redaction-safe", () => {
    expect(compensationMetadata()).toMatchObject({
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
    expect(compensationAuditPreview()).toMatchObject({
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
