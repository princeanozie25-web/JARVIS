import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_DECISION_VALIDATION_GUARD_IDS,
  ApprovalDecisionValidationGuardResultSchema,
  ApprovalDecisionValidationPolicyMatrixSchema,
  DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
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

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:decision-validation-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:decision-validation-item",
    proposal_id: "proposal:decision-validation-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:decision-validation-request",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:decision-validation-request-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:decision-validation-session",
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
      decision_record_id: "decision-record:phase-18d2",
      review_session: reviewSession(),
      outcome: "approved_recorded",
      channel: "typed_confirmation",
      actor_ref_hash: "hash:local-user",
      reason_ref_hash: "hash:decision-validation-reason",
      reason_kind: "user_intent_metadata",
    }),
    ...overrides,
  };
}

function resultByGuard(
  input: unknown,
): Record<
  string,
  ReturnType<typeof validateApprovalDecisionRecordPolicyMetadata>[number]
> {
  return Object.fromEntries(
    validateApprovalDecisionRecordPolicyMetadata(input).map((result) => [
      result.guard_id,
      result,
    ]),
  );
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

describe("Phase 18D.2 approval decision validation guard", () => {
  it("defines the metadata-only decision validation guard contract", () => {
    expect(DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX).toMatchObject({
      contract_version: "18D.2",
      matrix_id: "approval_decision_validation_matrix",
      phase: 18,
      slice: "18D.2",
      metadata_only: true,
      guard_matrix_only: true,
      replay_safe: true,
      redaction_safe: true,
      non_authoritative: true,
      non_executing: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_advancement_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
    });
    expect(
      ApprovalDecisionValidationPolicyMatrixSchema.safeParse(
        DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX,
      ).success,
    ).toBe(true);
  });

  it("declares all required decision validation guards", () => {
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
    expect(
      DEFAULT_APPROVAL_DECISION_VALIDATION_POLICY_MATRIX.decision_guards.map(
        (guard) => guard.guard_id,
      ),
    ).toEqual(APPROVAL_DECISION_VALIDATION_GUARD_IDS);
  });

  it("passes valid metadata-only decision records", () => {
    const results =
      validateApprovalDecisionRecordPolicyMetadata(decisionRecord());

    expect(results).toHaveLength(APPROVAL_DECISION_VALIDATION_GUARD_IDS.length);
    expect(results.every((result) => result.passed)).toBe(true);
    for (const result of results) {
      expect(
        ApprovalDecisionValidationGuardResultSchema.safeParse(result).success,
      ).toBe(true);
      expect(result).toMatchObject({
        severity: "info",
        reason_code: "passed",
        redaction_status: "metadata_only",
        replay_safe: true,
        checked_at_source: "approval_decision_validation_matrix",
        metadata_only: true,
        approval_created: false,
        approval_decision_handled: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        persisted: false,
      });
    }
  });

  it("fails unknown proposal kinds", () => {
    const results = resultByGuard(
      decisionRecord({ proposal_kind: "unknown_kind" }),
    );

    expect(results.known_proposal_kind_only).toMatchObject({
      passed: false,
      reason_code: "unknown_proposal_kind",
      authority_granted: false,
      token_issued: false,
    });
  });

  it("fails unknown decision outcomes", () => {
    const results = resultByGuard(decisionRecord({ outcome: "unknown" }));

    expect(results.known_inert_decision_outcome_only).toMatchObject({
      passed: false,
      reason_code: "unknown_decision_outcome",
      approval_decision_handled: false,
      lifecycle_state_advanced: false,
    });
  });

  it.each([
    ["voice_only", "voice_only_channel_rejected"],
    ["auto_approval", "auto_approval_channel_rejected"],
    ["scheduler_decision", "scheduler_decision_channel_rejected"],
    ["background_decision", "background_decision_channel_rejected"],
    ["network_decision", "network_decision_channel_rejected"],
  ] as const)("fails forbidden channel %s", (channel, guardId) => {
    const results = resultByGuard({
      ...decisionRecord(),
      channel_metadata: {
        ...decisionRecord().channel_metadata,
        channel,
      },
    });

    expect(results.allowed_decision_channel_only).toMatchObject({
      passed: false,
      reason_code: "disallowed_decision_channel",
    });
    expect(results[guardId]).toMatchObject({
      passed: false,
      authority_granted: false,
      action_executed: false,
      dispatch_performed: false,
    });
  });

  it.each([
    ["lifecycle_advancement_enabled", "lifecycle_advancement_disabled"],
    ["authority_grant_enabled", "authority_grant_disabled"],
    ["token_issue_enabled", "token_issue_disabled"],
    ["execution_enabled", "execution_disabled"],
    ["dispatch_enabled", "dispatch_disabled"],
    ["verification_enabled", "verification_disabled"],
    ["compensation_enabled", "compensation_disabled"],
    ["rollback_enabled", "rollback_disabled"],
    ["persistence_enabled", "persistence_disabled"],
    ["telemetry_write_enabled", "telemetry_write_disabled"],
  ] as const)("fails when %s is true", (flag, guardId) => {
    const results = resultByGuard({
      ...decisionRecord(),
      disabled_authority_flags: {
        ...decisionRecord().disabled_authority_flags,
        [flag]: true,
      },
    });

    expect(results[guardId]).toMatchObject({
      passed: false,
      authority_granted: false,
      token_issued: false,
      action_executed: false,
      persisted: false,
      telemetry_written: false,
    });
  });

  it("fails records that are not replay-safe or redaction-safe", () => {
    expect(
      resultByGuard({ ...decisionRecord(), replay_safe: false })
        .record_replay_safe,
    ).toMatchObject({
      passed: false,
      reason_code: "record_not_replay_safe",
    });
    expect(
      resultByGuard({ ...decisionRecord(), redaction_safe: false })
        .record_redaction_safe,
    ).toMatchObject({
      passed: false,
      reason_code: "record_not_redaction_safe",
    });
  });

  it("fails raw payloads and secrets", () => {
    for (const unsafeRecord of [
      { ...decisionRecord(), raw_payload: "not allowed" },
      { ...decisionRecord(), secret: "not allowed" },
      { ...decisionRecord(), secret_material_included: true },
    ]) {
      expect(
        resultByGuard(unsafeRecord).raw_payloads_and_secrets_excluded,
      ).toMatchObject({
        passed: false,
        reason_code: "raw_payload_or_secret_present",
        raw_payload_included: false,
        secret_material_included: false,
      });
    }
  });

  it("validation output contains no raw payloads", () => {
    const keys = collectKeys(
      validateApprovalDecisionRecordPolicyMetadata(decisionRecord()),
    );

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
  });

  it("exposes no approve, deny, createApproval, grantAuthority, issueToken, execute, dispatch, run, verify, compensate, rollback, or persist functions", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|grantAuthority|issueToken|execute|dispatch|run|verify|compensate|rollback|persist)/i;
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
