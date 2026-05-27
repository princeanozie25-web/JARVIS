import {
  VisionCapabilitySchema,
  VisionInputKindSchema,
  VisionProviderKindSchema,
  VisionProviderResultSchema,
  type VisionCapability,
  type VisionInputKind,
  type VisionObservation,
  type VisionProviderKind,
  type VisionProviderResult,
  type VisionProviderResultKind,
  type VisionProviderResultReason,
  type VisionProviderResultStatus,
} from "./contracts";
import {
  DEFAULT_VISION_RUNTIME_POLICY,
  evaluateVisionRuntimePolicy,
  type VisionPolicyEvaluationInput,
} from "./policy";

export interface VisionProviderHealth {
  readonly provider_id: string;
  readonly provider_kind: VisionProviderKind;
  readonly supported_capability: VisionCapability;
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly checked_at_ms: number;
  readonly metadata_only: true;
}

export interface VisionProviderCancellationToken {
  readonly cancellation_id: string;
  readonly cancelled: boolean;
  readonly reason?: "user_cancelled" | "timeout" | "policy_denied";
  readonly requested_at_ms: number;
  readonly metadata_only: true;
}

export interface VisionProviderRunRequest {
  readonly request_id: string;
  readonly session_id: string;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly user_triggered: boolean;
  readonly timeout_ms: number;
  readonly requested_at_ms: number;
  readonly environment: VisionPolicyEvaluationInput["environment"];
  readonly cancellation_token?: VisionProviderCancellationToken;
  readonly abort_signal?: AbortSignal;
  readonly simulated_latency_ms?: number;
  readonly metadata_only: true;
}

export interface VisionProviderRunResult {
  readonly provider_result: VisionProviderResult;
  readonly observations: readonly VisionObservation[];
  readonly metadata_only: true;
  readonly advisory_only: true;
  readonly derived: true;
  readonly raw_payload_included: false;
}

export interface VisionProvider {
  readonly id: string;
  readonly kind: VisionProviderKind;
  readonly supported_capability: VisionCapability;
  readonly metadata_only: true;
  health(checkedAtMs?: number): Promise<VisionProviderHealth>;
  run(request: VisionProviderRunRequest): Promise<VisionProviderRunResult>;
}

interface CreateVisionProviderResultInput {
  readonly status: VisionProviderResultStatus;
  readonly reason: VisionProviderResultReason;
  readonly result_id: string;
  readonly session_id: string;
  readonly provider_id: string;
  readonly provider_kind: VisionProviderKind;
  readonly capability: VisionCapability;
  readonly result_kind?: VisionProviderResultKind;
  readonly observation_count?: number;
  readonly latency_ms?: number | null;
}

export function createVisionProviderSuccessResult(
  input: Omit<CreateVisionProviderResultInput, "status" | "reason">,
): VisionProviderResult {
  return createVisionProviderResult({
    ...input,
    status: "success",
    reason: "completed",
  });
}

export function createVisionProviderDegradedResult(
  input: Omit<CreateVisionProviderResultInput, "status" | "reason">,
): VisionProviderResult {
  return createVisionProviderResult({
    ...input,
    status: "degraded",
    reason: "degraded_fixture",
  });
}

export function createVisionProviderTimeoutResult(
  input: Omit<CreateVisionProviderResultInput, "status" | "reason">,
): VisionProviderResult {
  return createVisionProviderResult({
    ...input,
    status: "timeout",
    reason: "timeout",
    result_kind: "no_result",
    observation_count: 0,
  });
}

export function createVisionProviderCancelledResult(
  input: Omit<CreateVisionProviderResultInput, "status" | "reason">,
): VisionProviderResult {
  return createVisionProviderResult({
    ...input,
    status: "cancelled",
    reason: "cancelled",
    result_kind: "no_result",
    observation_count: 0,
  });
}

export function createVisionProviderUnsupportedCapabilityResult(
  input: Omit<CreateVisionProviderResultInput, "status" | "reason">,
): VisionProviderResult {
  return createVisionProviderResult({
    ...input,
    status: "unsupported_capability",
    reason: "unsupported_capability",
    result_kind: "no_result",
    observation_count: 0,
  });
}

export function createVisionProviderPolicyDeniedResult(
  input: Omit<CreateVisionProviderResultInput, "status" | "reason">,
): VisionProviderResult {
  return createVisionProviderResult({
    ...input,
    status: "policy_denied",
    reason: "policy_denied",
    result_kind: "no_result",
    observation_count: 0,
  });
}

export function isVisionProviderCapabilityAllowed(
  provider: Pick<VisionProvider, "kind" | "supported_capability">,
): boolean {
  return (
    provider.supported_capability !== "cloud_vision" &&
    provider.supported_capability !== "real_camera" &&
    provider.kind !== "cloud_vision" &&
    provider.kind !== "real_camera"
  );
}

export function evaluateVisionProviderRequest(
  provider: Pick<VisionProvider, "kind" | "supported_capability">,
  request: VisionProviderRunRequest,
): VisionProviderResultStatus | null {
  const supportedCapability = VisionCapabilitySchema.parse(
    provider.supported_capability,
  );
  const requestedCapability = VisionCapabilitySchema.parse(request.capability);
  VisionProviderKindSchema.parse(provider.kind);
  VisionInputKindSchema.parse(request.input_kind);

  if (request.cancellation_token?.cancelled || request.abort_signal?.aborted) {
    return "cancelled";
  }
  if (requestedCapability !== supportedCapability) {
    return "unsupported_capability";
  }
  if (!isVisionProviderCapabilityAllowed(provider)) {
    return "policy_denied";
  }
  const policy = evaluateVisionRuntimePolicy({
    capability: requestedCapability,
    input_kind: request.input_kind,
    provider_kind: provider.kind,
    environment: request.environment,
    user_triggered: request.user_triggered,
    capture_mode: "single",
    policy: DEFAULT_VISION_RUNTIME_POLICY,
  });
  if (!policy.allowed) return "policy_denied";
  if (
    request.timeout_ms <= 0 ||
    (request.simulated_latency_ms ?? 0) > request.timeout_ms
  ) {
    return "timeout";
  }

  return null;
}

function createVisionProviderResult(
  input: CreateVisionProviderResultInput,
): VisionProviderResult {
  const status = input.status;
  return VisionProviderResultSchema.parse({
    result_id: input.result_id,
    session_id: input.session_id,
    provider_id: input.provider_id,
    provider_kind: input.provider_kind,
    capability: input.capability,
    result_kind: input.result_kind ?? "metadata_summary",
    status,
    reason: input.reason,
    redaction_status: "metadata_only",
    observation_count: input.observation_count ?? 0,
    latency_ms: input.latency_ms ?? null,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    degraded: status === "degraded",
    timed_out: status === "timeout",
    cancelled: status === "cancelled",
    policy_denied: status === "policy_denied",
    unsupported_capability: status === "unsupported_capability",
    raw_payload_included: false,
    raw_frame_persisted: false,
    raw_ocr_text_included: false,
    cloud_called: false,
    runtime_executed: false,
  });
}
