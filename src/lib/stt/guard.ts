import { disabledTranscriptionResult } from "./disabled-provider";
import { transcriptionProviders } from "./registry";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

export async function transcribeWithGuard(
  provider: TranscriptionProvider,
  input: TranscriptionInput,
  options?: { signal?: AbortSignal },
): Promise<TranscriptionResult> {
  const guardFailure = getTranscriptionGuardFailure(provider);
  if (guardFailure) return guardFailure;

  if (!options) return provider.transcribe(input);
  return provider.transcribe(input, options);
}

export function getDefaultTranscriptionProvider(): TranscriptionProvider {
  return transcriptionProviders.getDefault();
}

export function getTranscriptionGuardFailure(
  provider: TranscriptionProvider,
): TranscriptionResult | null {
  if (!provider.enabled) {
    return disabledTranscriptionResult("provider_disabled", provider.id);
  }
  if (provider.status !== "ready") {
    return disabledTranscriptionResult("provider_unavailable", provider.id);
  }

  return null;
}
