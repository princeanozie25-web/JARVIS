import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_AUDIT_PREVIEW_SECTIONS,
  ApprovalAuditPreviewContractSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  buildApprovalAuditPreviewContract,
  validateApprovalProposalMetadataGuards,
} from "./index";

const FORBIDDEN_RAW_KEYS = [
  "raw_payload",
  "tool_args",
  "tool_arguments",
  "prompt",
  "prompts",
  "model_output",
  "model_outputs",
  "device_payload",
  "project_contents",
  "memory_contents",
  "body",
  "payload",
] as const;

function preview() {
  const proposal =
    DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];

  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:approval-audit-preview-test",
    proposal,
    validation_results: validateApprovalProposalMetadataGuards(proposal),
    current_stage: "PROPOSED",
    transition_count: 0,
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

describe("Phase 18A.5 approval audit preview contract", () => {
  it("defines a metadata-only audit preview contract", () => {
    const auditPreview = preview();

    expect(auditPreview).toMatchObject({
      contract_version: "18A.5",
      preview_kind: "approval_audit_preview",
      phase: 18,
      slice: "18A.5",
      local_first: true,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_safe_later: true,
      ui_wired: false,
      audit_shaped: true,
      audit_db_write_enabled: false,
    });
    expect(
      ApprovalAuditPreviewContractSchema.safeParse(auditPreview).success,
    ).toBe(true);
  });

  it("declares all required audit preview sections", () => {
    const auditPreview = preview();

    expect(APPROVAL_AUDIT_PREVIEW_SECTIONS).toEqual([
      "proposal_summary",
      "authority_boundary",
      "validation_results",
      "lifecycle_state",
      "forbidden_capabilities",
      "redaction_status",
      "replay_status",
      "disabled_execution_status",
    ]);
    expect(auditPreview.sections.map((section) => section.section)).toEqual(
      APPROVAL_AUDIT_PREVIEW_SECTIONS,
    );

    for (const section of auditPreview.sections) {
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

  it("shows disabled execution and authority flags explicitly", () => {
    expect(preview().disabled_execution_status).toEqual({
      execution_enabled: false,
      approval_creation_enabled: false,
      authority_grant_enabled: false,
      verification_enabled: false,
      compensation_enabled: false,
      auto_approval_enabled: false,
      voice_only_approval_enabled: false,
      dispatch_enabled: false,
      lifecycle_state_advancement_enabled: false,
      rollback_enabled: false,
      persistence_enabled: false,
      event_store_writes_enabled: false,
      telemetry_writes_enabled: false,
      ui_wiring_enabled: false,
      tool_runtime_wiring_enabled: false,
      room_adapter_wiring_enabled: false,
      project_mutation_enabled: false,
      obsidian_write_enabled: false,
      memory_write_enabled: false,
      scheduler_triggered_creation_enabled: false,
      network_cloud_calls_enabled: false,
    });
  });

  it("includes validation results as metadata only", () => {
    const validation = preview().validation_results;

    expect(validation).toMatchObject({
      result_count: 13,
      failed_count: 0,
      max_severity: "info",
      metadata_only: true,
      raw_payload_included: false,
    });
    expect(validation.results.length).toBe(13);

    for (const result of validation.results) {
      expect(result).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_execution_command_included: false,
        approval_created: false,
        authority_granted: false,
        dispatch_performed: false,
        action_executed: false,
        verification_performed: false,
        compensation_performed: false,
      });
    }
  });

  it("excludes raw payloads, prompts, model outputs, device payloads, project contents, and memory contents", () => {
    const keys = collectKeys(preview());

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(preview().redaction_status).toMatchObject({
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      secret_material_included: false,
      pii_included: false,
    });
  });

  it("is replay-safe and redaction-safe", () => {
    const auditPreview = preview();

    expect(auditPreview).toMatchObject({
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
      replay: {
        replay_safe: true,
        local_first: true,
      },
      redaction: {
        redaction_safe: true,
        metadata_only: true,
      },
    });
  });

  it("builds failure previews without granting authority or writing audit events", () => {
    const proposal = {
      ...DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
      executionEnabled: true,
    };
    const auditPreview = buildApprovalAuditPreviewContract({
      preview_id_hash: "hash:approval-audit-preview-failure",
      proposal: DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
      validation_results: validateApprovalProposalMetadataGuards(proposal),
    });

    expect(auditPreview.validation_results).toMatchObject({
      failed_count: 1,
      max_severity: "error",
      metadata_only: true,
    });
    expect(auditPreview.disabled_execution_status).toMatchObject({
      execution_enabled: false,
      authority_grant_enabled: false,
      dispatch_enabled: false,
    });
    expect(auditPreview).toMatchObject({
      audit_db_write_enabled: false,
      ui_wired: false,
    });
  });

  it("exposes no execute, dispatch, approve, createApproval, verify, or compensate functions", () => {
    const forbiddenFunctionNamePattern =
      /(execute|dispatch|approve|createApproval|verify|compensate)/i;
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
