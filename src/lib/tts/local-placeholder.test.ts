import { describe, expect, it } from "vitest";
import { localTtsPlaceholderProvider } from "./local-placeholder";

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
});
