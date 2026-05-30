import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TelemetryCockpitPage from "../../app/audit/telemetry-cockpit/page";
import {
  buildTelemetryCockpitViewerModel,
  filterTelemetryCockpitViewerPanels,
  selectTelemetryCockpitViewerPanel,
} from "../../components/telemetry-cockpit/TelemetryCockpitViewer";
import * as telemetryCockpit from "./index";
import {
  PHASE_19B_CLOSEOUT_CHECK_IDS,
  PHASE_19B_DISABLED_CAPABILITIES,
  PHASE_19B_VIEWER_LOCAL_CONTROLS,
  PHASE_19B_VIEWER_REQUIRED_SECTIONS,
  Phase19BCloseoutReportSchema,
  assertPhase19BCloseoutPasses,
  buildPhase19BCloseoutReport,
  listPhase19BDisabledCapabilities,
  scanTelemetryCockpitSafety,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "callTool",
] as const;

const FORBIDDEN_RAW_KEYS = [
  "prompt",
  "raw_prompt",
  "model_output",
  "raw_model_output",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "voice_transcript",
  "raw_voice_transcript",
  "audio",
  "raw_audio",
  "ocr_text",
  "raw_ocr_text",
  "frame",
  "raw_frame",
  "screenshot",
  "raw_screenshot",
  "api_key",
  "secret",
  "secrets",
] as const;

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 19B.5 telemetry cockpit final feature closeout", () => {
  it("returns PASS WITH NOTES for the current implementation", () => {
    expect(buildPhase19BCloseoutReport()).toMatchObject({
      report_version: "19B.5",
      report_id: "phase-19b-telemetry-cockpit-closeout",
      verdict: "PASS_WITH_NOTES",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      feature_complete_for_phase_19b: true,
      foundation_only: false,
      viewer_route: "/audit/telemetry-cockpit",
      viewer_route_visible: true,
      viewer_sections: PHASE_19B_VIEWER_REQUIRED_SECTIONS,
      viewer_local_controls: PHASE_19B_VIEWER_LOCAL_CONTROLS,
      viewer_safety_guarded_before_render: true,
      alerts_warnings_informational_only: true,
      charts_added: false,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      polling_enabled: false,
      websocket_enabled: false,
      runtime_observer_created: false,
      authority_surface_created: false,
      side_effects_performed: false,
      phase_18_boundaries_modified: false,
    });
    expect(
      Phase19BCloseoutReportSchema.safeParse(buildPhase19BCloseoutReport())
        .success,
    ).toBe(true);
  });

  it("contains every required closeout check", () => {
    const report = buildPhase19BCloseoutReport();

    expect(report.checks.map((check) => check.check_id)).toEqual(
      PHASE_19B_CLOSEOUT_CHECK_IDS,
    );
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it("lists all disabled Phase 19B capabilities", () => {
    expect(listPhase19BDisabledCapabilities()).toEqual(
      PHASE_19B_DISABLED_CAPABILITIES,
    );
    expect(listPhase19BDisabledCapabilities()).toEqual(
      expect.arrayContaining([
        "charts",
        "live telemetry ingestion",
        "polling",
        "websocket/live streaming",
        "runtime observers",
        "filesystem reads",
        "database reads",
        "execution",
        "retry",
        "approval decisions",
        "mutation",
        "dispatch",
        "tool calls",
        "authority token creation",
        "side effects",
      ]),
    );
  });

  it("assertion helper passes for the current implementation", () => {
    expect(() => assertPhase19BCloseoutPasses()).not.toThrow();
  });

  it("report output is deterministic", () => {
    expect(JSON.stringify(buildPhase19BCloseoutReport())).toBe(
      JSON.stringify(buildPhase19BCloseoutReport()),
    );
  });

  it("report output is defensive-copy-safe", () => {
    const report = buildPhase19BCloseoutReport();
    report.checks[0].label = "Mutated Closeout Report";
    report.disabled_capabilities[0] = "side effects";

    const freshReport = buildPhase19BCloseoutReport();
    expect(freshReport.checks[0]).toMatchObject({
      check_id: "phase_19b1_contracts_projection_exist",
      label: "Phase 19B.1 contracts and projection exist.",
    });
    expect(freshReport.disabled_capabilities[0]).toBe("charts");
  });

  it("closeout output does not leak forbidden raw data", () => {
    const report = buildPhase19BCloseoutReport();
    const keys = collectKeys(report);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(scanTelemetryCockpitSafety(report)).toMatchObject({
      passed: true,
      violation_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("viewer route renders the final read-only cockpit feature", () => {
    const html = renderToStaticMarkup(createElement(TelemetryCockpitPage));

    expect(html).toContain('data-telemetry-cockpit-viewer="read-only"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Telemetry Cockpit");
    expect(html).toContain("Panel Summaries");
    expect(html).toContain("Panel Inspection");
    expect(html).toContain("Search panels");
    expect(html).toContain("Panel kind");
    expect(html).toContain("Health band");
    expect(html).toContain("Cockpit Warnings");
    expect(html).toContain("Inspect panel");
    expect(html).not.toMatch(
      /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i,
    );
    expect(html).not.toMatch(
      /raw_payload|tool_args|raw_prompt|model output|voice transcript|transcript|ocr text|frame bytes|secret|approval token/i,
    );
  });

  it("viewer helpers prove Phase 19B is feature-complete, not foundation-only", () => {
    const model = buildTelemetryCockpitViewerModel();
    const filtered = filterTelemetryCockpitViewerPanels(model.panels, {
      panelKind: "architecture_graph",
      healthBand: "all",
      showWarnings: true,
      showAlerts: true,
      search: "Architecture",
    });
    const selected = selectTelemetryCockpitViewerPanel(
      model.panels,
      "telemetry-panel:safety_governance",
    );

    expect(filtered.map((item) => item.panel.title)).toEqual([
      "Architecture Graph",
    ]);
    expect(selected).toMatchObject({
      panel: {
        title: "Safety/Governance",
        metadata_only: true,
        read_only: true,
      },
    });
    expect(selected?.alerts.map((alert) => alert.label)).toContain(
      "Safety cockpit remains read-only",
    );
  });

  it("closeout exports introduce no forbidden affordance names", () => {
    const exportedFunctionNames = Object.entries(telemetryCockpit)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
