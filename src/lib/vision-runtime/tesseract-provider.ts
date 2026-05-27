import { z } from "zod";

import {
  VisionCapabilitySchema,
  VisionProviderKindSchema,
  type VisionCapability,
} from "./contracts";
import {
  createVisionProviderPolicyDeniedResult,
  type VisionProvider,
  type VisionProviderHealth,
  type VisionProviderRunRequest,
  type VisionProviderRunResult,
} from "./provider";

export const TESSERACT_PROVIDER_HEALTH_STATUSES = [
  "disabled",
  "not_configured",
] as const;

export const DisabledTesseractProviderConfigSchema = z.strictObject({
  provider_id: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/),
  provider_kind: VisionProviderKindSchema.extract(["tesseract_stub"]),
  enabled: z.literal(false),
  binary_path_configured: z.literal(false),
  supported_capability: VisionCapabilitySchema.extract(["screenshot_ocr"]),
  timeout_ms: z.number().int().positive(),
  max_input_size_bytes: z.number().int().positive(),
  language: z.string().trim().min(1).max(24),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  raw_image_input_allowed: z.literal(false),
  raw_ocr_text_output_allowed: z.literal(false),
  process_execution_allowed: z.literal(false),
  persistence_allowed: z.literal(false),
});

export type DisabledTesseractProviderConfig = z.infer<
  typeof DisabledTesseractProviderConfigSchema
>;

export interface DisabledTesseractProviderHealth extends VisionProviderHealth {
  readonly status: (typeof TESSERACT_PROVIDER_HEALTH_STATUSES)[number];
  readonly reason: "provider_disabled" | "not_configured";
  readonly enabled: false;
  readonly configured: false;
  readonly binary_path_configured: false;
  readonly process_spawned: false;
}

export const DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG =
  DisabledTesseractProviderConfigSchema.parse({
    provider_id: "tesseract-stub",
    provider_kind: "tesseract_stub",
    enabled: false,
    binary_path_configured: false,
    supported_capability: "screenshot_ocr",
    timeout_ms: 5_000,
    max_input_size_bytes: 5_000_000,
    language: "eng",
    metadata_only: true,
    redaction_required: true,
    raw_image_input_allowed: false,
    raw_ocr_text_output_allowed: false,
    process_execution_allowed: false,
    persistence_allowed: false,
  } satisfies DisabledTesseractProviderConfig);

export function createDisabledTesseractProvider(
  config: Partial<DisabledTesseractProviderConfig> = {},
): VisionProvider {
  const resolvedConfig = DisabledTesseractProviderConfigSchema.parse({
    ...DEFAULT_DISABLED_TESSERACT_PROVIDER_CONFIG,
    ...config,
    enabled: false,
    provider_kind: "tesseract_stub",
    binary_path_configured: false,
    metadata_only: true,
    redaction_required: true,
    raw_image_input_allowed: false,
    raw_ocr_text_output_allowed: false,
    process_execution_allowed: false,
    persistence_allowed: false,
  });

  return {
    id: resolvedConfig.provider_id,
    kind: resolvedConfig.provider_kind,
    supported_capability: resolvedConfig.supported_capability,
    metadata_only: true,
    async health(checkedAtMs = 0): Promise<DisabledTesseractProviderHealth> {
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
        binary_path_configured: false,
        process_spawned: false,
      };
    },
    async run(
      request: VisionProviderRunRequest,
    ): Promise<VisionProviderRunResult> {
      return {
        provider_result: createVisionProviderPolicyDeniedResult({
          result_id: `${request.request_id}-result`,
          session_id: request.session_id,
          provider_id: resolvedConfig.provider_id,
          provider_kind: resolvedConfig.provider_kind,
          capability: safeCapability(request.capability),
          latency_ms: 0,
        }),
        observations: [],
        metadata_only: true,
        advisory_only: true,
        derived: true,
        raw_payload_included: false,
      };
    },
  };
}

export function createDisabledTesseractProviderFactory(
  config: Partial<DisabledTesseractProviderConfig> = {},
): () => VisionProvider {
  return () => createDisabledTesseractProvider(config);
}

function safeCapability(capability: VisionCapability): VisionCapability {
  return capability === "screenshot_ocr" ? capability : "screenshot_ocr";
}
