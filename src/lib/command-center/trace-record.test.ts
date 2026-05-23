import { describe, expect, it } from "vitest";

import {
  TraceRecordSchema,
  createDefaultTraceRecord,
  normalizeTraceRecordFromSafeMetadata,
  validateTraceRecord,
} from "./index";

function safeTraceMetadata(overrides: Record<string, unknown> = {}) {
  return {
    trace_id: "trace:9f1",
    session_id: "session:9f1",
    ts_start: 100,
    ts_end: 140,
    origin: "tool_call",
    redaction_status: "metadata_only",
    nodes: [
      {
        node_id: "trace:9f1:origin",
        kind: "origin",
        label_class: "source",
        subsystem_class: "tools",
        metadata: {
          summary_class: "metadata_only",
          status_class: "succeeded",
          confidence_band: "high",
          count_bin: "low",
          metadata_only: true,
        },
        gate: {
          gate_kind: "safety",
          gate_decision_class: "allowed",
        },
      },
      {
        node_id: "trace:9f1:result",
        kind: "result",
        label_class: "result",
        subsystem_class: "tools",
        metadata: {
          summary_class: "redacted",
          status_class: "succeeded",
          metadata_only: true,
        },
      },
    ],
    edges: [
      {
        from: "trace:9f1:origin",
        to: "trace:9f1:result",
        gate_decision_class: "allowed",
        dropped_reason_class: "none",
      },
    ],
    withheld_fields: ["raw_prompt"],
    truncated: false,
    ...overrides,
  };
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

describe("Phase 9F1 unified replay TraceRecord contract", () => {
  it("creates a deterministic, safe, serializable default TraceRecord", () => {
    const first = createDefaultTraceRecord();
    const second = createDefaultTraceRecord();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(TraceRecordSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.trace_record",
      phase: "9F1",
      trace_id: "trace:default",
      replay_safe: true,
      render_safe: true,
      non_executable: true,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      routine_scheduled: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateTraceRecord(first)).toMatchObject({
      passed: true,
      reasons: ["trace_record_valid"],
      mutated_input: false,
    });
  });

  it("normalizes safe metadata into an expected TraceRecord", () => {
    const record = normalizeTraceRecordFromSafeMetadata(safeTraceMetadata());

    expect(record).toMatchObject({
      trace_id: "trace:9f1",
      session_id: "session:9f1",
      ts_start: 100,
      ts_end: 140,
      origin: "tool_call",
      replay_safe: true,
      render_safe: true,
      non_executable: true,
      redaction_status: "metadata_only",
    });
    expect(record.nodes).toHaveLength(2);
    expect(record.nodes[0]).toMatchObject({
      node_id: "trace:9f1:origin",
      kind: "origin",
      label_class: "source",
      subsystem_class: "tools",
      metadata: {
        summary_class: "metadata_only",
        status_class: "succeeded",
        confidence_band: "high",
        count_bin: "low",
        raw_payloads_included: false,
      },
      gate: {
        gate_kind: "safety",
        gate_decision_class: "allowed",
        non_executable: true,
      },
    });
    expect(record.edges).toEqual([
      {
        from: "trace:9f1:origin",
        to: "trace:9f1:result",
        gate_decision_class: "allowed",
        dropped_reason_class: "none",
        replay_safe: true,
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
      },
    ]);
  });

  it("falls back to the default trace for unsafe raw metadata", () => {
    expect(
      normalizeTraceRecordFromSafeMetadata({
        ...safeTraceMetadata(),
        raw_prompt: "withheld",
      }),
    ).toEqual(createDefaultTraceRecord());
    expect(
      normalizeTraceRecordFromSafeMetadata({
        ...safeTraceMetadata(),
        executable_payload: { run: true },
      }),
    ).toEqual(createDefaultTraceRecord());
  });

  it("fails validation for raw payload fields", () => {
    const record = {
      ...createDefaultTraceRecord(),
      raw_tool_args: { unsafe: true },
    };

    expect(validateTraceRecord(record)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
      ]),
      withheld_fields: ["raw_tool_args"],
      render_safe: false,
      replay_safe: false,
    });
  });

  it("fails validation for executable affordance keys", () => {
    const record = {
      ...createDefaultTraceRecord(),
      run_trace: true,
      retry: true,
      approve: true,
      execute: true,
      rerun_routine: true,
    };

    expect(validateTraceRecord(record)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "run_trace",
        "retry",
        "approve",
        "execute",
        "rerun_routine",
      ]),
    });
  });

  it("fails validation for callbacks and non-serializable values", () => {
    const record = {
      ...createDefaultTraceRecord(),
      on_execute: () => undefined,
    };

    expect(validateTraceRecord(record)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
        "non_serializable_value",
      ]),
      withheld_fields: ["on_execute"],
    });
  });

  it("fails validation for unknown origin, node, and gate kinds", () => {
    const record = normalizeTraceRecordFromSafeMetadata(safeTraceMetadata());
    const validation = validateTraceRecord({
      ...record,
      origin: "unknown_origin",
      nodes: [
        {
          ...record.nodes[0],
          kind: "unknown_node",
          gate: {
            gate_kind: "unknown_gate",
            gate_decision_class: "allowed",
            metadata_only: true,
            non_executable: true,
          },
        },
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_enum_value",
      ]),
    });
  });

  it("fails validation for edges pointing to missing nodes", () => {
    const record = normalizeTraceRecordFromSafeMetadata(safeTraceMetadata());

    expect(
      validateTraceRecord({
        ...record,
        edges: [
          {
            ...record.edges[0],
            to: "trace:9f1:missing",
          },
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["missing_edge_node"]),
    });
  });

  it("requires replay_safe, render_safe, and non_executable to stay true", () => {
    const record = createDefaultTraceRecord();

    expect(
      validateTraceRecord({
        ...record,
        replay_safe: false,
        render_safe: false,
        non_executable: false,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "replay_not_safe",
        "render_not_safe",
        "not_non_executable",
      ]),
    });
  });

  it("contains no raw content keys or execution hooks", () => {
    const record = normalizeTraceRecordFromSafeMetadata(safeTraceMetadata());
    const keys = collectObjectKeys(record);

    expect(keys).not.toEqual(
      expect.arrayContaining([
        "tool_args",
        "raw_tool_args",
        "prompt",
        "raw_prompt",
        "model_output",
        "raw_model_output",
        "ocr_text",
        "raw_ocr_text",
        "frame",
        "raw_frame",
        "voice_transcript",
        "raw_audio",
        "project_file_body",
        "memory_content",
        "secret",
        "api_key",
        "token",
        "exact_pii",
        "run",
        "retry",
        "approve",
        "execute",
        "on_execute",
        "on_retry",
      ]),
    );
  });

  it("exports TraceRecord helpers from command-center index", () => {
    expect(typeof createDefaultTraceRecord).toBe("function");
    expect(typeof normalizeTraceRecordFromSafeMetadata).toBe("function");
    expect(typeof validateTraceRecord).toBe("function");
    expect(TraceRecordSchema.parse(createDefaultTraceRecord())).toEqual(
      createDefaultTraceRecord(),
    );
  });
});
