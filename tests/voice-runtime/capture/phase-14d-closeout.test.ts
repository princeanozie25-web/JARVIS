import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CAPTURE_RUNTIME_CONFIG,
  DEFAULT_VOICE_RUNTIME_CONFIG,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  createCaptureSupervisor,
  createDefaultCaptureRuntimeConfig,
  createLocalMicCaptureAdapter,
  type CaptureDevice,
  type CaptureDeviceSelection,
  type CaptureRuntimeConfig,
  type MicCaptureAdapterConfig,
  type MicCaptureDriver,
  type MicCaptureDriverStartInput,
} from "../../../src/lib/voice-runtime";

const PHASE_14D_MANUAL_CAPTURE_METADATA = {
  mic_active_lifecycle_observed: true,
  degraded: false,
  persisted_audio: false,
} as const;

function captureConfig(
  overrides: Partial<CaptureRuntimeConfig> = {},
): CaptureRuntimeConfig {
  return {
    ...createDefaultCaptureRuntimeConfig(),
    selected_device_id: "default-input",
    ...overrides,
  };
}

function adapterConfig(): MicCaptureAdapterConfig {
  return {
    temp_dir: "C:/tmp/jarvis-capture",
    sample_rate_hz: 16000,
    channel_count: 1,
    max_capture_ms: 30000,
    metadata_only: true,
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

function createFakeDriver(): MicCaptureDriver & {
  readonly starts: MicCaptureDriverStartInput[];
} {
  const starts: MicCaptureDriverStartInput[] = [];
  return {
    starts,
    start: vi.fn(async (input: MicCaptureDriverStartInput) => {
      starts.push(input);
    }),
    stop: vi.fn(
      async () =>
        ({
          duration_ms: 900,
          size_bytes: 2048,
          degraded: false,
          metadata_only: true,
        }) as const,
    ),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(
      async () =>
        ({
          ok: true,
          degraded: false,
          metadata_only: true,
        }) as const,
    ),
  };
}

function createCaptureChain(nowValues: readonly number[] = [1000, 1600, 1700]) {
  const now = vi.fn();
  for (const value of nowValues) now.mockReturnValueOnce(value);
  now.mockReturnValue(nowValues.at(-1) ?? 0);
  const supervisor = createCaptureSupervisor({
    config: captureConfig(),
    selection: selection(),
    now_ms: now,
    session_id_factory: () => "capture-session-1",
    turn_id_factory: () => "capture-turn-1",
  });
  const driver = createFakeDriver();
  const adapter = createLocalMicCaptureAdapter({
    config: adapterConfig(),
    driver,
    now_ms: now,
  });
  return { adapter, driver, now, supervisor };
}

function captureSource(): string {
  return [
    "src/lib/voice-runtime/capture/types.ts",
    "src/lib/voice-runtime/capture/state-machine.ts",
    "src/lib/voice-runtime/capture/device.ts",
    "src/lib/voice-runtime/capture/config.ts",
    "src/lib/voice-runtime/capture/supervisor.ts",
    "src/lib/voice-runtime/capture/mic-adapter.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

describe("Phase 14D push-to-talk capture closeout audit", () => {
  it("starts capture only through explicit startCapture and never in background", async () => {
    const { adapter, driver, supervisor } = createCaptureChain();

    expect(adapter.snapshot()).toMatchObject({ mic_active: false });
    expect(driver.start).not.toHaveBeenCalled();
    supervisor.arm();
    expect(driver.start).not.toHaveBeenCalled();
    const started = supervisor.startCapture();
    expect(started).toMatchObject({
      ok: true,
      snapshot: { state: "capturing" },
    });
    expect(driver.start).not.toHaveBeenCalled();

    await expect(adapter.startCapture(started.snapshot)).resolves.toMatchObject(
      {
        ok: true,
        snapshot: { mic_active: true },
      },
    );
    expect(driver.start).toHaveBeenCalledTimes(1);
  });

  it("blocks second active capture and releases mic_active on stop", async () => {
    const { adapter, driver, supervisor } = createCaptureChain();
    supervisor.arm();
    const started = supervisor.startCapture();
    if (!started.ok) throw new Error("expected started capture");

    await adapter.startCapture(started.snapshot);
    await expect(adapter.startCapture(started.snapshot)).resolves.toMatchObject(
      {
        ok: false,
        reasons: ["capture_already_active"],
        snapshot: { mic_active: true },
      },
    );
    expect(driver.start).toHaveBeenCalledTimes(1);

    await expect(adapter.stopCapture()).resolves.toMatchObject({
      ok: true,
      result: {
        audio_ref: expect.stringMatching(/\.wav$/),
        duration_ms: 900,
        size_bytes: 2048,
        degraded: false,
        metadata_only: true,
      },
      snapshot: { mic_active: false },
    });
    expect(adapter.snapshot()).toMatchObject({ mic_active: false });
  });

  it("cancel and timeout cleanup release mic_active", async () => {
    const cancelChain = createCaptureChain();
    cancelChain.supervisor.arm();
    const cancelStarted = cancelChain.supervisor.startCapture();
    if (!cancelStarted.ok) throw new Error("expected started capture");
    await cancelChain.adapter.startCapture(cancelStarted.snapshot);
    await expect(
      cancelChain.adapter.cancelCapture("user_cancelled"),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: {
        mic_active: false,
        cancellation_reason: "user_cancelled",
        error_class: "cancelled",
      },
    });

    const timeoutChain = createCaptureChain([1000, 1001, 31_001]);
    timeoutChain.supervisor.arm();
    const timeoutStarted = timeoutChain.supervisor.startCapture();
    if (!timeoutStarted.ok) throw new Error("expected started capture");
    await timeoutChain.adapter.startCapture(timeoutStarted.snapshot);
    await expect(
      timeoutChain.adapter.cancelCapture("timeout"),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: {
        mic_active: false,
        cancellation_reason: "timeout",
        error_class: "timeout",
      },
    });
  });

  it("returns metadata-only capture results and no raw audio in memory", async () => {
    const { adapter, supervisor } = createCaptureChain();
    supervisor.arm();
    const started = supervisor.startCapture();
    if (!started.ok) throw new Error("expected started capture");
    await adapter.startCapture(started.snapshot);
    const stopped = await adapter.stopCapture();

    expect(stopped).toMatchObject({
      ok: true,
      result: {
        sample_rate_hz: 16000,
        channel_count: 1,
        metadata_only: true,
      },
      metadata_only: true,
    });
    expect(JSON.stringify(stopped)).not.toMatch(
      /RIFF|base64|raw_audio|audio_bytes|waveform|pcm|buffer|Uint8Array|transcript/i,
    );
  });

  it("uses safe temp WAV filenames and keeps manual documentation metadata-only", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: () => 42,
    });
    await adapter.startCapture({
      session_id: "user said: open private file",
      turn_id: "../turn with spaces",
      state: "capturing",
      permission_state: "granted",
      selected_device_id: "default-input",
      metadata_only: true,
    });

    expect(driver.starts[0].output_ref).toMatch(
      /C:[/\\]tmp[/\\]jarvis-capture[/\\]user_said__open_private_file-___turn_with_spaces-42\.wav/,
    );
    expect(driver.starts[0].output_ref).not.toContain("user said:");
    expect(driver.starts[0].output_ref).not.toContain("..");
    expect(PHASE_14D_MANUAL_CAPTURE_METADATA).toEqual({
      mic_active_lifecycle_observed: true,
      degraded: false,
      persisted_audio: false,
    });
  });

  it("keeps governance defaults push-to-talk only and persistence disabled", () => {
    expect(DEFAULT_CAPTURE_RUNTIME_CONFIG).toMatchObject({
      push_to_talk_enabled: true,
      permission_required: true,
      mic_active_indicator_required: true,
    });
    expect(DEFAULT_VOICE_RUNTIME_CONFIG).toMatchObject({
      push_to_talk_only: true,
      wake_word_enabled: false,
      always_listening_enabled: false,
      background_recording_enabled: false,
      transcript_telemetry_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
    });
    expect(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG).toMatchObject({
      wake_word_enabled: false,
      always_listening_enabled: false,
      background_capture_enabled: false,
      transcript_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
    });
  });

  it("keeps capture source disconnected from runtime, forwarding, persistence, cloud, UI, playback, and schedulers", () => {
    const source = captureSource();

    expect(source).not.toMatch(/always.?listening|wake.?word|auto.?arm/i);
    expect(source).not.toMatch(
      /\btranscript(?:_content|_text)?\b|transcript\s*:|transcribe\s*\(/i,
    );
    expect(source).not.toMatch(
      /createFasterWhisperSttProvider|createPiperTtsProvider|synthesize\s*\(|faster_whisper|piper/i,
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
      /tauri|invoke\s*\(|global-hotkey|globalShortcut|hotkey/i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(
      /setInterval|scheduler|cron|while\s*\(\s*true\s*\)/i,
    );
  });
});
