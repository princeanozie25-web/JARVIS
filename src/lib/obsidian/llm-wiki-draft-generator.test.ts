import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLM_WIKI_DRAFT_GENERATOR_VERSION,
  LLM_WIKI_DRAFT_MODEL_ID,
  generateLlmWikiDraft,
} from "./index";
import type { LlmWikiDraftGeneratorInput } from "./llm-wiki-draft-generator";
import type { LlmWikiPageDraftPlan } from "./llm-wiki-generation-planner";
import type {
  ModelRuntime,
  ModelRuntimeExecuteResult,
  ModelRuntimeStreamEvent,
} from "../../models";

const CREATED_AT = "2026-06-02T15:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

function pagePlan(
  overrides: Partial<LlmWikiPageDraftPlan> = {},
): LlmWikiPageDraftPlan {
  return {
    page_id: "llm-wiki:alpha-concept",
    page_type: "concept_page",
    target_path: "10-wiki/concepts/alpha-concept.md",
    title: "Alpha Concept",
    generation_scope: "create_new_page",
    source_ids: ["source:alpha", "source:beta"],
    source_hashes: [HASH_A, HASH_B],
    text_generation_supported: false,
    markdown_body_generated: false,
    write_attempted: false,
    ...overrides,
  };
}

function generatorInput(
  overrides: Partial<LlmWikiDraftGeneratorInput> = {},
): LlmWikiDraftGeneratorInput {
  return {
    page_plan: pagePlan(),
    supporting_sources: [
      {
        source_id: "source:alpha",
        source_type: "user_note",
        content_hash: HASH_A,
        path: "70-references/source-alpha.md",
        title: "Source Alpha",
      },
      {
        source_id: "source:beta",
        source_type: "user_note",
        content_hash: HASH_B,
        path: "70-references/source-beta.md",
        title: "Source Beta",
      },
    ],
    source_snippets: [
      {
        source_id: "source:alpha",
        snippet: "Alpha establishes the initial concept boundary.",
        bounded: true,
        raw_body: false,
      },
      {
        source_id: "source:beta",
        snippet: "Beta provides the second corroborating source.",
        bounded: true,
        raw_body: false,
      },
    ],
    generation_scope: "create_new_page",
    unsupported_synthesis: false,
    include_gateway_proposal_draft: false,
    approval_status: "pending",
    approval_id: null,
    created_at: CREATED_AT,
    ...overrides,
  };
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
      latency_ms: 12,
      token_usage: {
        input_tokens: 20,
        output_tokens: 10,
        total_tokens: 30,
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
      latency_ms: 12,
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
        latency_ms: 12,
        token_usage: {
          input_tokens: 20,
          output_tokens: 10,
          total_tokens: 30,
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

function fakeRuntime(markdown = "# Alpha Concept\n\nA sourced draft.") {
  const calls: unknown[] = [];
  const runtime: ModelRuntime = {
    execute: async (request) => {
      calls.push(structuredClone(request));
      return runtimeResult(markdown);
    },
    stream: async function* (): AsyncIterable<ModelRuntimeStreamEvent> {
      throw new Error("stream must not be used by draft generator");
    },
  };
  return { runtime, calls };
}

describe("Phase 21 LLM Wiki draft generator", () => {
  it("generates a markdown draft through deepseek-v4-flash and appends attribution", async () => {
    const { runtime, calls } = fakeRuntime();
    const result = await generateLlmWikiDraft(generatorInput(), { runtime });

    expect(result).toMatchObject({
      generator_version: LLM_WIKI_DRAFT_GENERATOR_VERSION,
      model_id: LLM_WIKI_DRAFT_MODEL_ID,
      accepted: true,
      confidence: 0.95,
      source_coverage_score: 1,
      unsupported_synthesis_warning: false,
      source_attribution: [
        {
          source_id: "source:alpha",
          source_hash: HASH_A,
          path: "70-references/source-alpha.md",
        },
        {
          source_id: "source:beta",
          source_hash: HASH_B,
          path: "70-references/source-beta.md",
        },
      ],
      provider_result: {
        attempted: true,
        ok: true,
        selected_model_id: LLM_WIKI_DRAFT_MODEL_ID,
        successful_model: LLM_WIKI_DRAFT_MODEL_ID,
        provider_id: "deepseek",
        redaction_status: "metadata_only",
      },
      governance: {
        draft_generated: true,
        write_attempted: false,
        vault_mutated: false,
        vault_write_executed: false,
        gateway_execution_called: false,
        approval_bypassed: false,
      },
      write_attempted: false,
    });
    expect(result.markdown_draft).toContain("# Alpha Concept");
    expect(result.markdown_draft).toContain("## Source Attribution");
    expect(result.markdown_draft).toContain("source:alpha");
    expect(result.markdown_draft).toContain(HASH_A);
    expect(result.librarian_envelope_draft).toMatchObject({
      source: {
        source_type: "llm_wiki",
      },
      raw_body_included: false,
      declared_classification: "candidate",
    });
    expect(result.librarian_dry_run_plan).toMatchObject({
      write_attempted: false,
      vault_mutated: false,
      promotion: {
        gateway_proposal_recommended: false,
      },
    });
    expect(result.gateway_proposal_draft).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      capability: "chat",
      resolver_options: {
        allow_cloud: true,
        allow_disabled: false,
        runtime_class: "cloud",
        preferred_tier: "T2",
        excluded_model_ids: ["deepseek-v4-pro"],
      },
      input: {
        kind: "messages",
      },
    });
    expect(JSON.stringify(result.provider_result)).not.toContain(
      "Alpha establishes",
    );
  });

  it("fails closed by default when DeepSeek cloud execution is not enabled", async () => {
    const result = await generateLlmWikiDraft(generatorInput());

    expect(result).toMatchObject({
      accepted: false,
      markdown_draft: "",
      reasons: ["provider_disabled_or_unavailable"],
      provider_result: {
        attempted: true,
        ok: false,
        failure_class: "model_missing",
        selected_model_id: null,
        successful_model: null,
      },
      governance: {
        draft_generated: false,
        write_attempted: false,
        vault_mutated: false,
      },
    });
  });

  it("rejects missing sources before provider execution", async () => {
    const { runtime, calls } = fakeRuntime();
    const result = await generateLlmWikiDraft(
      generatorInput({
        supporting_sources: [],
      }),
      { runtime },
    );

    expect(result).toMatchObject({
      accepted: false,
      reasons: expect.arrayContaining(["missing_sources"]),
      provider_result: {
        attempted: false,
      },
      write_attempted: false,
    });
    expect(calls).toEqual([]);
  });

  it("rejects missing snippets before provider execution", async () => {
    const { runtime, calls } = fakeRuntime();
    const result = await generateLlmWikiDraft(
      generatorInput({
        source_snippets: [],
      }),
      { runtime },
    );

    expect(result).toMatchObject({
      accepted: false,
      reasons: expect.arrayContaining(["missing_source_snippets"]),
      provider_result: {
        attempted: false,
      },
    });
    expect(calls).toEqual([]);
  });

  it("flags unsupported synthesis and blocks generation", async () => {
    const { runtime, calls } = fakeRuntime();
    const result = await generateLlmWikiDraft(
      generatorInput({
        page_plan: pagePlan({
          page_type: "synthesis_page",
          generation_scope: "merge_pages",
        }),
        generation_scope: "merge_pages",
        unsupported_synthesis: true,
      }),
      { runtime },
    );

    expect(result).toMatchObject({
      accepted: false,
      unsupported_synthesis_warning: true,
      reasons: expect.arrayContaining(["unsupported_synthesis"]),
      warnings: expect.arrayContaining(["unsupported_synthesis_flagged"]),
      provider_result: {
        attempted: false,
      },
    });
    expect(calls).toEqual([]);
  });

  it("can produce an optional Vault Write Gateway proposal draft without execution", async () => {
    const { runtime } = fakeRuntime();
    const result = await generateLlmWikiDraft(
      generatorInput({
        include_gateway_proposal_draft: true,
      }),
      { runtime },
    );

    expect(result).toMatchObject({
      accepted: true,
      reasons: expect.arrayContaining(["gateway_draft_created"]),
      gateway_proposal_draft: {
        proposal_id: "proposal:llm-wiki-draft.llm-wiki-alpha-concept",
        target_path: "10-wiki/concepts/alpha-concept.md",
        markdown_body: expect.stringContaining("## Source Attribution"),
        approval_required: true,
        approval_status: "pending",
      },
      governance: {
        gateway_execution_called: false,
        write_attempted: false,
        vault_mutated: false,
      },
    });
  });

  it("supports all requested LLM Wiki page types as draft-only plans", async () => {
    const pageTypes = [
      ["hub_page", "10-wiki/hubs/hub.md"],
      ["concept_page", "10-wiki/concepts/concept.md"],
      ["system_page", "10-wiki/systems/system.md"],
      ["project_page", "10-wiki/projects/project.md"],
      ["source_page", "10-wiki/sources/source.md"],
      ["decision_page", "10-wiki/decisions/decision.md"],
      ["comparison_page", "10-wiki/concepts/comparison.md"],
      ["synthesis_page", "10-wiki/concepts/synthesis.md"],
    ] as const;

    for (const [pageType, targetPath] of pageTypes) {
      const { runtime } = fakeRuntime(`# ${pageType}\n\nDraft.`);
      await expect(
        generateLlmWikiDraft(
          generatorInput({
            page_plan: pagePlan({
              page_type: pageType,
              target_path: targetPath,
              title: pageType.replace("_", " "),
            }),
          }),
          { runtime },
        ),
      ).resolves.toMatchObject({
        accepted: true,
        markdown_draft: expect.stringContaining("## Source Attribution"),
        write_attempted: false,
      });
    }
  });
});

describe("Phase 21 LLM Wiki draft generator governance tripwires", () => {
  it("contains no vault write, gateway execution, scheduler, watcher, or background job path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/obsidian/llm-wiki-draft-generator.ts"),
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
