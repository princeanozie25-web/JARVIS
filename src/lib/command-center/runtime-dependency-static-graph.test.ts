import { describe, expect, it } from "vitest";

import {
  RuntimeDependencyStaticGraphSchema,
  createDefaultRuntimeDependencyStaticGraph,
  createDefaultRuntimeDependencyViewerViewModel,
  projectRuntimeDependencyStaticGraphToAuditViewer,
  validateRuntimeDependencyStaticGraph,
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

function collectObjectKeys(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input))
    return input.flatMap((item) => collectObjectKeys(item));
  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectObjectKeys(value),
  ]);
}

describe("Phase 9H1 runtime dependency static graph contract", () => {
  it("creates a deterministic, safe, serializable static build-artifact graph", () => {
    const first = createDefaultRuntimeDependencyStaticGraph();
    const second = createDefaultRuntimeDependencyStaticGraph();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(RuntimeDependencyStaticGraphSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.runtime_dependency_static_graph",
      phase: "9H1",
      graph_id: "runtime_dependency_static:build_artifact_default",
      generated_at: 0,
      source_kind: "static_build_artifact",
      render_safe: true,
      non_executable: true,
      source_code_exposed: false,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
      implementation_body_included: false,
      authority_surface: false,
      source_parsing_wired: false,
      live_code_introspection_wired: false,
      source_code_rendering_allowed: false,
      graph_edges_executable: false,
      ...SIDE_EFFECT_FALSES,
    });
    expect(validateRuntimeDependencyStaticGraph(first)).toMatchObject({
      passed: true,
      reasons: ["runtime_dependency_static_graph_valid"],
      mutated_input: false,
      source_code_exposed: false,
      static_build_artifact_source: true,
    });
  });

  it("includes command_center as a read-only projection consumer", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();

    expect(
      graph.nodes.find((node) => node.node_id === "command_center"),
    ).toMatchObject({
      module_class: "command_center",
      label_class: "viewer",
      render_safe: true,
      non_executable: true,
    });
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "runtime_dependency_static_graph",
          to: "command_center",
          edge_class: "read_only_projection",
          render_safe: true,
          non_executable: true,
        }),
      ]),
    );
  });

  it("validates static graph edge endpoints", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();
    const validation = validateRuntimeDependencyStaticGraph({
      ...graph,
      edges: [{ ...graph.edges[0], to: "missing_runtime_node" }],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["missing_edge_node"]),
      render_safe: false,
    });
  });

  it("fails validation for unknown module, edge, and risk classes", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();

    expect(
      validateRuntimeDependencyStaticGraph({
        ...graph,
        nodes: [
          { ...graph.nodes[0], module_class: "filesystem" },
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
      validateRuntimeDependencyStaticGraph({
        ...graph,
        edges: [
          { ...graph.edges[0], edge_class: "dynamic_execute" },
          ...graph.edges.slice(1),
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
      validateRuntimeDependencyStaticGraph({
        ...graph,
        edges: [
          { ...graph.edges[0], coupling_risk_class: "critical" },
          ...graph.edges.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_enum_value",
      ]),
    });
  });

  it("fails closed for raw payload and source body fields", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();
    const validation = validateRuntimeDependencyStaticGraph({
      ...graph,
      raw_tool_args: "withheld",
      source_code: "const unsafe = true",
      code_body: "function unsafe() {}",
      file_body: "secret body",
      raw_stack_trace: "stack body",
    });

    expect(validation).toMatchObject({
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
      render_safe: false,
      source_code_exposed: false,
    });
  });

  it("fails closed for executable approve/run/retry/mutate affordance keys", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();
    const validation = validateRuntimeDependencyStaticGraph({
      ...graph,
      approve_button: true,
      run_button: true,
      retry_button: true,
      mutate_button: true,
      execute_affordance_allowed: true,
      graph_edges_executable: true,
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
        "execute_affordance_allowed",
        "graph_edges_executable",
      ]),
    });
  });

  it("fails when source_kind is not static_build_artifact", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();

    expect(
      validateRuntimeDependencyStaticGraph({
        ...graph,
        source_kind: "live_introspection",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "invalid_source_kind",
      ]),
      static_build_artifact_source: false,
    });
  });

  it("fails when source_code_exposed is true", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();

    expect(
      validateRuntimeDependencyStaticGraph({
        ...graph,
        source_code_exposed: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "source_code_exposed",
      ]),
      source_code_exposed: true,
    });
  });

  it("projects to the Audit runtime dependency viewer without source-code or execution authority", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();
    const viewer = projectRuntimeDependencyStaticGraphToAuditViewer(graph);

    expect(viewer).toMatchObject({
      graph_id: "runtime_dependency_static:build_artifact_default",
      generated_at: 0,
      render_safe: true,
      non_executable: true,
      redaction_status: "metadata_only",
      implementation_body_included: false,
      graph_execution_allowed: false,
      ...SIDE_EFFECT_FALSES,
    });
    expect(viewer.nodes).toEqual(graph.nodes);
    expect(viewer.edges).toEqual(graph.edges);
    expect(collectObjectKeys(viewer)).not.toEqual(
      expect.arrayContaining([
        "source_code",
        "code_body",
        "file_body",
        "raw_stack_trace",
        "tool_execution_hook",
        "routine_hook",
        "approval_hook",
        "retry_button",
        "run_button",
      ]),
    );
  });

  it("falls back to the default Audit runtime dependency viewer for unsafe graph projection", () => {
    const graph = createDefaultRuntimeDependencyStaticGraph();

    expect(
      projectRuntimeDependencyStaticGraphToAuditViewer({
        ...graph,
        raw_prompt: "withheld",
      }),
    ).toEqual(createDefaultRuntimeDependencyViewerViewModel());
  });

  it("exports runtime dependency static graph helpers from command-center index", () => {
    expect(typeof createDefaultRuntimeDependencyStaticGraph).toBe("function");
    expect(typeof validateRuntimeDependencyStaticGraph).toBe("function");
    expect(typeof projectRuntimeDependencyStaticGraphToAuditViewer).toBe(
      "function",
    );
    expect(
      RuntimeDependencyStaticGraphSchema.parse(
        createDefaultRuntimeDependencyStaticGraph(),
      ),
    ).toEqual(createDefaultRuntimeDependencyStaticGraph());
  });
});
