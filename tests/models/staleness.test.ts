import { describe, expect, it } from "vitest";

import {
  evaluateModelRegistryStaleness,
  type ModelRegistryEntry,
} from "../../src/models";

function entry(
  overrides: Partial<ModelRegistryEntry> = {},
): ModelRegistryEntry {
  return {
    id: "deepseek-v3",
    provider: "deepseek",
    tier: "T2",
    runtime_class: "cloud",
    capabilities: ["chat", "summarize", "classify", "tool_reasoning"],
    context_window: 128000,
    visibility: "enabled",
    priority: 10,
    supports_streaming: true,
    supports_tools: true,
    supports_vision: false,
    metadata: {
      display_name: "DeepSeek V3",
      description: "Fixture model metadata.",
      approximate_memory_mb: null,
      cost_class: "cloud_metered",
      governance_notes: "Fixture only; no provider calls.",
    },
    ...overrides,
  };
}

function rowFor(overrides: Partial<ModelRegistryEntry>, now = "2026-06-24") {
  return evaluateModelRegistryStaleness([entry(overrides)], now).rows[0];
}

describe("Phase 21A model registry EOL staleness check", () => {
  it("marks past EOL dates as RETIRED", () => {
    expect(rowFor({ eol_date: "2026-06-01" })).toMatchObject({
      status: "RETIRED",
      daysRemaining: -23,
    });
  });

  it("marks EOL dates within 30 days as EOL_SOON", () => {
    expect(rowFor({ eol_date: "2026-07-24" })).toMatchObject({
      status: "EOL_SOON",
      daysRemaining: 30,
    });
  });

  it("marks EOL dates 120 days out as OK", () => {
    expect(rowFor({ eol_date: "2026-10-22" })).toMatchObject({
      status: "OK",
      daysRemaining: 120,
    });
  });

  it("marks models without EOL metadata as UNKNOWN without throwing", () => {
    expect(rowFor({})).toMatchObject({
      status: "UNKNOWN",
      eol_date: null,
      daysRemaining: null,
    });
  });

  it("does not flag disabled models even when their EOL date is in the past", () => {
    expect(
      rowFor({ visibility: "disabled", eol_date: "2026-06-01" }),
    ).toMatchObject({
      status: "UNKNOWN",
      eol_date: "2026-06-01",
      daysRemaining: null,
    });
  });

  it("includes replacement_id in the report row when configured", () => {
    const report = evaluateModelRegistryStaleness(
      [
        entry({
          eol_date: "2026-07-24",
          replacement_id: "deepseek-v4-flash",
        }),
      ],
      "2026-06-24",
    );

    expect(report.rows[0]).toMatchObject({
      replacement_id: "deepseek-v4-flash",
    });
    expect(report.summary).toContain("deepseek-v3 -> deepseek-v4-flash");
  });

  it("uses injected now for deterministic date math", () => {
    const entries = [entry({ eol_date: "2026-07-24" })];

    expect(
      evaluateModelRegistryStaleness(entries, "2026-06-24").rows[0]
        .daysRemaining,
    ).toBe(30);
    expect(
      evaluateModelRegistryStaleness(entries, "2026-07-25").rows[0]
        .daysRemaining,
    ).toBe(-1);
  });

  it("declares read-only local metadata posture", () => {
    expect(evaluateModelRegistryStaleness([], "2026-06-24")).toMatchObject({
      metadata_only: true,
      read_only: true,
      deterministic: true,
      registry_mutation_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      router_mutation_enabled: false,
      runtime_mutation_enabled: false,
    });
  });
});
