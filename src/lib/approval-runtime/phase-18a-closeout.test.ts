import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION,
  APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION,
  APPROVAL_FORBIDDEN_CAPABILITIES,
  APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION,
  APPROVAL_PROPOSAL_REGISTRY_KINDS,
  APPROVAL_RUNTIME_CONTRACT_VERSION,
  APPROVAL_RUNTIME_PHASE_18A_SLICES,
  APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION,
  ApprovalAuditPreviewContractSchema,
  ApprovalLifecycleRecordSchema,
  ApprovalProposalContractSchema,
  ApprovalRuntimePhase18ACloseoutGuardSchema,
  DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX,
  buildApprovalAuditPreviewContract,
  validateApprovalForbiddenCapabilityGuard,
  validateApprovalProposalMetadataGuards,
  type ApprovalValidationGuardResult,
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

function flattenedValidationResults(): ApprovalValidationGuardResult[] {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds.flatMap(
    (proposal) => [...validateApprovalProposalMetadataGuards(proposal)],
  );
}

describe("Phase 18A.6 approval runtime closeout guard", () => {
  it("declares the Phase 18A closeout guard as metadata-only and non-authoritative", () => {
    expect(DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD).toMatchObject({
      phase: 18,
      closeout_slice: "18A.6",
      closeout_id: "approval_runtime_phase_18a_closeout_guard",
      lifecycle_contract_version: APPROVAL_RUNTIME_CONTRACT_VERSION,
      authority_boundary_contract_version:
        APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION,
      proposal_registry_contract_version:
        APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION,
      validation_guard_contract_version:
        APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION,
      audit_preview_contract_version: APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION,
      metadata_only: true,
      non_executing: true,
      non_authoritative: true,
      replay_safe: true,
      redaction_safe: true,
      contract_foundation_only: true,
      execution_supported: false,
      approval_creation_supported: false,
      authority_grant_supported: false,
    });
    expect(
      ApprovalRuntimePhase18ACloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD.slices_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18A_SLICES);
  });

  it("proves all Phase 18A contract foundations exist", () => {
    expect(APPROVAL_RUNTIME_CONTRACT_VERSION).toBe("18A.1");
    expect(APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION).toBe("18A.2");
    expect(APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION).toBe("18A.3");
    expect(APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION).toBe("18A.4");
    expect(APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION).toBe("18A.5");

    expect(typeof ApprovalProposalContractSchema.safeParse).toBe("function");
    expect(typeof ApprovalLifecycleRecordSchema.safeParse).toBe("function");
    expect(DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.matrix_id).toBe(
      "approval_authority_boundary_matrix",
    );
    expect(DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.registry_id).toBe(
      "approval_proposal_metadata_registry",
    );
    expect(DEFAULT_APPROVAL_VALIDATION_GUARD_MATRIX.matrix_id).toBe(
      "approval_validation_guard_matrix",
    );
    expect(typeof ApprovalAuditPreviewContractSchema.safeParse).toBe(
      "function",
    );
  });

  it("keeps every initial proposal kind metadata-only, approval-required, and dry-run-required", () => {
    expect(APPROVAL_PROPOSAL_REGISTRY_KINDS).toEqual([
      "note_create",
      "project_task_create",
      "room_action_execute",
    ]);

    for (const proposal of DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds) {
      expect(proposal).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
        requiresApproval: true,
        dryRunRequired: true,
        executionEnabled: false,
        verificationEnabled: false,
        compensationEnabled: false,
        autoApprovalAllowed: false,
        voiceOnlyApprovalAllowed: false,
        approvalInheritanceAllowed: false,
        crossSessionPersistenceAllowed: false,
      });
    }
  });

  it("keeps reserved authority classes non-executable", () => {
    for (const authorityClass of [
      "execution_authority_reserved",
      "verification_reserved",
      "compensation_reserved",
    ]) {
      const entry =
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.authority_classes.find(
          (candidate) => candidate.authority_class === authorityClass,
        );

      expect(entry).toMatchObject({
        class_kind: "reserved",
        describe_allowed: true,
        perform_allowed: false,
        authority_grant_allowed: false,
        approval_creation_allowed: false,
        dispatch_allowed: false,
        tool_dispatch_allowed: false,
        room_action_allowed: false,
        project_mutation_allowed: false,
        obsidian_write_allowed: false,
        memory_write_allowed: false,
        scheduler_action_allowed: false,
        network_cloud_allowed: false,
      });
    }
  });

  it("keeps all forbidden capabilities rejected", () => {
    expect(
      DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.forbidden_capabilities.map(
        (entry) => entry.capability,
      ),
    ).toEqual(APPROVAL_FORBIDDEN_CAPABILITIES);

    for (const capability of APPROVAL_FORBIDDEN_CAPABILITIES) {
      expect(
        validateApprovalForbiddenCapabilityGuard(capability),
      ).toMatchObject({
        guard_id: "forbidden_capability_rejected",
        passed: false,
        reason_code: "forbidden_capability",
        authority_granted: false,
        dispatch_performed: false,
        action_executed: false,
        verification_performed: false,
        compensation_performed: false,
      });
    }
  });

  it("proves validation results contain no raw payloads", () => {
    const results = flattenedValidationResults();

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result).toMatchObject({
        metadata_only: true,
        audit_preview_safe: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_execution_command_included: false,
        secret_material_included: false,
        pii_included: false,
        approval_created: false,
        authority_granted: false,
        action_executed: false,
      });
    }
    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(collectKeys(results)).not.toContain(key);
    }
  });

  it("proves audit previews expose disabled execution and authority status", () => {
    const preview = buildApprovalAuditPreviewContract({
      preview_id_hash: "hash:phase-18a-closeout-preview",
      proposal: DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
      validation_results: validateApprovalProposalMetadataGuards(
        DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0],
      ),
    });

    expect(preview).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      ui_wired: false,
      audit_db_write_enabled: false,
      disabled_execution_status: {
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
      },
    });
    expect(ApprovalAuditPreviewContractSchema.safeParse(preview).success).toBe(
      true,
    );
  });

  it("public exports expose no operational function names", () => {
    const forbiddenFunctionNamePattern =
      /(createApproval|approve|execute|dispatch|run|verify|compensate|rollback)/i;
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
