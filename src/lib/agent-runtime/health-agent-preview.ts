import { z } from "zod";
import {
  AgentOutputSourceReferenceSchema,
  AgentSuggestionInboxTargetSchema,
} from "./contract";
import { AgentDryRunEnvelopeSchema } from "./dry-run-executor";
import {
  AGENT_OUTPUT_FACTORY_VERSION,
  AgentOutputPreviewSchema,
  createAgentOutputPreview,
} from "./output-factory";
import { AgentRegistryEntrySchema } from "./registry";

export const HEALTH_AGENT_PREVIEW_VERSION =
  "phase21h.health-agent-preview.v1" as const;

export const HEALTH_WELLNESS_INDICATORS = [
  "sleep_window_short",
  "focus_fragmented",
  "presence_low",
  "recovery_window_available",
  "routine_stable",
] as const;

export const HEALTH_SUGGESTED_ACTIONS = [
  "monitor",
  "protect_sleep_window",
  "schedule_focus_block",
  "take_recovery_break",
  "manual_wellness_review",
] as const;

export const HEALTH_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_real_sensors",
  "no_ruview_integration",
  "no_device_actions",
  "no_health_scoring_claims",
  "no_medical_advice",
  "no_model_calls",
  "no_network_calls",
  "no_inbox_write",
] as const;

const HealthIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HealthTextSchema = z.string().trim().min(1).max(360);

export const HealthWellnessIndicatorSchema = z.enum(HEALTH_WELLNESS_INDICATORS);
export const HealthSuggestedActionSchema = z.enum(HEALTH_SUGGESTED_ACTIONS);
export const HealthPreviewCaveatSchema = z.enum(HEALTH_PREVIEW_CAVEATS);

export const HealthSensorSummarySchema = z.strictObject({
  sensor_summary_id: HealthIdSchema,
  source_label: HealthTextSchema,
  ruview_style: z.literal(true),
  real_sensor_connected: z.literal(false),
  presence_minutes: z.number().int().nonnegative(),
  movement_signal_count: z.number().int().nonnegative(),
  device_action_available: z.literal(false),
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_sensor_payload_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const HealthSleepSummarySchema = z.strictObject({
  sleep_summary_id: HealthIdSchema,
  sleep_window_minutes: z.number().int().nonnegative(),
  target_sleep_window_minutes: z.number().int().positive(),
  wake_interruptions: z.number().int().nonnegative(),
  self_reported_quality: z.enum(["low", "medium", "high", "unknown"]),
  medical_claim_made: z.literal(false),
  metadata_only: z.literal(true),
});

export const HealthFocusSummarySchema = z.strictObject({
  focus_summary_id: HealthIdSchema,
  focus_minutes: z.number().int().nonnegative(),
  interruption_count: z.number().int().nonnegative(),
  deep_work_block_count: z.number().int().nonnegative(),
  productivity_claim_made: z.literal(false),
  metadata_only: z.literal(true),
});

export const HealthPresenceSummarySchema = z.strictObject({
  presence_summary_id: HealthIdSchema,
  present_minutes: z.number().int().nonnegative(),
  away_minutes: z.number().int().nonnegative(),
  room_state_claim_made: z.literal(false),
  metadata_only: z.literal(true),
});

export const HealthAgentPreviewInputSchema = z.strictObject({
  preview_version: z.literal(HEALTH_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  sensor_summaries: z.array(HealthSensorSummarySchema).min(1),
  sleep_summary: HealthSleepSummarySchema,
  focus_summary: HealthFocusSummarySchema,
  presence_summary: HealthPresenceSummarySchema,
  generated_at: z.string().trim().datetime({ offset: true }),
  metadata_only: z.literal(true),
  real_sensor_requested: z.literal(false),
  ruview_integration_requested: z.literal(false),
  device_action_requested: z.literal(false),
  health_scoring_requested: z.literal(false),
  medical_advice_requested: z.literal(false),
  model_call_requested: z.literal(false),
  network_call_requested: z.literal(false),
  scheduler_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
});

export const HealthWellnessIndicatorResultSchema = z.strictObject({
  indicator: HealthWellnessIndicatorSchema,
  reason: HealthTextSchema,
  suggested_action: HealthSuggestedActionSchema,
  suggestion_only: z.literal(true),
  medical_advice: z.literal(false),
  health_score_generated: z.literal(false),
  metadata_only: z.literal(true),
});

export const HealthAgentPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  real_sensor_attempted: z.literal(false),
  ruview_integration_attempted: z.literal(false),
  device_action_attempted: z.literal(false),
  health_scoring_attempted: z.literal(false),
  medical_advice_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduler_attempted: z.literal(false),
  raw_sensor_payload_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const HealthAgentPreviewSchema = z.strictObject({
  kind: z.literal("health_agent.wellness_digest_preview"),
  preview_version: z.literal(HEALTH_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("health_agent"),
  agent_name: z.literal("Health Agent"),
  health_agent_preview: z.strictObject({
    title: HealthTextSchema,
    summary: HealthTextSchema,
    sleep_summary: HealthSleepSummarySchema,
    focus_summary: HealthFocusSummarySchema,
    presence_summary: HealthPresenceSummarySchema,
    sensor_summary_count: z.number().int().nonnegative(),
    wellness_indicators: z.array(HealthWellnessIndicatorResultSchema),
    evidence_refs: z.array(AgentOutputSourceReferenceSchema),
    caveats: z.array(HealthPreviewCaveatSchema),
    medical_advice: z.literal(false),
    health_score_generated: z.literal(false),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  governance: HealthAgentPreviewGovernanceSchema,
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type HealthSensorSummary = z.infer<typeof HealthSensorSummarySchema>;
export type HealthAgentPreview = z.infer<typeof HealthAgentPreviewSchema>;
export type HealthAgentPreviewInput = z.infer<
  typeof HealthAgentPreviewInputSchema
>;

export function previewHealthAgent(input: unknown): HealthAgentPreview {
  const parsed = HealthAgentPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "health_agent") {
    throw new Error(
      "Health Agent preview requires the health_agent registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "health_agent") {
    throw new Error("Health Agent preview requires a health_agent dry-run.");
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Health Agent preview requires a planned dry-run.");
  }

  const outputPreview = createAgentOutputPreview({
    factory_version: AGENT_OUTPUT_FACTORY_VERSION,
    dry_run: parsed.dry_run,
    registry_entry: parsed.registry_entry,
    fixture_metadata: parsed.dry_run.fixture_metadata,
    metadata_only: true,
    inbox_write_requested: false,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    model_call_requested: false,
  });
  const indicators = indicatorsFor(parsed);

  return HealthAgentPreviewSchema.parse({
    kind: "health_agent.wellness_digest_preview",
    preview_version: HEALTH_AGENT_PREVIEW_VERSION,
    agent_id: "health_agent",
    agent_name: "Health Agent",
    health_agent_preview: {
      title: "Health Agent wellness digest preview",
      summary: summaryFor(parsed, indicators.length),
      sleep_summary: parsed.sleep_summary,
      focus_summary: parsed.focus_summary,
      presence_summary: parsed.presence_summary,
      sensor_summary_count: parsed.sensor_summaries.length,
      wellness_indicators: indicators,
      evidence_refs: uniqueSources(
        parsed.sensor_summaries.flatMap((summary) => summary.evidence_refs),
      ),
      caveats: [
        "metadata_only",
        "fixture_metadata_only",
        "no_real_sensors",
        "no_ruview_integration",
        "no_device_actions",
        "no_health_scoring_claims",
        "no_medical_advice",
        "no_model_calls",
        "no_network_calls",
        "no_inbox_write",
      ],
      medical_advice: false,
      health_score_generated: false,
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    governance: governanceSummary(),
    preview_only: true,
    suggestion_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function indicatorsFor(
  input: z.infer<typeof HealthAgentPreviewInputSchema>,
): z.infer<typeof HealthWellnessIndicatorResultSchema>[] {
  const indicators: z.infer<typeof HealthWellnessIndicatorResultSchema>[] = [];
  if (
    input.sleep_summary.sleep_window_minutes <
    input.sleep_summary.target_sleep_window_minutes
  ) {
    indicators.push(
      indicator(
        "sleep_window_short",
        "Fixture sleep window is shorter than the supplied target window.",
        "protect_sleep_window",
      ),
    );
  }
  if (
    input.focus_summary.interruption_count >
    input.focus_summary.deep_work_block_count
  ) {
    indicators.push(
      indicator(
        "focus_fragmented",
        "Fixture interruption count exceeds deep-work block count.",
        "schedule_focus_block",
      ),
    );
  }
  if (
    input.presence_summary.present_minutes < input.presence_summary.away_minutes
  ) {
    indicators.push(
      indicator(
        "presence_low",
        "Fixture presence metadata shows more away time than present time.",
        "monitor",
      ),
    );
  }
  if (input.sleep_summary.wake_interruptions === 0) {
    indicators.push(
      indicator(
        "routine_stable",
        "Fixture sleep metadata reports no wake interruptions.",
        "monitor",
      ),
    );
  }
  if (
    input.focus_summary.focus_minutes >= 120 &&
    input.presence_summary.away_minutes >= 30
  ) {
    indicators.push(
      indicator(
        "recovery_window_available",
        "Fixture focus and away-time metadata suggest a recovery window is available.",
        "take_recovery_break",
      ),
    );
  }
  if (indicators.length === 0) {
    indicators.push(
      indicator(
        "routine_stable",
        "Fixture wellness metadata has no elevated preview indicators.",
        "monitor",
      ),
    );
  }
  return indicators;
}

function indicator(
  indicatorName: z.infer<typeof HealthWellnessIndicatorSchema>,
  reason: string,
  action: z.infer<typeof HealthSuggestedActionSchema>,
) {
  return HealthWellnessIndicatorResultSchema.parse({
    indicator: indicatorName,
    reason,
    suggested_action: action,
    suggestion_only: true,
    medical_advice: false,
    health_score_generated: false,
    metadata_only: true,
  });
}

function summaryFor(
  input: z.infer<typeof HealthAgentPreviewInputSchema>,
  indicatorCount: number,
) {
  return `Metadata-only Health Agent preview across ${input.sensor_summaries.length} sensor summaries with ${indicatorCount} fixture wellness indicator(s).`;
}

function uniqueSources(
  sources: readonly z.infer<typeof AgentOutputSourceReferenceSchema>[],
) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.source_kind}:${source.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function governanceSummary() {
  return HealthAgentPreviewGovernanceSchema.parse({
    preview_only: true,
    suggestion_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    real_sensor_attempted: false,
    ruview_integration_attempted: false,
    device_action_attempted: false,
    health_scoring_attempted: false,
    medical_advice_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    scheduler_attempted: false,
    raw_sensor_payload_included: false,
    metadata_only: true,
  });
}
