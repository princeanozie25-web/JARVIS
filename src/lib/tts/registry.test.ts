import { describe, expect, it } from "vitest";
import { localTtsPlaceholderProvider } from "./local-placeholder";
import { speechProviders } from "./registry";

describe("speechProviders", () => {
  it("keeps the disabled provider as the default", () => {
    expect(speechProviders.getDefault()).toMatchObject({
      id: "disabled",
      enabled: false,
      status: "disabled",
    });
  });

  it("registers the local placeholder as local-only and unavailable", () => {
    expect(speechProviders.get("local-tts-placeholder")).toBe(
      localTtsPlaceholderProvider,
    );
    expect(localTtsPlaceholderProvider).toMatchObject({
      enabled: false,
      status: "not_installed",
      config: {
        binaryPath: null,
        voiceModelPath: null,
        speakerId: null,
        sampleRate: null,
        startupTimeoutMs: 5_000,
      },
      metadata: {
        runsLocally: true,
        requiresNetwork: false,
        storesAudio: false,
        supportsStreaming: false,
      },
    });
  });

  it("fails safely for unknown providers", () => {
    expect(() => speechProviders.get("missing-tts")).toThrow(
      "Speech provider not registered: missing-tts",
    );
  });
});
