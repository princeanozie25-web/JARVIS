import { z } from "zod";
import {
  MODEL_FALLBACK_GOVERNANCE_FLAGS,
  type ModelFallbackGovernanceFlag,
} from "./resolver";
import {
  MODEL_CAPABILITIES,
  MODEL_PROVIDER_KINDS,
  MODEL_RUNTIME_CLASSES,
  type ModelCapability,
  type ModelProviderKind,
  type ModelRuntimeClass,
} from "./types";
import type {
  ModelRuntimeExecutionSummary,
  ModelRuntimeFailedModel,
} from "./runtime";
import {
  MODEL_PROVIDER_FAILURE_CLASSES,
  MODEL_PROVIDER_FINISH_REASONS,
  MODEL_PROVIDER_REDACTION_STATUSES,
  type ModelProviderFailureClass,
  type ModelProviderFinishReason,
  type ModelProviderRedactionStatus,
  type ModelProviderTokenUsage,
} from "./providers/contract";

export class ModelCallEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelCallEventError";
  }
}

const NonEmptyStringSchema = z.string().trim().min(1);
const MetadataNumberSchema = z.number().refine(Number.isFinite);
const NonnegativeMetadataNumberSchema = z
  .number()
  .nonnegative()
  .refine(Number.isFinite);
const TokenCountSchema = z.number().int().nonnegative();

const ModelProviderTokenUsageSchema = z.strictObject({
  input_tokens: TokenCountSchema,
  output_tokens: TokenCountSchema,
  total_tokens: TokenCountSchema,
});

const ModelRuntimeFailedModelSchema = z.strictObject({
  model_id: NonEmptyStringSchema,
  provider_id: NonEmptyStringSchema.optional(),
  failure_class: z.enum(MODEL_PROVIDER_FAILURE_CLASSES),
  message: z.string(),
});

const ModelRuntimeExecutionSummaryForEventSchema = z.strictObject({
  execution_id: NonEmptyStringSchema,
  request_id: NonEmptyStringSchema,
  capability: z.enum(MODEL_CAPABILITIES).nullable(),
  selected_model_id: NonEmptyStringSchema.nullable(),
  selected_provider: NonEmptyStringSchema.nullable(),
  attempted_models: z.array(NonEmptyStringSchema),
  successful_model: NonEmptyStringSchema.nullable(),
  failed_models: z.array(ModelRuntimeFailedModelSchema),
  fallback_used: z.boolean(),
  fallback_chain: z.array(NonEmptyStringSchema),
  failure_class: z.enum(MODEL_PROVIDER_FAILURE_CLASSES).optional(),
  latency_ms: NonnegativeMetadataNumberSchema,
  token_usage: ModelProviderTokenUsageSchema,
  degraded: z.boolean(),
  finish_reason: z.enum(MODEL_PROVIDER_FINISH_REASONS).nullable(),
  governance_flags: z.array(z.enum(MODEL_FALLBACK_GOVERNANCE_FLAGS)),
  redaction_status: z.enum(MODEL_PROVIDER_REDACTION_STATUSES),
  runtime_class: z.enum(MODEL_RUNTIME_CLASSES).nullable(),
  provider_kind: z.enum(MODEL_PROVIDER_KINDS).nullable(),
  started_at: MetadataNumberSchema.optional(),
  ended_at: MetadataNumberSchema.optional(),
});

export const ModelCallEventSchema = z.strictObject({
  event_id: NonEmptyStringSchema,
  request_id: NonEmptyStringSchema,
  execution_id: NonEmptyStringSchema,
  capability: z.enum(MODEL_CAPABILITIES).nullable(),
  selected_model_id: NonEmptyStringSchema.nullable(),
  selected_provider: NonEmptyStringSchema.nullable(),
  provider_kind: z.enum(MODEL_PROVIDER_KINDS).nullable(),
  runtime_class: z.enum(MODEL_RUNTIME_CLASSES).nullable(),
  attempted_models: z.array(NonEmptyStringSchema),
  successful_model: NonEmptyStringSchema.nullable(),
  failed_models: z.array(ModelRuntimeFailedModelSchema),
  fallback_used: z.boolean(),
  fallback_chain: z.array(NonEmptyStringSchema),
  failure_class: z.enum(MODEL_PROVIDER_FAILURE_CLASSES).optional(),
  latency_ms: NonnegativeMetadataNumberSchema,
  token_usage: ModelProviderTokenUsageSchema,
  degraded: z.boolean(),
  finish_reason: z.enum(MODEL_PROVIDER_FINISH_REASONS).nullable(),
  governance_flags: z.array(z.enum(MODEL_FALLBACK_GOVERNANCE_FLAGS)),
  redaction_status: z.enum(MODEL_PROVIDER_REDACTION_STATUSES),
  started_at: MetadataNumberSchema.optional(),
  ended_at: MetadataNumberSchema.optional(),
  created_at: MetadataNumberSchema,
});

export type ModelCallEvent = z.infer<typeof ModelCallEventSchema>;

export interface CreateModelCallEventOptions {
  readonly eventIdFactory?: (input: {
    readonly summary: ModelRuntimeExecutionSummary;
    readonly created_at: number;
  }) => string;
  readonly now?: () => number;
}

export function createModelCallEvent(
  summary: unknown,
  options: CreateModelCallEventOptions = {},
): ModelCallEvent {
  assertNoForbiddenKeys(summary);

  const parsed = ModelRuntimeExecutionSummaryForEventSchema.safeParse(summary);
  if (!parsed.success) {
    throw new ModelCallEventError(
      "Model call event summary was malformed or contained unsafe metadata.",
    );
  }

  const parsedSummary = clone(parsed.data) as ModelRuntimeExecutionSummary;
  const createdAt = options.now?.() ?? Date.now();
  const eventId =
    options.eventIdFactory?.({
      summary: clone(parsedSummary),
      created_at: createdAt,
    }) ?? createDefaultEventId(parsedSummary, createdAt);

  const event = {
    event_id: eventId,
    request_id: parsedSummary.request_id,
    execution_id: parsedSummary.execution_id,
    capability: parsedSummary.capability,
    selected_model_id: parsedSummary.selected_model_id,
    selected_provider: parsedSummary.selected_provider,
    provider_kind: parsedSummary.provider_kind,
    runtime_class: parsedSummary.runtime_class,
    attempted_models: parsedSummary.attempted_models,
    successful_model: parsedSummary.successful_model,
    failed_models: parsedSummary.failed_models,
    fallback_used: parsedSummary.fallback_used,
    fallback_chain: parsedSummary.fallback_chain,
    latency_ms: parsedSummary.latency_ms,
    token_usage: parsedSummary.token_usage,
    degraded: parsedSummary.degraded,
    finish_reason: parsedSummary.finish_reason,
    governance_flags: parsedSummary.governance_flags,
    redaction_status: parsedSummary.redaction_status,
    started_at: parsedSummary.started_at,
    ended_at: parsedSummary.ended_at,
    created_at: createdAt,
    ...(parsedSummary.failure_class
      ? { failure_class: parsedSummary.failure_class }
      : {}),
  };

  const eventParsed = ModelCallEventSchema.safeParse(event);
  if (!eventParsed.success) {
    throw new ModelCallEventError("Model call event was malformed.");
  }

  return clone(eventParsed.data);
}

function createDefaultEventId(
  summary: ModelRuntimeExecutionSummary,
  createdAt: number,
): string {
  return `model-call:${summary.execution_id}:${summary.request_id}:${createdAt}`;
}

function assertNoForbiddenKeys(value: unknown) {
  const seen = new WeakSet<object>();
  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") return;
    if (seen.has(candidate)) return;
    seen.add(candidate);

    for (const [key, nested] of Object.entries(candidate)) {
      if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
        throw new ModelCallEventError(
          `Model call event summary contained forbidden metadata field: ${key}.`,
        );
      }
      visit(nested);
    }
  };

  visit(value);
}

const FORBIDDEN_METADATA_KEYS = new Set([
  "raw_prompt",
  "prompt_telemetry",
  "stored_prompt",
  "raw_response",
  "raw_output",
  "raw_stream_tokens",
  "stream_tokens",
  "provider_payload",
  "full_provider_payload",
  "http_request_body",
  "request_body",
  "http_response_body",
  "response_body",
  "secret",
  "secrets",
  "api_key",
  "api_keys",
  "environment_variable",
  "environment_variables",
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

export type {
  ModelCapability,
  ModelFallbackGovernanceFlag,
  ModelProviderFailureClass,
  ModelProviderFinishReason,
  ModelProviderKind,
  ModelProviderRedactionStatus,
  ModelProviderTokenUsage,
  ModelRuntimeClass,
  ModelRuntimeExecutionSummary,
  ModelRuntimeFailedModel,
};
