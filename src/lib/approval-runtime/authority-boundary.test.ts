import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_AUTHORITY_CLASSES,
  APPROVAL_FORBIDDEN_CAPABILITIES,
  APPROVAL_METADATA_AUTHORITY_CLASSES,
  APPROVAL_RESERVED_AUTHORITY_CLASSES,
  ApprovalAuthorityBoundaryMatrixSchema,
  ApprovalAuthorityClassEntrySchema,
  DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
  validateApprovalAuthorityBoundaryMatrix,
  validateApprovalAuthorityClassMetadata,
  validateApprovalForbiddenCapabilityMetadata,
  type ApprovalAuthorityClass,
  type ApprovalForbiddenCapability,
} from "./index";

describe("Phase 18A.2 approval authority boundary matrix", () => {
  it("declares the approval authority boundary matrix", () => {
    expect(DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX).toMatchObject({
      contract_version: "18A.2",
      matrix_id: "approval_authority_boundary_matrix",
      phase: 18,
      slice: "18A.2",
      local_first: true,
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
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
    });
    expect(
      ApprovalAuthorityBoundaryMatrixSchema.safeParse(
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
      ).success,
    ).toBe(true);
    expect(
      validateApprovalAuthorityBoundaryMatrix(
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
      ),
    ).toMatchObject({
      valid: true,
      reason: "valid_matrix",
      metadata_only: true,
      replay_safe: true,
      authority_granted: false,
      action_executed: false,
    });
  });

  it("declares all allowed metadata authority classes", () => {
    const declaredClasses =
      DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.authority_classes.map(
        (entry) => entry.authority_class,
      );

    expect(declaredClasses).toEqual(APPROVAL_AUTHORITY_CLASSES);
    expect(APPROVAL_METADATA_AUTHORITY_CLASSES).toEqual([
      "proposal_metadata",
      "review_metadata",
      "approval_decision_metadata",
      "audit_preview_metadata",
    ]);

    for (const authorityClass of APPROVAL_METADATA_AUTHORITY_CLASSES) {
      const entry =
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.authority_classes.find(
          (candidate) => candidate.authority_class === authorityClass,
        );

      expect(entry).toMatchObject({
        authority_class: authorityClass,
        class_kind: "metadata",
        describe_allowed: true,
        perform_allowed: false,
        authority_grant_allowed: false,
        approval_creation_allowed: false,
        dispatch_allowed: false,
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
      });
      expect(
        validateApprovalAuthorityClassMetadata(authorityClass),
      ).toMatchObject({
        valid: true,
        reason: "valid_metadata_class",
        authority_class: authorityClass,
        metadata_only: true,
        replay_safe: true,
        authority_granted: false,
      });
    }
  });

  it("keeps reserved execution classes descriptive and non-executable", () => {
    expect(APPROVAL_RESERVED_AUTHORITY_CLASSES).toEqual([
      "execution_authority_reserved",
      "verification_reserved",
      "compensation_reserved",
    ]);

    for (const authorityClass of APPROVAL_RESERVED_AUTHORITY_CLASSES) {
      const entry =
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.authority_classes.find(
          (candidate) => candidate.authority_class === authorityClass,
        );

      expect(entry).toMatchObject({
        authority_class: authorityClass,
        class_kind: "reserved",
        describe_allowed: true,
        perform_allowed: false,
        authority_grant_allowed: false,
        dispatch_allowed: false,
        tool_dispatch_allowed: false,
        room_action_allowed: false,
        project_mutation_allowed: false,
        obsidian_write_allowed: false,
        memory_write_allowed: false,
        scheduler_action_allowed: false,
        network_cloud_allowed: false,
      });
      expect(
        validateApprovalAuthorityClassMetadata(authorityClass),
      ).toMatchObject({
        valid: false,
        reason: "reserved_authority_class",
        authority_class: authorityClass,
        authority_granted: false,
        action_executed: false,
        verification_performed: false,
        compensation_performed: false,
      });
    }
  });

  it("declares and rejects every forbidden capability", () => {
    expect(APPROVAL_FORBIDDEN_CAPABILITIES).toEqual([
      "execution_authority_grants",
      "auto_approval",
      "voice_only_approval",
      "approval_inheritance",
      "cross_session_approval_persistence",
      "multi_step_execution_graphs",
      "tool_dispatch",
      "room_action_execution",
      "project_mutation",
      "obsidian_write",
      "memory_write",
      "scheduler_triggered_action",
      "network_cloud_action",
    ]);

    for (const capability of APPROVAL_FORBIDDEN_CAPABILITIES) {
      expect(
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.forbidden_capabilities,
      ).toContainEqual({
        capability,
        forbidden: true,
        metadata_only: true,
        replay_safe: true,
        authority_grant_allowed: false,
        action_allowed: false,
      });
      expect(validateApprovalForbiddenCapabilityMetadata(capability)).toEqual({
        valid: false,
        reason: "forbidden_capability",
        authority_class: null,
        forbidden_capability: capability,
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
        local_first: true,
        authority_granted: false,
        approval_created: false,
        approval_decision_recorded: false,
        dispatch_performed: false,
        tool_dispatched: false,
        action_executed: false,
        verification_performed: false,
        compensation_performed: false,
        state_mutated: false,
        persisted: false,
        network_called: false,
        cloud_called: false,
      });
    }
  });

  it("rejects attempts to enable forbidden authority on class entries", () => {
    const baseEntry =
      DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.authority_classes[0];

    for (const enabledField of [
      "perform_allowed",
      "authority_grant_allowed",
      "approval_creation_allowed",
      "dispatch_allowed",
      "tool_dispatch_allowed",
      "room_action_allowed",
      "project_mutation_allowed",
      "obsidian_write_allowed",
      "memory_write_allowed",
      "scheduler_action_allowed",
      "network_cloud_allowed",
    ]) {
      expect(
        ApprovalAuthorityClassEntrySchema.safeParse({
          ...baseEntry,
          [enabledField]: true,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects incomplete matrices and unknown classes", () => {
    expect(
      validateApprovalAuthorityBoundaryMatrix({
        ...DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
        authority_classes:
          DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX.authority_classes.filter(
            (entry) => entry.authority_class !== "audit_preview_metadata",
          ),
      }),
    ).toMatchObject({
      valid: false,
      reason: "invalid_matrix",
      metadata_only: true,
      replay_safe: true,
      authority_granted: false,
      state_mutated: false,
    });
    expect(
      validateApprovalAuthorityClassMetadata("tool_dispatch"),
    ).toMatchObject({
      valid: false,
      reason: "invalid_authority_class",
      authority_class: null,
      action_executed: false,
    });
  });

  it("exposes no function with dispatch, execute, approve, or createApproval semantics", () => {
    const forbiddenFunctionNamePattern =
      /(dispatch|execute|approve|createApproval)/i;
    const exportedFunctionNames = Object.entries(approvalRuntime)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    expect(exportedFunctionNames).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(forbiddenFunctionNamePattern),
      ]),
    );
  });

  it("keeps every guard output metadata-only, local-first, replay-safe, and inert", () => {
    const outputs = [
      validateApprovalAuthorityBoundaryMatrix(
        DEFAULT_APPROVAL_AUTHORITY_BOUNDARY_MATRIX,
      ),
      validateApprovalAuthorityClassMetadata(
        "proposal_metadata" satisfies ApprovalAuthorityClass,
      ),
      validateApprovalAuthorityClassMetadata(
        "execution_authority_reserved" satisfies ApprovalAuthorityClass,
      ),
      validateApprovalForbiddenCapabilityMetadata(
        "network_cloud_action" satisfies ApprovalForbiddenCapability,
      ),
    ];

    for (const output of outputs) {
      expect(output).toMatchObject({
        metadata_only: true,
        replay_safe: true,
        redaction_safe: true,
        local_first: true,
        authority_granted: false,
        approval_created: false,
        approval_decision_recorded: false,
        dispatch_performed: false,
        tool_dispatched: false,
        action_executed: false,
        verification_performed: false,
        compensation_performed: false,
        state_mutated: false,
        persisted: false,
        network_called: false,
        cloud_called: false,
      });
    }
  });
});
