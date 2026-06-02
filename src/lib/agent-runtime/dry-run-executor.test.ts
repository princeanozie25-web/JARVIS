import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
} from ".";

const HASH = `sha256:${"b".repeat(64)}`;

describe("Agent dry-run executor", () => {
  it("turns an eligible plan into a metadata-only dry-run envelope", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const plan = eligiblePlan("build_monitor", "report");
    const envelope = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan,
      registry_entry: entry,
      fixture_metadata: {
        fixture_id: "fixture:build-monitor",
        fixture_hash: HASH,
        metadata_record_count: 2,
        metadata_only: true,
        raw_body_included: false,
        model_prompt_included: false,
      },
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(envelope.status).toBe("planned");
    expect(envelope.reasons).toContain("planned_from_eligible_agent_plan");
    expect(envelope.agent_id).toBe("build_monitor");
    expect(envelope.eligibility).toBe("eligible");
    expect(envelope.selected_sources.length).toBeGreaterThan(0);
    expect(envelope.planned_output_type).toBe("report");
    expect(envelope.authority_class).toBe("suggest_only");
    expect(envelope.suggested_inbox_target).toBe("suggestion_inbox");
    expect(envelope.execution_attempted).toBe(false);
    expect(envelope.write_attempted).toBe(false);
    expect(envelope.source_reads_attempted).toBe(false);
    expect(envelope.governance.suggestion_inbox_write_attempted).toBe(false);
  });

  it("preserves verification and approval metadata from proposal plans", () => {
    const entry = getAgentRegistryEntry("cv_maintenance");
    const plan = eligiblePlan("cv_maintenance", "draft");
    const envelope = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan,
      registry_entry: entry,
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(envelope.status).toBe("planned");
    expect(envelope.authority_class).toBe("proposal_only");
    expect(envelope.verification_required).toBe(true);
    expect(envelope.approval_required).toBe(true);
    expect(envelope.approval_lifecycle_required).toBe(true);
  });

  it("keeps skipped plans skipped instead of executing them", () => {
    const entry = {
      ...getAgentRegistryEntry("health_agent"),
      schedule_class: "disabled" as const,
    };
    const plan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "health_agent",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "digest",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });
    const envelope = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan,
      registry_entry: entry,
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(envelope.status).toBe("skipped");
    expect(envelope.reasons).toContain("skipped_by_agent_plan");
    expect(envelope.execution_attempted).toBe(false);
  });

  it("does not allow rejected plans to become planned dry-runs", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const rejectedPlan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "build_monitor",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: ["google:gmail"],
      requested_output_type: "report",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });
    const envelope = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan: rejectedPlan,
      registry_entry: entry,
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(rejectedPlan.eligibility).toBe("ineligible");
    expect(envelope.status).toBe("rejected");
    expect(envelope.reasons).toContain("rejected_by_agent_plan");
  });

  it("rejects registry mismatches", () => {
    const plan = eligiblePlan("build_monitor", "report");
    const envelope = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan,
      registry_entry: getAgentRegistryEntry("cost_monitor"),
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(envelope.status).toBe("rejected");
    expect(envelope.reasons).toContain("registry_agent_mismatch");
  });

  it("rejects planned output types that are not allowed by the registry", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const incompatibleRegistry = {
      ...entry,
      allowed_output_types: ["digest" as const],
      output_type: "digest" as const,
    };
    const plan = eligiblePlan("build_monitor", "report");
    const envelope = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan,
      registry_entry: incompatibleRegistry,
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(envelope.status).toBe("rejected");
    expect(envelope.reasons).toContain("planned_output_not_allowed");
  });

  it("rejects any request to perform real execution, source reads, or inbox writes", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const plan = eligiblePlan("build_monitor", "report");

    expect(() =>
      executeAgentDryRun({
        executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
        plan,
        registry_entry: entry,
        fixture_metadata: null,
        metadata_only: true,
        execute_real_agent_requested: true,
        source_reads_requested: false,
        suggestion_inbox_write_requested: false,
      }),
    ).toThrow();
    expect(() =>
      executeAgentDryRun({
        executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
        plan,
        registry_entry: entry,
        fixture_metadata: null,
        metadata_only: true,
        execute_real_agent_requested: false,
        source_reads_requested: true,
        suggestion_inbox_write_requested: false,
      }),
    ).toThrow();
    expect(() =>
      executeAgentDryRun({
        executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
        plan,
        registry_entry: entry,
        fixture_metadata: null,
        metadata_only: true,
        execute_real_agent_requested: false,
        source_reads_requested: false,
        suggestion_inbox_write_requested: true,
      }),
    ).toThrow();
  });

  it("has no source-read, model, network, scheduling, write, or inbox creation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/dry-run-executor.ts"),
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

function eligiblePlan(
  agentId: Parameters<typeof getAgentRegistryEntry>[0],
  outputType: "digest" | "report" | "recommendation" | "draft" | "alert",
) {
  const entry = getAgentRegistryEntry(agentId);
  return planAgentRun({
    planner_version: AGENT_PLANNER_VERSION,
    agent_id: agentId,
    registry_entry: entry,
    run_context: "manual",
    available_metadata_sources: availableSources(entry),
    requested_source_ids: [],
    requested_output_type: outputType,
    trigger_metadata: null,
    metadata_only: true,
    execution_requested: false,
    scheduling_requested: false,
    write_requested: false,
  });
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
