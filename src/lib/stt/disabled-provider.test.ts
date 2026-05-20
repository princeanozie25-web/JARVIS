import { describe, expect, it } from "vitest";
import { disabledTranscriptionProvider } from "./disabled-provider";
import type { TranscriptionInput } from "./types";

const input: TranscriptionInput = {
  captureSessionId: "capture-1",
  chunks: [],
  sampleRate: 48_000,
  durationMs: 250,
};

describe("disabledTranscriptionProvider", () => {
  it("always returns disabled and not_configured without transcript text", async () => {
    await expect(
      disabledTranscriptionProvider.transcribe(input),
    ).resolves.toEqual({
      status: "disabled",
      providerId: "disabled-local-placeholder",
      text: "",
      reason: "not_configured",
    });
    expect(disabledTranscriptionProvider.enabled).toBe(false);
    expect(disabledTranscriptionProvider.capabilities).toMatchObject({
      supportsStreaming: false,
      supportsPartialResults: false,
      runsLocally: true,
      requiresNetwork: false,
      storesAudio: false,
    });
  });
});
