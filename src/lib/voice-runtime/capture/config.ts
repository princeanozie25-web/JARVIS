import {
  validateCaptureDeviceSelection,
  type CaptureDeviceSelection,
  type CaptureDeviceSelectionDenialReason,
} from "./device";

export const CAPTURE_CONFIG_LIMITS = {
  minMaxCaptureMs: 100,
  maxMaxCaptureMs: 120_000,
  minEndpointTimeoutMs: 50,
  maxEndpointTimeoutMs: 10_000,
  minSilenceTimeoutMs: 50,
  maxSilenceTimeoutMs: 10_000,
  minSampleRateHz: 8_000,
  maxSampleRateHz: 192_000,
  minChannelCount: 1,
  maxChannelCount: 2,
} as const;

export interface CaptureRuntimeConfig {
  readonly push_to_talk_enabled: boolean;
  readonly selected_device_id: string | null;
  readonly max_capture_ms: number;
  readonly endpoint_timeout_ms: number;
  readonly silence_timeout_ms: number;
  readonly sample_rate_hz: number;
  readonly channel_count: number;
  readonly permission_required: boolean;
  readonly mic_active_indicator_required: boolean;
  readonly metadata_only: true;
}

export const DEFAULT_CAPTURE_RUNTIME_CONFIG: CaptureRuntimeConfig = {
  push_to_talk_enabled: true,
  selected_device_id: null,
  max_capture_ms: 30_000,
  endpoint_timeout_ms: 1_000,
  silence_timeout_ms: 750,
  sample_rate_hz: 16_000,
  channel_count: 1,
  permission_required: true,
  mic_active_indicator_required: true,
  metadata_only: true,
};

export type CaptureConfigDenialReason =
  | "malformed_config"
  | "push_to_talk_disabled"
  | "permission_not_required"
  | "mic_indicator_disabled"
  | "invalid_limit";

export type CaptureArmDenialReason =
  | CaptureConfigDenialReason
  | CaptureDeviceSelectionDenialReason
  | "device_selection_mismatch";

export type CaptureConfigValidationResult =
  | {
      readonly ok: true;
      readonly config: CaptureRuntimeConfig;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly CaptureConfigDenialReason[];
      readonly metadata_only: true;
    };

export type CaptureArmDecision =
  | {
      readonly allowed: true;
      readonly device_id: string;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly allowed: false;
      readonly device_id: null;
      readonly reasons: readonly CaptureArmDenialReason[];
      readonly metadata_only: true;
    };

export function createDefaultCaptureRuntimeConfig(): CaptureRuntimeConfig {
  return { ...DEFAULT_CAPTURE_RUNTIME_CONFIG };
}

export function validateCaptureConfig(
  input: unknown,
): CaptureConfigValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return failConfig(["malformed_config"]);
  }

  const record = input as Record<string, unknown>;
  const expectedKeys = Object.keys(DEFAULT_CAPTURE_RUNTIME_CONFIG);
  const keys = Object.keys(record);
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key) => expectedKeys.includes(key))
  ) {
    return failConfig(["malformed_config"]);
  }

  const reasons = new Set<CaptureConfigDenialReason>();
  if (record.push_to_talk_enabled !== true) {
    reasons.add("push_to_talk_disabled");
  }
  if (
    record.selected_device_id !== null &&
    typeof record.selected_device_id !== "string"
  ) {
    reasons.add("malformed_config");
  }
  if (record.permission_required !== true) {
    reasons.add("permission_not_required");
  }
  if (record.mic_active_indicator_required !== true) {
    reasons.add("mic_indicator_disabled");
  }
  if (record.metadata_only !== true) reasons.add("malformed_config");
  if (!isBoundedInteger(record.max_capture_ms, "max_capture_ms")) {
    reasons.add("invalid_limit");
  }
  if (!isBoundedInteger(record.endpoint_timeout_ms, "endpoint_timeout_ms")) {
    reasons.add("invalid_limit");
  }
  if (!isBoundedInteger(record.silence_timeout_ms, "silence_timeout_ms")) {
    reasons.add("invalid_limit");
  }
  if (!isBoundedInteger(record.sample_rate_hz, "sample_rate_hz")) {
    reasons.add("invalid_limit");
  }
  if (!isBoundedInteger(record.channel_count, "channel_count")) {
    reasons.add("invalid_limit");
  }

  if (reasons.size > 0) return failConfig([...reasons]);
  return {
    ok: true,
    config: { ...(record as unknown as CaptureRuntimeConfig) },
    reasons: [],
    metadata_only: true,
  };
}

export function canArmCapture(input: {
  readonly config: unknown;
  readonly selection: CaptureDeviceSelection;
}): CaptureArmDecision {
  const configResult = validateCaptureConfig(input.config);
  const selectionResult = validateCaptureDeviceSelection(input.selection);
  const reasons = new Set<CaptureArmDenialReason>();

  if (!configResult.ok) {
    for (const reason of configResult.reasons) reasons.add(reason);
  }
  if (!selectionResult.ok) {
    for (const reason of selectionResult.reasons) reasons.add(reason);
  }

  if (
    configResult.ok &&
    selectionResult.ok &&
    configResult.config.selected_device_id !== null &&
    selectionResult.device.device_id !== configResult.config.selected_device_id
  ) {
    reasons.add("device_selection_mismatch");
  }

  if (reasons.size > 0 || !selectionResult.ok) {
    return {
      allowed: false,
      device_id: null,
      reasons: [...reasons],
      metadata_only: true,
    };
  }

  return {
    allowed: true,
    device_id: selectionResult.device.device_id,
    reasons: [],
    metadata_only: true,
  };
}

function isBoundedInteger(
  value: unknown,
  field: keyof typeof FIELD_LIMITS,
): boolean {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  const limits = FIELD_LIMITS[field];
  return value >= limits.min && value <= limits.max;
}

const FIELD_LIMITS = {
  max_capture_ms: {
    min: CAPTURE_CONFIG_LIMITS.minMaxCaptureMs,
    max: CAPTURE_CONFIG_LIMITS.maxMaxCaptureMs,
  },
  endpoint_timeout_ms: {
    min: CAPTURE_CONFIG_LIMITS.minEndpointTimeoutMs,
    max: CAPTURE_CONFIG_LIMITS.maxEndpointTimeoutMs,
  },
  silence_timeout_ms: {
    min: CAPTURE_CONFIG_LIMITS.minSilenceTimeoutMs,
    max: CAPTURE_CONFIG_LIMITS.maxSilenceTimeoutMs,
  },
  sample_rate_hz: {
    min: CAPTURE_CONFIG_LIMITS.minSampleRateHz,
    max: CAPTURE_CONFIG_LIMITS.maxSampleRateHz,
  },
  channel_count: {
    min: CAPTURE_CONFIG_LIMITS.minChannelCount,
    max: CAPTURE_CONFIG_LIMITS.maxChannelCount,
  },
} as const;

function failConfig(
  reasons: readonly CaptureConfigDenialReason[],
): CaptureConfigValidationResult {
  return {
    ok: false,
    config: null,
    reasons,
    metadata_only: true,
  };
}
