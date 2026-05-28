import type { HueReadLightSnapshot } from "./hue-read-mapper";

export type HueDryRunIntendedState = {
  readonly on?: boolean;
  readonly brightness_percent?: number;
  readonly color_hex?: string;
  readonly color_temperature_kelvin?: number;
};

export type HueDryRunDiffField =
  | "on"
  | "brightness_percent"
  | "color_hex"
  | "color_temperature_kelvin";

export type HueDryRunCurrentStateStatus =
  | "available"
  | "unavailable"
  | "unknown";

export interface HueDryRunDiffEntry {
  readonly field: HueDryRunDiffField;
  readonly current: boolean | number | string | null | "unknown";
  readonly intended: boolean | number | string | null;
  readonly changed: boolean | "unknown";
  readonly metadata_only: true;
}

export interface HueDryRunDiffSummary {
  readonly status: "diff_available" | "current_state_unknown";
  readonly changed_fields: readonly HueDryRunDiffField[];
  readonly unchanged_fields: readonly HueDryRunDiffField[];
  readonly unknown_fields: readonly HueDryRunDiffField[];
  readonly entries: readonly HueDryRunDiffEntry[];
  readonly metadata_only: true;
}

export interface HueDryRunPlan {
  readonly plan_id: string;
  readonly adapter_kind: "hue";
  readonly mode: "dry_run";
  readonly source: "local_hue_bridge";
  readonly target_light_id: string;
  readonly intended_state: HueDryRunIntendedState;
  readonly current_state_status: HueDryRunCurrentStateStatus;
  readonly current_state_snapshot: HueReadLightSnapshot | null;
  readonly current_state_unknown_reason:
    | "snapshot_missing"
    | "snapshot_unreachable"
    | "snapshot_unknown"
    | null;
  readonly diff_summary: HueDryRunDiffSummary;
  readonly approval_required: true;
  readonly approval_flow_available: false;
  readonly approval_execution_supported: false;
  readonly user_review_required: true;
  readonly expires_at_ms: number;
  readonly plan_summary: string;
  readonly redacted_summary: string;
  readonly risk_class: "device_mutation_requires_future_approval";
  readonly action_class: "single_light_state_change";
  readonly executable: false;
  readonly execution_supported: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
  readonly writes_attempted: false;
  readonly hardware_io_performed: false;
  readonly persisted: false;
  readonly ui_rendered: false;
  readonly raw_payload_exposed: false;
  readonly raw_config_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly metadata_only: true;
}

export interface CreateHueDryRunPlanInput {
  readonly plan_id?: string;
  readonly target_light_id: string;
  readonly intended_state: HueDryRunIntendedState;
  readonly current_state_snapshot?: HueReadLightSnapshot | null;
  readonly created_at_ms?: number;
  readonly ttl_ms?: number;
}

export interface HueDryRunApprovalSubmissionDecision {
  readonly allowed: false;
  readonly reason: "approval_execution_not_implemented";
  readonly plan_id: string;
  readonly approval_required: true;
  readonly approval_flow_available: false;
  readonly approval_execution_supported: false;
  readonly executable: false;
  readonly execution_supported: false;
  readonly metadata_only: true;
  readonly network_called: false;
  readonly writes_attempted: false;
}

export function createHueDryRunPlan(
  input: CreateHueDryRunPlanInput,
): HueDryRunPlan {
  const currentStatus = currentStateStatus(input.current_state_snapshot);
  const diff = createDiffSummary(
    input.intended_state,
    input.current_state_snapshot,
    currentStatus,
  );
  const planId =
    input.plan_id ??
    `hue-dry-run-${input.target_light_id.replace(/[^a-zA-Z0-9._:-]/g, "-")}`;

  return {
    plan_id: planId,
    adapter_kind: "hue",
    mode: "dry_run",
    source: "local_hue_bridge",
    target_light_id: input.target_light_id,
    intended_state: sanitizeIntendedState(input.intended_state),
    current_state_status: currentStatus,
    current_state_snapshot:
      currentStatus === "available"
        ? (input.current_state_snapshot ?? null)
        : null,
    current_state_unknown_reason: currentUnknownReason(
      input.current_state_snapshot,
      currentStatus,
    ),
    diff_summary: diff,
    approval_required: true,
    approval_flow_available: false,
    approval_execution_supported: false,
    user_review_required: true,
    expires_at_ms: (input.created_at_ms ?? 0) + (input.ttl_ms ?? 300_000),
    plan_summary: summarizePlan(input.target_light_id, diff),
    redacted_summary: summarizePlan(input.target_light_id, diff),
    risk_class: "device_mutation_requires_future_approval",
    action_class: "single_light_state_change",
    executable: false,
    execution_supported: false,
    network_called: false,
    discovery_attempted: false,
    cloud_attempted: false,
    writes_attempted: false,
    hardware_io_performed: false,
    persisted: false,
    ui_rendered: false,
    raw_payload_exposed: false,
    raw_config_exposed: false,
    raw_api_key_exposed: false,
    metadata_only: true,
  };
}

export function canSubmitHueDryRunPlanForApproval(
  plan: HueDryRunPlan,
): HueDryRunApprovalSubmissionDecision {
  return {
    allowed: false,
    reason: "approval_execution_not_implemented",
    plan_id: plan.plan_id,
    approval_required: true,
    approval_flow_available: false,
    approval_execution_supported: false,
    executable: false,
    execution_supported: false,
    metadata_only: true,
    network_called: false,
    writes_attempted: false,
  };
}

function createDiffSummary(
  intended: HueDryRunIntendedState,
  currentSnapshot: HueReadLightSnapshot | null | undefined,
  currentStatus: HueDryRunCurrentStateStatus,
): HueDryRunDiffSummary {
  const entries = diffFieldsFor(intended).map((field) =>
    createDiffEntry(field, intended, currentSnapshot, currentStatus),
  );
  const changedFields = entries
    .filter((entry) => entry.changed === true)
    .map((entry) => entry.field);
  const unchangedFields = entries
    .filter((entry) => entry.changed === false)
    .map((entry) => entry.field);
  const unknownFields = entries
    .filter((entry) => entry.changed === "unknown")
    .map((entry) => entry.field);

  return {
    status:
      currentStatus === "available"
        ? "diff_available"
        : "current_state_unknown",
    changed_fields: changedFields,
    unchanged_fields: unchangedFields,
    unknown_fields: unknownFields,
    entries,
    metadata_only: true,
  };
}

function createDiffEntry(
  field: HueDryRunDiffField,
  intended: HueDryRunIntendedState,
  currentSnapshot: HueReadLightSnapshot | null | undefined,
  currentStatus: HueDryRunCurrentStateStatus,
): HueDryRunDiffEntry {
  const intendedValue = intendedValueFor(field, intended) ?? null;
  const current =
    currentStatus === "available" && currentSnapshot
      ? currentValueFor(field, currentSnapshot)
      : "unknown";

  return {
    field,
    current,
    intended: intendedValue,
    changed: current === "unknown" ? "unknown" : current !== intendedValue,
    metadata_only: true,
  };
}

function currentStateStatus(
  currentSnapshot: HueReadLightSnapshot | null | undefined,
): HueDryRunCurrentStateStatus {
  if (!currentSnapshot) return "unknown";
  if (currentSnapshot.reachability === "reachable") return "available";
  if (currentSnapshot.reachability === "unreachable") return "unavailable";
  return "unknown";
}

function currentUnknownReason(
  currentSnapshot: HueReadLightSnapshot | null | undefined,
  status: HueDryRunCurrentStateStatus,
): HueDryRunPlan["current_state_unknown_reason"] {
  if (status === "available") return null;
  if (!currentSnapshot) return "snapshot_missing";
  if (status === "unavailable") return "snapshot_unreachable";
  return "snapshot_unknown";
}

function diffFieldsFor(intended: HueDryRunIntendedState): HueDryRunDiffField[] {
  return (
    [
      "on",
      "brightness_percent",
      "color_hex",
      "color_temperature_kelvin",
    ] as const
  ).filter((field) => intendedValueFor(field, intended) !== undefined);
}

function currentValueFor(
  field: HueDryRunDiffField,
  snapshot: HueReadLightSnapshot,
): boolean | number | string | null {
  switch (field) {
    case "on":
      return snapshot.on;
    case "brightness_percent":
      return snapshot.brightness_percent;
    case "color_hex":
      return snapshot.color_hex;
    case "color_temperature_kelvin":
      return snapshot.color_temperature_kelvin;
  }
}

function intendedValueFor(
  field: HueDryRunDiffField,
  intended: HueDryRunIntendedState,
): boolean | number | string | null | undefined {
  switch (field) {
    case "on":
      return intended.on;
    case "brightness_percent":
      return intended.brightness_percent;
    case "color_hex":
      return intended.color_hex;
    case "color_temperature_kelvin":
      return intended.color_temperature_kelvin;
  }
}

function sanitizeIntendedState(
  intended: HueDryRunIntendedState,
): HueDryRunIntendedState {
  return {
    ...(intended.on !== undefined ? { on: intended.on } : {}),
    ...(intended.brightness_percent !== undefined
      ? { brightness_percent: intended.brightness_percent }
      : {}),
    ...(intended.color_hex !== undefined
      ? { color_hex: intended.color_hex }
      : {}),
    ...(intended.color_temperature_kelvin !== undefined
      ? { color_temperature_kelvin: intended.color_temperature_kelvin }
      : {}),
  };
}

function summarizePlan(
  targetLightId: string,
  diff: HueDryRunDiffSummary,
): string {
  const changed =
    diff.changed_fields.length > 0
      ? diff.changed_fields.join(",")
      : "no_known_changes";
  const unknown =
    diff.unknown_fields.length > 0
      ? `; unknown=${diff.unknown_fields.join(",")}`
      : "";
  return `Hue dry-run for ${targetLightId}: changed=${changed}${unknown}`;
}
