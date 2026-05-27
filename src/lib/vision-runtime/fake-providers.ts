import {
  type VisionCapability,
  type VisionObservation,
  type VisionObservationKind,
  type VisionProviderKind,
} from "./contracts";
import { createVisionObservation } from "./policy";
import {
  createVisionProviderCancelledResult,
  createVisionProviderDegradedResult,
  createVisionProviderPolicyDeniedResult,
  createVisionProviderSuccessResult,
  createVisionProviderTimeoutResult,
  createVisionProviderUnsupportedCapabilityResult,
  evaluateVisionProviderRequest,
  type VisionProvider,
  type VisionProviderHealth,
  type VisionProviderRunRequest,
  type VisionProviderRunResult,
} from "./provider";

interface FakeVisionProviderOptions {
  readonly id: string;
  readonly kind: VisionProviderKind;
  readonly capability: VisionCapability;
  readonly observation_kind: VisionObservationKind;
  readonly fixture_confidence: number;
  readonly degraded?: boolean;
}

export function createFakeOcrProvider(
  options: Partial<Pick<FakeVisionProviderOptions, "id" | "degraded">> = {},
): VisionProvider {
  return createFakeVisionProvider({
    id: options.id ?? "fake-ocr",
    kind: "fake_ocr",
    capability: "screenshot_ocr",
    observation_kind: "ocr_summary",
    fixture_confidence: 0.91,
    degraded: options.degraded ?? false,
  });
}

export function createFakeObjectDetectionProvider(
  options: Partial<Pick<FakeVisionProviderOptions, "id" | "degraded">> = {},
): VisionProvider {
  return createFakeVisionProvider({
    id: options.id ?? "fake-object-detector",
    kind: "fake_object_detector",
    capability: "object_detection",
    observation_kind: "object_hint",
    fixture_confidence: 0.84,
    degraded: options.degraded ?? false,
  });
}

export function createFakeMockCameraProvider(
  options: Partial<Pick<FakeVisionProviderOptions, "id" | "degraded">> = {},
): VisionProvider {
  return createFakeVisionProvider({
    id: options.id ?? "fake-mock-camera",
    kind: "fake_mock_camera",
    capability: "mock_camera",
    observation_kind: "mock_camera_observation",
    fixture_confidence: 0.78,
    degraded: options.degraded ?? false,
  });
}

function createFakeVisionProvider(
  options: FakeVisionProviderOptions,
): VisionProvider {
  return {
    id: options.id,
    kind: options.kind,
    supported_capability: options.capability,
    metadata_only: true,
    async health(checkedAtMs = 0): Promise<VisionProviderHealth> {
      return {
        provider_id: options.id,
        provider_kind: options.kind,
        supported_capability: options.capability,
        ok: true,
        degraded: options.degraded ?? false,
        checked_at_ms: checkedAtMs,
        metadata_only: true,
      };
    },
    async run(
      request: VisionProviderRunRequest,
    ): Promise<VisionProviderRunResult> {
      const latency = request.simulated_latency_ms ?? 1;
      const baseResult = {
        result_id: `${request.request_id}-result`,
        session_id: request.session_id,
        provider_id: options.id,
        provider_kind: options.kind,
        capability: request.capability,
        latency_ms: latency,
      };
      const decision = evaluateVisionProviderRequest(this, request);

      if (decision === "cancelled") {
        return providerRunResult(
          createVisionProviderCancelledResult(baseResult),
          [],
        );
      }
      if (decision === "unsupported_capability") {
        return providerRunResult(
          createVisionProviderUnsupportedCapabilityResult(baseResult),
          [],
        );
      }
      if (decision === "policy_denied") {
        return providerRunResult(
          createVisionProviderPolicyDeniedResult(baseResult),
          [],
        );
      }
      if (decision === "timeout") {
        return providerRunResult(
          createVisionProviderTimeoutResult(baseResult),
          [],
        );
      }

      const observations = [
        createDeterministicObservation({
          request,
          kind: options.observation_kind,
          confidence: options.fixture_confidence,
        }),
      ];
      const resultInput = {
        ...baseResult,
        capability: options.capability,
        result_kind:
          options.observation_kind === "mock_camera_observation"
            ? "mock_observation"
            : "metadata_summary",
        observation_count: observations.length,
      } as const;

      return providerRunResult(
        options.degraded
          ? createVisionProviderDegradedResult(resultInput)
          : createVisionProviderSuccessResult(resultInput),
        observations,
      );
    },
  };
}

function createDeterministicObservation(input: {
  readonly request: VisionProviderRunRequest;
  readonly kind: VisionObservationKind;
  readonly confidence: number;
}): VisionObservation {
  return createVisionObservation({
    observation_id: `${input.request.request_id}-${input.kind}`,
    session_id: input.request.session_id,
    kind: input.kind,
    redaction_status: "metadata_only",
    confidence: input.confidence,
    created_at_ms: input.request.requested_at_ms,
  });
}

function providerRunResult(
  providerResult: VisionProviderRunResult["provider_result"],
  observations: readonly VisionObservation[],
): VisionProviderRunResult {
  return {
    provider_result: providerResult,
    observations,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
  };
}
