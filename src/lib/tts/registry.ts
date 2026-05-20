import { disabledSpeechProvider } from "./disabled-provider";
import { localTtsPlaceholderProvider } from "./local-placeholder";
import type { SpeechProvider } from "./types";

export class SpeechProviderRegistry {
  private providers = new Map<string, SpeechProvider>();

  constructor(private readonly defaultProviderId: string) {}

  register(provider: SpeechProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): SpeechProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Speech provider not registered: ${id}`);
    }
    return provider;
  }

  getDefault(): SpeechProvider {
    return this.get(this.defaultProviderId);
  }

  list(): SpeechProvider[] {
    return Array.from(this.providers.values());
  }
}

export const speechProviders = new SpeechProviderRegistry(
  disabledSpeechProvider.id,
);

speechProviders.register(disabledSpeechProvider);
speechProviders.register(localTtsPlaceholderProvider);
