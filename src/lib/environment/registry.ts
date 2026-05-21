import {
  ENVIRONMENT_CAPABILITY_IDS,
  ENVIRONMENT_TRUST_CLASSES,
  EnvironmentCapabilityIdSchema,
  EnvironmentRegistrySchema,
  EnvironmentTrustClassSchema,
  PHASE6_DISABLED_FEATURES,
  PHASE6_ENVIRONMENT_AUTHORITY_NOTE,
  type Capability,
  type Device,
  type EnvironmentCapabilityId,
  type EnvironmentRegistry,
  type EnvironmentTrustClass,
  type Phase6DisabledFeature,
  type Phase6FeatureFlags,
  type Room,
  type TrustClass,
} from "./types";

export const DEFAULT_PHASE6_FEATURE_FLAGS: Phase6FeatureFlags =
  Object.fromEntries(
    PHASE6_DISABLED_FEATURES.map((feature) => [feature, false]),
  ) as Phase6FeatureFlags;

export const DEFAULT_ENVIRONMENT_TRUST_CLASSES: TrustClass[] = [
  {
    id: "observe-only",
    canObserve: true,
    canMutate: false,
    requiresApproval: false,
    notes: "Default for new or unknown devices.",
  },
  {
    id: "safe-mutate",
    canObserve: true,
    canMutate: false,
    requiresApproval: true,
    notes: "Schema placeholder only in Phase 6A1; no commands are wired.",
  },
  {
    id: "restricted-mutate",
    canObserve: true,
    canMutate: false,
    requiresApproval: true,
    notes: "Schema placeholder only in Phase 6A1; no commands are wired.",
  },
  {
    id: "forbidden",
    canObserve: false,
    canMutate: false,
    requiresApproval: false,
    notes: "Denied by default.",
  },
];

export const DEFAULT_ENVIRONMENT_CAPABILITIES: Capability[] =
  ENVIRONMENT_CAPABILITY_IDS.map((id) => ({
    id,
    displayName: id,
    trustClass: "observe-only",
  }));

export function validateEnvironmentTrustClass(
  trustClass: string,
): EnvironmentTrustClass {
  return EnvironmentTrustClassSchema.parse(trustClass);
}

export function validateEnvironmentCapability(
  capability: string,
): EnvironmentCapabilityId {
  return EnvironmentCapabilityIdSchema.parse(capability);
}

export function defaultEnvironmentTrustClass(
  trustClass?: string | null,
): EnvironmentTrustClass {
  if (!trustClass) return "observe-only";
  const parsed = EnvironmentTrustClassSchema.safeParse(trustClass);
  return parsed.success ? parsed.data : "observe-only";
}

export function createEnvironmentRegistry(input?: {
  rooms?: Room[];
  devices?: Array<Omit<Device, "trustClass"> & { trustClass?: string | null }>;
  capabilities?: Capability[];
  trustClasses?: TrustClass[];
  disabledFeatures?: Phase6FeatureFlags;
}): EnvironmentRegistry {
  return EnvironmentRegistrySchema.parse({
    schemaVersion: 1,
    rooms: input?.rooms ?? [],
    devices: (input?.devices ?? []).map((device) => ({
      ...device,
      trustClass: defaultEnvironmentTrustClass(device.trustClass),
    })),
    capabilities: input?.capabilities ?? DEFAULT_ENVIRONMENT_CAPABILITIES,
    trustClasses: input?.trustClasses ?? DEFAULT_ENVIRONMENT_TRUST_CLASSES,
    disabledFeatures: input?.disabledFeatures ?? DEFAULT_PHASE6_FEATURE_FLAGS,
  });
}

export function assertPhase6FeatureDisabled(
  feature: Phase6DisabledFeature,
  flags: Phase6FeatureFlags = DEFAULT_PHASE6_FEATURE_FLAGS,
): {
  enabled: false;
  feature: Phase6DisabledFeature;
  reason: "phase6a1_disabled";
} {
  if (flags[feature] !== false) {
    throw new Error(`Phase 6 feature must remain disabled: ${feature}`);
  }

  return { enabled: false, feature, reason: "phase6a1_disabled" };
}

export function environmentRegistryAuthorityNote(): string {
  return PHASE6_ENVIRONMENT_AUTHORITY_NOTE;
}

export function listEnvironmentCapabilityAllowlist(): readonly EnvironmentCapabilityId[] {
  return ENVIRONMENT_CAPABILITY_IDS;
}

export function listEnvironmentTrustClasses(): readonly EnvironmentTrustClass[] {
  return ENVIRONMENT_TRUST_CLASSES;
}
