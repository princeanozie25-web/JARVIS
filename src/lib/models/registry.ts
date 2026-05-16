import type { ProviderId } from "../providers/types";
import type { ModelEntry } from "./types";

export class ModelRegistry {
  private entries = new Map<string, ModelEntry>();

  register(entry: ModelEntry): void {
    this.entries.set(entry.id, entry);
  }

  get(id: string): ModelEntry {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Model not registered: ${id}`);
    }
    return entry;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  list(filter?: (entry: ModelEntry) => boolean): ModelEntry[] {
    const all = Array.from(this.entries.values());
    return filter ? all.filter(filter) : all;
  }

  getByModelName(modelName: string): ModelEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.modelName === modelName) return entry;
    }
    return undefined;
  }

  getDefaultForProvider(provider: ProviderId): ModelEntry {
    const candidate = this.list(
      (entry) => entry.provider === provider && entry.enabled,
    )[0];
    if (!candidate) {
      throw new Error(`No enabled model registered for provider: ${provider}`);
    }
    return candidate;
  }
}

export const models = new ModelRegistry();
