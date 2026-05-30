import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS,
  APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_PLAN_STATUSES,
  APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS,
  APPROVAL_RUNTIME_PHASE_18E_SLICES,
  ApprovalExecutionPlanAuditPreviewContractSchema,
  ApprovalExecutionPlanContractSchema,
  ApprovalExecutionPlanValidationPolicyMatrixSchema,
  ApprovalRuntimePhase18ECloseoutGuardSchema,
  DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanAuditPreviewContract,
  buildApprovalExecutionPlanMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionPlanMetadataShape,
  validateApprovalExecutionPlanPolicyMetadata,
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
    preview_id_hash: "hash:phase-18e-closeout-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18e-closeout",
    proposal_id: "proposal:phase-18e-closeout",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18e-closeout",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18e-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18e-closeout",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:phase-18e-closeout",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18e-decision-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalExecutionPlanMetadata({
      execution_plan_id: "execution-plan:phase-18e-closeout",
      decision_record: decisionRecord(),
      target_class: "obsidian_note",
      target_ref_hash: "hash:phase-18e-target-note",
      risk_class: "medium",
      step_id: "step:phase-18e-closeout",
    }),
    ...overrides,
  };
}

function validationResults(plan: unknown = executionPlan()) {
  return validateApprovalExecutionPlanPolicyMetadata(plan);
}

function executionPlanAuditPreview(plan: unknown = executionPlan()) {
  return buildApprovalExecutionPlanAuditPreviewContract({
    preview_id_hash: "hash:phase-18e-closeout-preview",
    execution_plan: executionPlan(),
    validation_results: validationResults(plan),
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

describe("Phase 18E.4 execution plan closeout guard", () => {
  it("declares the Phase 18E closeout guard as inert metadata", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18E.4",
      closeout_id: "approval_runtime_phase_18e_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      phase_18c_foundation_closeout_version: "18C.4",
      phase_18d_foundation_closeout_version: "18D.4",
      execution_plan_contract_version: "18E.1",
      execution_plan_validation_contract_version: "18E.2",
      execution_plan_audit_preview_contract_version: "18E.3",
      metadata_only: true,
      execution_planning_layer_only: true,
      inert: true,
      non_executing: true,
      non_dispatching: true,
      non_authoritative: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      executable_plan_status_supported: false,
      executable_step_handlers_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      tool_calls_supported: false,
      approval_creation_supported: false,
      approval_decision_handling_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      verification_supported: false,
      compensation_supported: false,
      rollback_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      write_telemetry_supported: false,
      runtime_wiring_supported: false,
    });
    expect(
      ApprovalRuntimePhase18ECloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18E_SLICES);
  });

  it("proves Phase 18A, 18B, 18C, 18D, and 18E foundations exist", () => {
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
      ApprovalExecutionPlanContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionPlanValidationPolicyMatrixSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_PLAN_VALIDATION_POLICY_MATRIX,
      ).success,
    ).toBe(true);
    expect(
      ApprovalExecutionPlanAuditPreviewContractSchema.safeParse(
        executionPlanAuditPreview(),
      ).success,
    ).toBe(true);
  });

  it("keeps plan statuses inert and rejects executable status vocabulary", () => {
    expect(APPROVAL_EXECUTION_PLAN_STATUSES).toEqual([
      "unavailable",
      "draft",
      "dry_run_required",
      "blocked",
      "invalid",
      "expired",
    ]);
    expect(APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES).toEqual([
      "executable",
      "ready",
      "running",
      "completed",
    ]);

    for (const status of APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_PLAN_STATUSES).not.toContain(status as never);
      expect(
        validateApprovalExecutionPlanMetadataShape({
          ...executionPlan(),
          status,
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_plan_status",
        metadata_only: true,
        action_executed: false,
        dispatch_performed: false,
        persisted: false,
      });
    }
  });

  it("keeps dry-run required and execution disabled at plan and step level", () => {
    expect(executionPlan()).toMatchObject({
      status: "dry_run_required",
      status_is_operational: false,
      status_enables_execution: false,
      dry_run_metadata: {
        dry_run_required: true,
        dry_run_completed: false,
        dry_run_execution_enabled: false,
        dry_run_dispatch_enabled: false,
      },
      disabled_authority_flags: {
        execution_enabled: false,
        dispatch_enabled: false,
      },
    });

    for (const step of executionPlan().step_metadata) {
      expect(step).toMatchObject({
        dry_run_required: true,
        execution_enabled: false,
        dispatch_enabled: false,
        verification_required_metadata: true,
        compensation_hint_metadata_available: true,
        metadata_only: true,
      });
    }
  });

  it("keeps all disabled authority matrix flags false", () => {
    for (const output of [
      executionPlan(),
      executionPlan().disabled_authority_flags,
      executionPlan().step_metadata,
      validationResults(),
      executionPlanAuditPreview(),
      executionPlanAuditPreview().disabled_execution_status,
      DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
    ]) {
      assertDisabledFlags(output);
    }
  });

  it("keeps execution plan validation guards declared and inert", () => {
    expect(APPROVAL_EXECUTION_PLAN_VALIDATION_GUARD_IDS).toEqual([
      "known_proposal_kind_only",
      "known_inert_plan_status_only",
      "executable_status_rejected",
      "plan_replay_safe",
      "plan_redaction_safe",
      "raw_payloads_forbidden",
      "secrets_forbidden",
      "step_dry_run_required",
      "step_execution_disabled",
      "step_dispatch_disabled",
      "step_verification_required_metadata_true",
      "step_compensation_hint_metadata_available_true",
      "target_raw_payloads_excluded",
      "dry_run_metadata_required",
      "dry_run_execution_disabled",
      "dry_run_dispatch_disabled",
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
        approval_created: false,
        approval_decision_handled: false,
        authority_granted: false,
        token_issued: false,
        action_executed: false,
        dispatch_performed: false,
        verification_performed: false,
        compensation_performed: false,
        rollback_performed: false,
        persisted: false,
        telemetry_written: false,
        runtime_wired: false,
      });
    }
  });

  it("keeps execution plan audit preview sections and disabled status complete", () => {
    expect(APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS).toEqual([
      "plan_summary",
      "proposal_reference",
      "decision_reference",
      "target_summary",
      "dry_run_status",
      "step_summary",
      "validation_results",
      "disabled_execution_status",
      "redaction_status",
      "replay_status",
    ]);
    expect(
      executionPlanAuditPreview().sections.map((section) => section.section),
    ).toEqual(APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS);
    expect(executionPlanAuditPreview().disabled_execution_status).toMatchObject(
      {
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
        compensation_enabled: false,
        rollback_enabled: false,
        persistence_enabled: false,
        telemetry_write_enabled: false,
      },
    );
  });

  it("keeps plan, validation, and audit metadata free of raw payloads and secrets", () => {
    const keys = collectKeys({
      plan: executionPlan(),
      validation_results: validationResults(),
      execution_plan_audit_preview: executionPlanAuditPreview(),
    });

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(executionPlan()).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
    });
    expect(executionPlanAuditPreview().redaction_status).toMatchObject({
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

  it("keeps plan, validation, and audit outputs replay-safe and redaction-safe", () => {
    expect(executionPlan()).toMatchObject({
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
    expect(executionPlanAuditPreview()).toMatchObject({
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
