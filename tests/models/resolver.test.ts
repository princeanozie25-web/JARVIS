import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createModelRegistryFromYaml,
  loadDefaultModelRegistry,
  resolveModel,
} from "../../src/models";
import type { ModelResolverResult } from "../../src/models";

function rejected(result: ModelResolverResult, id: string): readonly string[] {
  const candidate = result.candidates.find((entry) => entry.entry.id === id);
  if (!candidate) throw new Error(`Expected candidate ${id}.`);
  return candidate.rejection_reasons;
}

describe("Phase 13C.1 model resolver", () => {
  it("selects an enabled local chat model by default", () => {
    const result = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
    });

    expect(result.selected).toMatchObject({
      id: "llama3.2:3b",
      runtime_class: "local",
      visibility: "enabled",
    });
    expect(result.failure).toBeNull();
    expect(
      result.eligible_candidates.map((candidate) => candidate.entry.id),
    ).toEqual(["llama3.2:3b", "qwen2.5:7b", "mock-local-model"]);
  });

  it("excludes cloud models by default", () => {
    const result = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
    });

    expect(rejected(result, "claude-haiku")).toEqual([
      "disabled",
      "cloud_not_allowed",
    ]);
    expect(rejected(result, "claude-opus")).toEqual([
      "disabled",
      "cloud_not_allowed",
    ]);
    expect(
      result.eligible_candidates.every(
        (candidate) => candidate.entry.runtime_class !== "cloud",
      ),
    ).toBe(true);
  });

  it("allow_cloud includes cloud only if the registry entry is also enabled", () => {
    const result = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      allow_cloud: true,
    });

    expect(rejected(result, "claude-haiku")).toEqual(["disabled"]);
    expect(rejected(result, "claude-opus")).toEqual(["disabled"]);
    expect(
      result.eligible_candidates.map((candidate) => candidate.entry.id),
    ).not.toContain("claude-haiku");
  });

  it("allow_disabled does not implicitly allow cloud", () => {
    const result = resolveModel(loadDefaultModelRegistry(), {
      capability: "vision",
      allow_disabled: true,
      required_vision: true,
    });

    expect(result.selected).toBeNull();
    expect(result.failure).toEqual({
      reason: "no_eligible_models",
      message: "No registry entries matched the resolver policy.",
    });
    expect(rejected(result, "claude-opus")).toEqual(["cloud_not_allowed"]);
  });

  it("disabled cloud remains excluded unless allow_disabled and allow_cloud are both explicit", () => {
    const denied = resolveModel(loadDefaultModelRegistry(), {
      capability: "vision",
      allow_cloud: true,
      required_vision: true,
    });
    const allowed = resolveModel(loadDefaultModelRegistry(), {
      capability: "vision",
      allow_cloud: true,
      allow_disabled: true,
      required_vision: true,
    });

    expect(denied.selected).toBeNull();
    expect(rejected(denied, "claude-opus")).toEqual(["disabled"]);
    expect(allowed.selected).toMatchObject({
      id: "claude-opus",
      runtime_class: "cloud",
      visibility: "disabled",
      supports_vision: true,
    });
  });

  it("records capability mismatch rejections", () => {
    const result = resolveModel(loadDefaultModelRegistry(), {
      capability: "embed",
    });

    expect(result.selected).toBeNull();
    expect(rejected(result, "llama3.2:3b")).toContain("capability_mismatch");
    expect(rejected(result, "mock-local-model")).toContain(
      "capability_mismatch",
    );
  });

  it("filters by required streaming, tools, and vision support", () => {
    const streaming = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      required_streaming: true,
    });
    const tools = resolveModel(loadDefaultModelRegistry(), {
      capability: "tool_reasoning",
      required_tools: true,
    });
    const vision = resolveModel(loadDefaultModelRegistry(), {
      capability: "vision",
      allow_cloud: true,
      allow_disabled: true,
      required_vision: true,
    });

    expect(streaming.selected?.id).toBe("llama3.2:3b");
    expect(rejected(streaming, "mock-local-model")).toContain(
      "streaming_required",
    );
    expect(tools.selected?.id).toBe("qwen2.5:7b");
    expect(rejected(tools, "llama3.2:3b")).toContain("tools_required");
    expect(vision.selected?.id).toBe("claude-opus");
    expect(rejected(vision, "claude-haiku")).toContain("vision_required");
  });

  it("uses preferred tier ordering without overriding governance constraints", () => {
    const result = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      preferred_tier: "T2",
    });
    const cloudPreferred = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      preferred_tier: "T3",
    });

    expect(result.selected?.id).toBe("qwen2.5:7b");
    expect(cloudPreferred.selected?.runtime_class).toBe("local");
    expect(rejected(cloudPreferred, "claude-haiku")).toEqual([
      "disabled",
      "cloud_not_allowed",
    ]);
  });

  it("uses runtime_class preference ordering without treating it as a hard filter", () => {
    const mockPreferred = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      runtime_class: "mock",
    });
    const missingPreferred = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      runtime_class: "cloud",
    });

    expect(mockPreferred.selected?.id).toBe("mock-local-model");
    expect(missingPreferred.selected?.runtime_class).toBe("local");
    expect(
      missingPreferred.candidates.flatMap(
        (candidate) => candidate.rejection_reasons,
      ),
    ).not.toContain("runtime_class_mismatch");
  });

  it("honors excluded model ids and max_priority", () => {
    const excluded = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      excluded_model_ids: ["llama3.2:3b"],
    });
    const maxPriority = resolveModel(loadDefaultModelRegistry(), {
      capability: "chat",
      max_priority: 15,
    });

    expect(excluded.selected?.id).toBe("qwen2.5:7b");
    expect(rejected(excluded, "llama3.2:3b")).toContain("excluded");
    expect(maxPriority.selected?.id).toBe("llama3.2:3b");
    expect(rejected(maxPriority, "qwen2.5:7b")).toContain("priority_too_high");
  });

  it("orders deterministic candidates by preference, priority, tier, and id", () => {
    const registry = createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: z-local
    provider: ollama
    tier: T2
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
    tier: T2
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

    const first = resolveModel(registry, { capability: "chat" });
    const second = resolveModel(registry, { capability: "chat" });

    expect(first).toEqual(second);
    expect(
      first.eligible_candidates.map((candidate) => candidate.entry.id),
    ).toEqual(["first-local", "a-local", "z-local"]);
  });

  it("returns defensive-copy safe outputs", () => {
    const registry = loadDefaultModelRegistry();
    const first = resolveModel(registry, { capability: "chat" });
    if (!first.selected) throw new Error("Expected selected model.");

    first.selected.metadata.display_name = "Mutated";
    first.candidates[0].entry.capabilities.push("vision");

    const second = resolveModel(registry, { capability: "chat" });
    expect(second.selected?.metadata.display_name).toBe("Llama 3.2 3B");
    expect(second.candidates[0].entry.capabilities).not.toContain("vision");
  });

  it("fails closed on malformed input", () => {
    expect(
      resolveModel(loadDefaultModelRegistry(), {
        capability: "bogus",
      }),
    ).toEqual({
      selected: null,
      failure: {
        reason: "invalid_request",
        message: "Model resolver input was malformed.",
      },
      candidates: [],
      eligible_candidates: [],
      input: null,
    });

    expect(
      resolveModel(loadDefaultModelRegistry(), {
        capability: "chat",
        surprise: true,
      }),
    ).toMatchObject({
      selected: null,
      failure: {
        reason: "invalid_request",
      },
      candidates: [],
    });
  });

  it("does not import providers, construct providers, probe health, or perform network calls", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/resolver.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /providers\/(?:ollama|mock)|createOllama|createMock|health\(|complete\(|stream\(/,
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|globalThis\.fetch|WebSocket|EventSource|XMLHttpRequest|process\.env/,
    );
  });

  it("does not introduce router, event-store, telemetry, UI, Tauri, cloud SDK, fallback, or orchestration wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/models/resolver.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|selectProvider|routeModel/i,
    );
    expect(source).not.toMatch(/event-store|eventStore|writeEvent/i);
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|tauri|invoke\(/i);
    expect(source).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|ollama|node:http|node:https)["']/,
    );
    expect(source).not.toMatch(
      /fallback|orchestrat|install|download|\/api\/pull/i,
    );
  });
});
