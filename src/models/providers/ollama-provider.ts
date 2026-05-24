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
  OllamaClient,
  OllamaClientError,
  OllamaCompleteInput,
  OllamaCompleteResult,
} from "./ollama-client";

export const OLLAMA_MODEL_PROVIDER_DEFAULT_CAPABILITIES = [
  "chat",
  "summarize",
  "classify",
  "embed",
] as const satisfies readonly ModelCapability[];

export type OllamaProviderHealthErrorClass = Extract<
  ModelProviderFailureClass,
  "unavailable" | "model_missing" | "provider_error" | "unknown"
>;

export type OllamaProviderProbeResult =
  | {
      readonly ok: true;
      readonly available_models: readonly string[];
      readonly checked_at?: number;
      readonly degraded?: boolean;
    }
  | {
      readonly ok: false;
      readonly available_models?: readonly string[];
      readonly checked_at?: number;
      readonly degraded?: boolean;
      readonly error_class?: OllamaProviderHealthErrorClass;
    };

export interface OllamaProviderOptions {
  readonly id?: string;
  readonly capabilities?: readonly ModelCapability[];
  readonly now?: () => number;
  readonly client?: OllamaClient;
  readonly healthRequestId?: string;
  readonly healthTimeoutMs?: number;
  readonly healthProbe?: () =>
    | OllamaProviderProbeResult
    | Promise<OllamaProviderProbeResult>;
}

interface NormalizedOllamaProviderOptions {
  readonly id: string;
  readonly capabilities: readonly ModelCapability[];
  readonly now: () => number;
  readonly client?: OllamaClient;
  readonly healthRequestId: string;
  readonly healthTimeoutMs: number;
  readonly healthProbe?: OllamaProviderOptions["healthProbe"];
}

export function createOllamaModelProvider(
  options: OllamaProviderOptions = {},
): ModelProvider {
  const config = normalizeOptions(options);

  return {
    id: config.id,
    kind: "ollama",
    runtime_class: "local",
    capabilities: clone(config.capabilities),
    metadata: {
      provider_id: config.id,
      display_name: "Ollama Model Provider",
      runtime_class: "local",
      supported_capabilities: clone(config.capabilities),
      supports_streaming: false,
      supports_abort: true,
      supports_timeout: true,
      governance_notes:
        "Ollama local complete calls require an injected client; health metadata may come from an injected probe, while streaming fails closed.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) => {
      return clone(await completeWithClient(config, request));
    },
    stream: (request) => streamFailure(config, request),
    health: async () => clone(await createHealth(config)),
  };
}

async function completeWithClient(
  config: NormalizedOllamaProviderOptions,
  request: ModelProviderRequest,
): Promise<ModelProviderResponse> {
  try {
    validateCompleteRequest(config, request);

    if (!config.client) {
      throw createProviderError(
        config,
        request,
        "unavailable",
        "Ollama complete requires an injected client.",
      );
    }

    const result = await config.client.complete({
      request_id: request.request_id,
      model: request.model_id,
      input: toOllamaInput(config, request),
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

async function* streamFailure(
  config: NormalizedOllamaProviderOptions,
  request: ModelProviderRequest,
): AsyncIterable<ModelProviderStreamEvent> {
  yield clone({
    type: "error",
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: config.id,
    created_at_ms: config.now(),
    error: createProviderError(
      config,
      request,
      "provider_error",
      "Ollama streaming is not implemented in Phase 13B.1.",
    ),
  });
}

async function createHealth(
  config: NormalizedOllamaProviderOptions,
): Promise<ModelProviderHealth> {
  if (config.client) {
    return createClientHealth(config);
  }

  if (!config.healthProbe) {
    return {
      provider_id: config.id,
      ok: false,
      runtime_class: "local",
      available_models: [],
      checked_at: config.now(),
      degraded: true,
      error_class: "unavailable",
    };
  }

  try {
    const probeResult = await config.healthProbe();
    if (!probeResult.ok) {
      return {
        provider_id: config.id,
        ok: false,
        runtime_class: "local",
        available_models: clone(probeResult.available_models ?? []),
        checked_at: probeResult.checked_at ?? config.now(),
        degraded: probeResult.degraded ?? true,
        error_class: probeResult.error_class ?? "unavailable",
      };
    }

    return {
      provider_id: config.id,
      ok: true,
      runtime_class: "local",
      available_models: clone(probeResult.available_models),
      checked_at: probeResult.checked_at ?? config.now(),
      degraded: probeResult.degraded ?? false,
    };
  } catch {
    return {
      provider_id: config.id,
      ok: false,
      runtime_class: "local",
      available_models: [],
      checked_at: config.now(),
      degraded: true,
      error_class: "unavailable",
    };
  }
}

async function createClientHealth(
  config: NormalizedOllamaProviderOptions,
): Promise<ModelProviderHealth> {
  if (!config.client) {
    return {
      provider_id: config.id,
      ok: false,
      runtime_class: "local",
      available_models: [],
      checked_at: config.now(),
      degraded: true,
      error_class: "unavailable",
    };
  }

  try {
    const result = await config.client.listModels({
      request_id: config.healthRequestId,
      timeout_ms: config.healthTimeoutMs,
      metadata_only: true,
    });
    const availableModels = result.models.map((model) => model.name);

    if (availableModels.length === 0) {
      return {
        provider_id: config.id,
        ok: false,
        runtime_class: "local",
        available_models: [],
        checked_at: result.checked_at,
        degraded: true,
        error_class: "model_missing",
      };
    }

    return {
      provider_id: config.id,
      ok: true,
      runtime_class: "local",
      available_models: availableModels,
      checked_at: result.checked_at,
      degraded: result.degraded,
    };
  } catch (error) {
    const errorClass = isOllamaClientError(error)
      ? error.failure_class
      : "provider_error";

    return {
      provider_id: config.id,
      ok: false,
      runtime_class: "local",
      available_models: [],
      checked_at: config.now(),
      degraded: true,
      error_class: errorClass,
    };
  }
}

function createProviderError(
  config: NormalizedOllamaProviderOptions,
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

function createResponse(
  config: NormalizedOllamaProviderOptions,
  request: ModelProviderRequest,
  result: OllamaCompleteResult,
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

function validateCompleteRequest(
  config: NormalizedOllamaProviderOptions,
  request: ModelProviderRequest,
) {
  if (request.abort_signal?.aborted) {
    throw createProviderError(
      config,
      request,
      "cancelled",
      "Ollama complete request was cancelled.",
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
      "Requested capability is not supported by the Ollama provider.",
    );
  }

  if (request.input.kind !== "text" && request.input.kind !== "messages") {
    throw createProviderError(
      config,
      request,
      "invalid_request",
      "Ollama complete only supports text and message inputs.",
    );
  }
}

function toOllamaInput(
  config: NormalizedOllamaProviderOptions,
  request: ModelProviderRequest,
): OllamaCompleteInput {
  if (request.input.kind === "text") {
    return {
      kind: "text",
      content: request.input.content,
    };
  }

  if (request.input.kind === "messages") {
    return {
      kind: "messages",
      messages: request.input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };
  }

  throw createProviderError(
    config,
    request,
    "invalid_request",
    "Ollama complete only supports text and message inputs.",
  );
}

function normalizeProviderError(
  config: NormalizedOllamaProviderOptions,
  request: ModelProviderRequest,
  error: unknown,
): ModelProviderError {
  if (isModelProviderError(error)) return clone(error);

  if (isOllamaClientError(error)) {
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
    "Ollama provider failed closed with an unknown client error.",
  );
}

function normalizeOptions(
  options: OllamaProviderOptions,
): NormalizedOllamaProviderOptions {
  return {
    id: options.id ?? "ollama",
    capabilities: clone(
      options.capabilities ?? OLLAMA_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
    ),
    now: options.now ?? (() => 0),
    client: options.client,
    healthRequestId: options.healthRequestId ?? "ollama-health-check",
    healthTimeoutMs: options.healthTimeoutMs ?? 5_000,
    healthProbe: options.healthProbe,
  };
}

function isOllamaClientError(error: unknown): error is OllamaClientError {
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
