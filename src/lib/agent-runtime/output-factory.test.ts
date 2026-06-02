import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_OUTPUT_FACTORY_VERSION,
  AGENT_PLANNER_VERSION,
  EXPANSION_ERA_AGENT_IDS,
  createAgentOutputPreview,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  validateAgentOutputAgainstContract,
} from ".";

const HASH = `sha256:${"c".repeat(64)}`;

describe("Agent output factory", () => {
  it("creates a metadata-only preview from a planned dry-run envelope", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const preview = createAgentOutputPreview({
      factory_version: AGENT_OUTPUT_FACTORY_VERSION,
      dry_run: plannedDryRun("build_monitor", "report"),
      registry_entry: entry,
      fixture_metadata: {
        fixture_id: "fixture:build-output",
        fixture_hash: HASH,
        metadata_record_count: 3,
        metadata_only: true,
        raw_body_included: false,
        model_prompt_included: false,
      },
      metadata_only: true,
      inbox_write_requested: false,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      model_call_requested: false,
    });

    expect(preview.output_id).toBe("preview:build_monitor:report");
    expect(preview.agent_id).toBe("build_monitor");
    expect(preview.output_type).toBe("report");
    expect(preview.title).toContain("Build Monitor");
    expect(preview.priority).toBe("medium");
    expect(preview.suggested_inbox_target).toBe("suggestion_inbox");
    expect(preview.suggestion_inbox.output_routed_to_inbox).toBe(true);
    expect(preview.preview_only).toBe(true);
    expect(preview.inbox_write_attempted).toBe(false);
    expect(preview.execution_attempted).toBe(false);
    expect(preview.source_reads_attempted).toBe(false);
    expect(preview.raw_source_body_included).toBe(false);
    expect(preview.model_prompt_included).toBe(false);
    expect(preview.generated_body_included).toBe(false);
  });

  it("supports every declared output type through registry-backed agents", () => {
    const cases = [
      ["health_agent", "digest"],
      ["build_monitor", "report"],
      ["life_coach", "recommendation"],
      ["cv_maintenance", "draft"],
      ["deadline_agent", "alert"],
    ] as const;

    for (const [agentId, outputType] of cases) {
      const preview = createAgentOutputPreview({
        factory_version: AGENT_OUTPUT_FACTORY_VERSION,
        dry_run: plannedDryRun(agentId, outputType),
        registry_entry: getAgentRegistryEntry(agentId),
        fixture_metadata: null,
        metadata_only: true,
        inbox_write_requested: false,
        execute_real_agent_requested: false,
        source_reads_requested: false,
        model_call_requested: false,
      });

      expect(preview.output_type).toBe(outputType);
      expect(preview.preview_only).toBe(true);
    }
  });

  it("provides minimal agent-specific metadata for all Phase 21H agents", () => {
    for (const agentId of EXPANSION_ERA_AGENT_IDS) {
      const entry = getAgentRegistryEntry(agentId);
      const preview = createAgentOutputPreview({
        factory_version: AGENT_OUTPUT_FACTORY_VERSION,
        dry_run: plannedDryRun(agentId, entry.output_type),
        registry_entry: entry,
        fixture_metadata: null,
        metadata_only: true,
        inbox_write_requested: false,
        execute_real_agent_requested: false,
        source_reads_requested: false,
        model_call_requested: false,
      });

      expect(preview.agent_metadata.agent_id).toBe(agentId);
      expect(preview.agent_metadata.display_name.length).toBeGreaterThan(0);
      expect(preview.agent_metadata.real_agent_logic_used).toBe(false);
      expect(preview.agent_metadata.metadata_only).toBe(true);
    }
  });

  it("carries proposal approval metadata for proposal agents", () => {
    const preview = createAgentOutputPreview({
      factory_version: AGENT_OUTPUT_FACTORY_VERSION,
      dry_run: plannedDryRun("cv_maintenance", "draft"),
      registry_entry: getAgentRegistryEntry("cv_maintenance"),
      fixture_metadata: null,
      metadata_only: true,
      inbox_write_requested: false,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      model_call_requested: false,
    });

    expect(preview.approval_metadata.requires_approval).toBe(true);
    expect(preview.approval_metadata.phase18_lifecycle_required).toBe(true);
    expect(preview.approval_metadata.approval_status).toBe("not_requested");
    expect(preview.approval_metadata.approval_bypass_allowed).toBe(false);
    expect(preview.verification_metadata.verification_required).toBe(true);
  });

  it("keeps source references declared, metadata-only, and body-free", () => {
    const preview = createAgentOutputPreview({
      factory_version: AGENT_OUTPUT_FACTORY_VERSION,
      dry_run: plannedDryRun("research_agent", "report"),
      registry_entry: getAgentRegistryEntry("research_agent"),
      fixture_metadata: null,
      metadata_only: true,
      inbox_write_requested: false,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      model_call_requested: false,
    });

    expect(preview.source_refs.length).toBeGreaterThan(0);
    for (const source of preview.source_refs) {
      expect(source.declared_in_contract).toBe(true);
      expect(source.raw_body_included).toBe(false);
      expect(source.metadata_only).toBe(true);
    }
  });

  it("rejects skipped or rejected dry-runs", () => {
    const skipped = executeAgentDryRun({
      executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
      plan: planAgentRun({
        planner_version: AGENT_PLANNER_VERSION,
        agent_id: "health_agent",
        registry_entry: {
          ...getAgentRegistryEntry("health_agent"),
          schedule_class: "disabled" as const,
        },
        run_context: "manual",
        available_metadata_sources: availableSources(
          getAgentRegistryEntry("health_agent"),
        ),
        requested_source_ids: [],
        requested_output_type: "digest",
        trigger_metadata: null,
        metadata_only: true,
        execution_requested: false,
        scheduling_requested: false,
        write_requested: false,
      }),
      registry_entry: {
        ...getAgentRegistryEntry("health_agent"),
        schedule_class: "disabled" as const,
      },
      fixture_metadata: null,
      metadata_only: true,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      suggestion_inbox_write_requested: false,
    });

    expect(() =>
      createAgentOutputPreview({
        factory_version: AGENT_OUTPUT_FACTORY_VERSION,
        dry_run: skipped,
        registry_entry: getAgentRegistryEntry("health_agent"),
        fixture_metadata: null,
        metadata_only: true,
        inbox_write_requested: false,
        execute_real_agent_requested: false,
        source_reads_requested: false,
        model_call_requested: false,
      }),
    ).toThrow("planned dry-run envelope required");
  });

  it("rejects registry mismatches and output type mismatches", () => {
    expect(() =>
      createAgentOutputPreview({
        factory_version: AGENT_OUTPUT_FACTORY_VERSION,
        dry_run: plannedDryRun("build_monitor", "report"),
        registry_entry: getAgentRegistryEntry("cost_monitor"),
        fixture_metadata: null,
        metadata_only: true,
        inbox_write_requested: false,
        execute_real_agent_requested: false,
        source_reads_requested: false,
        model_call_requested: false,
      }),
    ).toThrow("registry entry must match dry-run agent id");

    expect(() =>
      createAgentOutputPreview({
        factory_version: AGENT_OUTPUT_FACTORY_VERSION,
        dry_run: plannedDryRun("build_monitor", "report"),
        registry_entry: {
          ...getAgentRegistryEntry("build_monitor"),
          output_type: "digest" as const,
          allowed_output_types: ["digest" as const],
        },
        fixture_metadata: null,
        metadata_only: true,
        inbox_write_requested: false,
        execute_real_agent_requested: false,
        source_reads_requested: false,
        model_call_requested: false,
      }),
    ).toThrow("registry output type must match dry-run output type");
  });

  it("rejects requests for inbox writes, execution, source reads, or model calls", () => {
    const dryRun = plannedDryRun("build_monitor", "report");
    const entry = getAgentRegistryEntry("build_monitor");

    for (const patch of [
      { inbox_write_requested: true },
      { execute_real_agent_requested: true },
      { source_reads_requested: true },
      { model_call_requested: true },
    ]) {
      expect(() =>
        createAgentOutputPreview({
          factory_version: AGENT_OUTPUT_FACTORY_VERSION,
          dry_run: dryRun,
          registry_entry: entry,
          fixture_metadata: null,
          metadata_only: true,
          inbox_write_requested: false,
          execute_real_agent_requested: false,
          source_reads_requested: false,
          model_call_requested: false,
          ...patch,
        }),
      ).toThrow();
    }
  });

  it("is compatible with the existing agent output validation contract", () => {
    const entry = getAgentRegistryEntry("build_monitor");
    const preview = createAgentOutputPreview({
      factory_version: AGENT_OUTPUT_FACTORY_VERSION,
      dry_run: plannedDryRun("build_monitor", "report"),
      registry_entry: entry,
      fixture_metadata: null,
      metadata_only: true,
      inbox_write_requested: false,
      execute_real_agent_requested: false,
      source_reads_requested: false,
      model_call_requested: false,
    });

    const contract = {
      id: entry.id,
      version: entry.version,
      owner: entry.owner,
      schedule_class: entry.schedule_class,
      declared_sources: entry.declared_sources,
      output_type: entry.output_type,
      risk_class: entry.risk_class,
      authority: entry.authority,
      requires_verification: entry.requires_verification,
      requires_approval: entry.requires_approval,
      inbox_target: entry.inbox_target,
      governance: entry.governance,
    };
    const validation = validateAgentOutputAgainstContract(contract, {
      output_id: "preview:build_monitor:report",
      agent_id: preview.agent_id,
      contract_version: entry.version,
      output_type: preview.output_type,
      authority: entry.authority,
      risk_class: entry.risk_class,
      implies_action: false,
      summary_hash: HASH,
      source_refs: preview.source_refs,
      suggestion_inbox: preview.suggestion_inbox,
      approval: preview.approval_metadata,
      verification: preview.verification_metadata,
      created_at: "2026-06-02T12:00:00.000Z",
      metadata_only: true,
      raw_output_body_included: false,
      direct_execution_attempted: false,
      action_executed: false,
      schedule_created: false,
      model_called: false,
      network_called: false,
      obsidian_written: false,
    });

    expect(validation.valid).toBe(true);
    expect(validation.reasons).toEqual(["valid_output"]);
  });

  it("has no source-read, model, network, scheduling, write, or inbox creation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/output-factory.ts"),
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

function plannedDryRun(
  agentId: Parameters<typeof getAgentRegistryEntry>[0],
  outputType: "digest" | "report" | "recommendation" | "draft" | "alert",
) {
  const entry = getAgentRegistryEntry(agentId);
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
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
    }),
    registry_entry: entry,
    fixture_metadata: null,
    metadata_only: true,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    suggestion_inbox_write_requested: false,
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
