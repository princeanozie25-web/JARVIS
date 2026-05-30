import { z } from "zod";

import { APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_CONTRACT_VERSION } from "./execution-plan-audit-preview";
import { APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION } from "./execution-plan";
import { APPROVAL_EXECUTION_PLAN_VALIDATION_CONTRACT_VERSION } from "./execution-plan-validation";
import { APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION } from "./phase-18a-closeout";
import { APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION } from "./phase-18b-closeout";
import { APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION } from "./phase-18c-closeout";
import { APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION } from "./phase-18d-closeout";

export const APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION = "18E.4" as const;

export const APPROVAL_RUNTIME_PHASE_18E_SLICES = [
  "18E.1",
  "18E.2",
  "18E.3",
  "18E.4",
] as const;

export const ApprovalRuntimePhase18ECloseoutGuardSchema = z.strictObject({
  phase: z.literal(18),
  closeout_slice: z.literal(APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION),
  closeout_id: z.literal("approval_runtime_phase_18e_closeout_guard"),
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
  execution_plan_contract_version: z.literal(
    APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION,
  ),
  execution_plan_validation_contract_version: z.literal(
    APPROVAL_EXECUTION_PLAN_VALIDATION_CONTRACT_VERSION,
  ),
  execution_plan_audit_preview_contract_version: z.literal(
    APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_CONTRACT_VERSION,
  ),
  slices_closed: z.array(z.enum(APPROVAL_RUNTIME_PHASE_18E_SLICES)),
  metadata_only: z.literal(true),
  execution_planning_layer_only: z.literal(true),
  inert: z.literal(true),
  non_executing: z.literal(true),
  non_dispatching: z.literal(true),
  non_authoritative: z.literal(true),
  non_persistent: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  local_first: z.literal(true),
  executable_plan_status_supported: z.literal(false),
  executable_step_handlers_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  tool_calls_supported: z.literal(false),
  room_actions_supported: z.literal(false),
  project_mutation_supported: z.literal(false),
  obsidian_write_supported: z.literal(false),
  memory_write_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  lifecycle_state_advancement_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  token_issue_supported: z.literal(false),
  token_grant_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  write_telemetry_supported: z.literal(false),
  runtime_wiring_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  scheduler_triggered_action_supported: z.literal(false),
});

export type ApprovalRuntimePhase18ECloseoutGuard = z.infer<
  typeof ApprovalRuntimePhase18ECloseoutGuardSchema
>;

export const DEFAULT_APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_GUARD =
  ApprovalRuntimePhase18ECloseoutGuardSchema.parse({
    phase: 18,
    closeout_slice: APPROVAL_RUNTIME_PHASE_18E_CLOSEOUT_VERSION,
    closeout_id: "approval_runtime_phase_18e_closeout_guard",
    phase_18a_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
    phase_18b_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
    phase_18c_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18C_CLOSEOUT_VERSION,
    phase_18d_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18D_CLOSEOUT_VERSION,
    execution_plan_contract_version: APPROVAL_EXECUTION_PLAN_CONTRACT_VERSION,
    execution_plan_validation_contract_version:
      APPROVAL_EXECUTION_PLAN_VALIDATION_CONTRACT_VERSION,
    execution_plan_audit_preview_contract_version:
      APPROVAL_EXECUTION_PLAN_AUDIT_PREVIEW_CONTRACT_VERSION,
    slices_closed: APPROVAL_RUNTIME_PHASE_18E_SLICES,
    metadata_only: true,
    execution_planning_layer_only: true,
    inert: true,
    non_executing: true,
    non_dispatching: true,
    non_authoritative: true,
    non_persistent: true,
    replay_safe: true,
    redaction_safe: true,
    local_first: true,
    executable_plan_status_supported: false,
    executable_step_handlers_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    tool_calls_supported: false,
    room_actions_supported: false,
    project_mutation_supported: false,
    obsidian_write_supported: false,
    memory_write_supported: false,
    network_cloud_calls_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    lifecycle_state_advancement_supported: false,
    authority_grant_supported: false,
    token_issue_supported: false,
    token_grant_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    write_telemetry_supported: false,
    runtime_wiring_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    scheduler_triggered_action_supported: false,
  });
