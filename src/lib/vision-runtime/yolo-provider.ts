import { z } from "zod";

import { VisionCapabilitySchema, VisionProviderKindSchema } from "./contracts";
import {
  createVisionProviderDisabledResult,
  createVisionProviderExecutionDisabledResult,
  createVisionProviderPolicyDeniedResult,
  createVisionProviderPreconditionFailedResult,
  type VisionProvider,
  type VisionProviderHealth,
  type VisionProviderRunRequest,
  type VisionProviderRunResult,
} from "./provider";
import { evaluateVisionDetectionEnablement } from "./detection-enablement";
import type { VisionMutationAuthorityClass } from "./policy";
import { sanitizeVisionProviderResult } from "./redaction";
import {
  createYoloInvocationPlan,
  runDisabledYoloInvocation,
  type YoloInvocationResult,
} from "./yolo-invocation";

export const YOLO_PROVIDER_HEALTH_STATUSES = [
  "disabled",
  "not_configured",
] as const;

export const DisabledYoloProviderConfigSchema = z.strictObject({
  provider_id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/),
  provider_kind: VisionProviderKindSchema.extract(["yolo_stub"]),
  enabled: z.boolean(),
  model_name: z.string().trim().min(1).max(120),
  weights_configured: z.literal(false),
  supported_capability: VisionCapabilitySchema.extract(["object_detection"]),
  timeout_ms: z.number().int().positive(),
  confidence_threshold: z.number().min(0).max(1),
  max_input_size_bytes: z.number().int().positive(),
  cloud_fallback_requested: z.boolean().default(false),
  network_fallback_requested: z.boolean().default(false),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  raw_image_input_allowed: z.literal(false),
  raw_detection_output_allowed: z.literal(false),
  detection_results_included: z.literal(false),
  python_execution_allowed: z.literal(false),
  process_execution_allowed: z.literal(false),
  persistence_allowed: z.literal(false),
});

export type DisabledYoloProviderConfig = z.infer<
  typeof DisabledYoloProviderConfigSchema
>;

export interface DisabledYoloProviderHealth extends VisionProviderHealth {
  readonly status: (typeof YOLO_PROVIDER_HEALTH_STATUSES)[number];
  readonly reason: "provider_disabled" | "not_configured";
  readonly enabled: false;
  readonly configured: false;
  readonly weights_configured: false;
  readonly python_execution_allowed: false;
  readonly process_spawned: false;
}

export interface YoloDryRunProviderPathResult extends VisionProviderRunResult {
  readonly enablement_allowed: boolean;
  readonly enablement_reason: string;
  readonly invocation_plan_created: boolean;
  readonly invocation_result: YoloInvocationResult | null;
  readonly metadata_only: true;
  readonly advisory_only: true;
  readonly derived: true;
  readonly raw_payload_included: false;
}

export const DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG =
  DisabledYoloProviderConfigSchema.parse({
    provider_id: "yolo-stub",
    provider_kind: "yolo_stub",
    enabled: false,
    model_name: "yolo-disabled-stub",
    weights_configured: false,
    supported_capability: "object_detection",
    timeout_ms: 5_000,
    confidence_threshold: 0.5,
    max_input_size_bytes: 5_000_000,
    cloud_fallback_requested: false,
    network_fallback_requested: false,
    metadata_only: true,
    redaction_required: true,
    raw_image_input_allowed: false,
    raw_detection_output_allowed: false,
    detection_results_included: false,
    python_execution_allowed: false,
    process_execution_allowed: false,
    persistence_allowed: false,
  } satisfies DisabledYoloProviderConfig);

export function createDisabledYoloProvider(
  config: Partial<DisabledYoloProviderConfig> = {},
): VisionProvider {
  const resolvedConfig = DisabledYoloProviderConfigSchema.parse({
    ...DEFAULT_DISABLED_YOLO_PROVIDER_CONFIG,
    ...config,
    provider_kind: "yolo_stub",
    weights_configured: false,
    cloud_fallback_requested: config.cloud_fallback_requested ?? false,
    network_fallback_requested: config.network_fallback_requested ?? false,
    metadata_only: true,
    redaction_required: true,
    raw_image_input_allowed: false,
    raw_detection_output_allowed: false,
    detection_results_included: false,
    python_execution_allowed: false,
    process_execution_allowed: false,
    persistence_allowed: false,
  });

  return {
    id: resolvedConfig.provider_id,
    kind: resolvedConfig.provider_kind,
    supported_capability: resolvedConfig.supported_capability,
    metadata_only: true,
    async health(checkedAtMs = 0): Promise<DisabledYoloProviderHealth> {
      return {
        provider_id: resolvedConfig.provider_id,
        provider_kind: resolvedConfig.provider_kind,
        supported_capability: resolvedConfig.supported_capability,
        ok: false,
        degraded: true,
        checked_at_ms: checkedAtMs,
        metadata_only: true,
        status: "disabled",
        reason: "not_configured",
        enabled: false,
        configured: false,
        weights_configured: false,
        python_execution_allowed: false,
        process_spawned: false,
      };
    },
    async run(
      request: VisionProviderRunRequest,
    ): Promise<VisionProviderRunResult> {
      return runYoloDryRunProviderPath({
        config: resolvedConfig,
        request,
        metadata_only: true,
      });
    },
  };
}

export function createDisabledYoloDryRunProvider(
  config: Partial<DisabledYoloProviderConfig> = {},
): VisionProvider {
  return createDisabledYoloProvider(config);
}

export function createDisabledYoloProviderFactory(
  config: Partial<DisabledYoloProviderConfig> = {},
): () => VisionProvider {
  return () => createDisabledYoloProvider(config);
}

export function runYoloDryRunProviderPath(input: {
  readonly config: DisabledYoloProviderConfig;
  readonly request: VisionProviderRunRequest;
  readonly metadata_only: true;
}): YoloDryRunProviderPathResult {
  const config = DisabledYoloProviderConfigSchema.parse(input.config);
  const request = input.request;
  const baseResult = {
    result_id: `${request.request_id}-result`,
    session_id: request.session_id,
    provider_id: config.provider_id,
    provider_kind: config.provider_kind,
    capability: safeCapability(request.capability),
    latency_ms: 0,
  };

  if (request.capability !== config.supported_capability) {
    return dryRunResult({
      provider_result: createVisionProviderPolicyDeniedResult(baseResult),
      enablement_allowed: false,
      enablement_reason: "policy_denied",
      invocation_plan_created: false,
      invocation_result: null,
    });
  }

  const enablement = evaluateVisionDetectionEnablement({
    provider_config: config,
    capability: safeCapability(request.capability),
    artifact: detectionArtifactFromRequest(request),
    timeout_ms: request.timeout_ms,
    mutation_authority_requested: mutationAuthorityFromRequest(request),
    cloud_fallback_requested: fallbackFlagFromRequest(
      request,
      "cloud_fallback_requested",
    ),
    network_fallback_requested: fallbackFlagFromRequest(
      request,
      "network_fallback_requested",
    ),
    metadata_only: true,
  });

  if (enablement.reason === "provider_disabled") {
    return dryRunResult({
      provider_result: createVisionProviderDisabledResult(baseResult),
      enablement_allowed: false,
      enablement_reason: enablement.reason,
      invocation_plan_created: false,
      invocation_result: null,
    });
  }

  if (!enablement.allowed) {
    return dryRunResult({
      provider_result: createVisionProviderPreconditionFailedResult(baseResult),
      enablement_allowed: false,
      enablement_reason: enablement.reason,
      invocation_plan_created: false,
      invocation_result: null,
    });
  }

  const invocationPlan = createYoloInvocationPlan({
    provider_id: config.provider_id,
    artifact: detectionArtifactFromRequest(request),
    enablement,
    metadata_only: true,
  });
  const invocationResult = invocationPlan.ok
    ? runDisabledYoloInvocation(invocationPlan.plan)
    : invocationPlan.result;

  return dryRunResult({
    provider_result: invocationPlan.ok
      ? createVisionProviderExecutionDisabledResult(baseResult)
      : createVisionProviderPreconditionFailedResult(baseResult),
    enablement_allowed: true,
    enablement_reason: enablement.reason,
    invocation_plan_created: invocationPlan.ok,
    invocation_result: invocationResult,
  });
}

function safeCapability(capability: VisionProviderRunRequest["capability"]) {
  return capability === "object_detection" ? capability : "object_detection";
}

function detectionArtifactFromRequest(
  request: VisionProviderRunRequest,
): unknown {
  return (
    (request as { readonly detection_artifact?: unknown }).detection_artifact ??
    null
  );
}

function mutationAuthorityFromRequest(
  request: VisionProviderRunRequest,
): readonly VisionMutationAuthorityClass[] {
  return (
    (
      request as {
        readonly mutation_authority_requested?: readonly VisionMutationAuthorityClass[];
      }
    ).mutation_authority_requested ?? []
  );
}

function fallbackFlagFromRequest(
  request: VisionProviderRunRequest,
  key: "cloud_fallback_requested" | "network_fallback_requested",
): boolean {
  return Boolean((request as unknown as Record<string, unknown>)[key]);
}

function dryRunResult(input: {
  readonly provider_result: VisionProviderRunResult["provider_result"];
  readonly enablement_allowed: boolean;
  readonly enablement_reason: string;
  readonly invocation_plan_created: boolean;
  readonly invocation_result: YoloInvocationResult | null;
}): YoloDryRunProviderPathResult {
  const providerResult = input.provider_result;
  const sanitized = sanitizeVisionProviderResult(providerResult);
  if (!sanitized.ok) {
    throw new Error("Unsafe YOLO disabled provider result.");
  }

  return {
    provider_result: sanitized.value,
    observations: [],
    enablement_allowed: input.enablement_allowed,
    enablement_reason: input.enablement_reason,
    invocation_plan_created: input.invocation_plan_created,
    invocation_result: input.invocation_result,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
  };
}
