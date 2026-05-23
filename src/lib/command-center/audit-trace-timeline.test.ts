import { describe, expect, it } from "vitest";

import {
  AuditTraceTimelineItemSchema,
  AuditTraceTimelineViewModelSchema,
  createCommandCenterObservabilityResponseEnvelope,
  createDefaultAuditTraceTimelineViewModel,
  deriveAuditTraceTimelineFromObservabilityResponses,
  validateAuditTraceTimelineItem,
  validateAuditTraceTimelineViewModel,
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

function expectTimelineSafe(input: Record<string, unknown>) {
  expect(input).toMatchObject({
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    run_affordance_allowed: false,
    retry_affordance_allowed: false,
    execute_affordance_allowed: false,
    graph_execution_allowed: false,
    ...SIDE_EFFECT_FALSES,
  });
}

function safeTraceEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ...createCommandCenterObservabilityResponseEnvelope({
      query_id: "audit:trace",
      category: "traces",
      generated_at: 90,
      payload: [
        {
          item_id: "trace:tool:1",
          item_class: "tool_call",
          status: "succeeded",
          count_band: "medium",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
        {
          item_id: "trace:routine:1",
          item_class: "routine_run",
          status: "blocked",
          count_band: "high",
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

describe("Phase 9E1 Audit trace timeline contract", () => {
  it("creates a deterministic, safe, empty, serializable default view model", () => {
    const first = createDefaultAuditTraceTimelineViewModel();
    const second = createDefaultAuditTraceTimelineViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(AuditTraceTimelineViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.audit_trace_timeline_view_model",
      phase: "9E1",
      timeline_id: "audit_trace_timeline:default",
      items: [],
      generated_at: 0,
      redaction_status: "metadata_only",
      render_safe: true,
      replay_safe_count: 0,
      truncated: false,
    });
    expectTimelineSafe(first);
    expect(validateAuditTraceTimelineViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["audit_trace_timeline_valid"],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("derives expected timeline items from safe trace observability responses", () => {
    const timeline = deriveAuditTraceTimelineFromObservabilityResponses([
      safeTraceEnvelope(),
    ]);

    expect(timeline).toMatchObject({
      timeline_id: "audit_trace_timeline:traces",
      generated_at: 90,
      redaction_status: "metadata_only",
      replay_safe_count: 2,
      withheld_fields: ["raw_tool_args"],
      truncated: false,
    });
    expect(timeline.items).toHaveLength(2);
    expect(timeline.items[0]).toMatchObject({
      trace_id: "trace:tool:1",
      origin: "tool_call",
      timestamp_band: "latest",
      duration_band: "medium",
      status_class: "succeeded",
      gate_decision_class: "allowed",
      subsystem_class: "tools",
      replay_safe: true,
      render_safe: true,
    });
    expect(timeline.items[1]).toMatchObject({
      trace_id: "trace:routine:1",
      origin: "routine_run",
      duration_band: "high",
      status_class: "blocked",
      gate_decision_class: "blocked",
      subsystem_class: "routines",
    });
    for (const item of timeline.items) expectTimelineSafe(item);
  });

  it("falls back to safe empty state for unsafe trace responses", () => {
    const timeline = deriveAuditTraceTimelineFromObservabilityResponses([
      safeTraceEnvelope({ raw_prompt: "unsafe" }),
    ]);

    expect(timeline).toEqual(createDefaultAuditTraceTimelineViewModel());
  });

  it("fails validation for unknown origins, statuses, and gate classes", () => {
    const item = deriveAuditTraceTimelineFromObservabilityResponses([
      safeTraceEnvelope(),
    ]).items[0];

    expect(
      validateAuditTraceTimelineItem({
        ...item,
        origin: "cron_job",
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
      render_safe: false,
    });
    expect(
      validateAuditTraceTimelineItem({
        ...item,
        status_class: "raw_status",
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
    expect(
      validateAuditTraceTimelineItem({
        ...item,
        gate_decision_class: "auto_execute",
      }),
    ).toMatchObject({
      passed: false,
      reasons: ["schema_rejected"],
    });
  });

  it("fails closed for raw payload fields", () => {
    const item = deriveAuditTraceTimelineFromObservabilityResponses([
      safeTraceEnvelope(),
    ]).items[0];
    const validation = validateAuditTraceTimelineItem({
      ...item,
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
      raw_payloads_included: false,
      mutated_input: false,
    });
  });

  it("fails closed for executable run/retry affordance keys", () => {
    const item = deriveAuditTraceTimelineFromObservabilityResponses([
      safeTraceEnvelope(),
    ]).items[0];
    const validation = validateAuditTraceTimelineItem({
      ...item,
      retry_trace: "forbidden",
      run_affordance_allowed: true,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "schema_rejected",
      ]),
      withheld_fields: expect.arrayContaining([
        "retry_trace",
        "run_affordance_allowed",
      ]),
      render_safe: false,
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    const timeline = createDefaultAuditTraceTimelineViewModel();
    const validation = validateAuditTraceTimelineViewModel({
      ...timeline,
      on_retry: () => undefined,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "executable_affordance_present",
        "non_serializable_value",
        "schema_rejected",
      ]),
      withheld_fields: ["on_retry"],
      render_safe: false,
      mutated_input: false,
    });
  });

  it("counts only safe replay-safe items", () => {
    const replaySafe = safeTraceEnvelope({ replay_safe: true });
    const replayUnsafe = safeTraceEnvelope({
      query_id: "audit:trace:unsafe_replay",
      replay_safe: false,
    });
    const timeline = deriveAuditTraceTimelineFromObservabilityResponses([
      replaySafe,
      replayUnsafe,
    ]);

    expect(timeline.items).toHaveLength(4);
    expect(timeline.replay_safe_count).toBe(2);
    expect(timeline.items.filter((item) => item.replay_safe)).toHaveLength(2);
  });

  it("contains no action, tool, routine, approval, or graph execution hooks", () => {
    const timeline = deriveAuditTraceTimelineFromObservabilityResponses([
      safeTraceEnvelope(),
    ]);
    const serialized = JSON.stringify(timeline);

    expect(serialized).not.toContain("tool_execution_hook");
    expect(serialized).not.toContain("routine_hook");
    expect(serialized).not.toContain("approval_hook");
    expect(serialized).not.toContain("graph_execute");
    expect(serialized).not.toContain("retry_trace");
    expect(serialized).not.toContain("run_trace");
    expectTimelineSafe(timeline);
    for (const item of timeline.items) {
      expect(AuditTraceTimelineItemSchema.parse(item)).toEqual(item);
      expectTimelineSafe(item);
    }
  });

  it("exports trace timeline helpers from the command-center index", () => {
    expect(typeof createDefaultAuditTraceTimelineViewModel).toBe("function");
    expect(typeof validateAuditTraceTimelineItem).toBe("function");
    expect(typeof validateAuditTraceTimelineViewModel).toBe("function");
    expect(typeof deriveAuditTraceTimelineFromObservabilityResponses).toBe(
      "function",
    );
    expect(
      AuditTraceTimelineViewModelSchema.parse(
        createDefaultAuditTraceTimelineViewModel(),
      ),
    ).toEqual(createDefaultAuditTraceTimelineViewModel());
  });
});
