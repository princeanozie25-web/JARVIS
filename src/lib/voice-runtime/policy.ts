import type { VoiceRuntimePolicyConfig } from "./config";
import type { VoiceRuntimeFeatureFlags } from "./feature-flags";

export const VOICE_POLICY_DENIAL_REASONS = [
  "push_to_talk_required",
  "local_stt_disabled",
  "local_tts_disabled",
  "cloud_stt_disabled",
  "cloud_tts_disabled",
  "playback_disabled",
  "playback_autostart_disabled",
  "capture_limit_exhausted",
  "playback_queue_limit_exhausted",
  "sensitive_content_blocked",
  "tool_output_blocked",
  "code_block_blocked",
  "approval_prompt_blocked",
  "personal_context_blocked",
  "raw_file_content_blocked",
] as const;

export type VoicePolicyDenialReason =
  (typeof VOICE_POLICY_DENIAL_REASONS)[number];

export type VoicePolicyDecision =
  | {
      readonly allowed: true;
      readonly reason: null;
      readonly metadata_only: true;
    }
  | {
      readonly allowed: false;
      readonly reason: VoicePolicyDenialReason;
      readonly metadata_only: true;
    };

export const VOICE_SPEAKABLE_CONTENT_KINDS = ["assistant_prose"] as const;
export const VOICE_SENSITIVE_CONTENT_KINDS = [
  "tool_output",
  "code_block",
  "approval_prompt",
  "personal_context",
  "raw_file_content",
] as const;

export type VoiceSpeakableContentKind =
  | (typeof VOICE_SPEAKABLE_CONTENT_KINDS)[number]
  | (typeof VOICE_SENSITIVE_CONTENT_KINDS)[number];

export interface VoicePolicyContext {
  readonly config: VoiceRuntimePolicyConfig;
  readonly feature_flags: VoiceRuntimeFeatureFlags;
}

export interface VoiceCapturePolicyInput extends VoicePolicyContext {
  readonly requested_duration_ms: number;
}

export interface VoicePlaybackPolicyInput extends VoicePolicyContext {
  readonly queue_depth: number;
  readonly autostart_requested?: boolean;
}

export interface VoiceSensitiveContentPolicyInput extends VoicePolicyContext {
  readonly content_kind: VoiceSpeakableContentKind;
}

export function canStartCapture(
  input: VoiceCapturePolicyInput,
): VoicePolicyDecision {
  if (!input.config.push_to_talk_enabled) return deny("push_to_talk_required");
  if (!input.config.local_stt_enabled || !input.feature_flags.local_stt) {
    return deny("local_stt_disabled");
  }
  if (
    input.config.max_capture_ms <= 0 ||
    input.requested_duration_ms > input.config.max_capture_ms
  ) {
    return deny("capture_limit_exhausted");
  }
  return allow();
}

export function canStartPlayback(
  input: VoicePlaybackPolicyInput,
): VoicePolicyDecision {
  if (!input.config.local_tts_enabled || !input.feature_flags.local_tts) {
    return deny("local_tts_disabled");
  }
  if (!input.feature_flags.playback) return deny("playback_disabled");
  if (input.config.playback_autostart_enabled || input.autostart_requested) {
    return deny("playback_autostart_disabled");
  }
  if (
    input.config.max_playback_queue_depth <= 0 ||
    input.queue_depth >= input.config.max_playback_queue_depth
  ) {
    return deny("playback_queue_limit_exhausted");
  }
  return allow();
}

export function canUseCloudSTT(input: VoicePolicyContext): VoicePolicyDecision {
  if (!input.config.cloud_stt_enabled || !input.feature_flags.cloud_stt) {
    return deny("cloud_stt_disabled");
  }
  return allow();
}

export function canUseCloudTTS(input: VoicePolicyContext): VoicePolicyDecision {
  if (!input.config.cloud_tts_enabled || !input.feature_flags.cloud_tts) {
    return deny("cloud_tts_disabled");
  }
  return allow();
}

export function canSpeakSensitiveContent(
  input: VoiceSensitiveContentPolicyInput,
): VoicePolicyDecision {
  if (input.content_kind === "assistant_prose") return allow();
  if (!input.config.allow_tts_for_sensitive_content) {
    return deny(reasonForSensitiveContent(input.content_kind));
  }
  return deny("sensitive_content_blocked");
}

function reasonForSensitiveContent(
  contentKind: Exclude<VoiceSpeakableContentKind, "assistant_prose">,
): VoicePolicyDenialReason {
  switch (contentKind) {
    case "tool_output":
      return "tool_output_blocked";
    case "code_block":
      return "code_block_blocked";
    case "approval_prompt":
      return "approval_prompt_blocked";
    case "personal_context":
      return "personal_context_blocked";
    case "raw_file_content":
      return "raw_file_content_blocked";
  }
}

function allow(): VoicePolicyDecision {
  return {
    allowed: true,
    reason: null,
    metadata_only: true,
  };
}

function deny(reason: VoicePolicyDenialReason): VoicePolicyDecision {
  return {
    allowed: false,
    reason,
    metadata_only: true,
  };
}
