import { disabledTranscriptionProvider } from "./disabled-provider";
import { localWhisperPlaceholderProvider } from "./local-whisper-placeholder";
import type { TranscriptionProvider } from "./types";

export class TranscriptionProviderRegistry {
  private providers = new Map<string, TranscriptionProvider>();

  constructor(private readonly defaultProviderId: string) {}

  register(provider: TranscriptionProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): TranscriptionProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Transcription provider not registered: ${id}`);
    }
    return provider;
  }

  getDefault(): TranscriptionProvider {
    return this.get(this.defaultProviderId);
  }

  list(): TranscriptionProvider[] {
    return Array.from(this.providers.values());
  }
}

export const transcriptionProviders = new TranscriptionProviderRegistry(
  disabledTranscriptionProvider.id,
);

transcriptionProviders.register(disabledTranscriptionProvider);
transcriptionProviders.register(localWhisperPlaceholderProvider);
