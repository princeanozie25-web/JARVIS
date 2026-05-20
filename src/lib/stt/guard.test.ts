import { describe, expect, it, vi } from "vitest";
import { transcribeWithGuard } from "./guard";
import type { TranscriptionInput, TranscriptionProvider } from "./types";

const input: TranscriptionInput = {
  captureSessionId: "capture-1",
  chunks: [],
  sampleRate: 48_000,
  durationMs: 250,
};

describe("transcribeWithGuard", () => {
  it("refuses transcription when the provider is disabled", async () => {
    const provider: TranscriptionProvider = {
      id: "disabled-test",
      enabled: false,
      transcribe: vi.fn(),
    };

    await expect(transcribeWithGuard(provider, input)).resolves.toEqual({
      status: "disabled",
      providerId: "disabled-test",
      text: "",
      reason: "provider_disabled",
    });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("calls the provider only when explicitly enabled", async () => {
    const provider: TranscriptionProvider = {
      id: "enabled-test",
      enabled: true,
      transcribe: vi.fn().mockResolvedValue({
        status: "completed",
        providerId: "enabled-test",
        text: "future transcript",
      }),
    };

    await expect(transcribeWithGuard(provider, input)).resolves.toEqual({
      status: "completed",
      providerId: "enabled-test",
      text: "future transcript",
    });
    expect(provider.transcribe).toHaveBeenCalledWith(input);
  });
});
