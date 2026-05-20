"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  audioSessionReducer,
  initialAudioSessionState,
  listAudioDevices,
  recordAudioTelemetry,
  requestMicrophonePermission,
  startLocalAudioCapture,
  subscribeToAudioDeviceChanges,
  type LocalAudioCaptureHandle,
  type AudioSessionState,
} from "@/lib/audio";
import { initialTranscriptionState } from "@/lib/stt/state";
import { localWhisperPlaceholderProvider } from "@/lib/stt/local-whisper-placeholder";
import { transcriptionProviders } from "@/lib/stt/registry";
import type { VoiceTranscriptChatPayload } from "@/lib/stt/types";

export interface VoiceControlPanelProps {
  initialState?: AudioSessionState;
  transcriptDraftPayload?: VoiceTranscriptChatPayload | null;
  onVoiceDraftSubmitted?: (payload: VoiceTranscriptChatPayload) => void;
}

export function VoiceControlPanel({
  initialState = initialAudioSessionState,
  transcriptDraftPayload = null,
  onVoiceDraftSubmitted,
}: VoiceControlPanelProps) {
  const [state, dispatch] = useReducer(audioSessionReducer, initialState);
  const transcriptionState = initialTranscriptionState;
  const defaultTranscriptionProvider = transcriptionProviders.getDefault();
  const localWhisperInstalled =
    localWhisperPlaceholderProvider.status !== "not_installed";
  const localWhisperRuntimeState = localWhisperPlaceholderProvider.enabled
    ? localWhisperPlaceholderProvider.status
    : "disabled";
  const activeTranscriptionJobLabel = "No active transcription job";
  const canSubmitTranscriptDraft = transcriptDraftPayload !== null;
  const captureRef = useRef<LocalAudioCaptureHandle | null>(null);
  const captureStartAbortRef = useRef<AbortController | null>(null);
  const captureStartingRef = useRef(false);
  const pttHeldRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await listAudioDevices();
      dispatch({ type: "devices_refreshed", ...devices });
    } catch (error) {
      dispatch({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Audio devices could not be listed.",
      });
    }
  }, []);

  const stopActiveCapture = useCallback(
    async (reason: "release" | "devicechange" | "visibility" | "unmount") => {
      captureStartAbortRef.current?.abort();
      captureStartAbortRef.current = null;
      pttHeldRef.current = false;
      const capture = captureRef.current;
      if (!capture) return;
      captureRef.current = null;
      const stoppedAt = Date.now();
      const result = await capture.stop(stoppedAt);
      dispatch({ type: "ptt_stopped", stoppedAt });
      stateRef.current = {
        ...stateRef.current,
        status: "ready",
        pushToTalkActive: false,
        activeCaptureSessionId: null,
        captureStartedAt: null,
        captureDurationMs: result.durationMs,
        streamActive: false,
        vuLevel: 0,
      };
      await recordAudioTelemetry({
        eventType: "audio_capture_stopped",
        status: "ready",
        selectedInputDeviceId: stateRef.current.selectedInputDeviceId,
        selectedOutputDeviceId: stateRef.current.selectedOutputDeviceId,
        notes: `capture_session_id=${capture.metadata.id} duration_ms=${result.durationMs} transient_chunks=${result.chunkCount} reason=${reason}`,
      });
      await recordAudioTelemetry({
        eventType: "ptt_stopped",
        status: "ready",
        selectedInputDeviceId: stateRef.current.selectedInputDeviceId,
        selectedOutputDeviceId: stateRef.current.selectedOutputDeviceId,
        notes: `duration_ms=${result.durationMs} reason=${reason}`,
      });
    },
    [],
  );

  const failActiveCapture = useCallback(async (message: string) => {
    captureStartAbortRef.current?.abort();
    captureStartAbortRef.current = null;
    const capture = captureRef.current;
    pttHeldRef.current = false;
    captureRef.current = null;
    await capture?.stop();
    dispatch({ type: "capture_error", message });
    stateRef.current = {
      ...stateRef.current,
      status: "error",
      pushToTalkActive: false,
      activeCaptureSessionId: null,
      captureStartedAt: null,
      streamActive: false,
      vuLevel: 0,
      errorMessage: message,
    };
    await recordAudioTelemetry({
      eventType: "audio_capture_error",
      status: "error",
      selectedInputDeviceId: stateRef.current.selectedInputDeviceId,
      selectedOutputDeviceId: stateRef.current.selectedOutputDeviceId,
      notes: message,
    });
  }, []);

  useEffect(() => {
    void refreshDevices();
    return subscribeToAudioDeviceChanges(() => {
      if (stateRef.current.status === "recording") {
        void failActiveCapture("Audio input changed during capture.");
      }
      void refreshDevices();
    });
  }, [failActiveCapture, refreshDevices]);

  useEffect(() => {
    return () => {
      void stopActiveCapture("unmount");
    };
  }, [stopActiveCapture]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void stopActiveCapture("visibility");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [stopActiveCapture]);

  async function requestPermission() {
    dispatch({ type: "permission_request_started" });
    const result = await requestMicrophonePermission();
    dispatch({
      type: "permission_resolved",
      permissionStatus: result.status,
      errorMessage: result.message,
    });
    await recordAudioTelemetry({
      eventType:
        result.status === "granted"
          ? "mic_permission_granted"
          : "mic_permission_denied",
      status: result.status === "granted" ? "ready" : "error",
      selectedInputDeviceId: stateRef.current.selectedInputDeviceId,
      selectedOutputDeviceId: stateRef.current.selectedOutputDeviceId,
      notes: result.status === "granted" ? undefined : result.message,
    });
    if (result.status === "granted") {
      void refreshDevices();
    }
  }

  async function startPushToTalk() {
    const current = stateRef.current;
    if (captureRef.current || captureStartingRef.current) return;
    if (
      current.microphonePermissionStatus !== "granted" ||
      (current.status !== "idle" && current.status !== "ready")
    ) {
      return;
    }
    captureStartingRef.current = true;
    const startAbort = new AbortController();
    captureStartAbortRef.current = startAbort;
    try {
      const capture = await startLocalAudioCapture({
        deviceId: current.selectedInputDeviceId || undefined,
        signal: startAbort.signal,
        onVu(update) {
          dispatch({ type: "capture_vu_updated", ...update });
        },
        onEnded(reason) {
          void failActiveCapture(reason);
        },
      });
      captureStartAbortRef.current = null;
      captureRef.current = capture;
      await recordAudioTelemetry({
        eventType: "audio_capture_started",
        status: "recording",
        selectedInputDeviceId: current.selectedInputDeviceId,
        selectedOutputDeviceId: current.selectedOutputDeviceId,
        notes: `capture_session_id=${capture.metadata.id} sample_rate=${capture.metadata.sampleRate ?? "unknown"}`,
      });
      if (!pttHeldRef.current) {
        await stopActiveCapture("release");
        return;
      }
      dispatch({
        type: "ptt_started",
        captureSessionId: capture.metadata.id,
        startedAt: capture.metadata.startedAt,
        sampleRate: capture.metadata.sampleRate,
        streamActive: capture.metadata.streamActive,
      });
      stateRef.current = {
        ...current,
        status: "recording",
        pushToTalkActive: true,
        activeCaptureSessionId: capture.metadata.id,
        captureStartedAt: capture.metadata.startedAt,
        captureDurationMs: 0,
        captureSampleRate: capture.metadata.sampleRate,
        streamActive: capture.metadata.streamActive,
        vuLevel: 0,
        errorMessage: undefined,
      };
      await recordAudioTelemetry({
        eventType: "ptt_started",
        status: "recording",
        selectedInputDeviceId: current.selectedInputDeviceId,
        selectedOutputDeviceId: current.selectedOutputDeviceId,
        notes: `capture_session_id=${capture.metadata.id}`,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        !pttHeldRef.current
      ) {
        return;
      }
      await failActiveCapture(
        error instanceof Error
          ? error.message
          : "Audio capture could not be started.",
      );
    } finally {
      if (captureStartAbortRef.current === startAbort) {
        captureStartAbortRef.current = null;
      }
      captureStartingRef.current = false;
    }
  }

  async function stopPushToTalk() {
    await stopActiveCapture("release");
  }

  const canRecord =
    state.microphonePermissionStatus === "granted" &&
    (state.status === "idle" || state.status === "ready");
  const isRecording = state.status === "recording";
  const vuBars = [0.3, 0.55, 0.8, 1, 0.7, 0.45, 0.25].map((scale) =>
    isRecording ? Math.max(6, Math.round(state.vuLevel * 48 * scale)) : 6,
  );

  return (
    <section className="w-full max-w-3xl mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4 text-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Voice Scaffold
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Push-to-talk lifecycle only; no transcription or speech output
          </p>
        </div>
        <span
          className={`rounded border px-2 py-1 text-xs ${
            isRecording
              ? "border-red-500 bg-red-950 text-red-200"
              : state.status === "ready"
                ? "border-emerald-700 bg-emerald-950 text-emerald-200"
                : "border-gray-700 text-gray-400"
          }`}
        >
          Mic {state.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-400">
          Microphone
          <select
            className="mt-1 w-full rounded-md border border-gray-800 bg-black p-2 text-sm text-gray-200"
            value={state.selectedInputDeviceId}
            onChange={(event) =>
              dispatch({
                type: "input_selected",
                deviceId: event.target.value,
              })
            }
          >
            <option value="">Browser default</option>
            {state.inputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-400">
          Speaker
          <select
            className="mt-1 w-full rounded-md border border-gray-800 bg-black p-2 text-sm text-gray-200"
            value={state.selectedOutputDeviceId}
            onChange={(event) =>
              dispatch({
                type: "output_selected",
                deviceId: event.target.value,
              })
            }
          >
            <option value="">Browser default</option>
            {state.outputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={state.status === "requesting_permission"}
          onClick={requestPermission}
        >
          {state.microphonePermissionStatus === "granted"
            ? "Check Microphone"
            : "Enable Microphone"}
        </button>

        <button
          type="button"
          aria-pressed={isRecording}
          disabled={!canRecord && !isRecording}
          onPointerDown={(event) => {
            pttHeldRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            void startPushToTalk();
          }}
          onPointerUp={(event) => {
            pttHeldRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
            void stopPushToTalk();
          }}
          onPointerCancel={() => {
            pttHeldRef.current = false;
            void stopPushToTalk();
          }}
          onKeyDown={(event) => {
            if (event.repeat || event.code !== "Space") return;
            event.preventDefault();
            pttHeldRef.current = true;
            void startPushToTalk();
          }}
          onKeyUp={(event) => {
            if (event.code !== "Space") return;
            event.preventDefault();
            pttHeldRef.current = false;
            void stopPushToTalk();
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            isRecording
              ? "bg-red-600 text-white"
              : "bg-white text-black disabled:bg-gray-700 disabled:text-gray-400"
          }`}
        >
          Hold to Talk
        </button>

        <button
          type="button"
          className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300"
          onClick={() => {
            void refreshDevices();
          }}
        >
          Refresh Devices
        </button>
      </div>

      {state.errorMessage && (
        <p className="mt-3 rounded-md border border-red-900 bg-red-950 p-3 text-sm text-red-200">
          {state.errorMessage}
        </p>
      )}

      <div className="mt-4 rounded-md border border-gray-800 bg-black p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>VU placeholder</span>
          <span>{state.pushToTalkActive ? "Mic active" : "Mic inactive"}</span>
        </div>
        <div className="flex h-12 items-end gap-1" aria-hidden="true">
          {vuBars.map((height, index) => (
            <div
              key={index}
              className={`w-4 rounded-sm ${
                isRecording ? "bg-red-500" : "bg-gray-800"
              }`}
              style={{ height }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {state.activeCaptureSessionId
            ? `session ${state.activeCaptureSessionId} - ${state.captureDurationMs}ms - ${state.captureSampleRate ?? "unknown"}Hz`
            : "No active capture session"}
          {state.streamActive ? " - stream active" : ""}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-gray-800 bg-black p-3 opacity-60">
          <h3 className="text-xs font-semibold uppercase text-gray-500">
            Transcript
          </h3>
          <p className="mt-2 text-sm text-gray-500">STT not configured yet.</p>
          <p className="mt-1 text-xs text-gray-600">
            Default provider {defaultTranscriptionProvider.id}:{" "}
            {transcriptionState.status}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Local provider {localWhisperPlaceholderProvider.id}:{" "}
            {localWhisperInstalled ? "installed" : "not installed"}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Runtime state: {localWhisperRuntimeState}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {activeTranscriptionJobLabel}
          </p>
          <div className="mt-3 rounded-md border border-gray-900 bg-gray-950 p-3">
            <p className="text-xs font-semibold uppercase text-gray-500">
              Transcript draft
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Voice transcript must be reviewed before sending.
            </p>
            <button
              type="button"
              disabled={!canSubmitTranscriptDraft}
              onClick={() => {
                if (!transcriptDraftPayload) return;
                onVoiceDraftSubmitted?.(transcriptDraftPayload);
              }}
              className="mt-3 rounded-md border border-gray-800 px-3 py-2 text-xs text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit reviewed transcript
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            local only, no network, no audio storage
          </p>
        </div>
        <div className="rounded-md border border-gray-800 bg-black p-3 opacity-60">
          <h3 className="text-xs font-semibold uppercase text-gray-500">
            Speaker
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Disabled until text-to-speech is implemented.
          </p>
        </div>
      </div>
    </section>
  );
}
