import {
  getBrowserAudioMediaDevices,
  stopMediaStream,
  type AudioMediaDevices,
} from "./devices";
import type { AudioCaptureSessionMetadata, TransientAudioChunk } from "./types";

const MAX_TRANSIENT_CHUNKS = 30;

export interface AudioAnalyserLike {
  fftSize: number;
  frequencyBinCount: number;
  getFloatTimeDomainData(array: Float32Array): void;
  disconnect(): void;
}

export interface AudioSourceLike {
  connect(analyser: AudioAnalyserLike): void;
  disconnect(): void;
}

export interface AudioContextLike {
  sampleRate: number;
  createMediaStreamSource(stream: MediaStream): AudioSourceLike;
  createAnalyser(): AudioAnalyserLike;
  close(): Promise<void>;
}

export interface LocalAudioCaptureHandle {
  readonly metadata: AudioCaptureSessionMetadata;
  stop(stoppedAt?: number): Promise<{
    durationMs: number;
    chunkCount: number;
  }>;
  getTransientChunks(): readonly TransientAudioChunk[];
  releaseTransientChunks(): void;
}

export interface StartLocalAudioCaptureOptions {
  deviceId?: string;
  signal?: AbortSignal;
  mediaDevices?: AudioMediaDevices;
  createAudioContext?: () => AudioContextLike;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  now?: () => number;
  newId?: () => string;
  onVu?: (input: { vuLevel: number; durationMs: number }) => void;
  onEnded?: (reason: string) => void;
}

export async function startLocalAudioCapture(
  opts: StartLocalAudioCaptureOptions = {},
): Promise<LocalAudioCaptureHandle> {
  const mediaDevices = opts.mediaDevices ?? getBrowserAudioMediaDevices();
  if (!mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not supported in this browser.");
  }

  const constraints: MediaStreamConstraints = {
    audio: opts.deviceId ? { deviceId: { exact: opts.deviceId } } : true,
  };
  throwIfAborted(opts.signal);
  const stream = await mediaDevices.getUserMedia(constraints);

  try {
    throwIfAborted(opts.signal);
    return createLocalAudioCaptureHandle(stream, opts);
  } catch (error) {
    stopMediaStream(stream);
    throw error;
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw new DOMException("Audio capture was cancelled.", "AbortError");
}

export function createLocalAudioCaptureHandle(
  stream: MediaStream,
  opts: StartLocalAudioCaptureOptions = {},
): LocalAudioCaptureHandle {
  const now = opts.now ?? (() => Date.now());
  const requestFrame = opts.requestFrame ?? globalThis.requestAnimationFrame;
  const cancelFrame = opts.cancelFrame ?? globalThis.cancelAnimationFrame;
  const audioContext = createAudioContext(opts.createAudioContext);
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const startedAt = now();
  const sessionId = opts.newId?.() ?? globalThis.crypto.randomUUID();
  const chunks: TransientAudioChunk[] = [];
  const trackEndedListeners: Array<() => void> = [];
  let frameId: number | null = null;
  let stopped = false;

  const metadata: AudioCaptureSessionMetadata = {
    id: sessionId,
    startedAt,
    sampleRate: audioContext.sampleRate || null,
    streamActive: stream.active,
  };

  const collectFrame = () => {
    if (stopped) return;
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data);
    chunks.push({
      sessionId,
      capturedAt: now(),
      sampleRate: metadata.sampleRate,
      pcm: data,
    });
    if (chunks.length > MAX_TRANSIENT_CHUNKS) {
      chunks.splice(0, chunks.length - MAX_TRANSIENT_CHUNKS);
    }
    opts.onVu?.({
      vuLevel: rootMeanSquare(data),
      durationMs: Math.max(0, now() - startedAt),
    });
    frameId = requestFrame(collectFrame);
  };

  for (const track of stream.getAudioTracks()) {
    const onEnded = () => {
      void stop(now()).then(() => {
        opts.onEnded?.("Audio input ended.");
      });
    };
    track.addEventListener?.("ended", onEnded);
    trackEndedListeners.push(() =>
      track.removeEventListener?.("ended", onEnded),
    );
  }

  frameId = requestFrame(collectFrame);

  async function stop(stoppedAt: number = now()) {
    if (stopped) {
      return {
        durationMs: Math.max(0, stoppedAt - startedAt),
        chunkCount: 0,
      };
    }
    stopped = true;
    if (frameId !== null) cancelFrame(frameId);
    for (const cleanup of trackEndedListeners) cleanup();
    source.disconnect();
    analyser.disconnect();
    stopMediaStream(stream);
    await audioContext.close();
    const chunkCount = chunks.length;
    chunks.splice(0, chunks.length);
    return {
      durationMs: Math.max(0, stoppedAt - startedAt),
      chunkCount,
    };
  }

  return {
    metadata,
    stop,
    getTransientChunks() {
      return chunks;
    },
    releaseTransientChunks() {
      chunks.splice(0, chunks.length);
    },
  };
}

function createAudioContext(
  factory?: () => AudioContextLike,
): AudioContextLike {
  if (factory) return factory();
  const AudioContextConstructor =
    globalThis.AudioContext ??
    (
      globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Web Audio capture is not supported in this browser.");
  }
  return new AudioContextConstructor() as unknown as AudioContextLike;
}

function rootMeanSquare(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (const sample of samples) {
    total += sample * sample;
  }
  return Math.min(Math.sqrt(total / samples.length), 1);
}
