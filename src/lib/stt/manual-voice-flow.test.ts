import { describe, expect, it } from "vitest";
import { localWhisperProviderWithStatus } from "./local-whisper-placeholder";
import { getManualTranscriptionStartBlockReason } from "./manual-voice-flow";
import type { TranscriptionInput, TranscriptionProvider } from "./types";

const transcriptionInput: TranscriptionInput = {
  captureSessionId: "capture-1",
  chunks: [
    {
      sessionId: "capture-1",
      capturedAt: 1,
      sampleRate: 48_000,
      pcm: new Float32Array([0.1]),
    },
  ],
  sampleRate: 48_000,
  durationMs: 100,
};

const readyProvider: TranscriptionProvider = {
  ...localWhisperProviderWithStatus({ status: "ready", enabled: true }),
  async transcribe() {
    return {
      status: "completed",
      providerId: "local-whisper-placeholder",
      text: "local transcript",
    };
  },
};

describe("getManualTranscriptionStartBlockReason", () => {
  it("allows manual STT only after recording has stopped and provider is ready", () => {
    expect(
      getManualTranscriptionStartBlockReason({
        provider: readyProvider,
        transcriptionInput,
        recordingActive: false,
      }),
    ).toBeNull();
  });

  it("blocks transcription while PTT recording is still active", () => {
    expect(
      getManualTranscriptionStartBlockReason({
        provider: readyProvider,
        transcriptionInput,
        recordingActive: true,
      }),
    ).toBe("recording_active");
  });

  it("blocks disabled and unavailable local providers", () => {
    expect(
      getManualTranscriptionStartBlockReason({
        provider: localWhisperProviderWithStatus({
          status: "ready",
          enabled: false,
        }),
        transcriptionInput,
        recordingActive: false,
      }),
    ).toBe("provider_disabled");

    expect(
      getManualTranscriptionStartBlockReason({
        provider: localWhisperProviderWithStatus({
          status: "not_installed",
          enabled: true,
        }),
        transcriptionInput,
        recordingActive: false,
      }),
    ).toBe("provider_unavailable");
  });

  it("blocks empty completed captures", () => {
    expect(
      getManualTranscriptionStartBlockReason({
        provider: readyProvider,
        transcriptionInput: {
          ...transcriptionInput,
          chunks: [],
        },
        recordingActive: false,
      }),
    ).toBe("empty_capture");
  });
});
