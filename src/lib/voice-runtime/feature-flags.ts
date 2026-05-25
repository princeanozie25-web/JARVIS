export const VOICE_RUNTIME_FEATURE_FLAG_KEYS = [
  "local_stt",
  "local_tts",
  "cloud_stt",
  "cloud_tts",
  "playback",
  "barge_in",
  "realtime_streaming",
  "voice_runtime_integration",
] as const;

export type VoiceRuntimeFeatureFlagKey =
  (typeof VOICE_RUNTIME_FEATURE_FLAG_KEYS)[number];

export type VoiceRuntimeFeatureFlags = Readonly<
  Record<VoiceRuntimeFeatureFlagKey, boolean>
>;

export const DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS: VoiceRuntimeFeatureFlags =
  Object.freeze({
    local_stt: true,
    local_tts: true,
    cloud_stt: false,
    cloud_tts: false,
    playback: false,
    barge_in: false,
    realtime_streaming: false,
    voice_runtime_integration: false,
  });

export function createDefaultVoiceRuntimeFeatureFlags(): VoiceRuntimeFeatureFlags {
  return clone(DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS);
}

export function validateVoiceRuntimeFeatureFlags(input: unknown): {
  readonly ok: boolean;
  readonly flags: VoiceRuntimeFeatureFlags | null;
  readonly denial_reasons: readonly string[];
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      flags: null,
      denial_reasons: ["malformed_feature_flags"],
    };
  }

  const record = input as Record<string, unknown>;
  const expectedKeys = new Set<string>(VOICE_RUNTIME_FEATURE_FLAG_KEYS);
  const keys = Object.keys(record);
  if (!keys.every((key) => expectedKeys.has(key))) {
    return {
      ok: false,
      flags: null,
      denial_reasons: ["unknown_feature_flag"],
    };
  }
  if (!VOICE_RUNTIME_FEATURE_FLAG_KEYS.every((key) => key in record)) {
    return {
      ok: false,
      flags: null,
      denial_reasons: ["missing_feature_flag"],
    };
  }
  if (!keys.every((key) => typeof record[key] === "boolean")) {
    return {
      ok: false,
      flags: null,
      denial_reasons: ["malformed_feature_flags"],
    };
  }

  const flags = record as unknown as VoiceRuntimeFeatureFlags;
  const denied = [
    flags.cloud_stt ? "cloud_stt_disabled" : null,
    flags.cloud_tts ? "cloud_tts_disabled" : null,
    flags.playback ? "playback_disabled" : null,
    flags.barge_in ? "barge_in_disabled" : null,
    flags.realtime_streaming ? "realtime_streaming_disabled" : null,
    flags.voice_runtime_integration
      ? "voice_runtime_integration_disabled"
      : null,
  ].filter((reason): reason is string => reason !== null);

  if (denied.length > 0) {
    return {
      ok: false,
      flags: null,
      denial_reasons: denied,
    };
  }

  return {
    ok: true,
    flags: clone(flags),
    denial_reasons: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
