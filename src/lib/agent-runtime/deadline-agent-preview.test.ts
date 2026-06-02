import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  DEADLINE_AGENT_PREVIEW_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewDeadlineAgent,
  type DeadlineMetadata,
} from ".";

const HASH = `sha256:${"b".repeat(64)}`;
const GENERATED_AT = "2026-06-02T12:00:00.000Z";

describe("Deadline Agent preview", () => {
  it("creates a metadata-only deadline alert preview", () => {
    const preview = previewDeadlineAgent(baseInput());

    expect(preview.kind).toBe("deadline_agent.deadline_alert_preview");
    expect(preview.agent_id).toBe("deadline_agent");
    expect(preview.agent_name).toBe("Deadline Agent");
    expect(preview.deadline_alert_preview.summary).toContain(
      "Metadata-only Deadline Agent preview",
    );
    expect(preview.deadline_alert_preview.upcoming_deadlines.length).toBe(4);
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.suggestion_only).toBe(true);
    expect(preview.preview_only).toBe(true);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    expect(preview.inbox_write_attempted).toBe(false);
  });

  it("summarizes deterministic fixture sources without raw bodies", () => {
    const preview = previewDeadlineAgent(baseInput());
    const sourceSummary = preview.deadline_alert_preview.source_summary;

    expect(sourceSummary).toMatchObject({
      deadline_count: 5,
      calendar_metadata_count: 2,
      project_registry_count: 2,
      manual_input_count: 1,
      raw_body_included: false,
      metadata_only: true,
    });
  });

  it("classifies upcoming deadlines by urgency, progress, escalation, and suggested action", () => {
    const preview = previewDeadlineAgent(baseInput());
    const alerts = preview.deadline_alert_preview.upcoming_deadlines;

    expect(alerts.map((alert) => alert.deadline_id)).toEqual([
      "deadline:mmu.final-report",
      "deadline:jarvis.blocked-slice",
      "deadline:phase21h.deadline-agent",
      "deadline:portfolio.polish",
    ]);
    expect(alerts[0]).toMatchObject({
      days_remaining: -1,
      progress_status: "overdue",
      escalation_level: "critical",
      suggested_next_action: "escalate_to_manual_review",
      priority: "critical",
      suggestion_only: true,
      metadata_only: true,
    });
    expect(alerts[1]).toMatchObject({
      days_remaining: 3,
      progress_status: "blocked",
      escalation_level: "critical",
      suggested_next_action: "escalate_to_manual_review",
    });
    expect(alerts[2]).toMatchObject({
      days_remaining: 1,
      progress_status: "at_risk",
      escalation_level: "high",
      suggested_next_action: "create_recovery_plan",
    });
    expect(alerts[3]).toMatchObject({
      days_remaining: 8,
      progress_status: "needs_attention",
      escalation_level: "low",
      suggested_next_action: "review_plan",
    });
  });

  it("filters complete deadlines and preserves source evidence metadata", () => {
    const preview = previewDeadlineAgent(baseInput());
    const alerts = preview.deadline_alert_preview.upcoming_deadlines;

    expect(alerts.map((alert) => alert.deadline_id)).not.toContain(
      "deadline:completed.archive",
    );
    for (const alert of alerts) {
      expect(alert.raw_body_included).toBe(false);
      expect(alert.metadata_only).toBe(true);
      for (const source of alert.evidence_refs) {
        expect(source.declared_in_contract).toBe(true);
        expect(source.raw_body_included).toBe(false);
        expect(source.metadata_only).toBe(true);
      }
    }
  });

  it("integrates through registry, planner, dry-run executor, and output factory", () => {
    const preview = previewDeadlineAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("deadline_agent");
    expect(preview.runtime_output_preview.output_type).toBe("alert");
    expect(preview.runtime_output_preview.risk_class).toBe("medium");
    expect(preview.runtime_output_preview.agent_metadata).toMatchObject({
      display_name: "Deadline Agent",
      preview_scope: "deadline_metadata",
      real_agent_logic_used: false,
    });
    expect(preview.runtime_output_preview.verification_metadata).toMatchObject({
      verification_required: true,
      verification_status: "not_requested",
      metadata_only: true,
    });
    expect(preview.runtime_output_preview.approval_metadata).toMatchObject({
      requires_approval: false,
      approval_status: "not_required",
      approval_bypass_allowed: false,
      execution_enabled: false,
      metadata_only: true,
    });
  });

  it("is deterministic for the same fixture input", () => {
    expect(JSON.stringify(previewDeadlineAgent(baseInput()))).toBe(
      JSON.stringify(previewDeadlineAgent(baseInput())),
    );
  });

  it("rejects non-Deadline registry entries and dry-runs", () => {
    expect(() =>
      previewDeadlineAgent({
        ...baseInput(),
        registry_entry: getAgentRegistryEntry("build_monitor"),
      }),
    ).toThrow("deadline_agent registry entry");

    expect(() =>
      previewDeadlineAgent({
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
    ).toThrow("deadline_agent dry-run");
  });

  it("rejects scheduler, calendar, Gmail, Obsidian, model, network, tool, inbox, write, approval, and auto-execution requests", () => {
    for (const patch of [
      { scheduler_requested: true },
      { calendar_call_requested: true },
      { gmail_call_requested: true },
      { obsidian_read_requested: true },
      { model_call_requested: true },
      { network_call_requested: true },
      { tool_execution_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
      { approval_execution_requested: true },
      { auto_execution_requested: true },
    ]) {
      expect(() =>
        previewDeadlineAgent({
          ...baseInput(),
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("reports governance as suggestion-only with no side effects", () => {
    const preview = previewDeadlineAgent(baseInput());

    expect(preview.governance.preview_only).toBe(true);
    expect(preview.governance.suggestion_only).toBe(true);
    expect(preview.governance.execution_attempted).toBe(false);
    expect(preview.governance.write_attempted).toBe(false);
    expect(preview.governance.inbox_write_attempted).toBe(false);
    expect(preview.governance.scheduler_attempted).toBe(false);
    expect(preview.governance.calendar_call_attempted).toBe(false);
    expect(preview.governance.gmail_call_attempted).toBe(false);
    expect(preview.governance.obsidian_read_attempted).toBe(false);
    expect(preview.governance.obsidian_write_attempted).toBe(false);
    expect(preview.governance.model_call_attempted).toBe(false);
    expect(preview.governance.network_call_attempted).toBe(false);
    expect(preview.governance.tool_execution_attempted).toBe(false);
    expect(preview.governance.approval_execution_attempted).toBe(false);
    expect(preview.governance.auto_execution_attempted).toBe(false);
  });

  it("has no scheduler, calendar, Gmail, Obsidian, model, network, tool, write, inbox, or execution imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/deadline-agent-preview.ts"),
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
        /fetch\s*\(|googleapis|OAuth2Client|gmail\.users|calendar\.events/i,
      );
      expect(text).not.toMatch(
        /createDeepSeek|createOllama|OpenAI|Anthropic|createModelRuntime|modelRuntime/i,
      );
      expect(text).not.toMatch(/readVault|obsidian:index|obsidian:embed/i);
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(text).not.toMatch(/toolRegistry|executeTool|runTool/i);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});

function baseInput() {
  return {
    preview_version: DEADLINE_AGENT_PREVIEW_VERSION,
    dry_run: deadlineAgentDryRun(),
    registry_entry: getAgentRegistryEntry("deadline_agent"),
    deadline_metadata: deadlineFixture(),
    generated_at: GENERATED_AT,
    metadata_only: true,
    scheduler_requested: false,
    calendar_call_requested: false,
    gmail_call_requested: false,
    obsidian_read_requested: false,
    model_call_requested: false,
    network_call_requested: false,
    tool_execution_requested: false,
    inbox_write_requested: false,
    write_requested: false,
    approval_execution_requested: false,
    auto_execution_requested: false,
  };
}

function deadlineAgentDryRun() {
  const entry = getAgentRegistryEntry("deadline_agent");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "deadline_agent",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "alert",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    }),
    registry_entry: entry,
    fixture_metadata: {
      fixture_id: "fixture:deadline.agent.preview",
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

function deadlineFixture(): DeadlineMetadata[] {
  const refs = getAgentRegistryEntry("deadline_agent").declared_sources.map(
    (source) => sourceRef(source.source_kind, source.source_id),
  );
  return [
    deadline(
      "deadline:phase21h.deadline-agent",
      "Phase 21H Deadline Agent slice",
      "project_registry",
      "2026-06-03T12:00:00.000Z",
      20,
      "in_progress",
      "high",
      [refs[1]],
    ),
    deadline(
      "deadline:mmu.final-report",
      "MMU final report review",
      "manual_input",
      "2026-06-01T12:00:00.000Z",
      95,
      "in_progress",
      "critical",
      [refs[2]],
    ),
    deadline(
      "deadline:portfolio.polish",
      "Portfolio polish pass",
      "project_registry",
      "2026-06-10T12:00:00.000Z",
      30,
      "in_progress",
      "medium",
      [refs[1]],
    ),
    deadline(
      "deadline:jarvis.blocked-slice",
      "Blocked JARVIS integration checkpoint",
      "calendar_metadata",
      "2026-06-05T12:00:00.000Z",
      50,
      "blocked",
      "high",
      [refs[0], refs[1]],
    ),
    deadline(
      "deadline:completed.archive",
      "Completed archive cleanup",
      "calendar_metadata",
      "2026-06-20T12:00:00.000Z",
      100,
      "complete",
      "low",
      [refs[0]],
    ),
  ];
}

function deadline(
  deadlineId: string,
  title: string,
  source: DeadlineMetadata["source"],
  dueAt: string,
  progressPercent: number,
  status: DeadlineMetadata["status"],
  priority: DeadlineMetadata["priority"],
  evidenceRefs: DeadlineMetadata["evidence_refs"],
): DeadlineMetadata {
  return {
    deadline_id: deadlineId,
    title,
    source,
    due_at: dueAt,
    progress_percent: progressPercent,
    status,
    priority,
    evidence_refs: evidenceRefs,
    raw_body_included: false,
    metadata_only: true,
  };
}

function sourceRef(
  sourceKind: ReturnType<
    typeof getAgentRegistryEntry
  >["declared_sources"][number]["source_kind"],
  sourceId: string,
) {
  return {
    source_kind: sourceKind,
    source_id: sourceId,
    content_hash: null,
    declared_in_contract: true,
    raw_body_included: false,
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
