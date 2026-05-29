import { describe, expect, it } from "vitest";

import {
  APPROVAL_ALLOWED_TRANSITIONS,
  APPROVAL_LIFECYCLE_STAGES,
  APPROVAL_RUNTIME_FORBIDDEN_METADATA_FIELDS,
  APPROVAL_STAGE_TRANSITION_DECLARATIONS,
  ApprovalAuditPreviewSchema,
  ApprovalLifecycleRecordSchema,
  ApprovalLifecycleSnapshotSchema,
  ApprovalProposalContractSchema,
  ApprovalStageTransitionSchema,
  getAllowedApprovalLifecycleTransitions,
  isApprovalLifecycleStage,
  validateApprovalAuditPreview,
  validateApprovalLifecycleRecord,
  validateApprovalLifecycleSnapshot,
  validateApprovalProposalContract,
  validateApprovalStageTransitionDeclaration,
  type ApprovalAuditPreview,
  type ApprovalLifecycleRecord,
  type ApprovalLifecycleSnapshot,
  type ApprovalProposalContract,
  type ApprovalStageTransition,
} from "./index";

function replay(sequence_index = 0) {
  return {
    schema_version: "approval-runtime.v18a1",
    replay_safe: true,
    local_first: true,
    deterministic_replay_key_hash: "hash:approval-replay-key",
    source_event_hash: "hash:source-event",
    originating_session_hash: "hash:session",
    sequence_index,
  };
}

function redaction() {
  return {
    redaction_status: "metadata_only",
    redaction_safe: true,
    metadata_only: true,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_execution_command_included: false,
    secret_material_included: false,
    pii_included: false,
  };
}

function guard() {
  return {
    contract_only: true,
    metadata_only: true,
    lifecycle_processor_supported: false,
    approval_creation_supported: false,
    approval_decision_supported: false,
    execution_supported: false,
    verification_supported: false,
    compensation_execution_supported: false,
    persistence_supported: false,
    event_store_integration_supported: false,
    ui_integration_supported: false,
    tool_runtime_integration_supported: false,
    adapter_integration_supported: false,
    scheduler_supported: false,
    network_allowed: false,
    cloud_allowed: false,
  };
}

function proposal(
  overrides: Partial<ApprovalProposalContract> = {},
): ApprovalProposalContract {
  return ApprovalProposalContractSchema.parse({
    contract_version: "18A.1",
    proposal_id: "proposal:phase18a1-review",
    approval_id: null,
    proposal_kind: "tool_write",
    risk_class: "medium",
    source_ref_hash: "hash:source-ref",
    subject_ref_hash: "hash:subject-ref",
    dry_run_preview_ref_hash: "hash:dry-run-preview",
    created_at_ms: 1_000,
    expires_at_ms: 301_000,
    replay: replay(),
    redaction: redaction(),
    guard: guard(),
    ...overrides,
  });
}

function transition(
  overrides: Partial<ApprovalStageTransition> = {},
): ApprovalStageTransition {
  return ApprovalStageTransitionSchema.parse({
    from_stage: "PROPOSED",
    to_stage: "REVIEW_PENDING",
    transition_allowed: true,
    declaration_only: true,
    metadata_only: true,
    advances_state: false,
    executes_action: false,
    grants_authority: false,
    transition_ref_hash: "hash:transition-1",
    observed_at_ms: null,
    replay: replay(1),
    redaction: redaction(),
    ...overrides,
  });
}

function record(
  overrides: Partial<ApprovalLifecycleRecord> = {},
): ApprovalLifecycleRecord {
  return ApprovalLifecycleRecordSchema.parse({
    contract_version: "18A.1",
    lifecycle_record_id_hash: "hash:lifecycle-record",
    approval_id: null,
    proposal_id: "proposal:phase18a1-review",
    execution_id: null,
    verification_id: null,
    compensation_id: null,
    current_stage: "PROPOSED",
    transitions: [transition()],
    replay: replay(),
    redaction: redaction(),
    guard: guard(),
    ...overrides,
  });
}

function snapshot(
  overrides: Partial<ApprovalLifecycleSnapshot> = {},
): ApprovalLifecycleSnapshot {
  return ApprovalLifecycleSnapshotSchema.parse({
    contract_version: "18A.1",
    snapshot_id_hash: "hash:lifecycle-snapshot",
    approval_id: null,
    proposal_id: "proposal:phase18a1-review",
    current_stage: "PROPOSED",
    transition_count: 1,
    last_transition_ref_hash: "hash:transition-1",
    replay: replay(),
    redaction: redaction(),
    guard: guard(),
    ...overrides,
  });
}

function auditPreview(
  overrides: Partial<ApprovalAuditPreview> = {},
): ApprovalAuditPreview {
  return ApprovalAuditPreviewSchema.parse({
    contract_version: "18A.1",
    audit_preview_id_hash: "hash:audit-preview",
    approval_id: null,
    proposal_id: "proposal:phase18a1-review",
    current_stage: "PROPOSED",
    preview_kind: "approval_lifecycle_audit_preview",
    transition_count: 1,
    includes_execution_result: false,
    includes_verification_result: false,
    includes_compensation_payload: false,
    audit_event_write_supported: false,
    event_store_write_supported: false,
    replay: replay(),
    redaction: redaction(),
    guard: guard(),
    ...overrides,
  });
}

describe("Phase 18A.1 approval lifecycle contract scaffold", () => {
  it("defines the complete stage vocabulary", () => {
    expect(APPROVAL_LIFECYCLE_STAGES).toEqual([
      "PROPOSED",
      "REVIEW_PENDING",
      "APPROVED",
      "DENIED",
      "EXPIRED",
      "EXECUTION_PENDING",
      "EXECUTED",
      "VERIFICATION_PENDING",
      "VERIFIED",
      "FAILED",
      "COMPENSATION_AVAILABLE",
    ]);
    expect(isApprovalLifecycleStage("PROPOSED")).toBe(true);
    expect(isApprovalLifecycleStage("AUTO_APPROVED")).toBe(false);
  });

  it("declares allowed transitions without advancing lifecycle state", () => {
    expect(APPROVAL_ALLOWED_TRANSITIONS.PROPOSED).toEqual(["REVIEW_PENDING"]);
    expect(APPROVAL_ALLOWED_TRANSITIONS.REVIEW_PENDING).toEqual([
      "APPROVED",
      "DENIED",
      "EXPIRED",
    ]);
    expect(getAllowedApprovalLifecycleTransitions("FAILED")).toEqual([
      "COMPENSATION_AVAILABLE",
    ]);
    expect(APPROVAL_STAGE_TRANSITION_DECLARATIONS.length).toBeGreaterThan(0);
    expect(APPROVAL_STAGE_TRANSITION_DECLARATIONS).toContainEqual({
      from_stage: "APPROVED",
      to_stage: "EXECUTION_PENDING",
      transition_allowed: true,
      declaration_only: true,
      metadata_only: true,
      advances_state: false,
      executes_action: false,
      grants_authority: false,
    });
  });

  it("rejects invalid transition declarations in validators and schemas", () => {
    expect(
      validateApprovalStageTransitionDeclaration({
        from_stage: "PROPOSED",
        to_stage: "EXECUTED",
      }),
    ).toMatchObject({
      valid: false,
      reason: "invalid_transition",
      state_advanced: false,
      action_executed: false,
      authority_granted: false,
    });
    expect(
      validateApprovalStageTransitionDeclaration({
        from_stage: "NOT_A_STAGE",
        to_stage: "EXECUTED",
      }),
    ).toMatchObject({
      valid: false,
      reason: "invalid_stage",
    });
    expect(() =>
      transition({ from_stage: "PROPOSED", to_stage: "EXECUTED" }),
    ).toThrow();
  });

  it("keeps proposal contracts metadata-only, replay-safe, and redaction-safe", () => {
    const contract = proposal();

    expect(contract).toMatchObject({
      approval_id: null,
      replay: {
        replay_safe: true,
        local_first: true,
        deterministic_replay_key_hash: "hash:approval-replay-key",
      },
      redaction: {
        redaction_safe: true,
        metadata_only: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_execution_command_included: false,
      },
      guard: {
        contract_only: true,
        approval_creation_supported: false,
        approval_decision_supported: false,
        execution_supported: false,
        verification_supported: false,
        compensation_execution_supported: false,
      },
    });
    expect(validateApprovalProposalContract(contract)).toEqual({
      valid: true,
      reason: "valid_contract",
      metadata_only: true,
      no_authority_granted: true,
      no_action_executed: true,
    });
  });

  it("defines lifecycle records and snapshots as inert metadata", () => {
    const lifecycleRecord = record();
    const lifecycleSnapshot = snapshot();

    expect(lifecycleRecord).toMatchObject({
      approval_id: null,
      execution_id: null,
      verification_id: null,
      compensation_id: null,
      guard: {
        lifecycle_processor_supported: false,
        execution_supported: false,
        persistence_supported: false,
      },
    });
    expect(lifecycleSnapshot).toMatchObject({
      transition_count: 1,
      guard: {
        ui_integration_supported: false,
        tool_runtime_integration_supported: false,
        adapter_integration_supported: false,
      },
    });
    expect(validateApprovalLifecycleRecord(lifecycleRecord).valid).toBe(true);
    expect(validateApprovalLifecycleSnapshot(lifecycleSnapshot).valid).toBe(
      true,
    );
  });

  it("defines audit previews without event-store writes or result payloads", () => {
    const preview = auditPreview();

    expect(preview).toMatchObject({
      preview_kind: "approval_lifecycle_audit_preview",
      includes_execution_result: false,
      includes_verification_result: false,
      includes_compensation_payload: false,
      audit_event_write_supported: false,
      event_store_write_supported: false,
      guard: {
        persistence_supported: false,
        event_store_integration_supported: false,
      },
    });
    expect(validateApprovalAuditPreview(preview).valid).toBe(true);
  });

  it("rejects tool arguments, raw payloads, commands, handlers, providers, devices, and network fields", () => {
    for (const field of APPROVAL_RUNTIME_FORBIDDEN_METADATA_FIELDS) {
      expect(
        validateApprovalProposalContract({ ...proposal(), [field]: "x" }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_field",
      });
    }
    expect(
      validateApprovalLifecycleRecord({
        ...record(),
        redaction: { ...redaction(), raw_payload: "private" },
      }),
    ).toMatchObject({
      valid: false,
      reason: "forbidden_field",
    });
  });

  it("rejects attempts to enable execution, approvals, verification, compensation, persistence, UI, runtime, adapters, or network", () => {
    for (const enabledField of [
      "approval_creation_supported",
      "approval_decision_supported",
      "execution_supported",
      "verification_supported",
      "compensation_execution_supported",
      "persistence_supported",
      "event_store_integration_supported",
      "ui_integration_supported",
      "tool_runtime_integration_supported",
      "adapter_integration_supported",
      "scheduler_supported",
      "network_allowed",
      "cloud_allowed",
    ]) {
      expect(
        ApprovalProposalContractSchema.safeParse({
          ...proposal(),
          guard: { ...guard(), [enabledField]: true },
        }).success,
      ).toBe(false);
    }
  });
});
