import { z } from "zod";

import { VisionCapabilitySchema, VisionProviderKindSchema } from "./contracts";
import {
  createVisionProviderDisabledResult,
  createVisionProviderPolicyDeniedResult,
  type VisionProvider,
  type VisionProviderHealth,
  type VisionProviderRunRequest,
  type VisionProviderRunResult,
} from "./provider";
import { sanitizeVisionProviderResult } from "./redaction";

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
      const baseResult = {
        result_id: `${request.request_id}-result`,
        session_id: request.session_id,
        provider_id: resolvedConfig.provider_id,
        provider_kind: resolvedConfig.provider_kind,
        capability: "object_detection" as const,
        latency_ms: 0,
      };
      const providerResult =
        request.capability === resolvedConfig.supported_capability
          ? createVisionProviderDisabledResult(baseResult)
          : createVisionProviderPolicyDeniedResult(baseResult);
      const sanitized = sanitizeVisionProviderResult(providerResult);
      if (!sanitized.ok) {
        throw new Error("Unsafe YOLO disabled provider result.");
      }

      return {
        provider_result: sanitized.value,
        observations: [],
        metadata_only: true,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
      };
    },
  };
}

export function createDisabledYoloProviderFactory(
  config: Partial<DisabledYoloProviderConfig> = {},
): () => VisionProvider {
  return () => createDisabledYoloProvider(config);
}
