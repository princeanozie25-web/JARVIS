import { describe, expect, it } from "vitest";

import {
  RuntimeDependencyViewerViewModelSchema,
  createCommandCenterObservabilityResponseEnvelope,
  createDefaultRuntimeDependencyViewerViewModel,
  deriveRuntimeDependencyViewerFromObservabilityResponse,
  validateRuntimeDependencyViewerViewModel,
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

function safeRuntimeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ...createCommandCenterObservabilityResponseEnvelope({
      query_id: "audit:runtime",
      category: "runtime_dependencies",
      generated_at: 144,
      payload: [
        {
          item_id: "edge:router:to:command_center",
          item_class: "read_only_projection",
          status: "medium_risk",
          count_band: "high",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      withheld_fields: ["source_code"],
      replay_safe: true,
    }),
    ...overrides,
  };
}

function expectRuntimeSafe(input: Record<string, unknown>) {
  expect(input).toMatchObject({
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    implementation_body_included: false,
    authority_surface: false,
    ...SIDE_EFFECT_FALSES,
  });
}

function collectObjectKeys(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input))
    return input.flatMap((item) => collectObjectKeys(item));
  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectObjectKeys(value),
  ]);
}

describe("Phase 9E4 Audit runtime dependency viewer contract", () => {
  it("creates a deterministic, safe, serializable, non-executable default graph", () => {
    const first = createDefaultRuntimeDependencyViewerViewModel();
    const second = createDefaultRuntimeDependencyViewerViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(RuntimeDependencyViewerViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.runtime_dependency_viewer_view_model",
      phase: "9E4",
      graph_id: "runtime_dependency:static_default",
      generated_at: 0,
      redaction_status: "metadata_only",
      render_safe: true,
      non_executable: true,
      truncated: false,
    });
    expectRuntimeSafe(first);
    expect(validateRuntimeDependencyViewerViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["runtime_dependency_viewer_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("includes command_center as a read-only projection consumer", () => {
    const graph = createDefaultRuntimeDependencyViewerViewModel();

    expect(
      graph.nodes.find((node) => node.node_id === "command_center"),
    ).toMatchObject({
      module_class: "command_center",
      label_class: "viewer",
    });
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: "command_center",
          edge_class: "read_only_projection",
          render_safe: true,
        }),
      ]),
    );
  });

  it("derives expected nodes and edges from safe runtime dependency responses", () => {
    const graph = deriveRuntimeDependencyViewerFromObservabilityResponse(
      safeRuntimeEnvelope(),
    );
    const edge = graph.edges.find(
      (item) => item.from === "router" && item.to === "command_center",
    );

    expect(graph).toMatchObject({
      graph_id: "runtime_dependency:observed_overlay",
      generated_at: 144,
      redaction_status: "metadata_only",
      withheld_fields: ["source_code"],
      truncated: false,
    });
    expect(graph.nodes.find((node) => node.node_id === "router")).toMatchObject(
      {
        module_class: "router",
        label_class: "module",
      },
    );
    expect(edge).toMatchObject({
      edge_class: "read_only_projection",
      observed_count_bin: "high",
      coupling_risk_class: "medium",
      render_safe: true,
      non_executable: true,
    });
  });

  it("falls back to default graph for unsafe runtime dependency responses", () => {
    const graph = deriveRuntimeDependencyViewerFromObservabilityResponse({
      ...safeRuntimeEnvelope(),
      raw_prompt: "unsafe",
    });
    const sourceGraph = deriveRuntimeDependencyViewerFromObservabilityResponse({
      ...safeRuntimeEnvelope(),
      source_code: "const secret = true",
    });

    expect(graph).toEqual(createDefaultRuntimeDependencyViewerViewModel());
    expect(sourceGraph).toEqual(
      createDefaultRuntimeDependencyViewerViewModel(),
    );
  });

  it("fails validation for unknown module, edge, and risk classes", () => {
    const graph = createDefaultRuntimeDependencyViewerViewModel();

    expect(
      validateRuntimeDependencyViewerViewModel({
        ...graph,
        nodes: [
          { ...graph.nodes[0], module_class: "filesystem" },
          ...graph.nodes.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateRuntimeDependencyViewerViewModel({
        ...graph,
        edges: [
          { ...graph.edges[0], edge_class: "dynamic_execute" },
          ...graph.edges.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateRuntimeDependencyViewerViewModel({
        ...graph,
        edges: [
          { ...graph.edges[0], coupling_risk_class: "critical" },
          ...graph.edges.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
  });

  it("fails validation for edges pointing to missing nodes", () => {
    const graph = createDefaultRuntimeDependencyViewerViewModel();
    const validation = validateRuntimeDependencyViewerViewModel({
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

  it("fails closed for raw payload and source-code fields", () => {
    const graph = createDefaultRuntimeDependencyViewerViewModel();
    const validation = validateRuntimeDependencyViewerViewModel({
      ...graph,
      raw_tool_args: "unsafe",
      source_code: "const unsafe = true",
      code_body: "function nope() {}",
      file_body: "secret body",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "raw_payload_field_present",
        "source_code_field_present",
        "schema_rejected",
      ]),
      withheld_fields: expect.arrayContaining([
        "raw_tool_args",
        "source_code",
        "code_body",
        "file_body",
      ]),
      implementation_body_included: false,
      render_safe: false,
    });
  });

  it("fails closed for executable run/retry affordance keys", () => {
    const graph = createDefaultRuntimeDependencyViewerViewModel();
    const validation = validateRuntimeDependencyViewerViewModel({
      ...graph,
      retry_trace: "forbidden",
      execute_affordance_allowed: true,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "schema_rejected",
      ]),
      withheld_fields: expect.arrayContaining([
        "retry_trace",
        "execute_affordance_allowed",
      ]),
      render_safe: false,
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    const graph = createDefaultRuntimeDependencyViewerViewModel();
    const validation = validateRuntimeDependencyViewerViewModel({
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

  it("contains no source code and no execution hooks", () => {
    const graph = deriveRuntimeDependencyViewerFromObservabilityResponse(
      safeRuntimeEnvelope(),
    );
    const keys = collectObjectKeys(graph);

    expect(keys).not.toEqual(
      expect.arrayContaining([
        "source_code",
        "code_body",
        "file_body",
        "tool_execution_hook",
        "routine_hook",
        "approval_hook",
        "retry_button",
        "run_button",
      ]),
    );
    expectRuntimeSafe(graph);
  });

  it("exports runtime dependency helpers from command-center index", () => {
    expect(typeof createDefaultRuntimeDependencyViewerViewModel).toBe(
      "function",
    );
    expect(typeof validateRuntimeDependencyViewerViewModel).toBe("function");
    expect(typeof deriveRuntimeDependencyViewerFromObservabilityResponse).toBe(
      "function",
    );
    expect(
      RuntimeDependencyViewerViewModelSchema.parse(
        createDefaultRuntimeDependencyViewerViewModel(),
      ),
    ).toEqual(createDefaultRuntimeDependencyViewerViewModel());
  });
});
