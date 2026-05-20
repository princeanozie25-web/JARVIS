import { disabledSpeechResult } from "./disabled-provider";
import {
  assertLocalSpeechOnly,
  localTtsRuntimeMetadata,
  type LocalTtsSynthesisHandle,
} from "./local-runtime";
import { evaluateSpeechSafetyPolicy } from "./safety-policy";
import type {
  LocalSpeechProviderConfig,
  SpeechAudioResult,
  SpeechChunk,
  SpeechProvider,
  SpeechProviderMetadata,
  SpeechProviderStatus,
  SpeechQueueItem,
  SpeechSynthesisInput,
  SpeechSynthesisResult,
  SpeechSynthesisRunOptions,
} from "./types";

export type LocalTtsSynthesisTelemetryEventType =
  | "local_tts_synthesis_started"
  | "local_tts_synthesis_completed"
  | "local_tts_synthesis_failed";

export interface LocalTtsSynthesisTelemetryEvent {
  eventType: LocalTtsSynthesisTelemetryEventType;
  providerId: string;
  chunkId?: string;
  success: boolean;
  durationMs?: number;
  byteLength?: number;
  error?: string;
}

export interface LocalTtsSynthesisProviderOptions {
  enabled: boolean;
  status: SpeechProviderStatus;
  handle: LocalTtsSynthesisHandle | null;
  config: LocalSpeechProviderConfig;
  metadata?: SpeechProviderMetadata;
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (event: LocalTtsSynthesisTelemetryEvent) => void;
}

export interface SynthesizeQueueItemResult {
  item: SpeechQueueItem;
  result: SpeechSynthesisResult;
}

const DEFAULT_EXECUTION_TIMEOUT_MS = 30_000;
const LOCAL_TTS_PROVIDER_ID = "local-tts-placeholder";

export function createLocalTtsSynthesisProvider(
  opts: LocalTtsSynthesisProviderOptions,
): SpeechProvider {
  const metadata = opts.metadata ?? localTtsRuntimeMetadata;
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());

  return {
    id: LOCAL_TTS_PROVIDER_ID,
    enabled: opts.enabled,
    status: opts.status,
    config: opts.config,
    metadata,
    async synthesize(
      input: SpeechSynthesisInput,
      runOptions: SpeechSynthesisRunOptions = {},
    ): Promise<SpeechSynthesisResult> {
      const startedAt = now();
      const chunkId = input.chunkId;

      if (!opts.enabled) {
        return disabledSpeechResult("provider_disabled", LOCAL_TTS_PROVIDER_ID);
      }
      if (opts.status !== "ready") {
        return disabledSpeechResult(
          "provider_unavailable",
          LOCAL_TTS_PROVIDER_ID,
        );
      }
      if (!opts.handle) {
        return disabledSpeechResult(
          "provider_unavailable",
          LOCAL_TTS_PROVIDER_ID,
        );
      }

      try {
        assertLocalSpeechOnly(metadata);
      } catch (error) {
        return failedResult(error);
      }

      const decision = evaluateSpeechSafetyPolicy(input);
      if (!decision.allowed) {
        return {
          status: "blocked",
          providerId: LOCAL_TTS_PROVIDER_ID,
          audio: null,
          reason: decision.reason ?? "assistant_prose_required",
        };
      }

      opts.emitTelemetry?.({
        eventType: "local_tts_synthesis_started",
        providerId: LOCAL_TTS_PROVIDER_ID,
        chunkId,
        success: true,
      });

      try {
        const output = await synthesizeWithTimeout({
          handle: opts.handle,
          input,
          config: opts.config,
          signal: runOptions.signal,
        });
        const audio: SpeechAudioResult = {
          id: newId(),
          chunkId: chunkId ?? "speech-input",
          mimeType: output.mimeType,
          durationMs: output.durationMs,
          sampleRate: output.sampleRate,
          byteLength: output.data.byteLength,
          createdAt: now(),
          source: "local_tts",
          data: output.data,
        };
        opts.emitTelemetry?.({
          eventType: "local_tts_synthesis_completed",
          providerId: LOCAL_TTS_PROVIDER_ID,
          chunkId: audio.chunkId,
          success: true,
          durationMs: Math.max(0, now() - startedAt),
          byteLength: audio.byteLength,
        });
        return {
          status: "completed",
          providerId: LOCAL_TTS_PROVIDER_ID,
          audio,
        };
      } catch (error) {
        opts.emitTelemetry?.({
          eventType: "local_tts_synthesis_failed",
          providerId: LOCAL_TTS_PROVIDER_ID,
          chunkId,
          success: false,
          durationMs: Math.max(0, now() - startedAt),
          error: synthesisErrorCode(error),
        });
        return failedResult(error);
      }
    },
  };
}

export function speechInputFromChunk(chunk: SpeechChunk): SpeechSynthesisInput {
  return {
    text: chunk.text,
    source: chunk.source,
    chunkId: chunk.id,
  };
}

export async function synthesizeQueuedSpeechItem(input: {
  provider: SpeechProvider;
  item: SpeechQueueItem;
  markReady: (itemId: string) => SpeechQueueItem | null;
  fail: (itemId: string, error: string) => SpeechQueueItem | null;
  signal?: AbortSignal;
}): Promise<SynthesizeQueueItemResult> {
  const result = await input.provider.synthesize(
    {
      text: input.item.text,
      source: "assistant_prose",
      chunkId: input.item.chunkId,
    },
    { signal: input.signal },
  );

  if (result.status === "completed") {
    return {
      item: input.markReady(input.item.id) ?? input.item,
      result,
    };
  }

  return {
    item:
      input.fail(input.item.id, result.reason ?? "synthesis_failed") ??
      input.item,
    result,
  };
}

async function synthesizeWithTimeout(input: {
  handle: LocalTtsSynthesisHandle;
  input: SpeechSynthesisInput;
  config: LocalSpeechProviderConfig;
  signal?: AbortSignal;
}) {
  const executionAbort = new AbortController();
  const timeoutMs =
    input.config.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: ((reason?: unknown) => void) | undefined;
  const abortError = () =>
    Object.assign(new Error("Local TTS synthesis was aborted."), {
      name: "AbortError",
    });
  const abortFromParent = () => {
    executionAbort.abort();
    rejectAbort?.(abortError());
  };

  if (input.signal?.aborted) {
    throw abortError();
  }
  input.signal?.addEventListener("abort", abortFromParent, { once: true });

  try {
    const launched = input.handle.synthesize(
      {
        text: input.input.text,
        speakerId: input.config.speakerId,
        sampleRate: input.config.sampleRate,
        voiceId: input.input.voiceId,
        language: input.input.language,
      },
      { signal: executionAbort.signal },
    );

    return await Promise.race([
      launched,
      new Promise<never>((_, reject) => {
        rejectAbort = reject;
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          executionAbort.abort();
          reject(new Error("Local TTS synthesis timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromParent);
  }
}

function failedResult(error: unknown): SpeechSynthesisResult {
  return {
    status: "error",
    providerId: LOCAL_TTS_PROVIDER_ID,
    audio: null,
    reason: "provider_unavailable",
    errorMessage: synthesisErrorCode(error),
  };
}

function synthesisErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "synthesis_aborted";
    if (error.message === "Local TTS synthesis timed out.") {
      return "synthesis_timeout";
    }
  }
  return "synthesis_failed";
}
