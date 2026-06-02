import { mkdtemp, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLM_WIKI_DRAFT_CLI_VERSION,
  LLM_WIKI_DRAFT_MODEL_ID,
  ObsidianVaultPathError,
  buildObsidianVaultIndex,
  createConfiguredLlmWikiDraftRuntime,
  createLlmWikiDraftPreviewFromIndex,
  printLlmWikiDraftCliReport,
  runLlmWikiDraftCli,
} from "./index";
import { createModelRegistryFromYaml } from "../../models";
import type {
  DeepSeekClient,
  DeepSeekCompleteRequest,
  ModelRuntime,
  ModelRuntimeExecuteResult,
  ModelRuntimeStreamEvent,
} from "../../models";
import type { ObsidianNoteMetadata, ObsidianVaultIndex } from "./pull-indexer";

const NOW = new Date("2026-06-02T15:00:00.000Z");

function note(
  path: string,
  overrides: Partial<ObsidianNoteMetadata> = {},
): ObsidianNoteMetadata {
  const id = path
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `obsidian:${id}`,
    title: path.split("/").at(-1)?.replace(/\.md$/, "") ?? path,
    path,
    size_bytes: 600,
    created_at_ms: NOW.getTime(),
    modified_at_ms: NOW.getTime(),
    tags: [],
    ...overrides,
  };
}

function tinyIndex(): ObsidianVaultIndex {
  const notes = [
    note("10-wiki/concepts/tiny.md", {
      id: "obsidian:tiny",
      title: "Tiny",
    }),
  ];
  return {
    vault_path: "C:/vault",
    indexed_at_ms: NOW.getTime(),
    notes,
    folders: [],
    by_id: new Map(notes.map((entry) => [entry.id, entry])),
    by_path: new Map(notes.map((entry) => [entry.path, entry])),
    body_bytes_indexed: 0,
    telemetry: {
      metadata_only: true,
      note_count: notes.length,
      folder_count: 0,
      body_retained: false,
      vault_mutated: false,
    },
  };
}

async function createFixtureVault(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jarvis-wiki-draft-"));
  await writeFile(join(root, "10-wiki", "concepts", "alpha.md"), "").catch(
    async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(root, "10-wiki", "concepts"), { recursive: true });
      await writeFile(
        join(root, "10-wiki", "concepts", "alpha.md"),
        "---\ntags: [alpha]\n---\n# Alpha\n\nAlpha source body for bounded preview.",
      );
    },
  );
  await writeFile(
    join(root, "10-wiki", "concepts", "beta.md"),
    "---\ntags: [beta]\n---\n# Beta\n\nBeta source body for bounded preview.",
  );
  await writeFile(join(root, "30-research", "alpha-source.md"), "").catch(
    async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(root, "30-research"), { recursive: true });
      await writeFile(
        join(root, "30-research", "alpha-source.md"),
        "# Alpha Source\n\nExternal source metadata for the graph.",
      );
    },
  );
  return root;
}

function runtimeResult(markdown: string): ModelRuntimeExecuteResult {
  return {
    request_id: "llm-wiki-draft:alpha",
    ok: true,
    response: {
      request_id: "llm-wiki-draft:alpha",
      model_id: LLM_WIKI_DRAFT_MODEL_ID,
      provider_id: "deepseek",
      output: {
        kind: "text",
        content: markdown,
      },
      latency_ms: 10,
      token_usage: {
        input_tokens: 12,
        output_tokens: 8,
        total_tokens: 20,
      },
      finish_reason: "stop",
      degraded: false,
      redaction_status: "metadata_only",
    },
    metadata: {
      selected_model_id: LLM_WIKI_DRAFT_MODEL_ID,
      attempted_models: [LLM_WIKI_DRAFT_MODEL_ID],
      successful_model: LLM_WIKI_DRAFT_MODEL_ID,
      failed_models: [],
      fallback_used: false,
      governance_flags: [],
      latency_ms: 10,
      degraded: false,
      execution_summary: {
        execution_id: "llm-wiki-draft:alpha",
        request_id: "llm-wiki-draft:alpha",
        capability: "chat",
        selected_model_id: LLM_WIKI_DRAFT_MODEL_ID,
        selected_provider: "deepseek",
        attempted_models: [LLM_WIKI_DRAFT_MODEL_ID],
        successful_model: LLM_WIKI_DRAFT_MODEL_ID,
        failed_models: [],
        fallback_used: false,
        fallback_chain: [],
        latency_ms: 10,
        token_usage: {
          input_tokens: 12,
          output_tokens: 8,
          total_tokens: 20,
        },
        degraded: false,
        finish_reason: "stop",
        governance_flags: [],
        redaction_status: "metadata_only",
        runtime_class: "cloud",
        provider_kind: "deepseek",
      },
    },
  };
}

function fakeRuntime(markdown = "# Draft Preview\n\nGenerated preview.") {
  const calls: unknown[] = [];
  const runtime: ModelRuntime = {
    execute: async (request) => {
      calls.push(structuredClone(request));
      return runtimeResult(markdown);
    },
    stream: async function* (): AsyncIterable<ModelRuntimeStreamEvent> {
      throw new Error("stream must not be used");
    },
  };
  return { runtime, calls };
}

describe("Phase 21 LLM Wiki draft CLI", () => {
  it("runs detect to plan to draft and prints a preview without writes", async () => {
    const vaultPath = await createFixtureVault();
    const index = await buildObsidianVaultIndex({ vaultPath });
    const { runtime, calls } = fakeRuntime();
    const report = await createLlmWikiDraftPreviewFromIndex(index, {
      runtime,
      now: () => NOW,
    });

    expect(report).toMatchObject({
      cli_version: LLM_WIKI_DRAFT_CLI_VERSION,
      status: "ok",
      reason: "draft_preview_ready",
      candidate_type: expect.any(String),
      confidence: expect.any(Number),
      proposed_action: expect.any(String),
      target_page: expect.stringMatching(/^10-wiki\//),
      source_coverage: expect.any(Number),
      attribution_status: "ready",
      provider_status: "ready",
      provider_reason: "injected_runtime",
      model_id: LLM_WIKI_DRAFT_MODEL_ID,
      provider_used: "deepseek",
      draft_generated: true,
      write_attempted: false,
      vault_mutated: false,
      gateway_execution_called: false,
    });
    expect(report.draft_preview).toContain("# Draft Preview");
    expect(report.draft_preview).toContain("## Source Attribution");
    expect(calls).toHaveLength(1);

    const lines: string[] = [];
    printLlmWikiDraftCliReport(report, (line) => lines.push(line));
    expect(lines.join("\n")).toContain("draft_preview:");
    expect(lines.join("\n")).toContain("provider_status: ready");
    expect(lines.join("\n")).toContain("write_attempted: false");
    expect(lines.join("\n")).toContain("gateway_execution_called: false");
  });

  it("exits ok for insufficient knowledge graph without drafting", async () => {
    await expect(
      createLlmWikiDraftPreviewFromIndex(tinyIndex(), {
        now: () => NOW,
      }),
    ).resolves.toMatchObject({
      status: "ok",
      reason: "insufficient_knowledge_graph",
      candidate_type: null,
      provider_status: "unavailable",
      provider_reason: "missing_deepseek_api_key",
      draft_preview: null,
      draft_generated: false,
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("skips safely when the vault path is not configured", async () => {
    const report = await runLlmWikiDraftCli({
      buildIndex: async () => {
        throw new ObsidianVaultPathError(
          "OBSIDIAN_VAULT_PATH is required.",
          "missing_env",
        );
      },
      writeLine: () => undefined,
    });

    expect(report).toMatchObject({
      status: "skipped",
      reason: "vault_not_configured",
      provider_status: "unavailable",
      draft_generated: false,
      write_attempted: false,
      vault_mutated: false,
    });
  });

  it("fails closed as an ok preview result when the model path is unavailable", async () => {
    const vaultPath = await createFixtureVault();
    const index = await buildObsidianVaultIndex({ vaultPath });
    await expect(
      createLlmWikiDraftPreviewFromIndex(index, {
        now: () => NOW,
      }),
    ).resolves.toMatchObject({
      status: "ok",
      reason: "draft_provider_unavailable",
      provider_status: "unavailable",
      provider_reason: "missing_deepseek_api_key",
      draft_preview: null,
      draft_generated: false,
      write_attempted: false,
      vault_mutated: false,
      gateway_execution_called: false,
    });
  });

  it("builds the governed DeepSeek runtime only when key and enabled registry entry are present", async () => {
    const calls: string[] = [];
    const activation = createConfiguredLlmWikiDraftRuntime({
      env: { DEEPSEEK_API_KEY: "sk-test" },
      loadRegistry: () =>
        createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: deepseek-v4-flash
    provider: deepseek
    tier: T2
    runtime_class: cloud
    capabilities: [chat, tool_reasoning]
    context_window: 128000
    visibility: enabled
    priority: 90
    supports_streaming: true
    supports_tools: true
    supports_vision: false
    metadata:
      display_name: DeepSeek V4 Flash
      description: Test DeepSeek metadata.
      approximate_memory_mb: null
      cost_class: cloud_metered_unverified
      governance_notes: Test only.
`),
      createClient: () => fakeDeepSeekClient(calls),
      now: () => 100,
    });

    expect(activation.diagnostic).toMatchObject({
      status: "ready",
      reason: "configured",
      model_id: LLM_WIKI_DRAFT_MODEL_ID,
    });

    const result = await activation.runtime?.execute({
      request_id: "wiki-draft-runtime-test",
      capability: "chat",
      input: {
        kind: "text",
        content: "metadata-only runtime verification",
      },
      resolver_options: {
        allow_cloud: true,
        allow_disabled: false,
        runtime_class: "cloud",
      },
      timeout_ms: 1_000,
    });

    expect(result).toMatchObject({
      ok: true,
      response: {
        model_id: LLM_WIKI_DRAFT_MODEL_ID,
        provider_id: "deepseek",
      },
      metadata: {
        selected_model_id: LLM_WIKI_DRAFT_MODEL_ID,
        successful_model: LLM_WIKI_DRAFT_MODEL_ID,
      },
    });
    expect(calls).toEqual([LLM_WIKI_DRAFT_MODEL_ID]);
  });

  it("does not build a DeepSeek runtime when the registry entry remains disabled", () => {
    const activation = createConfiguredLlmWikiDraftRuntime({
      env: { DEEPSEEK_API_KEY: "sk-test" },
      loadRegistry: () =>
        createModelRegistryFromYaml(`
schema_version: 1
models:
  - id: deepseek-v4-flash
    provider: deepseek
    tier: T2
    runtime_class: cloud
    capabilities: [chat, tool_reasoning]
    context_window: 128000
    visibility: disabled
    priority: 90
    supports_streaming: true
    supports_tools: true
    supports_vision: false
    metadata:
      display_name: DeepSeek V4 Flash
      description: Test DeepSeek metadata.
      approximate_memory_mb: null
      cost_class: cloud_metered_unverified
      governance_notes: Test only.
`),
    });

    expect(activation).toMatchObject({
      runtime: null,
      diagnostic: {
        status: "unavailable",
        reason: "registry_entry_disabled",
      },
    });
  });
});

describe("Phase 21 LLM Wiki draft CLI governance tripwires", () => {
  it("contains no vault write, gateway execution, scheduler, watcher, or background job path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/llm-wiki-draft-cli.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream|watch|watchFile|setInterval|setTimeout|child_process)\b/,
    );
    expect(source).not.toMatch(
      /write-execution|executeApprovedVaultWriteProposal|renderVaultMarkdown/,
    );
  });
});

function fakeDeepSeekClient(calls: string[]): DeepSeekClient {
  return {
    complete: async (request: DeepSeekCompleteRequest) => {
      calls.push(request.model);
      return {
        request_id: request.request_id,
        model: request.model,
        output: "# Runtime Draft\n\nVerified.",
        latency_ms: 11,
        token_usage: {
          input_tokens: 4,
          output_tokens: 3,
          total_tokens: 7,
        },
        done: true,
        redaction_status: "metadata_only",
      };
    },
  };
}
