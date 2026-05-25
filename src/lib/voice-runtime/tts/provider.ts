import type {
  TtsCancellationReason,
  TtsProviderConfig,
  TtsProviderHealth,
  TtsSynthesisOptions,
  TtsSynthesisRequest,
  TtsSynthesisResult,
  TtsValidationFailureReason,
  TtsValidationResult,
} from "./types";

export interface TtsProvider {
  readonly id: string;
  readonly kind: "local";
  readonly config: TtsProviderConfig;
  readonly metadata_only: true;
  synthesize(
    request: TtsSynthesisRequest,
    options: TtsSynthesisOptions,
  ): Promise<TtsSynthesisResult>;
  cancel(reason: TtsCancellationReason): Promise<void>;
  health(): Promise<TtsProviderHealth>;
}

export function validateTtsSynthesisRequest(
  request: unknown,
  config: TtsProviderConfig,
): TtsValidationResult {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return fail(["malformed_request"]);
  }

  const record = request as Record<string, unknown>;
  const reasons = new Set<TtsValidationFailureReason>();
  if (!isNonemptyString(record.request_id)) reasons.add("malformed_request");
  if (!isNonemptyString(record.turn_id)) reasons.add("malformed_request");
  if (!isNonemptyString(record.session_id)) reasons.add("malformed_request");
  if (!isNonemptyString(record.requested_voice_id)) {
    reasons.add("malformed_request");
  }
  if (record.requested_voice_id !== config.voice_id) {
    reasons.add("unsupported_voice");
  }
  if (record.metadata_only !== true) reasons.add("malformed_request");
  if (typeof record.allow_sensitive_content !== "boolean") {
    reasons.add("malformed_request");
  }
  if (!isNonemptyString(record.text)) {
    reasons.add("empty_text");
  } else if (record.text.length > config.max_input_chars) {
    reasons.add("input_too_long");
  }
  if (record.content_class !== "assistant_prose") {
    reasons.add("sensitive_content_blocked");
  }

  if (reasons.size > 0) return fail([...reasons]);
  return {
    ok: true,
    reasons: [],
  };
}

function fail(
  reasons: readonly TtsValidationFailureReason[],
): TtsValidationResult {
  return {
    ok: false,
    reasons,
  };
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
