import type { ModelCapability } from "../types";
import type {
  ModelProvider,
  ModelProviderError,
  ModelProviderFailureClass,
  ModelProviderHealth,
  ModelProviderRequest,
  ModelProviderResponse,
  ModelProviderStreamEvent,
} from "./contract";
import type {
  DeepSeekClient,
  DeepSeekClientError,
  DeepSeekCompleteRequest,
  DeepSeekCompleteResult,
} from "./deepseek-client";

export const DEEPSEEK_MODEL_PROVIDER_DEFAULT_CAPABILITIES = [
  "chat",
  "summarize",
  "classify",
  "tool_reasoning",
] as const satisfies readonly ModelCapability[];

export interface DeepSeekProviderOptions {
  readonly id?: string;
  readonly capabilities?: readonly ModelCapability[];
  readonly now?: () => number;
  readonly client?: DeepSeekClient;
  readonly availableModels?: readonly string[];
}

interface NormalizedDeepSeekProviderOptions {
  readonly id: string;
  readonly capabilities: readonly ModelCapability[];
  readonly now: () => number;
  readonly client?: DeepSeekClient;
  readonly availableModels: readonly string[];
}

export function createDeepSeekModelProvider(
  options: DeepSeekProviderOptions = {},
): ModelProvider {
  const config = normalizeOptions(options);

  return {
    id: config.id,
    kind: "deepseek",
    runtime_class: "cloud",
    capabilities: clone(config.capabilities),
    metadata: {
      provider_id: config.id,
      display_name: "DeepSeek Model Provider",
      runtime_class: "cloud",
      supported_capabilities: clone(config.capabilities),
      supports_streaming: false,
      supports_abort: true,
      supports_timeout: true,
      governance_notes:
        "DeepSeek cloud calls require an injected client, explicit runtime cloud policy, and intentionally enabled registry entries.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) =>
      clone(await completeWithClient(config, request)),
    stream: (request) => streamFailClosed(config, request),
    health: async () => clone(await createHealth(config)),
  };
}

async function completeWithClient(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
): Promise<ModelProviderResponse> {
  try {
    validateCompleteRequest(config, request);

    if (!config.client) {
      throw createProviderError(
        config,
        request,
        "unavailable",
        "DeepSeek complete requires an injected client.",
      );
    }

    const result = await config.client.complete({
      request_id: request.request_id,
      model: request.model_id,
      messages: toDeepSeekMessages(config, request),
      options: {
        temperature: request.options.temperature,
        top_p: request.options.top_p,
        max_output_tokens: request.options.max_output_tokens,
        stop_sequences: request.options.stop_sequences,
      },
      timeout_ms: request.timeout_ms,
      abort_signal: request.abort_signal,
      metadata_only: true,
    });

    return createResponse(config, request, result);
  } catch (error) {
    throw normalizeProviderError(config, request, error);
  }
}

async function* streamFailClosed(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
): AsyncIterable<ModelProviderStreamEvent> {
  if (request.abort_signal?.aborted) {
    yield {
      type: "cancelled",
      request_id: request.request_id,
      model_id: request.model_id,
      provider_id: config.id,
      created_at_ms: config.now(),
      reason: "abort_signal",
      error_class: "cancelled",
    };
    return;
  }

  yield {
    type: "error",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: config.id,
    created_at_ms: config.now(),
    error: createProviderError(
      config,
      request,
      "provider_error",
      "DeepSeek streaming is not enabled by this provider adapter.",
    ),
  };
}

async function createHealth(
  config: NormalizedDeepSeekProviderOptions,
): Promise<ModelProviderHealth> {
  if (!config.client) {
    return {
      provider_id: config.id,
      ok: false,
      runtime_class: "cloud",
      available_models: [],
      checked_at: config.now(),
      degraded: true,
      error_class: "unavailable",
    };
  }

  return {
    provider_id: config.id,
    ok: true,
    runtime_class: "cloud",
    available_models: clone(config.availableModels),
    checked_at: config.now(),
    degraded: false,
  };
}

function validateCompleteRequest(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
) {
  if (request.abort_signal?.aborted) {
    throw createProviderError(
      config,
      request,
      "cancelled",
      "DeepSeek complete request was cancelled.",
    );
  }

  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms <= 0) {
    throw createProviderError(
      config,
      request,
      "invalid_request",
      "timeout_ms must be a positive integer.",
    );
  }

  if (!config.capabilities.includes(request.capability)) {
    throw createProviderError(
      config,
      request,
      "invalid_request",
      "Requested capability is not supported by the DeepSeek provider.",
    );
  }

  if (request.input.kind !== "text" && request.input.kind !== "messages") {
    throw createProviderError(
      config,
      request,
      "invalid_request",
      "DeepSeek complete only supports text and message inputs.",
    );
  }
}

function toDeepSeekMessages(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
): DeepSeekCompleteRequest["messages"] {
  if (request.input.kind === "text") {
    return [{ role: "user", content: request.input.content }];
  }

  if (request.input.kind === "messages") {
    return request.input.messages.map((message) => {
      if (message.role === "tool") {
        throw createProviderError(
          config,
          request,
          "invalid_request",
          "DeepSeek complete does not accept tool-role messages in this adapter.",
        );
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
  }

  throw createProviderError(
    config,
    request,
    "invalid_request",
    "DeepSeek complete only supports text and message inputs.",
  );
}

function createResponse(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
  result: DeepSeekCompleteResult,
): ModelProviderResponse {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: config.id,
    output: {
      kind: "text",
      content: result.output,
    },
    latency_ms: result.latency_ms,
    token_usage: {
      input_tokens: result.token_usage.input_tokens,
      output_tokens: result.token_usage.output_tokens,
      total_tokens: result.token_usage.total_tokens,
    },
    finish_reason: "stop",
    degraded: false,
    redaction_status: result.redaction_status,
  };
}

function createProviderError(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
  failureClass: ModelProviderFailureClass,
  message: string,
): ModelProviderError {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: config.id,
    failure_class: failureClass,
    message,
    retryable:
      failureClass === "unavailable" ||
      failureClass === "timeout" ||
      failureClass === "provider_error" ||
      failureClass === "unknown",
    degraded: true,
    redaction_status: "metadata_only",
  };
}

function normalizeProviderError(
  config: NormalizedDeepSeekProviderOptions,
  request: ModelProviderRequest,
  error: unknown,
): ModelProviderError {
  if (isModelProviderError(error)) return clone(error);
  if (isDeepSeekClientError(error)) {
    return {
      request_id: request.request_id,
      model_id: request.model_id,
      provider_id: config.id,
      failure_class: error.failure_class,
      message: error.message,
      retryable: error.retryable,
      degraded: true,
      redaction_status: "metadata_only",
    };
  }

  return createProviderError(
    config,
    request,
    "provider_error",
    "DeepSeek provider failed closed with an unknown client error.",
  );
}

function normalizeOptions(
  options: DeepSeekProviderOptions,
): NormalizedDeepSeekProviderOptions {
  return {
    id: options.id ?? "deepseek",
    capabilities: clone(
      options.capabilities ?? DEEPSEEK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
    ),
    now: options.now ?? (() => 0),
    client: options.client,
    availableModels: clone(
      options.availableModels ?? ["deepseek-v4-flash", "deepseek-v4-pro"],
    ),
  };
}

function isDeepSeekClientError(error: unknown): error is DeepSeekClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "failure_class" in error &&
    "redaction_status" in error
  );
}

function isModelProviderError(error: unknown): error is ModelProviderError {
  return (
    typeof error === "object" &&
    error !== null &&
    "provider_id" in error &&
    "failure_class" in error &&
    "redaction_status" in error
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
