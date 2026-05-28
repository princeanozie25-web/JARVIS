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
  adapter_kind: z.literal("hue"),
  enabled: z.literal(false),
  read_only: z.literal(true),
  source: z.literal("local_hue_bridge"),
  bridge_ip: ManualBridgeIpSchema,
  api_key_config_ref: ConfigRefSchema,
  writes_supported: z.literal(false),
  discovery_supported: z.literal(false),
  cloud_supported: z.literal(false),
  network_calls_enabled: z.literal(false),
  real_reads_implemented: z.literal(false),
  real_writes_implemented: z.literal(false),
});

export type HueReadOnlyAdapterConfig = z.infer<
  typeof HueReadOnlyAdapterConfigSchema
>;

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
