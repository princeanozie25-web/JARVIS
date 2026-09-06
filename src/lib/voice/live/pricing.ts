// Cloud realtime pricing, USD per 1M tokens, from the OpenAI pricing table read
// 2026-09-06. Currency-agnostic on purpose (brief §14: do not hardcode GBP into
// provider logic) — the budget layer converts. Data only; update here when the
// table changes.

import type { VoiceLiveUsage } from "./contract";

export interface RealtimePricePer1M {
  readonly text_in: number;
  readonly text_cached_in: number;
  readonly text_out: number;
  readonly audio_in: number;
  readonly audio_cached_in: number;
  readonly audio_out: number;
}

export const OPENAI_REALTIME_PRICING_USD_PER_1M: Record<
  string,
  RealtimePricePer1M
> = {
  "gpt-realtime-mini": {
    text_in: 0.6,
    text_cached_in: 0.06,
    text_out: 2.4,
    audio_in: 10,
    audio_cached_in: 0.3,
    audio_out: 20,
  },
  "gpt-realtime": {
    text_in: 4,
    text_cached_in: 0.4,
    text_out: 16,
    audio_in: 32,
    audio_cached_in: 0.4,
    audio_out: 64,
  },
};

export function pricingForModel(model: string): RealtimePricePer1M {
  // Snapshot ids (gpt-realtime-mini-2025-12-15) price like their family.
  const family = model.startsWith("gpt-realtime-mini")
    ? "gpt-realtime-mini"
    : "gpt-realtime";
  return OPENAI_REALTIME_PRICING_USD_PER_1M[family]!;
}

export interface RealtimeUsageTokens {
  readonly input_text_tokens: number;
  readonly input_audio_tokens: number;
  readonly cached_text_tokens: number;
  readonly cached_audio_tokens: number;
  readonly output_text_tokens: number;
  readonly output_audio_tokens: number;
}

export function estimateRealtimeUsd(
  tokens: RealtimeUsageTokens,
  model: string,
): number {
  const p = pricingForModel(model);
  const usd =
    (tokens.input_text_tokens * p.text_in +
      tokens.cached_text_tokens * p.text_cached_in +
      tokens.input_audio_tokens * p.audio_in +
      tokens.cached_audio_tokens * p.audio_cached_in +
      tokens.output_text_tokens * p.text_out +
      tokens.output_audio_tokens * p.audio_out) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}

export function usageFromRealtimeTokens(
  tokens: RealtimeUsageTokens,
  model: string,
): VoiceLiveUsage {
  const cached = tokens.cached_text_tokens + tokens.cached_audio_tokens;
  return {
    input_tokens: tokens.input_text_tokens + tokens.input_audio_tokens + cached,
    output_tokens: tokens.output_text_tokens + tokens.output_audio_tokens,
    input_text_tokens: tokens.input_text_tokens,
    input_audio_tokens: tokens.input_audio_tokens,
    cached_input_tokens: cached,
    output_text_tokens: tokens.output_text_tokens,
    output_audio_tokens: tokens.output_audio_tokens,
    estimated_usd: estimateRealtimeUsd(tokens, model),
  };
}
