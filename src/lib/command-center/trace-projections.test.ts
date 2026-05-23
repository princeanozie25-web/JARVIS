import { describe, expect, it } from "vitest";

import {
  createDefaultAuditReplayViewerViewModel,
  createDefaultTraceRecord,
  normalizeTraceRecordFromSafeMetadata,
  projectTraceRecordToReplayViewer,
  projectTraceRecordToTimelineItem,
  projectTraceRecordsToTimelineViewModel,
} from "./index";

function safeTrace(overrides: Record<string, unknown> = {}) {
  return normalizeTraceRecordFromSafeMetadata({
    trace_id: "trace:projection",
    session_id: "session:projection",
    ts_start: 100,
    ts_end: 150,
    origin: "tool_call",
    redaction_status: "metadata_only",
    nodes: [
      {
        node_id: "trace:projection:origin",
        kind: "origin",
        label_class: "source",
        subsystem_class: "tools",
        metadata: {
          summary_class: "metadata_only",
          status_class: "succeeded",
          confidence_band: "high",
          count_bin: "low",
        },
        gate: {
          gate_kind: "safety",
          gate_decision_class: "allowed",
        },
      },
      {
        node_id: "trace:projection:result",
        kind: "result",
        label_class: "result",
        subsystem_class: "tools",
        metadata: {
          summary_class: "redacted",
          status_class: "succeeded",
        },
      },
    ],
    edges: [
      {
        from: "trace:projection:origin",
        to: "trace:projection:result",
        gate_decision_class: "allowed",
        dropped_reason_class: "none",
      },
    ],
    withheld_fields: ["raw_prompt"],
    truncated: false,
    ...overrides,
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

describe("Phase 9F2 trace projection adapters", () => {
  it("projects a valid TraceRecord to a timeline item", () => {
    const trace = safeTrace();
    const item = projectTraceRecordToTimelineItem(trace);

    expect(item).toMatchObject({
      trace_id: "trace:projection",
      origin: "tool_call",
      timestamp_band: "session",
      duration_band: "low",
      status_class: "succeeded",
      gate_decision_class: "allowed",
      subsystem_class: "tools",
      redaction_status: "metadata_only",
      replay_safe: true,
      render_safe: true,
      non_executable: true,
      raw_payloads_included: false,
      action_executed: false,
      tool_called: false,
    });
  });

  it("projects a valid TraceRecord to a replay viewer", () => {
    const viewer = projectTraceRecordToReplayViewer(safeTrace());

    expect(viewer).toMatchObject({
      replay_id: "audit_replay_viewer:trace:projection",
      trace_id: "trace:projection",
      generated_at: 150,
      redaction_status: "metadata_only",
      replay_safe: true,
      render_safe: true,
      non_executable: true,
      raw_payloads_included: false,
    });
    expect(viewer.nodes).toHaveLength(2);
    expect(viewer.nodes[0]).toMatchObject({
      node_id: "trace:projection:origin",
      kind: "origin",
      metadata_summary_class: "metadata_only",
      gate_decision_class: "allowed",
      non_executable: true,
    });
    expect(viewer.edges).toEqual([
      {
        from: "trace:projection:origin",
        to: "trace:projection:result",
        gate_decision_class: "allowed",
        dropped_reason_class: "none",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
      },
    ]);
  });

  it("fails closed for invalid TraceRecords", () => {
    const invalid = {
      ...createDefaultTraceRecord(),
      replay_safe: false,
      raw_prompt: "withheld",
    };

    expect(projectTraceRecordToTimelineItem(invalid)).toMatchObject({
      trace_id: "trace:withheld",
      redaction_status: "fully_withheld",
      replay_safe: false,
      render_safe: true,
      non_executable: true,
      raw_payloads_included: false,
      truncated: true,
    });
    expect(projectTraceRecordToReplayViewer(invalid)).toEqual(
      createDefaultAuditReplayViewerViewModel(),
    );
  });

  it("projects multiple traces deterministically by timestamp", () => {
    const latest = safeTrace({
      trace_id: "trace:latest",
      ts_start: 300,
      ts_end: 310,
    });
    const earliest = safeTrace({
      trace_id: "trace:earliest",
      ts_start: 10,
      ts_end: 20,
    });
    const sameTime = safeTrace({
      trace_id: "trace:same_time",
      ts_start: 300,
      ts_end: 320,
    });

    const first = projectTraceRecordsToTimelineViewModel([
      latest,
      earliest,
      sameTime,
    ]);
    const second = projectTraceRecordsToTimelineViewModel([
      latest,
      earliest,
      sameTime,
    ]);

    expect(first).toEqual(second);
    expect(first.items.map((item) => item.trace_id)).toEqual([
      "trace:earliest",
      "trace:latest",
      "trace:same_time",
    ]);
    expect(first.replay_safe_count).toBe(3);
  });

  it("withholds and counts unsafe traces", () => {
    const viewModel = projectTraceRecordsToTimelineViewModel([
      safeTrace(),
      {
        ...createDefaultTraceRecord(),
        trace_id: "trace:unsafe",
        raw_tool_args: { unsafe: true },
      },
    ]);

    expect(viewModel.items.map((item) => item.trace_id)).toEqual([
      "trace:projection",
    ]);
    expect(viewModel).toMatchObject({
      truncated: true,
      replay_safe_count: 1,
      render_safe: true,
      non_executable: true,
    });
    expect(viewModel.withheld_fields).toEqual(
      expect.arrayContaining(["raw_tool_args", "unsafe_trace_count:1"]),
    );
  });

  it("does not project raw payload fields", () => {
    const item = projectTraceRecordToTimelineItem({
      ...createDefaultTraceRecord(),
      raw_model_output: "withheld",
    });
    const viewer = projectTraceRecordToReplayViewer({
      ...createDefaultTraceRecord(),
      project_file_body: "withheld",
    });

    expect(collectObjectKeys(item)).not.toEqual(
      expect.arrayContaining(["raw_model_output"]),
    );
    expect(collectObjectKeys(viewer)).not.toEqual(
      expect.arrayContaining(["project_file_body"]),
    );
  });

  it("does not project executable run, retry, approve, or rerun keys", () => {
    const projected = projectTraceRecordsToTimelineViewModel([
      {
        ...createDefaultTraceRecord(),
        execute_tool: true,
        run_trace: true,
        retry_trace: true,
        approve: true,
        rerun_routine: true,
      },
    ]);

    expect(projected.items).toEqual([]);
    expect(projected.withheld_fields).toEqual(
      expect.arrayContaining([
        "execute_tool",
        "run_trace",
        "retry_trace",
        "approve",
        "rerun_routine",
        "unsafe_trace_count:1",
      ]),
    );
  });

  it("does not mutate projection inputs", () => {
    const trace = safeTrace();
    const before = JSON.stringify(trace);

    projectTraceRecordToTimelineItem(trace);
    projectTraceRecordToReplayViewer(trace);
    projectTraceRecordsToTimelineViewModel([trace]);

    expect(JSON.stringify(trace)).toBe(before);
  });

  it("keeps replay projection non-executable", () => {
    const viewer = projectTraceRecordToReplayViewer(safeTrace());

    expect(viewer).toMatchObject({
      non_executable: true,
      run_affordance_allowed: false,
      retry_affordance_allowed: false,
      replay_affordance_allowed: false,
      execute_affordance_allowed: false,
      graph_execution_allowed: false,
      tool_actions_allowed: false,
      routine_actions_allowed: false,
      approval_actions_allowed: false,
      action_executed: false,
      approval_granted: false,
      routine_triggered: false,
      tool_called: false,
    });
  });

  it("exports trace projection helpers from command-center index", () => {
    expect(typeof projectTraceRecordToTimelineItem).toBe("function");
    expect(typeof projectTraceRecordToReplayViewer).toBe("function");
    expect(typeof projectTraceRecordsToTimelineViewModel).toBe("function");
  });
});
