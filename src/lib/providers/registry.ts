import { config } from "../runtime/config";
import { AnthropicProvider } from "./anthropic";
import { OllamaProvider } from "./ollama";
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

// E-037 (Phase 25B-1): the local brain is always registered; cloud providers
// only when their key exists (an unset key means "not configured", and
// `registry.get()` then throws "Provider not registered" — the honest
// answer, never a silent cloud fallback).
registry.register(new OllamaProvider());
if (config.openai.apiKey) registry.register(new OpenAIProvider());
if (config.anthropic.apiKey) registry.register(new AnthropicProvider());
