import {
  FAKE_TTS_PROVIDER_CONFIG,
  FAKE_TTS_UNAVAILABLE_PROVIDER_HEALTH,
} from "./fixtures";
import type { TtsProvider } from "./provider";
import { validateTtsSynthesisRequest } from "./provider";
import type {
  TtsCancellationReason,
  TtsProviderConfig,
  TtsProviderHealth,
  TtsSynthesisOptions,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from "./types";

export const FAKE_TTS_PROVIDER_MODES = [
  "healthy",
  "degraded",
  "unavailable",
] as const;

export type FakeTtsProviderMode = (typeof FAKE_TTS_PROVIDER_MODES)[number];

export interface FakeTtsProviderOptions {
  readonly config?: TtsProviderConfig;
  readonly mode?: FakeTtsProviderMode;
  readonly now_ms?: () => number;
}

export class FakeTtsProviderError extends Error {
  readonly reason: TtsCancellationReason | "provider_error";
  readonly metadata_only = true;

  constructor(reason: TtsCancellationReason | "provider_error") {
    super(`Fake TTS provider failed closed: ${reason}`);
    this.name = "FakeTtsProviderError";
    this.reason = reason;
  }
}

export function createFakeTtsProvider(
  options: FakeTtsProviderOptions = {},
): TtsProvider {
  const config = options.config ?? FAKE_TTS_PROVIDER_CONFIG;
  const mode = options.mode ?? "healthy";
  const nowMs = options.now_ms ?? (() => 0);
  let cancelledReason: TtsCancellationReason | null = null;
  let lastErrorClass: TtsCancellationReason | "provider_error" | undefined =
    mode === "unavailable"
      ? "provider_unavailable"
      : mode === "degraded"
        ? "provider_error"
        : undefined;

  return {
    id: config.provider_id,
    kind: "local",
    config: { ...config },
    metadata_only: true,
    synthesize: async (
      request: TtsSynthesisRequest,
      synthOptions: TtsSynthesisOptions,
    ) => {
      const blockedReason = blockedSynthesisReason(
        request,
        synthOptions,
        config,
        mode,
        cancelledReason,
      );
      if (blockedReason) {
        lastErrorClass = blockedReason;
        throw new FakeTtsProviderError(blockedReason);
      }

      const validation = validateTtsSynthesisRequest(request, config);
      if (!validation.ok) {
        lastErrorClass = validation.reasons.includes(
          "sensitive_content_blocked",
        )
          ? "policy_blocked"
          : "provider_error";
        throw new FakeTtsProviderError(lastErrorClass);
      }

      const chunkId = deterministicChunkId(request, config);
      const durationMs = estimateDurationMs(request.text);
      const result: TtsSynthesisResult = {
        request_id: request.request_id,
        chunk: {
          chunk_id: chunkId,
          provider_id: config.provider_id,
          voice_id: request.requested_voice_id,
          duration_ms: durationMs,
          size_bytes: estimateSizeBytes(durationMs, request.text.length),
          degraded: mode === "degraded",
          output_ref: `fake-tts://metadata/${config.provider_id}/${chunkId}`,
          metadata_only: true,
        },
        latency_ms: estimateLatencyMs(request.text),
        degraded: mode === "degraded",
        metadata_only: true,
      };
      return result;
    },
    cancel: async (reason: TtsCancellationReason) => {
      cancelledReason = reason;
      lastErrorClass = reason;
    },
    health: async (): Promise<TtsProviderHealth> => {
      if (mode === "unavailable") {
        return {
          ...FAKE_TTS_UNAVAILABLE_PROVIDER_HEALTH,
          provider_id: config.provider_id,
          checked_at_ms: nowMs(),
        };
      }
      return {
        provider_id: config.provider_id,
        ok: cancelledReason === null,
        provider_kind: "local",
        checked_at_ms: nowMs(),
        degraded: mode === "degraded" || cancelledReason !== null,
        ...(lastErrorClass === undefined
          ? {}
          : { last_error_class: lastErrorClass }),
        ...(cancelledReason === null ? {} : { error_class: cancelledReason }),
        metadata_only: true,
      };
    },
  };
}

function blockedSynthesisReason(
  request: TtsSynthesisRequest,
  options: TtsSynthesisOptions,
  config: TtsProviderConfig,
  mode: FakeTtsProviderMode,
  cancelledReason: TtsCancellationReason | null,
): TtsCancellationReason | "provider_error" | null {
  if (options.abort_signal?.aborted) return "abort_signal";
  if (cancelledReason) return cancelledReason;
  if (mode === "unavailable") return "provider_unavailable";
  if (options.timeout_ms !== undefined && options.timeout_ms <= 0) {
    return "timeout";
  }
  if (request.text.length > config.max_input_chars) return "provider_error";
  return null;
}

function deterministicChunkId(
  request: TtsSynthesisRequest,
  config: TtsProviderConfig,
): string {
  return `fake-${stableHash(
    [
      config.provider_id,
      request.request_id,
      request.session_id,
      request.turn_id,
      request.requested_voice_id,
      request.text,
    ].join("|"),
  )}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function estimateDurationMs(text: string): number {
  return Math.max(250, text.length * 35);
}

function estimateSizeBytes(durationMs: number, textLength: number): number {
  return durationMs * 24 + textLength * 16;
}

function estimateLatencyMs(text: string): number {
  return Math.max(1, Math.ceil(text.length / 8));
}
