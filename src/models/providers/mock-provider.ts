import type { ModelCapability } from "../types";
import type {
  ModelProvider,
  ModelProviderError,
  ModelProviderFailureClass,
  ModelProviderHealth,
  ModelProviderInput,
  ModelProviderOutput,
  ModelProviderRequest,
  ModelProviderResponse,
  ModelProviderStreamEvent,
} from "./contract";

export const MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES = [
  "chat",
  "summarize",
  "classify",
  "embed",
] as const satisfies readonly ModelCapability[];

export const MOCK_MODEL_PROVIDER_DEFAULT_MODEL_ID = "mock-local-model";

export type MockModelProviderFailureMode = Extract<
  ModelProviderFailureClass,
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "invalid_request"
  | "model_missing"
  | "provider_error"
>;

export interface MockModelProviderOptions {
  readonly id?: string;
  readonly availableModels?: readonly string[];
  readonly capabilities?: readonly ModelCapability[];
  readonly failureMode?: MockModelProviderFailureMode | null;
  readonly latencyMs?: number;
  readonly now?: () => number;
  readonly waitForLatency?: (input: {
    readonly latencyMs: number;
    readonly signal?: AbortSignal;
  }) => Promise<void>;
}

interface NormalizedMockModelProviderOptions {
  readonly id: string;
  readonly availableModels: readonly string[];
  readonly capabilities: readonly ModelCapability[];
  readonly failureMode: MockModelProviderFailureMode | null;
  readonly latencyMs: number;
  readonly now: () => number;
  readonly waitForLatency?: MockModelProviderOptions["waitForLatency"];
}

export function createMockModelProvider(
  options: MockModelProviderOptions = {},
): ModelProvider {
  const config = normalizeOptions(options);

  return {
    id: config.id,
    kind: "mock",
    runtime_class: "mock",
    capabilities: clone(config.capabilities),
    metadata: {
      provider_id: config.id,
      display_name: "Mock Model Provider",
      runtime_class: "mock",
      supported_capabilities: clone(config.capabilities),
      supports_streaming: true,
      supports_abort: true,
      supports_timeout: true,
      governance_notes:
        "Deterministic fake-first provider; no model runtime, SDK, network, telemetry persistence, or routing authority.",
      implementation_enabled: false,
      network_access_enabled: false,
      telemetry_persistence_enabled: false,
    },
    complete: async (request) => {
      await prepareRequest(config, request);
      return clone(createResponse(config, request));
    },
    stream: (request) => streamResponse(config, request),
    health: async () => clone(createHealth(config)),
  };
}

async function* streamResponse(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
): AsyncIterable<ModelProviderStreamEvent> {
  try {
    await prepareRequest(config, request);
    const response = createResponse(config, request);
    const tokens = streamTokensFor(response.output);

    for (const [index, token] of tokens.entries()) {
      assertNotCancelled(config, request);
      yield clone({
        type: "token",
        request_id: request.request_id,
        model_id: request.model_id,
        provider_id: config.id,
        created_at_ms: config.now(),
        delta: token,
        index,
        redaction_status: "metadata_only",
      });
    }

    yield clone({
      type: "done",
      request_id: request.request_id,
      model_id: request.model_id,
      provider_id: config.id,
      created_at_ms: config.now(),
      response,
    });
  } catch (error) {
    const providerError = normalizeProviderError(config, request, error);
    if (
      providerError.failure_class === "cancelled" ||
      providerError.failure_class === "timeout"
    ) {
      yield clone({
        type: "cancelled",
        request_id: request.request_id,
        model_id: request.model_id,
        provider_id: config.id,
        created_at_ms: config.now(),
        reason:
          providerError.failure_class === "timeout"
            ? "timeout"
            : "abort_signal",
        error_class: providerError.failure_class,
      });
      return;
    }

    yield clone({
      type: "error",
      request_id: request.request_id,
      model_id: request.model_id,
      provider_id: config.id,
      created_at_ms: config.now(),
      error: providerError,
    });
  }
}

async function prepareRequest(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
) {
  validateRequest(config, request);
  await maybeSimulateLatency(config, request);
  validateRequest(config, request);
}

function validateRequest(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
) {
  assertNotCancelled(config, request);

  if (config.failureMode) {
    throw createProviderError(
      config,
      request,
      config.failureMode,
      `Mock provider forced ${config.failureMode} failure.`,
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

  if (config.latencyMs > request.timeout_ms) {
    throw createProviderError(
      config,
      request,
      "timeout",
      "Mock provider deterministic latency exceeded timeout_ms.",
    );
  }

  if (!config.availableModels.includes(request.model_id)) {
    throw createProviderError(
      config,
      request,
      "model_missing",
      "Requested model is not available in the mock provider.",
    );
  }

  if (!config.capabilities.includes(request.capability)) {
    throw createProviderError(
      config,
      request,
      "invalid_request",
      "Requested capability is not supported by the mock provider.",
    );
  }
}

async function maybeSimulateLatency(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
) {
  if (config.latencyMs === 0 || !config.waitForLatency) return;
  await config.waitForLatency({
    latencyMs: config.latencyMs,
    signal: request.abort_signal,
  });
}

function createResponse(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
): ModelProviderResponse {
  const output = createOutput(request);
  const tokenUsage = createTokenUsage(request.input, output);

  return {
    request_id: request.request_id,
    model_id: request.model_id,
    provider_id: config.id,
    output,
    latency_ms: config.latencyMs,
    token_usage: tokenUsage,
    finish_reason: "stop",
    degraded: false,
    redaction_status: "metadata_only",
  };
}

function createOutput(request: ModelProviderRequest): ModelProviderOutput {
  const fingerprint = fingerprintInput(request.input);
  if (request.capability === "embed") {
    return {
      kind: "embedding",
      vector: [
        boundedFraction(fingerprint, 97),
        boundedFraction(fingerprint, 193),
        boundedFraction(fingerprint, 389),
      ],
    };
  }

  return {
    kind: "text",
    content: `mock:${request.capability}:${request.model_id}:${fingerprint}`,
  };
}

function streamTokensFor(output: ModelProviderOutput): string[] {
  if (output.kind === "text") return output.content.split(":");
  if (output.kind === "embedding") {
    return output.vector.map((value) => value.toFixed(3));
  }
  return output.calls.map((call) => call.name);
}

function createHealth(
  config: NormalizedMockModelProviderOptions,
): ModelProviderHealth {
  if (config.failureMode === "unavailable") {
    return {
      provider_id: config.id,
      ok: false,
      runtime_class: "mock",
      available_models: clone(config.availableModels),
      checked_at: config.now(),
      degraded: true,
      error_class: "unavailable",
    };
  }

  return {
    provider_id: config.id,
    ok: true,
    runtime_class: "mock",
    available_models: clone(config.availableModels),
    checked_at: config.now(),
    degraded: false,
  };
}

function createTokenUsage(
  input: ModelProviderInput,
  output: ModelProviderOutput,
) {
  const inputTokens = countMetadataTokens(input);
  const outputTokens =
    output.kind === "text"
      ? countWords(output.content)
      : output.kind === "embedding"
        ? output.vector.length
        : output.calls.length;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };
}

function countMetadataTokens(input: ModelProviderInput): number {
  switch (input.kind) {
    case "text":
    case "embedding":
      return countWords(input.content);
    case "messages":
      return input.messages.reduce(
        (total, message) => total + countWords(message.content),
        0,
      );
    case "vision":
      return countWords(input.content) + input.image_refs.length;
  }
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function fingerprintInput(input: ModelProviderInput): number {
  const text = inputToText(input);
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
  }
  return hash;
}

function inputToText(input: ModelProviderInput): string {
  switch (input.kind) {
    case "text":
    case "embedding":
      return input.content;
    case "messages":
      return input.messages
        .map((message) => `${message.role}:${message.content}`)
        .join("\n");
    case "vision":
      return `${input.content}:${input.image_refs
        .map((imageRef) => imageRef.ref_id)
        .join(",")}`;
  }
}

function boundedFraction(value: number, divisor: number): number {
  return Number(((value % divisor) / divisor).toFixed(6));
}

function assertNotCancelled(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
) {
  if (request.abort_signal?.aborted) {
    throw createProviderError(
      config,
      request,
      "cancelled",
      "Mock provider request was cancelled.",
    );
  }
}

function createProviderError(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
  failureClass: MockModelProviderFailureMode,
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
      failureClass === "provider_error",
    degraded: true,
    redaction_status: "metadata_only",
  };
}

function normalizeProviderError(
  config: NormalizedMockModelProviderOptions,
  request: ModelProviderRequest,
  error: unknown,
): ModelProviderError {
  if (isModelProviderError(error)) return clone(error);
  return createProviderError(
    config,
    request,
    "provider_error",
    "Mock provider failed closed with an unknown error.",
  );
}

function isModelProviderError(error: unknown): error is ModelProviderError {
  return (
    typeof error === "object" &&
    error !== null &&
    "failure_class" in error &&
    "provider_id" in error &&
    "redaction_status" in error
  );
}

function normalizeOptions(
  options: MockModelProviderOptions,
): NormalizedMockModelProviderOptions {
  const latencyMs = options.latencyMs ?? 0;
  if (!Number.isInteger(latencyMs) || latencyMs < 0) {
    throw new Error("Mock provider latencyMs must be a nonnegative integer.");
  }

  return {
    id: options.id ?? "mock",
    availableModels: clone(
      options.availableModels ?? [MOCK_MODEL_PROVIDER_DEFAULT_MODEL_ID],
    ),
    capabilities: clone(
      options.capabilities ?? MOCK_MODEL_PROVIDER_DEFAULT_CAPABILITIES,
    ),
    failureMode: options.failureMode ?? null,
    latencyMs,
    now: options.now ?? (() => 0),
    waitForLatency: options.waitForLatency,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
