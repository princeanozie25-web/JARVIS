import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPANSION_ERA_AGENT_IDS,
  PHASE21H_PREVIEW_CLOSEOUT_AGENT_IDS,
  buildAgentSuiteRegistrySummary,
  buildPhase21HPreviewCloseoutReport,
} from ".";

describe("Phase 21H preview suite closeout", () => {
  it("returns a typed PASS report for the preview suite only", () => {
    const report = buildPhase21HPreviewCloseoutReport();

    expect(report).toMatchObject({
      kind: "agent_runtime.phase21h_preview_suite_closeout",
      status: "PASS",
      scope: "Phase 21H preview suite only",
      completed_label: "preview suite complete",
      foundation_complete: true,
      deterministic: true,
      metadata_only: true,
    });
    expect(report.closeout_notes).toContain(
      "This does not close real scheduled agents or live integration work.",
    );
  });

  it("represents all eight preview agents and the Agent Suite Summary", () => {
    const report = buildPhase21HPreviewCloseoutReport();

    expect(report.registered_agent_count).toBe(8);
    expect(report.represented_preview_count).toBe(8);
    expect(report.preview_agents.map((agent) => agent.agent_id)).toEqual([
      "life_coach",
      "build_monitor",
      "research_agent",
      "cv_maintenance",
      "application_tracker",
      "deadline_agent",
      "cost_monitor",
      "health_agent",
    ]);
    expect(report.preview_agents.map((agent) => agent.agent_id)).toEqual([
      ...EXPANSION_ERA_AGENT_IDS,
    ]);
    expect(PHASE21H_PREVIEW_CLOSEOUT_AGENT_IDS).toEqual(
      EXPANSION_ERA_AGENT_IDS,
    );
    expect(report.missing_preview_agents).toEqual([]);
    expect(report.agent_suite_summary_status).toBe("complete_preview_suite");
    expect(report.agent_suite_summary_version).toBe(
      buildAgentSuiteRegistrySummary().summary_version,
    );
  });

  it("marks every preview deterministic, suggestion-only, fixture-only, and metadata-only", () => {
    const report = buildPhase21HPreviewCloseoutReport();

    for (const agent of report.preview_agents) {
      expect(agent.represented).toBe(true);
      expect(agent.deterministic).toBe(true);
      expect(agent.suggestion_only).toBe(true);
      expect(agent.fixture_or_mock_input_only).toBe(true);
      expect(agent.preview_only).toBe(true);
      expect(agent.metadata_only).toBe(true);
      expect(agent.preview_version).toMatch(/^phase21h\./);
    }
  });

  it("proves all required governance exclusions remain closed", () => {
    const governance = buildPhase21HPreviewCloseoutReport().governance;

    expect(governance.all_previews_represented).toBe(true);
    expect(governance.agent_suite_summary_present).toBe(true);
    expect(governance.all_previews_deterministic).toBe(true);
    expect(governance.all_previews_suggestion_only).toBe(true);
    expect(governance.all_previews_fixture_mock_input_only).toBe(true);
    expect(governance.scheduler_wiring_exists).toBe(false);
    expect(governance.suggestion_inbox_writes_exist).toBe(false);
    expect(governance.approval_execution_exists).toBe(false);
    expect(governance.provider_model_calls_exist).toBe(false);
    expect(governance.network_calls_exist).toBe(false);
    expect(governance.filesystem_database_writes_exist).toBe(false);
    expect(governance.real_obsidian_gmail_calendar_ruview_reads_exist).toBe(
      false,
    );
    expect(governance.runtime_mutation_or_authority_escalation_exists).toBe(
      false,
    );
    expect(governance.approval_lifecycle_remains_only_execution_path).toBe(
      true,
    );
  });

  it("does not claim real scheduled agents, live reads, sensor integrations, or full autonomous suite shipping", () => {
    const future = buildPhase21HPreviewCloseoutReport().future_boundaries;

    expect(future.real_scheduled_agents_complete).toBe(false);
    expect(future.real_suggestion_inbox_writes_complete).toBe(false);
    expect(future.real_gmail_calendar_reads_complete).toBe(false);
    expect(future.real_obsidian_reads_complete).toBe(false);
    expect(future.real_sensor_ruview_integrations_complete).toBe(false);
    expect(future.autonomous_agents_suite_fully_shipped).toBe(false);
    expect(future.future_work_note).toContain("preview-only foundations");
  });

  it("is deterministic", () => {
    expect(JSON.stringify(buildPhase21HPreviewCloseoutReport())).toBe(
      JSON.stringify(buildPhase21HPreviewCloseoutReport()),
    );
  });

  it("has no scheduler, inbox write, approval execution, provider, network, live-read, write, or mutation affordances", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/agent-runtime/phase-21h-preview-closeout.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
    expect(source).not.toMatch(/fetch\s*\(|http|https|net\.|tls\./i);
    expect(source).not.toMatch(
      /createDeepSeek|createOllama|OpenAI|Anthropic|createModelRuntime/i,
    );
    expect(source).not.toMatch(/readFile|writeFile|appendFile|mkdir|rm\(/);
    expect(source).not.toMatch(/better-sqlite3|sqlite3|new Database|db\./i);
    expect(source).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
    expect(source).not.toMatch(/executeApprovedVault|executeVerification/i);
    expect(source).not.toMatch(/readVault|googleapis|OAuth2Client/i);
    expect(source).not.toMatch(/RuViewClient|createRuView|sensorClient/i);
    expect(source).not.toMatch(/runtimeMutation|mutateRuntime|authorityToken/i);
  });
});
