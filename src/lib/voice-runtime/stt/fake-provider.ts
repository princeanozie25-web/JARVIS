import {
  FAKE_STT_PROVIDER_CONFIG,
  FAKE_STT_TRANSCRIPT,
  FAKE_STT_UNAVAILABLE_PROVIDER_HEALTH,
} from "./fixtures";
import type { SttProvider } from "./provider";
import { validateSttTranscriptionRequest } from "./provider";
import type {
  SttCancellationReason,
  SttProviderConfig,
  SttProviderHealth,
  SttTranscriptionOptions,
  SttTranscriptionRequest,
  SttTranscriptionResult,
} from "./types";

export const FAKE_STT_PROVIDER_MODES = [
  "healthy",
  "degraded",
  "unavailable",
] as const;

export type FakeSttProviderMode = (typeof FAKE_STT_PROVIDER_MODES)[number];

export interface FakeSttProviderOptions {
  readonly config?: SttProviderConfig;
  readonly mode?: FakeSttProviderMode;
  readonly now_ms?: () => number;
}

export class FakeSttProviderError extends Error {
  readonly reason: SttCancellationReason | "provider_error";
  readonly metadata_only = true;

  constructor(reason: SttCancellationReason | "provider_error") {
    super(`Fake STT provider failed closed: ${reason}`);
    this.name = "FakeSttProviderError";
    this.reason = reason;
  }
}

export function createFakeSttProvider(
  options: FakeSttProviderOptions = {},
): SttProvider {
  const config = options.config ?? FAKE_STT_PROVIDER_CONFIG;
  const mode = options.mode ?? "healthy";
  const nowMs = options.now_ms ?? (() => 0);
  let cancelledReason: SttCancellationReason | null = null;
  let lastErrorClass: SttCancellationReason | "provider_error" | undefined =
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
    transcribe: async (
      request: SttTranscriptionRequest,
      transcribeOptions: SttTranscriptionOptions,
    ) => {
      const blockedReason = blockedTranscriptionReason(
        transcribeOptions,
        mode,
        cancelledReason,
      );
      if (blockedReason) {
        lastErrorClass = blockedReason;
        throw new FakeSttProviderError(blockedReason);
      }

      const validation = validateSttTranscriptionRequest(request, config);
      if (!validation.ok) {
        lastErrorClass = validation.reasons.includes("audio_too_large")
          ? "policy_blocked"
          : "provider_error";
        throw new FakeSttProviderError(lastErrorClass);
      }

      return {
        request_id: request.request_id,
        provider_id: config.provider_id,
        transcript: FAKE_STT_TRANSCRIPT,
        ...(config.language === undefined ? {} : { language: config.language }),
        latency_ms: estimateLatencyMs(
          request.audio.duration_ms,
          request.audio.size_bytes,
        ),
        degraded: mode === "degraded",
        confidence_band: mode === "degraded" ? "medium" : "high",
        metadata_only: true,
      } satisfies SttTranscriptionResult;
    },
    cancel: async (reason: SttCancellationReason) => {
      cancelledReason = reason;
      lastErrorClass = reason;
    },
    health: async (): Promise<SttProviderHealth> => {
      if (mode === "unavailable") {
        return {
          ...FAKE_STT_UNAVAILABLE_PROVIDER_HEALTH,
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

function blockedTranscriptionReason(
  options: SttTranscriptionOptions,
  mode: FakeSttProviderMode,
  cancelledReason: SttCancellationReason | null,
): SttCancellationReason | null {
  if (options.abort_signal?.aborted) return "abort_signal";
  if (cancelledReason) return cancelledReason;
  if (mode === "unavailable") return "provider_unavailable";
  if (options.timeout_ms !== undefined && options.timeout_ms <= 0) {
    return "timeout";
  }
  return null;
}

function estimateLatencyMs(durationMs: number, sizeBytes: number): number {
  return Math.max(
    1,
    Math.ceil(durationMs / 100) + Math.ceil(sizeBytes / 16000),
  );
}
