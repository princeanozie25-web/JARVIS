import { describe, expect, it } from "vitest";

import {
  parseModelRegistry,
  validateModelRegistry,
} from "../../src/models/schema";
import type { ModelRegistry } from "../../src/models/types";

function validEntry(overrides = {}) {
  return {
    id: "llama3.2:3b",
    provider: "ollama",
    tier: "T1",
    runtime_class: "local",
    capabilities: ["chat", "summarize", "classify"],
    context_window: 8192,
    visibility: "enabled",
    priority: 10,
    supports_streaming: true,
    supports_tools: false,
    supports_vision: false,
    metadata: {
      display_name: "Llama 3.2 3B",
      description: "Local model metadata.",
      approximate_memory_mb: 3072,
      cost_class: "local_free",
      governance_notes: "Metadata only.",
    },
    ...overrides,
  };
}

function validRegistry(overrides = {}): ModelRegistry {
  return parseModelRegistry({
    schema_version: 1,
    models: [validEntry()],
    ...overrides,
  });
}

describe("Phase 13A.1 model registry schema", () => {
  it("accepts a valid typed registry", () => {
    const registry = validRegistry();

    expect(registry.models[0]).toMatchObject({
      provider: "ollama",
      tier: "T1",
      runtime_class: "local",
      visibility: "enabled",
    });
  });

  it("rejects duplicate model ids", () => {
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [
          validEntry({ id: "duplicate-model" }),
          validEntry({ id: "duplicate-model", priority: 20 }),
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid enum values", () => {
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [validEntry({ tier: "T5" })],
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported provider and runtime combinations", () => {
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [validEntry({ provider: "anthropic", runtime_class: "local" })],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid capability combinations", () => {
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [
          validEntry({
            capabilities: ["embed", "chat"],
            supports_streaming: false,
          }),
        ],
      }).success,
    ).toBe(false);
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [
          validEntry({
            capabilities: ["chat"],
            supports_tools: true,
          }),
        ],
      }).success,
    ).toBe(false);
  });

  it("preserves disabled cloud providers without enabling them", () => {
    const registry = validRegistry({
      models: [
        validEntry({
          id: "deepseek-v4-flash",
          provider: "deepseek",
          tier: "T2",
          runtime_class: "cloud",
          visibility: "disabled",
          priority: 100,
          metadata: {
            display_name: "DeepSeek V4 Flash",
            description: "Disabled DeepSeek cloud metadata.",
            approximate_memory_mb: null,
            cost_class: "cloud_metered_unverified",
            governance_notes: "Disabled by default.",
          },
        }),
      ],
    });

    expect(registry.models[0]).toMatchObject({
      provider: "deepseek",
      runtime_class: "cloud",
      visibility: "disabled",
    });
  });

  it("allows intentionally enabled cloud entries while default registry entries stay disabled", () => {
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [
          validEntry({
            id: "deepseek-v4-pro",
            provider: "deepseek",
            runtime_class: "cloud",
            visibility: "enabled",
            metadata: {
              display_name: "DeepSeek V4 Pro",
              description: "Intentionally enabled smoke metadata.",
              approximate_memory_mb: null,
              cost_class: "cloud_metered_unverified",
              governance_notes: "Explicit runtime cloud policy required.",
            },
          }),
        ],
      }).success,
    ).toBe(true);
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [
          validEntry({
            id: "cloud-enabled",
            provider: "openai",
            runtime_class: "cloud",
            visibility: "enabled",
          }),
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(
      validateModelRegistry({
        schema_version: 1,
        models: [validEntry({ surprise_field: true })],
      }).success,
    ).toBe(false);
  });

  it("accepts registry entries with and without optional EOL metadata", () => {
    const result = validateModelRegistry({
      schema_version: 1,
      models: [
        validEntry({ id: "without-eol" }),
        validEntry({
          id: "deepseek-v3",
          provider: "deepseek",
          runtime_class: "cloud",
          visibility: "enabled",
          eol_date: "2026-07-24",
          replacement_id: "deepseek-v4-flash",
          metadata: {
            display_name: "DeepSeek V3",
            description:
              "Enabled fixture with manually configured EOL metadata.",
            approximate_memory_mb: null,
            cost_class: "cloud_metered_unverified",
            governance_notes:
              "Fixture only; loading does not call provider APIs.",
          },
        }),
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected valid registry");
    expect(result.data.models[0].eol_date).toBeUndefined();
    expect(result.data.models[1]).toMatchObject({
      eol_date: "2026-07-24",
      replacement_id: "deepseek-v4-flash",
    });
  });

  it("supports an explicitly empty registry", () => {
    expect(parseModelRegistry({ schema_version: 1, models: [] })).toEqual({
      schema_version: 1,
      models: [],
    });
  });
});
