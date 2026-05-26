import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBACK_LIFECYCLE_STATES,
  PLAYBACK_STATE_EVENTS,
  PLAYBACK_TERMINAL_STATES,
  isPlaybackLifecycleState,
  isPlaybackStateEvent,
  transitionPlaybackState,
} from "../../../src/lib/voice-runtime";

function playbackStateSource(): string {
  return [
    "src/lib/voice-runtime/playback/types.ts",
    "src/lib/voice-runtime/playback/state-machine.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

describe("Phase 14E.1 playback state machine", () => {
  it("defines playback lifecycle states and events", () => {
    expect(PLAYBACK_LIFECYCLE_STATES).toEqual([
      "idle",
      "queueing",
      "synthesizing",
      "playing",
      "interrupted",
      "completed",
      "failed",
    ]);
    expect(PLAYBACK_STATE_EVENTS).toEqual([
      "enqueue",
      "begin_synthesis",
      "begin_playback",
      "complete",
      "interrupt",
      "fail",
      "reset",
    ]);
    expect(PLAYBACK_TERMINAL_STATES).toEqual([
      "interrupted",
      "completed",
      "failed",
    ]);
  });

  it("allows valid queue, synthesis, playback, and completion transitions", () => {
    expect(transitionPlaybackState("idle", "enqueue")).toEqual({
      ok: true,
      previous_state: "idle",
      event: "enqueue",
      next_state: "queueing",
      metadata_only: true,
    });
    expect(
      transitionPlaybackState("queueing", "begin_synthesis"),
    ).toMatchObject({
      ok: true,
      next_state: "synthesizing",
    });
    expect(
      transitionPlaybackState("synthesizing", "begin_playback"),
    ).toMatchObject({
      ok: true,
      next_state: "playing",
    });
    expect(transitionPlaybackState("playing", "complete")).toMatchObject({
      ok: true,
      next_state: "completed",
    });
  });

  it("fails closed for invalid states, events, and transitions", () => {
    expect(transitionPlaybackState("unknown", "enqueue")).toEqual({
      ok: false,
      previous_state: null,
      event: "enqueue",
      next_state: null,
      reason: "invalid_state",
      metadata_only: true,
    });
    expect(transitionPlaybackState("idle", "autoplay")).toEqual({
      ok: false,
      previous_state: "idle",
      event: null,
      next_state: "idle",
      reason: "invalid_event",
      metadata_only: true,
    });
    expect(transitionPlaybackState("idle", "begin_playback")).toEqual({
      ok: false,
      previous_state: "idle",
      event: "begin_playback",
      next_state: "idle",
      reason: "invalid_transition",
      metadata_only: true,
    });
  });

  it("supports interrupt from queueing, synthesizing, and playing", () => {
    for (const state of ["queueing", "synthesizing", "playing"] as const) {
      expect(transitionPlaybackState(state, "interrupt")).toEqual({
        ok: true,
        previous_state: state,
        event: "interrupt",
        next_state: "interrupted",
        metadata_only: true,
      });
    }
    expect(transitionPlaybackState("idle", "interrupt")).toMatchObject({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("supports failure from active playback states", () => {
    for (const state of ["queueing", "synthesizing", "playing"] as const) {
      expect(transitionPlaybackState(state, "fail")).toEqual({
        ok: true,
        previous_state: state,
        event: "fail",
        next_state: "failed",
        metadata_only: true,
      });
    }
  });

  it("allows reset only from terminal states", () => {
    for (const state of ["interrupted", "completed", "failed"] as const) {
      expect(transitionPlaybackState(state, "reset")).toEqual({
        ok: true,
        previous_state: state,
        event: "reset",
        next_state: "idle",
        metadata_only: true,
      });
    }
    for (const state of [
      "idle",
      "queueing",
      "synthesizing",
      "playing",
    ] as const) {
      expect(transitionPlaybackState(state, "reset")).toMatchObject({
        ok: false,
        previous_state: state,
        next_state: state,
        reason: "invalid_transition",
      });
    }
  });

  it("exposes playback type guards", () => {
    expect(isPlaybackLifecycleState("playing")).toBe(true);
    expect(isPlaybackLifecycleState("speaking")).toBe(false);
    expect(isPlaybackStateEvent("begin_synthesis")).toBe(true);
    expect(isPlaybackStateEvent("autoplay")).toBe(false);
  });

  it("does not introduce playback APIs, TTS/STT execution, runtime, persistence, cloud, or UI wiring", () => {
    const source = playbackStateSource();

    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(|from\s+["'](?:speaker|wav|node-wav|naudiodon)["']/i,
    );
    expect(source).not.toMatch(
      /createPiperTtsProvider|synthesize\s*\(|createFasterWhisperSttProvider|transcribe\s*\(|faster_whisper|piper/i,
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
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
  });
});
