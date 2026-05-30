import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS,
  ApprovalLifecycleIntegrationValidationGuardResultSchema,
  DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
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
  validateApprovalLifecycleIntegrationPolicyMetadata,
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
    preview_id_hash: "hash:lifecycle-validation-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:lifecycle-validation-item",
    proposal_id: "proposal:lifecycle-validation-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:lifecycle-validation-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:lifecycle-validation-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:lifecycle-validation-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:lifecycle-validation-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:lifecycle-validation-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function authorityToken() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:lifecycle-validation-token",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 3_000,
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18h2",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18h2-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18h2",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18h2",
    redacted_reference: "redacted:phase-18h2-verification-evidence",
    hash_reference: "hash:phase-18h2-verification-evidence",
    observed_at_metadata_ms: 4_000,
  });
}

function compensationMetadata() {
  return buildApprovalExecutionCompensationMetadata({
    compensation_id: "compensation:phase-18h2",
    verification_metadata: verificationMetadata(),
    hint_id: "compensation-hint:phase-18h2",
    evidence_id: "compensation-evidence:phase-18h2",
    redacted_reference: "redacted:phase-18h2-compensation",
    hash_reference: "hash:phase-18h2-compensation",
  });
}

function compensationAuditPreview() {
  const compensation = compensationMetadata();
  return buildApprovalExecutionCompensationAuditPreviewContract({
    preview_id_hash: "hash:lifecycle-validation-compensation-preview",
    compensation_metadata: compensation,
    validation_results:
      validateApprovalExecutionCompensationPolicyMetadata(compensation),
  });
}

function integratedSnapshot() {
  return buildApprovalLifecycleIntegrationSnapshot({
    integrated_lifecycle_id: "integrated-lifecycle:phase-18h2",
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

function resultFor(
  input: unknown,
  guardId: (typeof APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS)[number],
) {
  const result = validateApprovalLifecycleIntegrationPolicyMetadata(input).find(
    (guard) => guard.guard_id === guardId,
  );
  expect(result).toBeDefined();
  return result!;
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

describe("Phase 18H.2 approval lifecycle integration validation guard", () => {
  it("defines the metadata-only integration validation guard contract", () => {
    expect(
      DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX,
    ).toMatchObject({
      contract_version: "18H.2",
      matrix_id: "approval_lifecycle_integration_validation_matrix",
      phase: 18,
      slice: "18H.2",
      metadata_only: true,
      guard_matrix_only: true,
      replay_safe: true,
      redaction_safe: true,
      non_authoritative: true,
      non_executing: true,
      non_dispatching: true,
      non_persistent: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_advancement_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      usable_token_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      tool_calls_supported: false,
      real_state_reads_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      restore_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      runtime_wiring_supported: false,
    });
  });

  it("declares all required guards as inert metadata", () => {
    const guards = [
      ...DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX.segment_guards,
      ...DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX.snapshot_guards,
      ...DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX.disabled_authority_guards,
    ];
    const declaredGuardIds = guards.map((guard) => guard.guard_id);

    expect(declaredGuardIds).toHaveLength(
      APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS.length,
    );
    expect(declaredGuardIds).toEqual(
      expect.arrayContaining([
        ...APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS,
      ]),
    );

    for (const guard of guards) {
      expect(guard).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        creates_approval: false,
        handles_approval_decision: false,
        grants_authority: false,
        issues_token: false,
        issues_usable_token: false,
        advances_lifecycle_state: false,
        executes_action: false,
        dispatches_tool: false,
        reads_real_state: false,
        performs_real_verification: false,
        performs_real_compensation: false,
        performs_rollback: false,
        performs_restore: false,
        writes_persistence: false,
        wires_runtime: false,
      });
    }
  });

  it("passes valid metadata-only integrated lifecycle snapshots", () => {
    const results =
      validateApprovalLifecycleIntegrationPolicyMetadata(integratedSnapshot());

    expect(results).toHaveLength(
      APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_GUARD_IDS.length,
    );
    expect(results.every((result) => result.passed)).toBe(true);
    for (const result of results) {
      expect(
        ApprovalLifecycleIntegrationValidationGuardResultSchema.safeParse(
          result,
        ).success,
      ).toBe(true);
      expect(result).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        checked_at_source: "approval_lifecycle_integration_validation_matrix",
        approval_created: false,
        approval_decision_handled: false,
        authority_granted: false,
        token_issued: false,
        usable_token_issued: false,
        action_executed: false,
        dispatch_performed: false,
        real_state_read_performed: false,
        real_verification_performed: false,
        real_compensation_performed: false,
        rollback_performed: false,
        restore_performed: false,
        persisted: false,
        telemetry_written: false,
      });
    }
  });

  it("fails missing lifecycle segments and unknown proposal kinds", () => {
    expect(
      resultFor(
        {
          ...integratedSnapshot(),
          segment_metadata: integratedSnapshot().segment_metadata.filter(
            (segment) => segment.segment !== "verification",
          ),
        },
        "all_required_lifecycle_segments_present",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "missing_lifecycle_segment",
    });

    expect(
      resultFor(
        {
          ...integratedSnapshot(),
          proposal_kind: "unknown_kind",
        },
        "known_proposal_kind_only",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "unknown_proposal_kind",
    });
  });

  it("fails operational lifecycle statuses", () => {
    expect(
      resultFor(
        {
          ...integratedSnapshot(),
          status: "executed",
        },
        "operational_lifecycle_status_rejected",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "operational_lifecycle_status",
    });
  });

  it("fails approval, authority, token, execution, dispatch, and tool flags", () => {
    const flagToGuard = {
      approval_creation_enabled: "approval_creation_disabled",
      approval_decision_handling_enabled: "approval_decision_handling_disabled",
      authority_grant_enabled: "authority_grant_disabled",
      token_issue_enabled: "token_issue_disabled",
      usable_token_enabled: "usable_token_disabled",
      execution_enabled: "execution_disabled",
      dispatch_enabled: "dispatch_disabled",
      tool_runtime_enabled: "tool_runtime_disabled",
    } as const;

    for (const [flag, guardId] of Object.entries(flagToGuard)) {
      expect(
        resultFor(
          {
            ...integratedSnapshot(),
            disabled_authority_flags: {
              ...integratedSnapshot().disabled_authority_flags,
              [flag]: true,
            },
          },
          guardId,
        ),
      ).toMatchObject({
        passed: false,
      });
    }
  });

  it("fails room, project, Obsidian, memory, network, state, verification, compensation, rollback, restore, persistence, and telemetry flags", () => {
    const flagToGuard = {
      room_action_enabled: "room_action_disabled",
      project_mutation_enabled: "project_mutation_disabled",
      obsidian_write_enabled: "obsidian_write_disabled",
      memory_write_enabled: "memory_write_disabled",
      network_call_enabled: "network_call_disabled",
      real_state_read_enabled: "real_state_read_disabled",
      verification_enabled: "verification_disabled",
      compensation_enabled: "compensation_disabled",
      rollback_enabled: "rollback_disabled",
      restore_enabled: "restore_disabled",
      persistence_enabled: "persistence_disabled",
      telemetry_write_enabled: "telemetry_write_disabled",
    } as const;

    for (const [flag, guardId] of Object.entries(flagToGuard)) {
      expect(
        resultFor(
          {
            ...integratedSnapshot(),
            disabled_authority_flags: {
              ...integratedSnapshot().disabled_authority_flags,
              [flag]: true,
            },
          },
          guardId,
        ),
      ).toMatchObject({
        passed: false,
      });
    }
  });

  it("fails raw payloads, secrets, and raw state", () => {
    expect(
      resultFor(
        {
          ...integratedSnapshot(),
          raw_payload: { forbidden: true },
        },
        "raw_payloads_forbidden",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "raw_payload_present",
      raw_payload_included: false,
    });

    expect(
      resultFor(
        {
          ...integratedSnapshot(),
          secrets: "forbidden",
        },
        "secrets_forbidden",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "secret_material_present",
      secret_material_included: false,
    });

    expect(
      resultFor(
        {
          ...integratedSnapshot(),
          raw_state: { forbidden: true },
        },
        "raw_state_forbidden",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "raw_state_present",
      raw_state_included: false,
    });
  });

  it("keeps validation output free of raw payload fields", () => {
    const results =
      validateApprovalLifecycleIntegrationPolicyMetadata(integratedSnapshot());
    const keys = collectKeys(results);

    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    for (const result of results) {
      expect(result).toMatchObject({
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
    }
  });

  it("exposes no operational public exports for lifecycle validation", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
