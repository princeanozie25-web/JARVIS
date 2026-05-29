import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_REVIEW_CHANNELS,
  APPROVAL_REVIEW_DECISION_REQUESTS,
  APPROVAL_REVIEW_FORBIDDEN_CHANNELS,
  ApprovalReviewChannelMetadataSchema,
  ApprovalReviewDecisionMetadataSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  validateApprovalProposalMetadataGuards,
  validateApprovalReviewDecisionMetadataShape,
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

function inboxItem() {
  const proposal =
    DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
  const auditPreview = buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:review-decision-preview",
    proposal,
    validation_results: validateApprovalProposalMetadataGuards(proposal),
  });

  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:review-decision-item",
    proposal_id: "proposal:review-decision-item",
    proposal,
    audit_preview: auditPreview,
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function decision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:decision-metadata",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "ui_click",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:reason",
    reason_kind: "user_intent_metadata",
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

describe("Phase 18B.2 approval review decision contract", () => {
  it("defines the review decision metadata contract", () => {
    const metadata = decision();

    expect(metadata).toMatchObject({
      contract_version: "18B.2",
      review_decision_id: "review:decision-metadata",
      inbox_item_id: "inbox:review-decision-item",
      proposal_id: "proposal:review-decision-item",
      inbox_status: "review_required",
      decision_request: "approve_requested",
      request_is_intention_only: true,
      performs_lifecycle_transition: false,
      writes_approval_record: false,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
    });
    expect(
      ApprovalReviewDecisionMetadataSchema.safeParse(metadata).success,
    ).toBe(true);
  });

  it("declares all required decision request values as inert metadata", () => {
    expect(APPROVAL_REVIEW_DECISION_REQUESTS).toEqual([
      "approve_requested",
      "deny_requested",
      "dismiss_requested",
      "expire_requested",
      "request_changes",
    ]);

    for (const decision_request of APPROVAL_REVIEW_DECISION_REQUESTS) {
      const metadata = buildApprovalReviewDecisionMetadata({
        review_decision_id: `review:${decision_request}`,
        inbox_item: inboxItem(),
        decision_request,
        channel: "keyboard",
        actor_ref_hash: "hash:local-user",
        reason_ref_hash: "hash:reason",
        reason_kind: "user_intent_metadata",
      });

      expect(metadata).toMatchObject({
        decision_request,
        request_is_intention_only: true,
        performs_lifecycle_transition: false,
        writes_approval_record: false,
        disabled_authority: {
          approval_record_write_enabled: false,
          lifecycle_advancement_enabled: false,
          execution_enabled: false,
          dispatch_enabled: false,
        },
      });
    }
  });

  it("declares review channels and rejects voice-only approval", () => {
    expect(APPROVAL_REVIEW_CHANNELS).toEqual([
      "ui_click",
      "keyboard",
      "typed_confirmation",
    ]);
    expect(APPROVAL_REVIEW_FORBIDDEN_CHANNELS).toEqual(["voice_only"]);
    expect(
      ApprovalReviewChannelMetadataSchema.safeParse({
        channel: "voice_only",
        voice_only_channel: false,
        voice_only_approval_allowed: false,
        ui_wiring_enabled: false,
        api_route_enabled: false,
        metadata_only: true,
      }).success,
    ).toBe(false);
    expect(
      validateApprovalReviewDecisionMetadataShape({
        ...decision(),
        channel: { ...decision().channel, channel: "voice_only" },
      }),
    ).toMatchObject({
      valid: false,
      reason: "voice_only_channel_forbidden",
      approval_created: false,
      lifecycle_advanced: false,
      action_executed: false,
    });
  });

  it("exposes disabled authority flags as false", () => {
    expect(decision().disabled_authority).toEqual({
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

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, and memory contents", () => {
    const metadata = decision();
    const keys = collectKeys(metadata);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(metadata).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      actor: {
        raw_actor_identifier_included: false,
      },
      reason: {
        raw_reason_included: false,
        prompt_included: false,
        model_output_included: false,
      },
    });
  });

  it("validates metadata shape only", () => {
    expect(validateApprovalReviewDecisionMetadataShape(decision())).toEqual({
      valid: true,
      reason: "valid_review_decision_metadata",
      metadata_only: true,
      shape_validation_only: true,
      approval_created: false,
      approval_decision_handled: false,
      lifecycle_advanced: false,
      authority_granted: false,
      action_executed: false,
      dispatch_performed: false,
      verification_performed: false,
      compensation_performed: false,
      rollback_performed: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
      ui_rendered: false,
      api_route_called: false,
      network_called: false,
      cloud_called: false,
    });
    expect(
      validateApprovalReviewDecisionMetadataShape({
        ...decision(),
        execution_enabled: true,
      }),
    ).toMatchObject({
      valid: false,
      reason: "invalid_review_decision_metadata",
      shape_validation_only: true,
      approval_created: false,
      authority_granted: false,
      action_executed: false,
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
