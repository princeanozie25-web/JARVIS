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
import type { ModelCapability, ModelRegistryEntry } from "./types";
import type {
  ModelProvider,
  ModelProviderError,
  ModelProviderFailureClass,
  ModelProviderInput,
  ModelProviderProvenance,
  ModelProviderRequestOptions,
  ModelProviderResponse,
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
}

export interface ModelRuntimeExecuteResult {
  readonly request_id: string;
  readonly ok: boolean;
  readonly response: ModelProviderResponse | null;
  readonly metadata: ModelRuntimeResultMetadata;
}

export interface ModelRuntime {
  execute(request: unknown): Promise<ModelRuntimeExecuteResult>;
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

      return clone({
        request_id: executeRequest.request_id,
        ok: true,
        response,
        metadata: {
          selected_model_id: primaryEntry.id,
          attempted_models: attemptedModels,
          successful_model: entry.id,
          failed_models: failedModels,
          fallback_used: index > 0,
          governance_flags: fallbackPlan.governance_flags,
          latency_ms: elapsedMs(startedAt, config.now()),
          degraded: response.degraded || index > 0,
        },
      });
    } catch (error) {
      failedModels.push(
        normalizeFailedModel(entry, provider.id, error, executeRequest),
      );
    }
  }

  const lastFailure = failedModels.at(-1);
  return clone({
    request_id: executeRequest.request_id,
    ok: false,
    response: null,
    metadata: {
      selected_model_id: primaryEntry.id,
      attempted_models: attemptedModels,
      successful_model: null,
      failed_models: failedModels,
      fallback_used: false,
      governance_flags: fallbackPlan.governance_flags,
      latency_ms: elapsedMs(startedAt, config.now()),
      degraded: true,
      failure_class: lastFailure?.failure_class ?? "provider_error",
    },
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
  readonly failureClass: ModelProviderFailureClass;
  readonly message: string;
  readonly governanceFlags?: readonly ModelFallbackGovernanceFlag[];
}): ModelRuntimeExecuteResult {
  return clone({
    request_id: input.requestId,
    ok: false,
    response: null,
    metadata: {
      selected_model_id: input.selectedModelId ?? null,
      attempted_models: [],
      successful_model: null,
      failed_models: input.selectedModelId
        ? [
            {
              model_id: input.selectedModelId,
              failure_class: input.failureClass,
              message: input.message,
            },
          ]
        : [],
      fallback_used: false,
      governance_flags: input.governanceFlags ?? [],
      latency_ms: elapsedMs(input.startedAt, input.endedAt),
      degraded: true,
      failure_class: input.failureClass,
    },
  });
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
