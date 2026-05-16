import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import type { ChatProvider, ProviderId } from "./types";

class ProviderRegistry {
  private providers = new Map<ProviderId, ChatProvider>();

  register(provider: ChatProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): ChatProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider not registered: ${id}`);
    }
    return provider;
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  list(): ProviderId[] {
    return Array.from(this.providers.keys());
  }
}

export const registry = new ProviderRegistry();

registry.register(new OpenAIProvider());
registry.register(new AnthropicProvider());
