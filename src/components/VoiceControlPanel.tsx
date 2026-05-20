"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  audioSessionReducer,
  initialAudioSessionState,
  listAudioDevices,
  recordAudioTelemetry,
  requestMicrophonePermission,
  stopMediaStream,
  subscribeToAudioDeviceChanges,
  type AudioSessionState,
} from "@/lib/audio";

export interface VoiceControlPanelProps {
  initialState?: AudioSessionState;
}

export function VoiceControlPanel({
  initialState = initialAudioSessionState,
}: VoiceControlPanelProps) {
  const [state, dispatch] = useReducer(audioSessionReducer, initialState);
  const streamRef = useRef<MediaStream | undefined>(undefined);
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

  useEffect(() => {
    void refreshDevices();
    return subscribeToAudioDeviceChanges(() => {
      void refreshDevices();
    });
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      stopMediaStream(streamRef.current);
      streamRef.current = undefined;
    };
  }, []);

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
    if (
      current.microphonePermissionStatus !== "granted" ||
      (current.status !== "idle" && current.status !== "ready")
    ) {
      return;
    }
    const startedAt = Date.now();
    dispatch({ type: "ptt_started", startedAt });
    stateRef.current = {
      ...current,
      status: "recording",
      pushToTalkActive: true,
      captureStartedAt: startedAt,
      errorMessage: undefined,
    };
    await recordAudioTelemetry({
      eventType: "ptt_started",
      status: "recording",
      selectedInputDeviceId: current.selectedInputDeviceId,
      selectedOutputDeviceId: current.selectedOutputDeviceId,
    });
  }

  async function stopPushToTalk() {
    const current = stateRef.current;
    if (current.status !== "recording") return;
    dispatch({ type: "ptt_stopped" });
    stateRef.current = {
      ...current,
      status: "ready",
      pushToTalkActive: false,
      captureStartedAt: null,
    };
    await recordAudioTelemetry({
      eventType: "ptt_stopped",
      status: "ready",
      selectedInputDeviceId: current.selectedInputDeviceId,
      selectedOutputDeviceId: current.selectedOutputDeviceId,
      notes:
        current.captureStartedAt === null
          ? undefined
          : `duration_ms=${Date.now() - current.captureStartedAt}`,
    });
  }

  const canRecord =
    state.microphonePermissionStatus === "granted" &&
    (state.status === "idle" || state.status === "ready");
  const isRecording = state.status === "recording";

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
            event.currentTarget.setPointerCapture(event.pointerId);
            void startPushToTalk();
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            void stopPushToTalk();
          }}
          onPointerCancel={() => {
            void stopPushToTalk();
          }}
          onKeyDown={(event) => {
            if (event.repeat || event.code !== "Space") return;
            event.preventDefault();
            void startPushToTalk();
          }}
          onKeyUp={(event) => {
            if (event.code !== "Space") return;
            event.preventDefault();
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
          {[20, 34, 48, 28, 40, 24, 16].map((height, index) => (
            <div
              key={index}
              className={`w-4 rounded-sm ${
                isRecording ? "bg-red-500" : "bg-gray-800"
              }`}
              style={{ height }}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-gray-800 bg-black p-3 opacity-60">
          <h3 className="text-xs font-semibold uppercase text-gray-500">
            Transcript
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Disabled until speech-to-text is implemented.
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
