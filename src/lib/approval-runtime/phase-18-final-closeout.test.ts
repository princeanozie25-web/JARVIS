import { describe, expect, it } from "vitest";

import * as approvalRuntime from "./index";
import {
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
  APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS,
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES,
  APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_COMPENSATION_STATUSES,
  APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_PLAN_STATUSES,
  APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES,
  APPROVAL_EXECUTION_VERIFICATION_METHODS,
  APPROVAL_EXECUTION_VERIFICATION_STATUSES,
  APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES,
  APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS,
  APPROVAL_LIFECYCLE_INTEGRATION_STATUSES,
  APPROVAL_RUNTIME_PHASE_18_CLOSEOUT_FOUNDATIONS,
  ApprovalRuntimePhase18FinalCloseoutGuardSchema,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT,
  DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT,
  DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT,
  DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX,
  DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD,
  DEFAULT_APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_GUARD,
  buildApprovalAuditPreviewContract,
  buildApprovalAuthorityTokenMetadata,
  buildApprovalDecisionRecordMetadata,
  buildApprovalExecutionCompensationAuditPreviewContract,
  buildApprovalExecutionCompensationMetadata,
  buildApprovalExecutionPlanMetadata,
  buildApprovalExecutionVerificationMetadata,
  buildApprovalLifecycleIntegrationSnapshot,
  buildApprovalProposalInboxItem,
  buildApprovalReviewDecisionMetadata,
  buildApprovalReviewSessionSnapshot,
  evaluateApprovalAuthorityExpiryMetadataShape,
  validateApprovalExecutionCompensationPolicyMetadata,
  validateApprovalLifecycleIntegrationPolicyMetadata,
  validateApprovalLifecycleIntegrationSnapshotShape,
  validateApprovalProposalMetadataGuards,
} from "./index";

const FORBIDDEN_RAW_KEYS = [
  "raw_payload",
  "payload",
  "raw_body",
  "body",
  "tool_args",
  "tool_arguments",
  "tool_output",
  "tool_outputs",
  "prompt",
  "prompts",
  "model_output",
  "model_outputs",
  "device_payload",
  "project_contents",
  "memory_contents",
  "raw_state",
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
  "readState",
  "compensate",
  "rollback",
  "restore",
  "persist",
  "writeTelemetry",
] as const;

const FALSE_OPERATIONAL_FIELDS = [
  "approval_creation_supported",
  "approval_decision_handling_supported",
  "lifecycle_advancement_supported",
  "authority_grant_supported",
  "token_issue_supported",
  "token_grant_supported",
  "usable_token_supported",
  "active_token_supported",
  "execution_supported",
  "dispatch_supported",
  "tool_calls_supported",
  "room_actions_supported",
  "project_mutation_supported",
  "obsidian_write_supported",
  "memory_write_supported",
  "network_cloud_calls_supported",
  "real_verification_supported",
  "real_state_reads_supported",
  "real_compensation_supported",
  "rollback_supported",
  "restore_supported",
  "persistence_supported",
  "event_store_writes_supported",
  "telemetry_writes_supported",
  "write_telemetry_supported",
  "runtime_wiring_supported",
  "ui_rendering_supported",
  "api_routes_supported",
  "scheduler_triggered_action_supported",
  "auto_approval_supported",
  "voice_only_approval_supported",
  "approval_inheritance_supported",
  "cross_session_approval_persistence_supported",
  "multi_step_execution_graphs_supported",
  "approval_creation_enabled",
  "approval_decision_handling_enabled",
  "authority_grant_enabled",
  "token_issue_enabled",
  "usable_token_enabled",
  "execution_enabled",
  "dispatch_enabled",
  "tool_runtime_enabled",
  "room_action_enabled",
  "project_mutation_enabled",
  "obsidian_write_enabled",
  "memory_write_enabled",
  "network_call_enabled",
  "real_state_read_enabled",
  "verification_enabled",
  "compensation_enabled",
  "rollback_enabled",
  "restore_enabled",
  "persistence_enabled",
  "telemetry_write_enabled",
  "approval_created",
  "approval_decision_handled",
  "authority_granted",
  "token_issued",
  "usable_token_issued",
  "lifecycle_state_advanced",
  "action_executed",
  "dispatch_performed",
  "real_verification_performed",
  "real_state_read_performed",
  "real_compensation_performed",
  "rollback_performed",
  "restore_performed",
  "persisted",
  "event_store_written",
  "telemetry_written",
  "ui_wired",
  "api_route_called",
  "runtime_wired",
] as const;

function proposal() {
  return DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds[0];
}

function proposalAuditPreview() {
  return buildApprovalAuditPreviewContract({
    preview_id_hash: "hash:phase-18-final-proposal-preview",
    proposal: proposal(),
    validation_results: validateApprovalProposalMetadataGuards(proposal()),
    current_stage: "PROPOSED",
    transition_count: 0,
  });
}

function inboxItem() {
  return buildApprovalProposalInboxItem({
    inbox_item_id: "inbox:phase-18-final",
    proposal_id: "proposal:phase-18-final",
    proposal: proposal(),
    audit_preview: proposalAuditPreview(),
    status: "review_required",
    created_at_ms: 1_000,
  });
}

function reviewDecision() {
  return buildApprovalReviewDecisionMetadata({
    review_decision_id: "review:phase-18-final",
    inbox_item: inboxItem(),
    decision_request: "approve_requested",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18-final-reason",
    reason_kind: "user_intent_metadata",
  });
}

function reviewSession() {
  return buildApprovalReviewSessionSnapshot({
    review_session_id: "review-session:phase-18-final",
    inbox_item: inboxItem(),
    audit_preview: proposalAuditPreview(),
    decision_request_metadata: reviewDecision(),
    participant_ref_hash: "hash:local-user",
    opened_at_ms: 2_000,
  });
}

function decisionRecord() {
  return buildApprovalDecisionRecordMetadata({
    decision_record_id: "decision-record:phase-18-final",
    review_session: reviewSession(),
    outcome: "approved_recorded",
    channel: "typed_confirmation",
    actor_ref_hash: "hash:local-user",
    reason_ref_hash: "hash:phase-18-final-decision-reason",
    reason_kind: "user_intent_metadata",
  });
}

function authorityToken() {
  return buildApprovalAuthorityTokenMetadata({
    token_id: "authority-token:phase-18-final",
    review_session: reviewSession(),
    target_class: "obsidian_note",
    expires_at_ms: 302_000,
  });
}

function executionPlan() {
  return buildApprovalExecutionPlanMetadata({
    execution_plan_id: "execution-plan:phase-18-final",
    decision_record: decisionRecord(),
    target_class: "obsidian_note",
    target_ref_hash: "hash:phase-18-final-target-note",
    risk_class: "medium",
    step_id: "step:phase-18-final",
  });
}

function verificationMetadata() {
  return buildApprovalExecutionVerificationMetadata({
    verification_id: "verification:phase-18-final",
    execution_plan: executionPlan(),
    evidence_id: "verification-evidence:phase-18-final",
    redacted_reference: "redacted:phase-18-final-verification-evidence",
    hash_reference: "hash:phase-18-final-verification-evidence",
    observed_at_metadata_ms: 3_000,
  });
}

function compensationMetadata() {
  return buildApprovalExecutionCompensationMetadata({
    compensation_id: "compensation:phase-18-final",
    verification_metadata: verificationMetadata(),
    hint_id: "compensation-hint:phase-18-final",
    evidence_id: "compensation-evidence:phase-18-final",
    redacted_reference: "redacted:phase-18-final-compensation",
    hash_reference: "hash:phase-18-final-compensation",
  });
}

function compensationAuditPreview() {
  const compensation = compensationMetadata();

  return buildApprovalExecutionCompensationAuditPreviewContract({
    preview_id_hash: "hash:phase-18-final-compensation-preview",
    compensation_metadata: compensation,
    validation_results:
      validateApprovalExecutionCompensationPolicyMetadata(compensation),
  });
}

function integratedSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    ...buildApprovalLifecycleIntegrationSnapshot({
      integrated_lifecycle_id: "integrated-lifecycle:phase-18-final",
      proposal: proposal(),
      review_session: reviewSession(),
      decision_record: decisionRecord(),
      authority_token: authorityToken(),
      execution_plan: executionPlan(),
      verification_metadata: verificationMetadata(),
      compensation_metadata: compensationMetadata(),
      audit_preview_metadata: compensationAuditPreview(),
    }),
    ...overrides,
  };
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

function assertNoRawKeys(input: unknown) {
  const keys = collectKeys(input);

  for (const key of FORBIDDEN_RAW_KEYS) {
    expect(keys).not.toContain(key);
  }
}

function assertKnownOperationalFieldsFalse(input: unknown) {
  if (Array.isArray(input)) {
    for (const value of input) {
      assertKnownOperationalFieldsFalse(value);
    }
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    if (FALSE_OPERATIONAL_FIELDS.includes(key as never)) {
      expect(value).toBe(false);
    }
    assertKnownOperationalFieldsFalse(value);
  }
}

describe("Phase 18H.3 final approval lifecycle closeout guard", () => {
  it("declares the final Phase 18 closeout guard as metadata-only approval-gated proof", () => {
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_GUARD,
    ).toMatchObject({
      phase: 18,
      closeout_slice: "18H.3",
      closeout_id: "approval_runtime_phase_18_final_closeout_guard",
      phase_18a_foundation_closeout_version: "18A.6",
      phase_18b_foundation_closeout_version: "18B.4",
      phase_18c_foundation_closeout_version: "18C.4",
      phase_18d_foundation_closeout_version: "18D.4",
      phase_18e_foundation_closeout_version: "18E.4",
      phase_18f_foundation_closeout_version: "18F.4",
      phase_18g_foundation_closeout_version: "18G.4",
      lifecycle_integration_contract_version: "18H.1",
      lifecycle_integration_validation_contract_version: "18H.2",
      metadata_only: true,
      approval_gated_execution_layer_complete: true,
      governed_lifecycle_foundation: true,
      approval_only_authority_boundary: true,
      no_unapproved_execution_path: true,
      inert: true,
      replay_safe: true,
      redaction_safe: true,
      execution_supported: false,
      dispatch_supported: false,
      authority_grant_supported: false,
      token_issue_supported: false,
      real_verification_supported: false,
      real_state_reads_supported: false,
      real_compensation_supported: false,
      rollback_supported: false,
      restore_supported: false,
      persistence_supported: false,
      telemetry_writes_supported: false,
      auto_approval_supported: false,
      voice_only_approval_supported: false,
      approval_inheritance_supported: false,
      cross_session_approval_persistence_supported: false,
      multi_step_execution_graphs_supported: false,
    });
    expect(
      ApprovalRuntimePhase18FinalCloseoutGuardSchema.safeParse(
        DEFAULT_APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_GUARD,
      ).success,
    ).toBe(true);
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_GUARD.foundations_closed,
    ).toEqual(APPROVAL_RUNTIME_PHASE_18_CLOSEOUT_FOUNDATIONS);
  });

  it("proves Phase 18A through 18H integration foundations exist", () => {
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18A.6");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18B.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18C.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18D.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18E.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18F.4");
    expect(
      DEFAULT_APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_GUARD.closeout_slice,
    ).toBe("18G.4");
    expect(DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT.slice).toBe("18H.1");
    expect(
      DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX.slice,
    ).toBe("18H.2");
  });

  it("keeps the integrated lifecycle complete and status-inert", () => {
    const snapshot = integratedSnapshot();

    expect(snapshot.segment_metadata.map((segment) => segment.segment)).toEqual(
      APPROVAL_LIFECYCLE_INTEGRATION_SEGMENTS,
    );
    expect(APPROVAL_LIFECYCLE_INTEGRATION_STATUSES).toEqual([
      "unavailable",
      "metadata_assembled",
      "blocked",
      "invalid",
      "expired",
      "incomplete",
    ]);
    expect(APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES).toEqual([
      "active",
      "running",
      "executed",
      "verified",
      "compensated",
      "completed",
    ]);

    for (const status of APPROVAL_LIFECYCLE_INTEGRATION_FORBIDDEN_STATUSES) {
      expect(APPROVAL_LIFECYCLE_INTEGRATION_STATUSES).not.toContain(
        status as never,
      );
      expect(
        validateApprovalLifecycleIntegrationSnapshotShape({ status }),
      ).toMatchObject({
        valid: false,
        reason: "forbidden_integrated_lifecycle_status",
        metadata_only: true,
        action_executed: false,
        dispatch_performed: false,
        real_verification_performed: false,
        real_compensation_performed: false,
      });
    }
  });

  it("keeps every proposal kind approval-gated, dry-run-required, and disabled", () => {
    for (const proposalKind of DEFAULT_APPROVAL_PROPOSAL_METADATA_REGISTRY.proposal_kinds) {
      expect(proposalKind).toMatchObject({
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

  it("keeps authority tokens inert, single-action only, non-renewable, and fixed-expiry", () => {
    expect(DEFAULT_APPROVAL_EXECUTION_AUTHORITY_TOKEN_CONTRACT).toMatchObject({
      metadata_only: true,
      non_authoritative: true,
      non_executing: true,
      usable_authority_supported: false,
      approval_creation_supported: false,
      execution_supported: false,
      dispatch_supported: false,
      token_signing_supported: false,
      disabled_use_flags: {
        authority_granted: false,
        execution_enabled: false,
        dispatch_enabled: false,
        usable_authority_enabled: false,
        active_token_enabled: false,
        token_signing_enabled: false,
      },
    });
    expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES).toEqual([
      "unavailable",
      "reserved",
      "expired",
      "revoked",
      "invalid",
    ]);
    expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES).toEqual([
      "usable",
      "active",
      "granted",
      "executable",
    ]);
    for (const status of APPROVAL_EXECUTION_AUTHORITY_TOKEN_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_AUTHORITY_TOKEN_STATUSES).not.toContain(
        status as never,
      );
    }

    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_SCOPE_GUARD_CONTRACT.constraints,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_key: "single_action_only",
          expected_value: true,
        }),
        expect.objectContaining({
          constraint_key: "cross_session_valid",
          expected_value: false,
        }),
        expect.objectContaining({
          constraint_key: "multi_step_graph_allowed",
          expected_value: false,
        }),
        expect.objectContaining({
          constraint_key: "voice_grant_allowed",
          expected_value: false,
        }),
        expect.objectContaining({
          constraint_key: "auto_grant_allowed",
          expected_value: false,
        }),
      ]),
    );
    expect(
      DEFAULT_APPROVAL_EXECUTION_AUTHORITY_EXPIRY_CONTRACT.policy,
    ).toMatchObject({
      default_expiry_ms: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS,
      max_expiry_ms: APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS,
      cross_session_valid: false,
      renewal_allowed: false,
      refresh_allowed: false,
      indefinite_authority_allowed: false,
      background_expiry_extension_allowed: false,
      voice_extension_allowed: false,
      scheduler_extension_allowed: false,
      network_extension_allowed: false,
    });
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_DEFAULT_MS).toBe(300_000);
    expect(APPROVAL_EXECUTION_AUTHORITY_EXPIRY_MAX_MS).toBe(300_000);
    expect(
      evaluateApprovalAuthorityExpiryMetadataShape({
        expiry_window_ms: 300_001,
      }),
    ).toMatchObject({
      passed: false,
      expiry_reason: "expired_by_policy",
      extension_enabled: false,
      renewal_enabled: false,
      refresh_enabled: false,
      authority_granted: false,
      execution_enabled: false,
      dispatch_enabled: false,
    });
  });

  it("keeps decision records, execution plans, verification, and compensation metadata-only", () => {
    expect(decisionRecord()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      creates_approval: false,
      handles_approval_decision: false,
      performs_lifecycle_transition: false,
      persisted: false,
      telemetry_written: false,
      disabled_authority_flags: {
        lifecycle_advancement_enabled: false,
        authority_grant_enabled: false,
        token_issue_enabled: false,
        execution_enabled: false,
        dispatch_enabled: false,
        persistence_enabled: false,
        telemetry_write_enabled: false,
      },
    });
    expect(DEFAULT_APPROVAL_EXECUTION_PLAN_CONTRACT).toMatchObject({
      metadata_only: true,
      execution_plan_shape_only: true,
      executable_plan_status_supported: false,
      executable_step_handlers_supported: false,
    });
    expect(APPROVAL_EXECUTION_PLAN_STATUSES).toEqual([
      "unavailable",
      "draft",
      "dry_run_required",
      "blocked",
      "invalid",
      "expired",
    ]);
    for (const status of APPROVAL_EXECUTION_PLAN_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_PLAN_STATUSES).not.toContain(status as never);
    }
    expect(executionPlan()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      status_enables_execution: false,
      dry_run_metadata: {
        dry_run_required: true,
        dry_run_execution_enabled: false,
        dry_run_dispatch_enabled: false,
      },
    });
    expect(executionPlan().step_metadata[0]).toMatchObject({
      dry_run_required: true,
      execution_enabled: false,
      dispatch_enabled: false,
    });

    expect(DEFAULT_APPROVAL_EXECUTION_VERIFICATION_CONTRACT).toMatchObject({
      metadata_only: true,
      verification_shape_only: true,
      real_verification_supported: false,
      real_state_reads_supported: false,
    });
    expect(APPROVAL_EXECUTION_VERIFICATION_STATUSES).toEqual([
      "unavailable",
      "pending_metadata_only",
      "blocked",
      "invalid",
      "expired",
      "not_performed",
    ]);
    expect(APPROVAL_EXECUTION_VERIFICATION_METHODS).toEqual([
      "state_diff_metadata",
      "dry_run_comparison_metadata",
      "audit_trace_metadata",
      "manual_review_metadata",
    ]);
    for (const status of APPROVAL_EXECUTION_VERIFICATION_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_VERIFICATION_STATUSES).not.toContain(
        status as never,
      );
    }
    expect(verificationMetadata()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      real_state_read_performed: false,
      disabled_authority_flags: {
        verification_enabled: false,
        real_state_read_enabled: false,
      },
    });

    expect(DEFAULT_APPROVAL_EXECUTION_COMPENSATION_CONTRACT).toMatchObject({
      metadata_only: true,
      compensation_shape_only: true,
      real_compensation_supported: false,
      rollback_supported: false,
      restore_supported: false,
    });
    expect(APPROVAL_EXECUTION_COMPENSATION_STATUSES).toEqual([
      "unavailable",
      "hint_only",
      "blocked",
      "invalid",
      "expired",
      "not_performed",
    ]);
    for (const status of APPROVAL_EXECUTION_COMPENSATION_FORBIDDEN_STATUSES) {
      expect(APPROVAL_EXECUTION_COMPENSATION_STATUSES).not.toContain(
        status as never,
      );
    }
    expect(compensationMetadata()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      real_state_read_performed: false,
      disabled_authority_flags: {
        compensation_enabled: false,
        rollback_enabled: false,
        restore_enabled: false,
      },
    });
  });

  it("proves integrated lifecycle validation rejects unsafe metadata", () => {
    expect(
      validateApprovalLifecycleIntegrationPolicyMetadata(integratedSnapshot()),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guard_id: "all_required_lifecycle_segments_present",
          passed: true,
        }),
        expect.objectContaining({
          guard_id: "execution_disabled",
          passed: true,
        }),
        expect.objectContaining({
          guard_id: "real_state_read_disabled",
          passed: true,
        }),
      ]),
    );

    expect(
      validateApprovalLifecycleIntegrationPolicyMetadata(
        integratedSnapshot({
          status: "running",
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guard_id: "operational_lifecycle_status_rejected",
          passed: false,
          reason_code: "operational_lifecycle_status",
        }),
      ]),
    );

    expect(
      validateApprovalLifecycleIntegrationPolicyMetadata(
        integratedSnapshot({
          disabled_authority_flags: {
            ...integratedSnapshot().disabled_authority_flags,
            execution_enabled: true,
          },
          action_executed: true,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guard_id: "execution_disabled",
          passed: false,
          reason_code: "execution_enabled",
        }),
      ]),
    );

    expect(
      validateApprovalLifecycleIntegrationPolicyMetadata(
        integratedSnapshot({
          raw_state: "unsafe",
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guard_id: "raw_state_forbidden",
          passed: false,
          reason_code: "raw_state_present",
        }),
      ]),
    );
  });

  it("keeps final lifecycle surfaces raw-free, replay-safe, and redaction-safe", () => {
    const surfaces = [
      DEFAULT_APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_GUARD,
      DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT,
      DEFAULT_APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_POLICY_MATRIX,
      proposal(),
      authorityToken(),
      executionPlan(),
      verificationMetadata(),
      compensationMetadata(),
      compensationAuditPreview(),
      integratedSnapshot(),
      validateApprovalLifecycleIntegrationPolicyMetadata(integratedSnapshot()),
    ];

    assertNoRawKeys(surfaces);
    for (const surface of surfaces) {
      if (
        surface &&
        typeof surface === "object" &&
        "metadata_only" in surface
      ) {
        expect(
          (surface as { readonly metadata_only?: unknown }).metadata_only,
        ).toBe(true);
      }
      assertKnownOperationalFieldsFalse(surface);
    }
    expect(integratedSnapshot()).toMatchObject({
      metadata_only: true,
      replay_safe: true,
      redaction_safe: true,
      raw_payload_included: false,
      raw_tool_arguments_included: false,
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_device_payload_included: false,
      raw_project_content_included: false,
      raw_memory_content_included: false,
      raw_state_included: false,
      secret_material_included: false,
    });
  });

  it("public exports expose no operational function names", () => {
    const exportedFunctionNames = Object.entries(approvalRuntime)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
