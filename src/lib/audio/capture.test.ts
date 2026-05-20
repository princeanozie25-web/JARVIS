import { describe, expect, it, vi } from "vitest";
import {
  createLocalAudioCaptureHandle,
  startLocalAudioCapture,
  type AudioContextLike,
} from "./capture";
import type { AudioMediaDevices } from "./devices";

function fakeStream(
  input: {
    stop?: () => void;
    addEnded?: (listener: () => void) => void;
    removeEnded?: (listener: () => void) => void;
  } = {},
): MediaStream {
  const track = {
    stop: input.stop ?? vi.fn(),
    addEventListener: (_type: string, listener: () => void) =>
      input.addEnded?.(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      input.removeEnded?.(listener),
  };
  return {
    active: true,
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

function fakeAudioContext(
  input: {
    close?: () => Promise<void>;
    disconnectSource?: () => void;
    disconnectAnalyser?: () => void;
    fill?: (array: Float32Array) => void;
  } = {},
): AudioContextLike {
  return {
    sampleRate: 48_000,
    createMediaStreamSource: () => ({
      connect: vi.fn(),
      disconnect: input.disconnectSource ?? vi.fn(),
    }),
    createAnalyser: () => ({
      fftSize: 0,
      frequencyBinCount: 4,
      getFloatTimeDomainData(array: Float32Array) {
        input.fill?.(array);
      },
      disconnect: input.disconnectAnalyser ?? vi.fn(),
    }),
    close: input.close ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe("local audio capture", () => {
  it("captures transient analyser chunks and releases them on stop", async () => {
    const stop = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    let frameCallback: FrameRequestCallback | undefined;
    let now = 1_000;
    const handle = createLocalAudioCaptureHandle(fakeStream({ stop }), {
      createAudioContext: () =>
        fakeAudioContext({
          close,
          fill(array) {
            array.set([0, 0.5, -0.5, 0]);
          },
        }),
      requestFrame(callback) {
        frameCallback = callback;
        return 1;
      },
      cancelFrame: vi.fn(),
      now: () => now,
      newId: () => "capture-1",
    });

    expect(handle.metadata).toMatchObject({
      id: "capture-1",
      startedAt: 1_000,
      sampleRate: 48_000,
      streamActive: true,
    });

    now = 1_050;
    frameCallback?.(1_050);
    expect(handle.getTransientChunks()).toHaveLength(1);

    await expect(handle.stop(1_125)).resolves.toEqual({
      durationMs: 125,
      chunkCount: 1,
    });
    expect(handle.getTransientChunks()).toHaveLength(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("starts capture with a selected device constraint", async () => {
    const stream = fakeStream();
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn().mockResolvedValue(stream),
    };

    const handle = await startLocalAudioCapture({
      deviceId: "mic-1",
      mediaDevices,
      createAudioContext: () => fakeAudioContext(),
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
      newId: () => "capture-1",
    });

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: "mic-1" } },
    });
    await handle.stop();
  });

  it("stops tracks if audio graph creation fails", async () => {
    const stop = vi.fn();
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn().mockResolvedValue(fakeStream({ stop })),
    };

    await expect(
      startLocalAudioCapture({
        mediaDevices,
        createAudioContext: () => {
          throw new Error("no audio context");
        },
      }),
    ).rejects.toThrow("no audio context");
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("aborts pending capture before creating an audio graph after PTT release", async () => {
    const stop = vi.fn();
    const createAudioContext = vi.fn(() => fakeAudioContext());
    let resolveStream: (stream: MediaStream) => void = () => undefined;
    const mediaDevices: AudioMediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((resolve) => {
            resolveStream = resolve;
          }),
      ),
    };
    const ac = new AbortController();
    const capturePromise = startLocalAudioCapture({
      mediaDevices,
      signal: ac.signal,
      createAudioContext,
    });

    ac.abort();
    resolveStream(fakeStream({ stop }));

    await expect(capturePromise).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(createAudioContext).not.toHaveBeenCalled();
  });

  it("reports track ended and performs deterministic cleanup", async () => {
    let endedListener: (() => void) | undefined;
    const onEnded = vi.fn();
    const stop = vi.fn();
    const handle = createLocalAudioCaptureHandle(
      fakeStream({
        stop,
        addEnded(listener) {
          endedListener = listener;
        },
      }),
      {
        createAudioContext: () => fakeAudioContext(),
        requestFrame: vi.fn(() => 1),
        cancelFrame: vi.fn(),
        onEnded,
        newId: () => "capture-1",
      },
    );

    endedListener?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(onEnded).toHaveBeenCalledWith("Audio input ended.");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(handle.getTransientChunks()).toHaveLength(0);
  });
});
