// Phase 25C-live (voice bake-off programme) — the provider-agnostic LIVE
// (full-duplex) voice session contract.
//
// The frozen Phase 14 `VoiceRuntimeAdapter` is text-in/text-out
// (transcript -> assistant_text) and models the sequential turn loop. A
// realtime provider streams audio both ways, detects speech, is interrupted
// mid-utterance and raises tool calls while still talking — none of which fits
// `executeVoiceRequest(transcript)`. This contract is ADDITIVE: it sits beside
// the frozen seams (like `tts-engine/` does for E-011), the turn-based local
// stack can be wrapped into it, and wake word / the router select a session
// through it without knowing which engine is behind it.
//
// GOVERNANCE INVARIANT (brief §5): no provider ever receives execution
// authority. A provider surfaces `tool_call` as an EVENT; JARVIS resolves it
// through the Action Gateway -> Human Gate -> T0-T3 and hands the result back
// with `submitToolResult`. The provider only ever sees the outcome.
//
// PRIVACY INVARIANT (brief §6): every descriptor declares `privacy_class`.
// Audio is delivered to a caller-owned sink and is never held in events,
// snapshots or telemetry (all metadata_only).

export const VOICE_LIVE_CAPABILITIES = [
  "speech_to_speech",
  "streaming_stt",
  "streaming_tts",
  "barge_in",
  "multilingual",
  "local",
  "cloud",
  "tool_calling",
  "custom_voice",
  "offline_capable",
] as const;
export type VoiceLiveCapability = (typeof VOICE_LIVE_CAPABILITIES)[number];

export type VoiceLivePrivacyClass = "local_audio" | "cloud_audio";
export type VoiceLiveCostClass = "free_local" | "metered_cloud";

export const VOICE_LIVE_ERROR_CLASSES = [
  "credential_missing",
  "disabled",
  "unavailable",
  "provider_error",
  "protocol_error",
  "network_error",
  "budget_blocked",
  "policy_blocked",
  "cancelled",
  "unknown",
] as const;
export type VoiceLiveErrorClass = (typeof VOICE_LIVE_ERROR_CLASSES)[number];

export const VOICE_LIVE_STOP_REASONS = [
  "user_stopped",
  "wake_sleep",
  "budget_blocked",
  "policy_blocked",
  "provider_error",
  "network_error",
  "abort_signal",
  "fallback",
] as const;
export type VoiceLiveStopReason = (typeof VOICE_LIVE_STOP_REASONS)[number];

export interface VoiceLiveProviderDescriptor {
  readonly provider_id: string;
  readonly display_name: string;
  readonly privacy_class: VoiceLivePrivacyClass;
  readonly cost_class: VoiceLiveCostClass;
  readonly capabilities: readonly VoiceLiveCapability[];
  // Type-level restatement of the governance invariant.
  readonly tool_execution_allowed: false;
  readonly metadata_only: true;
}

export interface VoiceLiveToolSpec {
  readonly name: string;
  readonly description: string;
  // JSON Schema object for the arguments.
  readonly parameters: Record<string, unknown>;
}

export interface VoiceLiveUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly input_text_tokens: number;
  readonly input_audio_tokens: number;
  readonly cached_input_tokens: number;
  readonly output_text_tokens: number;
  readonly output_audio_tokens: number;
  readonly estimated_usd: number;
}

// Events are IN-PROCESS signals to the orchestrator. `transcript` text is the
// conversational payload the brain/UI needs; it is NOT telemetry and must be
// stripped before anything is persisted (see voice-runtime/telemetry.ts).
export type VoiceLiveEvent =
  | { readonly type: "session_started"; readonly at_ms: number }
  | {
      readonly type: "session_ended";
      readonly reason: VoiceLiveStopReason;
      readonly at_ms: number;
    }
  | { readonly type: "user_speech_started"; readonly at_ms: number }
  | { readonly type: "user_speech_stopped"; readonly at_ms: number }
  | {
      readonly type: "transcript";
      readonly role: "user" | "assistant";
      readonly text: string;
      readonly final: boolean;
    }
  | {
      readonly type: "assistant_audio_started";
      readonly response_id: string;
      // Time from the end of user speech (or response request) to first audio.
      readonly first_audio_latency_ms: number;
    }
  | {
      readonly type: "assistant_audio_done";
      readonly response_id: string;
      readonly audio_ms: number;
    }
  | {
      readonly type: "tool_call";
      readonly call_id: string;
      readonly name: string;
      readonly arguments_json: string;
    }
  | {
      readonly type: "interrupted";
      readonly response_id: string | null;
      readonly audio_played_ms: number;
      readonly source: "user_barge_in" | "orchestrator";
    }
  | { readonly type: "usage"; readonly usage: VoiceLiveUsage }
  | {
      readonly type: "error";
      readonly error_class: VoiceLiveErrorClass;
      // Bounded, secret-free.
      readonly message: string;
    };

// The caller-owned audio output. PCM16 little-endian mono. `cancel` must stop
// playback immediately and discard everything queued (barge-in).
export interface VoiceLiveAudioSink {
  write(pcm16: Uint8Array, sampleRateHz: number): void;
  flush(): void;
  cancel(): void;
}

export interface VoiceLiveSessionOptions {
  readonly session_id: string;
  readonly instructions?: string;
  readonly tools?: readonly VoiceLiveToolSpec[];
  readonly voice?: string;
  readonly audio_sink: VoiceLiveAudioSink;
  readonly on_event: (event: VoiceLiveEvent) => void;
  readonly abort_signal?: AbortSignal;
}

export interface VoiceLiveSessionSnapshot {
  readonly session_id: string;
  readonly provider_id: string;
  readonly state: "connecting" | "open" | "closed";
  readonly assistant_speaking: boolean;
  readonly muted: boolean;
  readonly interruptions: number;
  readonly tool_calls: number;
  readonly responses: number;
  readonly started_at_ms: number;
  readonly ended_at_ms: number | null;
  readonly usage: VoiceLiveUsage;
  readonly metadata_only: true;
}

export interface VoiceLiveSession {
  readonly session_id: string;
  readonly provider_id: string;
  // PCM16 LE mono at `inputSampleRateHz()`.
  inputSampleRateHz(): number;
  ingestAudio(pcm16: Uint8Array): void;
  // For push-to-talk / VAD-off providers; a no-op when the provider detects turns.
  commitAudio(): void;
  // Barge-in from the orchestrator: cancel the in-flight response, discard
  // unplayed audio, keep the session coherent.
  interrupt(): Promise<void>;
  // The ONLY way a tool result reaches the provider — after the Gate.
  submitToolResult(callId: string, outputJson: string): void;
  mute(): void;
  unmute(): void;
  stop(reason: VoiceLiveStopReason): Promise<void>;
  snapshot(): VoiceLiveSessionSnapshot;
}

export interface VoiceLiveProviderHealth {
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly error_class?: VoiceLiveErrorClass;
  readonly metadata_only: true;
}

export interface VoiceLiveProvider {
  readonly descriptor: VoiceLiveProviderDescriptor;
  health(): Promise<VoiceLiveProviderHealth>;
  startSession(options: VoiceLiveSessionOptions): Promise<VoiceLiveSession>;
}

export function emptyVoiceLiveUsage(): VoiceLiveUsage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    input_text_tokens: 0,
    input_audio_tokens: 0,
    cached_input_tokens: 0,
    output_text_tokens: 0,
    output_audio_tokens: 0,
    estimated_usd: 0,
  };
}

export function addVoiceLiveUsage(
  a: VoiceLiveUsage,
  b: VoiceLiveUsage,
): VoiceLiveUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    input_text_tokens: a.input_text_tokens + b.input_text_tokens,
    input_audio_tokens: a.input_audio_tokens + b.input_audio_tokens,
    cached_input_tokens: a.cached_input_tokens + b.cached_input_tokens,
    output_text_tokens: a.output_text_tokens + b.output_text_tokens,
    output_audio_tokens: a.output_audio_tokens + b.output_audio_tokens,
    estimated_usd: round6(a.estimated_usd + b.estimated_usd),
  };
}

export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
