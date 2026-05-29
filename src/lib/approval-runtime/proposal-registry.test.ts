import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_PROPOSAL_REGISTRY_KINDS,
  ApprovalProposalKindDeclarationSchema,
  ApprovalProposalRegistrySchema,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  validateApprovalProposalForbiddenCapability,
  validateApprovalProposalKindMetadata,
  validateApprovalProposalRegistry,
  type ApprovalProposalRegistryKind,
} from "./index";

describe("Phase 18A.3 approval proposal metadata registry", () => {
  it("declares the metadata-only proposal registry", () => {
    expect(DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY).toMatchObject({
      contract_version: "18A.3",
      registry_id: "approval_proposal_metadata_registry",
      phase: 18,
      slice: "18A.3",
      local_first: true,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      authority_boundary_matrix_ref: "approval_authority_boundary_matrix",
      replay: {
        replay_safe: true,
        local_first: true,
      },
      redaction: {
        redaction_safe: true,
        metadata_only: true,
        raw_payload_included: false,
        raw_tool_arguments_included: false,
        raw_execution_command_included: false,
      },
      guard: {
        approval_creation_supported: false,
        execution_supported: false,
        verification_supported: false,
        compensation_execution_supported: false,
        persistence_supported: false,
        tool_runtime_integration_supported: false,
        adapter_integration_supported: false,
      },
    });
    expect(
      ApprovalProposalRegistrySchema.safeParse(
        DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
      ).success,
    ).toBe(true);
    expect(
      validateApprovalProposalRegistry(
        DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
      ),
    ).toMatchObject({
      valid: true,
      reason: "valid_registry",
      metadata_only: true,
      replay_safe: true,
      proposal_created: false,
      approval_created: false,
      authority_granted: false,
    });
  });

  it("declares all initial proposal kinds", () => {
    expect(APPROVAL_PROPOSAL_REGISTRY_KINDS).toEqual([
      "note_create",
      "project_task_create",
      "room_action_execute",
    ]);
    expect(
      DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds.map(
        (entry) => entry.proposal_kind,
      ),
    ).toEqual(APPROVAL_PROPOSAL_REGISTRY_KINDS);
  });

  it("requires approval and dry-run for every proposal kind", () => {
    for (const proposalKind of DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds) {
      expect(proposalKind).toMatchObject({
        requiresApproval: true,
        dryRunRequired: true,
        trust: {
          local_first: true,
          user_review_required: true,
          authority_boundary_required: true,
          metadata_only: true,
        },
        expiry: {
          expires_after_ms: 300_000,
          expiry_required: true,
          reproposal_required_after_expiry: true,
          metadata_only: true,
        },
      });
    }
  });

  it("keeps execution, verification, and compensation disabled for every kind", () => {
    for (const proposalKind of DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds) {
      expect(proposalKind).toMatchObject({
        executionEnabled: false,
        verificationEnabled: false,
        compensationEnabled: false,
        approvalCreationEnabled: false,
        authorityGrantEnabled: false,
        dispatchEnabled: false,
      });
    }
  });

  it("forbids auto-approval, voice-only approval, inheritance, and cross-session persistence", () => {
    for (const proposalKind of DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds) {
      expect(proposalKind).toMatchObject({
        autoApprovalAllowed: false,
        voiceOnlyApprovalAllowed: false,
        approvalInheritanceAllowed: false,
        crossSessionPersistenceAllowed: false,
        expiry: {
          cross_session_persistence_allowed: false,
          timers_registered: false,
          scheduler_registered: false,
        },
      });
    }
  });

  it("forbids runtime, storage, telemetry, target mutation, scheduler, and network wiring", () => {
    for (const proposalKind of DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds) {
      expect(proposalKind).toMatchObject({
        uiWiringEnabled: false,
        dbEventStoreWiringEnabled: false,
        telemetryWritesEnabled: false,
        toolRuntimeWiringEnabled: false,
        roomAdapterWiringEnabled: false,
        projectMutationEnabled: false,
        obsidianWriteEnabled: false,
        memoryWriteEnabled: false,
        schedulerTriggeredProposalCreationEnabled: false,
        networkCloudCallsEnabled: false,
        source: {
          scheduler_triggered_creation_allowed: false,
          voice_only_creation_allowed: false,
          background_creation_allowed: false,
        },
        target: {
          raw_target_payload_allowed: false,
          project_mutation_allowed: false,
          obsidian_write_allowed: false,
          room_adapter_wiring_allowed: false,
          memory_write_allowed: false,
        },
      });
    }
  });

  it("rejects attempts to enable proposal-kind authority flags", () => {
    const baseKind =
      DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];

    for (const enabledField of [
      "executionEnabled",
      "verificationEnabled",
      "compensationEnabled",
      "autoApprovalAllowed",
      "voiceOnlyApprovalAllowed",
      "approvalInheritanceAllowed",
      "crossSessionPersistenceAllowed",
      "approvalCreationEnabled",
      "authorityGrantEnabled",
      "dispatchEnabled",
      "uiWiringEnabled",
      "dbEventStoreWiringEnabled",
      "telemetryWritesEnabled",
      "toolRuntimeWiringEnabled",
      "roomAdapterWiringEnabled",
      "projectMutationEnabled",
      "obsidianWriteEnabled",
      "memoryWriteEnabled",
      "schedulerTriggeredProposalCreationEnabled",
      "networkCloudCallsEnabled",
    ]) {
      expect(
        ApprovalProposalKindDeclarationSchema.safeParse({
          ...baseKind,
          [enabledField]: true,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown proposal kinds and incomplete registries", () => {
    expect(validateApprovalProposalKindMetadata("unknown_kind")).toMatchObject({
      valid: false,
      reason: "unknown_proposal_kind",
      proposal_kind: null,
      proposal_created: false,
      approval_created: false,
      action_executed: false,
    });
    expect(
      validateApprovalProposalRegistry({
        ...DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
        proposal_kinds:
          DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds.filter(
            (entry) => entry.proposal_kind !== "room_action_execute",
          ),
      }),
    ).toMatchObject({
      valid: false,
      reason: "invalid_registry",
      authority_granted: false,
      state_mutated: false,
    });
  });

  it("returns inert metadata-only validation outputs", () => {
    const outputs = [
      validateApprovalProposalRegistry(
        DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
      ),
      validateApprovalProposalKindMetadata(
        "note_create" satisfies ApprovalProposalRegistryKind,
      ),
      validateApprovalProposalKindMetadata(
        "project_task_create" satisfies ApprovalProposalRegistryKind,
      ),
      validateApprovalProposalForbiddenCapability("tool_dispatch"),
    ];

    for (const output of outputs) {
      expect(output).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
        local_first: true,
        proposal_created: false,
        approval_created: false,
        authority_granted: false,
        dispatch_performed: false,
        action_executed: false,
        verification_performed: false,
        compensation_performed: false,
        state_mutated: false,
        persisted: false,
        telemetry_written: false,
        network_called: false,
        cloud_called: false,
      });
    }
  });

  it("exposes no createApproval, execute, dispatch, run, verify, or compensate functions", () => {
    const forbiddenFunctionNamePattern =
      /(createApproval|execute|dispatch|run|verify|compensate)/i;
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
