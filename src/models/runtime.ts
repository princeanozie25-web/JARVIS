import { z } from "zod";
import type { ModelRegistryLoader } from "./registry";
import {
  buildFallbackPlan,
  resolveModel,
  type ModelFallbackGovernanceFlag,
  type ModelFallbackPlan,
  type ModelResolverInput,
  type ModelResolverResult,
} from "./resolver";
import {
  MODEL_CAPABILITIES,
  MODEL_RUNTIME_CLASSES,
  MODEL_TIERS,
} from "./types";
import type {
  ModelCapability,
  ModelProviderKind,
  ModelRegistryEntry,
  ModelRuntimeClass,
} from "./types";
import type {
  ModelProvider,
  ModelProviderError,
  ModelProviderFailureClass,
  ModelProviderFinishReason,
  ModelProviderInput,
  ModelProviderProvenance,
  ModelProviderRedactionStatus,
  ModelProviderRequestOptions,
  ModelProviderResponse,
  ModelProviderStreamEvent,
  ModelProviderTokenUsage,
} from "./providers/contract";

export type ModelRuntimeProviderMap =
  | ReadonlyMap<string, ModelProvider>
  | Readonly<Record<string, ModelProvider>>;

export type ModelRuntimeResolver = (
  registry: ModelRegistryLoader,
  input: ModelResolverInput,
) => ModelResolverResult;

export type ModelRuntimeFallbackPlanner = (
  registry: ModelRegistryLoader,
  input: ModelResolverInput,
  options?: { readonly now?: () => number },
) => ModelFallbackPlan;

export interface ModelRuntimeOptions {
  readonly registry: ModelRegistryLoader;
  readonly providers: ModelRuntimeProviderMap;
  readonly resolver?: ModelRuntimeResolver;
  readonly fallbackPlanner?: ModelRuntimeFallbackPlanner;
  readonly now?: () => number;
}

export interface ModelRuntimeExecuteRequest {
  readonly request_id: string;
  readonly capability: ModelCapability;
  readonly input: ModelProviderInput;
  readonly resolver_options?: Omit<ModelResolverInput, "capability">;
  readonly options?: ModelProviderRequestOptions;
  readonly timeout_ms: number;
  readonly abort_signal?: AbortSignal;
}

export interface ModelRuntimeFailedModel {
  readonly model_id: string;
  readonly provider_id?: string;
  readonly failure_class: ModelProviderFailureClass;
  readonly message: string;
}

export interface ModelRuntimeResultMetadata {
  readonly selected_model_id: string | null;
  readonly attempted_models: readonly string[];
  readonly successful_model: string | null;
  readonly failed_models: readonly ModelRuntimeFailedModel[];
  readonly fallback_used: boolean;
  readonly governance_flags: readonly ModelFallbackGovernanceFlag[];
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly failure_class?: ModelProviderFailureClass;
  readonly execution_summary: ModelRuntimeExecutionSummary;
}

export interface ModelRuntimeExecutionSummary {
  readonly execution_id: string;
  readonly request_id: string;
  readonly capability: ModelCapability | null;
  readonly selected_model_id: string | null;
  readonly selected_provider: string | null;
  readonly attempted_models: readonly string[];
  readonly successful_model: string | null;
  readonly failed_models: readonly ModelRuntimeFailedModel[];
  readonly fallback_used: boolean;
  readonly fallback_chain: readonly string[];
  readonly failure_class?: ModelProviderFailureClass;
  readonly latency_ms: number;
  readonly token_usage: ModelProviderTokenUsage;
  readonly degraded: boolean;
  readonly finish_reason: ModelProviderFinishReason | null;
  readonly governance_flags: readonly ModelFallbackGovernanceFlag[];
  readonly redaction_status: ModelProviderRedactionStatus;
  readonly runtime_class: ModelRuntimeClass | null;
  readonly provider_kind: ModelProviderKind | null;
  readonly started_at?: number;
  readonly ended_at?: number;
}

export interface ModelRuntimeExecuteResult {
  readonly request_id: string;
  readonly ok: boolean;
  readonly response: ModelProviderResponse | null;
  readonly metadata: ModelRuntimeResultMetadata;
}

export type ModelRuntimeStreamEvent =
  | ModelRuntimeStreamStartEvent
  | ModelRuntimeStreamTokenEvent
  | ModelRuntimeStreamDoneEvent
  | ModelRuntimeStreamErrorEvent
  | ModelRuntimeStreamCancelledEvent;

interface ModelRuntimeStreamEventBase {
  readonly request_id: string;
  readonly selected_model_id: string | null;
  readonly provider_id: string | null;
  readonly attempted_models: readonly string[];
  readonly fallback_used: boolean;
  readonly redaction_status: ModelProviderRedactionStatus;
  readonly governance_flags: readonly ModelFallbackGovernanceFlag[];
}

export interface ModelRuntimeStreamStartEvent extends ModelRuntimeStreamEventBase {
  readonly type: "start";
}

export interface ModelRuntimeStreamTokenEvent extends ModelRuntimeStreamEventBase {
  readonly type: "token";
  readonly delta: string;
  readonly token_index: number;
}

export interface ModelRuntimeStreamDoneEvent extends ModelRuntimeStreamEventBase {
  readonly type: "done";
  readonly finish_reason: ModelProviderFinishReason;
  readonly token_usage: ModelProviderTokenUsage;
  readonly latency_ms: number;
  readonly degraded: boolean;
}

export interface ModelRuntimeStreamErrorEvent extends ModelRuntimeStreamEventBase {
  readonly type: "error";
  readonly failure_class: ModelProviderFailureClass;
  readonly message: string;
  readonly degraded: true;
}

export interface ModelRuntimeStreamCancelledEvent extends ModelRuntimeStreamEventBase {
  readonly type: "cancelled";
  readonly failure_class: Extract<
    ModelProviderFailureClass,
    "cancelled" | "timeout"
  >;
  readonly reason: "abort_signal" | "timeout" | "provider_cancelled";
  readonly degraded: true;
}

export interface ModelRuntime {
  execute(request: unknown): Promise<ModelRuntimeExecuteResult>;
  stream(request: unknown): AsyncIterable<ModelRuntimeStreamEvent>;
}

const RuntimeResolverOptionsSchema = z.strictObject({
  preferred_tier: z.enum(MODEL_TIERS).optional(),
  allow_cloud: z.boolean().optional(),
  allow_disabled: z.boolean().optional(),
  runtime_class: z.enum(MODEL_RUNTIME_CLASSES).optional(),
  max_priority: z.number().int().nonnegative().optional(),
  excluded_model_ids: z.array(z.string().trim().min(1)).optional(),
  required_streaming: z.boolean().optional(),
  required_tools: z.boolean().optional(),
  required_vision: z.boolean().optional(),
});

const RuntimeExecuteRequestSchema = z.strictObject({
  request_id: z.string().trim().min(1),
  capability: z.enum(MODEL_CAPABILITIES),
  input: z.custom<ModelProviderInput>(isModelProviderInput),
  resolver_options: RuntimeResolverOptionsSchema.optional(),
  options: z.custom<ModelProviderRequestOptions>(isProviderOptions).optional(),
  timeout_ms: z.number().int().positive(),
  abort_signal: z.custom<AbortSignal>(isAbortSignal).optional(),
});

const ZERO_TOKEN_USAGE: ModelProviderTokenUsage = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
};

interface NormalizedRuntimeOptions {
  readonly registry: ModelRegistryLoader;
  readonly providers: ReadonlyMap<string, ModelProvider>;
  readonly resolver: ModelRuntimeResolver;
  readonly fallbackPlanner: ModelRuntimeFallbackPlanner;
  readonly now: () => number;
}

export function createModelRuntime(options: ModelRuntimeOptions): ModelRuntime {
  const config: NormalizedRuntimeOptions = {
    registry: options.registry,
    providers: normalizeProviders(options.providers),
    resolver: options.resolver ?? resolveModel,
    fallbackPlanner: options.fallbackPlanner ?? buildFallbackPlan,
    now: options.now ?? (() => 0),
  };

  return {
    execute: async (request) => execute(config, request),
    stream: (request) => stream(config, request),
  };
}

export function createModelRuntimeProviderKey(
  entry: Pick<ModelRegistryEntry, "provider" | "id">,
): string {
  return `${entry.provider}:${entry.id}`;
}

async function execute(
  config: NormalizedRuntimeOptions,
  request: unknown,
): Promise<ModelRuntimeExecuteResult> {
  const startedAt = config.now();
  const parsed = RuntimeExecuteRequestSchema.safeParse(request);

  if (!parsed.success) {
    return createFailureResult({
      requestId: runtimeRequestId(request),
      startedAt,
      endedAt: config.now(),
      failureClass: "invalid_request",
      message: "Model runtime execution request was malformed.",
    });
  }

  const executeRequest = parsed.data;
  const resolverInput = createResolverInput(executeRequest);
  const resolution = config.resolver(config.registry, resolverInput);
  const fallbackPlan = config.fallbackPlanner(config.registry, resolverInput, {
    now: config.now,
  });
  const primaryEntry = resolution.selected;

  if (!primaryEntry) {
    return createFailureResult({
      requestId: executeRequest.request_id,
      startedAt,
      endedAt: config.now(),
      selectedModelId: null,
      capability: executeRequest.capability,
      failureClass:
        resolution.failure?.reason === "invalid_request"
          ? "invalid_request"
          : "model_missing",
      message:
        resolution.failure?.message ??
        "No eligible model was available for execution.",
      governanceFlags: fallbackPlan.governance_flags,
    });
  }

  const attemptedModels: string[] = [];
  const failedModels: ModelRuntimeFailedModel[] = [];
  const attemptEntries = createAttemptEntries(primaryEntry, fallbackPlan);

  for (const [index, entry] of attemptEntries.entries()) {
    attemptedModels.push(entry.id);

    if (entry.runtime_class === "cloud") {
      failedModels.push({
        model_id: entry.id,
        failure_class: "policy_blocked",
        message: "Cloud model execution is not enabled in the local runtime.",
      });
      continue;
    }

    const provider = config.providers.get(createModelRuntimeProviderKey(entry));

    if (!provider) {
      failedModels.push({
        model_id: entry.id,
        failure_class: "unavailable",
        message: "No provider was injected for the selected model.",
      });
      continue;
    }

    try {
      const response = await provider.complete({
        request_id: executeRequest.request_id,
        model_id: entry.id,
        capability: executeRequest.capability,
        input: executeRequest.input,
        options: executeRequest.options ?? {},
        timeout_ms: executeRequest.timeout_ms,
        abort_signal: executeRequest.abort_signal,
        provenance: createProvenance(executeRequest, startedAt),
      });

      const endedAt = config.now();
      const fallbackChain = attemptEntries
        .slice(1)
        .map((fallbackEntry) => fallbackEntry.id);
      return clone({
        request_id: executeRequest.request_id,
        ok: true,
        response,
        metadata: createMetadata({
          executionId: executeRequest.request_id,
          requestId: executeRequest.request_id,
          capability: executeRequest.capability,
          selected_model_id: primaryEntry.id,
          selected_provider: response.provider_id,
          attempted_models: attemptedModels,
          successful_model: entry.id,
          failed_models: failedModels,
          fallback_used: index > 0,
          fallback_chain: fallbackChain,
          governance_flags: fallbackPlan.governance_flags,
          latency_ms: elapsedMs(startedAt, endedAt),
          degraded: response.degraded || index > 0,
          token_usage: response.token_usage,
          finish_reason: response.finish_reason,
          redaction_status: response.redaction_status,
          runtime_class: entry.runtime_class,
          provider_kind: entry.provider,
          started_at: startedAt,
          ended_at: endedAt,
        }),
      });
    } catch (error) {
      failedModels.push(
        normalizeFailedModel(entry, provider.id, error, executeRequest),
      );
    }
  }

  const lastFailure = failedModels.at(-1);
  const endedAt = config.now();
  const fallbackChain = attemptEntries
    .slice(1)
    .map((fallbackEntry) => fallbackEntry.id);
  return clone({
    request_id: executeRequest.request_id,
    ok: false,
    response: null,
    metadata: createMetadata({
      executionId: executeRequest.request_id,
      requestId: executeRequest.request_id,
      capability: executeRequest.capability,
      selected_model_id: primaryEntry.id,
      selected_provider: lastFailure?.provider_id ?? null,
      attempted_models: attemptedModels,
      successful_model: null,
      failed_models: failedModels,
      fallback_used: false,
      fallback_chain: fallbackChain,
      governance_flags: fallbackPlan.governance_flags,
      latency_ms: elapsedMs(startedAt, endedAt),
      degraded: true,
      failure_class: lastFailure?.failure_class ?? "provider_error",
      token_usage: ZERO_TOKEN_USAGE,
      finish_reason: "error",
      redaction_status: "metadata_only",
      runtime_class: primaryEntry.runtime_class,
      provider_kind: primaryEntry.provider,
      started_at: startedAt,
      ended_at: endedAt,
    }),
  });
}

async function* stream(
  config: NormalizedRuntimeOptions,
  request: unknown,
): AsyncIterable<ModelRuntimeStreamEvent> {
  const startedAt = config.now();
  const parsed = RuntimeExecuteRequestSchema.safeParse(request);

  if (!parsed.success) {
    yield createRuntimeStreamErrorEvent({
      requestId: runtimeRequestId(request),
      selectedModelId: null,
      providerId: null,
      attemptedModels: [],
      fallbackUsed: false,
      governanceFlags: [],
      failureClass: "invalid_request",
      message: "Model runtime stream request was malformed.",
    });
    return;
  }

  const streamRequest = parsed.data;
  const resolverInput = createStreamResolverInput(streamRequest);
  const resolution = config.resolver(config.registry, resolverInput);
  const fallbackPlan = config.fallbackPlanner(config.registry, resolverInput, {
    now: config.now,
  });
  const primaryEntry = resolution.selected;

  if (!primaryEntry) {
    yield createRuntimeStreamErrorEvent({
      requestId: streamRequest.request_id,
      selectedModelId: null,
      providerId: null,
      attemptedModels: [],
      fallbackUsed: false,
      governanceFlags: fallbackPlan.governance_flags,
      failureClass:
        resolution.failure?.reason === "invalid_request"
          ? "invalid_request"
          : "model_missing",
      message:
        resolution.failure?.message ??
        "No eligible streaming model was available for execution.",
    });
    return;
  }

  const attemptedModels: string[] = [];
  const attemptEntries = createAttemptEntries(primaryEntry, fallbackPlan);
  let lastFailure: {
    readonly providerId: string | null;
    readonly failureClass: ModelProviderFailureClass;
    readonly message: string;
  } | null = null;

  for (const [index, entry] of attemptEntries.entries()) {
    attemptedModels.push(entry.id);
    const fallbackUsed = index > 0;

    if (entry.runtime_class === "cloud") {
      lastFailure = {
        providerId: null,
        failureClass: "policy_blocked",
        message: "Cloud model streaming is not enabled in the local runtime.",
      };
      continue;
    }

    const provider = config.providers.get(createModelRuntimeProviderKey(entry));

    if (!provider) {
      lastFailure = {
        providerId: null,
        failureClass: "unavailable",
        message: "No provider was injected for the selected streaming model.",
      };
      continue;
    }

    let emittedTokens = 0;
    let startEmitted = false;
    let continueFallback = false;
    const providerRequest = createRuntimeProviderRequest(
      streamRequest,
      entry,
      startedAt,
    );

    try {
      for await (const providerEvent of provider.stream(providerRequest)) {
        if (!isModelProviderStreamEvent(providerEvent)) {
          if (emittedTokens === 0) {
            lastFailure = {
              providerId: provider.id,
              failureClass: "provider_error",
              message: "Provider emitted a malformed stream event.",
            };
            continueFallback = true;
            break;
          }

          yield createRuntimeStreamErrorEvent({
            requestId: streamRequest.request_id,
            selectedModelId: entry.id,
            providerId: provider.id,
            attemptedModels,
            fallbackUsed,
            governanceFlags: fallbackPlan.governance_flags,
            failureClass: "provider_error",
            message: "Provider emitted a malformed stream event.",
          });
          return;
        }

        if (providerEvent.type === "token") {
          if (!startEmitted) {
            yield createRuntimeStreamStartEvent({
              requestId: streamRequest.request_id,
              selectedModelId: entry.id,
              providerId: provider.id,
              attemptedModels,
              fallbackUsed,
              governanceFlags: fallbackPlan.governance_flags,
            });
            startEmitted = true;
          }
          yield createRuntimeStreamTokenEvent({
            requestId: streamRequest.request_id,
            selectedModelId: entry.id,
            providerId: provider.id,
            attemptedModels,
            fallbackUsed,
            governanceFlags: fallbackPlan.governance_flags,
            delta: providerEvent.delta,
            tokenIndex: providerEvent.index,
            redactionStatus: providerEvent.redaction_status,
          });
          emittedTokens += 1;
          continue;
        }

        if (providerEvent.type === "done") {
          if (!startEmitted) {
            yield createRuntimeStreamStartEvent({
              requestId: streamRequest.request_id,
              selectedModelId: entry.id,
              providerId: provider.id,
              attemptedModels,
              fallbackUsed,
              governanceFlags: fallbackPlan.governance_flags,
            });
          }
          yield createRuntimeStreamDoneEvent({
            requestId: streamRequest.request_id,
            selectedModelId: entry.id,
            providerId: provider.id,
            attemptedModels,
            fallbackUsed,
            governanceFlags: fallbackPlan.governance_flags,
            response: providerEvent.response,
            latencyMs: elapsedMs(startedAt, config.now()),
          });
          return;
        }

        if (providerEvent.type === "cancelled") {
          yield createRuntimeStreamCancelledEvent({
            requestId: streamRequest.request_id,
            selectedModelId: entry.id,
            providerId: provider.id,
            attemptedModels,
            fallbackUsed,
            governanceFlags: fallbackPlan.governance_flags,
            failureClass: providerEvent.error_class,
            reason: providerEvent.reason,
          });
          return;
        }

        if (
          providerEvent.error.failure_class === "cancelled" ||
          providerEvent.error.failure_class === "timeout"
        ) {
          yield createRuntimeStreamCancelledEvent({
            requestId: streamRequest.request_id,
            selectedModelId: entry.id,
            providerId: provider.id,
            attemptedModels,
            fallbackUsed,
            governanceFlags: fallbackPlan.governance_flags,
            failureClass: providerEvent.error.failure_class,
            reason:
              providerEvent.error.failure_class === "timeout"
                ? "timeout"
                : "abort_signal",
          });
          return;
        }

        if (
          emittedTokens === 0 &&
          shouldFallbackBeforeToken(providerEvent.error)
        ) {
          lastFailure = {
            providerId: provider.id,
            failureClass: providerEvent.error.failure_class,
            message: providerEvent.error.message,
          };
          continueFallback = true;
          break;
        }

        yield createRuntimeStreamErrorEvent({
          requestId: streamRequest.request_id,
          selectedModelId: entry.id,
          providerId: provider.id,
          attemptedModels,
          fallbackUsed,
          governanceFlags: fallbackPlan.governance_flags,
          failureClass: providerEvent.error.failure_class,
          message: providerEvent.error.message,
        });
        return;
      }
    } catch (error) {
      const failure = normalizeFailedModel(
        entry,
        provider.id,
        error,
        streamRequest,
      );
      if (
        failure.failure_class === "cancelled" ||
        failure.failure_class === "timeout"
      ) {
        yield createRuntimeStreamCancelledEvent({
          requestId: streamRequest.request_id,
          selectedModelId: entry.id,
          providerId: provider.id,
          attemptedModels,
          fallbackUsed,
          governanceFlags: fallbackPlan.governance_flags,
          failureClass: failure.failure_class,
          reason:
            failure.failure_class === "timeout" ? "timeout" : "abort_signal",
        });
        return;
      }

      if (emittedTokens === 0) {
        lastFailure = {
          providerId: provider.id,
          failureClass: failure.failure_class,
          message: failure.message,
        };
        continueFallback = true;
      } else {
        yield createRuntimeStreamErrorEvent({
          requestId: streamRequest.request_id,
          selectedModelId: entry.id,
          providerId: provider.id,
          attemptedModels,
          fallbackUsed,
          governanceFlags: fallbackPlan.governance_flags,
          failureClass: failure.failure_class,
          message: failure.message,
        });
        return;
      }
    }

    if (continueFallback) continue;

    if (emittedTokens === 0) {
      lastFailure = {
        providerId: provider.id,
        failureClass: "provider_error",
        message: "Provider stream ended without a terminal event.",
      };
      continue;
    }

    yield createRuntimeStreamErrorEvent({
      requestId: streamRequest.request_id,
      selectedModelId: entry.id,
      providerId: provider.id,
      attemptedModels,
      fallbackUsed,
      governanceFlags: fallbackPlan.governance_flags,
      failureClass: "provider_error",
      message: "Provider stream ended without a terminal event.",
    });
    return;
  }

  const lastAttemptedModel = attemptedModels.at(-1) ?? primaryEntry.id;
  const lastAttemptedEntry =
    attemptEntries.find((entry) => entry.id === lastAttemptedModel) ??
    primaryEntry;
  const failureClass =
    lastFailure?.failureClass ??
    (lastAttemptedEntry.runtime_class === "cloud"
      ? "policy_blocked"
      : "unavailable");
  yield createRuntimeStreamErrorEvent({
    requestId: streamRequest.request_id,
    selectedModelId: primaryEntry.id,
    providerId: lastFailure?.providerId ?? null,
    attemptedModels,
    fallbackUsed: false,
    governanceFlags: fallbackPlan.governance_flags,
    failureClass,
    message:
      lastFailure?.message ??
      (failureClass === "policy_blocked"
        ? "Cloud model streaming is not enabled in the local runtime."
        : "No provider stream produced a terminal response."),
  });
}

function createAttemptEntries(
  primaryEntry: ModelRegistryEntry,
  fallbackPlan: ModelFallbackPlan,
): ModelRegistryEntry[] {
  const entries = [primaryEntry];
  const seen = new Set([primaryEntry.id]);

  for (const candidate of fallbackPlan.fallback_chain) {
    if (seen.has(candidate.entry.id)) continue;
    if (!isGovernanceEquivalent(primaryEntry, candidate.entry)) continue;
    entries.push(candidate.entry);
    seen.add(candidate.entry.id);
  }

  return entries;
}

function isGovernanceEquivalent(
  primaryEntry: ModelRegistryEntry,
  fallbackEntry: ModelRegistryEntry,
): boolean {
  return (
    primaryEntry.runtime_class === fallbackEntry.runtime_class &&
    primaryEntry.visibility === fallbackEntry.visibility
  );
}

function createResolverInput(
  request: z.infer<typeof RuntimeExecuteRequestSchema>,
): ModelResolverInput {
  return {
    ...request.resolver_options,
    capability: request.capability,
  };
}

function createStreamResolverInput(
  request: z.infer<typeof RuntimeExecuteRequestSchema>,
): ModelResolverInput {
  return {
    ...request.resolver_options,
    capability: request.capability,
    required_streaming: true,
  };
}

function createRuntimeProviderRequest(
  request: z.infer<typeof RuntimeExecuteRequestSchema>,
  entry: ModelRegistryEntry,
  requestedAtMs: number,
) {
  return {
    request_id: request.request_id,
    model_id: entry.id,
    capability: request.capability,
    input: request.input,
    options: request.options ?? {},
    timeout_ms: request.timeout_ms,
    abort_signal: request.abort_signal,
    provenance: createProvenance(request, requestedAtMs),
  };
}

function createProvenance(
  request: z.infer<typeof RuntimeExecuteRequestSchema>,
  requestedAtMs: number,
): ModelProviderProvenance {
  return {
    request_origin: "model_runtime",
    source_phase: "13A.2",
    metadata_only: true,
    correlation_id: request.request_id,
    requested_at_ms: requestedAtMs,
    caller: "test_harness",
  };
}

function shouldFallbackBeforeToken(error: ModelProviderError): boolean {
  return (
    error.failure_class !== "cancelled" &&
    error.failure_class !== "timeout" &&
    error.failure_class !== "budget_blocked" &&
    error.failure_class !== "policy_blocked"
  );
}

function createRuntimeStreamStartEvent(input: {
  readonly requestId: string;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly attemptedModels: readonly string[];
  readonly fallbackUsed: boolean;
  readonly governanceFlags: readonly ModelFallbackGovernanceFlag[];
}): ModelRuntimeStreamStartEvent {
  return clone({
    ...createRuntimeStreamEventBase(input),
    type: "start",
  });
}

function createRuntimeStreamTokenEvent(input: {
  readonly requestId: string;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly attemptedModels: readonly string[];
  readonly fallbackUsed: boolean;
  readonly governanceFlags: readonly ModelFallbackGovernanceFlag[];
  readonly delta: string;
  readonly tokenIndex: number;
  readonly redactionStatus: ModelProviderRedactionStatus;
}): ModelRuntimeStreamTokenEvent {
  return clone({
    ...createRuntimeStreamEventBase({
      ...input,
      redactionStatus: input.redactionStatus,
    }),
    type: "token",
    delta: input.delta,
    token_index: input.tokenIndex,
  });
}

function createRuntimeStreamDoneEvent(input: {
  readonly requestId: string;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly attemptedModels: readonly string[];
  readonly fallbackUsed: boolean;
  readonly governanceFlags: readonly ModelFallbackGovernanceFlag[];
  readonly response: ModelProviderResponse;
  readonly latencyMs: number;
}): ModelRuntimeStreamDoneEvent {
  return clone({
    ...createRuntimeStreamEventBase({
      ...input,
      redactionStatus: input.response.redaction_status,
    }),
    type: "done",
    finish_reason: input.response.finish_reason,
    token_usage: input.response.token_usage,
    latency_ms: input.latencyMs,
    degraded: input.response.degraded || input.fallbackUsed,
  });
}

function createRuntimeStreamErrorEvent(input: {
  readonly requestId: string;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly attemptedModels: readonly string[];
  readonly fallbackUsed: boolean;
  readonly governanceFlags: readonly ModelFallbackGovernanceFlag[];
  readonly failureClass: ModelProviderFailureClass;
  readonly message: string;
}): ModelRuntimeStreamErrorEvent {
  return clone({
    ...createRuntimeStreamEventBase(input),
    type: "error",
    failure_class: input.failureClass,
    message: input.message,
    degraded: true,
  });
}

function createRuntimeStreamCancelledEvent(input: {
  readonly requestId: string;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly attemptedModels: readonly string[];
  readonly fallbackUsed: boolean;
  readonly governanceFlags: readonly ModelFallbackGovernanceFlag[];
  readonly failureClass: Extract<
    ModelProviderFailureClass,
    "cancelled" | "timeout"
  >;
  readonly reason: "abort_signal" | "timeout" | "provider_cancelled";
}): ModelRuntimeStreamCancelledEvent {
  return clone({
    ...createRuntimeStreamEventBase(input),
    type: "cancelled",
    failure_class: input.failureClass,
    reason: input.reason,
    degraded: true,
  });
}

function createRuntimeStreamEventBase(input: {
  readonly requestId: string;
  readonly selectedModelId: string | null;
  readonly providerId: string | null;
  readonly attemptedModels: readonly string[];
  readonly fallbackUsed: boolean;
  readonly governanceFlags: readonly ModelFallbackGovernanceFlag[];
  readonly redactionStatus?: ModelProviderRedactionStatus;
}): ModelRuntimeStreamEventBase {
  return {
    request_id: input.requestId,
    selected_model_id: input.selectedModelId,
    provider_id: input.providerId,
    attempted_models: clone(input.attemptedModels),
    fallback_used: input.fallbackUsed,
    redaction_status: input.redactionStatus ?? "metadata_only",
    governance_flags: clone(input.governanceFlags),
  };
}

function normalizeFailedModel(
  entry: ModelRegistryEntry,
  providerId: string,
  error: unknown,
  request: z.infer<typeof RuntimeExecuteRequestSchema>,
): ModelRuntimeFailedModel {
  if (isModelProviderError(error)) {
    return {
      model_id: entry.id,
      provider_id: providerId,
      failure_class: error.failure_class,
      message: error.message,
    };
  }

  return {
    model_id: entry.id,
    provider_id: providerId,
    failure_class: "provider_error",
    message: `Provider failed closed for request ${request.request_id}.`,
  };
}

function createFailureResult(input: {
  readonly requestId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly selectedModelId?: string | null;
  readonly selectedProvider?: string | null;
  readonly capability?: ModelCapability | null;
  readonly failureClass: ModelProviderFailureClass;
  readonly message: string;
  readonly governanceFlags?: readonly ModelFallbackGovernanceFlag[];
  readonly runtimeClass?: ModelRuntimeClass | null;
  readonly providerKind?: ModelProviderKind | null;
  readonly fallbackChain?: readonly string[];
}): ModelRuntimeExecuteResult {
  const failedModels: ModelRuntimeFailedModel[] = input.selectedModelId
    ? [
        {
          model_id: input.selectedModelId,
          failure_class: input.failureClass,
          message: input.message,
        },
      ]
    : [];
  return clone({
    request_id: input.requestId,
    ok: false,
    response: null,
    metadata: createMetadata({
      executionId: input.requestId,
      requestId: input.requestId,
      capability: input.capability ?? null,
      selected_model_id: input.selectedModelId ?? null,
      selected_provider: input.selectedProvider ?? null,
      attempted_models: [],
      successful_model: null,
      failed_models: failedModels,
      fallback_used: false,
      fallback_chain: input.fallbackChain ?? [],
      governance_flags: input.governanceFlags ?? [],
      latency_ms: elapsedMs(input.startedAt, input.endedAt),
      degraded: true,
      failure_class: input.failureClass,
      token_usage: ZERO_TOKEN_USAGE,
      finish_reason: "error",
      redaction_status: "metadata_only",
      runtime_class: input.runtimeClass ?? null,
      provider_kind: input.providerKind ?? null,
      started_at: input.startedAt,
      ended_at: input.endedAt,
    }),
  });
}

function createMetadata(input: {
  readonly executionId: string;
  readonly requestId: string;
  readonly capability: ModelCapability | null;
  readonly selected_model_id: string | null;
  readonly selected_provider: string | null;
  readonly attempted_models: readonly string[];
  readonly successful_model: string | null;
  readonly failed_models: readonly ModelRuntimeFailedModel[];
  readonly fallback_used: boolean;
  readonly fallback_chain: readonly string[];
  readonly governance_flags: readonly ModelFallbackGovernanceFlag[];
  readonly latency_ms: number;
  readonly degraded: boolean;
  readonly failure_class?: ModelProviderFailureClass;
  readonly token_usage: ModelProviderTokenUsage;
  readonly finish_reason: ModelProviderFinishReason | null;
  readonly redaction_status: ModelProviderRedactionStatus;
  readonly runtime_class: ModelRuntimeClass | null;
  readonly provider_kind: ModelProviderKind | null;
  readonly started_at?: number;
  readonly ended_at?: number;
}): ModelRuntimeResultMetadata {
  const summary: ModelRuntimeExecutionSummary = {
    execution_id: input.executionId,
    request_id: input.requestId,
    capability: input.capability,
    selected_model_id: input.selected_model_id,
    selected_provider: input.selected_provider,
    attempted_models: input.attempted_models,
    successful_model: input.successful_model,
    failed_models: input.failed_models,
    fallback_used: input.fallback_used,
    fallback_chain: input.fallback_chain,
    latency_ms: input.latency_ms,
    token_usage: input.token_usage,
    degraded: input.degraded,
    finish_reason: input.finish_reason,
    governance_flags: input.governance_flags,
    redaction_status: input.redaction_status,
    runtime_class: input.runtime_class,
    provider_kind: input.provider_kind,
    started_at: input.started_at,
    ended_at: input.ended_at,
    ...(input.failure_class ? { failure_class: input.failure_class } : {}),
  };

  return {
    selected_model_id: input.selected_model_id,
    attempted_models: input.attempted_models,
    successful_model: input.successful_model,
    failed_models: input.failed_models,
    fallback_used: input.fallback_used,
    governance_flags: input.governance_flags,
    latency_ms: input.latency_ms,
    degraded: input.degraded,
    execution_summary: summary,
    ...(input.failure_class ? { failure_class: input.failure_class } : {}),
  };
}

function normalizeProviders(
  providers: ModelRuntimeProviderMap,
): ReadonlyMap<string, ModelProvider> {
  if (providers instanceof Map) return new Map(providers);
  return new Map(Object.entries(providers));
}

function elapsedMs(startedAt: number, endedAt: number): number {
  return Math.max(0, endedAt - startedAt);
}

function runtimeRequestId(request: unknown): string {
  if (
    typeof request === "object" &&
    request !== null &&
    "request_id" in request &&
    typeof (request as { request_id: unknown }).request_id === "string"
  ) {
    return (request as { request_id: string }).request_id;
  }
  return "invalid-runtime-request";
}

function isModelProviderError(error: unknown): error is ModelProviderError {
  return (
    typeof error === "object" &&
    error !== null &&
    "failure_class" in error &&
    "redaction_status" in error
  );
}

function isModelProviderStreamEvent(
  event: unknown,
): event is ModelProviderStreamEvent {
  if (!event || typeof event !== "object" || !("type" in event)) return false;
  const candidate = event as Record<string, unknown>;
  if (
    typeof candidate.request_id !== "string" ||
    typeof candidate.model_id !== "string" ||
    typeof candidate.provider_id !== "string" ||
    typeof candidate.created_at_ms !== "number"
  ) {
    return false;
  }

  if (candidate.type === "token") {
    return (
      typeof candidate.delta === "string" &&
      Number.isInteger(candidate.index) &&
      isRedactionStatus(candidate.redaction_status)
    );
  }

  if (candidate.type === "done") {
    return isModelProviderResponse(candidate.response);
  }

  if (candidate.type === "error") {
    return isModelProviderError(candidate.error);
  }

  if (candidate.type === "cancelled") {
    return (
      (candidate.reason === "abort_signal" ||
        candidate.reason === "timeout" ||
        candidate.reason === "provider_cancelled") &&
      (candidate.error_class === "cancelled" ||
        candidate.error_class === "timeout")
    );
  }

  return false;
}

function isModelProviderResponse(
  response: unknown,
): response is ModelProviderResponse {
  if (!response || typeof response !== "object") return false;
  const candidate = response as Record<string, unknown>;
  return (
    typeof candidate.request_id === "string" &&
    typeof candidate.model_id === "string" &&
    typeof candidate.provider_id === "string" &&
    typeof candidate.latency_ms === "number" &&
    isTokenUsage(candidate.token_usage) &&
    typeof candidate.degraded === "boolean" &&
    typeof candidate.finish_reason === "string" &&
    isRedactionStatus(candidate.redaction_status)
  );
}

function isTokenUsage(value: unknown): value is ModelProviderTokenUsage {
  if (!value || typeof value !== "object") return false;
  const usage = value as Record<string, unknown>;
  return (
    typeof usage.input_tokens === "number" &&
    typeof usage.output_tokens === "number" &&
    typeof usage.total_tokens === "number"
  );
}

function isRedactionStatus(
  value: unknown,
): value is ModelProviderRedactionStatus {
  return (
    value === "not_applicable" ||
    value === "redacted" ||
    value === "metadata_only"
  );
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    typeof value === "object" &&
    value !== null &&
    "aborted" in value &&
    typeof (value as { aborted: unknown }).aborted === "boolean" &&
    "addEventListener" in value
  );
}

function isProviderOptions(
  value: unknown,
): value is ModelProviderRequestOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const options = value as Record<string, unknown>;
  const allowed = new Set([
    "temperature",
    "top_p",
    "max_output_tokens",
    "stop_sequences",
    "tool_choice",
  ]);
  if (!Object.keys(options).every((key) => allowed.has(key))) return false;
  if ("temperature" in options && typeof options.temperature !== "number") {
    return false;
  }
  if ("top_p" in options && typeof options.top_p !== "number") return false;
  if (
    "max_output_tokens" in options &&
    (!Number.isInteger(options.max_output_tokens) ||
      Number(options.max_output_tokens) <= 0)
  ) {
    return false;
  }
  if (
    "stop_sequences" in options &&
    (!Array.isArray(options.stop_sequences) ||
      !options.stop_sequences.every((entry) => typeof entry === "string"))
  ) {
    return false;
  }
  if (
    "tool_choice" in options &&
    options.tool_choice !== "none" &&
    options.tool_choice !== "auto" &&
    options.tool_choice !== "required"
  ) {
    return false;
  }
  return true;
}

function isModelProviderInput(value: unknown): value is ModelProviderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as { readonly kind?: unknown };

  if (input.kind === "text" || input.kind === "embedding") {
    return (
      typeof (value as { readonly content?: unknown }).content === "string"
    );
  }

  if (input.kind === "messages") {
    const messages = (value as { readonly messages?: unknown }).messages;
    return (
      Array.isArray(messages) &&
      messages.every(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          typeof (message as { readonly role?: unknown }).role === "string" &&
          typeof (message as { readonly content?: unknown }).content ===
            "string",
      )
    );
  }

  if (input.kind === "vision") {
    const visionInput = value as {
      readonly content?: unknown;
      readonly image_refs?: unknown;
    };
    return (
      typeof visionInput.content === "string" &&
      Array.isArray(visionInput.image_refs)
    );
  }

  return false;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
