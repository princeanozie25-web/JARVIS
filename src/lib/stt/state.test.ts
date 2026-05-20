import { describe, expect, it } from "vitest";
import { initialTranscriptionState, transcriptionReducer } from "./state";

describe("transcriptionReducer", () => {
  it("moves through preparing, transcribing, and completed states", () => {
    const preparing = transcriptionReducer(initialTranscriptionState, {
      type: "prepare",
      providerId: "local-test",
      captureSessionId: "capture-1",
    });
    expect(preparing).toMatchObject({
      status: "preparing",
      providerId: "local-test",
      captureSessionId: "capture-1",
      text: "",
    });

    const transcribing = transcriptionReducer(preparing, { type: "start" });
    expect(transcribing.status).toBe("transcribing");

    const completed = transcriptionReducer(transcribing, {
      type: "complete",
      result: {
        status: "completed",
        providerId: "local-test",
        text: "hello",
      },
    });
    expect(completed).toMatchObject({
      status: "completed",
      providerId: "local-test",
      captureSessionId: "capture-1",
      text: "hello",
    });
  });

  it("supports disabled and error states without retaining transcript text", () => {
    const failed = transcriptionReducer(
      {
        ...initialTranscriptionState,
        status: "transcribing",
        providerId: "local-test",
        captureSessionId: "capture-1",
      },
      { type: "fail", providerId: "local-test", message: "not available" },
    );
    expect(failed).toMatchObject({
      status: "error",
      text: "",
      reason: "transcription_failed",
      errorMessage: "not available",
    });

    const disabled = transcriptionReducer(failed, {
      type: "disable",
      providerId: "local-test",
      reason: "provider_disabled",
    });
    expect(disabled).toMatchObject({
      status: "disabled",
      providerId: "local-test",
      captureSessionId: null,
      text: "",
      reason: "provider_disabled",
    });
  });
});
