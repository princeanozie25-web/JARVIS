// Centralised live-voice configuration (brief §10): every knob in one place,
// read from env once, typed, with fail-closed defaults. Nothing provider-
// specific is scattered through application code.
//
// Budget thresholds are USD (brief §14: never hardcode GBP into provider
// logic). The initial safety values come from the operator's £15 warning /
// £20 hard ceiling, converted at ~1.27 → $19 / $25. Override via env.

import { VOICE_LIVE_MODES, type VoiceLiveMode } from "./router";

export const VOICE_LIVE_LOCAL_STT_CHOICES = [
  "auto",
  "parakeet-mlx",
  "mlx-whisper",
] as const;
export const VOICE_LIVE_LOCAL_TTS_CHOICES = [
  "kokoro",
  "vibevoice",
  "chatterbox-turbo",
] as const;
export type VoiceLiveLocalStt = (typeof VOICE_LIVE_LOCAL_STT_CHOICES)[number];
export type VoiceLiveLocalTts = (typeof VOICE_LIVE_LOCAL_TTS_CHOICES)[number];

export interface VoiceLiveConfig {
  // Routing (§14)
  readonly mode: VoiceLiveMode;
  readonly privacy_local_only: boolean;
  readonly budget_warn_usd: number;
  readonly budget_hard_usd: number;
  // Local engines
  readonly local_stt: VoiceLiveLocalStt;
  readonly local_tts: VoiceLiveLocalTts;
  readonly local_voice_id: string;
  readonly local_brain_model: string;
  // Premium cloud (key-gated; absent key => provider unhealthy, never a crash)
  readonly openai_realtime_enabled: boolean;
  readonly openai_realtime_model: string;
  readonly openai_realtime_voice: string;
  // Wake word (§20) — local only; off by default
  readonly wake_word_enabled: boolean;
  readonly wake_phrase: string;
  // Devices (macOS avfoundation index for the mic; output device name or "")
  readonly mic_device: string;
  readonly output_device: string;
  // Fallback order, most-preferred first (provider ids)
  readonly fallback_order: readonly string[];
  readonly metadata_only: true;
}

const DEFAULTS = {
  mode: "auto" as VoiceLiveMode,
  budget_warn_usd: 19,
  budget_hard_usd: 25,
  local_stt: "auto" as VoiceLiveLocalStt,
  local_tts: "kokoro" as VoiceLiveLocalTts,
  local_voice_id: "bm_lewis",
  local_brain_model: "qwen3.5:9b-mlx",
  openai_realtime_model: "gpt-realtime-mini",
  openai_realtime_voice: "marin",
  wake_phrase: "hey jarvis",
  mic_device: ":0",
  output_device: "",
  fallback_order: ["openai-realtime", "local-mlx-turn"] as readonly string[],
};

function clean(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  const v = clean(value)?.toLowerCase();
  if (v === undefined) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function num(value: string | undefined, fallback: number): number {
  const v = clean(value);
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function oneOf<T extends string>(
  value: string | undefined,
  choices: readonly T[],
  fallback: T,
): T {
  const v = clean(value)?.toLowerCase();
  return (choices as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

export function loadVoiceLiveConfig(
  env: Record<string, string | undefined> = process.env,
): VoiceLiveConfig {
  const warn = num(
    env.JARVIS_VOICE_LIVE_BUDGET_WARN_USD,
    DEFAULTS.budget_warn_usd,
  );
  const hard = num(
    env.JARVIS_VOICE_LIVE_BUDGET_HARD_USD,
    DEFAULTS.budget_hard_usd,
  );
  const fallback = clean(env.JARVIS_VOICE_LIVE_FALLBACK_ORDER)
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    mode: oneOf(env.JARVIS_VOICE_LIVE_MODE, VOICE_LIVE_MODES, DEFAULTS.mode),
    privacy_local_only: bool(env.JARVIS_VOICE_PRIVATE_MODE, false),
    budget_warn_usd: Math.min(warn, hard),
    budget_hard_usd: hard,
    local_stt: oneOf(
      env.JARVIS_VOICE_LIVE_LOCAL_STT,
      VOICE_LIVE_LOCAL_STT_CHOICES,
      DEFAULTS.local_stt,
    ),
    local_tts: oneOf(
      env.JARVIS_VOICE_LIVE_LOCAL_TTS,
      VOICE_LIVE_LOCAL_TTS_CHOICES,
      DEFAULTS.local_tts,
    ),
    local_voice_id: clean(env.JARVIS_TTS_VOICE_ID) ?? DEFAULTS.local_voice_id,
    local_brain_model:
      clean(env.JARVIS_VOICE_MODEL) ?? DEFAULTS.local_brain_model,
    openai_realtime_enabled: bool(env.JARVIS_OPENAI_REALTIME_ENABLED, true),
    openai_realtime_model:
      clean(env.JARVIS_OPENAI_REALTIME_MODEL) ?? DEFAULTS.openai_realtime_model,
    openai_realtime_voice:
      clean(env.JARVIS_OPENAI_REALTIME_VOICE) ?? DEFAULTS.openai_realtime_voice,
    wake_word_enabled: bool(env.JARVIS_WAKE_WORD_ENABLED, false),
    wake_phrase:
      clean(env.JARVIS_WAKE_PHRASE)?.toLowerCase() ?? DEFAULTS.wake_phrase,
    mic_device: clean(env.JARVIS_VOICE_MIC_DEVICE) ?? DEFAULTS.mic_device,
    output_device:
      clean(env.JARVIS_VOICE_OUTPUT_DEVICE) ?? DEFAULTS.output_device,
    fallback_order:
      fallback && fallback.length > 0 ? fallback : DEFAULTS.fallback_order,
    metadata_only: true,
  };
}

export const VOICE_LIVE_ENV_KEYS = [
  "JARVIS_VOICE_LIVE_MODE",
  "JARVIS_VOICE_PRIVATE_MODE",
  "JARVIS_VOICE_LIVE_BUDGET_WARN_USD",
  "JARVIS_VOICE_LIVE_BUDGET_HARD_USD",
  "JARVIS_VOICE_LIVE_LOCAL_STT",
  "JARVIS_VOICE_LIVE_LOCAL_TTS",
  "JARVIS_TTS_VOICE_ID",
  "JARVIS_VOICE_MODEL",
  "JARVIS_OPENAI_REALTIME_ENABLED",
  "JARVIS_OPENAI_REALTIME_MODEL",
  "JARVIS_OPENAI_REALTIME_VOICE",
  "JARVIS_OPENAI_REALTIME_URL",
  "OPENAI_API_KEY",
  "JARVIS_WAKE_WORD_ENABLED",
  "JARVIS_WAKE_PHRASE",
  "JARVIS_VOICE_MIC_DEVICE",
  "JARVIS_VOICE_OUTPUT_DEVICE",
  "JARVIS_VOICE_LIVE_FALLBACK_ORDER",
] as const;
