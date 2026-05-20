import { describe, expect, it, vi } from "vitest";
import {
  canSendTypedChatInput,
  voiceDraftMarkerAfterInputChange,
  voiceDraftPayloadToChatInputState,
  type VoiceDraftInputMarker,
} from "./page";
import type { VoiceTranscriptChatPayload } from "@/lib/stt";

const voicePayload: VoiceTranscriptChatPayload = {
  target: "chat_input",
  source: "voice",
  text: "  Reviewed voice draft.  ",
  sourceDraftId: "draft-1",
  sourceJobId: "job-1",
  canApproveRuntimeActions: false,
};

describe("voice draft chat input bridge", () => {
  it("populates chat input state without sending a chat request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(voiceDraftPayloadToChatInputState(voicePayload)).toEqual({
      input: "Reviewed voice draft.",
      marker: {
        source: "voice",
        sourceDraftId: "draft-1",
        sourceJobId: "job-1",
        canApproveRuntimeActions: false,
      },
    });
    expect(fetchSpy).not.toHaveBeenCalledWith("/api/chat", expect.anything());

    fetchSpy.mockRestore();
  });

  it("preserves the voice source marker while edited text remains non-empty", () => {
    const marker: VoiceDraftInputMarker = {
      source: "voice",
      sourceDraftId: "draft-1",
      sourceJobId: "job-1",
      canApproveRuntimeActions: false,
    };

    expect(voiceDraftMarkerAfterInputChange("edited text", marker)).toBe(
      marker,
    );
    expect(voiceDraftMarkerAfterInputChange("   ", marker)).toBeNull();
  });

  it("rejects empty voice payload text before it reaches chat input", () => {
    expect(
      voiceDraftPayloadToChatInputState({
        ...voicePayload,
        text: "   ",
      }),
    ).toBeNull();
  });

  it("keeps voice drafts unable to approve runtime actions", () => {
    const state = voiceDraftPayloadToChatInputState(voicePayload);

    expect(state?.marker.source).toBe("voice");
    expect(state?.marker.canApproveRuntimeActions).toBe(false);
  });

  it("rejects malformed voice payloads before they reach chat input", () => {
    expect(
      voiceDraftPayloadToChatInputState({
        ...voicePayload,
        source: "typed",
      } as unknown as VoiceTranscriptChatPayload),
    ).toBeNull();
    expect(
      voiceDraftPayloadToChatInputState({
        ...voicePayload,
        canApproveRuntimeActions: true,
      } as unknown as VoiceTranscriptChatPayload),
    ).toBeNull();
  });

  it("leaves the typed send guard unchanged", () => {
    expect(canSendTypedChatInput("typed message", false)).toBe(true);
    expect(canSendTypedChatInput("   ", false)).toBe(false);
    expect(canSendTypedChatInput("typed message", true)).toBe(false);
  });
});
