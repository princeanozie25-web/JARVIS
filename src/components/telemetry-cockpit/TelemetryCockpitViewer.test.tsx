import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TelemetryCockpitViewer,
  buildTelemetryCockpitViewerModel,
  filterTelemetryCockpitViewerPanels,
  selectTelemetryCockpitViewerPanel,
} from "./TelemetryCockpitViewer";

const COMPONENT_SOURCE =
  "src/components/telemetry-cockpit/TelemetryCockpitViewer.tsx";

function renderViewer() {
  return renderToStaticMarkup(<TelemetryCockpitViewer />);
}

function assertNoForbiddenAffordances(html: string) {
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<a\b/i);
  expect(html).not.toMatch(
    /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i,
  );
}

describe("Phase 19B.4 telemetry cockpit viewer inspection and filtering", () => {
  it("renders the read-only telemetry cockpit surface", () => {
    const html = renderViewer();

    expect(html).toContain('data-telemetry-cockpit-viewer="read-only"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-read-only="true"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Telemetry Cockpit");
    expect(html).toContain("Phase 19B visibility surface");
    expect(html).toContain("Search panels");
    expect(html).toContain("Panel kind");
    expect(html).toContain("Health band");
    assertNoForbiddenAffordances(html);
  });

  it("renders cockpit stats and projection data", () => {
    const html = renderViewer();

    expect(html).toContain("Panels");
    expect(html).toContain("11");
    expect(html).toContain("Metrics");
    expect(html).toContain("40");
    expect(html).toContain("Warnings");
    expect(html).toContain("2");
    expect(html).toContain("latest metadata");
    expect(html).toContain("Safety");
    expect(html).toContain("checked");
  });

  it("renders panel summaries, metrics, and health bands", () => {
    const html = renderViewer();

    expect(html).toContain("Model Runtime");
    expect(html).toContain("Router");
    expect(html).toContain("Costs");
    expect(html).toContain("Approval Runtime");
    expect(html).toContain("Architecture Graph");
    expect(html).toContain("Activity count band");
    expect(html).toContain("Latency band");
    expect(html).toContain("Health band");
    expect(html).toContain("unknown");
    expect(html).toContain("nominal");
  });

  it("renders the selected panel detail panel", () => {
    const html = renderViewer();

    expect(html).toContain('data-telemetry-panel-detail="read-only"');
    expect(html).toContain("Panel Inspection");
    expect(html).toContain("Panel id");
    expect(html).toContain("Panel kind");
    expect(html).toContain("Activity summary");
    expect(html).toContain("Disabled capabilities");
    expect(html).toContain("Inspect panel");
    assertNoForbiddenAffordances(html);
  });

  it("selected panel data exposes metrics, warnings, and alerts as metadata", () => {
    const model = buildTelemetryCockpitViewerModel();
    const eventStore = selectTelemetryCockpitViewerPanel(
      model.panels,
      "telemetry-panel:event_store",
    );
    const safety = selectTelemetryCockpitViewerPanel(
      model.panels,
      "telemetry-panel:safety_governance",
    );

    expect(eventStore?.metrics.map((metric) => metric.label)).toContain(
      "Activity count band",
    );
    expect(eventStore?.warnings.map((warning) => warning.label)).toContain(
      "Event Store panel uses projection metadata only",
    );
    expect(safety?.alerts.map((alert) => alert.label)).toContain(
      "Safety cockpit remains read-only",
    );
  });

  it("filters work without mutating the render model", () => {
    const model = buildTelemetryCockpitViewerModel();
    const before = JSON.stringify(model.panels);
    const filteredByKind = filterTelemetryCockpitViewerPanels(model.panels, {
      panelKind: "costs",
      healthBand: "all",
      showWarnings: true,
      showAlerts: true,
      search: "",
    });
    const filteredByHealth = filterTelemetryCockpitViewerPanels(model.panels, {
      panelKind: "all",
      healthBand: "nominal",
      showWarnings: true,
      showAlerts: true,
      search: "",
    });

    expect(filteredByKind).toHaveLength(1);
    expect(filteredByKind[0].panel.title).toBe("Costs");
    expect(filteredByHealth.map((item) => item.panel.title)).toEqual([
      "Event Store",
    ]);
    expect(JSON.stringify(model.panels)).toBe(before);
  });

  it("search works by panel label, id, and kind", () => {
    const model = buildTelemetryCockpitViewerModel();
    const byLabel = filterTelemetryCockpitViewerPanels(model.panels, {
      panelKind: "all",
      healthBand: "all",
      showWarnings: true,
      showAlerts: true,
      search: "Architecture Graph",
    });
    const byId = filterTelemetryCockpitViewerPanels(model.panels, {
      panelKind: "all",
      healthBand: "all",
      showWarnings: true,
      showAlerts: true,
      search: "telemetry-panel:event_store",
    });
    const byKind = filterTelemetryCockpitViewerPanels(model.panels, {
      panelKind: "all",
      healthBand: "all",
      showWarnings: true,
      showAlerts: true,
      search: "voice_runtime",
    });

    expect(byLabel.map((item) => item.panel.title)).toEqual([
      "Architecture Graph",
    ]);
    expect(byId.map((item) => item.panel.title)).toEqual(["Event Store"]);
    expect(byKind.map((item) => item.panel.title)).toEqual(["Voice Runtime"]);
  });

  it("renders warnings, alerts, and disabled capability indicators", () => {
    const html = renderViewer();

    expect(html).toContain("Cockpit Warnings");
    expect(html).toContain(
      "Phase 19B.1 uses deterministic projection metadata only",
    );
    expect(html).toContain("Event Store panel uses projection metadata only");
    expect(html).toContain("Safety cockpit remains read-only");
    expect(html).toContain("Execution");
    expect(html).toContain("off");
    expect(html).toContain("Authority");
    expect(html).toContain("none");
    expect(html).toContain("Show Warnings");
    expect(html).toContain("Show Alerts");
    assertNoForbiddenAffordances(html);
  });

  it("does not render raw payload fields or sensitive payload classes", () => {
    const html = renderViewer();

    expect(html).not.toMatch(
      /raw_payload|tool_args|tool_arguments|raw_prompt|prompt body|model output|voice transcript|transcript|ocr text|frame bytes|secret|api key|approval token/i,
    );
  });

  it("uses the telemetry cockpit safety guard before exposing the render model", () => {
    const model = buildTelemetryCockpitViewerModel();
    const source = readFileSync(COMPONENT_SOURCE, "utf8");

    expect(model.projection_safety_checked).toBe(true);
    expect(model.metadata_only).toBe(true);
    expect(model.read_only).toBe(true);
    expect(source).toContain("assertTelemetryCockpitSafe(projection)");
    expect(source).toContain("scanTelemetryCockpitSafety(projection");
  });
});
