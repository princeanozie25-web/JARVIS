import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AudioSessionState } from "@/lib/audio";
import type { TranscriptionJob, VoiceTranscriptChatPayload } from "@/lib/stt";
import { VoiceControlPanel } from "./VoiceControlPanel";

const readyState: AudioSessionState = {
  status: "ready",
  microphonePermissionStatus: "granted",
  selectedInputDeviceId: "",
  selectedOutputDeviceId: "",
  pushToTalkActive: false,
  captureStartedAt: null,
  activeCaptureSessionId: null,
  captureDurationMs: 0,
  captureSampleRate: null,
  streamActive: false,
  vuLevel: 0,
  inputDevices: [{ kind: "audioinput", deviceId: "mic-1", label: "Desk Mic" }],
  outputDevices: [
    { kind: "audiooutput", deviceId: "speaker-1", label: "Desk Speaker" },
  ],
};

const transcriptDraftPayload: VoiceTranscriptChatPayload = {
  target: "chat_input",
  source: "voice",
  text: "Reviewed voice draft.",
  sourceDraftId: "draft-1",
  sourceJobId: "job-1",
  canApproveRuntimeActions: false,
};

const runningTranscriptionJob: TranscriptionJob = {
  id: "job-1",
  providerId: "local-whisper-placeholder",
  status: "running",
  createdAt: 1_000,
  startedAt: 1_001,
  source: "ptt_capture",
};

describe("VoiceControlPanel", () => {
  it("renders the Phase 4 audio scaffold without transcript or speaker features", () => {
    const html = renderToStaticMarkup(
      <VoiceControlPanel initialState={readyState} />,
    );

    expect(html).toContain("Voice Scaffold");
    expect(html).toContain("Push-to-talk lifecycle with manual local");
    expect(html).toContain("Hold to Talk");
    expect(html).toContain("VU placeholder");
    expect(html).toContain("STT not configured yet.");
    expect(html).toContain("disabled-local-placeholder");
    expect(html).toContain("local-whisper-placeholder");
    expect(html).toContain("not installed");
    expect(html).toContain("Runtime state: disabled");
    expect(html).toContain("No active transcription job");
    expect(html).toContain("Transcription disabled/not configured");
    expect(html).toContain("Transcript draft");
    expect(html).toContain("Voice transcript must be reviewed before sending.");
    expect(html).toContain("Submit reviewed transcript");
    expect(html).toContain("local only, no network, no audio storage");
    expect(html).toContain("TTS disabled/not configured.");
    expect(html).toContain("Default provider disabled: disabled");
    expect(html).toContain(
      "Local provider local-tts-placeholder: not_installed",
    );
    expect(html).toContain("Runtime state: disabled");
    expect(html).toContain(
      "Playback unavailable until a reviewed TTS provider is configured.",
    );
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
          activeCaptureSessionId: "capture-1",
          captureDurationMs: 125,
          captureSampleRate: 48_000,
          streamActive: true,
          vuLevel: 0.7,
        }}
      />,
    );

    expect(html).toContain("Mic recording");
    expect(html).toContain("Mic active");
    expect(html).toContain("capture-1");
    expect(html).toContain("48000Hz");
    expect(html).toContain('aria-pressed="true"');
  });

  it("keeps transcript submit disabled unless a draft payload exists", () => {
    const disabledHtml = renderToStaticMarkup(
      <VoiceControlPanel initialState={readyState} />,
    );
    const enabledHtml = renderToStaticMarkup(
      <VoiceControlPanel
        initialState={readyState}
        transcriptDraftPayload={transcriptDraftPayload}
      />,
    );

    expect(disabledHtml).toContain("Submit reviewed transcript");
    const disabledButton = disabledHtml.match(
      /<button[^>]*>Submit reviewed transcript<\/button>/,
    )?.[0];
    const enabledButton = enabledHtml.match(
      /<button[^>]*>Submit reviewed transcript<\/button>/,
    )?.[0];

    expect(disabledButton).toMatch(/\sdisabled(=|\s|>)/);
    expect(enabledHtml).toContain("Submit reviewed transcript");
    expect(enabledHtml).not.toContain("Reviewed voice draft");
    expect(enabledButton).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it("shows local transcription job state", () => {
    const html = renderToStaticMarkup(
      <VoiceControlPanel
        initialState={readyState}
        transcriptionJob={runningTranscriptionJob}
      />,
    );

    expect(html).toContain("Transcription running");
    expect(html).toContain("Transcribing locally");
    expect(html).toContain("Cancel transcription");
    expect(html).toContain("Local processing only - review before sending.");
  });

  it("shows failed transcription state without enabling transcript submit", () => {
    const html = renderToStaticMarkup(
      <VoiceControlPanel
        initialState={readyState}
        transcriptionJob={{
          ...runningTranscriptionJob,
          status: "failed",
          completedAt: 1_100,
          durationMs: 99,
          error: "transcription_failed",
        }}
      />,
    );
    const submitButton = html.match(
      /<button[^>]*>Submit reviewed transcript<\/button>/,
    )?.[0];

    expect(html).toContain("Transcription failed");
    expect(html).not.toContain("Cancel transcription");
    expect(submitButton).toMatch(/\sdisabled(=|\s|>)/);
  });
});
