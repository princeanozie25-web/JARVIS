import { describe, expect, it } from "vitest";

import {
  VisionProviderRegistry,
  VisionSessionRunner,
  VisionSessionLifecycleEventSchema,
  createFakeOcrProvider,
  createFakeVisionSessionRunner,
  createVisionProviderRegistry,
  sanitizeVisionTelemetryEvent,
  type VisionSessionRunRequest,
} from "../../src/lib/vision-runtime";

const baseRequest: VisionSessionRunRequest = {
  request_id: "request-1",
  session_id: "session-1",
  capability: "screenshot_ocr",
  input_kind: "screenshot",
  environment: "test",
  user_triggered: true,
  timeout_ms: 100,
  requested_at_ms: 10,
  metadata_only: true,
};

describe("Phase 15A.3 vision session lifecycle", () => {
  it("fake OCR request completes with a derived advisory observation", async () => {
    const result = await createFakeVisionSessionRunner().run(baseRequest);

    expect(result.session).toMatchObject({
      state: "completed",
      capability: "screenshot_ocr",
      provider_id: "fake-ocr",
      provider_kind: "fake_ocr",
      result_status: "success",
      reason: "completed",
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
      provider_executed: true,
      runtime_executed: false,
    });
    expect(result.observations).toEqual([
      expect.objectContaining({
        kind: "ocr_summary",
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
        tool_trigger_requested: false,
        action_requested: false,
        mutation_requested: false,
      }),
    ]);
    expect(result.events.map((event) => event.event_type)).toEqual([
      "session_started",
      "provider_selected",
      "provider_completed",
      "observation_created",
      "session_completed",
    ]);
  });

  it("fake object detection request completes with a derived advisory observation", async () => {
    const result = await createFakeVisionSessionRunner().run({
      ...baseRequest,
      request_id: "request-2",
      session_id: "session-2",
      capability: "object_detection",
    });

    expect(result.session).toMatchObject({
      state: "completed",
      provider_id: "fake-object-detector",
      provider_kind: "fake_object_detector",
      result_status: "success",
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
    });
    expect(result.observations).toEqual([
      expect.objectContaining({
        kind: "object_hint",
        confidence: 0.84,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
      }),
    ]);
  });

  it("policy denial produces denied session with no provider execution", async () => {
    const result = await createFakeVisionSessionRunner().run({
      ...baseRequest,
      user_triggered: false,
    });

    expect(result.session).toMatchObject({
      state: "denied",
      reason: "policy_denied",
      provider_id: null,
      provider_kind: null,
      result_status: null,
      observation_count: 0,
      provider_executed: false,
    });
    expect(result.provider_result).toBeNull();
    expect(result.observations).toEqual([]);
    expect(result.events.map((event) => event.event_type)).toEqual([
      "session_started",
      "policy_denied",
    ]);
  });

  it("missing provider fails closed", async () => {
    const registryResult = createVisionProviderRegistry([]);
    if (!registryResult.ok) throw new Error("empty registry should be valid");

    const result = await createFakeVisionSessionRunnerWithRegistry(
      registryResult.registry,
    ).run(baseRequest);

    expect(result.session).toMatchObject({
      state: "failed",
      reason: "missing_provider",
      provider_executed: false,
      observation_count: 0,
    });
    expect(result.provider_result).toBeNull();
    expect(result.observations).toEqual([]);
    expect(result.events.at(-1)).toMatchObject({
      event_type: "session_failed",
      provider_executed: false,
      raw_payload_included: false,
    });
  });

  it("cancellation produces cancelled session and no completed observation", async () => {
    const result = await createFakeVisionSessionRunner().run({
      ...baseRequest,
      cancellation_token: {
        cancellation_id: "cancel-1",
        cancelled: true,
        reason: "user_cancelled",
        requested_at_ms: 11,
        metadata_only: true,
      },
    });

    expect(result.session).toMatchObject({
      state: "cancelled",
      reason: "provider_cancelled",
      result_status: "cancelled",
      observation_count: 0,
      provider_executed: true,
    });
    expect(result.observations).toEqual([]);
    expect(result.events.map((event) => event.event_type)).not.toContain(
      "observation_created",
    );
    expect(result.events.at(-1)).toMatchObject({
      event_type: "session_cancelled",
      state: "cancelled",
    });
  });

  it("timeout and degraded provider results do not leak raw payloads", async () => {
    const timeout = await createFakeVisionSessionRunner().run({
      ...baseRequest,
      request_id: "request-timeout",
      session_id: "session-timeout",
      timeout_ms: 1,
      simulated_latency_ms: 2,
    });
    const degradedRegistry = createVisionProviderRegistry([
      createFakeOcrProvider({ degraded: true }),
    ]);
    if (!degradedRegistry.ok) {
      throw new Error("degraded fake registry should be valid");
    }
    const degraded = await createFakeVisionSessionRunnerWithRegistry(
      degradedRegistry.registry,
    ).run({
      ...baseRequest,
      request_id: "request-degraded",
      session_id: "session-degraded",
    });

    expect(timeout.session).toMatchObject({
      state: "failed",
      reason: "provider_timeout",
      result_status: "timeout",
      observation_count: 0,
    });
    expect(degraded.session).toMatchObject({
      state: "completed",
      reason: "completed",
      result_status: "degraded",
      observation_count: 1,
    });
    expect(JSON.stringify({ timeout, degraded })).not.toMatch(
      /recognized_text|prompt|response|file_contents|image_bytes|base64|pixels/i,
    );
    expect(timeout.provider_result).toMatchObject({
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
    });
    expect(degraded.provider_result).toMatchObject({
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
    });
  });

  it("lifecycle events contain metadata only", async () => {
    const result = await createFakeVisionSessionRunner().run(baseRequest);

    for (const event of result.events) {
      expect(VisionSessionLifecycleEventSchema.safeParse(event).success).toBe(
        true,
      );
      expect(event).toMatchObject({
        metadata_only: true,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
        cloud_called: false,
        action_executed: false,
        mutation_performed: false,
        tool_triggered: false,
        device_action_triggered: false,
        project_mutated: false,
        memory_mutated: false,
        runtime_executed: false,
      });
    }
  });

  it("raw frame, image, and OCR text fields are rejected or withheld", async () => {
    const result = await createFakeVisionSessionRunner().run(baseRequest);

    expect(result.session).toMatchObject({
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
    });
    expect(
      VisionSessionLifecycleEventSchema.safeParse({
        ...result.events[0],
        ocr_text: "forbidden",
      }).success,
    ).toBe(false);
    expect(
      sanitizeVisionTelemetryEvent({
        event_type: "vision_session_created",
        session_id: "session-1",
        capability: "screenshot_ocr",
        input_kind: "screenshot",
        decision: "allowed",
        redaction_status: "metadata_only",
        timestamp_ms: 10,
        metadata_only: true,
        advisory_only: true,
        raw_payload_included: false,
        cloud_called: false,
        action_executed: false,
        mutation_performed: false,
        raw_image: "forbidden",
      }),
    ).toMatchObject({
      ok: false,
      reason: "forbidden_telemetry_field",
      field: "raw_image",
    });
  });

  it("session runner cannot trigger tool, device, project, runtime, or memory mutation", async () => {
    const result = await createFakeVisionSessionRunner().run({
      ...baseRequest,
      mutation_authority_requested: [
        "tool_trigger",
        "device_action",
        "project_write",
        "runtime_execution",
        "memory_write",
      ],
    });

    expect(result.session).toMatchObject({
      state: "denied",
      provider_executed: false,
      tool_triggered: false,
      device_action_triggered: false,
      project_mutated: false,
      memory_mutated: false,
      runtime_executed: false,
    });
    expect(result).toMatchObject({
      action_executed: false,
      mutation_performed: false,
      tool_triggered: false,
      device_action_triggered: false,
      project_mutated: false,
      memory_mutated: false,
      runtime_executed: false,
    });
  });
});

function createFakeVisionSessionRunnerWithRegistry(
  registry: VisionProviderRegistry,
) {
  return new VisionSessionRunner({ registry });
}
