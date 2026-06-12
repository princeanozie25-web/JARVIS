export const PHASE22_WAKE_PHRASE = "Hey Jarvis you up" as const;
export const PHASE22_OPENWAKEWORD_VERSION = "0.6.0" as const;

export interface OpenWakeWordOnnxConfig {
  readonly provider_id: "openwakeword-local-onnx";
  readonly engine: "openWakeWord";
  readonly installed_version: typeof PHASE22_OPENWAKEWORD_VERSION;
  readonly wake_phrase: typeof PHASE22_WAKE_PHRASE;
  readonly model_format: "ONNX";
  readonly model_ref: string;
  readonly local_only: true;
  readonly cloud_detection_enabled: false;
  readonly pre_wake_audio_storage_enabled: false;
  readonly raw_audio_persistence_enabled: false;
  readonly visible_standby_indicator: true;
  readonly visible_active_indicator: true;
  readonly wake_authorizes_actions: false;
  readonly metadata_only: true;
}

export interface WakeWordMetadataDetection {
  readonly provider_id: OpenWakeWordOnnxConfig["provider_id"];
  readonly phrase_observed: typeof PHASE22_WAKE_PHRASE | "not_matched";
  readonly confidence: number;
  readonly wake_detected: boolean;
  readonly standby_indicator_visible: true;
  readonly active_indicator_visible: boolean;
  readonly pre_wake_audio_stored: false;
  readonly raw_audio_included: false;
  readonly cloud_used: false;
  readonly action_authorized: false;
  readonly metadata_only: true;
}

export const DEFAULT_OPENWAKEWORD_ONNX_CONFIG: OpenWakeWordOnnxConfig =
  Object.freeze({
    provider_id: "openwakeword-local-onnx",
    engine: "openWakeWord",
    installed_version: PHASE22_OPENWAKEWORD_VERSION,
    wake_phrase: PHASE22_WAKE_PHRASE,
    model_format: "ONNX",
    model_ref: "config/voice/models/hey-jarvis-you-up.onnx",
    local_only: true,
    cloud_detection_enabled: false,
    pre_wake_audio_storage_enabled: false,
    raw_audio_persistence_enabled: false,
    visible_standby_indicator: true,
    visible_active_indicator: true,
    wake_authorizes_actions: false,
    metadata_only: true,
  });

export function validateOpenWakeWordConfig(
  config: OpenWakeWordOnnxConfig,
): boolean {
  return (
    config.engine === "openWakeWord" &&
    config.installed_version === PHASE22_OPENWAKEWORD_VERSION &&
    config.wake_phrase === PHASE22_WAKE_PHRASE &&
    config.model_format === "ONNX" &&
    config.local_only === true &&
    config.cloud_detection_enabled === false &&
    config.pre_wake_audio_storage_enabled === false &&
    config.raw_audio_persistence_enabled === false &&
    config.visible_standby_indicator === true &&
    config.visible_active_indicator === true &&
    config.wake_authorizes_actions === false &&
    config.metadata_only === true
  );
}

export function evaluateWakeWordMetadataDetection(input: {
  readonly phrase: string;
  readonly confidence: number;
  readonly threshold?: number;
  readonly config?: OpenWakeWordOnnxConfig;
}): WakeWordMetadataDetection {
  const config = input.config ?? DEFAULT_OPENWAKEWORD_ONNX_CONFIG;
  const threshold = input.threshold ?? 0.5;
  const phraseMatches =
    normalize(input.phrase) === normalize(config.wake_phrase);
  const wakeDetected = phraseMatches && input.confidence >= threshold;

  return {
    provider_id: config.provider_id,
    phrase_observed: phraseMatches ? PHASE22_WAKE_PHRASE : "not_matched",
    confidence: clamp(input.confidence),
    wake_detected: wakeDetected,
    standby_indicator_visible: true,
    active_indicator_visible: wakeDetected,
    pre_wake_audio_stored: false,
    raw_audio_included: false,
    cloud_used: false,
    action_authorized: false,
    metadata_only: true,
  };
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
