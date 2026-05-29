import { z } from "zod";

import { APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION } from "./proposal-inbox";
import { APPROVAL_REVIEW_DECISION_CONTRACT_VERSION } from "./review-decision";
import { APPROVAL_REVIEW_SESSION_CONTRACT_VERSION } from "./review-session";
import { APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION } from "./phase-18a-closeout";

export const APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION = "18B.4" as const;

export const APPROVAL_RUNTIME_PHASE_18B_SLICES = [
  "18B.1",
  "18B.2",
  "18B.3",
  "18B.4",
] as const;

export const ApprovalRuntimePhase18BCloseoutGuardSchema = z.strictObject({
  phase: z.literal(18),
  closeout_slice: z.literal(APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION),
  closeout_id: z.literal("approval_runtime_phase_18b_closeout_guard"),
  phase_18a_foundation_closeout_version: z.literal(
    APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
  ),
  proposal_inbox_contract_version: z.literal(
    APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION,
  ),
  review_decision_contract_version: z.literal(
    APPROVAL_REVIEW_DECISION_CONTRACT_VERSION,
  ),
  review_session_contract_version: z.literal(
    APPROVAL_REVIEW_SESSION_CONTRACT_VERSION,
  ),
  slices_closed: z.array(z.enum(APPROVAL_RUNTIME_PHASE_18B_SLICES)),
  metadata_only: z.literal(true),
  review_only: z.literal(true),
  non_executing: z.literal(true),
  non_authoritative: z.literal(true),
  replay_safe: z.literal(true),
  redaction_safe: z.literal(true),
  local_first: z.literal(true),
  approval_creation_supported: z.literal(false),
  approval_decision_handling_supported: z.literal(false),
  approve_deny_handlers_supported: z.literal(false),
  lifecycle_state_advancement_supported: z.literal(false),
  execution_supported: z.literal(false),
  dispatch_supported: z.literal(false),
  authority_grant_supported: z.literal(false),
  verification_supported: z.literal(false),
  compensation_supported: z.literal(false),
  rollback_supported: z.literal(false),
  persistence_supported: z.literal(false),
  event_store_writes_supported: z.literal(false),
  telemetry_writes_supported: z.literal(false),
  ui_rendering_supported: z.literal(false),
  api_routes_supported: z.literal(false),
  tool_runtime_wiring_supported: z.literal(false),
  room_adapter_wiring_supported: z.literal(false),
  project_mutation_supported: z.literal(false),
  obsidian_write_supported: z.literal(false),
  memory_write_supported: z.literal(false),
  scheduler_triggered_action_supported: z.literal(false),
  network_cloud_calls_supported: z.literal(false),
  voice_only_approval_supported: z.literal(false),
});

export type ApprovalRuntimePhase18BCloseoutGuard = z.infer<
  typeof ApprovalRuntimePhase18BCloseoutGuardSchema
>;

export const DEFAULT_APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_GUARD =
  ApprovalRuntimePhase18BCloseoutGuardSchema.parse({
    phase: 18,
    closeout_slice: APPROVAL_RUNTIME_PHASE_18B_CLOSEOUT_VERSION,
    closeout_id: "approval_runtime_phase_18b_closeout_guard",
    phase_18a_foundation_closeout_version:
      APPROVAL_RUNTIME_PHASE_18A_CLOSEOUT_VERSION,
    proposal_inbox_contract_version: APPROVAL_PROPOSAL_INBOX_CONTRACT_VERSION,
    review_decision_contract_version: APPROVAL_REVIEW_DECISION_CONTRACT_VERSION,
    review_session_contract_version: APPROVAL_REVIEW_SESSION_CONTRACT_VERSION,
    slices_closed: APPROVAL_RUNTIME_PHASE_18B_SLICES,
    metadata_only: true,
    review_only: true,
    non_executing: true,
    non_authoritative: true,
    replay_safe: true,
    redaction_safe: true,
    local_first: true,
    approval_creation_supported: false,
    approval_decision_handling_supported: false,
    approve_deny_handlers_supported: false,
    lifecycle_state_advancement_supported: false,
    execution_supported: false,
    dispatch_supported: false,
    authority_grant_supported: false,
    verification_supported: false,
    compensation_supported: false,
    rollback_supported: false,
    persistence_supported: false,
    event_store_writes_supported: false,
    telemetry_writes_supported: false,
    ui_rendering_supported: false,
    api_routes_supported: false,
    tool_runtime_wiring_supported: false,
    room_adapter_wiring_supported: false,
    project_mutation_supported: false,
    obsidian_write_supported: false,
    memory_write_supported: false,
    scheduler_triggered_action_supported: false,
    network_cloud_calls_supported: false,
    voice_only_approval_supported: false,
  });
