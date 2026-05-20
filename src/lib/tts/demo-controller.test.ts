import { describe, expect, it, vi } from "vitest";
import { BrowserPlaybackWrapper, type BrowserAudioElement } from "./playback";
import { createLocalTtsSynthesisProvider } from "./local-synthesis-provider";
import { ManualTtsDemoController } from "./demo-controller";
import type {
  LocalSpeechProviderConfig,
  ManualTtsDemoTelemetryEvent,
} from "./types";
import type { LocalTtsSynthesisHandle } from "./local-runtime";

const config: LocalSpeechProviderConfig = {
  binaryPath: "C:\\local\\tts.exe",
  voiceModelPath: "C:\\local\\voice.onnx",
  speakerId: "jarvis",
  sampleRate: 24_000,
  startupTimeoutMs: 1,
  executionTimeoutMs: 10,
};

function createAudioElement(): BrowserAudioElement & {
  playMock: ReturnType<typeof vi.fn>;
} {
  const playMock = vi.fn().mockResolvedValue(undefined);
  return {
    src: "",
    onended: null,
    onerror: null,
    play: playMock,
    pause: vi.fn(),
    load: vi.fn(),
    removeAttribute(name) {
      if (name === "src") this.src = "";
    },
    playMock,
  };
}

function createEnabledProvider(input?: {
  telemetry?: ManualTtsDemoTelemetryEvent[];
  handle?: LocalTtsSynthesisHandle;
}) {
  const handle =
    input?.handle ??
    ({
      shutdown: vi.fn().mockResolvedValue(undefined),
      synthesize: vi.fn().mockResolvedValue({
        data: new Uint8Array([1, 2, 3, 4]),
        mimeType: "audio/wav",
        durationMs: 250,
        sampleRate: 24_000,
      }),
    } satisfies LocalTtsSynthesisHandle);

  return {
    handle,
    provider: createLocalTtsSynthesisProvider({
      enabled: true,
      status: "ready",
      handle,
      config,
      newId: () => "audio-1",
    }),
  };
}

describe("ManualTtsDemoController", () => {
  it("prepares safe demo text through chunking, queueing, synthesis, and playback readiness", async () => {
    const telemetry: ManualTtsDemoTelemetryEvent[] = [];
    const { provider, handle } = createEnabledProvider();
    const controller = new ManualTtsDemoController({
      provider,
      emitTelemetry: (event) => telemetry.push(event),
    });

    const result = await controller.prepareSpeech(
      "Here is a safe assistant prose demo.",
    );

    expect(result).toMatchObject({
      ok: true,
      chunk: {
        text: "Here is a safe assistant prose demo.",
        source: "assistant_prose",
      },
      queueItem: { status: "ready" },
      audio: {
        id: "audio-1",
        source: "local_tts",
        byteLength: 4,
      },
      playbackItem: {
        status: "ready",
        audioId: "audio-1",
      },
    });
    expect(handle.synthesize).toHaveBeenCalledTimes(1);
    expect(controller.getPlaybackItem()).toMatchObject({ status: "ready" });
    expect(controller.getPlaybackAudio()).toMatchObject({ id: "audio-1" });
    expect(result).not.toHaveProperty("target");
    expect(result).not.toHaveProperty("canApproveRuntimeActions");
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "demo_tts_prepare_started",
      "demo_tts_prepare_completed",
    ]);
  });

  it("refuses blocked demo text before synthesis", async () => {
    const { provider, handle } = createEnabledProvider();
    const controller = new ManualTtsDemoController({ provider });

    await expect(
      controller.prepareSpeech("```ts\nconsole.log('silent')\n```"),
    ).resolves.toEqual({
      ok: false,
      reason: "code_block_blocked",
    });
    await expect(
      controller.prepareSpeech("transcript: reviewed voice text"),
    ).resolves.toEqual({
      ok: false,
      reason: "transcript_blocked",
    });
    expect(handle.synthesize).not.toHaveBeenCalled();
    expect(controller.getPlaybackItem()).toBeNull();
  });

  it("prepares audio without playing automatically", async () => {
    const { provider } = createEnabledProvider();
    const controller = new ManualTtsDemoController({ provider });
    const audioElement = createAudioElement();
    const browserPlayback = new BrowserPlaybackWrapper({
      createObjectUrl: () => "blob:demo",
      revokeObjectUrl: vi.fn(),
      createAudioElement: () => audioElement,
    });

    const result = await controller.prepareSpeech(
      "Manual playback is required.",
    );
    if (!result.ok) throw new Error("Expected demo preparation to succeed");
    browserPlayback.load(result.audio);

    expect(result.playbackItem.status).toBe("ready");
    expect(audioElement.playMock).not.toHaveBeenCalled();
    await expect(browserPlayback.play()).rejects.toThrow(
      "User gesture is required before speech playback.",
    );
    browserPlayback.requireUserGesture();
    await browserPlayback.play();
    expect(audioElement.playMock).toHaveBeenCalledTimes(1);
  });

  it("keeps text and audio out of demo telemetry", async () => {
    const telemetry: ManualTtsDemoTelemetryEvent[] = [];
    const secretText = "Assistant prose demo text that must not leak.";
    const { provider } = createEnabledProvider();
    const controller = new ManualTtsDemoController({
      provider,
      emitTelemetry: (event) => telemetry.push(event),
    });

    await controller.prepareSpeech(secretText);

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("demo_tts_prepare_started");
    expect(serialized).toContain("demo_tts_prepare_completed");
    expect(serialized).not.toContain(secretText);
    expect(serialized).not.toContain("1,2,3,4");
    expect(serialized).not.toContain("data");
  });
});
