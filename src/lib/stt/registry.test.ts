import { describe, expect, it } from "vitest";
import { transcribeWithGuard } from "./guard";
import { localWhisperPlaceholderProvider } from "./local-whisper-placeholder";
import { transcriptionProviders } from "./registry";
import type { TranscriptionInput } from "./types";

const input: TranscriptionInput = {
  captureSessionId: "capture-1",
  chunks: [],
  sampleRate: 48_000,
  durationMs: 250,
};

describe("transcriptionProviders", () => {
  it("keeps the disabled provider as the default", () => {
    expect(transcriptionProviders.getDefault()).toMatchObject({
      id: "disabled-local-placeholder",
      enabled: false,
    });
  });

  it("registers the local Whisper placeholder as not installed and local-only", () => {
    const provider = transcriptionProviders.get("local-whisper-placeholder");

    expect(provider).toBe(localWhisperPlaceholderProvider);
    expect(provider).toMatchObject({
      enabled: false,
      status: "not_installed",
      config: {
        modelPath: null,
        device: "auto",
        language: null,
      },
      capabilities: {
        supportsStreaming: false,
        supportsPartialResults: false,
        runsLocally: true,
        requiresNetwork: false,
        storesAudio: false,
      },
    });
  });

  it("does not transcribe while the local placeholder is unavailable", async () => {
    await expect(
      transcribeWithGuard(localWhisperPlaceholderProvider, input),
    ).resolves.toEqual({
      status: "disabled",
      providerId: "local-whisper-placeholder",
      text: "",
      reason: "provider_disabled",
    });
  });

  it("fails safely for unknown providers", () => {
    expect(() => transcriptionProviders.get("missing-provider")).toThrow(
      "Transcription provider not registered: missing-provider",
    );
  });
});
