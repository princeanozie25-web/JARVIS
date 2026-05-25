import type { VoiceRuntimeConfig } from "./types";

export const VOICE_RUNTIME_GOVERNANCE_INVARIANTS = Object.freeze({
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
} as const);

export const DEFAULT_VOICE_RUNTIME_CONFIG: VoiceRuntimeConfig = Object.freeze({
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
});

export type VoiceRuntimeGovernanceInvariant =
  typeof VOICE_RUNTIME_GOVERNANCE_INVARIANTS;

export function getVoiceRuntimeGovernanceInvariants(): VoiceRuntimeGovernanceInvariant {
  return clone(VOICE_RUNTIME_GOVERNANCE_INVARIANTS);
}

export function createDefaultVoiceRuntimeConfig(): VoiceRuntimeConfig {
  return clone(DEFAULT_VOICE_RUNTIME_CONFIG);
}

export function isGovernedVoiceRuntimeConfig(
  config: unknown,
): config is VoiceRuntimeConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  const candidate = config as Partial<
    Record<keyof VoiceRuntimeConfig, unknown>
  >;
  return (
    candidate.push_to_talk_only === true &&
    candidate.wake_word_enabled === false &&
    candidate.always_listening_enabled === false &&
    candidate.background_recording_enabled === false &&
    candidate.hidden_mic_activation_enabled === false &&
    candidate.voice_approval_authority === false &&
    candidate.transcript_telemetry_persistence_enabled === false &&
    candidate.raw_audio_persistence_enabled === false &&
    candidate.bypass_approval_layers === false &&
    candidate.bypass_runtime_router === false &&
    candidate.bypass_safety_layers === false
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
