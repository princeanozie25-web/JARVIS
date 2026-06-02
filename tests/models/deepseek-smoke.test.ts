import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  createDeepSeekModelProvider,
  createModelRegistryFromYaml,
  createModelRuntime,
  DEEPSEEK_LIVE_OVERRIDE_ENV,
  type DeepSeekClient,
  type ModelRuntimeOptions,
} from "../../src/models";

function deepseekRegistry(visibility: "enabled" | "disabled" = "enabled") {
  return createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: deepseek-v4-flash
    provider: deepseek
    tier: T2
    runtime_class: cloud
    capabilities: [chat, summarize, classify, tool_reasoning]
    context_window: 128000
    visibility: ${visibility}
    priority: 90
    supports_streaming: false
    supports_tools: true
    supports_vision: false
    metadata:
      display_name: DeepSeek V4 Flash
      description: DeepSeek V4 Flash smoke metadata.
      approximate_memory_mb: null
      cost_class: cloud_metered_unverified
      governance_notes: Explicit smoke only.
  - id: deepseek-v4-pro
    provider: deepseek
    tier: T3
    runtime_class: cloud
    capabilities: [chat, summarize, classify, tool_reasoning]
    context_window: 128000
    visibility: ${visibility}
    priority: 95
    supports_streaming: false
    supports_tools: true
    supports_vision: false
    metadata:
      display_name: DeepSeek V4 Pro
      description: DeepSeek V4 Pro smoke metadata.
      approximate_memory_mb: null
      cost_class: cloud_metered_unverified
      governance_notes: Explicit smoke only.
  - id: llama3.2:3b
    provider: ollama
    tier: T1
    runtime_class: local
    capabilities: [chat]
    context_window: 8192
    visibility: enabled
    priority: 10
    supports_streaming: false
    supports_tools: false
    supports_vision: false
    metadata:
      display_name: Llama
      description: Local model.
      approximate_memory_mb: 3072
      cost_class: local_free
      governance_notes: Local model.
`);
}

function fakeClient(calls: string[]): DeepSeekClient {
  return {
    complete: async (request) => {
      calls.push(request.model);
      return {
        request_id: request.request_id,
        model: request.model,
        output: `raw response for ${request.model}`,
        latency_ms: 7,
        token_usage: {
          input_tokens: 2,
          output_tokens: 1,
          total_tokens: 3,
        },
        done: true,
        redaction_status: "metadata_only",
      };
    },
  };
}

describe("DeepSeek smoke harness", () => {
  it("imports without executing the smoke harness", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const smoke = await import("../../scripts/deepseek-smoke");

    expect(smoke.runDeepSeekSmoke).toEqual(expect.any(Function));
    expect(smoke.runDeepSeekSmokeCli).toEqual(expect.any(Function));
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("skips safely when DEEPSEEK_API_KEY is missing", async () => {
    const { runDeepSeekSmoke } = await import("../../scripts/deepseek-smoke");
    const lines: string[] = [];
    let loaded = false;

    await expect(
      runDeepSeekSmoke({
        env: {},
        loadRegistry: () => {
          loaded = true;
          return deepseekRegistry();
        },
        writeLine: (line) => lines.push(line),
      }),
    ).resolves.toEqual({ status: "skipped", results: [] });

    expect(loaded).toBe(false);
    expect(lines).toEqual([
      "JARVIS DeepSeek smoke",
      "status: skipped",
      "reason: missing DEEPSEEK_API_KEY",
      expect.stringContaining(DEEPSEEK_LIVE_OVERRIDE_ENV),
    ]);
    expect(lines.join("\n")).not.toContain("sk-test");
  });

  it("fails closed when the registry entries remain disabled", async () => {
    const { runDeepSeekSmoke } = await import("../../scripts/deepseek-smoke");
    let clientCreated = false;

    await expect(
      runDeepSeekSmoke({
        env: { DEEPSEEK_API_KEY: "sk-test" },
        loadRegistry: () => deepseekRegistry("disabled"),
        createClient: () => {
          clientCreated = true;
          return fakeClient([]);
        },
        writeLine: () => {},
      }),
    ).rejects.toThrow(new RegExp(DEEPSEEK_LIVE_OVERRIDE_ENV));
    expect(clientCreated).toBe(false);
  });

  it("applies the local live override without requiring committed registry changes", async () => {
    const { runDeepSeekSmoke } = await import("../../scripts/deepseek-smoke");
    const lines: string[] = [];
    const calls: string[] = [];

    const report = await runDeepSeekSmoke({
      env: {
        DEEPSEEK_API_KEY: "sk-test",
        [DEEPSEEK_LIVE_OVERRIDE_ENV]: "true",
      },
      loadRegistry: () => deepseekRegistry("disabled"),
      createClient: () => fakeClient(calls),
      createProvider: (client) => createDeepSeekModelProvider({ client }),
      now: createClock(100, 125, 200, 250),
      writeLine: (line) => lines.push(line),
    });

    expect(report.status).toBe("ok");
    expect(calls).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(lines).toContain("model_id: deepseek-v4-flash");
    expect(lines).toContain("model_id: deepseek-v4-pro");
    expect(lines.join("\n")).not.toContain("sk-test");
    expect(lines.join("\n")).not.toContain(DEEPSEEK_LIVE_OVERRIDE_ENV);
  });

  it("executes both V4 models through createModelRuntime with explicit DeepSeek cloud policy", async () => {
    const { runDeepSeekSmoke } = await import("../../scripts/deepseek-smoke");
    const lines: string[] = [];
    const calls: string[] = [];
    const runtimeOptions: ModelRuntimeOptions[] = [];

    const report = await runDeepSeekSmoke({
      env: { DEEPSEEK_API_KEY: "sk-test" },
      loadRegistry: () => deepseekRegistry("enabled"),
      createClient: () => fakeClient(calls),
      createProvider: (client) => createDeepSeekModelProvider({ client }),
      createRuntime: (options) => {
        runtimeOptions.push(options);
        return createModelRuntime(options);
      },
      now: createClock(100, 125, 200, 250),
      writeLine: (line) => lines.push(line),
    });

    expect(report.status).toBe("ok");
    expect(calls).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(runtimeOptions).toEqual([
      expect.objectContaining({
        cloudExecutionPolicy: {
          enabled_provider_kinds: ["deepseek"],
          enabled_model_ids: ["deepseek-v4-flash"],
        },
      }),
      expect.objectContaining({
        cloudExecutionPolicy: {
          enabled_provider_kinds: ["deepseek"],
          enabled_model_ids: ["deepseek-v4-pro"],
        },
      }),
    ]);
    expect(
      report.results.map((result) => result.metadata.successful_model),
    ).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(lines).toContain("model_id: deepseek-v4-flash");
    expect(lines).toContain("model_id: deepseek-v4-pro");
    expect(lines.join("\n")).not.toContain("sk-test");
    expect(lines.join("\n")).not.toContain("Reply with exactly OK.");
    expect(lines.join("\n")).not.toContain("raw response");
    expect(lines.join("\n")).not.toContain("response_preview");
  });

  it("registers a manual npm script only", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(packageJson.scripts["smoke:deepseek"]).toBe(
      "node --env-file=.env.local --import tsx scripts/deepseek-smoke.ts",
    );
    for (const lifecycle of ["dev", "build", "test", "prepare"] as const) {
      expect(packageJson.scripts[lifecycle]).not.toContain("smoke:deepseek");
      expect(packageJson.scripts[lifecycle]).not.toContain("deepseek-smoke.ts");
    }
  });
});

function createClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
