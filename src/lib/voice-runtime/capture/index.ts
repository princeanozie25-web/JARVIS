export {
  CAPTURE_LIFECYCLE_STATES,
  CAPTURE_STATE_EVENTS,
  CAPTURE_TERMINAL_STATES,
} from "./types";
export type {
  CaptureErrorClass,
  CaptureLifecycleState,
  CaptureSessionMetadata,
  CaptureStateEvent,
  CaptureStateTransitionFailureReason,
  CaptureStateTransitionResult,
  CaptureTerminalState,
} from "./types";

export {
  isCaptureLifecycleState,
  isCaptureStateEvent,
  transitionCaptureState,
} from "./state-machine";

export {
  CAPTURE_DEVICE_KINDS,
  CAPTURE_PERMISSION_STATES,
  isCaptureDevice,
  isCapturePermissionState,
  validateCaptureDeviceSelection,
} from "./device";
export type {
  CaptureDevice,
  CaptureDeviceHealth,
  CaptureDeviceId,
  CaptureDeviceKind,
  CaptureDeviceSelection,
  CaptureDeviceSelectionDenialReason,
  CaptureDeviceSelectionValidationResult,
  CapturePermissionState,
} from "./device";

export {
  CAPTURE_CONFIG_LIMITS,
  DEFAULT_CAPTURE_RUNTIME_CONFIG,
  canArmCapture,
  createDefaultCaptureRuntimeConfig,
  validateCaptureConfig,
} from "./config";
export type {
  CaptureArmDecision,
  CaptureArmDenialReason,
  CaptureConfigDenialReason,
  CaptureConfigValidationResult,
  CaptureRuntimeConfig,
} from "./config";

export {
  CAPTURE_SUPERVISOR_TIMEOUT_KINDS,
  createCaptureSupervisor,
} from "./supervisor";
export type {
  CaptureSupervisor,
  CaptureSupervisorFailureReason,
  CaptureSupervisorOperation,
  CaptureSupervisorOptions,
  CaptureSupervisorResult,
  CaptureSupervisorSnapshot,
  CaptureSupervisorTimeoutKind,
} from "./supervisor";
