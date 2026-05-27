import type { PlaybackQueue } from "./playback";
import { createVoiceRuntimeBridge } from "./runtime-bridge";
import type {
  VoiceRuntimeAdapter,
  VoiceRuntimeAdapterResponse,
} from "./runtime-adapter";
import type { SttProvider } from "./stt";
import type { TtsContentClass, TtsProvider } from "./tts";

export type VoiceTurnPhase =
  | "idle"
  | "transcribing"
  | "executing_runtime"
  | "synthesizing"
  | "queued_for_playback"
  | "failed"
  | "cancelled";

export type VoiceTurnStageStatus =
  | "idle"
  | "running"
  | "complete"
  | "failed"
  | "cancelled";

export type VoiceTurnFailureReason =
  | "malformed_capture"
  | "stt_unavailable"
  | "stt_failed"
  | "runtime_unavailable"
  | "runtime_failed"
  | "runtime_cancelled"
  | "tts_unavailable"
  | "tts_failed"
  | "unsafe_content"
  | "enqueue_failed"
  | "cancelled";

export interface VoiceTurnSnapshot {
  readonly turn_id: string | null;
  readonly session_id: string | null;
  readonly phase: VoiceTurnPhase;
  readonly stt_status: VoiceTurnStageStatus;
  readonly runtime_status: VoiceTurnStageStatus;
  readonly tts_status: VoiceTurnStageStatus;
  readonly playback_status: VoiceTurnStageStatus;
  readonly playback_queue_depth: number;
  readonly degraded: boolean;
  readonly error_class?: VoiceTurnFailureReason;
  readonly metadata_only: true;
}

export interface VoiceTurnResultMetadata {
  readonly session_id: string;
  readonly turn_id: string;
  readonly runtime_response_id: string;
  readonly playback_item_id: string;
  readonly playback_queue_depth: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export type VoiceTurnResult =
  | {
      readonly ok: true;
      readonly value: VoiceTurnResultMetadata | null;
      readonly snapshot: VoiceTurnSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly value: null;
      readonly snapshot: VoiceTurnSnapshot;
      readonly reasons: readonly VoiceTurnFailureReason[];
      readonly metadata_only: true;
    };

export interface VoiceTurnRunOptions {
  readonly timeout_ms?: number;
  readonly abort_signal?: AbortSignal;
  readonly requested_voice_id?: string;
  readonly assistant_content_class?: TtsContentClass;
  readonly metadata_only: true;
}

export interface VoiceTurnOrchestratorOptions {
  readonly stt_provider: SttProvider;
  readonly runtime_adapter: VoiceRuntimeAdapter;
  readonly tts_provider: TtsProvider;
  readonly playback_queue: PlaybackQueue;
}

export interface VoiceTurnOrchestrator {
  runVoiceTurn(
    captureMetadata: unknown,
    options?: VoiceTurnRunOptions,
  ): Promise<VoiceTurnResult>;
  reset(): VoiceTurnResult;
  snapshot(): VoiceTurnSnapshot;
}

export function createVoiceTurnOrchestrator(
  options: VoiceTurnOrchestratorOptions,
): VoiceTurnOrchestrator {
  const bridge = createVoiceRuntimeBridge({
    stt_provider: options.stt_provider,
    runtime_adapter: options.runtime_adapter,
    tts_provider: options.tts_provider,
    playback_queue: options.playback_queue,
  });
  let snapshot: VoiceTurnSnapshot = idleSnapshot(options.playback_queue);

  const copySnapshot = (): VoiceTurnSnapshot => ({ ...snapshot });

  return {
    runVoiceTurn: async (captureMetadata, runOptions) => {
      if (runOptions?.abort_signal?.aborted) {
        return fail(["cancelled"], {
          phase: "cancelled",
          stt_status: "cancelled",
          runtime_status: "cancelled",
          tts_status: "cancelled",
          playback_status: "cancelled",
          error_class: "cancelled",
        });
      }

      const ids = readCaptureIds(captureMetadata);
      snapshot = {
        ...snapshot,
        session_id: ids.session_id,
        turn_id: ids.turn_id,
        phase: "transcribing",
        stt_status: "running",
      };
      const sttResult = await bridge.ingestCapturedAudio(captureMetadata, {
        timeout_ms: runOptions?.timeout_ms,
        abort_signal: runOptions?.abort_signal,
        metadata_only: true,
      });
      if (!sttResult.ok) {
        return fail(mapFailure(sttResult.reasons[0]), {
          phase: "failed",
          stt_status: "failed",
          error_class: mapFailure(sttResult.reasons[0])[0],
        });
      }

      snapshot = {
        ...snapshot,
        session_id: sttResult.value.session_id,
        turn_id: sttResult.value.turn_id,
        stt_status: "complete",
        runtime_status: "running",
        phase: "executing_runtime",
        degraded: sttResult.value.degraded,
      };
      const runtimeResult = await bridge.executeRuntimeRequest({
        timeout_ms: runOptions?.timeout_ms,
        abort_signal: runOptions?.abort_signal,
        metadata_only: true,
      });
      if (!runtimeResult.ok) {
        return fail(mapFailure(runtimeResult.reasons[0]), {
          phase:
            runtimeResult.reasons[0] === "runtime_cancelled"
              ? "cancelled"
              : "failed",
          runtime_status:
            runtimeResult.reasons[0] === "runtime_cancelled"
              ? "cancelled"
              : "failed",
          error_class: mapFailure(runtimeResult.reasons[0])[0],
        });
      }

      if (
        runOptions?.assistant_content_class !== undefined &&
        runOptions.assistant_content_class !== "assistant_prose"
      ) {
        return fail(["unsafe_content"], {
          phase: "failed",
          runtime_status: "complete",
          error_class: "unsafe_content",
        });
      }

      snapshot = {
        ...snapshot,
        runtime_status: "complete",
        tts_status: "running",
        phase: "synthesizing",
        degraded: snapshot.degraded || runtimeResult.value.degraded,
      };
      const playbackResult = await createPlaybackRequest(
        runtimeResult.value,
        runOptions,
      );
      if (!playbackResult.ok) {
        return fail(mapFailure(playbackResult.reasons[0]), {
          phase: "failed",
          tts_status:
            playbackResult.reasons[0] === "tts_failed" ||
            playbackResult.reasons[0] === "tts_unavailable"
              ? "failed"
              : snapshot.tts_status,
          playback_status:
            playbackResult.reasons[0] === "enqueue_failed"
              ? "failed"
              : snapshot.playback_status,
          error_class: mapFailure(playbackResult.reasons[0])[0],
        });
      }

      snapshot = {
        ...snapshot,
        tts_status: "complete",
        playback_status: "complete",
        phase: "queued_for_playback",
        playback_queue_depth: playbackResult.value.playback_queue_depth,
        degraded: snapshot.degraded || playbackResult.value.degraded,
      };
      return success({
        session_id: playbackResult.value.session_id,
        turn_id: playbackResult.value.turn_id,
        runtime_response_id: runtimeResult.value.response_id,
        playback_item_id: playbackResult.value.item_id,
        playback_queue_depth: playbackResult.value.playback_queue_depth,
        degraded: snapshot.degraded,
        metadata_only: true,
      });
    },
    reset: () => {
      bridge.reset();
      snapshot = idleSnapshot(options.playback_queue);
      return success(null);
    },
    snapshot: copySnapshot,
  };

  async function createPlaybackRequest(
    runtimeResponse: VoiceRuntimeAdapterResponse,
    runOptions: VoiceTurnRunOptions | undefined,
  ) {
    return bridge.createVoicePlaybackRequest(
      {
        request_id: runtimeResponse.response_id,
        session_id: snapshot.session_id ?? "voice-session",
        turn_id: snapshot.turn_id ?? "voice-turn",
        text: runtimeResponse.assistant_text,
        content_class: runOptions?.assistant_content_class ?? "assistant_prose",
        requested_voice_id: runOptions?.requested_voice_id,
        metadata_only: true,
      },
      {
        timeout_ms: runOptions?.timeout_ms,
        abort_signal: runOptions?.abort_signal,
        metadata_only: true,
      },
    );
  }

  function success(value: VoiceTurnResultMetadata | null): VoiceTurnResult {
    return value === null
      ? {
          ok: true,
          value: null,
          snapshot: copySnapshot(),
          reasons: [],
          metadata_only: true,
        }
      : {
          ok: true,
          value: { ...value },
          snapshot: copySnapshot(),
          reasons: [],
          metadata_only: true,
        };
  }

  function fail(
    reasons: readonly VoiceTurnFailureReason[],
    patch: Partial<VoiceTurnSnapshot>,
  ): VoiceTurnResult {
    snapshot = {
      ...snapshot,
      ...patch,
      playback_queue_depth: options.playback_queue.snapshot().depth,
      degraded: true,
    };
    return {
      ok: false,
      value: null,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }
}

function idleSnapshot(playbackQueue: PlaybackQueue): VoiceTurnSnapshot {
  return {
    turn_id: null,
    session_id: null,
    phase: "idle",
    stt_status: "idle",
    runtime_status: "idle",
    tts_status: "idle",
    playback_status: "idle",
    playback_queue_depth: playbackQueue.snapshot().depth,
    degraded: false,
    metadata_only: true,
  };
}

function readCaptureIds(captureMetadata: unknown): {
  readonly session_id: string | null;
  readonly turn_id: string | null;
} {
  if (!captureMetadata || typeof captureMetadata !== "object") {
    return { session_id: null, turn_id: null };
  }
  const record = captureMetadata as Record<string, unknown>;
  return {
    session_id:
      typeof record.session_id === "string" ? record.session_id : null,
    turn_id: typeof record.turn_id === "string" ? record.turn_id : null,
  };
}

function mapFailure(reason: unknown): readonly VoiceTurnFailureReason[] {
  if (
    reason === "malformed_capture" ||
    reason === "stt_unavailable" ||
    reason === "stt_failed" ||
    reason === "runtime_unavailable" ||
    reason === "runtime_failed" ||
    reason === "runtime_cancelled" ||
    reason === "tts_unavailable" ||
    reason === "tts_failed" ||
    reason === "unsafe_content" ||
    reason === "enqueue_failed"
  ) {
    return [reason];
  }
  return ["runtime_failed"];
}
