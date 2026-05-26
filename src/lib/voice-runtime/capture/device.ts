export const CAPTURE_DEVICE_KINDS = ["audioinput"] as const;
export const CAPTURE_PERMISSION_STATES = [
  "unknown",
  "granted",
  "denied",
  "unavailable",
] as const;

export type CaptureDeviceKind = (typeof CAPTURE_DEVICE_KINDS)[number];
export type CapturePermissionState = (typeof CAPTURE_PERMISSION_STATES)[number];
export type CaptureDeviceId = string;

export interface CaptureDeviceHealth {
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly checked_at_ms?: number;
  readonly error_class?: "permission_denied" | "unavailable" | "unknown";
  readonly metadata_only: true;
}

export interface CaptureDevice {
  readonly device_id: CaptureDeviceId;
  readonly label_redacted: true;
  readonly kind: CaptureDeviceKind;
  readonly is_default: boolean;
  readonly health: CaptureDeviceHealth;
  readonly permission_state: CapturePermissionState;
  readonly metadata_only: true;
}

export interface CaptureDeviceSelection {
  readonly selected_device_id: CaptureDeviceId | null;
  readonly devices: readonly CaptureDevice[];
  readonly permission_state: CapturePermissionState;
  readonly metadata_only: true;
}

export type CaptureDeviceSelectionDenialReason =
  | "malformed_selection"
  | "permission_denied"
  | "permission_unavailable"
  | "device_missing"
  | "device_unhealthy"
  | "selected_device_missing";

export type CaptureDeviceSelectionValidationResult =
  | {
      readonly ok: true;
      readonly device: CaptureDevice;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly device: null;
      readonly reasons: readonly CaptureDeviceSelectionDenialReason[];
      readonly metadata_only: true;
    };

export function validateCaptureDeviceSelection(
  selection: unknown,
): CaptureDeviceSelectionValidationResult {
  if (!isCaptureDeviceSelection(selection)) {
    return fail(["malformed_selection"]);
  }

  const reasons = new Set<CaptureDeviceSelectionDenialReason>();
  if (selection.permission_state === "denied") reasons.add("permission_denied");
  if (selection.permission_state === "unavailable") {
    reasons.add("permission_unavailable");
  }
  if (selection.devices.length === 0) reasons.add("device_missing");

  const selectedDevice =
    selection.selected_device_id === null
      ? selection.devices.find((device) => device.is_default)
      : selection.devices.find(
          (device) => device.device_id === selection.selected_device_id,
        );

  if (!selectedDevice && selection.selected_device_id !== null) {
    reasons.add("selected_device_missing");
  } else if (!selectedDevice) {
    reasons.add("device_missing");
  } else if (
    !selectedDevice.health.ok ||
    selectedDevice.permission_state === "denied" ||
    selectedDevice.permission_state === "unavailable"
  ) {
    reasons.add(
      selectedDevice.permission_state === "denied"
        ? "permission_denied"
        : selectedDevice.permission_state === "unavailable"
          ? "permission_unavailable"
          : "device_unhealthy",
    );
  }

  if (reasons.size > 0) return fail([...reasons]);
  if (!selectedDevice) return fail(["device_missing"]);
  return {
    ok: true,
    device: copyCaptureDevice(selectedDevice),
    reasons: [],
    metadata_only: true,
  };
}

export function isCaptureDevice(value: unknown): value is CaptureDevice {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isNonemptyString(record.device_id) &&
    record.label_redacted === true &&
    record.kind === "audioinput" &&
    typeof record.is_default === "boolean" &&
    isCaptureDeviceHealth(record.health) &&
    isCapturePermissionState(record.permission_state) &&
    record.metadata_only === true &&
    !("raw_handle" in record) &&
    !("os_device_handle" in record) &&
    !("label" in record)
  );
}

export function isCapturePermissionState(
  value: unknown,
): value is CapturePermissionState {
  return (
    typeof value === "string" &&
    (CAPTURE_PERMISSION_STATES as readonly string[]).includes(value)
  );
}

function isCaptureDeviceSelection(
  value: unknown,
): value is CaptureDeviceSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (typeof record.selected_device_id === "string" ||
      record.selected_device_id === null) &&
    Array.isArray(record.devices) &&
    record.devices.every(isCaptureDevice) &&
    isCapturePermissionState(record.permission_state) &&
    record.metadata_only === true
  );
}

function isCaptureDeviceHealth(value: unknown): value is CaptureDeviceHealth {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.ok === "boolean" &&
    typeof record.degraded === "boolean" &&
    (record.checked_at_ms === undefined ||
      isNonnegativeNumber(record.checked_at_ms)) &&
    (record.error_class === undefined ||
      record.error_class === "permission_denied" ||
      record.error_class === "unavailable" ||
      record.error_class === "unknown") &&
    record.metadata_only === true
  );
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function copyCaptureDevice(device: CaptureDevice): CaptureDevice {
  return {
    ...device,
    health: { ...device.health },
    metadata_only: true,
  };
}

function fail(
  reasons: readonly CaptureDeviceSelectionDenialReason[],
): CaptureDeviceSelectionValidationResult {
  return {
    ok: false,
    device: null,
    reasons,
    metadata_only: true,
  };
}
