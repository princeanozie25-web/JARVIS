import type { HueDryRunPlan } from "./hue-dry-run";

export type HueExecutionApprovalStatus =
  | "missing"
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "unsupported";

export type HueExecutionBoundaryDenialReason =
  | "approval_missing"
  | "approval_pending"
  | "approval_denied"
  | "approval_expired"
  | "approval_unsupported"
  | "execution_not_implemented";

export type HueExecutionCompensationPreconditionStatus =
  | "satisfied"
  | "unavailable"
  | "unsupported";

export type HueExecutionCompensationPreconditionReason =
  | "dry_run_compensation_available"
  | "dry_run_compensation_unavailable"
  | "compensation_execution_unsupported";

export interface HueExecutionApprovalMetadata {
  readonly approval_id?: string | null;
  readonly approval_status?: HueExecutionApprovalStatus;
  readonly reviewed_at_ms?: number | null;
  readonly metadata_only?: true;
}

export interface HueExecutionExpectedPostState {
  readonly target_light_id: string;
  readonly derived_from: "intended_dry_run_state";
  readonly intended_state: HueDryRunPlan["intended_state"];
  readonly metadata_only: true;
  readonly raw_payload_exposed: false;
}

export interface HueExecutionActualPostState {
  readonly status: "unavailable";
  readonly reason: "execution_not_performed";
  readonly metadata_only: true;
  readonly raw_payload_exposed: false;
}

export interface HueExecutionBoundaryProvenance {
  readonly execution_boundary_id: string;
  readonly source_plan_id: string;
  readonly adapter_kind: "hue";
  readonly mode: "approval_gated_execution";
  readonly target_light_id: string;
  readonly approval_status: HueExecutionApprovalStatus;
  readonly verification_required: true;
  readonly metadata_only: true;
}

export interface HueExecutionBoundaryDecision {
  readonly execution_boundary_id: string;
  readonly source_plan_id: string;
  readonly adapter_kind: "hue";
  readonly mode: "approval_gated_execution";
  readonly approval_required: true;
  readonly approval_id: string | null;
  readonly approval_status: HueExecutionApprovalStatus;
  readonly execution_allowed: false;
  readonly execution_supported: false;
  readonly denial_reason: HueExecutionBoundaryDenialReason;
  readonly verification_required: true;
  readonly verification_supported: false;
  readonly verification_read_required_after_execution: true;
  readonly verification_source: "future_hue_read_only";
  readonly verification_status: "unsupported";
  readonly verification_reason: "execution_not_implemented";
  readonly verification_error_class: "verification_not_implemented";
  readonly expected_post_state: HueExecutionExpectedPostState;
  readonly actual_post_state: HueExecutionActualPostState;
  readonly verification_network_allowed: false;
  readonly verification_persistence_supported: false;
  readonly verification_read_performed: false;
  readonly verification_persisted: false;
  readonly audit_required: true;
  readonly audit_supported: false;
  readonly audit_payload_kind: "metadata_only";
  readonly replay_safe: true;
  readonly redaction_status: "redacted_metadata_only";
  readonly provenance: HueExecutionBoundaryProvenance;
  readonly persistence_attempted: false;
  readonly event_store_write_supported: false;
  readonly event_store_write_attempted: false;
  readonly compensation_required_if_executed: true;
  readonly compensation_available_from_plan: boolean;
  readonly compensation_source: "dry_run_plan" | "unavailable";
  readonly compensation_execution_supported: false;
  readonly compensation_execution_attempted: false;
  readonly compensation_requires_approval: boolean;
  readonly compensation_precondition_status: HueExecutionCompensationPreconditionStatus;
  readonly compensation_precondition_reason: HueExecutionCompensationPreconditionReason;
  readonly compensation_precondition_error_class:
    | "compensation_unavailable"
    | null;
  readonly network_allowed: false;
  readonly writes_allowed: false;
  readonly discovery_allowed: false;
  readonly cloud_allowed: false;
  readonly raw_payload_exposed: false;
  readonly raw_config_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly dry_run_plan_executable: false;
  readonly dry_run_execution_supported: false;
  readonly metadata_only: true;
  readonly network_called: false;
  readonly writes_attempted: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly ui_rendered: false;
}

export interface HueExecutionAuditPreview {
  readonly preview_kind: "hue_execution_audit_preview";
  readonly audit_required: true;
  readonly audit_supported: false;
  readonly audit_payload_kind: "metadata_only";
  readonly replay_safe: true;
  readonly redaction_status: "redacted_metadata_only";
  readonly provenance: HueExecutionBoundaryProvenance;
  readonly denial_reason: HueExecutionBoundaryDenialReason;
  readonly execution_allowed: false;
  readonly execution_supported: false;
  readonly verification_required: true;
  readonly verification_supported: false;
  readonly compensation_execution_supported: false;
  readonly compensation_execution_attempted: false;
  readonly compensation_available_from_plan: boolean;
  readonly compensation_precondition_status: HueExecutionCompensationPreconditionStatus;
  readonly raw_payload_exposed: false;
  readonly raw_config_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly persistence_attempted: false;
  readonly event_store_write_supported: false;
  readonly event_store_write_attempted: false;
  readonly network_called: false;
  readonly writes_attempted: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly hardware_io_performed: false;
  readonly ui_rendered: false;
  readonly metadata_only: true;
}

export function evaluateHueExecutionBoundary(
  dryRunPlan: HueDryRunPlan,
  approvalMetadata?: HueExecutionApprovalMetadata | null,
): HueExecutionBoundaryDecision {
  const approvalStatus = approvalMetadata?.approval_status ?? "missing";
  const executionBoundaryId = `hue-execution-boundary-${sanitizeId(dryRunPlan.plan_id)}`;
  const compensationAvailable = dryRunPlan.compensation.compensation_available;
  const provenance: HueExecutionBoundaryProvenance = {
    execution_boundary_id: executionBoundaryId,
    source_plan_id: dryRunPlan.plan_id,
    adapter_kind: "hue",
    mode: "approval_gated_execution",
    target_light_id: dryRunPlan.target_light_id,
    approval_status: approvalStatus,
    verification_required: true,
    metadata_only: true,
  };

  return {
    execution_boundary_id: executionBoundaryId,
    source_plan_id: dryRunPlan.plan_id,
    adapter_kind: "hue",
    mode: "approval_gated_execution",
    approval_required: true,
    approval_id: approvalMetadata?.approval_id ?? null,
    approval_status: approvalStatus,
    execution_allowed: false,
    execution_supported: false,
    denial_reason: denialReasonFor(approvalStatus),
    verification_required: true,
    verification_supported: false,
    verification_read_required_after_execution: true,
    verification_source: "future_hue_read_only",
    verification_status: "unsupported",
    verification_reason: "execution_not_implemented",
    verification_error_class: "verification_not_implemented",
    expected_post_state: {
      target_light_id: dryRunPlan.target_light_id,
      derived_from: "intended_dry_run_state",
      intended_state: dryRunPlan.intended_state,
      metadata_only: true,
      raw_payload_exposed: false,
    },
    actual_post_state: {
      status: "unavailable",
      reason: "execution_not_performed",
      metadata_only: true,
      raw_payload_exposed: false,
    },
    verification_network_allowed: false,
    verification_persistence_supported: false,
    verification_read_performed: false,
    verification_persisted: false,
    audit_required: true,
    audit_supported: false,
    audit_payload_kind: "metadata_only",
    replay_safe: true,
    redaction_status: "redacted_metadata_only",
    provenance,
    persistence_attempted: false,
    event_store_write_supported: false,
    event_store_write_attempted: false,
    compensation_required_if_executed: true,
    compensation_available_from_plan: compensationAvailable,
    compensation_source: compensationAvailable ? "dry_run_plan" : "unavailable",
    compensation_execution_supported: false,
    compensation_execution_attempted: false,
    compensation_requires_approval:
      dryRunPlan.compensation.compensation_requires_approval,
    compensation_precondition_status: compensationAvailable
      ? "satisfied"
      : "unavailable",
    compensation_precondition_reason: compensationAvailable
      ? "dry_run_compensation_available"
      : "dry_run_compensation_unavailable",
    compensation_precondition_error_class: compensationAvailable
      ? null
      : "compensation_unavailable",
    network_allowed: false,
    writes_allowed: false,
    discovery_allowed: false,
    cloud_allowed: false,
    raw_payload_exposed: false,
    raw_config_exposed: false,
    raw_api_key_exposed: false,
    dry_run_plan_executable: false,
    dry_run_execution_supported: false,
    metadata_only: true,
    network_called: false,
    writes_attempted: false,
    discovery_attempted: false,
    cloud_attempted: false,
    hardware_io_performed: false,
    persisted: false,
    ui_rendered: false,
  };
}

export function buildHueExecutionAuditPreview(
  decision: HueExecutionBoundaryDecision,
): HueExecutionAuditPreview {
  return {
    preview_kind: "hue_execution_audit_preview",
    audit_required: true,
    audit_supported: false,
    audit_payload_kind: "metadata_only",
    replay_safe: true,
    redaction_status: "redacted_metadata_only",
    provenance: decision.provenance,
    denial_reason: decision.denial_reason,
    execution_allowed: false,
    execution_supported: false,
    verification_required: true,
    verification_supported: false,
    compensation_execution_supported: false,
    compensation_execution_attempted: false,
    compensation_available_from_plan: decision.compensation_available_from_plan,
    compensation_precondition_status: decision.compensation_precondition_status,
    raw_payload_exposed: false,
    raw_config_exposed: false,
    raw_api_key_exposed: false,
    persistence_attempted: false,
    event_store_write_supported: false,
    event_store_write_attempted: false,
    network_called: false,
    writes_attempted: false,
    discovery_attempted: false,
    cloud_attempted: false,
    hardware_io_performed: false,
    ui_rendered: false,
    metadata_only: true,
  };
}

function denialReasonFor(
  status: HueExecutionApprovalStatus,
): HueExecutionBoundaryDenialReason {
  switch (status) {
    case "missing":
      return "approval_missing";
    case "pending":
      return "approval_pending";
    case "denied":
      return "approval_denied";
    case "expired":
      return "approval_expired";
    case "unsupported":
      return "approval_unsupported";
    case "approved":
      return "execution_not_implemented";
  }
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._:-]/g, "-");
}
