import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_PLANNER_VERSION, getAgentRegistryEntry, planAgentRun } from ".";

const HASH = `sha256:${"a".repeat(64)}`;

describe("Agent planner", () => {
  it("plans an eligible manual agent run with declared metadata sources", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const plan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "build_monitor",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: ["github:jarvis"],
      requested_output_type: "report",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });

    expect(plan.eligibility).toBe("eligible");
    expect(plan.reasons).toContain("eligible");
    expect(plan.reasons).toContain("manual_context_allowed");
    expect(plan.reasons).toContain("declared_sources_selected");
    expect(
      plan.selected_sources.filter((source) => source.selected),
    ).toHaveLength(1);
    expect(plan.output_type).toBe("report");
    expect(plan.authority).toBe("suggest_only");
    expect(plan.execution_attempted).toBe(false);
    expect(plan.write_attempted).toBe(false);
    expect(plan.governance.suggestion_created).toBe(false);
  });

  it("rejects undeclared requested sources", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const plan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "build_monitor",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: [
        ...availableSources(entry),
        {
          source_kind: "google_gmail",
          source_id: "google:gmail",
          available: true,
          metadata_only: true,
          raw_body_included: false,
        },
      ],
      requested_source_ids: ["google:gmail"],
      requested_output_type: "report",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });

    expect(plan.eligibility).toBe("ineligible");
    expect(plan.reasons).toContain("requested_source_undeclared");
    expect(plan.warnings).toContain("source_filtered_to_declared_registry");
    expect(plan.selected_sources.some((source) => source.selected)).toBe(false);
  });

  it("rejects undeclared output types", () => {
    const entry = getAgentRegistryEntry("cost_monitor");
    const plan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "cost_monitor",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "draft",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });

    expect(plan.eligibility).toBe("ineligible");
    expect(plan.reasons).toContain("requested_output_undeclared");
  });

  it("marks scheduled context metadata-only and ineligible without implementing scheduling", () => {
    const entry = getAgentRegistryEntry("deadline_agent");
    const plan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "deadline_agent",
      registry_entry: entry,
      run_context: "scheduled",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "alert",
      trigger_metadata: {
        trigger_id: "trigger:deadline-scheduled",
        trigger_kind: "scheduled_tick",
        source_ref_hash: HASH,
        metadata_only: true,
        raw_trigger_body_included: false,
      },
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });

    expect(plan.eligibility).toBe("ineligible");
    expect(plan.reasons).toContain("scheduled_context_not_implemented");
    expect(plan.warnings).toContain("scheduled_context_metadata_only");
    expect(plan.governance.scheduling_attempted).toBe(false);
  });

  it("supports event-driven context only when trigger metadata is present", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const missingTrigger = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "build_monitor",
      registry_entry: entry,
      run_context: "event_driven",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "alert",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });
    const withTrigger = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "build_monitor",
      registry_entry: entry,
      run_context: "event_driven",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "alert",
      trigger_metadata: {
        trigger_id: "trigger:build-event",
        trigger_kind: "event_metadata",
        source_ref_hash: HASH,
        metadata_only: true,
        raw_trigger_body_included: false,
      },
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });

    expect(missingTrigger.eligibility).toBe("ineligible");
    expect(missingTrigger.reasons).toContain("event_context_missing_trigger");
    expect(withTrigger.eligibility).toBe("eligible");
    expect(withTrigger.warnings).toContain("event_trigger_metadata_only");
  });

  it("skips disabled registry entries without execution", () => {
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

    expect(plan.eligibility).toBe("skipped");
    expect(plan.reasons).toContain("agent_disabled");
    expect(plan.execution_attempted).toBe(false);
  });

  it("surfaces approval and verification requirements for proposal agents", () => {
    const entry = getAgentRegistryEntry("cv_maintenance");
    const plan = planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "cv_maintenance",
      registry_entry: entry,
      run_context: "manual",
      available_metadata_sources: availableSources(entry),
      requested_source_ids: [],
      requested_output_type: "draft",
      trigger_metadata: null,
      metadata_only: true,
      execution_requested: false,
      scheduling_requested: false,
      write_requested: false,
    });

    expect(plan.eligibility).toBe("eligible");
    expect(plan.authority).toBe("proposal_only");
    expect(plan.requires_approval).toBe(true);
    expect(plan.approval_lifecycle_required).toBe(true);
    expect(plan.requires_verification).toBe(true);
    expect(plan.reasons).toContain("proposal_requires_approval");
    expect(plan.warnings).toContain("approval_metadata_required");
    expect(plan.warnings).toContain("verification_metadata_required");
  });

  it("rejects critical agents that lack verification in the registry entry", () => {
    const entry = {
      ...getAgentRegistryEntry("research_agent"),
      risk_class: "critical" as const,
      requires_verification: false,
    };
    expect(() =>
      planAgentRun({
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
    ).toThrow("critical-risk agents require verification metadata");
  });

  it("has no execution, scheduling, model, network, write, adapter, or inbox creation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/planner.ts"),
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
      expect(text).not.toMatch(/writeFile|appendFile|executeApprovedVault/i);
      expect(text).not.toMatch(/from\s+["'].*google-adapters/i);
      expect(text).not.toMatch(/from\s+["'].*approval-runtime/i);
      expect(text).not.toMatch(/from\s+["'].*routines/i);
      expect(text).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
      expect(text).not.toMatch(/backgroundJob|backgroundDaemon|worker|queue/i);
    }
  });
});

function availableSources(entry: ReturnType<typeof getAgentRegistryEntry>) {
  return entry.declared_sources.map((source) => ({
    source_kind: source.source_kind,
    source_id: source.source_id,
    available: true,
    metadata_only: true,
    raw_body_included: false,
  }));
}
