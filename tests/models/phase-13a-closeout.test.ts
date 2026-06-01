import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as modelRuntime from "../../src/models";
import {
  createMockModelProvider,
  loadDefaultModelRegistry,
} from "../../src/models";

const MODEL_SOURCE_FILES = [
  "src/models/index.ts",
  "src/models/types.ts",
  "src/models/schema.ts",
  "src/models/registry.ts",
  "src/models/providers/contract.ts",
  "src/models/providers/mock-provider.ts",
] as const;

function modelSource(): string {
  return MODEL_SOURCE_FILES.map((path) =>
    readFileSync(join(process.cwd(), path), "utf8"),
  ).join("\n");
}

describe("Phase 13A model runtime closeout", () => {
  it("exports the Phase 13A substrate without exporting test-only conformance helpers", () => {
    expect(modelRuntime).toMatchObject({
      MODEL_PROVIDER_KINDS: [
        "ollama",
        "deepseek",
        "anthropic",
        "openai",
        "mock",
      ],
      ModelRegistrySchema: expect.any(Object),
      loadDefaultModelRegistry: expect.any(Function),
      createMockModelProvider: expect.any(Function),
      MODEL_PROVIDER_FAILURE_CLASSES: expect.arrayContaining([
        "unavailable",
        "timeout",
        "cancelled",
        "invalid_request",
        "model_missing",
        "provider_error",
      ]),
    });
    expect(Object.keys(modelRuntime)).not.toContain(
      "describeModelProviderConformance",
    );
  });

  it("does not introduce provider SDKs, Ollama dependency imports, cloud execution, or network calls", () => {
    const source = modelSource();
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );

    expect(packageJson).not.toMatch(/"ollama"\s*:/i);
    expect(source).not.toMatch(
      /from\s+["'](?:ollama|openai|@anthropic-ai\/sdk|node:http|node:https)["']/,
    );
    expect(source).not.toMatch(
      /\bnew\s+(?:OpenAI|Anthropic|Ollama)\b|anthropic\.messages|openai\.chat|ollama\.(?:chat|generate|pull)/i,
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|WebSocket|EventSource|XMLHttpRequest|https?:\/\//i,
    );
  });

  it("does not introduce filesystem writes, downloads, installs, or model probing", () => {
    const source = modelSource();

    expect(source).not.toMatch(
      /writeFile|appendFile|mkdir|rm\(|unlink|createWriteStream|rename\(/,
    );
    expect(source).not.toMatch(/\b(?:install|download|pullModel|modelPull)\b/i);
    expect(source).not.toMatch(/\b(?:probe|providerProbe|discoverModels)\b/i);
  });

  it("does not introduce router, event-store, telemetry persistence, UI, Tauri IPC, orchestration, or fallback execution", () => {
    const source = modelSource();

    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|mutateRouter|route\.ts|app\/api|event-store|eventStore/i,
    );
    expect(source).not.toMatch(
      /from\s+["'].*telemetry|writeTelemetry|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx|component/i);
    expect(source).not.toMatch(/tauri|invoke\(|emit\(|listen\(/i);
    expect(source).not.toMatch(/orchestrat|scheduler|worker|queue/i);
    expect(source).not.toMatch(
      /fallback.*(?:execute|run|provider)|autoFallback/i,
    );
  });

  it("keeps cloud models disabled while preserving local and mock registry loading", () => {
    const registry = loadDefaultModelRegistry();
    const models = registry.listModels();
    const cloudModels = models.filter(
      (model) => model.runtime_class === "cloud",
    );
    const enabledModels = registry.listEnabledModels();

    expect(cloudModels.map((model) => model.visibility)).toEqual([
      "disabled",
      "disabled",
      "disabled",
      "disabled",
    ]);
    expect(enabledModels.map((model) => model.runtime_class).sort()).toEqual([
      "local",
      "local",
      "mock",
    ]);
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
  });

  it("loads the registry deterministically without provider probing", () => {
    const first = loadDefaultModelRegistry().listModels();
    const second = loadDefaultModelRegistry().listModels();

    expect(first).toEqual(second);
    expect(first.map((model) => model.id)).toEqual([
      "mock-local-model",
      "llama3.2:3b",
      "qwen2.5:7b",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "claude-haiku",
      "claude-opus",
    ]);
  });

  it("keeps provider surfaces metadata-only", async () => {
    const provider = createMockModelProvider();
    const health = await provider.health();
    const response = await provider.complete({
      request_id: "closeout-request-1",
      model_id: "mock-local-model",
      capability: "chat",
      input: {
        kind: "messages",
        messages: [{ role: "user", content: "Closeout metadata check" }],
      },
      options: {},
      timeout_ms: 5_000,
      provenance: {
        request_origin: "model_runtime",
        source_phase: "13A.2",
        metadata_only: true,
        correlation_id: "closeout-correlation-1",
        requested_at_ms: 0,
        caller: "test_harness",
      },
    });

    expect(provider.metadata).toMatchObject({
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    });
    expect(health).toMatchObject({
      provider_id: "mock",
      runtime_class: "mock",
      degraded: false,
    });
    expect(response).toMatchObject({
      provider_id: "mock",
      redaction_status: "metadata_only",
      token_usage: {
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        total_tokens: expect.any(Number),
      },
    });
    expect(JSON.stringify(response.token_usage)).not.toContain(
      "Closeout metadata check",
    );
  });

  it("binds the mock provider to the reusable conformance suite", () => {
    const binding = readFileSync(
      join(
        process.cwd(),
        "tests/models/providers/conformance/mock-provider.conformance.test.ts",
      ),
      "utf8",
    );

    expect(binding).toContain("describeModelProviderConformance");
    expect(binding).toContain("createMockModelProvider");
    expect(binding).toContain("MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES");
  });
});
