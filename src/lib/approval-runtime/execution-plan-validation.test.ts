import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS,
  ApprovalExecutionPlanValidationGuardResultSchema,
  DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionPlanPolicyMetadata,
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
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:execution-plan-validation-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:execution-plan-validation-item",
    proposal_id: "proposal:execution-plan-validation-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:execution-plan-validation-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-plan-validation-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:execution-plan-validation-session",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:execution-plan-validation-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-plan-validation-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18e2",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18e2-note-create",
  });
}

function resultFor(
  input: unknown,
  guardId: (typeof APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS)[number],
) {
  const result = validateApprovalExecutionPlanPolicyMetadata(input).find(
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

describe("Phase 18E.2 execution plan validation guard", () => {
  it("defines the metadata-only execution plan validation guard contract", () => {
    expect(
      DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX,
    ).toMatchObject({
      contract_version: "18E.2",
      matrix_id: "approval_execution_plan_validation_matrix",
      phase: 18,
      slice: "18E.2",
      metadata_only: true,
      guard_matrix_only: true,
      replay_safe: true,
      redaction_safe: true,
      non_authoritative: true,
      non_executing: true,
      non_persistent: true,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      lifecycle_advancement_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      tool_calls_supported: false,
      verification_supported: false,
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

  it("declares all required guards", () => {
    const declaredGuardIds = [
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.plan_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.step_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.target_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.dry_run_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.disabled_authority_guards,
    ].map((guard) => guard.guard_id);

    expect(declaredGuardIds).toEqual(
      APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS,
    );
    for (const guard of [
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.plan_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.step_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.target_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.dry_run_guards,
      ...DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX.disabled_authority_guards,
    ]) {
      expect(guard).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        replay_safe: true,
        redaction_safe: true,
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

  it("passes valid metadata-only execution plans", () => {
    const results =
      validateApprovalExecutionPlanPolicyMetadata(executionPlan());

    expect(results).toHaveLength(
      APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS.length,
    );
    expect(results.every((result) => result.passed)).toBe(true);
    for (const result of results) {
      expect(
        ApprovalExecutionPlanValidationGuardResultSchema.safeParse(result),
      ).toHaveProperty("success", true);
      expect(result).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
        checked_at_source: "approval_execution_plan_validation_matrix",
        approval_created: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        dispatch_performed: false,
        verification_performed: false,
        compensation_performed: false,
        rollback_performed: false,
        persisted: false,
        telemetry_written: false,
      });
    }
  });

  it("fails unknown proposal kinds and executable statuses", () => {
    expect(
      resultFor(
        {
          ...executionPlan(),
          proposal_kind: "unknown_kind",
        },
        "known_proposal_kind_only",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "unknown_proposal_kind",
    });

    expect(
      resultFor(
        {
          ...executionPlan(),
          status: "executable",
        },
        "executable_status_rejected",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "executable_plan_status",
    });
  });

  it("fails invalid step dry-run, execution, and dispatch metadata", () => {
    expect(
      resultFor(
        {
          ...executionPlan(),
          step_metadata: [
            {
              ...executionPlan().step_metadata[0],
              dry_run_required: false,
            },
          ],
        },
        "step_dry_run_required",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "step_dry_run_not_required",
    });

    expect(
      resultFor(
        {
          ...executionPlan(),
          step_metadata: [
            {
              ...executionPlan().step_metadata[0],
              execution_enabled: true,
            },
          ],
        },
        "step_execution_disabled",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "step_execution_enabled",
    });

    expect(
      resultFor(
        {
          ...executionPlan(),
          step_metadata: [
            {
              ...executionPlan().step_metadata[0],
              dispatch_enabled: true,
            },
          ],
        },
        "step_dispatch_disabled",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "step_dispatch_enabled",
    });
  });

  it("fails disabled authority flags when enabled", () => {
    const flagToGuard = {
      execution_enabled: "execution_disabled",
      dispatch_enabled: "dispatch_disabled",
      tool_runtime_enabled: "tool_runtime_disabled",
      room_action_enabled: "room_action_disabled",
      project_mutation_enabled: "project_mutation_disabled",
      obsidian_write_enabled: "obsidian_write_disabled",
      memory_write_enabled: "memory_write_disabled",
      network_call_enabled: "network_call_disabled",
      lifecycle_advancement_enabled: "lifecycle_advancement_disabled",
      verification_enabled: "verification_disabled",
      compensation_enabled: "compensation_disabled",
      rollback_enabled: "rollback_disabled",
      persistence_enabled: "persistence_disabled",
      telemetry_write_enabled: "telemetry_write_disabled",
    } as const;

    for (const [flag, guardId] of Object.entries(flagToGuard)) {
      expect(
        resultFor(
          {
            ...executionPlan(),
            disabled_authority_flags: {
              ...executionPlan().disabled_authority_flags,
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

  it("fails raw payloads and secrets", () => {
    expect(
      resultFor(
        {
          ...executionPlan(),
          raw_payload: { command: "forbidden" },
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
          ...executionPlan(),
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

  it("fails invalid target and dry-run metadata", () => {
    expect(
      resultFor(
        {
          ...executionPlan(),
          target_metadata: {
            ...executionPlan().target_metadata,
            raw_target_payload_included: true,
          },
        },
        "target_raw_payloads_excluded",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "target_raw_payload_present",
    });

    expect(
      resultFor(
        {
          ...executionPlan(),
          dry_run_metadata: {
            ...executionPlan().dry_run_metadata,
            dry_run_required: false,
          },
        },
        "dry_run_metadata_required",
      ),
    ).toMatchObject({
      passed: false,
      reason_code: "dry_run_metadata_missing",
    });
  });

  it("keeps validation output free of raw payload fields", () => {
    const results =
      validateApprovalExecutionPlanPolicyMetadata(executionPlan());
    const keys = collectKeys(results);

    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    for (const result of results) {
      expect(result).toMatchObject({
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
      });
    }
  });

  it("exposes no operational public exports for execution plan validation", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
