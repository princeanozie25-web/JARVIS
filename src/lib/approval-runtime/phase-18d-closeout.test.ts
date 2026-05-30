import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS,
  APPROVAL_DECISION_RECORD_CHANNELS,
  APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS,
  APPROVAL_DECISION_RECORD_OUTCOMES,
  APPROVAL_DECISION_VALIDATION_GUARD_IDS,
  APPROVAL_RUNTIME_PHASE_18D_SLICES,
  ApprovalDecisionAuditPreviewContractSchema,
  ApprovalDecisionRecordContractSchema,
  ApprovalDecisionValidationPolicyMatrixSchema,
  ApprovalRuntimePhase18DCloseoutGuardSchema,
  DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT,
  DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalDecisionRecordPolicyMetadata,
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
  "lifecycle_advancement_enabled",
  "approval_creation_enabled",
  "approval_decision_handling_enabled",
  "authority_grant_enabled",
  "token_issue_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "verification_enabled",
  "compensation_enabled",
  "rollback_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:phase-18d-closeout-preview-source",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18d-closeout",
    proposal_id: "proposal:phase-18d-closeout",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18d-closeout",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18d-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18d-closeout",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalDecisionRecordMetadata({
      decision_record_id: "decision-record:phase-18d-closeout",
      review_session: reviewSession(),
      outcome: "approved_recorded",
      channel: "typed_confirmation",
      actor_ref_hash: "hash:local-user",
      reason_ref_hash: "hash:phase-18d-decision-reason",
      reason_kind: "user_intent_metadata",
    }),
    ...overrides,
  };
}

function validationResults(record: unknown = decisionRecord()) {
  return validateApprovalDecisionRecordPolicyMetadata(record);
}

function decisionAuditPreview(record: unknown = decisionRecord()) {
  return buildApprovalDecisionAuditPreviewContract({
    preview_id_hash: "hash:phase-18d-closeout-preview",
    decision_record: record,
    validation_results: validationResults(record),
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

describe("Phase 18D.4 approval decision closeout guard", () => {
  it("declares the Phase 18D closeout guard as inert metadata", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18D.4",
      closeout_id: "approval_runtime_phase_18d_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      phase_18c_foundation_closeout_version: "18C.4",
      approval_decision_record_contract_version: "18D.1",
      approval_decision_validation_contract_version: "18D.2",
      approval_decision_audit_preview_contract_version: "18D.3",
      metadata_only: true,
      decision_record_layer_only: true,
      inert: true,
      non_executing: true,
      non_authoritative: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_state_advancement_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      write_telemetry_supported: false,
    });
    expect(
      ApprovalRuntimePhase18DCloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18D_SLICES);
  });

  it("proves Phase 18A, 18B, 18C, and 18D foundations exist", () => {
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
      ApprovalDecisionRecordContractSchema.safeParse(
        DEFAULT_APPROVAL_DECISION_RECORD_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalDecisionValidationPolicyMatrixSchema.safeParse(
        DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX,
      ).success,
    ).toBe(true);
    expect(
      ApprovalDecisionAuditPreviewContractSchema.safeParse(
        decisionAuditPreview(),
      ).success,
    ).toBe(true);
  });

  it("keeps decision outcomes inert record metadata only", () => {
    expect(APPROVAL_DECISION_RECORD_OUTCOMES).toEqual([
      "approved_recorded",
      "denied_recorded",
      "expired_recorded",
      "dismissed_recorded",
      "changes_requested_recorded",
    ]);
    expect(decisionRecord()).toMatchObject({
      outcome_is_record_metadata_only: true,
      performs_lifecycle_transition: false,
      creates_approval: false,
      handles_approval_decision: false,
      metadata_only: true,
    });
    expect(decisionAuditPreview().decision_summary).toMatchObject({
      outcome_is_record_metadata_only: true,
      performs_lifecycle_transition: false,
      creates_approval: false,
      handles_approval_decision: false,
    });
  });

  it("keeps allowed channels fixed and forbidden channels rejected", () => {
    expect(APPROVAL_DECISION_RECORD_CHANNELS).toEqual([
      "ui_click",
      "keyboard",
      "typed_confirmation",
    ]);
    expect(APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS).toEqual([
      "voice_only",
      "auto_approval",
      "scheduler_decision",
      "background_decision",
      "network_decision",
    ]);

    for (const channel of APPROVAL_DECISION_RECORD_FORBIDDEN_CHANNELS) {
      const record = {
        ...decisionRecord(),
        channel_metadata: {
          ...decisionRecord().channel_metadata,
          channel,
        },
      };
      const preview = decisionAuditPreview(record);

      expect(preview.channel_policy).toMatchObject({
        observed_channel: channel,
        channel_allowed: false,
        forbidden_channel_detected: channel,
      });
      expect(preview.forbidden_channels).toMatchObject({
        rejected: true,
        detected_forbidden_channel: channel,
      });
      expect(validationResults(record).some((result) => !result.passed)).toBe(
        true,
      );
    }
  });

  it("keeps disabled authority flags false everywhere", () => {
    for (const output of [
      decisionRecord(),
      decisionRecord().disabled_authority_flags,
      validationResults(),
      decisionAuditPreview(),
      decisionAuditPreview().disabled_authority_status,
      DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
    ]) {
      assertDisabledFlags(output);
    }
  });

  it("keeps validation guards declared and inert", () => {
    expect(APPROVAL_DECISION_VALIDATION_GUARD_IDS).toEqual([
      "known_proposal_kind_only",
      "known_inert_decision_outcome_only",
      "allowed_decision_channel_only",
      "voice_only_channel_rejected",
      "auto_approval_channel_rejected",
      "scheduler_decision_channel_rejected",
      "background_decision_channel_rejected",
      "network_decision_channel_rejected",
      "lifecycle_advancement_disabled",
      "authority_grant_disabled",
      "token_issue_disabled",
      "execution_disabled",
      "dispatch_disabled",
      "verification_disabled",
      "compensation_disabled",
      "rollback_disabled",
      "persistence_disabled",
      "telemetry_write_disabled",
      "record_replay_safe",
      "record_redaction_safe",
      "raw_payloads_and_secrets_excluded",
    ]);
    for (const result of validationResults()) {
      expect(result).toMatchObject({
        passed: true,
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        approval_created: false,
        approval_decision_handled: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        persisted: false,
        telemetry_written: false,
      });
    }
  });

  it("keeps decision audit preview sections and disabled status complete", () => {
    expect(APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS).toEqual([
      "decision_summary",
      "proposal_reference",
      "review_session_reference",
      "channel_policy",
      "validation_results",
      "forbidden_channels",
      "disabled_authority_status",
      "redaction_status",
      "replay_status",
    ]);
    expect(
      decisionAuditPreview().sections.map((section) => section.section),
    ).toEqual(APPROVAL_DECISION_AUDIT_PREVIEW_SECTIONS);
    expect(decisionAuditPreview().disabled_authority_status).toMatchObject({
      lifecycle_advancement_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      authority_grant_enabled: false,
      token_issue_enabled: false,
      execution_enabled: false,
      dispatch_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      telemetry_write_enabled: false,
    });
  });

  it("keeps decision record, validation, and audit metadata free of raw payloads and secrets", () => {
    const keys = collectKeys({
      decision_record: decisionRecord(),
      validation_results: validationResults(),
      decision_audit_preview: decisionAuditPreview(),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(decisionRecord()).toMatchObject({
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

  it("keeps decision record, validation, and audit outputs replay-safe and redaction-safe", () => {
    expect(decisionRecord()).toMatchObject({
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
    expect(decisionAuditPreview()).toMatchObject({
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
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|grantAuthority|issueToken|execute|dispatch|run|verify|compensate|rollback|persist|writeTelemetry)/i;
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
