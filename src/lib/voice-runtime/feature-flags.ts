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

export const DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS: VoiceRuntimeFeatureFlags = {
  local_stt: true,
  local_tts: true,
  cloud_stt: false,
  cloud_tts: false,
  playback: false,
  barge_in: false,
  realtime_streaming: false,
  voice_runtime_integration: false,
};

const DISABLED_FEATURE_FLAGS = [
  "cloud_stt",
  "cloud_tts",
  "playback",
  "barge_in",
  "realtime_streaming",
  "voice_runtime_integration",
] as const satisfies readonly VoiceRuntimeFeatureFlagKey[];

export function createDefaultVoiceRuntimeFeatureFlags(): VoiceRuntimeFeatureFlags {
  return { ...DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS };
}

export function validateVoiceRuntimeFeatureFlags(input: unknown):
  | {
      readonly ok: true;
      readonly flags: VoiceRuntimeFeatureFlags;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly flags: null;
      readonly reasons: readonly (
        | "malformed_flags"
        | "disabled_feature_enabled"
      )[];
    } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      flags: null,
      reasons: ["malformed_flags"],
    };
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== VOICE_RUNTIME_FEATURE_FLAG_KEYS.length ||
    !keys.every((key) =>
      (VOICE_RUNTIME_FEATURE_FLAG_KEYS as readonly string[]).includes(key),
    ) ||
    !VOICE_RUNTIME_FEATURE_FLAG_KEYS.every(
      (key) => typeof record[key] === "boolean",
    )
  ) {
    return {
      ok: false,
      flags: null,
      reasons: ["malformed_flags"],
    };
  }

  if (DISABLED_FEATURE_FLAGS.some((key) => record[key] === true)) {
    return {
      ok: false,
      flags: null,
      reasons: ["disabled_feature_enabled"],
    };
  }

  return {
    ok: true,
    flags: { ...(record as unknown as VoiceRuntimeFeatureFlags) },
    reasons: [],
  };
}
