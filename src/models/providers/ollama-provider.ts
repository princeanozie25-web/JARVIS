import type { ModelCapability } from "../types";
import type {
  ModelProvider,
  ModelProviderError,
  ModelProviderFailureClass,
  ModelProviderHealth,
  ModelProviderRequest,
  ModelProviderStreamEvent,
} from "./contract";
import type { OllamaClient, OllamaClientError } from "./ollama-client";

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
        "Ollama scaffold only; health metadata may come from an injected probe, while inference and streaming fail closed.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) => {
      throw createProviderError(
        config,
        request,
        "provider_error",
        "Ollama inference is not implemented in Phase 13B.1.",
      );
    },
    stream: (request) => streamFailure(config, request),
    health: async () => clone(await createHealth(config)),
  };
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
  failureClass: Extract<ModelProviderFailureClass, "provider_error">,
  message: string,
): ModelProviderError {
  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: config.id,
    failure_class: failureClass,
    message,
    retryable: false,
    degraded: true,
    redaction_status: "metadata_only",
  };
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

function clone<T>(value: T): T {
  return structuredClone(value);
}
