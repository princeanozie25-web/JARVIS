import { describe, expect, it } from "vitest";

import {
  VisionProviderRegistry,
  createFakeObjectDetectionProvider,
  createFakeOcrProvider,
  createVisionProviderRegistry,
  sanitizeVisionTelemetryEvent,
  type VisionProvider,
  type VisionProviderRunRequest,
} from "../../src/lib/vision-runtime";

const baseRequest: VisionProviderRunRequest = {
  request_id: "request-1",
  session_id: "session-1",
  capability: "screenshot_ocr",
  input_kind: "screenshot",
  user_triggered: true,
  timeout_ms: 100,
  requested_at_ms: 10,
  environment: "test",
  metadata_only: true,
};

describe("Phase 15A.2 fake vision providers", () => {
  it("fake OCR provider returns deterministic metadata-safe output", async () => {
    const provider = createFakeOcrProvider();
    const first = await provider.run(baseRequest);
    const second = await provider.run(baseRequest);

    expect(first).toEqual(second);
    expect(first.provider_result).toMatchObject({
      provider_id: "fake-ocr",
      provider_kind: "fake_ocr",
      capability: "screenshot_ocr",
      status: "success",
      reason: "completed",
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
      raw_frame_persisted: false,
      raw_ocr_text_included: false,
      cloud_called: false,
      runtime_executed: false,
    });
    expect(first.observations).toEqual([
      {
        observation_id: "request-1-ocr_summary",
        session_id: "session-1",
        kind: "ocr_summary",
        redaction_status: "metadata_only",
        confidence: 0.91,
        created_at_ms: 10,
        metadata_only: true,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
        tool_trigger_requested: false,
        action_requested: false,
        mutation_requested: false,
      },
    ]);
    expect(JSON.stringify(first)).not.toMatch(
      /recognized_text|prompt|response|file_contents|image_bytes|base64|pixels/i,
    );
  });

  it("fake object detector returns deterministic metadata-safe output", async () => {
    const provider = createFakeObjectDetectionProvider();
    const result = await provider.run({
      ...baseRequest,
      request_id: "request-2",
      capability: "object_detection",
    });

    expect(result.provider_result).toMatchObject({
      provider_id: "fake-object-detector",
      provider_kind: "fake_object_detector",
      capability: "object_detection",
      status: "success",
      observation_count: 1,
      metadata_only: true,
      advisory_only: true,
      derived: true,
      raw_payload_included: false,
    });
    expect(result.observations).toEqual([
      expect.objectContaining({
        observation_id: "request-2-object_hint",
        kind: "object_hint",
        confidence: 0.84,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
      }),
    ]);
  });

  it("provider registry rejects duplicate ids", () => {
    const result = createVisionProviderRegistry([
      createFakeOcrProvider({ id: "duplicate-provider" }),
      createFakeObjectDetectionProvider({ id: "duplicate-provider" }),
    ]);

    expect(result).toEqual({
      ok: false,
      registry: null,
      reason: "duplicate_provider_id",
      provider_id: "duplicate-provider",
      capability: "object_detection",
      metadata_only: true,
    });
  });

  it("provider registry fails closed for missing providers", () => {
    const result = createVisionProviderRegistry([createFakeOcrProvider()]);
    if (!result.ok) throw new Error("expected registry creation to pass");

    expect(
      result.registry.getProviderByCapability("object_detection"),
    ).toBeNull();
    expect(
      result.registry.requireProviderByCapability("object_detection"),
    ).toEqual({
      ok: false,
      registry: null,
      reason: "no_provider_for_capability",
      provider_id: null,
      capability: "object_detection",
      metadata_only: true,
    });
  });

  it("provider registry does not allow cloud or real-camera providers by default", () => {
    const cloudProvider = fakeForbiddenProvider(
      "cloud-provider",
      "cloud_vision",
    );
    const realCameraProvider = fakeForbiddenProvider(
      "real-camera-provider",
      "real_camera",
    );

    expect(createVisionProviderRegistry([cloudProvider])).toEqual({
      ok: false,
      registry: null,
      reason: "forbidden_provider_capability",
      provider_id: "cloud-provider",
      capability: "cloud_vision",
      metadata_only: true,
    });
    expect(createVisionProviderRegistry([realCameraProvider])).toEqual({
      ok: false,
      registry: null,
      reason: "forbidden_provider_capability",
      provider_id: "real-camera-provider",
      capability: "real_camera",
      metadata_only: true,
    });
  });

  it("cancellation token is honoured without throwing", async () => {
    const provider = createFakeOcrProvider();
    const result = await provider.run({
      ...baseRequest,
      cancellation_token: {
        cancellation_id: "cancel-1",
        cancelled: true,
        reason: "user_cancelled",
        requested_at_ms: 11,
        metadata_only: true,
      },
    });

    expect(result.provider_result).toMatchObject({
      status: "cancelled",
      reason: "cancelled",
      cancelled: true,
      observation_count: 0,
      raw_payload_included: false,
    });
    expect(result.observations).toEqual([]);
  });

  it("timeout and degraded results stay metadata-only", async () => {
    const provider = createFakeOcrProvider();
    const timedOut = await provider.run({
      ...baseRequest,
      request_id: "request-timeout",
      timeout_ms: 1,
      simulated_latency_ms: 2,
    });
    const degraded = await createFakeOcrProvider({ degraded: true }).run({
      ...baseRequest,
      request_id: "request-degraded",
    });

    expect(timedOut.provider_result).toMatchObject({
      status: "timeout",
      timed_out: true,
      observation_count: 0,
      raw_payload_included: false,
      raw_ocr_text_included: false,
    });
    expect(degraded.provider_result).toMatchObject({
      status: "degraded",
      degraded: true,
      observation_count: 1,
      raw_payload_included: false,
      raw_ocr_text_included: false,
    });
    expect(
      sanitizeVisionTelemetryEvent({
        event_type: "vision_provider_result_recorded",
        session_id: "session-1",
        provider_id: "fake-ocr",
        capability: "screenshot_ocr",
        provider_kind: "fake_ocr",
        redaction_status: "metadata_only",
        observation_count: timedOut.provider_result.observation_count,
        latency_ms: timedOut.provider_result.latency_ms ?? 0,
        timestamp_ms: 12,
        metadata_only: true,
        advisory_only: true,
        raw_payload_included: false,
        cloud_called: false,
        action_executed: false,
        mutation_performed: false,
      }),
    ).toMatchObject({ ok: true });
  });

  it("unsupported capability and policy denied results are represented fail-closed", async () => {
    const provider = createFakeOcrProvider();
    const unsupported = await provider.run({
      ...baseRequest,
      capability: "object_detection",
    });
    const policyDenied = await provider.run({
      ...baseRequest,
      user_triggered: false,
    });

    expect(unsupported.provider_result).toMatchObject({
      status: "unsupported_capability",
      unsupported_capability: true,
      observation_count: 0,
    });
    expect(policyDenied.provider_result).toMatchObject({
      status: "policy_denied",
      policy_denied: true,
      observation_count: 0,
    });
  });

  it("fake-only registry factory registers only fake providers", () => {
    const result = VisionProviderRegistry.createFakeOnly();
    if (!result.ok) throw new Error("expected fake registry creation to pass");

    expect(
      result.registry.listProviders().map((provider) => provider.kind),
    ).toEqual(["fake_ocr", "fake_object_detector", "fake_mock_camera"]);
    expect(
      result.registry
        .listProviders()
        .every((provider) => provider.metadata_only),
    ).toBe(true);
  });
});

function fakeForbiddenProvider(
  id: string,
  capability: "cloud_vision" | "real_camera",
): VisionProvider {
  return {
    id,
    kind: capability,
    supported_capability: capability,
    metadata_only: true,
    async health() {
      return {
        provider_id: id,
        provider_kind: capability,
        supported_capability: capability,
        ok: false,
        degraded: true,
        checked_at_ms: 0,
        metadata_only: true,
      };
    },
    async run() {
      throw new Error("Forbidden provider must not be run.");
    },
  };
}
