import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  RESEARCH_AGENT_PREVIEW_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewResearchAgent,
  type ResearchSourceMetadata,
  type ResearchTopicMetadata,
} from ".";

const HASH = `sha256:${"f".repeat(64)}`;

describe("Research Agent preview", () => {
  it("creates a metadata-only research digest preview", () => {
    const preview = previewResearchAgent(baseInput());

    expect(preview.kind).toBe("research_agent.digest_preview");
    expect(preview.agent_id).toBe("research_agent");
    expect(preview.research_digest_preview.summary).toContain(
      "Metadata-only research preview",
    );
    expect(preview.research_digest_preview.topic_summaries).toHaveLength(3);
    expect(preview.research_digest_preview.source_summary.source_count).toBe(4);
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.preview_only).toBe(true);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    expect(preview.inbox_write_attempted).toBe(false);
  });

  it("models topic metadata and novelty signals", () => {
    const preview = previewResearchAgent(baseInput());
    const signals = preview.research_digest_preview.novelty_signals;

    expect(
      signals.some((signal) => signal.signal === "fresh_high_interest"),
    ).toBe(true);
    expect(
      signals.some((signal) => signal.signal === "low_source_coverage"),
    ).toBe(true);
    expect(signals.every((signal) => signal.metadata_only)).toBe(true);
  });

  it("models source metadata without raw article bodies", () => {
    const preview = previewResearchAgent(baseInput());
    const sourceSummary = preview.research_digest_preview.source_summary;

    expect(sourceSummary.high_trust_count).toBe(2);
    expect(sourceSummary.source_types).toContain("paper");
    expect(sourceSummary.source_types).toContain("documentation");
    expect(sourceSummary.raw_article_bodies_included).toBe(false);
    expect(sourceSummary.metadata_only).toBe(true);
  });

  it("creates follow-up recommendations with librarian approval metadata", () => {
    const preview = previewResearchAgent(baseInput());
    const recommendations =
      preview.research_digest_preview.follow_up_recommendations;

    expect(recommendations.length).toBeGreaterThan(0);
    expect(
      recommendations.some(
        (item) =>
          item.suggested_action === "file_to_librarian" &&
          item.approval_required,
      ),
    ).toBe(true);
    for (const recommendation of recommendations) {
      expect(recommendation.raw_body_included).toBe(false);
      expect(recommendation.metadata_only).toBe(true);
    }
  });

  it("integrates through dry-run and output-factory runtime metadata", () => {
    const preview = previewResearchAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("research_agent");
    expect(preview.runtime_output_preview.output_type).toBe("report");
    expect(preview.runtime_output_preview.preview_only).toBe(true);
    expect(
      preview.runtime_output_preview.verification_metadata
        .verification_required,
    ).toBe(true);
    expect(preview.runtime_output_preview.suggested_inbox_target).toBe(
      "suggestion_inbox",
    );
  });

  it("keeps Librarian metadata explicit and does not bypass it", () => {
    const preview = previewResearchAgent(baseInput());

    expect(preview.librarian_metadata?.librarian_required_for_persistence).toBe(
      true,
    );
    expect(preview.librarian_metadata?.librarian_bypass_attempted).toBe(false);
    expect(preview.research_digest_preview.caveats).toContain(
      "librarian_required_for_persistence",
    );
  });

  it("rejects non-Research registry entries and dry-runs", () => {
    expect(() =>
      previewResearchAgent({
        ...baseInput(),
        registry_entry: getAgentRegistryEntry("build_monitor"),
      }),
    ).toThrow("research_agent registry entry");

    expect(() =>
      previewResearchAgent({
        ...baseInput(),
        dry_run: executeAgentDryRun({
          executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
          plan: planAgentRun({
            planner_version: AGENT_PLANNER_VERSION,
            agent_id: "build_monitor",
            registry_entry: getAgentRegistryEntry("build_monitor"),
            run_context: "manual",
            available_metadata_sources: availableSources(
              getAgentRegistryEntry("build_monitor"),
            ),
            requested_source_ids: [],
            requested_output_type: "report",
            trigger_metadata: null,
            metadata_only: true,
            execution_requested: false,
            scheduling_requested: false,
            write_requested: false,
          }),
          registry_entry: getAgentRegistryEntry("build_monitor"),
          fixture_metadata: null,
          metadata_only: true,
          execute_real_agent_requested: false,
          source_reads_requested: false,
          suggestion_inbox_write_requested: false,
        }),
      }),
    ).toThrow("research_agent dry-run");
  });

  it("rejects web, API, model, scheduling, write, inbox, raw body, and librarian bypass requests", () => {
    for (const patch of [
      { web_search_requested: true },
      { external_api_requested: true },
      { model_call_requested: true },
      { scheduling_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
      { raw_article_bodies_included: true },
      { librarian_bypass_requested: true },
    ]) {
      expect(() =>
        previewResearchAgent({
          ...baseInput(),
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("reports governance as preview-only with no side effects", () => {
    const preview = previewResearchAgent(baseInput());

    expect(preview.governance.preview_only).toBe(true);
    expect(preview.governance.execution_attempted).toBe(false);
    expect(preview.governance.write_attempted).toBe(false);
    expect(preview.governance.inbox_write_attempted).toBe(false);
    expect(preview.governance.web_search_attempted).toBe(false);
    expect(preview.governance.external_api_call_attempted).toBe(false);
    expect(preview.governance.model_call_attempted).toBe(false);
    expect(preview.governance.network_call_attempted).toBe(false);
    expect(preview.governance.scheduling_attempted).toBe(false);
    expect(preview.governance.raw_article_bodies_included).toBe(false);
    expect(preview.governance.librarian_bypass_attempted).toBe(false);
  });

  it("has no web, API, model, network, scheduling, write, or librarian bypass imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/research-agent-preview.ts"),
      "utf8",
    );
    const index = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/index.ts"),
      "utf8",
    );

    for (const text of [source, index]) {
      expect(text).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
      expect(text).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
      expect(text).not.toMatch(
        /fetch\s*\(|googleapis|octokit|readGmail|readCalendar|readDrive/i,
      );
      expect(text).not.toMatch(
        /DeepSeek|Ollama|OpenAI|Anthropic|modelRuntime/i,
      );
      expect(text).not.toMatch(/webSearch|searchWeb|externalApi|httpClient/i);
      expect(text).not.toMatch(/readFile|readVault|obsidian:index/i);
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(
        /planLibrarianIngestionDryRun|executeLibrarian/i,
      );
      expect(text).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});

function baseInput() {
  return {
    preview_version: RESEARCH_AGENT_PREVIEW_VERSION,
    dry_run: researchDryRun(),
    registry_entry: getAgentRegistryEntry("research_agent"),
    topic_metadata: topicFixture(),
    source_metadata: sourceFixture(),
    librarian_metadata: {
      envelope_count: 1,
      draft_envelope_ids: ["librarian:research.preview"],
      librarian_required_for_persistence: true,
      librarian_bypass_attempted: false,
      metadata_only: true,
    },
    verification_metadata: {
      verification_ref_id: "verification:research.preview",
      verification_status: "completed_metadata_only",
      risk_flag_count: 1,
      raw_verifier_response_included: false,
      metadata_only: true,
    },
    metadata_only: true,
    raw_article_bodies_included: false,
    web_search_requested: false,
    external_api_requested: false,
    model_call_requested: false,
    scheduling_requested: false,
    inbox_write_requested: false,
    write_requested: false,
    librarian_bypass_requested: false,
  };
}

function researchDryRun() {
  const entry = getAgentRegistryEntry("research_agent");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "research_agent",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "report",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    }),
    registry_entry: entry,
    fixture_metadata: {
      fixture_id: "fixture:research.preview",
      fixture_hash: HASH,
      metadata_record_count: 7,
      metadata_only: true,
      raw_body_included: false,
      model_prompt_included: false,
    },
    metadata_only: true,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    suggestion_inbox_write_requested: false,
  });
}

function topicFixture(): ResearchTopicMetadata[] {
  return [
    {
      topic_id: "topic:agent-runtime",
      title: "Agent Runtime Contracts",
      category: "agent_architecture",
      interest_level: "high",
      source_count: 3,
      freshness: "fresh",
      related_wiki_refs: ["wiki:agent-runtime"],
      metadata_only: true,
      raw_body_included: false,
    },
    {
      topic_id: "topic:llm-wiki",
      title: "LLM Wiki Maintenance",
      category: "ai_systems",
      interest_level: "high",
      source_count: 1,
      freshness: "recent",
      related_wiki_refs: ["wiki:llm-wiki"],
      metadata_only: true,
      raw_body_included: false,
    },
    {
      topic_id: "topic:ui-direction",
      title: "Command Center Design Direction",
      category: "product_design",
      interest_level: "medium",
      source_count: 2,
      freshness: "stale",
      related_wiki_refs: [],
      metadata_only: true,
      raw_body_included: false,
    },
  ];
}

function sourceFixture(): ResearchSourceMetadata[] {
  return [
    source("source:paper.agent", "Agent systems paper", "paper", "high"),
    source(
      "source:docs.runtime",
      "Runtime contract documentation",
      "documentation",
      "high",
    ),
    source(
      "source:repo.gitnexus",
      "GitNexus repository metadata",
      "repository",
      "medium",
    ),
    source("source:note.design", "Design audit note", "note", "medium"),
  ];
}

function source(
  sourceId: string,
  title: string,
  sourceType: ResearchSourceMetadata["source_type"],
  trustLevel: ResearchSourceMetadata["trust_level"],
): ResearchSourceMetadata {
  return {
    source_id: sourceId,
    title,
    source_type: sourceType,
    url_hash: HASH,
    published_at: "2026-06-02T12:00:00.000Z",
    trust_level: trustLevel,
    summary_metadata_only: true,
    raw_article_body_included: false,
    metadata_only: true,
  };
}

function availableSources(entry: ReturnType<typeof getAgentRegistryEntry>) {
  return entry.declared_sources.map((source) => ({
    source_kind: source.source_kind,
    source_id: source.source_id,
    available: true,
    metadata_only: true,
    raw_body_included: false,
  }));
}
