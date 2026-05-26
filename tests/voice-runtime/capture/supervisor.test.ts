import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  CAPTURE_SUPERVISOR_TIMEOUT_KINDS,
  createCaptureSupervisor,
  createDefaultCaptureRuntimeConfig,
  type CaptureDevice,
  type CaptureDeviceSelection,
  type CaptureRuntimeConfig,
} from "../../../src/lib/voice-runtime";

function config(overrides: Partial<CaptureRuntimeConfig> = {}) {
  return {
    ...createDefaultCaptureRuntimeConfig(),
    selected_device_id: "default-input",
    max_capture_ms: 30_000,
    endpoint_timeout_ms: 1_000,
    silence_timeout_ms: 750,
    ...overrides,
  };
}

function device(overrides: Partial<CaptureDevice> = {}): CaptureDevice {
  return {
    device_id: "default-input",
    label_redacted: true,
    kind: "audioinput",
    is_default: true,
    permission_state: "granted",
    health: {
      ok: true,
      degraded: false,
      metadata_only: true,
    },
    metadata_only: true,
    ...overrides,
  };
}

function selection(
  overrides: Partial<CaptureDeviceSelection> = {},
): CaptureDeviceSelection {
  return {
    selected_device_id: "default-input",
    devices: [device()],
    permission_state: "granted",
    metadata_only: true,
    ...overrides,
  };
}

function createSupervisorHarness() {
  const now = vi.fn().mockReturnValue(0);
  return {
    now,
    supervisor: createCaptureSupervisor({
      config: config(),
      selection: selection(),
      now_ms: now,
      session_id_factory: () => "capture-session-1",
      turn_id_factory: () => "capture-turn-1",
    }),
  };
}

function supervisorSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/capture/supervisor.ts"),
    "utf8",
  );
}

describe("Phase 14D.3 push-to-talk capture supervisor scaffold", () => {
  it("enforces valid transitions and exposes metadata-only snapshots", () => {
    const { now, supervisor } = createSupervisorHarness();

    expect(supervisor.snapshot()).toEqual({
      session_id: null,
      turn_id: null,
      state: "idle",
      permission_state: "granted",
      selected_device_id: "default-input",
      metadata_only: true,
    });

    expect(supervisor.arm()).toMatchObject({
      ok: true,
      snapshot: {
        session_id: "capture-session-1",
        turn_id: "capture-turn-1",
        state: "arming",
        started_at: "1970-01-01T00:00:00.000Z",
        permission_state: "granted",
        selected_device_id: "default-input",
        metadata_only: true,
      },
    });
    expect(supervisor.startCapture()).toMatchObject({
      ok: true,
      snapshot: { state: "capturing" },
    });
    expect(supervisor.endpointDetected()).toMatchObject({
      ok: true,
      snapshot: { state: "endpoint_detected" },
    });
    expect(supervisor.beginTranscription()).toMatchObject({
      ok: true,
      snapshot: { state: "transcribing" },
    });
    now.mockReturnValue(1200);
    expect(supervisor.fail("capture_error")).toMatchObject({
      ok: true,
      snapshot: {
        state: "failed",
        error_class: "capture_error",
        ended_at: "1970-01-01T00:00:01.200Z",
        duration_ms: 1200,
      },
    });

    expect(JSON.stringify(supervisor.snapshot())).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|prompt|response/i,
    );
  });

  it("fails closed for invalid operations and active-session conflicts", () => {
    const { supervisor } = createSupervisorHarness();

    expect(supervisor.startCapture()).toMatchObject({
      ok: false,
      reasons: ["invalid_transition"],
      snapshot: { state: "idle" },
    });
    expect(supervisor.arm()).toMatchObject({ ok: true });
    expect(supervisor.arm()).toMatchObject({
      ok: false,
      reasons: ["active_session_exists"],
      snapshot: { state: "arming" },
    });
    expect(supervisor.beginTranscription()).toMatchObject({
      ok: false,
      reasons: ["invalid_transition"],
      snapshot: { state: "arming" },
    });
    expect(supervisor.reset()).toMatchObject({
      ok: false,
      reasons: ["invalid_transition"],
      snapshot: { state: "arming" },
    });
  });

  it("preserves cancellation behavior and blocks transcription after cancellation", () => {
    const { now, supervisor } = createSupervisorHarness();

    expect(supervisor.arm()).toMatchObject({ ok: true });
    expect(supervisor.startCapture()).toMatchObject({ ok: true });
    now.mockReturnValue(500);
    expect(supervisor.cancel("user_cancelled")).toMatchObject({
      ok: true,
      snapshot: {
        state: "cancelled",
        cancellation_reason: "user_cancelled",
        ended_at: "1970-01-01T00:00:00.500Z",
        duration_ms: 500,
      },
    });
    expect(supervisor.beginTranscription()).toMatchObject({
      ok: false,
      reasons: ["invalid_transition"],
      snapshot: { state: "cancelled" },
    });
    expect(supervisor.reset()).toMatchObject({
      ok: true,
      snapshot: {
        session_id: null,
        turn_id: null,
        state: "idle",
      },
    });
  });

  it("supervises explicit timeout events without starting timers", () => {
    expect(CAPTURE_SUPERVISOR_TIMEOUT_KINDS).toEqual([
      "max_capture",
      "endpoint",
      "silence",
    ]);

    const silenceHarness = createSupervisorHarness();
    silenceHarness.supervisor.arm();
    silenceHarness.supervisor.startCapture();
    expect(silenceHarness.supervisor.handleTimeout("silence")).toMatchObject({
      ok: true,
      operation: "handleTimeout",
      snapshot: { state: "endpoint_detected" },
    });

    const endpointHarness = createSupervisorHarness();
    endpointHarness.supervisor.arm();
    endpointHarness.supervisor.startCapture();
    endpointHarness.supervisor.endpointDetected();
    endpointHarness.now.mockReturnValue(1000);
    expect(endpointHarness.supervisor.handleTimeout("endpoint")).toMatchObject({
      ok: true,
      snapshot: {
        state: "failed",
        error_class: "timeout",
        duration_ms: 1000,
      },
    });

    const maxHarness = createSupervisorHarness();
    maxHarness.supervisor.arm();
    maxHarness.supervisor.startCapture();
    maxHarness.now.mockReturnValue(30_001);
    expect(maxHarness.supervisor.handleTimeout("max_capture")).toMatchObject({
      ok: true,
      snapshot: {
        state: "failed",
        error_class: "timeout",
        duration_ms: 30001,
      },
    });

    const idleHarness = createSupervisorHarness();
    expect(idleHarness.supervisor.handleTimeout("silence")).toMatchObject({
      ok: false,
      reasons: ["timeout_not_applicable"],
      snapshot: { state: "idle" },
    });
  });

  it("fails closed when arming policy denies capture", () => {
    const supervisor = createCaptureSupervisor({
      config: config({ push_to_talk_enabled: false }),
      selection: selection(),
      now_ms: () => 0,
      session_id_factory: () => "capture-session-1",
      turn_id_factory: () => "capture-turn-1",
    });

    expect(supervisor.arm()).toEqual({
      ok: false,
      operation: "arm",
      snapshot: {
        session_id: null,
        turn_id: null,
        state: "idle",
        permission_state: "granted",
        selected_device_id: "default-input",
        metadata_only: true,
      },
      reasons: ["push_to_talk_disabled"],
      metadata_only: true,
    });
  });

  it("does not expose audio buffers, transcript content, or mutable snapshots", () => {
    const { supervisor } = createSupervisorHarness();
    supervisor.arm();
    const first = supervisor.snapshot();
    const mutated = first as { state: string; session_id: string | null };
    mutated.state = "failed";
    mutated.session_id = "mutated";

    expect(supervisor.snapshot()).toMatchObject({
      session_id: "capture-session-1",
      state: "arming",
      metadata_only: true,
    });
    expect(Object.keys(supervisor.snapshot())).not.toContain("audio");
    expect(Object.keys(supervisor.snapshot())).not.toContain("audio_buffer");
    expect(Object.keys(supervisor.snapshot())).not.toContain("transcript");
  });

  it("does not introduce mic/audio APIs, hotkeys, STT/TTS execution, runtime, persistence, cloud, or UI wiring", () => {
    const source = supervisorSource();

    expect(source).not.toMatch(/setTimeout|setInterval/i);
    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone|micCapture|audio_buffer/i,
    );
    expect(source).not.toMatch(
      /from\s+["'](?:mic|node-record-lpcm16|naudiodon|speaker|wav|node-wav)["']|require\s*\(\s*["'](?:mic|node-record-lpcm16|naudiodon|speaker|wav|node-wav)["']\s*\)/i,
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
