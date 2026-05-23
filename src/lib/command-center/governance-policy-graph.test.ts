import { describe, expect, it } from "vitest";

import {
  GovernancePolicyGraphSchema,
  createDefaultGovernanceBoundaryViewerViewModel,
  createDefaultGovernancePolicyGraph,
  projectGovernancePolicyGraphToAuditViewer,
  validateGovernancePolicyGraph,
} from "./index";

const CORE_SUBSYSTEMS = [
  "voice",
  "router",
  "safety",
  "tool_registry",
  "approvals",
  "vision",
  "environment",
  "projects",
  "memory_bridge",
  "routines",
  "cloud_providers",
  "local_providers",
  "telemetry",
  "audit_db",
  "command_center",
] as const;

describe("Phase 9G1 governance boundary policy graph contract", () => {
  it("creates a deterministic, safe, serializable default policy graph", () => {
    const first = createDefaultGovernancePolicyGraph();
    const second = createDefaultGovernancePolicyGraph();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(GovernancePolicyGraphSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.governance_policy_graph",
      phase: "9G1",
      graph_id: "governance_policy:static_default",
      generated_at: 0,
      source_of_truth: "static_policy",
      render_safe: true,
      non_executable: true,
      redaction_status: "metadata_only",
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
      policy_edges_executable: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      routine_scheduled: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateGovernancePolicyGraph(first)).toMatchObject({
      passed: true,
      reasons: ["governance_policy_graph_valid"],
      mutated_input: false,
    });
  });

  it("includes all core JARVIS subsystems", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const subsystemClasses = graph.nodes.map((node) => node.subsystem_class);

    expect(subsystemClasses).toEqual(
      expect.arrayContaining([...CORE_SUBSYSTEMS]),
    );
  });

  it("marks command_center as a read-only projection consumer", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const commandCenter = graph.nodes.find(
      (node) => node.node_id === "command_center",
    );
    const inboundEdges = graph.edges.filter(
      (edge) => edge.to === "command_center",
    );
    const outboundForbiddenEdges = graph.edges.filter(
      (edge) => edge.from === "command_center" && edge.policy === "forbidden",
    );

    expect(commandCenter).toMatchObject({
      subsystem_class: "command_center",
      label_class: "viewer",
      non_executable: true,
      render_safe: true,
    });
    expect(inboundEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "telemetry",
          gate_class: "redaction",
          policy: "gated",
        }),
        expect.objectContaining({
          from: "audit_db",
          gate_class: "read_only",
          policy: "gated",
        }),
      ]),
    );
    expect(outboundForbiddenEdges.length).toBeGreaterThan(0);
  });

  it("validates edge endpoints", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const validation = validateGovernancePolicyGraph({
      ...graph,
      edges: [{ ...graph.edges[0], to: "missing_subsystem" }],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["missing_edge_node"]),
      render_safe: false,
    });
  });

  it("fails validation for unknown enum values", () => {
    const graph = createDefaultGovernancePolicyGraph();

    expect(
      validateGovernancePolicyGraph({
        ...graph,
        nodes: [
          { ...graph.nodes[0], subsystem_class: "scheduler" },
          ...graph.nodes.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_enum_value",
      ]),
    });
    expect(
      validateGovernancePolicyGraph({
        ...graph,
        edges: [{ ...graph.edges[0], policy: "execute" }],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_enum_value",
      ]),
    });
  });

  it("fails closed for raw payload fields", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const validation = validateGovernancePolicyGraph({
      ...graph,
      raw_tool_args: "withheld",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
      ]),
      withheld_fields: ["raw_tool_args"],
      render_safe: false,
    });
  });

  it("fails closed for executable approve/run/retry/mutate affordance keys", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const validation = validateGovernancePolicyGraph({
      ...graph,
      approve_button: true,
      run_button: true,
      retry_button: true,
      mutate_button: true,
      policy_edges_executable: true,
    });

    expect(validation).toMatchObject({
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
        "policy_edges_executable",
      ]),
    });
  });

  it("fails when source_of_truth is not static_policy", () => {
    const graph = createDefaultGovernancePolicyGraph();

    expect(
      validateGovernancePolicyGraph({
        ...graph,
        source_of_truth: "observed_telemetry",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "invalid_source_of_truth",
      ]),
      static_policy_source_of_truth: false,
    });
  });

  it("projects to the Audit viewer while preserving policy classes", () => {
    const graph = createDefaultGovernancePolicyGraph();
    const viewer = projectGovernancePolicyGraphToAuditViewer(graph);

    expect(viewer).toMatchObject({
      graph_id: "governance_policy:static_default",
      generated_at: 0,
      render_safe: true,
      non_executable: true,
      redaction_status: "metadata_only",
      incident_count: 0,
      graph_execution_allowed: false,
      action_executed: false,
      approval_granted: false,
    });
    expect(viewer.edges).toEqual(graph.edges);
    expect(viewer.nodes).toEqual(graph.nodes);
    expect(viewer.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "command_center",
          to: "tool_registry",
          policy: "forbidden",
        }),
      ]),
    );
  });

  it("falls back to the default Audit governance viewer for unsafe graph projection", () => {
    const graph = createDefaultGovernancePolicyGraph();

    expect(
      projectGovernancePolicyGraphToAuditViewer({
        ...graph,
        raw_prompt: "withheld",
      }),
    ).toEqual(createDefaultGovernanceBoundaryViewerViewModel());
  });

  it("exports governance policy graph helpers from command-center index", () => {
    expect(typeof createDefaultGovernancePolicyGraph).toBe("function");
    expect(typeof validateGovernancePolicyGraph).toBe("function");
    expect(typeof projectGovernancePolicyGraphToAuditViewer).toBe("function");
    expect(
      GovernancePolicyGraphSchema.parse(createDefaultGovernancePolicyGraph()),
    ).toEqual(createDefaultGovernancePolicyGraph());
  });
});
