import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_PLAN_STATUSES,
  ApprovalExecutionPlanContractSchema,
  ApprovalExecutionPlanMetadataSchema,
  DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  validateApprovalExecutionPlanMetadataShape,
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
    preview_id_hash: "hash:execution-plan-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:execution-plan-item",
    proposal_id: "proposal:execution-plan-item",
    proposal: proposal(),
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:execution-plan-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-plan-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:execution-plan-session",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:execution-plan-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-plan-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18e1",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18e1-note-create",
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

describe("Phase 18E.1 execution plan contract", () => {
  it("defines the metadata-only execution plan contract", () => {
    expect(DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT).toMatchObject({
      contract_version: "18E.1",
      contract_id: "approval_execution_plan_contract",
      phase: 18,
      slice: "18E.1",
      metadata_only: true,
      execution_plan_shape_only: true,
      non_authoritative: true,
      non_executing: true,
      non_persistent: true,
      replay_safe: true,
      redaction_safe: true,
      executable_plan_status_supported: false,
      executable_step_handlers_supported: false,
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
      scheduler_triggered_action_supported: false,
      network_cloud_calls_supported: false,
    });
    expect(
      ApprovalExecutionPlanContractSchema.safeParse(
        DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("declares only inert statuses and rejects operational statuses", () => {
    expect(APPROVAL_EXECUTION_PLAN_STATUSES).toEqual([
      "unavailable",
      "draft",
      "dry_run_required",
      "blocked",
      "invalid",
      "expired",
    ]);

    for (const forbiddenStatus of [
      "executable",
      "ready",
      "running",
      "completed",
    ]) {
      expect(APPROVAL_EXECUTION_PLAN_STATUSES).not.toContain(
        forbiddenStatus as never,
      );
      expect(APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES).toContain(
        forbiddenStatus as never,
      );
      expect(
        validateApprovalExecutionPlanMetadataShape({
          ...executionPlan(),
          status: forbiddenStatus,
        }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_plan_status",
        metadata_only: true,
        action_executed: false,
        dispatch_performed: false,
      });
    }
  });

  it("builds replay-safe and redaction-safe execution plan metadata only", () => {
    expect(executionPlan()).toMatchObject({
      contract_version: "18E.1",
      execution_plan_id: "execution-plan:phase-18e1",
      proposal_id: "proposal:execution-plan-item",
      review_session_id: "review-session:execution-plan-session",
      decision_record_id: "decision-record:execution-plan-record",
      proposal_kind: "note_create",
      status: "dry_run_required",
      status_is_operational: false,
      status_enables_execution: false,
      replay_safe: true,
      redaction_safe: true,
      metadata_only: true,
      execution_performed: false,
      dispatch_performed: false,
      tool_call_performed: false,
      lifecycle_advanced: false,
      verification_performed: false,
      compensation_performed: false,
      rollback_performed: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
    });
    expect(
      ApprovalExecutionPlanMetadataSchema.safeParse(executionPlan()),
    ).toHaveProperty("success", true);
  });

  it("requires dry-run metadata and disables plan-level authority", () => {
    expect(executionPlan().dry_run_metadata).toEqual({
      dry_run_required: true,
      dry_run_completed: false,
      dry_run_output_included: false,
      dry_run_tool_arguments_included: false,
      dry_run_dispatch_enabled: false,
      dry_run_execution_enabled: false,
      dry_run_persistence_enabled: false,
      metadata_only: true,
    });

    expect(Object.values(executionPlan().disabled_authority_flags)).toEqual(
      expect.arrayContaining([false]),
    );
    expect(
      Object.values(executionPlan().disabled_authority_flags).every(
        (flag) => flag === false,
      ),
    ).toBe(true);
  });

  it("keeps step metadata descriptive and non-dispatching", () => {
    expect(executionPlan().step_metadata).toEqual([
      {
        step_id: "step:phase-18e1-note-create",
        step_kind: "note_create_step",
        target_class: "obsidian_note",
        risk_class: "medium",
        dry_run_required: true,
        execution_enabled: false,
        dispatch_enabled: false,
        verification_required_metadata: true,
        compensation_hint_metadata_available: true,
        tool_runtime_enabled: false,
        room_action_enabled: false,
        project_mutation_enabled: false,
        obsidian_write_enabled: false,
        memory_write_enabled: false,
        network_call_enabled: false,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
        metadata_only: true,
      },
    ]);
  });

  it("keeps target metadata redacted and mutation-free", () => {
    expect(executionPlan().target_metadata).toEqual({
      target_class: "obsidian_note",
      target_ref_hash: "hash:target-note",
      raw_target_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      raw_device_payload_included: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      room_action_enabled: false,
      memory_write_enabled: false,
      network_call_enabled: false,
      metadata_only: true,
    });
  });

  it("rejects unknown proposal kinds through metadata validation", () => {
    expect(
      validateApprovalExecutionPlanMetadataShape({
        ...executionPlan(),
        proposal_kind: "unknown_kind",
      }),
    ).toMatchObject({
      valid: false,
      reason: "unknown_proposal_kind",
      metadata_only: true,
      approval_created: false,
      authority_granted: false,
      token_issued: false,
      action_executed: false,
      persisted: false,
    });
  });

  it("rejects enabled execution or dispatch flags at plan and step level", () => {
    expect(
      ApprovalExecutionPlanMetadataSchema.safeParse({
        ...executionPlan(),
        disabled_authority_flags: {
          ...executionPlan().disabled_authority_flags,
          execution_enabled: true,
        },
      }).success,
    ).toBe(false);

    expect(
      ApprovalExecutionPlanMetadataSchema.safeParse({
        ...executionPlan(),
        step_metadata: [
          {
            ...executionPlan().step_metadata[0],
            dispatch_enabled: true,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("excludes raw payloads, tool args, prompts, outputs, contents, and secrets", () => {
    const keys = collectKeys(executionPlan());
    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
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
  });

  it("exposes no operational public exports for execution planning", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
