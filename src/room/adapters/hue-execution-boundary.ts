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
  readonly compensation_required_if_executed: true;
  readonly network_allowed: false;
  readonly writes_allowed: false;
  readonly discovery_allowed: false;
  readonly cloud_allowed: false;
  readonly raw_payload_exposed: false;
  readonly raw_config_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly dry_run_plan_executable: false;
  readonly dry_run_execution_supported: false;
  readonly compensation_execution_supported: false;
  readonly metadata_only: true;
  readonly network_called: false;
  readonly writes_attempted: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly ui_rendered: false;
}

export function evaluateHueExecutionBoundary(
  dryRunPlan: HueDryRunPlan,
  approvalMetadata?: HueExecutionApprovalMetadata | null,
): HueExecutionBoundaryDecision {
  const approvalStatus = approvalMetadata?.approval_status ?? "missing";

  return {
    execution_boundary_id: `hue-execution-boundary-${sanitizeId(dryRunPlan.plan_id)}`,
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
    compensation_required_if_executed: true,
    network_allowed: false,
    writes_allowed: false,
    discovery_allowed: false,
    cloud_allowed: false,
    raw_payload_exposed: false,
    raw_config_exposed: false,
    raw_api_key_exposed: false,
    dry_run_plan_executable: false,
    dry_run_execution_supported: false,
    compensation_execution_supported:
      dryRunPlan.compensation.compensation_execution_supported,
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
