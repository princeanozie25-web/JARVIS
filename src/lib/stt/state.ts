import type {
  TranscriptionResult,
  TranscriptionState,
  TranscriptionStatus,
} from "./types";

export const initialTranscriptionState: TranscriptionState = {
  status: "disabled",
  providerId: null,
  captureSessionId: null,
  text: "",
  reason: "not_configured",
};

export type TranscriptionAction =
  | { type: "prepare"; providerId: string; captureSessionId: string }
  | { type: "start" }
  | { type: "complete"; result: TranscriptionResult }
  | { type: "fail"; providerId: string; message: string }
  | {
      type: "disable";
      providerId?: string;
      reason?: TranscriptionResult["reason"];
    }
  | { type: "reset"; status?: TranscriptionStatus };

export function transcriptionReducer(
  state: TranscriptionState,
  action: TranscriptionAction,
): TranscriptionState {
  switch (action.type) {
    case "prepare":
      return {
        status: "preparing",
        providerId: action.providerId,
        captureSessionId: action.captureSessionId,
        text: "",
      };

    case "start":
      if (state.status !== "preparing") return state;
      return { ...state, status: "transcribing" };

    case "complete":
      return {
        status: action.result.status,
        providerId: action.result.providerId,
        captureSessionId: state.captureSessionId,
        text: action.result.text,
        reason: action.result.reason,
        errorMessage: action.result.errorMessage,
      };

    case "fail":
      return {
        ...state,
        status: "error",
        providerId: action.providerId,
        text: "",
        reason: "transcription_failed",
        errorMessage: action.message,
      };

    case "disable":
      return {
        status: "disabled",
        providerId: action.providerId ?? state.providerId,
        captureSessionId: null,
        text: "",
        reason: action.reason ?? "not_configured",
      };

    case "reset":
      return {
        ...initialTranscriptionState,
        status: action.status ?? initialTranscriptionState.status,
      };
  }
}
