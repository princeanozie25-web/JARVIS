import { z } from "zod";

const ManualBridgeIpSchema = z
  .string()
  .trim()
  .min(7)
  .max(64)
  .regex(/^[a-zA-Z0-9.-]+$/);

const ConfigRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/)
  .refine(
    (value) => !/(secret|token|password|apikey|api_key)[=:]/i.test(value),
    {
      message: "Hue config references must not contain inline secrets.",
    },
  );

export const HueReadOnlyAdapterConfigSchema = z.strictObject({
  adapter_id: z
    .literal("hue-read-only-disabled")
    .default("hue-read-only-disabled"),
  adapter_kind: z.literal("hue").default("hue"),
  enabled: z.literal(false).default(false),
  read_only: z.literal(true).default(true),
  source: z.literal("local_hue_bridge").default("local_hue_bridge"),
  bridge_ip: ManualBridgeIpSchema,
  api_key_config_ref: ConfigRefSchema,
  writes_supported: z.literal(false).default(false),
  discovery_supported: z.literal(false).default(false),
  cloud_supported: z.literal(false).default(false),
  network_calls_enabled: z.literal(false).default(false),
  real_reads_implemented: z.literal(false).default(false),
  real_writes_implemented: z.literal(false).default(false),
});

export type HueReadOnlyAdapterConfig = z.infer<
  typeof HueReadOnlyAdapterConfigSchema
>;
export type HueReadOnlyConfigRefStatus = "configured" | "not_configured";

export interface HueReadOnlyAdapterValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface HueReadOnlyAdapterConfigValidation {
  readonly ok: boolean;
  readonly status:
    | "config_missing"
    | "config_invalid"
    | "ready_for_future_read_only";
  readonly config: null;
  readonly enabled: false;
  readonly read_only: true;
  readonly bridge_ip_configured: boolean;
  readonly bridge_ip_source: "manual" | "not_configured";
  readonly api_key_config_ref_status: HueReadOnlyConfigRefStatus;
  readonly issues: readonly HueReadOnlyAdapterValidationIssue[];
  readonly metadata_only: true;
  readonly raw_config_ref_exposed: false;
  readonly raw_api_key_exposed: false;
  readonly network_called: false;
  readonly discovery_attempted: false;
  readonly cloud_attempted: false;
}

export const EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG =
  HueReadOnlyAdapterConfigSchema.parse({
    adapter_kind: "hue",
    enabled: false,
    read_only: true,
    source: "local_hue_bridge",
    bridge_ip: "192.0.2.10",
    api_key_config_ref: "config_ref:hue.local.placeholder",
    writes_supported: false,
    discovery_supported: false,
    cloud_supported: false,
    network_calls_enabled: false,
    real_reads_implemented: false,
    real_writes_implemented: false,
  });

export function parseHueReadOnlyAdapterConfig(
  input: unknown,
): HueReadOnlyAdapterConfig {
  return HueReadOnlyAdapterConfigSchema.parse(input);
}

export function validateHueReadOnlyAdapterConfig(
  input: unknown,
): HueReadOnlyAdapterConfigValidation {
  if (input === undefined || input === null) {
    return {
      ok: false,
      status: "config_missing",
      config: null,
      enabled: false,
      read_only: true,
      bridge_ip_configured: false,
      bridge_ip_source: "not_configured",
      api_key_config_ref_status: "not_configured",
      issues: [
        {
          path: "config",
          code: "missing",
          message: "Manual Hue read-only config is not configured.",
        },
      ],
      metadata_only: true,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
    };
  }

  const parsed = HueReadOnlyAdapterConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: "config_invalid",
      config: null,
      enabled: false,
      read_only: true,
      bridge_ip_configured: hasStringField(input, "bridge_ip"),
      bridge_ip_source: hasStringField(input, "bridge_ip")
        ? "manual"
        : "not_configured",
      api_key_config_ref_status: hasStringField(input, "api_key_config_ref")
        ? "configured"
        : "not_configured",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "config",
        code: issue.code,
        message: issue.message,
      })),
      metadata_only: true,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
    };
  }

  return {
    ok: true,
    status: "ready_for_future_read_only",
    config: null,
    enabled: false,
    read_only: true,
    bridge_ip_configured: true,
    bridge_ip_source: "manual",
    api_key_config_ref_status: "configured",
    issues: [],
    metadata_only: true,
    raw_config_ref_exposed: false,
    raw_api_key_exposed: false,
    network_called: false,
    discovery_attempted: false,
    cloud_attempted: false,
  };
}

function hasStringField(input: unknown, field: string): boolean {
  return (
    typeof input === "object" &&
    input !== null &&
    field in input &&
    typeof (input as Record<string, unknown>)[field] === "string" &&
    ((input as Record<string, unknown>)[field] as string).trim().length > 0
  );
}
