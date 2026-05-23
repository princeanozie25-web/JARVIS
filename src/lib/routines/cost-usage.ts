import { z } from "zod";

export const COST_USAGE_TOKEN_BINS = [
  "none",
  "1_1k",
  "1k_10k",
  "10k_100k",
  "100k_plus",
] as const;

export const COST_USAGE_LATENCY_BANDS = [
  "unknown",
  "lt_1s",
  "1s_5s",
  "5s_30s",
  "30s_plus",
] as const;

export const COST_USAGE_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export const COST_USAGE_TELEMETRY_EVENT_TYPES = [
  "cost_usage_aggregated",
] as const;

export type CostUsageTokenBin = (typeof COST_USAGE_TOKEN_BINS)[number];
export type CostUsageLatencyBand = (typeof COST_USAGE_LATENCY_BANDS)[number];
export type CostUsageRedactionStatus =
  (typeof COST_USAGE_REDACTION_STATUSES)[number];
export type CostUsageTelemetryEventType =
  (typeof COST_USAGE_TELEMETRY_EVENT_TYPES)[number];

const AliasOrHashSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^(alias|hash):[a-z0-9._:-]+$/);

const CostByProviderEntrySchema = z.strictObject({
  provider: AliasOrHashSchema,
  estimated_cost_total: z.number().nonnegative(),
  request_count: z.number().int().nonnegative(),
});

const LatencyBandCountSchema = z.strictObject({
  band: z.enum(COST_USAGE_LATENCY_BANDS),
  count: z.number().int().nonnegative(),
});

export const CostUsageTokenBinSchema = z.enum(COST_USAGE_TOKEN_BINS);
export const CostUsageLatencyBandSchema = z.enum(COST_USAGE_LATENCY_BANDS);
export const CostUsageRedactionStatusSchema = z.enum(
  COST_USAGE_REDACTION_STATUSES,
);
export const CostUsageTelemetryEventTypeSchema = z.enum(
  COST_USAGE_TELEMETRY_EVENT_TYPES,
);

export const CostUsageAggregationWindowSchema = z
  .strictObject({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
  })
  .refine((window) => window.end_ms >= window.start_ms, {
    message:
      "cost usage aggregation window end must be greater than or equal to start",
  });

export const CostUsageInputEventSchema = z.strictObject({
  event_id_hash: AliasOrHashSchema,
  provider: AliasOrHashSchema,
  model: AliasOrHashSchema,
  tier: AliasOrHashSchema,
  observed_at_ms: z.number().int().nonnegative(),
  estimated_cost: z.number().nonnegative(),
  request_count: z.number().int().nonnegative(),
  input_token_bin: CostUsageTokenBinSchema,
  output_token_bin: CostUsageTokenBinSchema,
  latency_band: CostUsageLatencyBandSchema,
  budget_remaining_estimate: z.number().nonnegative().nullable(),
  redaction_status: CostUsageRedactionStatusSchema,
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  raw_prompt_included: z.literal(false),
  raw_response_included: z.literal(false),
  raw_content_included: z.literal(false),
  secrets_included: z.literal(false),
  api_key_included: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  mutation_performed: z.literal(false),
});

export const CostUsageAggregateSchema = z.strictObject({
  window: CostUsageAggregationWindowSchema,
  estimated_cost_total: z.number().nonnegative(),
  estimated_cost_by_provider: z.array(CostByProviderEntrySchema),
  request_count: z.number().int().nonnegative(),
  input_token_bin: CostUsageTokenBinSchema,
  output_token_bin: CostUsageTokenBinSchema,
  latency_band_counts: z.array(LatencyBandCountSchema),
  budget_remaining_estimate: z.number().nonnegative().nullable(),
  provider_count: z.number().int().nonnegative(),
  model_count: z.number().int().nonnegative(),
  tier_count: z.number().int().nonnegative(),
  event_count: z.number().int().nonnegative(),
  redaction_status: CostUsageRedactionStatusSchema,
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_prompt_included: z.literal(false),
  raw_response_included: z.literal(false),
  raw_content_included: z.literal(false),
  secrets_included: z.literal(false),
  api_key_included: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  mutation_performed: z.literal(false),
});

export const CostUsageTelemetryEventSchema = z.strictObject({
  event_type: CostUsageTelemetryEventTypeSchema,
  event_count: z.number().int().nonnegative(),
  provider_count: z.number().int().nonnegative(),
  request_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  mutation_performed: z.literal(false),
});

export type CostUsageAggregationWindow = z.infer<
  typeof CostUsageAggregationWindowSchema
>;
export type CostUsageInputEvent = z.infer<typeof CostUsageInputEventSchema>;
export type CostUsageAggregate = z.infer<typeof CostUsageAggregateSchema>;
export type CostUsageTelemetryEvent = z.infer<
  typeof CostUsageTelemetryEventSchema
>;

function maxTokenBin(values: CostUsageTokenBin[]): CostUsageTokenBin {
  const rank = new Map<CostUsageTokenBin, number>(
    COST_USAGE_TOKEN_BINS.map((bin, index) => [bin, index]),
  );
  return values.reduce<CostUsageTokenBin>(
    (max, value) => (rank.get(value)! > rank.get(max)! ? value : max),
    "none",
  );
}

function latencyBandCounts(events: CostUsageInputEvent[]) {
  return COST_USAGE_LATENCY_BANDS.map((band) => ({
    band,
    count: events.filter((event) => event.latency_band === band).length,
  }));
}

function aggregateByProvider(events: CostUsageInputEvent[]) {
  const providerMap = new Map<
    string,
    { estimated_cost_total: number; request_count: number }
  >();

  for (const event of events) {
    const current = providerMap.get(event.provider) ?? {
      estimated_cost_total: 0,
      request_count: 0,
    };
    providerMap.set(event.provider, {
      estimated_cost_total: current.estimated_cost_total + event.estimated_cost,
      request_count: current.request_count + event.request_count,
    });
  }

  return [...providerMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([provider, value]) => ({
      provider,
      estimated_cost_total: value.estimated_cost_total,
      request_count: value.request_count,
    }));
}

export function aggregateCostUsage(input: {
  window: CostUsageAggregationWindow;
  events: CostUsageInputEvent[];
}): CostUsageAggregate {
  const window = CostUsageAggregationWindowSchema.parse(input.window);
  const events = input.events.map((event) =>
    CostUsageInputEventSchema.parse(event),
  );
  const providers = new Set(events.map((event) => event.provider));
  const models = new Set(events.map((event) => event.model));
  const tiers = new Set(events.map((event) => event.tier));
  const budgetEstimates = events
    .map((event) => event.budget_remaining_estimate)
    .filter((value): value is number => value !== null);

  return CostUsageAggregateSchema.parse({
    window,
    estimated_cost_total: events.reduce(
      (total, event) => total + event.estimated_cost,
      0,
    ),
    estimated_cost_by_provider: aggregateByProvider(events),
    request_count: events.reduce(
      (total, event) => total + event.request_count,
      0,
    ),
    input_token_bin: maxTokenBin(events.map((event) => event.input_token_bin)),
    output_token_bin: maxTokenBin(
      events.map((event) => event.output_token_bin),
    ),
    latency_band_counts: latencyBandCounts(events),
    budget_remaining_estimate:
      budgetEstimates.length > 0 ? Math.min(...budgetEstimates) : null,
    provider_count: providers.size,
    model_count: models.size,
    tier_count: tiers.size,
    event_count: events.length,
    redaction_status: events.some(
      (event) => event.redaction_status === "redacted",
    )
      ? "redacted"
      : "metadata_only",
    truncated: events.some((event) => event.truncated),
    metadata_only: true,
    counts_and_flags_only: true,
    raw_prompt_included: false,
    raw_response_included: false,
    raw_content_included: false,
    secrets_included: false,
    api_key_included: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    mutation_performed: false,
  });
}

export function createCostUsageTelemetryEvent(
  aggregateInput: CostUsageAggregate,
): CostUsageTelemetryEvent {
  const aggregate = CostUsageAggregateSchema.parse(aggregateInput);
  return CostUsageTelemetryEventSchema.parse({
    event_type: "cost_usage_aggregated",
    event_count: aggregate.event_count,
    provider_count: aggregate.provider_count,
    request_count: aggregate.request_count,
    truncated: aggregate.truncated,
    metadata_only: true,
    counts_and_flags_only: true,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    mutation_performed: false,
  });
}
