import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS,
  ApprovalExecutionPlanAuditPreviewContractSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionPlanAuditPreviewContract,
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

function proposalAuditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:execution-plan-audit-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:execution-plan-audit-item",
    proposal_id: "proposal:execution-plan-audit-item",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:execution-plan-audit-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-plan-audit-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:execution-plan-audit-session",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:execution-plan-audit-record",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:execution-plan-audit-record-reason",
    reason_kind: "user_intent_metadata",
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18e3",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:target-note",
    risk_class: "medium",
    step_id: "step:phase-18e3-note-create",
  });
}

function auditPreview() {
  const plan = executionPlan();
  return buildApprovalExecutionPlanAuditPreviewContract({
    preview_id_hash: "hash:execution-plan-audit-preview",
    execution_plan: plan,
    validation_results: validateApprovalExecutionPlanPolicyMetadata(plan),
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

describe("Phase 18E.3 execution plan audit preview", () => {
  it("defines the metadata-only execution plan audit preview contract", () => {
    expect(auditPreview()).toMatchObject({
      contract_version: "18E.3",
      preview_id_hash: "hash:execution-plan-audit-preview",
      phase: 18,
      slice: "18E.3",
      preview_kind: "approval_execution_plan_audit_preview",
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_safe_later: true,
      ui_wired: false,
      audit_shaped: true,
      audit_db_write_enabled: false,
    });
    expect(
      ApprovalExecutionPlanAuditPreviewContractSchema.safeParse(auditPreview())
        .success,
    ).toBe(true);
  });

  it("declares all required audit preview sections", () => {
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
    expect(auditPreview().sections.map((section) => section.section)).toEqual(
      APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_SECTIONS,
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

  it("includes disabled execution and authority status", () => {
    expect(auditPreview().disabled_execution_status).toEqual({
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
      result_count: 30,
      passed_count: 30,
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
        raw_prompt_included: false,
        raw_model_output_included: false,
        raw_device_payload_included: false,
        raw_project_content_included: false,
        raw_memory_content_included: false,
        secret_material_included: false,
        action_executed: false,
        dispatch_performed: false,
        verification_performed: false,
        compensation_performed: false,
        persisted: false,
        telemetry_written: false,
      });
    }
  });

  it("includes execution step summary metadata only", () => {
    expect(auditPreview().step_summary).toEqual({
      step_count: 1,
      steps: [
        {
          step_id: "step:phase-18e3-note-create",
          step_kind: "note_create_step",
          target_class: "obsidian_note",
          risk_class: "medium",
          dry_run_required: true,
          execution_enabled: false,
          dispatch_enabled: false,
          verification_required_metadata: true,
          compensation_hint_metadata_available: true,
          metadata_only: true,
          raw_payload_included: false,
          raw_tool_arguments_included: false,
          raw_prompt_included: false,
          raw_model_output_included: false,
          raw_device_payload_included: false,
          raw_project_content_included: false,
          raw_memory_content_included: false,
          secret_material_included: false,
        },
      ],
      metadata_only: true,
      executable_step_handlers_enabled: false,
      raw_payload_included: false,
    });
  });

  it("summarizes plan, target, dry-run, proposal, and decision metadata only", () => {
    expect(auditPreview()).toMatchObject({
      plan_summary: {
        execution_plan_ref_hash: "hash:execution-plan-phase-18e3",
        proposal_kind: "note_create",
        status: "dry_run_required",
        status_is_operational: false,
        status_enables_execution: false,
        dry_run_required: true,
        step_count: 1,
        execution_enabled: false,
        dispatch_enabled: false,
        metadata_only: true,
      },
      proposal_reference: {
        proposal_id: "proposal:execution-plan-audit-item",
        proposal_ref_hash: "hash:proposal-execution-plan-audit-item",
        proposal_kind: "note_create",
        metadata_only: true,
        raw_payload_included: false,
      },
      decision_reference: {
        decision_record_id: "decision-record:execution-plan-audit-record",
        decision_record_ref_hash:
          "hash:decision-record-execution-plan-audit-record",
        review_session_id: "review-session:execution-plan-audit-session",
        review_session_ref_hash:
          "hash:review-session-execution-plan-audit-session",
        metadata_only: true,
        raw_payload_included: false,
        approval_decision_handling_enabled: false,
      },
      target_summary: {
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
      },
      dry_run_status: {
        dry_run_required: true,
        dry_run_completed: false,
        dry_run_output_included: false,
        dry_run_tool_arguments_included: false,
        dry_run_dispatch_enabled: false,
        dry_run_execution_enabled: false,
        dry_run_persistence_enabled: false,
        metadata_only: true,
      },
    });
  });

  it("excludes raw payloads, tool args, prompts, model outputs, contents, and secrets", () => {
    const keys = collectKeys(auditPreview());
    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    expect(auditPreview().redaction_status).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
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

  it("marks failed validation metadata without enabling execution", () => {
    const plan = {
      ...executionPlan(),
      disabled_authority_flags: {
        ...executionPlan().disabled_authority_flags,
        execution_enabled: true,
      },
    };
    const preview = buildApprovalExecutionPlanAuditPreviewContract({
      preview_id_hash: "hash:execution-plan-audit-failed-preview",
      execution_plan: executionPlan(),
      validation_results: validateApprovalExecutionPlanPolicyMetadata(plan),
    });

    expect(preview.validation_results).toMatchObject({
      failed_count: 3,
      max_severity: "error",
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(preview.disabled_execution_status.execution_enabled).toBe(false);
  });

  it("exposes no operational public exports for execution plan audit previews", () => {
    const exportNames = Object.keys(approvalRuntime);
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportNames).not.toContain(forbiddenName);
    }
  });
});
