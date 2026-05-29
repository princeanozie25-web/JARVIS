import { z } from "zod";

import { APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION } from "./audit-preview";
import { APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION } from "./authority-boundary";
import { APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION } from "./proposal-registry";
import { APPROVAL_RUNTIME_CONTRACT_VERSION } from "./contracts";
import { APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION } from "./validation-guards";

export const APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION = "18A.6" as const;

export const APPROVAL_RUNTIME_PHASE_18A_SLICES = [
  "18A.1",
  "18A.2",
  "18A.3",
  "18A.4",
  "18A.5",
  "18A.6",
] as const;

export const ApprovalRuntimePhase18ACloseoutGuardSchema = z.strictObject({
  phase: z.literal(18),
  closeout_slice: z.literal(APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION),
  closeout_id: z.literal("approval_runtime_phase_18a_closeout_guard"),
  lifecycle_contract_version: z.literal(APPROVAL_RUNTIME_CONTRACT_VERSION),
  authority_boundary_contract_version: z.literal(
    APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION,
  ),
  proposal_registry_contract_version: z.literal(
    APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION,
  ),
  validation_guard_contract_version: z.literal(
    APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION,
  ),
  audit_preview_contract_version: z.literal(
    APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION,
  ),
  slices_closed: z.array(z.enum(APPROVAL_RUNTIME_PHASE_18A_SLICES)),
  metadata_only: z.literal(true),
  non_executing: z.literal(true),
  non_authoritative: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  local_first: z.literal(true),
  contract_foundation_only: z.literal(true),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  lifecycle_state_advancement_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  ui_wiring_supported: z.literal(false),
  tool_runtime_wiring_supported: z.literal(false),
  room_adapter_wiring_supported: z.literal(false),
  project_mutation_supported: z.literal(false),
  obsidian_write_supported: z.literal(false),
  memory_write_supported: z.literal(false),
  scheduler_triggered_creation_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
});

export type ApprovalRuntimePhase18ACloseoutGuard = z.infer<
  typeof ApprovalRuntimePhase18ACloseoutGuardSchema
>;

export const DEFAULT_APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_GUARD =
  ApprovalRuntimePhase18ACloseoutGuardSchema.parse({
    phase: 18,
    closeout_slice: APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
    closeout_id: "approval_runtime_phase_18a_closeout_guard",
    lifecycle_contract_version: APPROVAL_RUNTIME_CONTRACT_VERSION,
    authority_boundary_contract_version:
      APPROVAL_AUTHORITY_BOUNDARY_CONTRACT_VERSION,
    proposal_registry_contract_version:
      APPROVAL_PROPOSAL_REGISTRY_CONTRACT_VERSION,
    validation_guard_contract_version:
      APPROVAL_VALIDATION_GUARD_CONTRACT_VERSION,
    audit_preview_contract_version: APPROVAL_AUDIT_PREVIEW_CONTRACT_VERSION,
    slices_closed: APPROVAL_RUNTIME_PHASE_18A_SLICES,
    metadata_only: true,
    non_executing: true,
    non_authoritative: true,
    replay_safe: true,
    redaction_safe: true,
    local_first: true,
    contract_foundation_only: true,
    execution_supported: false,
    dispatch_supported: false,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    authority_grant_supported: false,
    lifecycle_state_advancement_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_wiring_supported: false,
    tool_runtime_wiring_supported: false,
    room_adapter_wiring_supported: false,
    project_mutation_supported: false,
    obsidian_write_supported: false,
    memory_write_supported: false,
    scheduler_triggered_creation_supported: false,
    network_cloud_calls_supported: false,
  });
