import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createLocalMicCaptureAdapter,
  type CaptureSupervisorSnapshot,
  type MicCaptureAdapterConfig,
  type MicCaptureDriver,
  type MicCaptureDriverStartInput,
} from "../../../src/lib/voice-runtime";

function adapterConfig(): MicCaptureAdapterConfig {
  return {
    temp_dir: "C:/tmp/jarvis-capture",
    sample_rate_hz: 16000,
    channel_count: 1,
    max_capture_ms: 30000,
    metadata_only: true,
  };
}

function capturingSession(
  overrides: Partial<CaptureSupervisorSnapshot> = {},
): CaptureSupervisorSnapshot {
  return {
    session_id: "session/../unsafe user text",
    turn_id: "turn:one",
    state: "capturing",
    started_at: "2026-05-26T20:00:00.000Z",
    permission_state: "granted",
    selected_device_id: "default-input",
    metadata_only: true,
    ...overrides,
  };
}

function createFakeDriver(
  overrides: Partial<MicCaptureDriver> = {},
): MicCaptureDriver & {
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
          duration_ms: 1250,
          size_bytes: 4096,
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
    ...overrides,
  };
}

function micAdapterSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/capture/mic-adapter.ts"),
    "utf8",
  );
}

describe("Phase 14D.4 local mic capture adapter", () => {
  it("requires explicit startCapture and does not record in the background", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: () => 0,
    });

    expect(adapter.snapshot()).toEqual({
      mic_active: false,
      session_id: null,
      turn_id: null,
      audio_ref: null,
      metadata_only: true,
    });
    expect(driver.start).not.toHaveBeenCalled();
    await expect(adapter.health()).resolves.toMatchObject({
      ok: true,
      mic_active: false,
      metadata_only: true,
    });
    expect(driver.start).not.toHaveBeenCalled();
  });

  it("starts only from an explicit capturing session and exposes mic_active metadata", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: () => 1000,
    });

    await expect(
      adapter.startCapture(capturingSession({ state: "arming" })),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["invalid_session"],
      snapshot: { mic_active: false },
    });
    await expect(
      adapter.startCapture(capturingSession()),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: {
        mic_active: true,
        session_id: "session/../unsafe user text",
        turn_id: "turn:one",
        started_at: "1970-01-01T00:00:01.000Z",
        metadata_only: true,
      },
    });
    expect(driver.starts).toEqual([
      {
        output_ref: expect.stringMatching(
          /C:[/\\]tmp[/\\]jarvis-capture[/\\]session____unsafe_user_text-turn_one-1000\.wav/,
        ),
        sample_rate_hz: 16000,
        channel_count: 1,
        max_capture_ms: 30000,
        metadata_only: true,
      },
    ]);
    await expect(adapter.health()).resolves.toMatchObject({
      mic_active: true,
    });
  });

  it("fails closed when a second active capture is requested", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: () => 0,
    });

    await adapter.startCapture(capturingSession());
    await expect(
      adapter.startCapture(capturingSession()),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["capture_already_active"],
      snapshot: { mic_active: true },
    });
    expect(driver.start).toHaveBeenCalledTimes(1);
  });

  it("stop releases active state and returns metadata-only WAV result", async () => {
    const driver = createFakeDriver();
    const now = vi.fn().mockReturnValueOnce(1000).mockReturnValue(2300);
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: now,
    });

    await adapter.startCapture(capturingSession());
    await expect(adapter.stopCapture()).resolves.toMatchObject({
      ok: true,
      result: {
        audio_ref: expect.stringMatching(/\.wav$/),
        duration_ms: 1250,
        size_bytes: 4096,
        sample_rate_hz: 16000,
        channel_count: 1,
        degraded: false,
        started_at: "1970-01-01T00:00:01.000Z",
        stopped_at: "1970-01-01T00:00:02.300Z",
        metadata_only: true,
      },
      snapshot: {
        mic_active: false,
        stopped_at: "1970-01-01T00:00:02.300Z",
        metadata_only: true,
      },
    });
    expect(adapter.snapshot()).toMatchObject({ mic_active: false });
    expect(JSON.stringify(await adapter.stopCapture())).not.toMatch(
      /RIFF|base64|raw_audio|audio_bytes|waveform|pcm|transcript/i,
    );
  });

  it("cancel releases active state and leaves no capture result", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: vi.fn().mockReturnValueOnce(1000).mockReturnValue(1600),
    });

    await adapter.startCapture(capturingSession());
    await expect(
      adapter.cancelCapture("user_cancelled"),
    ).resolves.toMatchObject({
      ok: true,
      snapshot: {
        mic_active: false,
        cancellation_reason: "user_cancelled",
        error_class: "cancelled",
        stopped_at: "1970-01-01T00:00:01.600Z",
      },
    });
    expect(driver.cancel).toHaveBeenCalledWith("user_cancelled");
    await expect(adapter.stopCapture()).resolves.toMatchObject({
      ok: false,
      result: null,
      reasons: ["capture_not_active"],
      snapshot: { mic_active: false },
    });
  });

  it("supports max-capture timeout cleanup through explicit cancellation", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: vi.fn().mockReturnValueOnce(1000).mockReturnValue(31_001),
    });

    await adapter.startCapture(capturingSession());
    await expect(adapter.cancelCapture("timeout")).resolves.toMatchObject({
      ok: true,
      snapshot: {
        mic_active: false,
        cancellation_reason: "timeout",
        error_class: "timeout",
      },
    });
  });

  it("uses safe temp filenames and never includes user text in filenames", async () => {
    const driver = createFakeDriver();
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: () => 42,
    });

    await adapter.startCapture(
      capturingSession({
        session_id: "user said: launch secrets",
        turn_id: "../turn with spaces",
      }),
    );

    expect(driver.starts[0].output_ref).toMatch(
      /C:[/\\]tmp[/\\]jarvis-capture[/\\]user_said__launch_secrets-___turn_with_spaces-42\.wav/,
    );
    expect(driver.starts[0].output_ref).not.toContain("user said:");
    expect(driver.starts[0].output_ref).not.toContain("..");
    expect(driver.starts[0].output_ref).not.toContain(" ");
  });

  it("fails closed and releases active state on driver errors", async () => {
    const driver = createFakeDriver({
      stop: vi.fn(async () => {
        throw new Error("driver failed");
      }),
    });
    const adapter = createLocalMicCaptureAdapter({
      config: adapterConfig(),
      driver,
      now_ms: () => 0,
    });

    await adapter.startCapture(capturingSession());
    await expect(adapter.stopCapture()).resolves.toMatchObject({
      ok: false,
      reasons: ["driver_error"],
      snapshot: {
        mic_active: false,
        error_class: "driver_error",
      },
    });
  });

  it("does not introduce transcripts, runtime/router integration, persistence, cloud, Tauri, playback, or always-listening paths", () => {
    const source = micAdapterSource();

    expect(source).not.toMatch(/transcript|transcribe\s*\(/i);
    expect(source).not.toMatch(/always.?listening|wake.?word|auto.?arm/i);
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
    expect(source).not.toMatch(/setInterval|scheduler|cron/i);
  });
});
