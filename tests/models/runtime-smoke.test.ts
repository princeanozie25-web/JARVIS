import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeOllamaClient,
  createModelRuntime,
  createModelRegistryFromYaml,
  type ModelRuntimeOptions,
} from "../../src/models";

function smokeRegistry() {
  return createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: llama3.2:3b
    provider: ollama
    tier: T1
    runtime_class: local
    capabilities: [chat, summarize, classify]
    context_window: 8192
    visibility: enabled
    priority: 10
    supports_streaming: true
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Llama 3.2 3B
      description: Local smoke-test model metadata.
      approximate_memory_mb: 3072
      cost_class: local_free
      governance_notes: Metadata only.
  - id: qwen2.5:7b
    provider: ollama
    tier: T2
    runtime_class: local
    capabilities: [chat, summarize, classify, tool_reasoning]
    context_window: 32768
    visibility: enabled
    priority: 20
    supports_streaming: true
    supports_tools: true
    supports_vision: false
    metadata:
      display_name: Qwen 2.5 7B
      description: Local fallback model metadata.
      approximate_memory_mb: 8192
      cost_class: local_free
      governance_notes: Metadata only.
`);
}

describe("Phase 13C.4 model runtime smoke harness", () => {
  it("imports without executing the smoke harness", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const smoke = await import("../../scripts/model-runtime-smoke");

    expect(smoke.runModelRuntimeSmoke).toEqual(expect.any(Function));
    expect(smoke.runModelRuntimeStreamingSmoke).toEqual(expect.any(Function));
    expect(smoke.runModelRuntimeSmokeCli).toEqual(expect.any(Function));
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("executes the mocked smoke path through createModelRuntime", async () => {
    const { runModelRuntimeSmoke } =
      await import("../../scripts/model-runtime-smoke");
    const lines: string[] = [];

    const report = await runModelRuntimeSmoke({
      loadRegistry: smokeRegistry,
      createClient: () =>
        createFakeOllamaClient({
          latencyMs: 7,
        }),
      now: createClock(100, 125),
      writeLine: (line) => lines.push(line),
    });

    expect(report.result).toMatchObject({
      ok: true,
      response: {
        model_id: "llama3.2:3b",
        provider_id: "ollama",
      },
      metadata: {
        selected_model_id: "llama3.2:3b",
        attempted_models: ["llama3.2:3b"],
        successful_model: "llama3.2:3b",
        fallback_used: false,
        latency_ms: 25,
        execution_summary: {
          execution_id: "model-runtime-smoke",
          request_id: "model-runtime-smoke",
          selected_model_id: "llama3.2:3b",
          selected_provider: "ollama",
          successful_model: "llama3.2:3b",
          token_usage: {
            input_tokens: expect.any(Number),
            output_tokens: expect.any(Number),
            total_tokens: expect.any(Number),
          },
          redaction_status: "metadata_only",
          runtime_class: "local",
          provider_kind: "ollama",
        },
      },
    });
    expect(lines).toEqual([
      "JARVIS model runtime smoke",
      "status: ok",
      "selected_model_id: llama3.2:3b",
      "successful_model: llama3.2:3b",
      "attempted_models: llama3.2:3b",
      "fallback_used: false",
      "latency_ms: 25",
      "degraded: false",
      expect.stringMatching(/^token_usage: input=\d+ output=\d+ total=\d+$/),
      expect.stringContaining("response_preview: ollama:llama3.2:3b:"),
    ]);
    expect(lines.join("\n")).not.toContain(
      "Say exactly: JARVIS governed local runtime online.",
    );
  });

  it("executes the mocked streaming smoke path through createModelRuntime.stream", async () => {
    const { runModelRuntimeStreamingSmoke } =
      await import("../../scripts/model-runtime-smoke");
    const lines: string[] = [];
    let streamCalls = 0;

    const report = await runModelRuntimeStreamingSmoke({
      loadRegistry: smokeRegistry,
      createClient: () =>
        createFakeOllamaClient({
          latencyMs: 7,
        }),
      createRuntime: (options: ModelRuntimeOptions) => {
        const runtime = createModelRuntime(options);
        return {
          execute: runtime.execute,
          stream: (request) => {
            streamCalls += 1;
            return runtime.stream(request);
          },
        };
      },
      now: createClock(100, 125),
      writeLine: (line) => lines.push(line),
    });

    expect(streamCalls).toBe(1);
    expect(report.terminal_event).toMatchObject({
      type: "done",
      request_id: "model-runtime-stream-smoke",
      selected_model_id: "llama3.2:3b",
      provider_id: "ollama",
      attempted_models: ["llama3.2:3b"],
      fallback_used: false,
      redaction_status: "metadata_only",
      token_usage: {
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        total_tokens: expect.any(Number),
      },
    });
    expect(report.token_event_count).toBeGreaterThan(0);
    expect(report.stream_preview.length).toBeLessThanOrEqual(120);
    expect(lines).toEqual([
      "JARVIS model runtime streaming smoke",
      "status: streaming",
      "selected_model_id: llama3.2:3b",
      "provider_id: ollama",
      "attempted_models: llama3.2:3b",
      "fallback_used: false",
      "status: ok",
      expect.stringMatching(/^token_events: \d+$/),
      expect.stringMatching(/^token_usage: input=\d+ output=\d+ total=\d+$/),
      "latency_ms: 25",
      "degraded: false",
      expect.stringMatching(/^stream_preview: .{1,120}$/),
    ]);
    expect(lines.join("\n")).not.toContain(
      "Say exactly: JARVIS governed local runtime online.",
    );
  });

  it("fails closed with a helpful message when local Ollama is unavailable", async () => {
    const { runModelRuntimeSmoke } =
      await import("../../scripts/model-runtime-smoke");

    await expect(
      runModelRuntimeSmoke({
        loadRegistry: smokeRegistry,
        createClient: () =>
          createFakeOllamaClient({
            failureMode: "unavailable",
          }),
        writeLine: () => {
          throw new Error("No success output expected.");
        },
      }),
    ).rejects.toThrow(
      /Ensure Ollama is running on http:\/\/127\.0\.0\.1:11434 and llama3\.2:3b is already installed/,
    );
    await expect(
      runModelRuntimeSmoke({
        loadRegistry: smokeRegistry,
        createClient: () =>
          createFakeOllamaClient({
            failureMode: "unavailable",
          }),
      }),
    ).rejects.toThrow(
      /No model pull, install, telemetry persistence, or event store persistence was attempted/,
    );
  });

  it("fails closed with a helpful streaming message when local Ollama is unavailable", async () => {
    const { runModelRuntimeStreamingSmoke } =
      await import("../../scripts/model-runtime-smoke");

    await expect(
      runModelRuntimeStreamingSmoke({
        loadRegistry: smokeRegistry,
        createClient: () =>
          createFakeOllamaClient({
            failureMode: "unavailable",
          }),
        writeLine: () => {},
      }),
    ).rejects.toThrow(
      /Local Ollama model runtime streaming smoke failed with unavailable/,
    );
    await expect(
      runModelRuntimeStreamingSmoke({
        loadRegistry: smokeRegistry,
        createClient: () =>
          createFakeOllamaClient({
            failureMode: "model_missing",
          }),
      }),
    ).rejects.toThrow(
      /No model pull, install, telemetry persistence, or event store persistence was attempted/,
    );
  });

  it("registers an opt-in manual npm script only", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(packageJson.scripts["smoke:model-runtime"]).toBe(
      "tsx scripts/model-runtime-smoke.ts",
    );
    expect(packageJson.scripts["smoke:model-runtime:stream"]).toBe(
      "tsx scripts/model-runtime-smoke.ts --stream",
    );
    expect(packageJson.scripts.prepare).toBe("husky");
    expect(packageJson.scripts.prepare).not.toContain("smoke:model-runtime");
    expect(packageJson.scripts.dev).not.toContain("smoke:model-runtime");
    expect(packageJson.scripts.build).not.toContain("smoke:model-runtime");
    expect(packageJson.scripts.test).not.toContain("smoke:model-runtime");
  });

  it("uses localhost-only Ollama client defaults and does not auto-configure from env", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/model-runtime-smoke.ts"),
      "utf8",
    );

    expect(source).toContain("createOllamaHttpClient");
    expect(source).not.toMatch(/base_url|allow_non_localhost|process\.env/i);
    expect(source).toContain("http://127.0.0.1:11434");
  });

  it("does not wire router, UI, Tauri, telemetry, event store, background loops, cloud, model pull, or installs", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/model-runtime-smoke.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["'].*router|router\.|selectProvider|routeModel/i,
    );
    expect(source).not.toMatch(/document\.|window\.|React|tsx component/i);
    expect(source).not.toMatch(/tauri|invoke\(|listen\(/i);
    expect(source).not.toMatch(
      /writeTelemetry|persistTelemetry|telemetryStore|event-store|eventStore|writeEvent|appendEvent/i,
    );
    expect(source).not.toMatch(
      /setInterval|setTimeout|while\s*\(\s*true\s*\)|worker|queue|pollHealth|healthPoll/i,
    );
    expect(source).toContain("runtime.stream");
    expect(source).not.toMatch(/allow_cloud|runtime_class:\s*["']cloud["']/i);
    expect(source).not.toMatch(
      /\/api\/pull|ollama\.pull|pullModel|modelPull|auto-?install|npm\s+install/i,
    );
  });
});

function createClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
