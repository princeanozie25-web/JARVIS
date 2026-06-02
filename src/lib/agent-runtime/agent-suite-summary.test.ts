import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPANSION_ERA_AGENT_IDS,
  IMPLEMENTED_AGENT_PREVIEW_IDS,
  buildAgentSuiteRegistrySummary,
} from ".";

describe("Agent suite registry summary", () => {
  it("represents all eight Phase 21H agents", () => {
    const summary = buildAgentSuiteRegistrySummary();

    expect(summary.kind).toBe("agent_runtime.preview_suite_registry_summary");
    expect(summary.registered_agent_count).toBe(8);
    expect(summary.expected_agent_count).toBe(8);
    expect(summary.preview_coverage.implemented_preview_ids).toEqual([
      "life_coach",
      "build_monitor",
      "research_agent",
      "cv_maintenance",
      "application_tracker",
      "deadline_agent",
      "cost_monitor",
      "health_agent",
    ]);
    expect(summary.preview_coverage.implemented_preview_ids).toEqual([
      ...EXPANSION_ERA_AGENT_IDS,
    ]);
    expect(IMPLEMENTED_AGENT_PREVIEW_IDS).toEqual(EXPANSION_ERA_AGENT_IDS);
  });

  it("reports complete preview coverage and closeout readiness", () => {
    const summary = buildAgentSuiteRegistrySummary();

    expect(summary.preview_coverage.implemented_preview_count).toBe(8);
    expect(summary.preview_coverage.missing_preview_count).toBe(0);
    expect(summary.preview_coverage.missing_preview_ids).toEqual([]);
    expect(summary.readiness_summary).toMatchObject({
      status: "complete_preview_suite",
      complete_preview_suite: true,
      all_registered_agents_represented: true,
      ready_for_closeout_verification: true,
      metadata_only: true,
    });
    expect(summary.readiness_summary.notes).toContain(
      "Suggestions only. Approval lifecycle remains the only path to execution.",
    );
  });

  it("includes deterministic coverage entries for every agent", () => {
    const summary = buildAgentSuiteRegistrySummary();

    expect(JSON.stringify(summary)).toBe(
      JSON.stringify(buildAgentSuiteRegistrySummary()),
    );
    expect(summary.preview_coverage.coverage_entries).toHaveLength(8);
    for (const entry of summary.preview_coverage.coverage_entries) {
      expect(entry.preview_implemented).toBe(true);
      expect(entry.suggestion_inbox_target).toBe("suggestion_inbox");
      expect(entry.execution_authority).toBe(false);
      expect(entry.metadata_only).toBe(true);
    }
  });

  it("summarizes governance posture without creating authority", () => {
    const posture = buildAgentSuiteRegistrySummary().governance_posture;

    expect(posture.preview_only).toBe(true);
    expect(posture.suggestion_only).toBe(true);
    expect(posture.scheduler_wiring_enabled).toBe(false);
    expect(posture.suggestion_inbox_writes_enabled).toBe(false);
    expect(posture.approval_execution_enabled).toBe(false);
    expect(posture.filesystem_writes_enabled).toBe(false);
    expect(posture.database_writes_enabled).toBe(false);
    expect(posture.network_calls_enabled).toBe(false);
    expect(posture.provider_calls_enabled).toBe(false);
    expect(posture.obsidian_reads_enabled).toBe(false);
    expect(posture.gmail_calendar_reads_enabled).toBe(false);
    expect(posture.sensor_integration_enabled).toBe(false);
    expect(posture.runtime_mutation_enabled).toBe(false);
    expect(posture.new_authority_surface_created).toBe(false);
    expect(posture.approval_lifecycle_remains_execution_path).toBe(true);
  });

  it("has no scheduler, inbox write, provider, network, filesystem, database, runtime mutation, or execution affordances", () => {
    const files = [
      "src/lib/agent-runtime/cost-monitor-preview.ts",
      "src/lib/agent-runtime/health-agent-preview.ts",
      "src/lib/agent-runtime/agent-suite-summary.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
      expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
      expect(source).not.toMatch(/fetch\s*\(|http|https|net\.|tls\./i);
      expect(source).not.toMatch(
        /createDeepSeek|createOllama|OpenAI|Anthropic|createModelRuntime/i,
      );
      expect(source).not.toMatch(/readFile|writeFile|appendFile|mkdir|rm\(/);
      expect(source).not.toMatch(/better-sqlite3|sqlite|db\./i);
      expect(source).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(source).not.toMatch(/executeTool|toolRegistry/i);
      expect(source).not.toMatch(/executeApprovedVault|approvalExecution/i);
      expect(source).not.toMatch(/runtimeMutation|mutateRuntime/i);
    }
  });
});
