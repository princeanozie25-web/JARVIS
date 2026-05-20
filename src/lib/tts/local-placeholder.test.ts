import { describe, expect, it } from "vitest";
import {
  localTtsPlaceholderConfig,
  localTtsPlaceholderProvider,
  localTtsProviderFromRuntimeStatus,
} from "./local-placeholder";
import { localTtsRuntimeMetadata } from "./local-runtime";

describe("localTtsPlaceholderProvider", () => {
  it("refuses synthesis while unavailable and emits no audio", async () => {
    await expect(
      localTtsPlaceholderProvider.synthesize({
        text: "Assistant prose.",
        source: "assistant_prose",
      }),
    ).resolves.toEqual({
      status: "disabled",
      providerId: "local-tts-placeholder",
      audio: null,
      reason: "provider_unavailable",
    });
  });

  it("can mirror runtime readiness without enabling synthesis by default", () => {
    expect(
      localTtsProviderFromRuntimeStatus({
        providerId: "local-tts-placeholder",
        status: "ready",
        message: "ready",
        metadata: localTtsRuntimeMetadata,
        config: {
          ...localTtsPlaceholderConfig,
          enabled: true,
          binaryPath: "C:\\local\\tts.exe",
          voiceModelPath: "C:\\local\\voice.onnx",
        },
      }),
    ).toMatchObject({
      id: "local-tts-placeholder",
      enabled: true,
      status: "ready",
      metadata: {
        runsLocally: true,
        requiresNetwork: false,
        storesAudio: false,
      },
    });
  });
});
