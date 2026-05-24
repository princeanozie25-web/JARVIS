import type {
  ModelCapability,
  ModelProviderKind,
  ModelRuntimeClass,
} from "../types";

export const MODEL_PROVIDER_FAILURE_CLASSES = [
  "unavailable",
  "timeout",
  "cancelled",
  "invalid_request",
  "model_missing",
  "provider_error",
  "budget_blocked",
  "policy_blocked",
  "unknown",
] as const;

export const MODEL_PROVIDER_STREAM_EVENT_KINDS = [
  "token",
  "done",
  "error",
  "cancelled",
] as const;

export const MODEL_PROVIDER_FINISH_REASONS = [
  "stop",
  "length",
  "tool_calls",
  "cancelled",
  "timeout",
  "error",
  "budget_blocked",
  "policy_blocked",
] as const;

export const MODEL_PROVIDER_REDACTION_STATUSES = [
  "not_applicable",
  "redacted",
  "metadata_only",
] as const;

export type ModelProviderFailureClass =
  (typeof MODEL_PROVIDER_FAILURE_CLASSES)[number];
export type ModelProviderStreamEventKind =
  (typeof MODEL_PROVIDER_STREAM_EVENT_KINDS)[number];
export type ModelProviderFinishReason =
  (typeof MODEL_PROVIDER_FINISH_REASONS)[number];
export type ModelProviderRedactionStatus =
  (typeof MODEL_PROVIDER_REDACTION_STATUSES)[number];

export interface ModelProviderMetadata {
  readonly provider_id: string;
  readonly display_name: string;
  readonly runtime_class: ModelRuntimeClass;
  readonly supported_capabilities: readonly ModelCapability[];
  readonly supports_streaming: boolean;
  readonly supports_abort: boolean;
  readonly supports_timeout: boolean;
  readonly provider_version?: string;
  readonly governance_notes: string;
  readonly implementation_enabled: false;
  readonly network_access_enabled: false;
  readonly telemetry_persistence_enabled: false;
}

export interface ModelProviderProvenance {
  readonly request_origin: "model_runtime";
  readonly source_phase: "13A.2";
  readonly metadata_only: true;
  readonly correlation_id: string;
  readonly requested_at_ms: number;
  readonly caller: "registry_loader" | "router_preview" | "test_harness";
  readonly policy_ref?: string;
}

export type ModelProviderInput =
  | {
      readonly kind: "text";
      readonly content: string;
    }
  | {
      readonly kind: "messages";
      readonly messages: readonly ModelProviderMessage[];
    }
  | {
      readonly kind: "embedding";
      readonly content: string;
    }
  | {
      readonly kind: "vision";
      readonly content: string;
      readonly image_refs: readonly ModelProviderImageRef[];
    };

export interface ModelProviderMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly name?: string;
}

export interface ModelProviderImageRef {
  readonly ref_id: string;
  readonly media_type: "image/png" | "image/jpeg" | "image/webp";
  readonly source: "local_file" | "in_memory";
}

export interface ModelProviderRequestOptions {
  readonly temperature?: number;
  readonly top_p?: number;
  readonly max_output_tokens?: number;
  readonly stop_sequences?: readonly string[];
  readonly tool_choice?: "none" | "auto" | "required";
}

export interface ModelProviderRequest {
  readonly request_id: string;
  readonly model_id: string;
  readonly capability: ModelCapability;
  readonly input: ModelProviderInput;
  readonly options: ModelProviderRequestOptions;
  readonly timeout_ms: number;
  readonly abort_signal?: AbortSignal;
  readonly provenance: ModelProviderProvenance;
}

export interface ModelProviderTokenUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
}

export interface ModelProviderResponse {
  readonly request_id: string;
  readonly model_id: string;
  readonly provider_id: string;
  readonly output: ModelProviderOutput;
  readonly latency_ms: number;
  readonly token_usage: ModelProviderTokenUsage;
  readonly finish_reason: ModelProviderFinishReason;
  readonly degraded: boolean;
  readonly redaction_status: ModelProviderRedactionStatus;
}

export type ModelProviderOutput =
  | {
      readonly kind: "text";
      readonly content: string;
    }
  | {
      readonly kind: "embedding";
      readonly vector: readonly number[];
    }
  | {
      readonly kind: "tool_calls";
      readonly calls: readonly ModelProviderToolCall[];
    };

export interface ModelProviderToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments_json: string;
}

export interface ModelProviderError {
  readonly request_id?: string;
  readonly model_id?: string;
  readonly provider_id: string;
  readonly failure_class: ModelProviderFailureClass;
  readonly message: string;
  readonly retryable: boolean;
  readonly degraded: true;
  readonly redaction_status: ModelProviderRedactionStatus;
}

interface ModelProviderStreamEventBase {
  readonly request_id: string;
  readonly model_id: string;
  readonly provider_id: string;
  readonly created_at_ms: number;
}

export type ModelProviderStreamEvent =
  | (ModelProviderStreamEventBase & {
      readonly type: "token";
      readonly delta: string;
      readonly index: number;
      readonly redaction_status: ModelProviderRedactionStatus;
    })
  | (ModelProviderStreamEventBase & {
      readonly type: "done";
      readonly response: ModelProviderResponse;
    })
  | (ModelProviderStreamEventBase & {
      readonly type: "error";
      readonly error: ModelProviderError;
    })
  | (ModelProviderStreamEventBase & {
      readonly type: "cancelled";
      readonly reason: "abort_signal" | "timeout" | "provider_cancelled";
      readonly error_class: Extract<
        ModelProviderFailureClass,
        "cancelled" | "timeout"
      >;
    });

export interface ModelProviderHealth {
  readonly provider_id: string;
  readonly ok: boolean;
  readonly runtime_class: ModelRuntimeClass;
  readonly available_models: readonly string[];
  readonly checked_at: number;
  readonly degraded: boolean;
  readonly error_class?: ModelProviderFailureClass;
}

export interface ModelProvider {
  readonly id: string;
  readonly kind: ModelProviderKind;
  readonly runtime_class: ModelRuntimeClass;
  readonly capabilities: readonly ModelCapability[];
  readonly metadata: ModelProviderMetadata;
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse>;
  stream(
    request: ModelProviderRequest,
  ): AsyncIterable<ModelProviderStreamEvent>;
  health(): Promise<ModelProviderHealth>;
}
