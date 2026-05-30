import { describe, expect, it } from "vitest";

import {
  filterTelemetryCockpitPanelsByHealth,
  getTelemetryCockpitAlertsForPanel,
  getTelemetryCockpitMetricsForPanel,
  getTelemetryCockpitPanelById,
  getTelemetryCockpitPanelsByKind,
  getTelemetryCockpitWarningsForPanel,
  listTelemetryCockpitPanelKinds,
  summarizeTelemetryCockpitPanel,
} from "./index";

describe("Phase 19B.2 telemetry cockpit query helpers", () => {
  it("lists panel kinds in deterministic order", () => {
    expect(listTelemetryCockpitPanelKinds()).toEqual([
      "model_runtime",
      "router",
      "costs",
      "approval_runtime",
      "scheduler",
      "vision_runtime",
      "voice_runtime",
      "room_runtime",
      "event_store",
      "architecture_graph",
      "safety_governance",
    ]);
  });

  it("gets panels and metrics by id and kind", () => {
    expect(getTelemetryCockpitPanelById("telemetry-panel:costs")).toMatchObject(
      {
        panel_id: "telemetry-panel:costs",
        kind: "costs",
        title: "Costs",
        metadata_only: true,
        read_only: true,
      },
    );
    expect(getTelemetryCockpitPanelsByKind("architecture_graph")).toHaveLength(
      1,
    );
    expect(
      getTelemetryCockpitMetricsForPanel("telemetry-panel:architecture_graph"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric_id: "telemetry-metric:architecture_graph:node-count",
          kind: "counts",
          label: "Graph nodes",
        }),
      ]),
    );
  });

  it("gets alerts and warnings for a panel", () => {
    expect(
      getTelemetryCockpitAlertsForPanel("telemetry-panel:safety_governance"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alert_id: "telemetry-alert:safety_governance:read-only-posture",
          metadata_only: true,
          read_only: true,
        }),
      ]),
    );
    expect(
      getTelemetryCockpitWarningsForPanel("telemetry-panel:event_store"),
    ).toEqual([
      expect.objectContaining({
        warning_id: "telemetry-warning:event_store:no-direct-store-read",
        metadata_only: true,
        read_only: true,
      }),
    ]);
  });

  it("summarizes a panel without inferring execution capability", () => {
    expect(
      summarizeTelemetryCockpitPanel("telemetry-panel:safety_governance"),
    ).toEqual({
      panel_id: "telemetry-panel:safety_governance",
      kind: "safety_governance",
      title: "Safety/Governance",
      health_band: "unknown",
      time_window: "latest_metadata",
      metric_count: 4,
      alert_count: 1,
      warning_count: 0,
      source_ref_count: 1,
      metadata_only: true,
      read_only: true,
      execution_inferred: false,
      authority_surface_created: false,
    });
  });

  it("filters by health band", () => {
    expect(
      filterTelemetryCockpitPanelsByHealth("nominal").map(
        (panel) => panel.kind,
      ),
    ).toEqual(["event_store"]);
    expect(filterTelemetryCockpitPanelsByHealth("healthy")).toEqual([]);
  });

  it("fails closed for unknown ids, kinds, and health bands", () => {
    expect(getTelemetryCockpitPanelById("telemetry-panel:missing")).toBeNull();
    expect(getTelemetryCockpitPanelById("not-a-panel")).toBeNull();
    expect(getTelemetryCockpitPanelsByKind("missing")).toEqual([]);
    expect(
      getTelemetryCockpitMetricsForPanel("telemetry-panel:missing"),
    ).toEqual([]);
    expect(
      getTelemetryCockpitAlertsForPanel("telemetry-panel:missing"),
    ).toEqual([]);
    expect(
      getTelemetryCockpitWarningsForPanel("telemetry-panel:missing"),
    ).toEqual([]);
    expect(
      summarizeTelemetryCockpitPanel("telemetry-panel:missing"),
    ).toBeNull();
    expect(filterTelemetryCockpitPanelsByHealth("critical")).toEqual([]);
  });

  it("returns defensive-copy-safe data", () => {
    const panel = getTelemetryCockpitPanelById("telemetry-panel:costs");
    const metrics = getTelemetryCockpitMetricsForPanel("telemetry-panel:costs");
    const summary = summarizeTelemetryCockpitPanel("telemetry-panel:costs");

    if (!panel || !summary) {
      throw new Error("expected costs panel query results");
    }
    panel.title = "Mutated Panel";
    metrics[0].label = "Mutated Metric";
    summary.title = "Mutated Summary";

    expect(getTelemetryCockpitPanelById("telemetry-panel:costs")).toMatchObject(
      {
        title: "Costs",
      },
    );
    expect(
      getTelemetryCockpitMetricsForPanel("telemetry-panel:costs")[0],
    ).toMatchObject({
      label: "Cost band",
    });
    expect(
      summarizeTelemetryCockpitPanel("telemetry-panel:costs"),
    ).toMatchObject({
      title: "Costs",
    });
  });
});
