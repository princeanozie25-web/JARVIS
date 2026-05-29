import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_VALIDATION_GUARD_IDS,
  ApprovalLifecycleRecordSchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX,
  validateApprovalAuthorityClassGuard,
  validateApprovalForbiddenCapabilityGuard,
  validateApprovalLifecycleRecordMetadataGuards,
  validateApprovalProposalMetadataGuards,
  validateApprovalValidationGuardMatrix,
  type ApprovalLifecycleRecord,
  type ApprovalProposalKindDeclaration,
  type ApprovalValidationGuardId,
  type ApprovalValidationGuardResult,
} from "./index";

function replay(sequence_index = 0) {
  return {
    schema_version: "approval-runtime.v18a1",
    replay_safe: true,
    local_first: true,
    deterministic_replay_key_hash: "hash:validation-guard-key",
    source_event_hash: "hash:validation-guard-source",
    originating_session_hash: null,
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
  overrides: Partial<ApprovalProposalKindDeclaration> = {},
): ApprovalProposalKindDeclaration {
  return {
    ...DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
    ...overrides,
  };
}

function lifecycleRecord(
  overrides: Partial<ApprovalLifecycleRecord> = {},
): ApprovalLifecycleRecord {
  return ApprovalLifecycleRecordSchema.parse({
    contract_version: "18A.1",
    lifecycle_record_id_hash: "hash:validation-lifecycle-record",
    approval_id: null,
    proposal_id: "proposal:validation-guard-proposal",
    execution_id: null,
    verification_id: null,
    compensation_id: null,
    current_stage: "PROPOSED",
    transitions: [
      {
        from_stage: "PROPOSED",
        to_stage: "REVIEW_PENDING",
        transition_allowed: true,
        declaration_only: true,
        metadata_only: true,
        advances_state: false,
        executes_action: false,
        grants_authority: false,
        transition_ref_hash: "hash:validation-transition",
        observed_at_ms: null,
        replay: replay(1),
        redaction: redaction(),
      },
    ],
    replay: replay(),
    redaction: redaction(),
    guard: guard(),
    ...overrides,
  });
}

function resultByGuard(
  results: readonly ApprovalValidationGuardResult[],
  guardId: ApprovalValidationGuardId,
): ApprovalValidationGuardResult {
  const result = results.find((candidate) => candidate.guard_id === guardId);
  expect(result).toBeDefined();
  return result as ApprovalValidationGuardResult;
}

describe("Phase 18A.4 approval validation guard matrix", () => {
  it("declares the validation guard matrix and every required guard", () => {
    const declaredGuards = new Set(
      [
        ...DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX.proposal_guards,
        ...DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX.lifecycle_record_guards,
        ...DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX.authority_boundary_guards,
      ].map((entry) => entry.guard_id),
    );

    expect(DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX).toMatchObject({
      contract_version: "18A.4",
      matrix_id: "approval_validation_guard_matrix",
      phase: 18,
      slice: "18A.4",
      local_first: true,
      metadata_only: true,
      audit_preview_safe: true,
      replay_safe: true,
      redaction_safe: true,
    });
    expect(declaredGuards.size).toBe(APPROVAL_VALIDATION_GUARD_IDS.length);
    expect(
      APPROVAL_VALIDATION_GUARD_IDS.every((guardId) =>
        declaredGuards.has(guardId),
      ),
    ).toBe(true);
    expect(
      validateApprovalValidationGuardMatrix(
        DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX,
      ),
    ).toMatchObject({
      passed: true,
      reason_code: "passed",
      metadata_only: true,
      audit_preview_safe: true,
      authority_granted: false,
      action_executed: false,
    });
  });

  it("passes valid metadata-only proposal declarations", () => {
    const results = validateApprovalProposalMetadataGuards(proposal());

    expect(results.every((result) => result.passed)).toBe(true);
    expect(resultByGuard(results, "known_proposal_kind_only")).toMatchObject({
      passed: true,
      reason_code: "passed",
      checked_at_source: "proposal_validation_matrix",
    });
  });

  it("fails unknown proposal kinds", () => {
    const results = validateApprovalProposalMetadataGuards(
      proposal({ proposal_kind: "unknown_kind" as never }),
    );

    expect(resultByGuard(results, "known_proposal_kind_only")).toMatchObject({
      passed: false,
      reason_code: "unknown_proposal_kind",
    });
    expect(
      resultByGuard(results, "proposal_kind_exists_in_registry"),
    ).toMatchObject({
      passed: false,
      reason_code: "proposal_kind_missing_from_registry",
    });
  });

  it("fails forbidden capabilities", () => {
    expect(
      validateApprovalForbiddenCapabilityGuard("tool_dispatch"),
    ).toMatchObject({
      guard_id: "forbidden_capability_rejected",
      passed: false,
      reason_code: "forbidden_capability",
      authority_granted: false,
      dispatch_performed: false,
      action_executed: false,
    });
  });

  it("fails execution, auto-approval, voice-only, inheritance, and cross-session persistence enablement", () => {
    const cases: Array<{
      readonly field: keyof ApprovalProposalKindDeclaration;
      readonly guardId: ApprovalValidationGuardId;
      readonly reason: string;
    }> = [
      {
        field: "executionEnabled",
        guardId: "execution_enabled_false",
        reason: "execution_enabled",
      },
      {
        field: "autoApprovalAllowed",
        guardId: "auto_approval_allowed_false",
        reason: "auto_approval_enabled",
      },
      {
        field: "voiceOnlyApprovalAllowed",
        guardId: "voice_only_approval_allowed_false",
        reason: "voice_only_approval_enabled",
      },
      {
        field: "approvalInheritanceAllowed",
        guardId: "approval_inheritance_allowed_false",
        reason: "approval_inheritance_enabled",
      },
      {
        field: "crossSessionPersistenceAllowed",
        guardId: "cross_session_persistence_allowed_false",
        reason: "cross_session_persistence_enabled",
      },
    ];

    for (const testCase of cases) {
      const results = validateApprovalProposalMetadataGuards(
        proposal({
          [testCase.field]: true,
        } as unknown as Partial<ApprovalProposalKindDeclaration>),
      );

      expect(resultByGuard(results, testCase.guardId)).toMatchObject({
        passed: false,
        reason_code: testCase.reason,
        lifecycle_state_advanced: false,
        action_executed: false,
      });
    }
  });

  it("fails unknown lifecycle stages", () => {
    const results = validateApprovalLifecycleRecordMetadataGuards({
      ...lifecycleRecord(),
      current_stage: "UNKNOWN_STAGE",
    });

    expect(resultByGuard(results, "lifecycle_stage_known")).toMatchObject({
      passed: false,
      reason_code: "unknown_lifecycle_stage",
      lifecycle_state_advanced: false,
    });
  });

  it("fails invalid lifecycle transitions without advancing state", () => {
    const results = validateApprovalLifecycleRecordMetadataGuards({
      ...lifecycleRecord(),
      transitions: [
        {
          from_stage: "PROPOSED",
          to_stage: "EXECUTED",
          transition_allowed: true,
          declaration_only: true,
          metadata_only: true,
          advances_state: false,
          executes_action: false,
          grants_authority: false,
          transition_ref_hash: "hash:invalid-transition",
          observed_at_ms: null,
          replay: replay(1),
          redaction: redaction(),
        },
      ],
    });

    expect(
      resultByGuard(results, "lifecycle_transition_declared"),
    ).toMatchObject({
      passed: false,
      reason_code: "undeclared_lifecycle_transition",
      lifecycle_state_advanced: false,
      action_executed: false,
    });
  });

  it("fails unknown authority classes", () => {
    expect(validateApprovalAuthorityClassGuard("tool_dispatch")).toMatchObject({
      guard_id: "unknown_authority_class_rejected",
      passed: false,
      reason_code: "unknown_authority_class",
      authority_granted: false,
    });
  });

  it("validation output contains no raw payloads and remains audit-preview safe", () => {
    const output = resultByGuard(
      validateApprovalProposalMetadataGuards(proposal()),
      "metadata_redaction_safe",
    );

    expect(output).toMatchObject({
      metadata_only: true,
      audit_preview_safe: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_execution_command_included: false,
      secret_material_included: false,
      pii_included: false,
      persisted: false,
      event_store_written: false,
      telemetry_written: false,
    });
    expect(Object.keys(output)).not.toEqual(
      expect.arrayContaining(["raw_payload", "payload", "tool_arguments"]),
    );
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
