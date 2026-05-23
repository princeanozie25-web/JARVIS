import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES,
  CommandCenterObservabilityQueryRequestSchema,
  CommandCenterObservabilityResponseEnvelopeSchema,
  createCommandCenterObservabilityQueryRequest,
  createCommandCenterObservabilityResponseEnvelope,
  validateCommandCenterObservabilityAction,
  validateCommandCenterObservabilityQueryRequest,
  type CommandCenterObservabilityQueryCategory,
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

describe("Phase 9B1 command center read-only observability API contract", () => {
  it("represents every allowed category as a read-only query", () => {
    for (const category of COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES) {
      const request = createCommandCenterObservabilityQueryRequest({
        query_id: `query:${category}`,
        category,
        time_window: "recent",
        max_items: 10,
      });

      expect(request).toMatchObject({
        kind: "command_center.observability_query_request",
        query_id: `query:${category}`,
        category,
        time_window: "recent",
        max_items: 10,
        redaction_required: true,
        mode: "read_only",
        metadata_only: true,
        raw_payloads_allowed: false,
      });
      expect(validateCommandCenterObservabilityQueryRequest(request)).toEqual({
        passed: true,
        reason: "read_only_metadata_query",
        query_id: `query:${category}`,
        category,
        read_only: true,
        metadata_only: true,
        redaction_required: true,
        raw_payloads_included: false,
        exact_pii_included: false,
        ...SIDE_EFFECT_FALSES,
      });
    }
  });

  it("requires mode read_only", () => {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:router",
      category: "router",
    });
    const validation = validateCommandCenterObservabilityQueryRequest({
      ...request,
      mode: "execute",
    });

    expect(
      CommandCenterObservabilityQueryRequestSchema.safeParse({
        ...request,
        mode: "execute",
      }).success,
    ).toBe(false);
    expect(validation).toMatchObject({
      passed: false,
      reason: "mode_not_read_only",
      query_id: "query:router",
      category: "router",
      read_only: false,
      redaction_required: true,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("requires redaction_required true", () => {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:safety",
      category: "safety",
    });
    const validation = validateCommandCenterObservabilityQueryRequest({
      ...request,
      redaction_required: false,
    });

    expect(validation).toMatchObject({
      passed: false,
      reason: "redaction_not_required",
      query_id: "query:safety",
      category: "safety",
      read_only: true,
      redaction_required: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("rejects mutating, execution, approval, routine, device, cloud, export, and remote actions", () => {
    for (const action of COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS) {
      expect(validateCommandCenterObservabilityAction(action)).toEqual({
        action,
        allowed: false,
        reason: "forbidden_action",
        read_only_query_action: false,
        mutating_action: false,
        metadata_only: true,
        ...SIDE_EFFECT_FALSES,
      });
    }

    expect(
      validateCommandCenterObservabilityAction("read_query"),
    ).toMatchObject({
      allowed: true,
      reason: "read_only_metadata_query",
      read_only_query_action: true,
    });
    expect(validateCommandCenterObservabilityAction("mystery")).toMatchObject({
      allowed: false,
      reason: "unknown_action",
      read_only_query_action: false,
    });
  });

  it("fails closed for unknown categories", () => {
    const validation = validateCommandCenterObservabilityQueryRequest({
      kind: "command_center.observability_query_request",
      query_id: "query:unknown",
      category: "raw_logs",
      time_window: "latest",
      max_items: 10,
      redaction_required: true,
      mode: "read_only",
      metadata_only: true,
      raw_payloads_allowed: false,
    });

    expect(validation).toMatchObject({
      passed: false,
      reason: "schema_rejected",
      query_id: "query:unknown",
      category: null,
      read_only: true,
      redaction_required: true,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("creates serializable response envelopes with redaction, withheld, truncation, replay, and render metadata", () => {
    const envelope = createCommandCenterObservabilityResponseEnvelope({
      query_id: "query:traces",
      category: "traces",
      generated_at: 123,
      truncated: true,
      payload: [
        {
          item_id: "trace:one",
          item_class: "trace_summary",
          status: "redacted",
          count_band: "low",
          redaction_status: "redacted",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
    });

    expect(envelope).toMatchObject({
      kind: "command_center.observability_response_envelope",
      query_id: "query:traces",
      category: "traces",
      generated_at: 123,
      redaction_status: "metadata_only",
      withheld_fields: [...COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS],
      truncated: true,
      replay_safe: true,
      render_safe: true,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
    });
    expect(JSON.parse(JSON.stringify(envelope))).toEqual(envelope);
  });

  it("does not allow query contracts or response envelopes to represent raw payload fields", () => {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:vision",
      category: "vision",
    });
    for (const field of COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS) {
      const validation = validateCommandCenterObservabilityQueryRequest({
        ...request,
        [field]: "unsafe",
      });

      expect(validation).toMatchObject({
        passed: false,
        reason: "raw_payload_field_present",
        raw_payloads_included: false,
        exact_pii_included: false,
        ...SIDE_EFFECT_FALSES,
      });
    }

    expect(
      CommandCenterObservabilityResponseEnvelopeSchema.safeParse({
        ...createCommandCenterObservabilityResponseEnvelope({
          query_id: "query:projects",
          category: "projects",
        }),
        project_file_body: "unsafe",
      }).success,
    ).toBe(false);
  });

  it("keeps all new exports available from the command-center index", () => {
    const category: CommandCenterObservabilityQueryCategory =
      "runtime_dependencies";
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:runtime_dependencies",
      category,
    });
    const envelope = createCommandCenterObservabilityResponseEnvelope({
      query_id: request.query_id,
      category: request.category,
    });

    expect(CommandCenterObservabilityQueryRequestSchema.parse(request)).toEqual(
      request,
    );
    expect(
      CommandCenterObservabilityResponseEnvelopeSchema.parse(envelope),
    ).toEqual(envelope);
    expect(typeof validateCommandCenterObservabilityQueryRequest).toBe(
      "function",
    );
    expect(typeof validateCommandCenterObservabilityAction).toBe("function");
  });
});
