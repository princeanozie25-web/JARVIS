import { describe, expect, it } from "vitest";

import {
  GovernanceBoundaryViewerViewModelSchema,
  createCommandCenterObservabilityResponseEnvelope,
  createDefaultGovernanceBoundaryViewerViewModel,
  deriveGovernanceBoundaryViewerFromObservabilityResponse,
  validateGovernanceBoundaryViewerViewModel,
} from "./index";

const SIDE_EFFECT_FALSES = {
  tool_called: false,
  action_executed: false,
  approval_granted: false,
  routine_scheduled: false,
  routine_triggered: false,
  memory_written: false,
  project_written: false,
  device_action_triggered: false,
  cloud_fallback_triggered: false,
  db_write_performed: false,
  network_called: false,
  audio_capture_started: false,
  video_capture_started: false,
} as const;

function safeGovernanceEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ...createCommandCenterObservabilityResponseEnvelope({
      query_id: "audit:governance",
      category: "governance_boundaries",
      generated_at: 128,
      payload: [
        {
          item_id: "edge:telemetry:to:command_center",
          item_class: "governance_edge",
          status: "observed",
          count_band: "medium",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      withheld_fields: ["raw_prompt"],
      replay_safe: true,
    }),
    ...overrides,
  };
}

function expectGraphSafe(input: Record<string, unknown>) {
  expect(input).toMatchObject({
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    ...SIDE_EFFECT_FALSES,
  });
}

describe("Phase 9E3 Audit governance boundary viewer contract", () => {
  it("creates a deterministic, safe, serializable, non-executable default graph", () => {
    const first = createDefaultGovernanceBoundaryViewerViewModel();
    const second = createDefaultGovernanceBoundaryViewerViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(GovernanceBoundaryViewerViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.governance_boundary_viewer_view_model",
      phase: "9E3",
      graph_id: "governance_boundary:static_default",
      generated_at: 0,
      redaction_status: "metadata_only",
      render_safe: true,
      non_executable: true,
      incident_count: 0,
      truncated: false,
    });
    expectGraphSafe(first);
    expect(validateGovernanceBoundaryViewerViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["governance_boundary_viewer_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("includes command_center and core governance subsystems", () => {
    const graph = createDefaultGovernanceBoundaryViewerViewModel();
    const nodeIds = graph.nodes.map((node) => node.node_id);

    expect(nodeIds).toEqual(
      expect.arrayContaining([
        "command_center",
        "router",
        "safety",
        "tool_registry",
        "approvals",
        "telemetry",
        "audit_db",
      ]),
    );
    expect(
      graph.nodes.find((node) => node.node_id === "command_center"),
    ).toMatchObject({
      subsystem_class: "command_center",
      label_class: "viewer",
    });
  });

  it("overlays observed counts without changing static policy", () => {
    const defaultGraph = createDefaultGovernanceBoundaryViewerViewModel();
    const graph = deriveGovernanceBoundaryViewerFromObservabilityResponse(
      safeGovernanceEnvelope(),
    );
    const edge = graph.edges.find(
      (item) => item.from === "telemetry" && item.to === "command_center",
    );
    const defaultEdge = defaultGraph.edges.find(
      (item) => item.from === "telemetry" && item.to === "command_center",
    );

    expect(edge).toMatchObject({
      policy: defaultEdge?.policy,
      gate_class: defaultEdge?.gate_class,
      observed_count_bin: "medium",
      incident_flag_class: "yellow",
      render_safe: true,
    });
    expect(graph).toMatchObject({
      graph_id: "governance_boundary:observed_overlay",
      generated_at: 128,
      redaction_status: "metadata_only",
      withheld_fields: ["raw_prompt"],
    });
  });

  it("marks forbidden edges with observed traffic as red incidents", () => {
    const graph = deriveGovernanceBoundaryViewerFromObservabilityResponse(
      safeGovernanceEnvelope({
        payload: [
          {
            item_id: "edge:command_center:to:tool_registry",
            item_class: "governance_edge",
            status: "observed",
            count_band: "low",
            redaction_status: "metadata_only",
            metadata_only: true,
            raw_payload_included: false,
          },
        ],
      }),
    );
    const edge = graph.edges.find(
      (item) => item.from === "command_center" && item.to === "tool_registry",
    );

    expect(edge).toMatchObject({
      policy: "forbidden",
      observed_count_bin: "low",
      incident_flag_class: "red",
    });
    expect(graph.incident_count).toBe(1);
  });

  it("falls back to the default graph for unsafe governance responses", () => {
    const graph = deriveGovernanceBoundaryViewerFromObservabilityResponse({
      ...safeGovernanceEnvelope(),
      raw_prompt: "unsafe",
    });

    expect(graph).toEqual(createDefaultGovernanceBoundaryViewerViewModel());
  });

  it("fails validation for unknown subsystem, policy, gate, or incident classes", () => {
    const graph = createDefaultGovernanceBoundaryViewerViewModel();

    expect(
      validateGovernanceBoundaryViewerViewModel({
        ...graph,
        nodes: [
          { ...graph.nodes[0], subsystem_class: "scheduler" },
          ...graph.nodes.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateGovernanceBoundaryViewerViewModel({
        ...graph,
        edges: [
          { ...graph.edges[0], policy: "execute" },
          ...graph.edges.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateGovernanceBoundaryViewerViewModel({
        ...graph,
        edges: [
          { ...graph.edges[0], gate_class: "auto_approve" },
          ...graph.edges.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateGovernanceBoundaryViewerViewModel({
        ...graph,
        edges: [
          { ...graph.edges[0], incident_flag_class: "purple" },
          ...graph.edges.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
  });

  it("fails validation for edges pointing to missing nodes", () => {
    const graph = createDefaultGovernanceBoundaryViewerViewModel();
    const validation = validateGovernanceBoundaryViewerViewModel({
      ...graph,
      edges: [
        { ...graph.edges[0], to: "missing_node" },
        ...graph.edges.slice(1),
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: ["missing_edge_node"],
      render_safe: false,
    });
  });

  it("fails closed for raw payload fields", () => {
    const graph = createDefaultGovernanceBoundaryViewerViewModel();
    const validation = validateGovernanceBoundaryViewerViewModel({
      ...graph,
      raw_tool_args: "unsafe",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "raw_payload_field_present",
        "schema_rejected",
      ]),
      withheld_fields: ["raw_tool_args"],
      render_safe: false,
    });
  });

  it("fails closed for executable approve/run/retry affordance keys", () => {
    const graph = createDefaultGovernanceBoundaryViewerViewModel();
    const validation = validateGovernanceBoundaryViewerViewModel({
      ...graph,
      approve_button: "forbidden",
      execute_affordance_allowed: true,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "schema_rejected",
      ]),
      withheld_fields: expect.arrayContaining([
        "approve_button",
        "execute_affordance_allowed",
      ]),
      render_safe: false,
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    const graph = createDefaultGovernanceBoundaryViewerViewModel();
    const validation = validateGovernanceBoundaryViewerViewModel({
      ...graph,
      on_execute: () => undefined,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "non_serializable_value",
        "schema_rejected",
      ]),
      withheld_fields: ["on_execute"],
      render_safe: false,
    });
  });

  it("exports governance boundary helpers from command-center index", () => {
    expect(typeof createDefaultGovernanceBoundaryViewerViewModel).toBe(
      "function",
    );
    expect(typeof validateGovernanceBoundaryViewerViewModel).toBe("function");
    expect(typeof deriveGovernanceBoundaryViewerFromObservabilityResponse).toBe(
      "function",
    );
    expect(
      GovernanceBoundaryViewerViewModelSchema.parse(
        createDefaultGovernanceBoundaryViewerViewModel(),
      ),
    ).toEqual(createDefaultGovernanceBoundaryViewerViewModel());
  });
});
