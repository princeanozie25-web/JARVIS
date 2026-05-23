import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES,
  createCommandCenterObservabilityQueryRequest,
  listCommandCenterObservabilityAllowedCategories,
  listCommandCenterObservabilityReplayCompatibleCategories,
  validateObservabilityPayloadSafety,
  wrapObservabilityResponse,
  type CommandCenterObservabilityQueryCategory,
} from "./index";

function safePayload() {
  return [
    {
      item_id: "router:item:1",
      item_class: "router_status",
      status: "ok",
      count_band: "low",
      latency_band: "short",
      confidence_band: "high",
      cost_bin: "none",
      gate_decision: "allowed",
      subsystem_id: "router",
      metadata_only: true,
    },
  ];
}

describe("Phase 9B2 observability redaction and render-safe payload guards", () => {
  it("passes allowed metadata-only payloads", () => {
    const validation = validateObservabilityPayloadSafety(safePayload());

    expect(validation).toEqual({
      passed: true,
      reason: "metadata_only_payload",
      withheld_fields: [],
      notes: ["payload_metadata_only"],
      metadata_only: true,
      render_safe: true,
      replay_safe_candidate: true,
      raw_payloads_included: false,
      exact_pii_included: false,
      mutated_input: false,
    });
  });

  it("fails closed for every forbidden raw payload field", () => {
    for (const field of COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES) {
      const validation = validateObservabilityPayloadSafety({
        item_id: "unsafe:item",
        item_class: "unsafe",
        [field]: "secret",
      });

      expect(validation).toMatchObject({
        passed: false,
        reason: "forbidden_raw_field",
        withheld_fields: [field],
        render_safe: false,
        replay_safe_candidate: false,
        raw_payloads_included: false,
        exact_pii_included: false,
        mutated_input: false,
      });
    }
  });

  it("detects nested forbidden fields", () => {
    const validation = validateObservabilityPayloadSafety({
      item_id: "vision:item",
      nested: {
        summary: {
          raw_camera_frame: "base64-nope",
        },
      },
    });

    expect(validation).toMatchObject({
      passed: false,
      reason: "forbidden_raw_field",
      withheld_fields: ["nested.summary.raw_camera_frame"],
      render_safe: false,
      replay_safe_candidate: false,
    });
  });

  it("fails closed for non-serializable values and unsafe shapes", () => {
    expect(
      validateObservabilityPayloadSafety({
        item_id: "nonserializable:function",
        callback: () => undefined,
      }),
    ).toMatchObject({
      passed: false,
      reason: "non_serializable_value",
      notes: ["non_serializable:callback"],
    });

    const cyclic: { item_id: string; self?: unknown } = {
      item_id: "nonserializable:cycle",
    };
    cyclic.self = cyclic;
    expect(validateObservabilityPayloadSafety(cyclic)).toMatchObject({
      passed: false,
      reason: "non_serializable_value",
      notes: ["non_serializable_cycle:self"],
    });

    expect(validateObservabilityPayloadSafety(undefined)).toMatchObject({
      passed: false,
      reason: "unsafe_payload_shape",
      notes: ["payload_missing"],
    });
  });

  it("does not mutate input payloads", () => {
    const payload = {
      item_id: "stable:item",
      item_class: "stable",
      nested: { status: "ok" },
    };
    const before = JSON.stringify(payload);

    const validation = validateObservabilityPayloadSafety(payload);

    expect(JSON.stringify(payload)).toBe(before);
    expect(validation.mutated_input).toBe(false);
  });

  it("wraps safe payloads as render-safe response envelopes", () => {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:router",
      category: "router",
    });
    const envelope = wrapObservabilityResponse({
      request,
      payload: safePayload(),
      generated_at: 42,
    });

    expect(envelope).toMatchObject({
      query_id: "query:router",
      category: "router",
      generated_at: 42,
      redaction_status: "metadata_only",
      withheld_fields: [],
      truncated: false,
      replay_safe: false,
      render_safe: true,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
    });
    expect(envelope.payload).toEqual([
      {
        item_id: "router:item:1",
        item_class: "router_status",
        status: "ok",
        count_band: "low",
        redaction_status: "metadata_only",
        metadata_only: true,
        raw_payload_included: false,
      },
    ]);
  });

  it("withholds unsafe payloads and marks render_safe false", () => {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:vision",
      category: "vision",
    });
    const envelope = wrapObservabilityResponse({
      request,
      payload: [{ item_id: "vision:item", raw_screenshot: "unsafe" }],
    });

    expect(envelope).toMatchObject({
      query_id: "query:vision",
      category: "vision",
      redaction_status: "fully_withheld",
      payload: [],
      withheld_fields: ["0.raw_screenshot"],
      truncated: true,
      replay_safe: false,
      render_safe: false,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
    });
  });

  it("sets replay_safe true only for safe trace-compatible categories", () => {
    for (const category of listCommandCenterObservabilityAllowedCategories()) {
      const request = createCommandCenterObservabilityQueryRequest({
        query_id: `query:${category}`,
        category,
      });
      const envelope = wrapObservabilityResponse({
        request,
        payload: safePayload(),
      });
      const shouldReplay = (
        COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES as readonly string[]
      ).includes(category);

      expect(envelope.replay_safe).toBe(shouldReplay);
    }

    expect(listCommandCenterObservabilityReplayCompatibleCategories()).toEqual([
      "traces",
      "governance_boundaries",
      "runtime_dependencies",
    ]);
  });

  it("fails closed for unknown or unsafe payload shapes without throwing", () => {
    expect(validateObservabilityPayloadSafety(new Map())).toMatchObject({
      passed: false,
      reason: "unsafe_payload_shape",
      notes: ["unsafe_object:root"],
    });

    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:traces",
      category: "traces",
    });
    expect(() =>
      wrapObservabilityResponse({
        request,
        payload: undefined,
      }),
    ).not.toThrow();
    expect(
      wrapObservabilityResponse({
        request,
        payload: undefined,
      }),
    ).toMatchObject({
      payload: [],
      render_safe: false,
      replay_safe: false,
      withheld_fields: [],
      truncated: true,
    });
  });

  it("exports redaction helpers from the command-center index", () => {
    const category: CommandCenterObservabilityQueryCategory = "traces";
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: "query:exports",
      category,
    });

    expect(typeof validateObservabilityPayloadSafety).toBe("function");
    expect(typeof wrapObservabilityResponse).toBe("function");
    expect(
      wrapObservabilityResponse({ request, payload: safePayload() }),
    ).toMatchObject({
      category,
      render_safe: true,
      replay_safe: true,
    });
  });
});
