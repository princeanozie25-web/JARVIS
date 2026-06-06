import type { VoiceTranscriptChatPayload } from "@/lib/stt";

export interface VoiceDraftInputMarker {
  source: "voice";
  sourceDraftId: string;
  sourceJobId: string;
  canApproveRuntimeActions: false;
}

export interface VoiceDraftInputState {
  input: string;
  marker: VoiceDraftInputMarker;
}

export function voiceDraftPayloadToChatInputState(
  payload: VoiceTranscriptChatPayload,
): VoiceDraftInputState | null {
  const text = payload.text.trim();
  if (
    payload.target !== "chat_input" ||
    payload.source !== "voice" ||
    payload.canApproveRuntimeActions !== false ||
    !text
  ) {
    return null;
  }
  return {
    input: text,
    marker: {
      source: "voice",
      sourceDraftId: payload.sourceDraftId,
      sourceJobId: payload.sourceJobId,
      canApproveRuntimeActions: false,
    },
  };
}

export function voiceDraftMarkerAfterInputChange(
  value: string,
  current: VoiceDraftInputMarker | null,
): VoiceDraftInputMarker | null {
  return value.trim() ? current : null;
}

export function canSendTypedChatInput(
  input: string,
  loading: boolean,
): boolean {
  return Boolean(input.trim()) && !loading;
}
