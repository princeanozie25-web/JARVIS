import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAPTURE_LIFECYCLE_STATES,
  CAPTURE_STATE_EVENTS,
  CAPTURE_TERMINAL_STATES,
  isCaptureLifecycleState,
  isCaptureStateEvent,
  transitionCaptureState,
  type CaptureSessionMetadata,
} from "../../../src/lib/voice-runtime";

function captureSource(): string {
  return [
    "src/lib/voice-runtime/capture/types.ts",
    "src/lib/voice-runtime/capture/state-machine.ts",
    "src/lib/voice-runtime/capture/index.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

describe("Phase 14D.1 push-to-talk capture state machine", () => {
  it("defines the capture lifecycle states and events", () => {
    expect(CAPTURE_LIFECYCLE_STATES).toEqual([
      "idle",
      "arming",
      "capturing",
      "endpoint_detected",
      "transcribing",
      "cancelled",
      "failed",
    ]);
    expect(CAPTURE_STATE_EVENTS).toEqual([
      "arm",
      "start_capture",
      "endpoint_detected",
      "begin_transcription",
      "cancel",
      "fail",
      "reset",
    ]);
    expect(CAPTURE_TERMINAL_STATES).toEqual(["cancelled", "failed"]);
  });

  it("allows valid push-to-talk capture transitions", () => {
    expect(transitionCaptureState("idle", "arm")).toEqual({
      ok: true,
      previous_state: "idle",
      event: "arm",
      next_state: "arming",
      metadata_only: true,
    });
    expect(transitionCaptureState("arming", "start_capture")).toMatchObject({
      ok: true,
      next_state: "capturing",
    });
    expect(
      transitionCaptureState("capturing", "endpoint_detected"),
    ).toMatchObject({
      ok: true,
      next_state: "endpoint_detected",
    });
    expect(
      transitionCaptureState("endpoint_detected", "begin_transcription"),
    ).toMatchObject({
      ok: true,
      next_state: "transcribing",
    });
  });

  it("fails closed for invalid states, events, and transitions", () => {
    expect(transitionCaptureState("unknown", "arm")).toEqual({
      ok: false,
      previous_state: null,
      event: "arm",
      next_state: null,
      reason: "invalid_state",
      metadata_only: true,
    });
    expect(transitionCaptureState("idle", "hotkey_pressed")).toEqual({
      ok: false,
      previous_state: "idle",
      event: null,
      next_state: "idle",
      reason: "invalid_event",
      metadata_only: true,
    });
    expect(transitionCaptureState("idle", "start_capture")).toEqual({
      ok: false,
      previous_state: "idle",
      event: "start_capture",
      next_state: "idle",
      reason: "invalid_transition",
      metadata_only: true,
    });
  });

  it("supports cancellation from arming, capturing, and transcribing", () => {
    for (const state of ["arming", "capturing", "transcribing"] as const) {
      expect(transitionCaptureState(state, "cancel")).toEqual({
        ok: true,
        previous_state: state,
        event: "cancel",
        next_state: "cancelled",
        metadata_only: true,
      });
    }
    expect(transitionCaptureState("idle", "cancel")).toMatchObject({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("supports failure from active states", () => {
    for (const state of [
      "arming",
      "capturing",
      "endpoint_detected",
      "transcribing",
    ] as const) {
      expect(transitionCaptureState(state, "fail")).toEqual({
        ok: true,
        previous_state: state,
        event: "fail",
        next_state: "failed",
        metadata_only: true,
      });
    }
  });

  it("allows reset only from terminal states", () => {
    expect(transitionCaptureState("cancelled", "reset")).toMatchObject({
      ok: true,
      next_state: "idle",
    });
    expect(transitionCaptureState("failed", "reset")).toMatchObject({
      ok: true,
      next_state: "idle",
    });
    for (const state of [
      "idle",
      "arming",
      "capturing",
      "endpoint_detected",
      "transcribing",
    ] as const) {
      expect(transitionCaptureState(state, "reset")).toMatchObject({
        ok: false,
        previous_state: state,
        next_state: state,
        reason: "invalid_transition",
      });
    }
  });

  it("exposes type guards and metadata-only session shape", () => {
    expect(isCaptureLifecycleState("capturing")).toBe(true);
    expect(isCaptureLifecycleState("recording")).toBe(false);
    expect(isCaptureStateEvent("begin_transcription")).toBe(true);
    expect(isCaptureStateEvent("begin_streaming")).toBe(false);

    const session: CaptureSessionMetadata = {
      session_id: "voice-session-1",
      turn_id: "voice-turn-1",
      state: "cancelled",
      started_at: "2026-05-26T07:00:00.000Z",
      ended_at: "2026-05-26T07:00:01.000Z",
      duration_ms: 1000,
      cancellation_reason: "user_cancelled",
      metadata_only: true,
    };

    expect(Object.keys(session)).toEqual([
      "session_id",
      "turn_id",
      "state",
      "started_at",
      "ended_at",
      "duration_ms",
      "cancellation_reason",
      "metadata_only",
    ]);
    expect(JSON.stringify(session)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|prompt|response/i,
    );
  });

  it("does not introduce mic, hotkey, STT/TTS execution, runtime, persistence, cloud, or UI wiring", () => {
    const source = captureSource();

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone|micCapture/i,
    );
    expect(source).not.toMatch(
      /tauri|invoke\s*\(|global-hotkey|globalShortcut|hotkey/i,
    );
    expect(source).not.toMatch(
      /createFasterWhisperSttProvider|transcribe\s*\(|createPiperTtsProvider|synthesize\s*\(|faster_whisper|piper/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(/tsx|jsx|React|useEffect|useState|app\/api/i);
  });
});
