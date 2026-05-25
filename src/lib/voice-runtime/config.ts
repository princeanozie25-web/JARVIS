import { z } from "zod";

export const VOICE_RUNTIME_CONFIG_DENIAL_REASONS = [
  "malformed_config",
  "wake_word_forbidden",
  "always_listening_forbidden",
  "voice_approval_forbidden",
  "background_capture_forbidden",
  "transcript_persistence_forbidden",
  "raw_audio_persistence_forbidden",
  "cloud_stt_forbidden",
  "cloud_tts_forbidden",
  "playback_autostart_forbidden",
  "missing_push_to_talk",
  "invalid_limit",
] as const;

export type VoiceRuntimeConfigDenialReason =
  (typeof VOICE_RUNTIME_CONFIG_DENIAL_REASONS)[number];

export interface VoiceRuntimePolicyConfig {
  readonly push_to_talk_enabled: boolean;
  readonly wake_word_enabled: false;
  readonly always_listening_enabled: false;
  readonly voice_approval_enabled: false;
  readonly background_capture_enabled: false;
  readonly transcript_persistence_enabled: false;
  readonly raw_audio_persistence_enabled: false;
  readonly local_stt_enabled: boolean;
  readonly local_tts_enabled: boolean;
  readonly cloud_stt_enabled: false;
  readonly cloud_tts_enabled: false;
  readonly playback_autostart_enabled: false;
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
      readonly denial_reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly denial_reasons: readonly VoiceRuntimeConfigDenialReason[];
    };

const VoiceRuntimePolicyConfigSchema = z.strictObject({
  push_to_talk_enabled: z.boolean(),
  wake_word_enabled: z.literal(false),
  always_listening_enabled: z.literal(false),
  voice_approval_enabled: z.literal(false),
  background_capture_enabled: z.literal(false),
  transcript_persistence_enabled: z.literal(false),
  raw_audio_persistence_enabled: z.literal(false),
  local_stt_enabled: z.boolean(),
  local_tts_enabled: z.boolean(),
  cloud_stt_enabled: z.literal(false),
  cloud_tts_enabled: z.literal(false),
  playback_autostart_enabled: z.literal(false),
  microphone_device_id: z.string().trim().min(1).nullable(),
  speaker_device_id: z.string().trim().min(1).nullable(),
  max_voice_session_ms: z.number().int().nonnegative(),
  max_capture_ms: z.number().int().nonnegative(),
  max_playback_queue_depth: z.number().int().nonnegative(),
  allow_tts_for_sensitive_content: z.boolean(),
});

export const DEFAULT_VOICE_RUNTIME_POLICY_CONFIG: VoiceRuntimePolicyConfig =
  Object.freeze({
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
  });

export function createDefaultVoiceRuntimePolicyConfig(): VoiceRuntimePolicyConfig {
  return clone(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG);
}

export function parseVoiceRuntimePolicyConfig(
  input: unknown,
): VoiceRuntimeConfigValidationResult {
  const parsed = VoiceRuntimePolicyConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      config: null,
      denial_reasons: detectConfigDenials(input),
    };
  }

  const denials = detectContradictions(parsed.data);
  if (denials.length > 0) {
    return {
      ok: false,
      config: null,
      denial_reasons: denials,
    };
  }

  return {
    ok: true,
    config: clone(parsed.data),
    denial_reasons: [],
  };
}

export function assertVoiceRuntimePolicyConfig(
  input: unknown,
): VoiceRuntimePolicyConfig {
  const result = parseVoiceRuntimePolicyConfig(input);
  if (!result.ok) {
    throw new Error(
      `Voice runtime config failed closed: ${result.denial_reasons.join(",")}`,
    );
  }
  return result.config;
}

function detectConfigDenials(
  input: unknown,
): readonly VoiceRuntimeConfigDenialReason[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["malformed_config"];
  }

  const record = input as Record<string, unknown>;
  const denials = new Set<VoiceRuntimeConfigDenialReason>();
  if (record.wake_word_enabled === true) denials.add("wake_word_forbidden");
  if (record.always_listening_enabled === true) {
    denials.add("always_listening_forbidden");
  }
  if (record.voice_approval_enabled === true) {
    denials.add("voice_approval_forbidden");
  }
  if (record.background_capture_enabled === true) {
    denials.add("background_capture_forbidden");
  }
  if (record.transcript_persistence_enabled === true) {
    denials.add("transcript_persistence_forbidden");
  }
  if (record.raw_audio_persistence_enabled === true) {
    denials.add("raw_audio_persistence_forbidden");
  }
  if (record.cloud_stt_enabled === true) denials.add("cloud_stt_forbidden");
  if (record.cloud_tts_enabled === true) denials.add("cloud_tts_forbidden");
  if (record.playback_autostart_enabled === true) {
    denials.add("playback_autostart_forbidden");
  }
  if (record.push_to_talk_enabled !== true) denials.add("missing_push_to_talk");

  for (const key of [
    "max_voice_session_ms",
    "max_capture_ms",
    "max_playback_queue_depth",
  ] as const) {
    const value = record[key];
    if (
      value !== undefined &&
      (!Number.isInteger(value) || Number(value) < 0)
    ) {
      denials.add("invalid_limit");
    }
  }

  if (denials.size === 0) denials.add("malformed_config");
  return [...denials];
}

function detectContradictions(
  config: VoiceRuntimePolicyConfig,
): VoiceRuntimeConfigDenialReason[] {
  const denials: VoiceRuntimeConfigDenialReason[] = [];
  if (!config.push_to_talk_enabled) denials.push("missing_push_to_talk");
  if (config.max_voice_session_ms < config.max_capture_ms) {
    denials.push("invalid_limit");
  }
  if (config.max_playback_queue_depth > 0 && !config.local_tts_enabled) {
    denials.push("invalid_limit");
  }
  return denials;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export { VoiceRuntimePolicyConfigSchema };
