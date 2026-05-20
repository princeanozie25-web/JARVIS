import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AudioSessionState } from "@/lib/audio";
import { VoiceControlPanel } from "./VoiceControlPanel";

const readyState: AudioSessionState = {
  status: "ready",
  microphonePermissionStatus: "granted",
  selectedInputDeviceId: "",
  selectedOutputDeviceId: "",
  pushToTalkActive: false,
  captureStartedAt: null,
  inputDevices: [{ kind: "audioinput", deviceId: "mic-1", label: "Desk Mic" }],
  outputDevices: [
    { kind: "audiooutput", deviceId: "speaker-1", label: "Desk Speaker" },
  ],
};

describe("VoiceControlPanel", () => {
  it("renders the Phase 4 audio scaffold without transcript or speaker features", () => {
    const html = renderToStaticMarkup(
      <VoiceControlPanel initialState={readyState} />,
    );

    expect(html).toContain("Voice Scaffold");
    expect(html).toContain("Push-to-talk lifecycle only");
    expect(html).toContain("Hold to Talk");
    expect(html).toContain("VU placeholder");
    expect(html).toContain("Disabled until speech-to-text is implemented.");
    expect(html).toContain("Disabled until text-to-speech is implemented.");
    expect(html).toContain("Desk Mic");
    expect(html).toContain("Desk Speaker");
  });

  it("makes recording state visually explicit", () => {
    const html = renderToStaticMarkup(
      <VoiceControlPanel
        initialState={{
          ...readyState,
          status: "recording",
          pushToTalkActive: true,
          captureStartedAt: 1_000,
        }}
      />,
    );

    expect(html).toContain("Mic recording");
    expect(html).toContain("Mic active");
    expect(html).toContain('aria-pressed="true"');
  });
});
