import type {
  ObservabilityRedactionPosture,
  ObservabilityResponse,
  ObservabilityStatus,
} from "../lib/observability/contracts";
import type {
  ModelCallCountBucket,
  ModelCallLatencySummary,
  ModelCallRollupProjection,
  RecentModelCallRecord,
  RecentModelCallsProjection,
} from "./model-call-projection";
import type {
  ModelProviderFailureClass,
  ModelProviderRedactionStatus,
  ModelProviderTokenUsage,
} from "./providers/contract";
import type {
  ModelCapability,
  ModelProviderKind,
  ModelRuntimeClass,
} from "./types";

export interface ModelRuntimeObservabilityInput {
  readonly recentCalls: unknown;
  readonly rollup: unknown;
}

export interface ModelRuntimeObservabilityView {
  readonly projection_status: "ok" | "degraded";
  readonly metadata_only: true;
  readonly degraded: boolean;
  readonly redaction_status: ModelProviderRedactionStatus;
  readonly model_mix: readonly ModelCallCountBucket[];
  readonly provider_mix: readonly ModelCallCountBucket[];
  readonly runtime_class_mix: readonly ModelCallCountBucket[];
  readonly capability_mix: readonly ModelCallCountBucket[];
  readonly success_count: number;
  readonly failure_count: number;
  readonly fallback_usage_count: number;
  readonly degraded_count: number;
  readonly token_usage_totals: ModelProviderTokenUsage;
  readonly latency_summary: ModelCallLatencySummary;
  readonly recent_calls: readonly ModelRuntimeObservabilityRecentCall[];
  readonly errors: readonly string[];
}

export interface ModelRuntimeObservabilityRecentCall {
  readonly model_id: string | null;
  readonly provider_kind: ModelProviderKind | null;
  readonly runtime_class: ModelRuntimeClass | null;
  readonly capability: ModelCapability | null;
  readonly status: "success" | "failed";
  readonly failure_class?: ModelProviderFailureClass;
  readonly token_usage: ModelProviderTokenUsage;
  readonly latency_ms: number;
  readonly fallback_used: boolean;
  readonly degraded: boolean;
  readonly created_at: number;
  readonly redaction_status: ModelProviderRedactionStatus;
}

const SAFE_REDACTION: ObservabilityRedactionPosture = Object.freeze({
  metadata_only: true,
  raw_payload_included: false,
  secrets_included: false,
  executable_payload_included: false,
  unsafe_payload_withheld: false,
});

export function createModelRuntimeObservabilityView(
  input: ModelRuntimeObservabilityInput,
): ObservabilityResponse<ModelRuntimeObservabilityView> {
  if (
    isWithheldProjection(input.recentCalls) ||
    isWithheldProjection(input.rollup)
  ) {
    return withheldResponse(["withheld_model_runtime_projection"]);
  }
  if (containsUnsafePayload(input, new Set())) {
    return withheldResponse(["unsafe_model_runtime_projection"]);
  }
  if (!isRecentModelCallsProjection(input.recentCalls)) {
    return withheldResponse(["malformed_recent_model_calls_projection"]);
  }
  if (!isModelCallRollupProjection(input.rollup)) {
    return withheldResponse(["malformed_model_call_rollup_projection"]);
  }

  const recent = input.recentCalls;
  const rollup = input.rollup;
  const errors = [...recent.errors, ...rollup.errors];
  const degraded =
    recent.projection_status === "degraded" ||
    rollup.projection_status === "degraded" ||
    errors.length > 0 ||
    rollup.degraded_calls > 0;
  const view: ModelRuntimeObservabilityView = {
    projection_status: degraded ? "degraded" : "ok",
    metadata_only: true,
    degraded,
    redaction_status: "metadata_only",
    model_mix: rollup.calls_by_model,
    provider_mix: rollup.calls_by_provider_kind,
    runtime_class_mix: rollup.calls_by_runtime_class,
    capability_mix: rollup.calls_by_capability,
    success_count: rollup.successful_calls,
    failure_count: rollup.failed_calls,
    fallback_usage_count: rollup.fallback_used_calls,
    degraded_count: rollup.degraded_calls,
    token_usage_totals: rollup.token_usage_totals,
    latency_summary: rollup.latency_ms,
    recent_calls: recent.calls.map(toRecentCallView),
    errors,
  };

  return response(
    degraded ? "degraded" : "ok",
    view,
    errors,
    errors.length > 0,
  );
}

function toRecentCallView(
  call: RecentModelCallRecord,
): ModelRuntimeObservabilityRecentCall {
  return {
    model_id: call.model_id,
    provider_kind: call.provider_kind,
    runtime_class: call.runtime_class,
    capability: call.capability,
    status: call.status,
    ...(call.failure_class ? { failure_class: call.failure_class } : {}),
    token_usage: call.token_usage,
    latency_ms: call.latency_ms,
    fallback_used: call.fallback_used,
    degraded: call.degraded,
    created_at: call.created_at,
    redaction_status: call.redaction_status,
  };
}

function response(
  status: Exclude<ObservabilityStatus, "withheld">,
  data: ModelRuntimeObservabilityView,
  errors: readonly string[],
  unsafePayloadWithheld: boolean,
): ObservabilityResponse<ModelRuntimeObservabilityView> {
  return clone({
    status,
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: false,
    data,
    errors,
    withheld: false,
    redaction: {
      ...SAFE_REDACTION,
      unsafe_payload_withheld: unsafePayloadWithheld,
    },
  });
}

function withheldResponse(
  errors: readonly string[],
): ObservabilityResponse<ModelRuntimeObservabilityView> {
  return clone({
    status: "withheld",
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: false,
    data: null,
    errors,
    withheld: true,
    redaction: {
      ...SAFE_REDACTION,
      unsafe_payload_withheld: true,
    },
  });
}

function isRecentModelCallsProjection(
  value: unknown,
): value is RecentModelCallsProjection {
  if (!isRecord(value)) return false;
  if (!isProjectionStatus(value.projection_status)) return false;
  if (!Array.isArray(value.calls) || !Array.isArray(value.errors)) {
    return false;
  }
  if (!value.errors.every((entry) => typeof entry === "string")) return false;
  if (!isSafePosture(value.posture)) return false;
  return value.calls.every(isRecentModelCallRecord);
}

function isModelCallRollupProjection(
  value: unknown,
): value is ModelCallRollupProjection {
  if (!isRecord(value)) return false;
  if (!isProjectionStatus(value.projection_status)) return false;
  if (!Array.isArray(value.errors)) return false;
  if (!value.errors.every((entry) => typeof entry === "string")) return false;
  if (!isSafePosture(value.posture)) return false;
  return (
    isNonnegativeNumber(value.total_calls) &&
    isNonnegativeNumber(value.successful_calls) &&
    isNonnegativeNumber(value.failed_calls) &&
    isNonnegativeNumber(value.degraded_calls) &&
    isNonnegativeNumber(value.fallback_used_calls) &&
    isTokenUsage(value.token_usage_totals) &&
    isLatencySummary(value.latency_ms) &&
    isBucketArray(value.calls_by_model) &&
    isBucketArray(value.calls_by_provider_kind) &&
    isBucketArray(value.calls_by_runtime_class) &&
    isBucketArray(value.calls_by_capability) &&
    isBucketArray(value.calls_by_status) &&
    isBucketArray(value.failures_by_class)
  );
}

function isRecentModelCallRecord(
  value: unknown,
): value is RecentModelCallRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.event_id === "string" &&
    typeof value.model_call_id === "string" &&
    typeof value.request_id === "string" &&
    typeof value.execution_id === "string" &&
    isNullableString(value.model_id) &&
    isNullableString(value.provider_kind) &&
    isNullableString(value.runtime_class) &&
    isNullableString(value.capability) &&
    (value.status === "success" || value.status === "failed") &&
    (value.failure_class === undefined ||
      typeof value.failure_class === "string") &&
    isTokenUsage(value.token_usage) &&
    isNonnegativeNumber(value.latency_ms) &&
    typeof value.fallback_used === "boolean" &&
    typeof value.degraded === "boolean" &&
    isNonnegativeNumber(value.created_at) &&
    value.redaction_status === "metadata_only" &&
    value.metadata_only === true &&
    value.raw_payload_included === false
  );
}

function isBucketArray(
  value: unknown,
): value is readonly ModelCallCountBucket[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.key === "string" &&
        isNonnegativeNumber(entry.count),
    )
  );
}

function isTokenUsage(value: unknown): value is ModelProviderTokenUsage {
  return (
    isRecord(value) &&
    isNonnegativeNumber(value.input_tokens) &&
    isNonnegativeNumber(value.output_tokens) &&
    isNonnegativeNumber(value.total_tokens)
  );
}

function isLatencySummary(value: unknown): value is ModelCallLatencySummary {
  return (
    isRecord(value) &&
    isNonnegativeNumber(value.min_ms) &&
    isNonnegativeNumber(value.max_ms) &&
    isNonnegativeNumber(value.average_ms)
  );
}

function isSafePosture(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.metadata_only === true &&
    value.raw_payload_included === false &&
    value.secrets_included === false &&
    value.executable_payload_included === false &&
    value.network_called === false &&
    value.ui_rendered === false
  );
}

function isWithheldProjection(value: unknown): boolean {
  return isRecord(value) && value.projection_status === "withheld";
}

function isProjectionStatus(value: unknown): value is "ok" | "degraded" {
  return value === "ok" || value === "degraded";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function containsUnsafePayload(value: unknown, seen: Set<object>): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return isSecretText(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((entry) => containsUnsafePayload(entry, seen));
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeKeyValue(key, child)) return true;
    if (containsUnsafePayload(child, seen)) return true;
  }
  return false;
}

function isUnsafeKeyValue(key: string, value: unknown): boolean {
  if (
    FORBIDDEN_KEYS.has(key.toLowerCase()) ||
    /api[_-]?key|secret|password|process\.env|import\.meta\.env/i.test(key)
  ) {
    if (SAFE_FALSE_POSTURE_KEYS.has(key) && value === false) return false;
    return true;
  }
  return false;
}

function isSecretText(value: string): boolean {
  return /(api[_-]?key|password|secret|sk-[a-z0-9_-]+)/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const FORBIDDEN_KEYS = new Set([
  "raw_prompt",
  "prompt_telemetry",
  "stored_prompt",
  "raw_response",
  "raw_output",
  "raw_stream_tokens",
  "stream_tokens",
  "provider_payload",
  "full_provider_payload",
  "http_request_body",
  "request_body",
  "http_response_body",
  "response_body",
]);

const SAFE_FALSE_POSTURE_KEYS = new Set([
  "raw_payload_included",
  "secrets_included",
  "executable_payload_included",
  "unsafe_payload_withheld",
]);
