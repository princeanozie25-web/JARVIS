import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  COST_MONITOR_PREVIEW_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewCostMonitor,
  type CostModelUsageMetadata,
} from ".";

const HASH = `sha256:${"c".repeat(64)}`;

describe("Cost Monitor preview", () => {
  it("creates a deterministic metadata-only cost posture preview", () => {
    const left = previewCostMonitor(baseInput());
    const right = previewCostMonitor(baseInput());

    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left.kind).toBe("cost_monitor.cost_posture_preview");
    expect(left.agent_id).toBe("cost_monitor");
    expect(left.agent_name).toBe("Cost Monitor");
    expect(left.preview_only).toBe(true);
    expect(left.suggestion_only).toBe(true);
    expect(left.execution_attempted).toBe(false);
    expect(left.write_attempted).toBe(false);
    expect(left.inbox_write_attempted).toBe(false);
  });

  it("summarizes model usage and spend without raw prompts, responses, or billing payloads", () => {
    const preview = previewCostMonitor(baseInput());
    const cost = preview.cost_monitor_preview;

    expect(cost.model_usage_summary).toMatchObject({
      model_count: 3,
      total_call_count: 115,
      total_input_tokens: 39000,
      total_output_tokens: 15000,
      cloud_call_count: 15,
      highest_cost_model_id: "deepseek-v4-pro",
      estimated_cost_cents: 4850,
      raw_prompt_included: false,
      raw_response_included: false,
      metadata_only: true,
    });
    expect(cost.spend_summary).toMatchObject({
      period_label: "June 2026",
      budget_limit_cents: 6000,
      current_spend_cents: 4200,
      metered_cloud_spend_cents: 4000,
      local_runtime_cost_cents: 200,
      budget_used_percent: 70,
      raw_billing_payload_included: false,
      metadata_only: true,
    });
  });

  it("classifies budget posture, projection, risk, and optimization suggestions", () => {
    const preview = previewCostMonitor(baseInput());
    const cost = preview.cost_monitor_preview;

    expect(cost.projected_spend_metadata).toMatchObject({
      projected_period_spend_cents: 7000,
      projected_budget_used_percent: 117,
      projection_basis: "fixture_elapsed_percent",
      metadata_only: true,
    });
    expect(cost.budget_posture).toBe("over_budget");
    expect(cost.risk_classification).toBe("critical");
    expect(
      cost.suggested_optimization_actions.map((item) => item.action),
    ).toEqual([
      "review_model_mix",
      "prefer_local_model",
      "manual_budget_review",
    ]);
    for (const suggestion of cost.suggested_optimization_actions) {
      expect(suggestion.suggestion_only).toBe(true);
      expect(suggestion.execution_attempted).toBe(false);
      expect(suggestion.metadata_only).toBe(true);
    }
  });

  it("integrates through registry, planner, dry-run executor, and output factory", () => {
    const preview = previewCostMonitor(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("cost_monitor");
    expect(preview.runtime_output_preview.output_type).toBe("alert");
    expect(preview.runtime_output_preview.agent_metadata).toMatchObject({
      display_name: "Cost Monitor",
      preview_scope: "cost_metadata",
      real_agent_logic_used: false,
    });
    expect(preview.runtime_output_preview.approval_metadata).toMatchObject({
      requires_approval: false,
      approval_status: "not_required",
      execution_enabled: false,
    });
  });

  it("rejects live read, provider, network, scheduler, write, inbox, and mutation requests", () => {
    for (const patch of [
      { telemetry_read_requested: true },
      { database_access_requested: true },
      { model_call_requested: true },
      { provider_call_requested: true },
      { network_call_requested: true },
      { scheduler_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
      { runtime_mutation_requested: true },
    ]) {
      expect(() => previewCostMonitor({ ...baseInput(), ...patch })).toThrow();
    }
  });

  it("reports governance as preview-only with no execution paths", () => {
    const governance = previewCostMonitor(baseInput()).governance;

    expect(governance.preview_only).toBe(true);
    expect(governance.suggestion_only).toBe(true);
    expect(governance.execution_attempted).toBe(false);
    expect(governance.write_attempted).toBe(false);
    expect(governance.inbox_write_attempted).toBe(false);
    expect(governance.telemetry_read_attempted).toBe(false);
    expect(governance.database_access_attempted).toBe(false);
    expect(governance.model_call_attempted).toBe(false);
    expect(governance.provider_call_attempted).toBe(false);
    expect(governance.network_call_attempted).toBe(false);
    expect(governance.scheduler_attempted).toBe(false);
    expect(governance.runtime_mutation_attempted).toBe(false);
  });

  it("has no scheduler, provider, network, database, filesystem, inbox, or mutation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/cost-monitor-preview.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
    expect(source).not.toMatch(/fetch\s*\(|http|https|net\.|tls\./i);
    expect(source).not.toMatch(/better-sqlite3|sqlite3|new Database|db\./i);
    expect(source).not.toMatch(
      /createDeepSeek|createOllama|OpenAI|Anthropic|createModelRuntime/i,
    );
    expect(source).not.toMatch(/readFile|writeFile|appendFile|mkdir|rm\(/);
    expect(source).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
    expect(source).not.toMatch(/executeTool|toolRegistry|runtimeMutation/i);
  });
});

function baseInput() {
  return {
    preview_version: COST_MONITOR_PREVIEW_VERSION,
    dry_run: costMonitorDryRun(),
    registry_entry: getAgentRegistryEntry("cost_monitor"),
    model_usage_metadata: modelUsageFixture(),
    spend_metadata: {
      spend_id: "spend:june-2026",
      period_label: "June 2026",
      budget_limit_cents: 6000,
      current_spend_cents: 4200,
      elapsed_percent: 60,
      metered_cloud_spend_cents: 4000,
      local_runtime_cost_cents: 200,
      raw_billing_payload_included: false,
      metadata_only: true,
    },
    generated_at: "2026-06-02T12:00:00.000Z",
    metadata_only: true,
    telemetry_read_requested: false,
    database_access_requested: false,
    model_call_requested: false,
    provider_call_requested: false,
    network_call_requested: false,
    scheduler_requested: false,
    inbox_write_requested: false,
    write_requested: false,
    runtime_mutation_requested: false,
  };
}

function costMonitorDryRun() {
  const entry = getAgentRegistryEntry("cost_monitor");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
      planner_version: AGENT_PLANNER_VERSION,
      agent_id: "cost_monitor",
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
      fixture_id: "fixture:cost.monitor.preview",
      fixture_hash: HASH,
      metadata_record_count: 3,
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

function modelUsageFixture(): CostModelUsageMetadata[] {
  return [
    usage(
      "usage:deepseek.flash",
      "deepseek-v4-flash",
      "deepseek",
      12,
      18000,
      7000,
      1450,
      true,
    ),
    usage(
      "usage:deepseek.pro",
      "deepseek-v4-pro",
      "deepseek",
      3,
      9000,
      6000,
      3150,
      true,
    ),
    usage(
      "usage:nomic.embed",
      "nomic-embed-text",
      "ollama",
      100,
      12000,
      2000,
      250,
      false,
    ),
  ];
}

function usage(
  usageId: string,
  modelId: string,
  provider: string,
  callCount: number,
  inputTokens: number,
  outputTokens: number,
  estimatedCostCents: number,
  cloudModel: boolean,
): CostModelUsageMetadata {
  return {
    usage_id: usageId,
    model_id: modelId,
    provider,
    call_count: callCount,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_cents: estimatedCostCents,
    cloud_model: cloudModel,
    evidence_refs: [],
    raw_prompt_included: false,
    raw_response_included: false,
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
