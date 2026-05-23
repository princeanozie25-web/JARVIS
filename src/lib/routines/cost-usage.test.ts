import { describe, expect, it } from "vitest";

import {
  CostUsageInputEventSchema,
  CostUsageTelemetryEventSchema,
  aggregateCostUsage,
  createCostUsageTelemetryEvent,
  type CostUsageAggregationWindow,
  type CostUsageInputEvent,
} from "./index";

function window(): CostUsageAggregationWindow {
  return {
    start_ms: 1000,
    end_ms: 2000,
    metadata_only: true,
  };
}

function event(
  overrides: Partial<CostUsageInputEvent> = {},
): CostUsageInputEvent {
  return {
    event_id_hash: "hash:event-1",
    provider: "alias:local",
    model: "hash:model-a",
    tier: "alias:standard",
    observed_at_ms: 1500,
    estimated_cost: 0.1,
    request_count: 1,
    input_token_bin: "1_1k",
    output_token_bin: "1_1k",
    latency_band: "1s_5s",
    budget_remaining_estimate: 9.9,
    redaction_status: "metadata_only",
    truncated: false,
    metadata_only: true,
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
    ...overrides,
  };
}

describe("Phase 8D.1 cost and usage aggregator scaffold", () => {
  it("aggregates metadata-only cost events correctly", () => {
    const aggregate = aggregateCostUsage({
      window: window(),
      events: [
        event({ estimated_cost: 0.1, provider: "alias:local" }),
        event({
          event_id_hash: "hash:event-2",
          estimated_cost: 0.25,
          provider: "alias:remote",
          request_count: 2,
          input_token_bin: "10k_100k",
          output_token_bin: "1k_10k",
          latency_band: "5s_30s",
          budget_remaining_estimate: 8.5,
        }),
      ],
    });

    expect(aggregate).toMatchObject({
      estimated_cost_total: 0.35,
      request_count: 3,
      input_token_bin: "10k_100k",
      output_token_bin: "1k_10k",
      budget_remaining_estimate: 8.5,
      provider_count: 2,
      model_count: 1,
      tier_count: 1,
      event_count: 2,
      metadata_only: true,
      raw_prompt_included: false,
      provider_called: false,
    });
    expect(aggregate.estimated_cost_by_provider).toEqual([
      {
        provider: "alias:local",
        estimated_cost_total: 0.1,
        request_count: 1,
      },
      {
        provider: "alias:remote",
        estimated_cost_total: 0.25,
        request_count: 2,
      },
    ]);
    expect(
      aggregate.latency_band_counts.find((item) => item.band === "5s_30s"),
    ).toMatchObject({ count: 1 });
  });

  it("requires provider, model, and tier values to be aliases or hashes only", () => {
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        provider: "openai",
      }).success,
    ).toBe(false);
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        model: "gpt-real-name",
      }).success,
    ).toBe(false);
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        tier: "enterprise-secret-tier",
      }).success,
    ).toBe(false);
  });

  it("rejects raw prompts, responses, and content", () => {
    for (const field of ["raw_prompt", "raw_response", "content"]) {
      expect(
        CostUsageInputEventSchema.safeParse({
          ...event(),
          [field]: "private text",
        }).success,
      ).toBe(false);
    }
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        raw_prompt_included: true,
      }).success,
    ).toBe(false);
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        raw_response_included: true,
      }).success,
    ).toBe(false);
  });

  it("rejects API keys and secrets", () => {
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        api_key: "sk-secret",
      }).success,
    ).toBe(false);
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        secrets_included: true,
      }).success,
    ).toBe(false);
    expect(
      CostUsageInputEventSchema.safeParse({
        ...event(),
        api_key_included: true,
      }).success,
    ).toBe(false);
  });

  it("propagates truncated input to aggregate truncated=true", () => {
    const aggregate = aggregateCostUsage({
      window: window(),
      events: [
        event({
          truncated: true,
          redaction_status: "redacted",
        }),
      ],
    });

    expect(aggregate).toMatchObject({
      truncated: true,
      redaction_status: "redacted",
    });
  });

  it("returns a safe zero aggregate for an empty event set", () => {
    const aggregate = aggregateCostUsage({
      window: window(),
      events: [],
    });

    expect(aggregate).toMatchObject({
      estimated_cost_total: 0,
      estimated_cost_by_provider: [],
      request_count: 0,
      input_token_bin: "none",
      output_token_bin: "none",
      budget_remaining_estimate: null,
      provider_count: 0,
      model_count: 0,
      tier_count: 0,
      event_count: 0,
      truncated: false,
      metadata_only: true,
      db_read_performed: false,
      network_called: false,
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const aggregate = aggregateCostUsage({
      window: window(),
      events: [event()],
    });
    const telemetry = createCostUsageTelemetryEvent(aggregate);

    expect(telemetry).toEqual({
      event_type: "cost_usage_aggregated",
      event_count: 1,
      provider_count: 1,
      request_count: 1,
      truncated: false,
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
    expect(
      CostUsageTelemetryEventSchema.safeParse({
        ...telemetry,
        db_read_performed: true,
        provider_called: true,
        network_called: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, provider, network, tool, action, write, or execution paths", () => {
    const aggregate = aggregateCostUsage({
      window: window(),
      events: [event()],
    });

    expect({
      dbRead: aggregate.db_read_performed,
      dbWrite: aggregate.db_write_performed,
      providerCalled: aggregate.provider_called,
      llmCalled: aggregate.llm_called,
      networkCalled: aggregate.network_called,
      cloudCalled: aggregate.cloud_called,
      toolCalled: aggregate.tool_called,
      actionExecuted: aggregate.action_executed,
      approvalTriggered: aggregate.approval_triggered,
      mutationPerformed: aggregate.mutation_performed,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalTriggered: false,
      mutationPerformed: false,
    });
  });
});
