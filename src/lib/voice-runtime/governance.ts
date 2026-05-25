import type { VoiceRuntimeConfig } from "./types";

export const VOICE_RUNTIME_GOVERNANCE_INVARIANTS = {
  push_to_talk_only: true,
  wake_word_enabled: false,
  always_listening_enabled: false,
  voice_approval_authority: false,
  background_recording_enabled: false,
  transcript_telemetry_persistence_enabled: false,
  raw_audio_persistence_enabled: false,
  hidden_mic_activation_enabled: false,
  voice_transport_only: true,
  bypass_approval_layers: false,
  bypass_runtime_router: false,
  bypass_safety_layers: false,
} as const;

export type VoiceRuntimeGovernanceInvariant =
  typeof VOICE_RUNTIME_GOVERNANCE_INVARIANTS;

export const DEFAULT_VOICE_RUNTIME_CONFIG: VoiceRuntimeConfig = {
  push_to_talk_only: true,
  wake_word_enabled: false,
  always_listening_enabled: false,
  background_recording_enabled: false,
  hidden_mic_activation_enabled: false,
  voice_approval_authority: false,
  transcript_telemetry_persistence_enabled: false,
  raw_audio_persistence_enabled: false,
  bypass_approval_layers: false,
  bypass_runtime_router: false,
  bypass_safety_layers: false,
};

export function createDefaultVoiceRuntimeConfig(): VoiceRuntimeConfig {
  return { ...DEFAULT_VOICE_RUNTIME_CONFIG };
}

export function getVoiceRuntimeGovernanceInvariants(): VoiceRuntimeGovernanceInvariant {
  return { ...VOICE_RUNTIME_GOVERNANCE_INVARIANTS };
}

export function isGovernedVoiceRuntimeConfig(
  value: unknown,
): value is VoiceRuntimeConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.push_to_talk_only === true &&
    record.wake_word_enabled === false &&
    record.always_listening_enabled === false &&
    record.background_recording_enabled === false &&
    record.hidden_mic_activation_enabled === false &&
    record.voice_approval_authority === false &&
    record.transcript_telemetry_persistence_enabled === false &&
    record.raw_audio_persistence_enabled === false &&
    record.bypass_approval_layers === false &&
    record.bypass_runtime_router === false &&
    record.bypass_safety_layers === false
  );
}
