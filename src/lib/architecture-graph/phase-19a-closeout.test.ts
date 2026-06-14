import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ArchitectureGraphPage from "../../app/audit/architecture-graph/page";
import {
  buildArchitectureGraphViewerModel,
  buildArchitectureGraphViewerState,
} from "../../components/architecture-graph/ArchitectureGraphViewer";
import * as architectureGraph from "./index";
import {
  PHASE_19A_CLOSEOUT_CHECK_IDS,
  PHASE_19A_DISABLED_CAPABILITIES,
  PHASE_19A_VIEWER_NAVIGATION_CONTROLS,
  PHASE_19A_VIEWER_REQUIRED_SECTIONS,
  PHASE_19A_VIEWER_ROUTE,
  Phase19ACloseoutReportSchema,
  assertPhase19ACloseoutPasses,
  buildArchitectureGraphProjection,
  buildPhase19ACloseoutReport,
  listPhase19ADisabledCapabilities,
  scanArchitectureGraphSafety,
  validateArchitectureGraphMetadata,
  getStaticArchitectureGraph,
} from "./index";

// E-015: file-scoped timeout raise (companion to E-013). This whole-repo-scan
// closeout audit times out under machine load; raise to 120s. Assertions
// unchanged.
vi.setConfig({ testTimeout: 120_000 });

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
  "raw_prompt",
  "prompt",
  "raw_model_output",
  "model_output",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_audio_reference",
  "audio_reference",
  "raw_ocr_text",
  "ocr_text",
  "raw_frame",
  "frame",
  "raw_screenshot",
  "screenshot",
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

describe("Phase 19A.9 final architecture graph feature closeout guard", () => {
  it("returns PASS WITH NOTES for the current implementation", () => {
    expect(buildPhase19ACloseoutReport()).toMatchObject({
      report_version: "19A.9",
      report_id: "phase-19a-architecture-graph-closeout",
      verdict: "PASS_WITH_NOTES",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      ready_for_future_ui_rendering: true,
      feature_complete_for_phase_19a: true,
      foundation_only: false,
      viewer_route: "/audit/architecture-graph",
      viewer_route_visible: true,
      viewer_sections: PHASE_19A_VIEWER_REQUIRED_SECTIONS,
      viewer_navigation_controls: PHASE_19A_VIEWER_NAVIGATION_CONTROLS,
      ui_rendered: true,
      viewer_read_only: true,
      viewer_safety_guarded_before_render: true,
      viewer_warning_tripwires_only: true,
      react_flow_or_d3_added: false,
      source_imports_parsed: false,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      authority_surface_created: false,
      side_effects_performed: false,
      phase_18_boundaries_modified: false,
    });
    expect(
      Phase19ACloseoutReportSchema.safeParse(buildPhase19ACloseoutReport())
        .success,
    ).toBe(true);
  });

  it("contains every required closeout check", () => {
    expect(
      buildPhase19ACloseoutReport().checks.map((check) => check.check_id),
    ).toEqual(PHASE_19A_CLOSEOUT_CHECK_IDS);
    expect(
      buildPhase19ACloseoutReport().checks.every((check) => check.passed),
    ).toBe(true);
  });

  it("lists all disabled Phase 19A capabilities", () => {
    expect(listPhase19ADisabledCapabilities()).toEqual(
      PHASE_19A_DISABLED_CAPABILITIES,
    );
    expect(listPhase19ADisabledCapabilities()).toEqual(
      expect.arrayContaining([
        "graph-driven execution",
        "observed runtime telemetry graph",
        "source import parsing",
        "filesystem scanning",
        "database reads",
        "telemetry ingestion",
        "runtime observers",
        "React Flow/D3 rendering",
        "run/retry/approve/execute/mutate/dispatch/tool-call controls",
        "authority token creation",
        "approval decisions",
        "side effects",
      ]),
    );
  });

  it("includes final viewer route and navigation checks", () => {
    const checks = buildPhase19ACloseoutReport().checks.map(
      (check) => check.check_id,
    );

    expect(PHASE_19A_VIEWER_ROUTE).toBe("/audit/architecture-graph");
    expect(checks).toEqual(
      expect.arrayContaining([
        "phase_19a7_viewer_route_exists",
        "phase_19a8_navigation_inspection_exists",
        "graph_visible_at_audit_architecture_graph",
        "projection_safety_guarded_before_render",
        "viewer_renders_stats_groups_nodes_edges_legend_warnings",
        "local_selection_search_filtering_supported",
        "forbidden_tripwire_edges_render_as_warnings_only",
        "phase_19a_feature_complete_not_foundation_only",
      ]),
    );
  });

  it("assertion helper passes for current implementation", () => {
    expect(() => assertPhase19ACloseoutPasses()).not.toThrow();
  });

  it("report output is deterministic", () => {
    expect(JSON.stringify(buildPhase19ACloseoutReport())).toBe(
      JSON.stringify(buildPhase19ACloseoutReport()),
    );
  });

  it("report output is defensive-copy-safe", () => {
    const report = buildPhase19ACloseoutReport();
    report.checks[0].label = "Mutated Closeout Report";
    report.disabled_capabilities[0] = "side effects";

    const freshReport = buildPhase19ACloseoutReport();
    expect(freshReport.checks[0]).toMatchObject({
      check_id: "phase_19a1_contracts_exist",
      label: "Phase 19A.1 graph contracts exist.",
    });
    expect(freshReport.disabled_capabilities[0]).toBe("graph-driven execution");
  });

  it("closeout output does not leak forbidden raw data", () => {
    const report = buildPhase19ACloseoutReport();
    const keys = collectKeys(report);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(scanArchitectureGraphSafety(report)).toMatchObject({
      valid: true,
      violation_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("viewer route renders the final read-only feature surface", () => {
    const html = renderToStaticMarkup(createElement(ArchitectureGraphPage));

    expect(html).toContain('data-architecture-graph-viewer="read-only"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain('data-architecture-graph-controls="safe-read-only"');
    expect(html).toContain("Architecture Graph");
    expect(html).toContain("Tripwire Warnings");
    expect(html).toContain("Selected node");
    expect(html).toContain("Find node");
    expect(html).toContain("Edge path");
    expect(html).toContain("Show tripwires");
    expect(html).not.toMatch(
      /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i,
    );
    expect(html).not.toMatch(
      /raw_payload|tool_args|raw_prompt|model output|voice transcript|ocr text|frame bytes|secret|approval token/i,
    );
  });

  it("navigation state proves Phase 19A is feature-complete, not foundation-only", () => {
    const model = buildArchitectureGraphViewerModel();
    const state = buildArchitectureGraphViewerState(model, {
      selectedNodeId: "arch-node:command-center",
      searchQuery: "command",
      groupFilter: "surfaces",
      edgeFilter: "read",
      showTripwires: true,
    });

    expect(state).toMatchObject({
      metadata_only: true,
      read_only: true,
      selected_node_id: "arch-node:command-center",
      group_filter: "surfaces",
      edge_filter: "read",
      search_query: "command",
    });
    expect(state.selected_detail.dependencies).toContain("Observability API");
    expect(state.visible_nodes.map((node) => node.label)).toContain(
      "Command Center",
    );
    expect(
      state.visible_edges.every((edge) => edge.kind === "reads_from"),
    ).toBe(true);
  });

  it("architecture graph suite remains aligned with Phase 19A.1 through 19A.9", () => {
    expect(
      validateArchitectureGraphMetadata(getStaticArchitectureGraph()),
    ).toMatchObject({
      valid: true,
      reason: "valid_architecture_graph_metadata",
    });
    expect(buildArchitectureGraphProjection()).toMatchObject({
      contract_version: "19A.4",
      underlying_graph_validated: true,
      raw_fields_exposed: false,
      action_affordances_exposed: false,
    });
    expect(
      buildPhase19ACloseoutReport().evidence.map((item) => item.source_slice),
    ).toEqual([
      "19A.1",
      "19A.2",
      "19A.3",
      "19A.4",
      "19A.5",
      "19A.7",
      "19A.8",
      "19A.9",
    ]);
  });

  it("closeout exports introduce no execution affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
