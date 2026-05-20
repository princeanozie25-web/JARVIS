import { describe, expect, it } from "vitest";
import { InMemoryVoiceTranscriptDraftManager } from "./transcript-drafts";
import type {
  TranscriptionResult,
  VoiceTranscriptDraftTelemetryEvent,
} from "./types";

const completedResult: TranscriptionResult = {
  status: "completed",
  providerId: "local-whisper-placeholder",
  text: "  Hello from voice.  ",
  confidence: 0.82,
  language: "en",
};

function createManager() {
  let id = 0;
  let now = 1_000;
  const telemetry: VoiceTranscriptDraftTelemetryEvent[] = [];
  return {
    telemetry,
    manager: new InMemoryVoiceTranscriptDraftManager({
      newId: () => `draft-${++id}`,
      now: () => now++,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    }),
  };
}

describe("InMemoryVoiceTranscriptDraftManager", () => {
  it("creates a draft from a completed transcription result", async () => {
    const { manager, telemetry } = createManager();

    await expect(
      manager.createDraft({
        result: completedResult,
        sourceJobId: "job-1",
      }),
    ).resolves.toEqual({
      id: "draft-1",
      text: "Hello from voice.",
      sourceJobId: "job-1",
      createdAt: 1_000,
      confidence: 0.82,
      language: "en",
      status: "draft",
    });

    expect(manager.hasDraft()).toBe(true);
    expect(telemetry).toEqual([
      expect.objectContaining({
        eventType: "transcript_draft_created",
        draftId: "draft-1",
        sourceJobId: "job-1",
        success: true,
      }),
    ]);
  });

  it("rejects empty and non-completed transcription results", async () => {
    const { manager, telemetry } = createManager();

    await expect(
      manager.createDraft({
        result: {
          ...completedResult,
          text: "   ",
        },
        sourceJobId: "job-empty",
      }),
    ).resolves.toBeNull();

    await expect(
      manager.createDraft({
        result: {
          status: "disabled",
          providerId: "local-whisper-placeholder",
          text: "should not matter",
          reason: "provider_disabled",
        },
        sourceJobId: "job-disabled",
      }),
    ).resolves.toBeNull();

    expect(manager.hasDraft()).toBe(false);
    expect(telemetry).toEqual([
      expect.objectContaining({
        eventType: "transcript_draft_rejected",
        reason: "empty_transcript",
      }),
      expect.objectContaining({
        eventType: "transcript_draft_rejected",
        reason: "not_completed",
      }),
    ]);
  });

  it("edits and discards a draft without retaining it", async () => {
    const { manager, telemetry } = createManager();
    await manager.createDraft({
      result: completedResult,
      sourceJobId: "job-1",
    });

    await expect(manager.editDraft("Reviewed text.")).resolves.toMatchObject({
      id: "draft-1",
      text: "Reviewed text.",
      status: "draft",
    });

    await expect(manager.discardDraft()).resolves.toMatchObject({
      id: "draft-1",
      text: "Reviewed text.",
      status: "discarded",
    });
    expect(manager.getDraft()).toBeNull();
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "transcript_draft_created",
      "transcript_draft_discarded",
    ]);
  });

  it("submits by returning a typed chat input payload and clearing the draft", async () => {
    const { manager } = createManager();
    await manager.createDraft({
      result: completedResult,
      sourceJobId: "job-1",
    });
    await manager.editDraft("Reviewed voice text.");

    await expect(manager.submitDraft()).resolves.toEqual({
      target: "chat_input",
      source: "voice",
      text: "Reviewed voice text.",
      sourceDraftId: "draft-1",
      sourceJobId: "job-1",
      canApproveRuntimeActions: false,
    });
    expect(manager.getDraft()).toBeNull();
  });

  it("has no auto-submit path before explicit submitDraft", async () => {
    const { manager, telemetry } = createManager();
    await manager.createDraft({
      result: completedResult,
      sourceJobId: "job-1",
    });

    expect(manager.getDraft()).toMatchObject({
      id: "draft-1",
      status: "draft",
    });
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "transcript_draft_created",
    ]);
  });

  it("keeps transcript text out of telemetry", async () => {
    const { manager, telemetry } = createManager();
    await manager.createDraft({
      result: {
        ...completedResult,
        text: "secret transcript text",
      },
      sourceJobId: "job-1",
    });
    await manager.submitDraft();

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("transcript_draft_created");
    expect(serialized).toContain("transcript_draft_submitted");
    expect(serialized).not.toContain("secret transcript text");
  });
});
