import type { MicCaptureResultMetadata } from "./capture";
import type { PlaybackQueue, PlaybackQueueItem } from "./playback";
import type {
  SttConfidenceBand,
  SttProvider,
  SttTranscriptionOptions,
} from "./stt";
import type { TtsContentClass, TtsProvider, TtsSynthesisOptions } from "./tts";

export type VoiceRuntimeBridgeStatus =
  | "idle"
  | "transcribing"
  | "ready_for_runtime"
  | "synthesizing"
  | "queued_for_playback"
  | "failed";

export type VoiceRuntimeBridgeFailureReason =
  | "malformed_capture"
  | "session_active"
  | "stt_unavailable"
  | "stt_failed"
  | "no_transcription"
  | "unsafe_content"
  | "tts_unavailable"
  | "tts_failed"
  | "enqueue_failed"
  | "autoplay_blocked"
  | "runtime_execution_blocked";

export interface VoiceRuntimeBridgeSnapshot {
  readonly session_id: string | null;
  readonly turn_id: string | null;
  readonly stt_status: VoiceRuntimeBridgeStatus;
  readonly tts_status: VoiceRuntimeBridgeStatus;
  readonly playback_queue_depth: number;
  readonly last_error_class?: VoiceRuntimeBridgeFailureReason;
  readonly degraded: boolean;
  readonly started_at?: string;
  readonly updated_at?: string;
  readonly metadata_only: true;
}

export interface VoiceRuntimeBridgeCapturedAudioMetadata extends MicCaptureResultMetadata {
  readonly session_id: string;
  readonly turn_id: string;
}

export interface VoiceRuntimeRequestMetadata {
  readonly request_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly capability: "chat";
  readonly input_kind: "voice_text";
  readonly input_length: number;
  readonly language?: string;
  readonly confidence_band: SttConfidenceBand;
  readonly stt_provider_id: string;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface VoicePlaybackRequestInput {
  readonly request_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly text: string;
  readonly content_class: TtsContentClass;
  readonly requested_voice_id?: string;
  readonly allow_autoplay?: boolean;
  readonly metadata_only: true;
}

export interface VoicePlaybackRequestMetadata {
  readonly request_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly item_id: string;
  readonly chunk_id: string;
  readonly provider_id: string;
  readonly voice_id: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly playback_queue_depth: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export type VoiceRuntimeBridgeResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly snapshot: VoiceRuntimeBridgeSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly value: null;
      readonly snapshot: VoiceRuntimeBridgeSnapshot;
      readonly reasons: readonly VoiceRuntimeBridgeFailureReason[];
      readonly metadata_only: true;
    };

export interface VoiceRuntimeBridgeOptions {
  readonly stt_provider: SttProvider;
  readonly tts_provider: TtsProvider;
  readonly playback_queue: PlaybackQueue;
  readonly now_ms?: () => number;
}

export interface VoiceRuntimeBridge {
  ingestCapturedAudio(
    metadata: unknown,
    options?: SttTranscriptionOptions,
  ): Promise<VoiceRuntimeBridgeResult<VoiceRuntimeRequestMetadata>>;
  createVoiceRuntimeRequest(): VoiceRuntimeBridgeResult<VoiceRuntimeRequestMetadata>;
  createVoicePlaybackRequest(
    input: VoicePlaybackRequestInput,
    options?: TtsSynthesisOptions,
  ): Promise<VoiceRuntimeBridgeResult<VoicePlaybackRequestMetadata>>;
  reset(): VoiceRuntimeBridgeResult<null>;
  snapshot(): VoiceRuntimeBridgeSnapshot;
}

export function createVoiceRuntimeBridge(
  options: VoiceRuntimeBridgeOptions,
): VoiceRuntimeBridge {
  const nowMs = options.now_ms ?? (() => Date.now());
  let snapshot: VoiceRuntimeBridgeSnapshot = idleSnapshot(
    options.playback_queue,
  );
  let runtimeRequest: VoiceRuntimeRequestMetadata | null = null;
  let sessionActive = false;

  const copySnapshot = (): VoiceRuntimeBridgeSnapshot => ({ ...snapshot });

  return {
    ingestCapturedAudio: async (metadata, sttOptions) => {
      if (sessionActive) return failure(["session_active"]);
      if (!isCaptureMetadata(metadata)) return failure(["malformed_capture"]);

      const startedAt = timestamp(nowMs());
      sessionActive = true;
      snapshot = {
        ...snapshot,
        session_id: metadata.session_id,
        turn_id: metadata.turn_id,
        stt_status: "transcribing",
        started_at: startedAt,
        updated_at: startedAt,
      };

      const health = await options.stt_provider.health();
      if (!health.ok) {
        snapshot = {
          ...snapshot,
          stt_status: "failed",
          last_error_class: "stt_unavailable",
          degraded: true,
          updated_at: timestamp(nowMs()),
        };
        return failure(["stt_unavailable"]);
      }

      try {
        const result = await options.stt_provider.transcribe(
          {
            request_id: `voice-runtime-${metadata.session_id}-${metadata.turn_id}`,
            session_id: metadata.session_id,
            turn_id: metadata.turn_id,
            audio: {
              audio_ref: metadata.audio_ref,
              mime_type: "audio/wav",
              duration_ms: metadata.duration_ms,
              size_bytes: metadata.size_bytes,
              sample_rate_hz: metadata.sample_rate_hz,
              metadata_only: true,
            },
            metadata_only: true,
          },
          sttOptions ?? { metadata_only: true },
        );
        runtimeRequest = {
          request_id: result.request_id,
          session_id: metadata.session_id,
          turn_id: metadata.turn_id,
          capability: "chat",
          input_kind: "voice_text",
          input_length: result.transcript.length,
          ...(result.language === undefined
            ? {}
            : { language: result.language }),
          confidence_band: result.confidence_band,
          stt_provider_id: result.provider_id,
          degraded: result.degraded || health.degraded,
          metadata_only: true,
        };
        snapshot = {
          ...snapshot,
          stt_status: "ready_for_runtime",
          degraded: runtimeRequest.degraded,
          updated_at: timestamp(nowMs()),
        };
        return success(runtimeRequest);
      } catch {
        runtimeRequest = null;
        snapshot = {
          ...snapshot,
          stt_status: "failed",
          last_error_class: "stt_failed",
          degraded: true,
          updated_at: timestamp(nowMs()),
        };
        return failure(["stt_failed"]);
      }
    },
    createVoiceRuntimeRequest: () => {
      if (!runtimeRequest) return failure(["no_transcription"]);
      return success(runtimeRequest);
    },
    createVoicePlaybackRequest: async (input, ttsOptions) => {
      if (!isVoicePlaybackRequestInput(input)) {
        return failure(["unsafe_content"]);
      }
      if (input.allow_autoplay === true) return failure(["autoplay_blocked"]);
      if (input.content_class !== "assistant_prose") {
        return failure(["unsafe_content"]);
      }

      snapshot = {
        ...snapshot,
        session_id: input.session_id,
        turn_id: input.turn_id,
        tts_status: "synthesizing",
        updated_at: timestamp(nowMs()),
      };

      const health = await options.tts_provider.health();
      if (!health.ok) {
        snapshot = {
          ...snapshot,
          tts_status: "failed",
          last_error_class: "tts_unavailable",
          degraded: true,
          updated_at: timestamp(nowMs()),
        };
        return failure(["tts_unavailable"]);
      }

      try {
        const result = await options.tts_provider.synthesize(
          {
            request_id: input.request_id,
            text: input.text,
            content_class: input.content_class,
            turn_id: input.turn_id,
            session_id: input.session_id,
            requested_voice_id:
              input.requested_voice_id ?? options.tts_provider.config.voice_id,
            allow_sensitive_content: false,
            metadata_only: true,
          },
          ttsOptions ?? { metadata_only: true },
        );
        const item: PlaybackQueueItem = {
          item_id: `voice-playback-${result.chunk.chunk_id}`,
          session_id: input.session_id,
          turn_id: input.turn_id,
          chunk_id: result.chunk.chunk_id,
          provider_id: result.chunk.provider_id,
          voice_id: result.chunk.voice_id,
          audio_ref: result.chunk.output_ref,
          duration_ms: result.chunk.duration_ms,
          size_bytes: result.chunk.size_bytes,
          content_class: "assistant_prose",
          created_at: timestamp(nowMs()),
          metadata_only: true,
        };
        const enqueueResult = options.playback_queue.enqueue(item);
        if (!enqueueResult.ok) {
          snapshot = {
            ...snapshot,
            tts_status: "failed",
            playback_queue_depth: enqueueResult.snapshot.depth,
            last_error_class: "enqueue_failed",
            updated_at: timestamp(nowMs()),
          };
          return failure(["enqueue_failed"]);
        }
        const request: VoicePlaybackRequestMetadata = {
          request_id: result.request_id,
          session_id: input.session_id,
          turn_id: input.turn_id,
          item_id: item.item_id,
          chunk_id: item.chunk_id,
          provider_id: item.provider_id,
          voice_id: item.voice_id,
          duration_ms: item.duration_ms,
          size_bytes: item.size_bytes,
          playback_queue_depth: enqueueResult.snapshot.depth,
          degraded: result.degraded || health.degraded,
          metadata_only: true,
        };
        snapshot = {
          ...snapshot,
          tts_status: "queued_for_playback",
          playback_queue_depth: enqueueResult.snapshot.depth,
          degraded: snapshot.degraded || request.degraded,
          updated_at: timestamp(nowMs()),
        };
        return success(request);
      } catch {
        snapshot = {
          ...snapshot,
          tts_status: "failed",
          last_error_class: "tts_failed",
          degraded: true,
          updated_at: timestamp(nowMs()),
        };
        return failure(["tts_failed"]);
      }
    },
    reset: () => {
      options.playback_queue.clear("voice_runtime_bridge_reset");
      runtimeRequest = null;
      sessionActive = false;
      snapshot = idleSnapshot(options.playback_queue);
      return success(null);
    },
    snapshot: copySnapshot,
  };

  function success<T>(value: T): VoiceRuntimeBridgeResult<T> {
    return {
      ok: true,
      value: copyValue(value),
      snapshot: copySnapshot(),
      reasons: [],
      metadata_only: true,
    };
  }

  function failure<T>(
    reasons: readonly VoiceRuntimeBridgeFailureReason[],
  ): VoiceRuntimeBridgeResult<T> {
    return {
      ok: false,
      value: null,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }
}

function idleSnapshot(queue: PlaybackQueue): VoiceRuntimeBridgeSnapshot {
  return {
    session_id: null,
    turn_id: null,
    stt_status: "idle",
    tts_status: "idle",
    playback_queue_depth: queue.snapshot().depth,
    degraded: false,
    metadata_only: true,
  };
}

function isCaptureMetadata(
  value: unknown,
): value is VoiceRuntimeBridgeCapturedAudioMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.audio_ref === "string" &&
    record.audio_ref.length > 0 &&
    typeof record.duration_ms === "number" &&
    record.duration_ms > 0 &&
    typeof record.size_bytes === "number" &&
    record.size_bytes > 0 &&
    typeof record.sample_rate_hz === "number" &&
    record.sample_rate_hz > 0 &&
    typeof record.channel_count === "number" &&
    record.channel_count > 0 &&
    typeof record.session_id === "string" &&
    record.session_id.length > 0 &&
    typeof record.turn_id === "string" &&
    record.turn_id.length > 0 &&
    record.metadata_only === true &&
    !hasForbiddenKeys(record)
  );
}

function isVoicePlaybackRequestInput(
  value: unknown,
): value is VoicePlaybackRequestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.request_id === "string" &&
    record.request_id.length > 0 &&
    typeof record.session_id === "string" &&
    record.session_id.length > 0 &&
    typeof record.turn_id === "string" &&
    record.turn_id.length > 0 &&
    typeof record.text === "string" &&
    record.text.length > 0 &&
    typeof record.content_class === "string" &&
    typeof record.metadata_only === "boolean" &&
    record.metadata_only === true &&
    !hasForbiddenKeys(record)
  );
}

function hasForbiddenKeys(record: Record<string, unknown>): boolean {
  return [
    "raw_audio",
    "audio_bytes",
    "waveform",
    "pcm",
    "prompt",
    "response",
    "model_output",
    "tool_output",
  ].some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function copyValue<T>(value: T): T {
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) } as T;
  }
  return value;
}

function timestamp(ms: number): string {
  return new Date(ms).toISOString();
}
