import { describe, expect, it } from "vitest";
import { disabledSpeechProvider } from "./disabled-provider";

describe("disabledSpeechProvider", () => {
  it("always refuses synthesis without audio output", async () => {
    await expect(
      disabledSpeechProvider.synthesize({
        text: "Assistant prose.",
        source: "assistant_prose",
      }),
    ).resolves.toEqual({
      status: "disabled",
      providerId: "disabled",
      audio: null,
      reason: "provider_disabled",
    });
    expect(disabledSpeechProvider.enabled).toBe(false);
    expect(disabledSpeechProvider.status).toBe("disabled");
  });
});
