export const FAKE_VOICE_RUNTIME_RESPONSE_TEXT =
  "Good evening. Voice runtime bridge is operational.";

export const VOICE_RUNTIME_ADAPTER_FAILURE_CLASSES = [
  "unavailable",
  "cancelled",
  "invalid_request",
  "provider_error",
  "policy_blocked",
  "unknown",
] as const;

export const VOICE_RUNTIME_FINISH_REASONS = [
  "stop",
  "length",
  "cancelled",
  "timeout",
  "error",
  "budget_blocked",
  "policy_blocked",
] as const;

export type VoiceRuntimeAdapterFailureClass =
  (typeof VOICE_RUNTIME_ADAPTER_FAILURE_CLASSES)[number];
export type VoiceRuntimeFinishReason =
  (typeof VOICE_RUNTIME_FINISH_REASONS)[number];

export interface VoiceRuntimeAdapterSafetyContext {
  readonly approval_required: boolean;
  readonly tool_execution_allowed: false;
  readonly persistence_allowed: false;
  readonly metadata_only: true;
}

export interface VoiceRuntimeAdapterRequest {
  readonly request_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly source: "voice";
  readonly transcript: string;
  readonly created_at: string;
  readonly safety_context?: VoiceRuntimeAdapterSafetyContext;
  readonly metadata_only: true;
}

export interface VoiceRuntimeAdapterOptions {
  readonly timeout_ms?: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface VoiceRuntimeAdapterResponse {
  readonly response_id: string;
  readonly assistant_text: string;
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly provider_id?: string;
  readonly finish_reason: VoiceRuntimeFinishReason;
  readonly metadata_only: true;
}

export interface VoiceRuntimeAdapterHealth {
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly provider_id: string;
  readonly error_class?: VoiceRuntimeAdapterFailureClass;
  readonly metadata_only: true;
}

export interface VoiceRuntimeAdapter {
  readonly id: string;
  readonly metadata_only: true;
  executeVoiceRequest(
    request: VoiceRuntimeAdapterRequest,
    options?: VoiceRuntimeAdapterOptions,
  ): Promise<VoiceRuntimeAdapterResponse>;
  cancel(reason: VoiceRuntimeAdapterFailureClass): Promise<void>;
  health(): Promise<VoiceRuntimeAdapterHealth>;
}

export type FakeVoiceRuntimeAdapterMode =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "fail";

export interface FakeVoiceRuntimeAdapterOptions {
  readonly mode?: FakeVoiceRuntimeAdapterMode;
  readonly provider_id?: string;
  readonly now_ms?: () => number;
}

export class FakeVoiceRuntimeAdapterError extends Error {
  readonly reason: VoiceRuntimeAdapterFailureClass;
  readonly metadata_only = true;

  constructor(reason: VoiceRuntimeAdapterFailureClass) {
    super(reason);
    this.name = "FakeVoiceRuntimeAdapterError";
    this.reason = reason;
  }
}

export function createFakeVoiceRuntimeAdapter(
  options: FakeVoiceRuntimeAdapterOptions = {},
): VoiceRuntimeAdapter {
  const mode = options.mode ?? "healthy";
  const providerId = options.provider_id ?? "fake-voice-runtime";
  const nowMs = options.now_ms ?? (() => Date.now());
  let cancelled: VoiceRuntimeAdapterFailureClass | null = null;

  return {
    id: providerId,
    metadata_only: true,
    executeVoiceRequest: async (request, executeOptions) => {
      if (cancelled) throw new FakeVoiceRuntimeAdapterError(cancelled);
      if (executeOptions?.abort_signal?.aborted) {
        throw new FakeVoiceRuntimeAdapterError("cancelled");
      }
      if (mode === "unavailable") {
        throw new FakeVoiceRuntimeAdapterError("unavailable");
      }
      if (mode === "fail") {
        throw new FakeVoiceRuntimeAdapterError("provider_error");
      }
      if (!isVoiceRuntimeAdapterRequest(request)) {
        throw new FakeVoiceRuntimeAdapterError("invalid_request");
      }

      return {
        response_id: `fake-runtime-response-${stableHash(request.request_id)}`,
        assistant_text: FAKE_VOICE_RUNTIME_RESPONSE_TEXT,
        latency_ms: Math.max(1, request.transcript.length + (nowMs() % 7)),
        degraded: mode === "degraded",
        provider_id: providerId,
        finish_reason: "stop",
        metadata_only: true,
      };
    },
    cancel: async (reason) => {
      cancelled = reason;
    },
    health: async () => ({
      ok: mode !== "unavailable",
      degraded: mode === "degraded",
      provider_id: providerId,
      ...(mode === "unavailable"
        ? { error_class: "unavailable" as const }
        : {}),
      metadata_only: true,
    }),
  };
}

export function isVoiceRuntimeAdapterRequest(
  value: unknown,
): value is VoiceRuntimeAdapterRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.request_id === "string" &&
    record.request_id.length > 0 &&
    typeof record.session_id === "string" &&
    record.session_id.length > 0 &&
    typeof record.turn_id === "string" &&
    record.turn_id.length > 0 &&
    record.source === "voice" &&
    typeof record.transcript === "string" &&
    record.transcript.length > 0 &&
    typeof record.created_at === "string" &&
    record.created_at.length > 0 &&
    record.metadata_only === true &&
    isSafetyContext(record.safety_context) &&
    !hasForbiddenKeys(record)
  );
}

function isSafetyContext(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.approval_required === true &&
    record.tool_execution_allowed === false &&
    record.persistence_allowed === false &&
    record.metadata_only === true
  );
}

function hasForbiddenKeys(record: Record<string, unknown>): boolean {
  return [
    "raw_audio",
    "audio_bytes",
    "waveform",
    "pcm",
    "prompt",
    "response",
    "model_output",
    "tool_output",
    "api_key",
    "secret",
  ].some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function stableHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
