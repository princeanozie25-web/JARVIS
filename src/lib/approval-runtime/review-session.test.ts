import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_LIFECYCLE_STAGES,
  APPROVAL_REVIEW_SESSION_STATUSES,
  ApprovalReviewSessionSnapshotSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
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
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function auditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:review-session-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalProposalInboxItem({
      inbox_item_id: "inbox:review-session-item",
      proposal_id: "proposal:review-session-item",
      proposal: proposal(),
      audit_preview: auditPreview(),
      status: "review_required",
      created_at_ms: 1_000,
    }),
    ...overrides,
  };
}

function decisionMetadata() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:session-decision",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "ui_click",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:reason",
    reason_kind: "user_intent_metadata",
  });
}

function session() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18b3",
    inbox_item: inboxItem(),
    audit_preview: auditPreview(),
    decision_request_metadata: decisionMetadata(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
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

describe("Phase 18B.3 approval review session contract", () => {
  it("defines the metadata-only review session contract", () => {
    const snapshot = session();

    expect(snapshot).toMatchObject({
      contract_version: "18B.3",
      review_session_id: "review-session:phase-18b3",
      inbox_item_id: "inbox:review-session-item",
      proposal_id: "proposal:review-session-item",
      proposal_kind: "note_create",
      audit_preview_id: "hash:review-session-preview",
      status: "decision_requested",
      status_display_only: true,
      status_is_lifecycle_stage: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_rendered: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
    });
    expect(
      ApprovalReviewSessionSnapshotSchema.safeParse(snapshot).success,
    ).toBe(true);
  });

  it("declares display/review-only statuses that are not lifecycle stages", () => {
    expect(APPROVAL_REVIEW_SESSION_STATUSES).toEqual([
      "opened",
      "awaiting_review",
      "decision_requested",
      "changes_requested",
      "closed",
      "expired",
    ]);

    for (const status of APPROVAL_REVIEW_SESSION_STATUSES) {
      expect(APPROVAL_LIFECYCLE_STAGES).not.toContain(status as never);
    }
    expect(session()).toMatchObject({
      status_display_only: true,
      status_is_lifecycle_stage: false,
    });
  });

  it("exposes disabled authority flags as false", () => {
    expect(session().disabled_authority).toEqual({
      lifecycle_advancement_enabled: false,
      approval_record_write_enabled: false,
      execution_enabled: false,
      authority_grant_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      dispatch_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      approval_creation_enabled: false,
      approval_decision_handling_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      event_store_writes_enabled: false,
      telemetry_writes_enabled: false,
      ui_rendering_enabled: false,
      api_route_enabled: false,
      tool_runtime_wiring_enabled: false,
      room_adapter_wiring_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      scheduler_triggered_action_enabled: false,
      network_cloud_calls_enabled: false,
    });
  });

  it("keeps evidence metadata hash/reference-only without raw payloads", () => {
    const evidence = session().evidence_metadata;

    expect(evidence).toMatchObject({
      audit_preview_ref_hash: "hash:review-session-preview",
      proposal_ref_hash: "hash:proposal-review-session-item",
      status_summary: "validation_passed",
      risk_label: "medium",
      metadata_only: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
    });
    expect(evidence.validation_result_refs.length).toBeGreaterThan(0);
    expect(evidence.redacted_reference_hashes).toEqual([
      "hash:approval-audit-preview",
      "hash:approval-audit-preview-source",
    ]);
  });

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, and memory contents", () => {
    const keys = collectKeys(session());

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(session()).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
    });
  });

  it("builds replay-safe and redaction-safe session snapshots", () => {
    expect(session()).toMatchObject({
      replay_safe: true,
      redaction_safe: true,
      replay: {
        replay_safe: true,
        local_first: true,
        deterministic_replay_key_hash: "hash:approval-audit-preview",
        source_event_hash: "hash:approval-audit-preview-source",
      },
      redaction_status: {
        redaction_status: "metadata_only",
        redaction_safe: true,
        metadata_only: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_execution_command_included: false,
      },
    });
  });

  it("rejects unknown proposal kinds", () => {
    expect(() =>
      buildApprovalReviewSessionSnapshot({
        review_session_id: "review-session:unknown-proposal-kind",
        inbox_item: inboxItem({ proposal_kind: "unknown_kind" }),
        audit_preview: auditPreview(),
        participant_ref_hash: "hash:local-user",
        opened_at_ms: 2_000,
      }),
    ).toThrow();
  });

  it("rejects voice-only decision metadata if attached", () => {
    expect(() =>
      buildApprovalReviewSessionSnapshot({
        review_session_id: "review-session:voice-only",
        inbox_item: inboxItem(),
        audit_preview: auditPreview(),
        decision_request_metadata: {
          ...decisionMetadata(),
          channel: { ...decisionMetadata().channel, channel: "voice_only" },
        },
        participant_ref_hash: "hash:local-user",
        opened_at_ms: 2_000,
      }),
    ).toThrow();
  });

  it("keeps decision request metadata as intention-only reference data", () => {
    expect(session().decision_request_metadata).toEqual({
      decision_request_ref_hash: "hash:review-session-decision",
      decision_request_present: true,
      decision_request: "approve_requested",
      channel: "ui_click",
      voice_only_attached: false,
      metadata_only: true,
      request_is_intention_only: true,
      approval_decision_handled: false,
      lifecycle_state_advanced: false,
      approval_record_written: false,
    });
  });

  it("exposes no approve, deny, createApproval, execute, dispatch, run, verify, compensate, or rollback functions", () => {
    const forbiddenFunctionNamePattern =
      /(approve|deny|createApproval|execute|dispatch|run|verify|compensate|rollback)/i;
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
