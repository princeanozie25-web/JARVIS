import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  LIFE_COACH_AGENT_PREVIEW_VERSION,
  LIFE_COACH_PROGRESS_CATEGORIES,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewLifeCoachAgent,
  type LifeCoachProgressMetadata,
} from ".";

const HASH = `sha256:${"d".repeat(64)}`;

describe("Life Coach agent preview", () => {
  it("creates a weekly progress digest preview from safe metadata", () => {
    const preview = previewLifeCoachAgent({
      preview_version: LIFE_COACH_AGENT_PREVIEW_VERSION,
      dry_run: lifeCoachDryRun(),
      registry_entry: getAgentRegistryEntry("life_coach"),
      progress_metadata: progressFixture(),
      librarian_metadata: {
        librarian_update_count: 2,
        envelope_ids: ["librarian:life.coach.1"],
        durable_write_attempted: false,
        metadata_only: true,
      },
      morning_brief_metadata: {
        brief_ref_id: "morning:brief.life.coach",
        high_priority_item_count: 1,
        caveat_count: 1,
        delivery_attempted: false,
        metadata_only: true,
      },
      metadata_only: true,
      raw_note_bodies_included: false,
      model_call_requested: false,
      scheduling_requested: false,
      inbox_write_requested: false,
      write_requested: false,
      source_reads_requested: false,
    });

    expect(preview.kind).toBe("life_coach.weekly_progress_preview");
    expect(preview.agent_id).toBe("life_coach");
    expect(preview.weekly_progress_digest_preview.focus_items).toHaveLength(3);
    expect(preview.weekly_progress_digest_preview.summary).toContain(
      "Metadata-only weekly digest preview",
    );
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.preview_only).toBe(true);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    expect(preview.inbox_write_attempted).toBe(false);
  });

  it("supports all required progress categories", () => {
    const preview = previewLifeCoachAgent(baseInput());
    const categories =
      preview.weekly_progress_digest_preview.progress_categories.map(
        (category) => category.category,
      );

    expect(categories).toEqual([...LIFE_COACH_PROGRESS_CATEGORIES]);
  });

  it("returns deterministic focus items with actionability metadata", () => {
    const preview = previewLifeCoachAgent(baseInput());
    const [first, second, third] =
      preview.weekly_progress_digest_preview.focus_items;

    expect(first.category).toBe("jarvis_build");
    expect(first.priority).toBe("high");
    expect(first.actionability).toBe("proposal_required");
    expect(second.category).toBe("career");
    expect(third.category).toBe("admin_life");
    for (const item of preview.weekly_progress_digest_preview.focus_items) {
      expect(item.raw_body_included).toBe(false);
      expect(item.metadata_only).toBe(true);
      expect(["read_only", "suggestion", "proposal_required"]).toContain(
        item.actionability,
      );
    }
  });

  it("integrates through dry-run and output-factory runtime metadata", () => {
    const preview = previewLifeCoachAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("life_coach");
    expect(preview.runtime_output_preview.output_type).toBe("recommendation");
    expect(preview.runtime_output_preview.preview_only).toBe(true);
    expect(
      preview.runtime_output_preview.approval_metadata.requires_approval,
    ).toBe(true);
    expect(
      preview.runtime_output_preview.verification_metadata
        .verification_required,
    ).toBe(true);
  });

  it("keeps source refs declared and metadata-only", () => {
    const preview = previewLifeCoachAgent(baseInput());

    expect(
      preview.weekly_progress_digest_preview.source_refs.length,
    ).toBeGreaterThan(0);
    for (const source of preview.weekly_progress_digest_preview.source_refs) {
      expect(source.declared_in_contract).toBe(true);
      expect(source.raw_body_included).toBe(false);
      expect(source.metadata_only).toBe(true);
    }
  });

  it("rejects non-Life-Coach registry entries and dry-runs", () => {
    expect(() =>
      previewLifeCoachAgent({
        ...baseInput(),
        registry_entry: getAgentRegistryEntry("build_monitor"),
      }),
    ).toThrow("life_coach registry entry");

    expect(() =>
      previewLifeCoachAgent({
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
    ).toThrow("life_coach dry-run");
  });

  it("rejects scheduling, model, write, inbox, source-read, and raw body requests", () => {
    for (const patch of [
      { model_call_requested: true },
      { scheduling_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
      { source_reads_requested: true },
      { raw_note_bodies_included: true },
    ]) {
      expect(() =>
        previewLifeCoachAgent({
          ...baseInput(),
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("reports governance as preview-only with no side effects", () => {
    const preview = previewLifeCoachAgent(baseInput());

    expect(preview.governance.preview_only).toBe(true);
    expect(preview.governance.execution_attempted).toBe(false);
    expect(preview.governance.write_attempted).toBe(false);
    expect(preview.governance.inbox_write_attempted).toBe(false);
    expect(preview.governance.source_reads_attempted).toBe(false);
    expect(preview.governance.raw_note_bodies_included).toBe(false);
    expect(preview.governance.model_call_attempted).toBe(false);
    expect(preview.governance.network_call_attempted).toBe(false);
    expect(preview.governance.scheduling_attempted).toBe(false);
    expect(preview.governance.approval_bypass_attempted).toBe(false);
    expect(preview.governance.project_registry_mutation_attempted).toBe(false);
  });

  it("has no source-read, model, network, scheduling, write, or inbox creation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/life-coach-preview.ts"),
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
      expect(text).not.toMatch(/readFile|readVault|obsidian:index/i);
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});

function baseInput() {
  return {
    preview_version: LIFE_COACH_AGENT_PREVIEW_VERSION,
    dry_run: lifeCoachDryRun(),
    registry_entry: getAgentRegistryEntry("life_coach"),
    progress_metadata: progressFixture(),
    librarian_metadata: null,
    morning_brief_metadata: null,
    metadata_only: true,
    raw_note_bodies_included: false,
    model_call_requested: false,
    scheduling_requested: false,
    inbox_write_requested: false,
    write_requested: false,
    source_reads_requested: false,
  };
}

function lifeCoachDryRun() {
  const entry = getAgentRegistryEntry("life_coach");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "life_coach",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "recommendation",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    }),
    registry_entry: entry,
    fixture_metadata: {
      fixture_id: "fixture:life.coach.preview",
      fixture_hash: HASH,
      metadata_record_count: 5,
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

function progressFixture(): LifeCoachProgressMetadata[] {
  const sourceRefs = getAgentRegistryEntry("life_coach").declared_sources.map(
    (source) =>
      ({
        source_kind: source.source_kind,
        source_id: source.source_id,
        content_hash: null,
        declared_in_contract: true,
        raw_body_included: false,
        metadata_only: true,
      }) as const,
  );
  return [
    progress(
      "learning:langgraph",
      "learning",
      "Review LangGraph notes",
      2,
      "medium",
      "improving",
      [sourceRefs[0]],
    ),
    progress(
      "career:cv",
      "career",
      "Refresh CV impact bullets",
      4,
      "high",
      "stalled",
      [sourceRefs[1]],
    ),
    progress(
      "fitness:baseline",
      "fitness",
      "Keep fitness baseline visible",
      1,
      "low",
      "steady",
      [sourceRefs[0]],
    ),
    progress(
      "jarvis:phase21",
      "jarvis_build",
      "Stabilize Phase 21 agent foundation",
      7,
      "high",
      "needs_attention",
      [sourceRefs[2]],
    ),
    progress(
      "admin:life",
      "admin_life",
      "Close loose admin loops",
      3,
      "medium",
      "needs_attention",
      [sourceRefs[0]],
    ),
  ];
}

function progress(
  progressId: string,
  category: LifeCoachProgressMetadata["category"],
  title: string,
  signalCount: number,
  priority: LifeCoachProgressMetadata["priority"],
  trend: LifeCoachProgressMetadata["trend"],
  sourceRefs: LifeCoachProgressMetadata["source_refs"],
): LifeCoachProgressMetadata {
  return {
    progress_id: progressId,
    category,
    title,
    signal_count: signalCount,
    priority,
    trend,
    source_refs: sourceRefs,
    raw_note_body_included: false,
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
