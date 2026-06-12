import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyDeepSeekLiveRegistryOverride,
  createModelRegistryFromYaml,
  DEEPSEEK_LIVE_OVERRIDE_ENV,
  loadDefaultModelRegistry,
} from "../../src/models";

describe("Phase 13A.1 model registry loader", () => {
  // E-008 registry-pin reshape: the deep-equal ID census froze the catalog
  // as data, contradicting the 23A T4 doctrine and the 21A living-catalog
  // premise. Reshaped to Phase 13 baseline preservation — the seven closeout
  // rows stay present with unchanged key properties; the catalog may grow.
  it("loads config/models/registry.yaml successfully", () => {
    const registry = loadDefaultModelRegistry();

    expect(registry.schemaVersion).toBe(1);
    const phase13Baseline = [
      {
        id: "mock-local-model",
        tier: "T1",
        runtime_class: "mock",
        visibility: "enabled",
      },
      {
        id: "llama3.2:3b",
        tier: "T1",
        runtime_class: "local",
        visibility: "enabled",
      },
      {
        id: "qwen2.5:7b",
        tier: "T2",
        runtime_class: "local",
        visibility: "enabled",
      },
      {
        id: "deepseek-v4-flash",
        tier: "T2",
        runtime_class: "cloud",
        visibility: "disabled",
      },
      {
        id: "deepseek-v4-pro",
        tier: "T3",
        runtime_class: "cloud",
        visibility: "disabled",
      },
      {
        id: "claude-haiku",
        tier: "T3",
        runtime_class: "cloud",
        visibility: "disabled",
      },
      {
        id: "claude-opus",
        tier: "T4",
        runtime_class: "cloud",
        visibility: "disabled",
      },
    ] as const;
    for (const baseline of phase13Baseline) {
      expect(registry.getModel(baseline.id)).toMatchObject(baseline);
    }
  });

  // E-008 (b): universal schema + consistency assertions over the LIVE
  // registry — every entry, present and future.
  it("keeps every live registry entry schema-consistent (E-008)", () => {
    const registry = loadDefaultModelRegistry();
    const models = registry.listModels();

    expect(models.length).toBeGreaterThanOrEqual(7);
    for (const entry of models) {
      expect(["T0", "T1", "T2", "T3", "T4"]).toContain(entry.tier);
      expect(["local", "cloud", "mock"]).toContain(entry.runtime_class);
      expect(["enabled", "disabled"]).toContain(entry.visibility);
      expect(entry.supports_tools).toBe(
        entry.capabilities.includes("tool_reasoning"),
      );
      expect(entry.supports_vision).toBe(entry.capabilities.includes("vision"));
    }
  });

  it("registers DeepSeek V4 cloud entries as disabled metadata only", () => {
    const registry = loadDefaultModelRegistry();
    const flash = registry.getModel("deepseek-v4-flash");
    const pro = registry.getModel("deepseek-v4-pro");

    expect(flash).toMatchObject({
      id: "deepseek-v4-flash",
      provider: "deepseek",
      tier: "T2",
      runtime_class: "cloud",
      visibility: "disabled",
      supports_tools: true,
    });
    expect(pro).toMatchObject({
      id: "deepseek-v4-pro",
      provider: "deepseek",
      tier: "T3",
      runtime_class: "cloud",
      visibility: "disabled",
      supports_tools: true,
    });
    expect(registry.listEnabledModels().map((entry) => entry.id)).not.toEqual(
      expect.arrayContaining(["deepseek-v4-flash", "deepseek-v4-pro"]),
    );
    expect(registry.listModels().map((entry) => entry.id)).not.toEqual(
      expect.arrayContaining(["deepseek-chat", "deepseek-reasoner"]),
    );
  });

  it("keeps the committed DeepSeek defaults disabled without the local live override", () => {
    const registry = loadDefaultModelRegistry();
    const override = applyDeepSeekLiveRegistryOverride(registry, {});

    expect(override.override_applied).toBe(false);
    expect(override.enabled_model_ids).toEqual([]);
    expect(override.registry.getModel("deepseek-v4-flash")?.visibility).toBe(
      "disabled",
    );
    expect(override.registry.getModel("deepseek-v4-pro")?.visibility).toBe(
      "disabled",
    );
  });

  it("enables only DeepSeek V4 entries in an in-memory local live override", () => {
    const registry = loadDefaultModelRegistry();
    const override = applyDeepSeekLiveRegistryOverride(registry, {
      [DEEPSEEK_LIVE_OVERRIDE_ENV]: "true",
    });

    expect(override.override_applied).toBe(true);
    expect(override.enabled_model_ids).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
    expect(override.registry.getModel("deepseek-v4-flash")?.visibility).toBe(
      "enabled",
    );
    expect(override.registry.getModel("deepseek-v4-pro")?.visibility).toBe(
      "enabled",
    );
    expect(registry.getModel("deepseek-v4-flash")?.visibility).toBe("disabled");
    expect(registry.getModel("deepseek-v4-pro")?.visibility).toBe("disabled");
    expect(override.registry.getModel("claude-haiku")?.visibility).toBe(
      "disabled",
    );
  });

  it("rejects malformed YAML", () => {
    expect(() => createModelRegistryFromYaml("models: [:\n")).toThrow();
  });

  it("returns defensive copies so callers cannot mutate canonical entries", () => {
    const registry = loadDefaultModelRegistry();
    const firstRead = registry.getModel("llama3.2:3b");
    if (!firstRead) throw new Error("Expected llama entry to exist.");

    firstRead.metadata.display_name = "Mutated";
    firstRead.capabilities.push("vision");

    expect(registry.getModel("llama3.2:3b")?.metadata.display_name).toBe(
      "Llama 3.2 3B",
    );
    expect(registry.getModel("llama3.2:3b")?.capabilities).not.toContain(
      "vision",
    );
  });

  it("orders entries deterministically by priority and id", () => {
    const registry = createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: z-local
    provider: ollama
    tier: T1
    runtime_class: local
    capabilities: [chat]
    context_window: 2048
    visibility: enabled
    priority: 20
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Z Local
      description: Local model metadata.
      approximate_memory_mb: 1024
      cost_class: local_free
      governance_notes: Metadata only.
  - id: a-local
    provider: ollama
    tier: T1
    runtime_class: local
    capabilities: [chat]
    context_window: 2048
    visibility: enabled
    priority: 20
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: A Local
      description: Local model metadata.
      approximate_memory_mb: 1024
      cost_class: local_free
      governance_notes: Metadata only.
  - id: first-local
    provider: ollama
    tier: T1
    runtime_class: local
    capabilities: [chat]
    context_window: 2048
    visibility: enabled
    priority: 1
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: First Local
      description: Local model metadata.
      approximate_memory_mb: 1024
      cost_class: local_free
      governance_notes: Metadata only.
`);

    expect(registry.listModels().map((entry) => entry.id)).toEqual([
      "first-local",
      "a-local",
      "z-local",
    ]);
  });

  it("handles an empty registry without manufacturing defaults", () => {
    const registry = createModelRegistryFromYaml(`
schema_version: 1
models: []
`);

    expect(registry.getRegistry()).toEqual({ schema_version: 1, models: [] });
    expect(registry.listModels()).toEqual([]);
    expect(registry.listEnabledModels()).toEqual([]);
  });

  it("exposes no network, execution, install, probing, router mutation, env mutation, or persistence authority", () => {
    const registry = loadDefaultModelRegistry();
    const source = readFileSync(
      join(process.cwd(), "src/models/registry.ts"),
      "utf8",
    );

    expect(registry.getAuthoritySnapshot()).toEqual({
      networkCallsEnabled: false,
      providerExecutionEnabled: false,
      runtimeStateMutationEnabled: false,
      routerMutationEnabled: false,
      telemetryPersistenceEnabled: false,
      environmentVariableMutationEnabled: false,
      modelInstallationEnabled: false,
      providerProbingEnabled: false,
    });
    expect(source).not.toMatch(/fetch\(|WebSocket|process\.env|exec\(|spawn\(/);
  });
});
