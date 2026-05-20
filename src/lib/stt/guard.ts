import {
  disabledTranscriptionResult,
  disabledTranscriptionProvider,
} from "./disabled-provider";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

export async function transcribeWithGuard(
  provider: TranscriptionProvider,
  input: TranscriptionInput,
): Promise<TranscriptionResult> {
  if (!provider.enabled) {
    return disabledTranscriptionResult("provider_disabled", provider.id);
  }

  return provider.transcribe(input);
}

export function getDefaultTranscriptionProvider(): TranscriptionProvider {
  return disabledTranscriptionProvider;
}
