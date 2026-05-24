import type { ModelProviderFailureClass } from "./contract";

export type OllamaClientFailureClass = Extract<
  ModelProviderFailureClass,
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "invalid_request"
  | "model_missing"
  | "provider_error"
  | "unknown"
>;

export interface OllamaClientCallOptions {
  readonly request_id: string;
  readonly timeout_ms: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface OllamaModelDescriptor {
  readonly name: string;
  readonly modified_at?: string;
  readonly size_bytes?: number;
  readonly digest?: string;
}

export interface OllamaListModelsResult {
  readonly request_id: string;
  readonly models: readonly OllamaModelDescriptor[];
  readonly checked_at: number;
  readonly degraded: boolean;
}

export type OllamaCompleteInput =
  | {
      readonly kind: "text";
      readonly content: string;
    }
  | {
      readonly kind: "messages";
      readonly messages: readonly OllamaClientMessage[];
    };

export interface OllamaClientMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
}

export interface OllamaCompleteRequest extends OllamaClientCallOptions {
  readonly model: string;
  readonly input: OllamaCompleteInput;
  readonly options?: {
    readonly temperature?: number;
    readonly top_p?: number;
    readonly max_output_tokens?: number;
    readonly stop_sequences?: readonly string[];
  };
}

export interface OllamaTokenUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
}

export interface OllamaCompleteResult {
  readonly request_id: string;
  readonly model: string;
  readonly output: string;
  readonly latency_ms: number;
  readonly token_usage: OllamaTokenUsage;
  readonly done: true;
  readonly redaction_status: "metadata_only";
}

export interface OllamaClientError {
  readonly request_id?: string;
  readonly model?: string;
  readonly failure_class: OllamaClientFailureClass;
  readonly message: string;
  readonly retryable: boolean;
  readonly redaction_status: "metadata_only";
}

interface OllamaStreamEventBase {
  readonly request_id: string;
  readonly model: string;
  readonly created_at_ms: number;
}

export type OllamaStreamEvent =
  | (OllamaStreamEventBase & {
      readonly type: "token";
      readonly delta: string;
      readonly index: number;
      readonly redaction_status: "metadata_only";
    })
  | (OllamaStreamEventBase & {
      readonly type: "done";
      readonly result: OllamaCompleteResult;
    })
  | (OllamaStreamEventBase & {
      readonly type: "error";
      readonly error: OllamaClientError;
    })
  | (OllamaStreamEventBase & {
      readonly type: "cancelled";
      readonly reason: "abort_signal" | "timeout";
      readonly error_class: Extract<
        OllamaClientFailureClass,
        "cancelled" | "timeout"
      >;
    });

export interface OllamaClient {
  listModels(options: OllamaClientCallOptions): Promise<OllamaListModelsResult>;
  complete(request: OllamaCompleteRequest): Promise<OllamaCompleteResult>;
  stream(request: OllamaCompleteRequest): AsyncIterable<OllamaStreamEvent>;
}

export interface FakeOllamaClientOptions {
  readonly models?: readonly OllamaModelDescriptor[];
  readonly failureMode?: OllamaClientFailureClass | null;
  readonly latencyMs?: number;
  readonly now?: () => number;
  readonly waitForLatency?: (input: {
    readonly latencyMs: number;
    readonly signal?: AbortSignal;
  }) => Promise<void>;
}

interface NormalizedFakeOllamaClientOptions {
  readonly models: readonly OllamaModelDescriptor[];
  readonly failureMode: OllamaClientFailureClass | null;
  readonly latencyMs: number;
  readonly now: () => number;
  readonly waitForLatency?: FakeOllamaClientOptions["waitForLatency"];
}

export function createFakeOllamaClient(
  options: FakeOllamaClientOptions = {},
): OllamaClient {
  const config = normalizeFakeOptions(options);

  return {
    listModels: async (callOptions) => {
      await prepareCall(config, callOptions);
      return clone({
        request_id: callOptions.request_id,
        models: config.models,
        checked_at: config.now(),
        degraded: false,
      });
    },
    complete: async (request) => {
      await prepareCall(config, request, request.model);
      if (!config.models.some((model) => model.name === request.model)) {
        throw createClientError(
          request,
          "model_missing",
          "Requested Ollama model is not available.",
        );
      }
      return clone(createCompleteResult(config, request));
    },
    stream: (request) => streamFakeResponse(config, request),
  };
}

export function createOllamaClientError(input: {
  readonly request_id?: string;
  readonly model?: string;
  readonly failure_class: OllamaClientFailureClass;
  readonly message: string;
  readonly retryable?: boolean;
}): OllamaClientError {
  return {
    request_id: input.request_id,
    model: input.model,
    failure_class: input.failure_class,
    message: input.message,
    retryable: input.retryable ?? isRetryable(input.failure_class),
    redaction_status: "metadata_only",
  };
}

async function* streamFakeResponse(
  config: NormalizedFakeOllamaClientOptions,
  request: OllamaCompleteRequest,
): AsyncIterable<OllamaStreamEvent> {
  try {
    await prepareCall(config, request, request.model);
    if (!config.models.some((model) => model.name === request.model)) {
      throw createClientError(
        request,
        "model_missing",
        "Requested Ollama model is not available.",
      );
    }
    const result = createCompleteResult(config, request);
    const tokens = result.output.split(":");

    for (const [index, token] of tokens.entries()) {
      assertNotCancelled(request);
      yield clone({
        type: "token",
        request_id: request.request_id,
        model: request.model,
        created_at_ms: config.now(),
        delta: token,
        index,
        redaction_status: "metadata_only",
      });
    }

    yield clone({
      type: "done",
      request_id: request.request_id,
      model: request.model,
      created_at_ms: config.now(),
      result,
    });
  } catch (error) {
    const clientError = normalizeClientError(error, request);
    if (
      clientError.failure_class === "cancelled" ||
      clientError.failure_class === "timeout"
    ) {
      yield clone({
        type: "cancelled",
        request_id: request.request_id,
        model: request.model,
        created_at_ms: config.now(),
        reason:
          clientError.failure_class === "timeout" ? "timeout" : "abort_signal",
        error_class: clientError.failure_class,
      });
      return;
    }

    yield clone({
      type: "error",
      request_id: request.request_id,
      model: request.model,
      created_at_ms: config.now(),
      error: clientError,
    });
  }
}

async function prepareCall(
  config: NormalizedFakeOllamaClientOptions,
  options: OllamaClientCallOptions,
  model?: string,
) {
  validateCall(config, options, model);
  if (config.latencyMs > 0 && config.waitForLatency) {
    await config.waitForLatency({
      latencyMs: config.latencyMs,
      signal: options.abort_signal,
    });
  }
  validateCall(config, options, model);
}

function validateCall(
  config: NormalizedFakeOllamaClientOptions,
  options: OllamaClientCallOptions,
  model?: string,
) {
  assertNotCancelled(options, model);

  if (!options.metadata_only) {
    throw createClientError(
      { ...options, model },
      "invalid_request",
      "Ollama client calls must be marked metadata_only.",
    );
  }

  if (!Number.isInteger(options.timeout_ms) || options.timeout_ms <= 0) {
    throw createClientError(
      { ...options, model },
      "invalid_request",
      "timeout_ms must be a positive integer.",
    );
  }

  if (config.failureMode) {
    throw createClientError(
      { ...options, model },
      config.failureMode,
      `Fake Ollama client forced ${config.failureMode} failure.`,
    );
  }

  if (config.latencyMs > options.timeout_ms) {
    throw createClientError(
      { ...options, model },
      "timeout",
      "Fake Ollama client deterministic latency exceeded timeout_ms.",
    );
  }
}

function createCompleteResult(
  config: NormalizedFakeOllamaClientOptions,
  request: OllamaCompleteRequest,
): OllamaCompleteResult {
  const output = `ollama:${request.model}:${fingerprintInput(request.input)}`;
  const inputTokens = countInputTokens(request.input);
  const outputTokens = countWords(output);

  return {
    request_id: request.request_id,
    model: request.model,
    output,
    latency_ms: config.latencyMs,
    token_usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
    done: true,
    redaction_status: "metadata_only",
  };
}

function assertNotCancelled(options: OllamaClientCallOptions, model?: string) {
  if (options.abort_signal?.aborted) {
    throw createClientError(
      { ...options, model },
      "cancelled",
      "Ollama client call was cancelled.",
    );
  }
}

function createClientError(
  input: OllamaClientCallOptions & { readonly model?: string },
  failureClass: OllamaClientFailureClass,
  message: string,
): OllamaClientError {
  return createOllamaClientError({
    request_id: input.request_id,
    model: input.model,
    failure_class: failureClass,
    message,
  });
}

function normalizeClientError(
  error: unknown,
  request: OllamaCompleteRequest,
): OllamaClientError {
  if (isOllamaClientError(error)) return clone(error);
  return createOllamaClientError({
    request_id: request.request_id,
    model: request.model,
    failure_class: "provider_error",
    message: "Ollama client failed closed with an unknown error.",
  });
}

function isOllamaClientError(error: unknown): error is OllamaClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "failure_class" in error &&
    "redaction_status" in error
  );
}

function isRetryable(failureClass: OllamaClientFailureClass): boolean {
  return (
    failureClass === "unavailable" ||
    failureClass === "timeout" ||
    failureClass === "provider_error" ||
    failureClass === "unknown"
  );
}

function countInputTokens(input: OllamaCompleteInput): number {
  if (input.kind === "text") return countWords(input.content);
  return input.messages.reduce(
    (total, message) => total + countWords(message.content),
    0,
  );
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function fingerprintInput(input: OllamaCompleteInput): number {
  const text =
    input.kind === "text"
      ? input.content
      : input.messages
          .map((message) => `${message.role}:${message.content}`)
          .join("\n");
  let hash = 0;
  for (const char of text) {
    hash = (hash * 33 + char.charCodeAt(0)) % 100_000;
  }
  return hash;
}

function normalizeFakeOptions(
  options: FakeOllamaClientOptions,
): NormalizedFakeOllamaClientOptions {
  const latencyMs = options.latencyMs ?? 0;
  if (!Number.isInteger(latencyMs) || latencyMs < 0) {
    throw new Error(
      "Fake Ollama client latencyMs must be a nonnegative integer.",
    );
  }

  return {
    models: clone(
      options.models ?? [
        {
          name: "llama3.2:3b",
          modified_at: "2026-01-01T00:00:00.000Z",
          size_bytes: 3_000_000_000,
          digest: "sha256:mock-llama32-3b",
        },
        {
          name: "qwen2.5:7b",
          modified_at: "2026-01-01T00:00:00.000Z",
          size_bytes: 7_000_000_000,
          digest: "sha256:mock-qwen25-7b",
        },
      ],
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
