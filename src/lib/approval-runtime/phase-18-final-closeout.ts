import { z } from "zod";

import { APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION } from "./approval-lifecycle-integration";
import { APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_CONTRACT_VERSION } from "./approval-lifecycle-integration-validation";
import { APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION } from "./phase-18a-closeout";
import { APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION } from "./phase-18b-closeout";
import { APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION } from "./phase-18c-closeout";
import { APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION } from "./phase-18d-closeout";
import { APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION } from "./phase-18e-closeout";
import { APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION } from "./phase-18f-closeout";
import { APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION } from "./phase-18g-closeout";

export const APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_VERSION =
  "18H.3" as const;

export const APPROVAL_RUNTIME_PHASE_18_CLOSEOUT_FOUNDATIONS = [
  "18A.6",
  "18B.4",
  "18C.4",
  "18D.4",
  "18E.4",
  "18F.4",
  "18G.4",
  "18H.1",
  "18H.2",
  "18H.3",
] as const;

export const ApprovalRuntimePhase18FinalCloseoutGuardSchema = z.strictObject({
  phase: z.literal(18),
  closeout_slice: z.literal(APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_VERSION),
  closeout_id: z.literal("approval_runtime_phase_18_final_closeout_guard"),
  phase_18a_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
  ),
  phase_18b_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
  ),
  phase_18c_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
  ),
  phase_18d_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
  ),
  phase_18e_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
  ),
  phase_18f_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION,
  ),
  phase_18g_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION,
  ),
  lifecycle_integration_contract_version: z.literal(
    APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION,
  ),
  lifecycle_integration_validation_contract_version: z.literal(
    APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_CONTRACT_VERSION,
  ),
  foundations_closed: z.array(
    z.enum(APPROVAL_RUNTIME_PHASE_18_CLOSEOUT_FOUNDATIONS),
  ),
  metadata_only: z.literal(true),
  approval_gated_execution_layer_complete: z.literal(true),
  governed_lifecycle_foundation: z.literal(true),
  approval_only_authority_boundary: z.literal(true),
  no_unapproved_execution_path: z.literal(true),
  inert: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  local_first: z.literal(true),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  token_grant_supported: z.literal(false),
  usable_token_supported: z.literal(false),
  active_token_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  tool_calls_supported: z.literal(false),
  room_actions_supported: z.literal(false),
  project_mutation_supported: z.literal(false),
  obsidian_write_supported: z.literal(false),
  memory_write_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
  real_verification_supported: z.literal(false),
  real_state_reads_supported: z.literal(false),
  real_compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  restore_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  write_telemetry_supported: z.literal(false),
  runtime_wiring_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  scheduler_triggered_action_supported: z.literal(false),
  auto_approval_supported: z.literal(false),
  voice_only_approval_supported: z.literal(false),
  approval_inheritance_supported: z.literal(false),
  cross_session_approval_persistence_supported: z.literal(false),
  multi_step_execution_graphs_supported: z.literal(false),
});

export type ApprovalRuntimePhase18FinalCloseoutGuard = z.infer<
  typeof ApprovalRuntimePhase18FinalCloseoutGuardSchema
>;

export const DEFAULT_APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_GUARD =
  ApprovalRuntimePhase18FinalCloseoutGuardSchema.parse({
    phase: 18,
    closeout_slice: APPROVAL_RUNTIME_PHASE_18_FINAL_CLOSEOUT_VERSION,
    closeout_id: "approval_runtime_phase_18_final_closeout_guard",
    phase_18a_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
    phase_18b_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
    phase_18c_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
    phase_18d_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
    phase_18e_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
    phase_18f_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18F_CLOSEOUT_VERSION,
    phase_18g_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18G_CLOSEOUT_VERSION,
    lifecycle_integration_contract_version:
      APPROVAL_LIFECYCLE_INTEGRATION_CONTRACT_VERSION,
    lifecycle_integration_validation_contract_version:
      APPROVAL_LIFECYCLE_INTEGRATION_VALIDATION_CONTRACT_VERSION,
    foundations_closed: APPROVAL_RUNTIME_PHASE_18_CLOSEOUT_FOUNDATIONS,
    metadata_only: true,
    approval_gated_execution_layer_complete: true,
    governed_lifecycle_foundation: true,
    approval_only_authority_boundary: true,
    no_unapproved_execution_path: true,
    inert: true,
    replay_safe: true,
    redaction_safe: true,
    local_first: true,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    token_grant_supported: false,
    usable_token_supported: false,
    active_token_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    room_actions_supported: false,
    project_mutation_supported: false,
    obsidian_write_supported: false,
    memory_write_supported: false,
    network_cloud_calls_supported: false,
    real_verification_supported: false,
    real_state_reads_supported: false,
    real_compensation_supported: false,
    rollback_supported: false,
    restore_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    write_telemetry_supported: false,
    runtime_wiring_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    scheduler_triggered_action_supported: false,
    auto_approval_supported: false,
    voice_only_approval_supported: false,
    approval_inheritance_supported: false,
    cross_session_approval_persistence_supported: false,
    multi_step_execution_graphs_supported: false,
  });
