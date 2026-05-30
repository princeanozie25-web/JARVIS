import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS,
  ApprovalExecutionVerificationValidationGuardResultSchema,
  DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanMetadata,
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
  "raw_state",
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
    preview_id_hash: "hash:verification-validation-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:verification-validation-item",
    proposal_id: "proposal:verification-validation-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:verification-validation-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:verification-validation-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:verification-validation-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:verification-validation-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:verification-validation-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18f2",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18f2-note-create",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18f2",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18f2",
    redacted_reference: "redacted:phase-18f2-evidence",
    hash_reference: "hash:phase-18f2-evidence",
    observed_at_metadata_ms: 3_000,
  });
}

function resultFor(
  input: unknown,
  guardId: (typeof APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS)[number],
) {
  const result = validateApprovalExecutionVerificationPolicyMetadata(
    input,
  ).find((guard) => guard.guard_id === guardId);
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

describe("Phase 18F.2 execution verification validation guard", () => {
  it("defines the metadata-only verification validation guard contract", () => {
    expect(
      DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX,
    ).toMatchObject({
      contract_version: "18F.2",
      matrix_id: "approval_execution_verification_validation_matrix",
      phase: 18,
      slice: "18F.2",
      metadata_only: true,
      guard_matrix_only: true,
      replay_safe: true,
      redaction_safe: true,
      non_authoritative: true,
      non_executing: true,
      non_dispatching: true,
      non_persistent: true,
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
      network_calls_supported: false,
    });
  });

  it("declares all required guards as inert metadata", () => {
    const declaredGuardIds = [
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.verification_guards,
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.evidence_guards,
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.method_guards,
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.disabled_authority_guards,
    ].map((guard) => guard.guard_id);

    expect(declaredGuardIds).toHaveLength(
      APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS.length,
    );
    expect(declaredGuardIds).toEqual(
      expect.arrayContaining([
        ...APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS,
      ]),
    );

    for (const guard of [
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.verification_guards,
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.evidence_guards,
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.method_guards,
      ...DEFAULT_APPROVAL_EXECUTION_VERIFICATION_VALIDATION_POLICY_MATRIX.disabled_authority_guards,
    ]) {
      expect(guard).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        performs_real_verification: false,
        reads_real_state: false,
        grants_authority: false,
        advances_lifecycle_state: false,
        issues_token: false,
        executes_action: false,
        dispatches_tool: false,
        writes_persistence: false,
        wires_runtime: false,
      });
    }
  });

  it("passes valid metadata-only verification records", () => {
    const results = validateApprovalExecutionVerificationPolicyMetadata(
      verificationMetadata(),
    );

    expect(results).toHaveLength(
      APPROVAL_EXECUTION_VERIFICATION_VALIDATION_GUARD_IDS.length,
    );
    expect(results.every((result) => result.passed)).toBe(true);
    for (const result of results) {
      expect(
        ApprovalExecutionVerificationValidationGuardResultSchema.safeParse(
          result,
        ).success,
      ).toBe(true);
      expect(result).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
        checked_at_source: "approval_execution_verification_validation_matrix",
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

  it("fails operational statuses and unknown verification methods", () => {
    expect(
      resultFor(
        {
          ...verificationMetadata(),
          status: "verified",
        },
        "operational_status_rejected",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "operational_verification_status",
    });

    expect(
      resultFor(
        {
          ...verificationMetadata(),
          method_metadata: {
            ...verificationMetadata().method_metadata,
            method: "real_state_verification",
          },
        },
        "known_metadata_only_verification_method_only",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "unknown_verification_method",
    });
  });

  it("fails enabled verification, state read, execution, and dispatch flags", () => {
    const flagToGuard = {
      verification_enabled: "verification_disabled",
      real_state_read_enabled: "real_state_read_disabled",
      execution_enabled: "execution_disabled",
      dispatch_enabled: "dispatch_disabled",
    } as const;

    for (const [flag, guardId] of Object.entries(flagToGuard)) {
      expect(
        resultFor(
          {
            ...verificationMetadata(),
            disabled_authority_flags: {
              ...verificationMetadata().disabled_authority_flags,
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

  it("fails all enabled disabled-authority flags", () => {
    const flagToGuard = {
      tool_runtime_enabled: "tool_runtime_disabled",
      room_action_enabled: "room_action_disabled",
      project_mutation_enabled: "project_mutation_disabled",
      obsidian_write_enabled: "obsidian_write_disabled",
      memory_write_enabled: "memory_write_disabled",
      network_call_enabled: "network_call_disabled",
      lifecycle_advancement_enabled: "lifecycle_advancement_disabled",
      compensation_enabled: "compensation_disabled",
      rollback_enabled: "rollback_disabled",
      persistence_enabled: "persistence_disabled",
      telemetry_write_enabled: "telemetry_write_disabled",
    } as const;

    for (const [flag, guardId] of Object.entries(flagToGuard)) {
      expect(
        resultFor(
          {
            ...verificationMetadata(),
            disabled_authority_flags: {
              ...verificationMetadata().disabled_authority_flags,
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

  it("fails raw evidence fields and secrets", () => {
    expect(
      resultFor(
        {
          ...verificationMetadata(),
          evidence_metadata: [
            {
              ...verificationMetadata().evidence_metadata[0],
              raw_state: { value: "forbidden" },
            },
          ],
        },
        "evidence_no_raw_state",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "raw_state_present",
    });

    expect(
      resultFor(
        {
          ...verificationMetadata(),
          evidence_metadata: [
            {
              ...verificationMetadata().evidence_metadata[0],
              tool_output: "forbidden",
            },
          ],
        },
        "evidence_no_raw_tool_output",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "raw_tool_output_present",
    });

    expect(
      resultFor(
        {
          ...verificationMetadata(),
          secrets: "forbidden",
        },
        "secrets_forbidden",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "secret_material_present",
      secret_material_included: false,
    });
  });

  it("fails raw payloads, prompts, model output, project, memory, and device content", () => {
    const guardCases = [
      ["prompt", "evidence_no_prompts", "prompt_present"],
      ["model_output", "evidence_no_model_output", "model_output_present"],
      [
        "project_contents",
        "evidence_no_raw_project_content",
        "raw_project_content_present",
      ],
      [
        "memory_contents",
        "evidence_no_raw_memory_content",
        "raw_memory_content_present",
      ],
      [
        "device_payload",
        "evidence_no_raw_device_payload",
        "raw_device_payload_present",
      ],
    ] as const;

    for (const [field, guardId, reasonCode] of guardCases) {
      expect(
        resultFor(
          {
            ...verificationMetadata(),
            evidence_metadata: [
              {
                ...verificationMetadata().evidence_metadata[0],
                [field]: "forbidden",
              },
            ],
          },
          guardId,
        ),
      ).toMatchObject({
        passed: false,
        reason_code: reasonCode,
      });
    }

    expect(
      resultFor(
        {
          ...verificationMetadata(),
          raw_payload: { forbidden: true },
        },
        "raw_payloads_forbidden",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "raw_payload_present",
      raw_payload_included: false,
    });
  });

  it("keeps validation output free of raw payload fields", () => {
    const results = validateApprovalExecutionVerificationPolicyMetadata(
      verificationMetadata(),
    );
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

  it("exposes no operational public exports for verification validation", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
