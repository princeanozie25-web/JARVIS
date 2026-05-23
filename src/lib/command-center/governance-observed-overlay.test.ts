import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9G_GOVERNANCE_BOUNDARY_GUARD_STATE,
  GovernanceObservedOverlaySchema,
  Phase9GGovernanceBoundaryCloseoutReportSchema,
  applyGovernanceObservedOverlayToPolicyGraph,
  createDefaultGovernanceBoundaryViewerViewModel,
  createDefaultGovernanceObservedOverlay,
  createDefaultGovernancePolicyGraph,
  createPhase9GGovernanceBoundaryCloseoutReport,
  validateGovernanceObservedOverlay,
} from "./index";

function overlayForEdge(
  from: string,
  to: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    ...createDefaultGovernanceObservedOverlay(),
    overlay_id: `governance_overlay:${from}_to_${to}`,
    generated_at: 44,
    observed_edges: [
      {
        from,
        to,
        observed_count_bin: "medium",
        last_seen_band: "latest",
        incident_flag_class: "yellow",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
        policy_mutation_allowed: false,
        edge_executable: false,
        ...overrides,
      },
    ],
    withheld_fields: ["raw_prompt"],
  };
}

describe("Phase 9G2 governance observed overlay contract", () => {
  it("creates a deterministic, safe, empty, serializable default overlay", () => {
    const first = createDefaultGovernanceObservedOverlay();
    const second = createDefaultGovernanceObservedOverlay();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(GovernanceObservedOverlaySchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.governance_observed_overlay",
      phase: "9G2",
      overlay_id: "governance_overlay:empty",
      generated_at: 0,
      source_category: "governance_boundaries",
      render_safe: true,
      non_executable: true,
      observed_edges: [],
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
      graph_execution_allowed: false,
      policy_mutation_allowed: false,
      observed_edge_authority_allowed: false,
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
    expect(validateGovernanceObservedOverlay(first)).toMatchObject({
      passed: true,
      reasons: ["governance_observed_overlay_valid"],
      mutated_input: false,
    });
  });

  it("applies observed bins without changing static policy", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const overlay = overlayForEdge("telemetry", "command_center");
    const viewer = applyGovernanceObservedOverlayToPolicyGraph(graph, overlay);
    const defaultEdge = graph.edges.find(
      (edge) => edge.from === "telemetry" && edge.to === "command_center",
    );
    const observedEdge = viewer.edges.find(
      (edge) => edge.from === "telemetry" && edge.to === "command_center",
    );

    expect(observedEdge).toMatchObject({
      policy: defaultEdge?.policy,
      gate_class: defaultEdge?.gate_class,
      observed_count_bin: "medium",
      incident_flag_class: "yellow",
      render_safe: true,
      non_executable: true,
      authority_surface: false,
    });
    expect(viewer).toMatchObject({
      graph_id: graph.graph_id,
      generated_at: 44,
      withheld_fields: ["raw_prompt"],
      action_executed: false,
      graph_execution_allowed: false,
    });
  });

  it("turns observed traffic on forbidden policy edges into red incident flags", () => {
    const viewer = applyGovernanceObservedOverlayToPolicyGraph(
      createDefaultGovernancePolicyGraph(),
      overlayForEdge("command_center", "tool_registry", {
        observed_count_bin: "low",
        incident_flag_class: "none",
      }),
    );
    const tripwire = viewer.edges.find(
      (edge) => edge.from === "command_center" && edge.to === "tool_registry",
    );

    expect(tripwire).toMatchObject({
      policy: "forbidden",
      observed_count_bin: "low",
      incident_flag_class: "red",
    });
    expect(viewer.incident_count).toBe(1);
  });

  it("does not let overlays create executable edges", () => {
    const overlay = overlayForEdge("telemetry", "command_center", {
      edge_executable: true,
    });

    expect(validateGovernanceObservedOverlay(overlay)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
      ]),
      withheld_fields: ["observed_edges.0.edge_executable"],
    });
    expect(
      applyGovernanceObservedOverlayToPolicyGraph(
        createDefaultGovernancePolicyGraph(),
        overlay,
      ),
    ).toEqual(createDefaultGovernanceBoundaryViewerViewModel());
  });

  it("falls back to the default governance boundary viewer for unsafe overlays", () => {
    expect(
      applyGovernanceObservedOverlayToPolicyGraph(
        createDefaultGovernancePolicyGraph(),
        {
          ...createDefaultGovernanceObservedOverlay(),
          raw_prompt: "withheld",
        },
      ),
    ).toEqual(createDefaultGovernanceBoundaryViewerViewModel());
  });

  it("fails validation for unknown incident, count, or last-seen classes", () => {
    const overlay = overlayForEdge("telemetry", "command_center", {
      observed_count_bin: "exact_42",
      last_seen_band: "yesterday_exact",
      incident_flag_class: "purple",
    });

    expect(validateGovernanceObservedOverlay(overlay)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_enum_value",
      ]),
      render_safe: false,
    });
  });

  it("fails closed for raw payload fields", () => {
    expect(
      validateGovernanceObservedOverlay({
        ...createDefaultGovernanceObservedOverlay(),
        raw_tool_args: "withheld",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
      ]),
      withheld_fields: ["raw_tool_args"],
    });
  });

  it("fails closed for executable approve/run/retry/mutate keys", () => {
    expect(
      validateGovernanceObservedOverlay({
        ...createDefaultGovernanceObservedOverlay(),
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
    const report = createPhase9GGovernanceBoundaryCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
      generated_from: "phase_9g_governance_boundary_visualizer_scaffold",
      metadata_only: true,
      render_safe: true,
      non_executable: true,
      static_policy_source_of_truth: true,
      overlay_read_only: true,
      graph_execution_allowed: false,
      policy_mutation_allowed: false,
      observed_edge_authority_allowed: false,
      live_telemetry_read_allowed: false,
      db_read_allowed: false,
      db_write_allowed: false,
      remote_dashboard_allowed: false,
    });
  });

  it("fails closeout if overlay can mutate policy", () => {
    const report = createPhase9GGovernanceBoundaryCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9G_GOVERNANCE_BOUNDARY_GUARD_STATE,
        policy_mutation_from_overlay_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_policy_mutation_from_overlay"],
    });
  });

  it("fails closeout if graph execution or observed-edge authority is enabled", () => {
    const report = createPhase9GGovernanceBoundaryCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9G_GOVERNANCE_BOUNDARY_GUARD_STATE,
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
    const first = createPhase9GGovernanceBoundaryCloseoutReport();
    const second = createPhase9GGovernanceBoundaryCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9GGovernanceBoundaryCloseoutReportSchema.parse(first)).toEqual(
      first,
    );
  });

  it("exports governance observed overlay helpers from command-center index", () => {
    expect(typeof createDefaultGovernanceObservedOverlay).toBe("function");
    expect(typeof validateGovernanceObservedOverlay).toBe("function");
    expect(typeof applyGovernanceObservedOverlayToPolicyGraph).toBe("function");
    expect(typeof createPhase9GGovernanceBoundaryCloseoutReport).toBe(
      "function",
    );
  });
});
