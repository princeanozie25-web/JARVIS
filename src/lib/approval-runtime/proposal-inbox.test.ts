import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_LIFECYCLE_STAGES,
  APPROVAL_PROPOSAL_INBOX_STATUSES,
  ApprovalProposalInboxContractSchema,
  ApprovalProposalInboxItemSchema,
  DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  buildApprovalProposalInboxItem,
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

function auditPreview() {
  const proposal =
    DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];

  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:proposal-inbox-preview",
    proposal,
    validation_results: validateApprovalProposalMetadataGuards(proposal),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:proposal-inbox-item",
    proposal_id: "proposal:proposal-inbox-item",
    proposal: DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
    audit_preview: auditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
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

describe("Phase 18B.1 approval proposal inbox contract", () => {
  it("defines the metadata-only proposal inbox contract", () => {
    expect(DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT).toMatchObject({
      contract_version: "18B.1",
      inbox_id: "approval_proposal_metadata_inbox",
      phase: 18,
      slice: "18B.1",
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      display_only: true,
      approval_decision_surface: false,
      execution_surface: false,
      ui_wired: false,
      persistence_wired: false,
    });
    expect(
      ApprovalProposalInboxContractSchema.safeParse(
        DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT,
      ).success,
    ).toBe(true);
  });

  it("declares all display-only inbox statuses outside lifecycle decisions", () => {
    expect(APPROVAL_PROPOSAL_INBOX_STATUSES).toEqual([
      "visible",
      "hidden",
      "expired",
      "dismissed",
      "review_required",
    ]);
    expect(DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT.statuses).toEqual(
      APPROVAL_PROPOSAL_INBOX_STATUSES,
    );

    for (const status of APPROVAL_PROPOSAL_INBOX_STATUSES) {
      expect(APPROVAL_LIFECYCLE_STAGES).not.toContain(status as never);
    }
    expect(inboxItem()).toMatchObject({
      status_display_only: true,
      status_is_lifecycle_decision: false,
    });
  });

  it("builds inert inbox items with disabled authority flags", () => {
    const item = inboxItem();

    expect(item).toMatchObject({
      contract_version: "18B.1",
      inbox_item_id: "inbox:proposal-inbox-item",
      proposal_id: "proposal:proposal-inbox-item",
      proposal_kind: "note_create",
      proposal_summary: "Note create",
      risk_class: "medium",
      source_class: "user_typed_command",
      target_class: "obsidian_note",
      status: "review_required",
      status_display_only: true,
      status_is_lifecycle_decision: false,
      audit_preview_id: "hash:proposal-inbox-preview",
      disabled_authority: {
        execution_enabled: false,
        approval_creation_enabled: false,
        authority_grant_enabled: false,
        verification_enabled: false,
        compensation_enabled: false,
        auto_approval_enabled: false,
        voice_only_approval_enabled: false,
        dispatch_enabled: false,
        approval_decision_enabled: false,
        lifecycle_state_advancement_enabled: false,
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
        scheduler_triggered_creation_enabled: false,
        network_cloud_calls_enabled: false,
      },
    });
    expect(ApprovalProposalInboxItemSchema.safeParse(item).success).toBe(true);
  });

  it("keeps inbox item output metadata-only", () => {
    expect(inboxItem()).toMatchObject({
      metadata_only: true,
      ui_rendered: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
      created_at_metadata: {
        source_clock_trusted: false,
        metadata_only: true,
      },
      expiry_metadata: {
        expires_after_ms: 300_000,
        expires_at_ms: 301_000,
        expiry_display_only: true,
        lifecycle_expiry_decision: false,
        timers_registered: false,
        scheduler_registered: false,
        metadata_only: true,
      },
      validation_summary: {
        result_count: 13,
        passed_count: 13,
        failed_count: 0,
        metadata_only: true,
        raw_payload_included: false,
      },
    });
  });

  it("excludes raw payloads, tool args, prompts, model outputs, device payloads, project contents, and memory contents", () => {
    const item = inboxItem();
    const keys = collectKeys(item);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(item).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
    });
  });

  it("keeps inbox item output replay-safe and redaction-safe", () => {
    expect(inboxItem()).toMatchObject({
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
      buildApprovalProposalInboxItem({
        inbox_item_id: "inbox:unknown-proposal-kind",
        proposal_id: "proposal:unknown-proposal-kind",
        proposal: {
          ...DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
          proposal_kind: "unknown_kind",
        },
        audit_preview: auditPreview(),
        created_at_ms: 1_000,
      }),
    ).toThrow();
  });

  it("declares filters, sorts, and summary as display metadata only", () => {
    for (const filter of DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT.filters) {
      expect(filter).toMatchObject({
        enabled_for_display: true,
        mutates_inbox: false,
        persists_filter: false,
        metadata_only: true,
      });
    }
    for (const sort of DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT.sorts) {
      expect(sort).toMatchObject({
        enabled_for_display: true,
        mutates_inbox: false,
        persists_sort: false,
        metadata_only: true,
      });
    }
    expect(DEFAULT_APPROVAL_PROPOSAL_INBOX_CONTRACT.summary).toMatchObject({
      total_count: 0,
      metadata_only: true,
      persisted: false,
      telemetry_written: false,
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
