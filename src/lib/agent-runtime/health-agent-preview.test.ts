import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DRY_RUN_EXECUTOR_VERSION,
  AGENT_PLANNER_VERSION,
  HEALTH_AGENT_PREVIEW_VERSION,
  executeAgentDryRun,
  getAgentRegistryEntry,
  planAgentRun,
  previewHealthAgent,
  type HealthSensorSummary,
} from ".";

const HASH = `sha256:${"d".repeat(64)}`;

describe("Health Agent preview", () => {
  it("creates a deterministic metadata-only wellness digest preview", () => {
    const left = previewHealthAgent(baseInput());
    const right = previewHealthAgent(baseInput());

    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left.kind).toBe("health_agent.wellness_digest_preview");
    expect(left.agent_id).toBe("health_agent");
    expect(left.agent_name).toBe("Health Agent");
    expect(left.preview_only).toBe(true);
    expect(left.suggestion_only).toBe(true);
    expect(left.execution_attempted).toBe(false);
    expect(left.write_attempted).toBe(false);
    expect(left.inbox_write_attempted).toBe(false);
  });

  it("summarizes sleep, focus, and presence from fixture metadata only", () => {
    const preview = previewHealthAgent(baseInput());
    const health = preview.health_agent_preview;

    expect(health.sleep_summary).toMatchObject({
      sleep_window_minutes: 360,
      target_sleep_window_minutes: 480,
      wake_interruptions: 2,
      self_reported_quality: "medium",
      medical_claim_made: false,
      metadata_only: true,
    });
    expect(health.focus_summary).toMatchObject({
      focus_minutes: 150,
      interruption_count: 5,
      deep_work_block_count: 2,
      productivity_claim_made: false,
      metadata_only: true,
    });
    expect(health.presence_summary).toMatchObject({
      present_minutes: 180,
      away_minutes: 240,
      room_state_claim_made: false,
      metadata_only: true,
    });
    expect(health.sensor_summary_count).toBe(2);
  });

  it("produces wellness indicators without health scores or medical advice", () => {
    const indicators =
      previewHealthAgent(baseInput()).health_agent_preview.wellness_indicators;

    expect(indicators.map((item) => item.indicator)).toEqual([
      "sleep_window_short",
      "focus_fragmented",
      "presence_low",
      "recovery_window_available",
    ]);
    expect(indicators.map((item) => item.suggested_action)).toEqual([
      "protect_sleep_window",
      "schedule_focus_block",
      "monitor",
      "take_recovery_break",
    ]);
    for (const indicator of indicators) {
      expect(indicator.suggestion_only).toBe(true);
      expect(indicator.medical_advice).toBe(false);
      expect(indicator.health_score_generated).toBe(false);
      expect(indicator.metadata_only).toBe(true);
    }
  });

  it("integrates through registry, planner, dry-run executor, and output factory", () => {
    const preview = previewHealthAgent(baseInput());

    expect(preview.runtime_output_preview.agent_id).toBe("health_agent");
    expect(preview.runtime_output_preview.output_type).toBe("digest");
    expect(preview.runtime_output_preview.agent_metadata).toMatchObject({
      display_name: "Health Agent",
      preview_scope: "health_metadata",
      real_agent_logic_used: false,
    });
    expect(preview.runtime_output_preview.approval_metadata).toMatchObject({
      requires_approval: false,
      approval_status: "not_required",
      execution_enabled: false,
    });
  });

  it("rejects sensor, RuView, device, health scoring, medical, model, network, scheduler, inbox, and write requests", () => {
    for (const patch of [
      { real_sensor_requested: true },
      { ruview_integration_requested: true },
      { device_action_requested: true },
      { health_scoring_requested: true },
      { medical_advice_requested: true },
      { model_call_requested: true },
      { network_call_requested: true },
      { scheduler_requested: true },
      { inbox_write_requested: true },
      { write_requested: true },
    ]) {
      expect(() => previewHealthAgent({ ...baseInput(), ...patch })).toThrow();
    }
  });

  it("reports governance as preview-only with no sensor, device, model, or medical path", () => {
    const governance = previewHealthAgent(baseInput()).governance;

    expect(governance.preview_only).toBe(true);
    expect(governance.suggestion_only).toBe(true);
    expect(governance.execution_attempted).toBe(false);
    expect(governance.write_attempted).toBe(false);
    expect(governance.inbox_write_attempted).toBe(false);
    expect(governance.real_sensor_attempted).toBe(false);
    expect(governance.ruview_integration_attempted).toBe(false);
    expect(governance.device_action_attempted).toBe(false);
    expect(governance.health_scoring_attempted).toBe(false);
    expect(governance.medical_advice_attempted).toBe(false);
    expect(governance.model_call_attempted).toBe(false);
    expect(governance.network_call_attempted).toBe(false);
    expect(governance.scheduler_attempted).toBe(false);
  });

  it("has no scheduler, sensor integration, device action, provider, network, filesystem, or inbox imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/agent-runtime/health-agent-preview.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
    expect(source).not.toMatch(/fetch\s*\(|http|https|net\.|tls\./i);
    expect(source).not.toMatch(
      /RuViewClient|createRuView|sensorClient|deviceAdapter/i,
    );
    expect(source).not.toMatch(
      /createDeepSeek|createOllama|OpenAI|Anthropic|createModelRuntime/i,
    );
    expect(source).not.toMatch(/readFile|writeFile|appendFile|mkdir|rm\(/);
    expect(source).not.toMatch(/createSuggestion|SuggestionInboxItemSchema/);
    expect(source).not.toMatch(/executeTool|toolRegistry|deviceAction/i);
  });
});

function baseInput() {
  return {
    preview_version: HEALTH_AGENT_PREVIEW_VERSION,
    dry_run: healthAgentDryRun(),
    registry_entry: getAgentRegistryEntry("health_agent"),
    sensor_summaries: sensorFixture(),
    sleep_summary: {
      sleep_summary_id: "sleep:last-night",
      sleep_window_minutes: 360,
      target_sleep_window_minutes: 480,
      wake_interruptions: 2,
      self_reported_quality: "medium",
      medical_claim_made: false,
      metadata_only: true,
    },
    focus_summary: {
      focus_summary_id: "focus:today",
      focus_minutes: 150,
      interruption_count: 5,
      deep_work_block_count: 2,
      productivity_claim_made: false,
      metadata_only: true,
    },
    presence_summary: {
      presence_summary_id: "presence:today",
      present_minutes: 180,
      away_minutes: 240,
      room_state_claim_made: false,
      metadata_only: true,
    },
    generated_at: "2026-06-02T12:00:00.000Z",
    metadata_only: true,
    real_sensor_requested: false,
    ruview_integration_requested: false,
    device_action_requested: false,
    health_scoring_requested: false,
    medical_advice_requested: false,
    model_call_requested: false,
    network_call_requested: false,
    scheduler_requested: false,
    inbox_write_requested: false,
    write_requested: false,
  };
}

function healthAgentDryRun() {
  const entry = getAgentRegistryEntry("health_agent");
  return executeAgentDryRun({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    plan: planAgentRun({
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
    }),
    registry_entry: entry,
    fixture_metadata: {
      fixture_id: "fixture:health.agent.preview",
      fixture_hash: HASH,
      metadata_record_count: 4,
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

function sensorFixture(): HealthSensorSummary[] {
  const refs = getAgentRegistryEntry("health_agent").declared_sources.map(
    (source) => sourceRef(source.source_kind, source.source_id),
  );
  return [
    {
      sensor_summary_id: "sensor:desk-presence",
      source_label: "Synthetic desk presence summary",
      ruview_style: true,
      real_sensor_connected: false,
      presence_minutes: 180,
      movement_signal_count: 16,
      device_action_available: false,
      evidence_refs: [refs[0]],
      raw_sensor_payload_included: false,
      metadata_only: true,
    },
    {
      sensor_summary_id: "sensor:manual-focus",
      source_label: "Synthetic manual focus summary",
      ruview_style: true,
      real_sensor_connected: false,
      presence_minutes: 90,
      movement_signal_count: 5,
      device_action_available: false,
      evidence_refs: [refs[1]],
      raw_sensor_payload_included: false,
      metadata_only: true,
    },
  ];
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
