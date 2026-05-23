import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9H_RUNTIME_DEPENDENCY_GUARD_STATE,
  Phase9HRuntimeDependencyCloseoutReportSchema,
  RuntimeDependencyObservedOverlaySchema,
  applyRuntimeDependencyObservedOverlayToStaticGraph,
  createDefaultRuntimeDependencyObservedOverlay,
  createDefaultRuntimeDependencyStaticGraph,
  createDefaultRuntimeDependencyViewerViewModel,
  createPhase9HRuntimeDependencyCloseoutReport,
  validateRuntimeDependencyObservedOverlay,
} from "./index";

function overlayForEdge(
  from: string,
  to: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    ...createDefaultRuntimeDependencyObservedOverlay(),
    overlay_id: `runtime_dependency_overlay:${from}_to_${to}`,
    generated_at: 88,
    observed_edges: [
      {
        from,
        to,
        observed_count_bin: "medium",
        last_seen_band: "latest",
        coupling_risk_class: "medium",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
        source_code_exposed: false,
        static_graph_mutation_allowed: false,
        edge_executable: false,
        ...overrides,
      },
    ],
    withheld_fields: ["source_code"],
  };
}

describe("Phase 9H2 runtime dependency observed overlay contract", () => {
  it("creates a deterministic, safe, empty, serializable default overlay", () => {
    const first = createDefaultRuntimeDependencyObservedOverlay();
    const second = createDefaultRuntimeDependencyObservedOverlay();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(RuntimeDependencyObservedOverlaySchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.runtime_dependency_observed_overlay",
      phase: "9H2",
      overlay_id: "runtime_dependency_overlay:empty",
      generated_at: 0,
      source_category: "runtime_dependencies",
      render_safe: true,
      non_executable: true,
      source_code_exposed: false,
      observed_edges: [],
      raw_payloads_included: false,
      exact_pii_included: false,
      implementation_body_included: false,
      authority_surface: false,
      graph_execution_allowed: false,
      static_graph_mutation_allowed: false,
      observed_edge_authority_allowed: false,
      source_code_rendering_allowed: false,
      live_code_introspection_wired: false,
      source_parsing_wired: false,
      live_telemetry_read_allowed: false,
      db_read_allowed: false,
      db_write_allowed: false,
      remote_dashboard_allowed: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateRuntimeDependencyObservedOverlay(first)).toMatchObject({
      passed: true,
      reasons: ["runtime_dependency_observed_overlay_valid"],
      mutated_input: false,
    });
  });

  it("applies observed bins without changing static graph structure", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();
    const overlay = overlayForEdge(
      "runtime_dependency_static_graph",
      "command_center",
    );
    const viewer = applyRuntimeDependencyObservedOverlayToStaticGraph(
      graph,
      overlay,
    );
    const staticEdge = graph.edges.find(
      (edge) =>
        edge.from === "runtime_dependency_static_graph" &&
        edge.to === "command_center",
    );
    const observedEdge = viewer.edges.find(
      (edge) =>
        edge.from === "runtime_dependency_static_graph" &&
        edge.to === "command_center",
    );

    expect(viewer.nodes).toEqual(graph.nodes);
    expect(viewer.edges).toHaveLength(graph.edges.length);
    expect(observedEdge).toMatchObject({
      edge_class: staticEdge?.edge_class,
      observed_count_bin: "medium",
      coupling_risk_class: "medium",
      render_safe: true,
      non_executable: true,
      authority_surface: false,
    });
    expect(viewer).toMatchObject({
      graph_id: graph.graph_id,
      generated_at: 88,
      withheld_fields: ["source_code"],
      action_executed: false,
      graph_execution_allowed: false,
    });
  });

  it("does not allow overlays to expose source code", () => {
    const overlay = {
      ...createDefaultRuntimeDependencyObservedOverlay(),
      source_code_exposed: true,
    };

    expect(validateRuntimeDependencyObservedOverlay(overlay)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "source_code_exposed",
      ]),
      source_code_exposed: true,
    });
    expect(
      applyRuntimeDependencyObservedOverlayToStaticGraph(
        createDefaultRuntimeDependencyStaticGraph(),
        overlay,
      ),
    ).toEqual(createDefaultRuntimeDependencyViewerViewModel());
  });

  it("does not let overlays create executable edges", () => {
    const overlay = overlayForEdge(
      "runtime_dependency_static_graph",
      "command_center",
      {
        edge_executable: true,
      },
    );

    expect(validateRuntimeDependencyObservedOverlay(overlay)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
      ]),
      withheld_fields: ["observed_edges.0.edge_executable"],
    });
    expect(
      applyRuntimeDependencyObservedOverlayToStaticGraph(
        createDefaultRuntimeDependencyStaticGraph(),
        overlay,
      ),
    ).toEqual(createDefaultRuntimeDependencyViewerViewModel());
  });

  it("safely withholds unknown overlay edges without changing static graph", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();
    const viewer = applyRuntimeDependencyObservedOverlayToStaticGraph(
      graph,
      overlayForEdge("unknown_runtime_node", "command_center"),
    );

    expect(viewer.graph_id).toBe(graph.graph_id);
    expect(viewer.nodes).toEqual(graph.nodes);
    expect(viewer.edges).toEqual(graph.edges);
    expect(viewer.withheld_fields).toEqual(
      expect.arrayContaining([
        "source_code",
        "observed_edges:unknown_runtime_node->command_center",
      ]),
    );
  });

  it("falls back to the default runtime dependency viewer for unsafe overlays", () => {
    expect(
      applyRuntimeDependencyObservedOverlayToStaticGraph(
        createDefaultRuntimeDependencyStaticGraph(),
        {
          ...createDefaultRuntimeDependencyObservedOverlay(),
          raw_prompt: "withheld",
        },
      ),
    ).toEqual(createDefaultRuntimeDependencyViewerViewModel());
  });

  it("fails validation for unknown observed count, last-seen, or risk classes", () => {
    const overlay = overlayForEdge(
      "runtime_dependency_static_graph",
      "command_center",
      {
        observed_count_bin: "exact_42",
        last_seen_band: "yesterday_exact",
        coupling_risk_class: "critical",
      },
    );

    expect(validateRuntimeDependencyObservedOverlay(overlay)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_enum_value",
      ]),
      render_safe: false,
    });
  });

  it("fails closed for raw payload and source body fields", () => {
    expect(
      validateRuntimeDependencyObservedOverlay({
        ...createDefaultRuntimeDependencyObservedOverlay(),
        raw_tool_args: "withheld",
        source_code: "const unsafe = true",
        code_body: "function unsafe() {}",
        file_body: "secret body",
        raw_stack_trace: "stack body",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
        "source_code_field_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "raw_tool_args",
        "source_code",
        "code_body",
        "file_body",
        "raw_stack_trace",
      ]),
    });
  });

  it("fails closed for executable approve/run/retry/mutate keys", () => {
    expect(
      validateRuntimeDependencyObservedOverlay({
        ...createDefaultRuntimeDependencyObservedOverlay(),
        approve_button: true,
        run_button: true,
        retry_button: true,
        mutate_button: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "approve_button",
        "run_button",
        "retry_button",
        "mutate_button",
      ]),
    });
  });

  it("passes the default closeout report", () => {
    const report = createPhase9HRuntimeDependencyCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
      generated_from: "phase_9h_runtime_dependency_visualizer_scaffold",
      metadata_only: true,
      render_safe: true,
      non_executable: true,
      static_graph_source_of_truth: true,
      overlay_read_only: true,
      source_code_exposed: false,
      graph_execution_allowed: false,
      static_graph_mutation_allowed: false,
      observed_edge_authority_allowed: false,
      source_code_rendering_allowed: false,
      live_code_introspection_allowed: false,
      source_parsing_runtime_allowed: false,
      live_telemetry_read_allowed: false,
      db_read_allowed: false,
      db_write_allowed: false,
      remote_dashboard_allowed: false,
    });
  });

  it("fails closeout if overlay can mutate the static graph", () => {
    const report = createPhase9HRuntimeDependencyCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9H_RUNTIME_DEPENDENCY_GUARD_STATE,
        static_graph_mutation_from_overlay_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_static_graph_mutation_from_overlay"],
    });
  });

  it("fails closeout if source-code rendering, live introspection, or source parsing is enabled", () => {
    const report = createPhase9HRuntimeDependencyCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9H_RUNTIME_DEPENDENCY_GUARD_STATE,
        source_code_rendering_enabled: true,
        live_code_introspection_enabled: true,
        source_parsing_runtime_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_source_code_rendering",
        "no_live_code_introspection",
        "no_source_parsing_runtime",
      ]),
    });
  });

  it("fails closeout if graph execution or observed-edge authority is enabled", () => {
    const report = createPhase9HRuntimeDependencyCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9H_RUNTIME_DEPENDENCY_GUARD_STATE,
        graph_execution_enabled: true,
        observed_edge_authority_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_graph_execution",
        "no_observed_edge_authority",
      ]),
    });
  });

  it("is deterministic and serializable", () => {
    const first = createPhase9HRuntimeDependencyCloseoutReport();
    const second = createPhase9HRuntimeDependencyCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9HRuntimeDependencyCloseoutReportSchema.parse(first)).toEqual(
      first,
    );
  });

  it("exports runtime dependency observed overlay helpers from command-center index", () => {
    expect(typeof createDefaultRuntimeDependencyObservedOverlay).toBe(
      "function",
    );
    expect(typeof validateRuntimeDependencyObservedOverlay).toBe("function");
    expect(typeof applyRuntimeDependencyObservedOverlayToStaticGraph).toBe(
      "function",
    );
    expect(typeof createPhase9HRuntimeDependencyCloseoutReport).toBe(
      "function",
    );
  });
});
