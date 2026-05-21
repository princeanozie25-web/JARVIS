import { z } from "zod";

export const ENVIRONMENT_TRUST_CLASSES = [
  "observe-only",
  "safe-mutate",
  "restricted-mutate",
  "forbidden",
] as const;

export const ENVIRONMENT_CAPABILITY_IDS = [
  "state.observe",
  "power.observe",
  "light.observe",
  "climate.observe",
  "media.observe",
  "lock.observe",
  "environment.observe",
  "automation.plan",
] as const;

export const PHASE6_DISABLED_FEATURES = [
  "smart_home_integrations",
  "lan_auto_discovery",
  "device_commands",
  "camera_vision",
  "microphone_presence_scanning",
  "bluetooth_wifi_scanning",
  "cloud_smart_home_bridges",
  "autonomous_routines",
  "public_internet_exposure",
  "policy_mutation_by_jarvis",
  "memory_bridge_writes",
  "router_chat_wiring",
  "voice_authority_changes",
] as const;

export type EnvironmentTrustClass = (typeof ENVIRONMENT_TRUST_CLASSES)[number];
export type EnvironmentCapabilityId =
  (typeof ENVIRONMENT_CAPABILITY_IDS)[number];
export type Phase6DisabledFeature = (typeof PHASE6_DISABLED_FEATURES)[number];

export const EnvironmentTrustClassSchema = z.enum(ENVIRONMENT_TRUST_CLASSES);
export const EnvironmentCapabilityIdSchema = z.enum(ENVIRONMENT_CAPABILITY_IDS);
export const Phase6DisabledFeatureSchema = z.enum(PHASE6_DISABLED_FEATURES);

export const EnvironmentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const RoomSchema = z.object({
  id: EnvironmentIdSchema,
  displayName: z.string().trim().min(1).max(160),
  kind: z.string().trim().min(1).max(80).default("room"),
});

export const CapabilitySchema = z.object({
  id: EnvironmentCapabilityIdSchema,
  displayName: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  trustClass: EnvironmentTrustClassSchema.default("observe-only"),
});

export const TrustClassSchema = z.object({
  id: EnvironmentTrustClassSchema,
  canObserve: z.boolean(),
  canMutate: z.boolean(),
  requiresApproval: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

export const DeviceSchema = z.object({
  id: EnvironmentIdSchema,
  displayName: z.string().trim().min(1).max(160),
  roomId: EnvironmentIdSchema,
  manufacturer: z.string().trim().min(1).max(160).optional(),
  model: z.string().trim().min(1).max(160).optional(),
  trustClass: EnvironmentTrustClassSchema.default("observe-only"),
  capabilities: z.array(EnvironmentCapabilityIdSchema).default([]),
});

export const Phase6FeatureFlagsSchema = z.object(
  Object.fromEntries(
    PHASE6_DISABLED_FEATURES.map((feature) => [feature, z.literal(false)]),
  ) as Record<Phase6DisabledFeature, z.ZodLiteral<false>>,
);

export const EnvironmentRegistrySchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    rooms: z.array(RoomSchema).default([]),
    devices: z.array(DeviceSchema).default([]),
    capabilities: z.array(CapabilitySchema).default([]),
    trustClasses: z.array(TrustClassSchema).default([]),
    disabledFeatures: Phase6FeatureFlagsSchema.default(
      Object.fromEntries(
        PHASE6_DISABLED_FEATURES.map((feature) => [feature, false]),
      ) as Record<Phase6DisabledFeature, false>,
    ),
  })
  .superRefine((registry, ctx) => {
    const roomIds = new Set(registry.rooms.map((room) => room.id));
    const seenRooms = new Set<string>();
    const seenDevices = new Set<string>();

    registry.rooms.forEach((room, index) => {
      if (seenRooms.has(room.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["rooms", index, "id"],
          message: "Room id must be unique.",
        });
      }
      seenRooms.add(room.id);
    });

    registry.devices.forEach((device, index) => {
      if (seenDevices.has(device.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["devices", index, "id"],
          message: "Device id must be unique.",
        });
      }
      seenDevices.add(device.id);

      if (!roomIds.has(device.roomId)) {
        ctx.addIssue({
          code: "custom",
          path: ["devices", index, "roomId"],
          message: "Device roomId must reference an existing room.",
        });
      }
    });
  });

export type Room = z.infer<typeof RoomSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type TrustClass = z.infer<typeof TrustClassSchema>;
export type Phase6FeatureFlags = z.infer<typeof Phase6FeatureFlagsSchema>;
export type EnvironmentRegistry = z.infer<typeof EnvironmentRegistrySchema>;

export const PHASE6_ENVIRONMENT_AUTHORITY_NOTE =
  "Phase 6 environment registry state is local schema metadata only; it does not grant physical-world authority.";
