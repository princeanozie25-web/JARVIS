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

export const COST_MONITOR_PREVIEW_VERSION =
  "phase21h.cost-monitor-preview.v1" as const;

export const COST_BUDGET_POSTURES = [
  "under_budget",
  "watch",
  "near_limit",
  "over_budget",
] as const;

export const COST_RISK_CLASSIFICATIONS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const COST_OPTIMIZATION_ACTIONS = [
  "monitor",
  "review_model_mix",
  "prefer_local_model",
  "cap_cloud_usage",
  "manual_budget_review",
] as const;

export const COST_MONITOR_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_real_telemetry_reads",
  "no_database_access",
  "no_model_calls",
  "no_provider_calls",
  "no_network_calls",
  "no_inbox_write",
  "suggestion_only",
] as const;

const CostIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const CostTextSchema = z.string().trim().min(1).max(360);

export const CostBudgetPostureSchema = z.enum(COST_BUDGET_POSTURES);
export const CostRiskClassificationSchema = z.enum(COST_RISK_CLASSIFICATIONS);
export const CostOptimizationActionSchema = z.enum(COST_OPTIMIZATION_ACTIONS);
export const CostMonitorCaveatSchema = z.enum(COST_MONITOR_CAVEATS);

export const CostModelUsageMetadataSchema = z.strictObject({
  usage_id: CostIdSchema,
  model_id: CostIdSchema,
  provider: CostIdSchema,
  call_count: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  estimated_cost_cents: z.number().int().nonnegative(),
  cloud_model: z.boolean(),
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_prompt_included: z.literal(false),
  raw_response_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CostSpendMetadataSchema = z.strictObject({
  spend_id: CostIdSchema,
  period_label: CostTextSchema,
  budget_limit_cents: z.number().int().positive(),
  current_spend_cents: z.number().int().nonnegative(),
  elapsed_percent: z.number().int().min(1).max(100),
  metered_cloud_spend_cents: z.number().int().nonnegative(),
  local_runtime_cost_cents: z.number().int().nonnegative(),
  raw_billing_payload_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CostMonitorPreviewInputSchema = z.strictObject({
  preview_version: z.literal(COST_MONITOR_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  model_usage_metadata: z.array(CostModelUsageMetadataSchema).min(1),
  spend_metadata: CostSpendMetadataSchema,
  generated_at: z.string().trim().datetime({ offset: true }),
  metadata_only: z.literal(true),
  telemetry_read_requested: z.literal(false),
  database_access_requested: z.literal(false),
  model_call_requested: z.literal(false),
  provider_call_requested: z.literal(false),
  network_call_requested: z.literal(false),
  scheduler_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
  runtime_mutation_requested: z.literal(false),
});

export const CostModelUsageSummarySchema = z.strictObject({
  model_count: z.number().int().nonnegative(),
  total_call_count: z.number().int().nonnegative(),
  total_input_tokens: z.number().int().nonnegative(),
  total_output_tokens: z.number().int().nonnegative(),
  cloud_call_count: z.number().int().nonnegative(),
  highest_cost_model_id: CostIdSchema,
  estimated_cost_cents: z.number().int().nonnegative(),
  raw_prompt_included: z.literal(false),
  raw_response_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CostSpendSummarySchema = z.strictObject({
  period_label: CostTextSchema,
  budget_limit_cents: z.number().int().positive(),
  current_spend_cents: z.number().int().nonnegative(),
  metered_cloud_spend_cents: z.number().int().nonnegative(),
  local_runtime_cost_cents: z.number().int().nonnegative(),
  budget_used_percent: z.number().int().nonnegative(),
  raw_billing_payload_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CostProjectedSpendMetadataSchema = z.strictObject({
  projected_period_spend_cents: z.number().int().nonnegative(),
  projected_budget_used_percent: z.number().int().nonnegative(),
  projection_basis: z.literal("fixture_elapsed_percent"),
  metadata_only: z.literal(true),
});

export const CostOptimizationSuggestionSchema = z.strictObject({
  action: CostOptimizationActionSchema,
  reason: CostTextSchema,
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const CostMonitorPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  telemetry_read_attempted: z.literal(false),
  database_access_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduler_attempted: z.literal(false),
  runtime_mutation_attempted: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_response_included: z.literal(false),
  raw_billing_payload_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const CostMonitorPreviewSchema = z.strictObject({
  kind: z.literal("cost_monitor.cost_posture_preview"),
  preview_version: z.literal(COST_MONITOR_PREVIEW_VERSION),
  agent_id: z.literal("cost_monitor"),
  agent_name: z.literal("Cost Monitor"),
  cost_monitor_preview: z.strictObject({
    title: CostTextSchema,
    summary: CostTextSchema,
    model_usage_summary: CostModelUsageSummarySchema,
    spend_summary: CostSpendSummarySchema,
    projected_spend_metadata: CostProjectedSpendMetadataSchema,
    budget_posture: CostBudgetPostureSchema,
    risk_classification: CostRiskClassificationSchema,
    suggested_optimization_actions: z.array(CostOptimizationSuggestionSchema),
    caveats: z.array(CostMonitorCaveatSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  governance: CostMonitorPreviewGovernanceSchema,
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type CostModelUsageMetadata = z.infer<
  typeof CostModelUsageMetadataSchema
>;
export type CostMonitorPreview = z.infer<typeof CostMonitorPreviewSchema>;
export type CostMonitorPreviewInput = z.infer<
  typeof CostMonitorPreviewInputSchema
>;

export function previewCostMonitor(input: unknown): CostMonitorPreview {
  const parsed = CostMonitorPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "cost_monitor") {
    throw new Error(
      "Cost Monitor preview requires the cost_monitor registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "cost_monitor") {
    throw new Error("Cost Monitor preview requires a cost_monitor dry-run.");
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Cost Monitor preview requires a planned dry-run.");
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
  const modelUsageSummary = modelUsageSummaryFor(parsed.model_usage_metadata);
  const spendSummary = spendSummaryFor(parsed.spend_metadata);
  const projectedSpend = projectedSpendFor(parsed.spend_metadata);
  const budgetPosture = budgetPostureFor(projectedSpend);
  const riskClassification = riskFor(budgetPosture);

  return CostMonitorPreviewSchema.parse({
    kind: "cost_monitor.cost_posture_preview",
    preview_version: COST_MONITOR_PREVIEW_VERSION,
    agent_id: "cost_monitor",
    agent_name: "Cost Monitor",
    cost_monitor_preview: {
      title: "Cost Monitor posture preview",
      summary: summaryFor(spendSummary, projectedSpend, budgetPosture),
      model_usage_summary: modelUsageSummary,
      spend_summary: spendSummary,
      projected_spend_metadata: projectedSpend,
      budget_posture: budgetPosture,
      risk_classification: riskClassification,
      suggested_optimization_actions: suggestionsFor(
        budgetPosture,
        modelUsageSummary,
      ),
      caveats: [
        "metadata_only",
        "fixture_metadata_only",
        "no_real_telemetry_reads",
        "no_database_access",
        "no_model_calls",
        "no_provider_calls",
        "no_network_calls",
        "no_inbox_write",
        "suggestion_only",
      ],
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

function modelUsageSummaryFor(
  usage: readonly CostModelUsageMetadata[],
): z.infer<typeof CostModelUsageSummarySchema> {
  const highestCost = [...usage].sort(
    (left, right) => right.estimated_cost_cents - left.estimated_cost_cents,
  )[0];
  return CostModelUsageSummarySchema.parse({
    model_count: usage.length,
    total_call_count: usage.reduce((sum, item) => sum + item.call_count, 0),
    total_input_tokens: usage.reduce((sum, item) => sum + item.input_tokens, 0),
    total_output_tokens: usage.reduce(
      (sum, item) => sum + item.output_tokens,
      0,
    ),
    cloud_call_count: usage
      .filter((item) => item.cloud_model)
      .reduce((sum, item) => sum + item.call_count, 0),
    highest_cost_model_id: highestCost.model_id,
    estimated_cost_cents: usage.reduce(
      (sum, item) => sum + item.estimated_cost_cents,
      0,
    ),
    raw_prompt_included: false,
    raw_response_included: false,
    metadata_only: true,
  });
}

function spendSummaryFor(
  spend: z.infer<typeof CostSpendMetadataSchema>,
): z.infer<typeof CostSpendSummarySchema> {
  return CostSpendSummarySchema.parse({
    period_label: spend.period_label,
    budget_limit_cents: spend.budget_limit_cents,
    current_spend_cents: spend.current_spend_cents,
    metered_cloud_spend_cents: spend.metered_cloud_spend_cents,
    local_runtime_cost_cents: spend.local_runtime_cost_cents,
    budget_used_percent: percent(
      spend.current_spend_cents,
      spend.budget_limit_cents,
    ),
    raw_billing_payload_included: false,
    metadata_only: true,
  });
}

function projectedSpendFor(
  spend: z.infer<typeof CostSpendMetadataSchema>,
): z.infer<typeof CostProjectedSpendMetadataSchema> {
  const projected = Math.round(
    spend.current_spend_cents / (spend.elapsed_percent / 100),
  );
  return CostProjectedSpendMetadataSchema.parse({
    projected_period_spend_cents: projected,
    projected_budget_used_percent: percent(projected, spend.budget_limit_cents),
    projection_basis: "fixture_elapsed_percent",
    metadata_only: true,
  });
}

function budgetPostureFor(
  projection: z.infer<typeof CostProjectedSpendMetadataSchema>,
): z.infer<typeof CostBudgetPostureSchema> {
  if (projection.projected_budget_used_percent >= 100) return "over_budget";
  if (projection.projected_budget_used_percent >= 85) return "near_limit";
  if (projection.projected_budget_used_percent >= 65) return "watch";
  return "under_budget";
}

function riskFor(
  posture: z.infer<typeof CostBudgetPostureSchema>,
): z.infer<typeof CostRiskClassificationSchema> {
  return {
    under_budget: "low",
    watch: "medium",
    near_limit: "high",
    over_budget: "critical",
  }[posture] as z.infer<typeof CostRiskClassificationSchema>;
}

function suggestionsFor(
  posture: z.infer<typeof CostBudgetPostureSchema>,
  modelUsage: z.infer<typeof CostModelUsageSummarySchema>,
) {
  const suggestions: z.infer<typeof CostOptimizationSuggestionSchema>[] = [];
  if (posture === "under_budget") {
    suggestions.push(
      suggestion(
        "monitor",
        "Spend posture is within the fixture budget envelope.",
      ),
    );
  } else {
    suggestions.push(
      suggestion(
        "review_model_mix",
        `${modelUsage.highest_cost_model_id} is the highest-cost fixture model.`,
      ),
    );
  }
  if (modelUsage.cloud_call_count > 0 && posture !== "under_budget") {
    suggestions.push(
      suggestion(
        "prefer_local_model",
        "Fixture cloud usage is present while projected spend needs attention.",
      ),
    );
  }
  if (posture === "near_limit") {
    suggestions.push(
      suggestion(
        "cap_cloud_usage",
        "Projected spend is near the fixture budget limit.",
      ),
    );
  }
  if (posture === "over_budget") {
    suggestions.push(
      suggestion(
        "manual_budget_review",
        "Projected spend exceeds the fixture budget.",
      ),
    );
  }
  return suggestions;
}

function suggestion(
  action: z.infer<typeof CostOptimizationActionSchema>,
  reason: string,
) {
  return CostOptimizationSuggestionSchema.parse({
    action,
    reason,
    suggestion_only: true,
    execution_attempted: false,
    metadata_only: true,
  });
}

function summaryFor(
  spend: z.infer<typeof CostSpendSummarySchema>,
  projection: z.infer<typeof CostProjectedSpendMetadataSchema>,
  posture: z.infer<typeof CostBudgetPostureSchema>,
) {
  return `${spend.period_label} fixture spend is ${spend.budget_used_percent}% used with projected ${projection.projected_budget_used_percent}% budget use and ${posture} posture.`;
}

function percent(numerator: number, denominator: number) {
  return Math.round((numerator / denominator) * 100);
}

function governanceSummary() {
  return CostMonitorPreviewGovernanceSchema.parse({
    preview_only: true,
    suggestion_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    telemetry_read_attempted: false,
    database_access_attempted: false,
    model_call_attempted: false,
    provider_call_attempted: false,
    network_call_attempted: false,
    scheduler_attempted: false,
    runtime_mutation_attempted: false,
    raw_prompt_included: false,
    raw_response_included: false,
    raw_billing_payload_included: false,
    metadata_only: true,
  });
}
