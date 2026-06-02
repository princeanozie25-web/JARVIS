import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  BUILD_MONITOR_AGENT_PREVIEW_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewBuildMonitorAgent,
  type BuildMonitorMetadata,
} from ".";

const HASH = `sha256:${"e".repeat(64)}`;

describe("Build Monitor agent preview", () => {
  it("creates a metadata-only build progress digest preview", () => {
    const preview = previewBuildMonitorAgent(baseInput());

    expect(preview.kind).toBe("build_monitor.progress_digest_preview");
    expect(preview.agent_id).toBe("build_monitor");
    expect(preview.build_progress_digest_preview.summary).toContain(
      "metadata preview",
    );
    expect(
      preview.build_progress_digest_preview.phase_slice_summary,
    ).toMatchObject({
      changed_files_count: 6,
      current_phase_or_slice: "Phase 21H.7 Build Monitor preview",
    });
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.preview_only).toBe(true);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    expect(preview.inbox_write_attempted).toBe(false);
  });

  it("models test status from fixture metadata", () => {
    const preview = previewBuildMonitorAgent(baseInput());
    const testStatus =
      preview.build_progress_digest_preview.test_status_summary;

    expect(testStatus.tests_passed).toBe(4643);
    expect(testStatus.tests_failed).toBe(0);
    expect(testStatus.test_files_count).toBe(526);
    expect(testStatus.status).toBe("passing");
    expect(testStatus.full_log_included).toBe(false);
  });

  it("builds portfolio, linkedin, and readme highlights from notable changes", () => {
    const preview = previewBuildMonitorAgent(baseInput());
    const highlights = preview.build_progress_digest_preview.highlights;

    expect(highlights.length).toBeGreaterThanOrEqual(3);
    expect(highlights.some((item) => item.suggested_use === "portfolio")).toBe(
      true,
    );
    expect(highlights.some((item) => item.suggested_use === "linkedin")).toBe(
      true,
    );
    expect(highlights.some((item) => item.suggested_use === "readme")).toBe(
      true,
    );
    for (const highlight of highlights) {
      expect(highlight.raw_diff_included).toBe(false);
      expect(highlight.full_log_included).toBe(false);
      expect(highlight.metadata_only).toBe(true);
    }
  });

  it("summarizes risks and caveats without raw logs or diffs", () => {
    const preview = previewBuildMonitorAgent(baseInput());
    const riskSummary =
      preview.build_progress_digest_preview.risk_caveat_summary;

    expect(riskSummary.risk_count).toBe(2);
    expect(riskSummary.highest_severity).toBe("high");
    expect(riskSummary.caveats).toContain("no_live_github_calls");
    expect(riskSummary.caveats).toContain("no_raw_diffs");
    expect(riskSummary.caveats).toContain("no_full_logs");
  });

  it("integrates through dry-run and output-factory runtime metadata", () => {
    const preview = previewBuildMonitorAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("build_monitor");
    expect(preview.runtime_output_preview.output_type).toBe("report");
    expect(preview.runtime_output_preview.preview_only).toBe(true);
    expect(preview.runtime_output_preview.suggested_inbox_target).toBe(
      "suggestion_inbox",
    );
    expect(
      preview.runtime_output_preview.approval_metadata.requires_approval,
    ).toBe(false);
  });

  it("keeps source refs declared and metadata-only", () => {
    const preview = previewBuildMonitorAgent(baseInput());

    expect(
      preview.build_progress_digest_preview.source_refs.length,
    ).toBeGreaterThan(0);
    for (const source of preview.build_progress_digest_preview.source_refs) {
      expect(source.declared_in_contract).toBe(true);
      expect(source.raw_body_included).toBe(false);
      expect(source.metadata_only).toBe(true);
    }
  });

  it("rejects non-Build-Monitor registry entries and dry-runs", () => {
    expect(() =>
      previewBuildMonitorAgent({
        ...baseInput(),
        registry_entry: getAgentRegistryEntry("life_coach"),
      }),
    ).toThrow("build_monitor registry entry");

    expect(() =>
      previewBuildMonitorAgent({
        ...baseInput(),
        dry_run: executeAgentDryRun({
          executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
          plan: planAgentRun({
            planner_version: AGENT_PLANNER_VERSION,
            agent_id: "life_coach",
            registry_entry: getAgentRegistryEntry("life_coach"),
            run_context: "manual",
            available_metadata_sources: availableSources(
              getAgentRegistryEntry("life_coach"),
            ),
            requested_source_ids: [],
            requested_output_type: "recommendation",
            trigger_metadata: null,
            metadata_only: true,
            execution_requested: false,
            scheduling_requested: false,
            write_requested: false,
          }),
          registry_entry: getAgentRegistryEntry("life_coach"),
          fixture_metadata: null,
          metadata_only: true,
          execute_real_agent_requested: false,
          source_reads_requested: false,
          suggestion_inbox_write_requested: false,
        }),
      }),
    ).toThrow("build_monitor dry-run");
  });

  it("rejects GitHub, model, scheduling, write, inbox, and git mutation requests", () => {
    for (const patch of [
      { github_call_requested: true },
      { model_call_requested: true },
      { scheduling_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
      { git_mutation_requested: true },
      { raw_diffs_included: true },
      { full_logs_included: true },
    ]) {
      expect(() =>
        previewBuildMonitorAgent({
          ...baseInput(),
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("reports governance as preview-only with no side effects", () => {
    const preview = previewBuildMonitorAgent(baseInput());

    expect(preview.governance.preview_only).toBe(true);
    expect(preview.governance.execution_attempted).toBe(false);
    expect(preview.governance.write_attempted).toBe(false);
    expect(preview.governance.inbox_write_attempted).toBe(false);
    expect(preview.governance.github_call_attempted).toBe(false);
    expect(preview.governance.model_call_attempted).toBe(false);
    expect(preview.governance.network_call_attempted).toBe(false);
    expect(preview.governance.scheduling_attempted).toBe(false);
    expect(preview.governance.git_commit_attempted).toBe(false);
    expect(preview.governance.git_push_attempted).toBe(false);
    expect(preview.governance.project_file_mutation_attempted).toBe(false);
    expect(preview.governance.raw_diffs_included).toBe(false);
    expect(preview.governance.full_logs_included).toBe(false);
  });

  it("has no GitHub, model, network, scheduling, write, or git mutation calls", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/build-monitor-preview.ts"),
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
      expect(text).not.toMatch(/\bgit\s+commit\b|\bgit\s+push\b/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});

function baseInput() {
  return {
    preview_version: BUILD_MONITOR_AGENT_PREVIEW_VERSION,
    dry_run: buildMonitorDryRun(),
    registry_entry: getAgentRegistryEntry("build_monitor"),
    build_metadata: buildFixture(),
    verification_metadata: {
      verification_ref_id: "verification:build.monitor",
      verification_status: "completed_metadata_only",
      risk_flag_count: 1,
      raw_verifier_response_included: false,
      metadata_only: true,
    },
    metadata_only: true,
    raw_diffs_included: false,
    full_logs_included: false,
    model_call_requested: false,
    github_call_requested: false,
    scheduling_requested: false,
    inbox_write_requested: false,
    write_requested: false,
    git_mutation_requested: false,
  };
}

function buildMonitorDryRun() {
  const entry = getAgentRegistryEntry("build_monitor");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "build_monitor",
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
      fixture_id: "fixture:build.monitor.preview",
      fixture_hash: HASH,
      metadata_record_count: 6,
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

function buildFixture(): BuildMonitorMetadata {
  const refs = getAgentRegistryEntry("build_monitor").declared_sources.map(
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
  return {
    build_metadata_id: "build:monitor.preview",
    changed_files_count: 6,
    tests_passed: 4643,
    tests_failed: 0,
    test_files_count: 526,
    latest_commit_sha: "abc1234",
    current_phase_or_slice: "Phase 21H.7 Build Monitor preview",
    notable_changes: [
      notableChange(
        "change:runtime",
        "Agent runtime preview path expanded",
        "runtime",
        "high",
        [refs[0]],
      ),
      notableChange(
        "change:governance",
        "Preview governance remains fail-closed",
        "governance",
        "medium",
        [refs[2]],
      ),
      notableChange(
        "change:docs",
        "Build progress story is README-ready",
        "docs",
        "medium",
        [refs[1]],
      ),
    ],
    risks: [
      {
        risk_id: "risk:uncommitted-stack",
        title: "Large uncommitted stack requires careful squash",
        severity: "high",
        evidence_refs: [refs[1]],
        raw_diff_included: false,
        full_log_included: false,
        metadata_only: true,
      },
      {
        risk_id: "risk:line-endings",
        title: "Line ending warnings still appear in diff checks",
        severity: "medium",
        evidence_refs: [refs[2]],
        raw_diff_included: false,
        full_log_included: false,
        metadata_only: true,
      },
    ],
    gitnexus_refs: [
      {
        ref_id: "gitnexus:agent-runtime",
        artifact_type: "repo_graph",
        artifact_hash: "gitnexus:graph.agent-runtime",
        raw_graph_included: false,
        raw_diff_included: false,
        metadata_only: true,
      },
    ],
    raw_diff_included: false,
    full_log_included: false,
    metadata_only: true,
  };
}

function notableChange(
  changeId: string,
  title: string,
  area: BuildMonitorMetadata["notable_changes"][number]["area"],
  impact: BuildMonitorMetadata["notable_changes"][number]["impact"],
  evidenceRefs: BuildMonitorMetadata["notable_changes"][number]["evidence_refs"],
) {
  return {
    change_id: changeId,
    title,
    area,
    impact,
    evidence_refs: evidenceRefs,
    raw_diff_included: false,
    full_log_included: false,
    metadata_only: true,
  } as const;
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
