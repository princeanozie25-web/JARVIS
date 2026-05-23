import { describe, expect, it } from "vitest";

import {
  AuditReplayViewerViewModelSchema,
  createCommandCenterObservabilityResponseEnvelope,
  createDefaultAuditReplayViewerViewModel,
  deriveAuditReplayViewerFromTraceMetadata,
  validateAuditReplayViewerViewModel,
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

function safeTraceEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ...createCommandCenterObservabilityResponseEnvelope({
      query_id: "audit:replay",
      category: "traces",
      generated_at: 101,
      payload: [
        {
          item_id: "trace:tool:replay",
          item_class: "tool_call",
          status: "blocked",
          count_band: "low",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      withheld_fields: ["raw_tool_args"],
      replay_safe: true,
    }),
    ...overrides,
  };
}

function expectReplaySafe(input: Record<string, unknown>) {
  expect(input).toMatchObject({
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    ...SIDE_EFFECT_FALSES,
  });
}

describe("Phase 9E2 Audit replay viewer contract", () => {
  it("creates a deterministic, empty, safe, serializable default replay viewer", () => {
    const first = createDefaultAuditReplayViewerViewModel();
    const second = createDefaultAuditReplayViewerViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(AuditReplayViewerViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.audit_replay_viewer_view_model",
      phase: "9E2",
      replay_id: "audit_replay_viewer:default",
      trace_id: "trace:none",
      nodes: [],
      edges: [],
      generated_at: 0,
      redaction_status: "metadata_only",
      render_safe: true,
      replay_safe: false,
      truncated: false,
      non_executable: true,
    });
    expectReplaySafe(first);
    expect(validateAuditReplayViewerViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["audit_replay_viewer_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("derives expected nodes and edges from safe trace metadata", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());

    expect(viewer).toMatchObject({
      replay_id: "audit_replay_viewer:trace:tool:replay",
      trace_id: "trace:tool:replay",
      generated_at: 101,
      redaction_status: "metadata_only",
      replay_safe: true,
      withheld_fields: ["raw_tool_args"],
      truncated: false,
    });
    expect(viewer.nodes.map((node) => node.kind)).toEqual([
      "origin",
      "provider",
      "safety_gate",
      "result",
    ]);
    expect(viewer.nodes[0]).toMatchObject({
      node_id: "trace:tool:replay:origin",
      label_class: "source",
      subsystem_class: "tools",
      status_class: "blocked",
      gate_decision_class: "blocked",
      render_safe: true,
    });
    expect(viewer.edges).toEqual([
      {
        from: "trace:tool:replay:origin",
        to: "trace:tool:replay:provider",
        gate_decision_class: "allowed",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
      },
      {
        from: "trace:tool:replay:provider",
        to: "trace:tool:replay:safety_gate",
        gate_decision_class: "blocked",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
      },
      {
        from: "trace:tool:replay:safety_gate",
        to: "trace:tool:replay:result",
        gate_decision_class: "blocked",
        dropped_reason_class: "safety_gate",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
      },
    ]);
    for (const node of viewer.nodes) expectReplaySafe(node);
  });

  it("falls back to safe empty state for unsafe trace metadata", () => {
    const viewer = deriveAuditReplayViewerFromTraceMetadata({
      ...safeTraceEnvelope(),
      raw_prompt: "unsafe",
    });

    expect(viewer).toEqual(createDefaultAuditReplayViewerViewModel());
  });

  it("fails validation for unknown node kinds, statuses, and gate classes", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());

    expect(
      validateAuditReplayViewerViewModel({
        ...viewer,
        nodes: [
          { ...viewer.nodes[0], kind: "timer" },
          ...viewer.nodes.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
      render_safe: false,
    });
    expect(
      validateAuditReplayViewerViewModel({
        ...viewer,
        nodes: [
          { ...viewer.nodes[0], status_class: "raw_status" },
          ...viewer.nodes.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateAuditReplayViewerViewModel({
        ...viewer,
        nodes: [
          { ...viewer.nodes[0], gate_decision_class: "auto_execute" },
          ...viewer.nodes.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
  });

  it("fails validation for edges pointing to missing nodes", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());
    const validation = validateAuditReplayViewerViewModel({
      ...viewer,
      edges: [{ ...viewer.edges[0], to: "missing:node" }],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: ["missing_edge_node"],
      render_safe: false,
    });
  });

  it("fails closed for raw payload fields", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());
    const validation = validateAuditReplayViewerViewModel({
      ...viewer,
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

  it("fails closed for executable run, retry, and replay affordance keys", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());
    const validation = validateAuditReplayViewerViewModel({
      ...viewer,
      retry_trace: "forbidden",
      replay_affordance_allowed: true,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "schema_rejected",
      ]),
      withheld_fields: expect.arrayContaining([
        "retry_trace",
        "replay_affordance_allowed",
      ]),
      render_safe: false,
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());
    const validation = validateAuditReplayViewerViewModel({
      ...viewer,
      on_replay: () => undefined,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "non_serializable_value",
        "schema_rejected",
      ]),
      withheld_fields: ["on_replay"],
      render_safe: false,
    });
  });

  it("fails validation when non_executable is false", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());
    const validation = validateAuditReplayViewerViewModel({
      ...viewer,
      non_executable: false,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "not_non_executable",
      ]),
      render_safe: false,
    });
  });

  it("contains no action hooks, execution hooks, graph hooks, or retry buttons", () => {
    const viewer =
      deriveAuditReplayViewerFromTraceMetadata(safeTraceEnvelope());
    const serialized = JSON.stringify(viewer);

    expect(serialized).not.toContain("tool_execution_hook");
    expect(serialized).not.toContain("routine_hook");
    expect(serialized).not.toContain("approval_hook");
    expect(serialized).not.toContain("graph_execute");
    expect(serialized).not.toContain("retry_button");
    expect(serialized).not.toContain("run_button");
    expect(serialized).not.toContain("replay_button");
    expectReplaySafe(viewer);
  });

  it("exports replay viewer helpers from the command-center index", () => {
    expect(typeof createDefaultAuditReplayViewerViewModel).toBe("function");
    expect(typeof validateAuditReplayViewerViewModel).toBe("function");
    expect(typeof deriveAuditReplayViewerFromTraceMetadata).toBe("function");
    expect(
      AuditReplayViewerViewModelSchema.parse(
        createDefaultAuditReplayViewerViewModel(),
      ),
    ).toEqual(createDefaultAuditReplayViewerViewModel());
  });
});
