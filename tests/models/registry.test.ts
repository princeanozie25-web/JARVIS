import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createModelRegistryFromYaml,
  loadDefaultModelRegistry,
} from "../../src/models/registry";

describe("Phase 13A.1 model registry loader", () => {
  it("loads config/models/registry.yaml successfully", () => {
    const registry = loadDefaultModelRegistry();

    expect(registry.schemaVersion).toBe(1);
    expect(registry.listModels().map((entry) => entry.id)).toEqual([
      "mock-local-model",
      "llama3.2:3b",
      "qwen2.5:7b",
      "claude-haiku",
      "claude-opus",
    ]);
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
