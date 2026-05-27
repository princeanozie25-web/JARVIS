import { z } from "zod";

import {
  VisionCapabilitySchema,
  VisionProviderKindSchema,
  type VisionCapability,
} from "./contracts";
import {
  createVisionProviderDisabledResult,
  createVisionProviderExecutionDisabledResult,
  createVisionProviderPreconditionFailedResult,
  type VisionProvider,
  type VisionProviderHealth,
  type VisionProviderRunRequest,
  type VisionProviderRunResult,
} from "./provider";
import { evaluateVisionOcrEnablement } from "./ocr-enablement";
import type { VisionMutationAuthorityClass } from "./policy";
import { sanitizeVisionProviderResult } from "./redaction";
import {
  createTesseractInvocationPlan,
  runDisabledTesseractInvocation,
  type TesseractInvocationResult,
} from "./tesseract-invocation";

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
  enabled: z.boolean(),
  binary_path_configured: z.literal(false),
  supported_capability: VisionCapabilitySchema.extract(["screenshot_ocr"]),
  timeout_ms: z.number().int().positive(),
  max_input_size_bytes: z.number().int().positive(),
  language: z.string().trim().min(1).max(24),
  cloud_fallback_requested: z.boolean().default(false),
  network_fallback_requested: z.boolean().default(false),
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

export interface TesseractDryRunProviderPathResult extends VisionProviderRunResult {
  readonly enablement_allowed: boolean;
  readonly enablement_reason: string;
  readonly invocation_plan_created: boolean;
  readonly invocation_result: TesseractInvocationResult | null;
  readonly metadata_only: true;
  readonly advisory_only: true;
  readonly derived: true;
  readonly raw_payload_included: false;
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
    cloud_fallback_requested: false,
    network_fallback_requested: false,
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
    provider_kind: "tesseract_stub",
    binary_path_configured: false,
    cloud_fallback_requested: config.cloud_fallback_requested ?? false,
    network_fallback_requested: config.network_fallback_requested ?? false,
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
      return runTesseractDryRunProviderPath({
        config: resolvedConfig,
        request,
        metadata_only: true,
      });
    },
  };
}

export function createDisabledTesseractDryRunProvider(
  config: Partial<DisabledTesseractProviderConfig> = {},
): VisionProvider {
  return createDisabledTesseractProvider(config);
}

export function createDisabledTesseractProviderFactory(
  config: Partial<DisabledTesseractProviderConfig> = {},
): () => VisionProvider {
  return () => createDisabledTesseractProvider(config);
}

export function runTesseractDryRunProviderPath(input: {
  readonly config: DisabledTesseractProviderConfig;
  readonly request: VisionProviderRunRequest;
  readonly metadata_only: true;
}): TesseractDryRunProviderPathResult {
  const config = DisabledTesseractProviderConfigSchema.parse(input.config);
  const request = input.request;
  const enablement = evaluateVisionOcrEnablement({
    provider_config: config,
    capability: safeCapability(request.capability),
    artifact: ocrArtifactFromRequest(request),
    user_triggered: request.user_triggered,
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
  const baseResult = {
    result_id: `${request.request_id}-result`,
    session_id: request.session_id,
    provider_id: config.provider_id,
    provider_kind: config.provider_kind,
    capability: safeCapability(request.capability),
    latency_ms: 0,
  };

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

  const invocationPlan = createTesseractInvocationPlan({
    provider_id: config.provider_id,
    artifact: ocrArtifactFromRequest(request),
    enablement,
    metadata_only: true,
  });
  const invocationResult = invocationPlan.ok
    ? runDisabledTesseractInvocation(invocationPlan.plan)
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

function safeCapability(capability: VisionCapability): VisionCapability {
  return capability === "screenshot_ocr" ? capability : "screenshot_ocr";
}

function ocrArtifactFromRequest(request: VisionProviderRunRequest): unknown {
  return (request as { readonly ocr_artifact?: unknown }).ocr_artifact ?? null;
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
  readonly invocation_result: TesseractInvocationResult | null;
}): TesseractDryRunProviderPathResult {
  const sanitized = sanitizeVisionProviderResult(input.provider_result);
  if (!sanitized.ok) {
    throw new Error("Unsafe Tesseract dry-run provider result.");
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
