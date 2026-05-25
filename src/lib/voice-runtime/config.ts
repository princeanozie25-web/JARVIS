export const VOICE_RUNTIME_CONFIG_DENIAL_REASONS = [
  "malformed_config",
  "forbidden_feature_enabled",
  "push_to_talk_required",
  "invalid_limit",
  "contradictory_state",
] as const;

export type VoiceRuntimeConfigDenialReason =
  (typeof VOICE_RUNTIME_CONFIG_DENIAL_REASONS)[number];

export interface VoiceRuntimePolicyConfig {
  readonly push_to_talk_enabled: boolean;
  readonly wake_word_enabled: boolean;
  readonly always_listening_enabled: boolean;
  readonly voice_approval_enabled: boolean;
  readonly background_capture_enabled: boolean;
  readonly transcript_persistence_enabled: boolean;
  readonly raw_audio_persistence_enabled: boolean;
  readonly local_stt_enabled: boolean;
  readonly local_tts_enabled: boolean;
  readonly cloud_stt_enabled: boolean;
  readonly cloud_tts_enabled: boolean;
  readonly playback_autostart_enabled: boolean;
  readonly microphone_device_id: string | null;
  readonly speaker_device_id: string | null;
  readonly max_voice_session_ms: number;
  readonly max_capture_ms: number;
  readonly max_playback_queue_depth: number;
  readonly allow_tts_for_sensitive_content: boolean;
}

export type VoiceRuntimeConfigValidationResult =
  | {
      readonly ok: true;
      readonly config: VoiceRuntimePolicyConfig;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly VoiceRuntimeConfigDenialReason[];
    };

export const DEFAULT_VOICE_RUNTIME_POLICY_CONFIG: VoiceRuntimePolicyConfig = {
  push_to_talk_enabled: true,
  wake_word_enabled: false,
  always_listening_enabled: false,
  voice_approval_enabled: false,
  background_capture_enabled: false,
  transcript_persistence_enabled: false,
  raw_audio_persistence_enabled: false,
  local_stt_enabled: false,
  local_tts_enabled: false,
  cloud_stt_enabled: false,
  cloud_tts_enabled: false,
  playback_autostart_enabled: false,
  microphone_device_id: null,
  speaker_device_id: null,
  max_voice_session_ms: 0,
  max_capture_ms: 0,
  max_playback_queue_depth: 0,
  allow_tts_for_sensitive_content: false,
};

const REQUIRED_KEYS = Object.keys(
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
) as readonly (keyof VoiceRuntimePolicyConfig)[];

const FORBIDDEN_TRUE_KEYS = [
  "wake_word_enabled",
  "always_listening_enabled",
  "voice_approval_enabled",
  "background_capture_enabled",
  "transcript_persistence_enabled",
  "raw_audio_persistence_enabled",
  "cloud_stt_enabled",
  "cloud_tts_enabled",
  "playback_autostart_enabled",
  "allow_tts_for_sensitive_content",
] as const satisfies readonly (keyof VoiceRuntimePolicyConfig)[];

export function createDefaultVoiceRuntimePolicyConfig(): VoiceRuntimePolicyConfig {
  return { ...DEFAULT_VOICE_RUNTIME_POLICY_CONFIG };
}

export function parseVoiceRuntimePolicyConfig(
  input: unknown,
): VoiceRuntimeConfigValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(["malformed_config"]);
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== REQUIRED_KEYS.length ||
    !keys.every((key) => REQUIRED_KEYS.includes(key as never))
  ) {
    return fail(["malformed_config"]);
  }

  const reasons = new Set<VoiceRuntimeConfigDenialReason>();
  for (const key of REQUIRED_KEYS) {
    const value = record[key];
    if (key === "microphone_device_id" || key === "speaker_device_id") {
      if (value !== null && typeof value !== "string") {
        reasons.add("malformed_config");
      }
    } else if (
      key === "max_voice_session_ms" ||
      key === "max_capture_ms" ||
      key === "max_playback_queue_depth"
    ) {
      if (!isNonnegativeNumber(value)) reasons.add("invalid_limit");
    } else if (typeof value !== "boolean") {
      reasons.add("malformed_config");
    }
  }

  if (record.push_to_talk_enabled !== true) {
    reasons.add("push_to_talk_required");
  }
  if (FORBIDDEN_TRUE_KEYS.some((key) => record[key] === true)) {
    reasons.add("forbidden_feature_enabled");
  }
  if (
    typeof record.max_voice_session_ms === "number" &&
    typeof record.max_capture_ms === "number" &&
    record.max_voice_session_ms > 0 &&
    record.max_capture_ms > record.max_voice_session_ms
  ) {
    reasons.add("contradictory_state");
  }
  if (
    record.local_tts_enabled !== true &&
    typeof record.max_playback_queue_depth === "number" &&
    record.max_playback_queue_depth > 0
  ) {
    reasons.add("contradictory_state");
  }

  if (reasons.size > 0) return fail([...reasons]);
  return {
    ok: true,
    config: { ...(record as unknown as VoiceRuntimePolicyConfig) },
    reasons: [],
  };
}

export function assertVoiceRuntimePolicyConfig(
  input: unknown,
): VoiceRuntimePolicyConfig {
  const result = parseVoiceRuntimePolicyConfig(input);
  if (!result.ok) {
    throw new TypeError(`Invalid voice runtime config: ${result.reasons}`);
  }
  return result.config;
}

function fail(
  reasons: readonly VoiceRuntimeConfigDenialReason[],
): VoiceRuntimeConfigValidationResult {
  return {
    ok: false,
    config: null,
    reasons,
  };
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
