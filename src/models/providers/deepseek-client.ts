import type { ModelProviderFailureClass } from "./contract";

export type DeepSeekClientFailureClass = Extract<
  ModelProviderFailureClass,
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "invalid_request"
  | "model_missing"
  | "provider_error"
  | "unknown"
>;

export interface DeepSeekClientCallOptions {
  readonly request_id: string;
  readonly timeout_ms: number;
  readonly abort_signal?: AbortSignal;
  readonly metadata_only: true;
}

export interface DeepSeekMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface DeepSeekCompleteRequest extends DeepSeekClientCallOptions {
  readonly model: string;
  readonly messages: readonly DeepSeekMessage[];
  readonly options?: {
    readonly temperature?: number;
    readonly top_p?: number;
    readonly max_output_tokens?: number;
    readonly stop_sequences?: readonly string[];
  };
}

export interface DeepSeekTokenUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
}

export interface DeepSeekCompleteResult {
  readonly request_id: string;
  readonly model: string;
  readonly output: string;
  readonly latency_ms: number;
  readonly token_usage: DeepSeekTokenUsage;
  readonly done: true;
  readonly redaction_status: "metadata_only";
}

export interface DeepSeekClientError {
  readonly request_id?: string;
  readonly model?: string;
  readonly failure_class: DeepSeekClientFailureClass;
  readonly message: string;
  readonly retryable: boolean;
  readonly redaction_status: "metadata_only";
}

export interface DeepSeekClient {
  complete(request: DeepSeekCompleteRequest): Promise<DeepSeekCompleteResult>;
}

export type DeepSeekFetchImpl = (
  input: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
    readonly signal?: AbortSignal;
  },
) => Promise<DeepSeekFetchResponse>;

export interface DeepSeekFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText?: string;
  text(): Promise<string>;
}

export interface DeepSeekHttpClientOptions {
  readonly api_key: string;
  readonly base_url?: string;
  readonly timeout_ms?: number;
  readonly fetch_impl?: DeepSeekFetchImpl;
  readonly now?: () => number;
}

interface NormalizedDeepSeekHttpClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetchImpl: DeepSeekFetchImpl;
  readonly now: () => number;
}

export function createDeepSeekHttpClient(
  options: DeepSeekHttpClientOptions,
): DeepSeekClient {
  const config = normalizeHttpOptions(options);

  return {
    complete: async (request) => {
      validateHttpCall(request);
      const startedAt = config.now();
      const response = await fetchText(config, "/chat/completions", {
        method: "POST",
        callOptions: request,
        model: request.model,
        body: {
          model: request.model,
          messages: request.messages,
          temperature: request.options?.temperature,
          top_p: request.options?.top_p,
          max_tokens: request.options?.max_output_tokens,
          stop: request.options?.stop_sequences,
          stream: false,
        },
      });
      return normalizeChatCompletionResponse(
        request,
        response,
        Math.max(0, config.now() - startedAt),
      );
    },
  };
}

export function createDeepSeekClientError(input: {
  readonly request_id?: string;
  readonly model?: string;
  readonly failure_class: DeepSeekClientFailureClass;
  readonly message: string;
  readonly retryable?: boolean;
}): DeepSeekClientError {
  return {
    request_id: input.request_id,
    model: input.model,
    failure_class: input.failure_class,
    message: input.message,
    retryable: input.retryable ?? isRetryable(input.failure_class),
    redaction_status: "metadata_only",
  };
}

async function fetchText(
  config: NormalizedDeepSeekHttpClientOptions,
  path: string,
  request: {
    readonly method: "POST";
    readonly callOptions: DeepSeekClientCallOptions;
    readonly body: unknown;
    readonly model: string;
  },
): Promise<string> {
  const timeout = createTimeoutSignal(
    request.callOptions.timeout_ms || config.timeoutMs,
    request.callOptions.abort_signal,
  );

  try {
    const response = await config.fetchImpl(`${config.baseUrl}${path}`, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(request.body),
      signal: timeout.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw createClientError(
        { ...request.callOptions, model: request.model },
        classifyHttpFailure(response.status, body),
        `DeepSeek HTTP request failed with status ${response.status}.`,
      );
    }

    return response.text();
  } catch (error) {
    throw normalizeTransportError(error, request.callOptions, request.model);
  } finally {
    timeout.cleanup();
  }
}

function validateHttpCall(options: DeepSeekClientCallOptions, model?: string) {
  if (!options.metadata_only) {
    throw createClientError(
      { ...options, model },
      "invalid_request",
      "DeepSeek HTTP client calls must be marked metadata_only.",
    );
  }
  if (!Number.isInteger(options.timeout_ms) || options.timeout_ms <= 0) {
    throw createClientError(
      { ...options, model },
      "invalid_request",
      "timeout_ms must be a positive integer.",
    );
  }
  if (options.abort_signal?.aborted) {
    throw createClientError(
      { ...options, model },
      "cancelled",
      "DeepSeek HTTP client call was cancelled.",
    );
  }
}

function normalizeChatCompletionResponse(
  request: DeepSeekCompleteRequest,
  text: string,
  latencyMs: number,
): DeepSeekCompleteResult {
  const parsed = parseJsonObject(text, request, request.model);
  const choices = parsed.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : null;
  const message =
    firstChoice && typeof firstChoice === "object"
      ? (firstChoice as Record<string, unknown>).message
      : null;
  const content =
    message && typeof message === "object"
      ? (message as Record<string, unknown>).content
      : null;

  if (typeof content !== "string") {
    throw createClientError(
      request,
      "provider_error",
      "DeepSeek chat completion response was malformed.",
    );
  }

  const usage =
    parsed.usage && typeof parsed.usage === "object"
      ? (parsed.usage as Record<string, unknown>)
      : {};
  const inputTokens =
    typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
  const outputTokens =
    typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0;

  return {
    request_id: request.request_id,
    model: request.model,
    output: content,
    latency_ms: latencyMs,
    token_usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens:
        typeof usage.total_tokens === "number"
          ? usage.total_tokens
          : inputTokens + outputTokens,
    },
    done: true,
    redaction_status: "metadata_only",
  };
}

function parseJsonObject(
  text: string,
  options: DeepSeekClientCallOptions,
  model?: string,
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw createClientError(
      { ...options, model },
      "provider_error",
      "DeepSeek response JSON was malformed.",
    );
  }
}

function classifyHttpFailure(
  status: number,
  body: string,
): DeepSeekClientFailureClass {
  if (status === 404 || /not\s+found|model/i.test(body)) {
    return "model_missing";
  }
  if (status === 400 || status === 401 || status === 403) {
    return "invalid_request";
  }
  if (status === 408 || status === 504) return "timeout";
  if (status === 429 || status >= 500) return "unavailable";
  return "provider_error";
}

function createTimeoutSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal,
): { readonly signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abort);
    },
  };
}

function normalizeTransportError(
  error: unknown,
  options: DeepSeekClientCallOptions,
  model?: string,
): DeepSeekClientError {
  if (isDeepSeekClientError(error)) return error;
  if (isAbortLikeError(error)) {
    return createClientError(
      { ...options, model },
      options.abort_signal?.aborted ? "cancelled" : "timeout",
      "DeepSeek HTTP client call was aborted.",
    );
  }
  return createClientError(
    { ...options, model },
    "unavailable",
    "DeepSeek HTTP client could not reach the configured service.",
  );
}

function normalizeHttpOptions(
  options: DeepSeekHttpClientOptions,
): NormalizedDeepSeekHttpClientOptions {
  const apiKey = options.api_key.trim();
  if (!apiKey) {
    throw new Error("DeepSeek HTTP client requires DEEPSEEK_API_KEY.");
  }

  const timeoutMs = options.timeout_ms ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      "DeepSeek HTTP client timeout_ms must be a positive integer.",
    );
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(options.base_url ?? "https://api.deepseek.com"),
    timeoutMs,
    fetchImpl: options.fetch_impl ?? defaultFetchImpl,
    now: options.now ?? Date.now,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("DEEPSEEK_BASE_URL must use https.");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function createClientError(
  input: DeepSeekClientCallOptions & { readonly model?: string },
  failureClass: DeepSeekClientFailureClass,
  message: string,
): DeepSeekClientError {
  return createDeepSeekClientError({
    request_id: input.request_id,
    model: input.model,
    failure_class: failureClass,
    message,
  });
}

function isAbortLikeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    String((error as { name: unknown }).name) === "AbortError"
  );
}

function isDeepSeekClientError(error: unknown): error is DeepSeekClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "failure_class" in error &&
    "redaction_status" in error
  );
}

function isRetryable(failureClass: DeepSeekClientFailureClass): boolean {
  return (
    failureClass === "unavailable" ||
    failureClass === "timeout" ||
    failureClass === "provider_error" ||
    failureClass === "unknown"
  );
}

const defaultFetchImpl: DeepSeekFetchImpl = async (input, init) => {
  const response = await globalThis.fetch(input, init);
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text: () => response.text(),
  };
};
