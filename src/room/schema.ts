import { z } from "zod";
import {
  POLICY_RULE_EFFECTS,
  POLICY_RULE_SCOPES,
  ROOM_ADAPTER_KINDS,
  ROOM_CAPABILITIES,
  ROOM_TRUST_CLASSES,
} from "./types";

const RoomIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const TrustClassSchema = z.enum(ROOM_TRUST_CLASSES);
export const CapabilitySchema = z.enum(ROOM_CAPABILITIES);
export const AdapterKindSchema = z.enum(ROOM_ADAPTER_KINDS);
export const PolicyRuleScopeSchema = z.enum(POLICY_RULE_SCOPES);
export const PolicyRuleEffectSchema = z.enum(POLICY_RULE_EFFECTS);

export const AdapterRefSchema = z.strictObject({
  adapter_id: RoomIdSchema,
  kind: AdapterKindSchema,
  local_only: z.literal(true),
  real_adapter: z.literal(false),
  network_access: z.literal(false),
  hardware_io: z.literal(false),
});

export const ZoneSchema = z.strictObject({
  id: RoomIdSchema,
  name: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(240),
});

const FreshnessBoundarySchema = z.strictObject({
  observed_at_ms: z.number().int().nonnegative().nullable(),
  stale_after_ms: z.number().int().positive(),
  expires_at_ms: z.number().int().positive().nullable(),
  source: z.enum(["mock", "manual", "derived"]),
});

export const DeviceStateSchema = z.strictObject({
  power: z.enum(["unknown", "on", "off"]).default("unknown"),
  brightness_percent: z.number().int().min(0).max(100).nullable().default(null),
  color_hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .default(null),
  color_temperature_kelvin: z
    .number()
    .int()
    .min(2000)
    .max(6500)
    .nullable()
    .default(null),
  derived: z.boolean(),
  freshness: FreshnessBoundarySchema,
});

export const SensorStateSchema = z.strictObject({
  value: z.union([z.boolean(), z.number(), z.string(), z.null()]),
  unit: z.string().trim().min(1).max(40).nullable().default(null),
  derived: z.boolean(),
  freshness: FreshnessBoundarySchema,
});

const DeviceLikeBaseSchema = z.strictObject({
  id: RoomIdSchema,
  name: z.string().trim().min(1).max(120),
  zone_id: RoomIdSchema,
  capabilities: z.array(CapabilitySchema).min(1),
  adapter: AdapterRefSchema,
  trust_class: TrustClassSchema.default("observe_only"),
});

export const DeviceSchema = DeviceLikeBaseSchema.extend({
  kind: z.enum(["light", "plug", "display", "speaker", "mock_camera"]),
  state: DeviceStateSchema,
});

export const SensorSchema = DeviceLikeBaseSchema.extend({
  kind: z.enum([
    "presence",
    "motion",
    "temperature",
    "humidity",
    "mock_camera",
  ]),
  state: SensorStateSchema,
});

export const PolicyRuleSchema = z.strictObject({
  id: RoomIdSchema,
  scope: PolicyRuleScopeSchema,
  target_id: RoomIdSchema,
  effect: PolicyRuleEffectSchema,
  reason: z.string().trim().min(1).max(500),
  declarative_only: z.literal(true),
  executes_action: z.literal(false),
});

export const ApprovalPolicySchema = z.strictObject({
  approval_required_for: z
    .array(z.enum(["safe_mutate", "restricted_mutate"]))
    .default(["safe_mutate", "restricted_mutate"]),
  auto_approval_enabled: z.literal(false),
  voice_only_approval_enabled: z.literal(false),
  dry_run_required: z.literal(true),
});

export const RetentionPolicySchema = z.strictObject({
  audit: z.literal("forever"),
  telemetry_days: z.literal(30),
  replay_metadata_days: z.literal(90),
  raw_payload_retention: z.literal(false),
});

export const RoomPolicySchema = z.strictObject({
  local_first: z.literal(true),
  fake_first: z.literal(true),
  one_room_first: z.literal(true),
  public_network_exposure: z.literal(false),
  real_hardware_enabled: z.literal(false),
  real_adapters_enabled: z.literal(false),
  background_capture_enabled: z.literal(false),
  autonomous_execution_enabled: z.literal(false),
  rules: z.array(PolicyRuleSchema).default([]),
  approval: ApprovalPolicySchema,
  retention: RetentionPolicySchema,
});

export const RoomProfileSchema = z
  .strictObject({
    schema_version: z.literal(1),
    profile_id: RoomIdSchema,
    room_id: RoomIdSchema,
    name: z.string().trim().min(1).max(160),
    deployment_scope: z.literal("one_room"),
    local_only: z.literal(true),
    zones: z.array(ZoneSchema).min(1),
    devices: z.array(DeviceSchema).default([]),
    sensors: z.array(SensorSchema).default([]),
    policy: RoomPolicySchema,
    substrate_only: z.literal(true),
    registry_loading_implemented: z.literal(false),
    adapters_implemented: z.literal(false),
    hardware_io_enabled: z.literal(false),
    network_calls_enabled: z.literal(false),
    persistence_enabled: z.literal(false),
    ui_rendering_enabled: z.literal(false),
    provider_wiring_enabled: z.literal(false),
    mutation_surface_enabled: z.literal(false),
  })
  .superRefine((profile, ctx) => {
    const zoneIds = new Set(profile.zones.map((zone) => zone.id));
    addDuplicateIssues(
      profile.zones.map((zone) => zone.id),
      ["zones"],
      ctx,
    );
    addDuplicateIssues(
      profile.devices.map((device) => device.id),
      ["devices"],
      ctx,
    );
    addDuplicateIssues(
      profile.sensors.map((sensor) => sensor.id),
      ["sensors"],
      ctx,
    );

    profile.devices.forEach((device, index) => {
      if (!zoneIds.has(device.zone_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["devices", index, "zone_id"],
          message: "Device zone_id must reference an existing zone.",
        });
      }
    });
    profile.sensors.forEach((sensor, index) => {
      if (!zoneIds.has(sensor.zone_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sensors", index, "zone_id"],
          message: "Sensor zone_id must reference an existing zone.",
        });
      }
    });
  });

export function parseRoomProfile(input: unknown) {
  return RoomProfileSchema.parse(input);
}

export function validateRoomProfile(input: unknown) {
  return RoomProfileSchema.safeParse(input);
}

function addDuplicateIssues(
  ids: string[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "id"],
        message: "Identifier must be unique within this collection.",
      });
    }
    seen.add(id);
  });
}
