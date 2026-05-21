import { describe, expect, it } from "vitest";
import {
  assertPhase6FeatureDisabled,
  createEnvironmentRegistry,
  DEFAULT_PHASE6_FEATURE_FLAGS,
  defaultEnvironmentTrustClass,
  DeviceSchema,
  ENVIRONMENT_CAPABILITY_IDS,
  EnvironmentRegistrySchema,
  environmentRegistryAuthorityNote,
  listEnvironmentCapabilityAllowlist,
  listEnvironmentTrustClasses,
  PHASE6_DISABLED_FEATURES,
  validateEnvironmentCapability,
  validateEnvironmentTrustClass,
} from "./index";

describe("Phase 6A1 environment registry schema scaffold", () => {
  it("validates rooms, devices, capabilities, trust classes, and registry shape", () => {
    const registry = createEnvironmentRegistry({
      rooms: [
        {
          id: "room:office",
          displayName: "Office",
          kind: "workspace",
        },
      ],
      devices: [
        {
          id: "device:desk-lamp",
          displayName: "Desk Lamp",
          roomId: "room:office",
          capabilities: ["state.observe", "light.observe"],
        },
      ],
    });

    expect(EnvironmentRegistrySchema.safeParse(registry).success).toBe(true);
    expect(registry).toMatchObject({
      schemaVersion: 1,
      rooms: [{ id: "room:office", displayName: "Office" }],
      devices: [
        {
          id: "device:desk-lamp",
          displayName: "Desk Lamp",
          roomId: "room:office",
          trustClass: "observe-only",
          capabilities: ["state.observe", "light.observe"],
        },
      ],
    });
    expect(registry.capabilities.map((capability) => capability.id)).toEqual(
      ENVIRONMENT_CAPABILITY_IDS,
    );
    expect(registry.trustClasses.map((trustClass) => trustClass.id)).toEqual([
      "observe-only",
      "safe-mutate",
      "restricted-mutate",
      "forbidden",
    ]);
  });

  it("defaults new or unknown devices to observe-only", () => {
    expect(defaultEnvironmentTrustClass()).toBe("observe-only");
    expect(defaultEnvironmentTrustClass("unknown-class")).toBe("observe-only");

    const parsed = DeviceSchema.parse({
      id: "device:unknown",
      displayName: "Unknown Device",
      roomId: "room:office",
      capabilities: [],
    });

    expect(parsed.trustClass).toBe("observe-only");
  });

  it("validates trust classes and rejects unsupported values", () => {
    expect(listEnvironmentTrustClasses()).toEqual([
      "observe-only",
      "safe-mutate",
      "restricted-mutate",
      "forbidden",
    ]);
    expect(validateEnvironmentTrustClass("restricted-mutate")).toBe(
      "restricted-mutate",
    );
    expect(() => validateEnvironmentTrustClass("admin")).toThrow();
  });

  it("rejects device capabilities outside the explicit allowlist", () => {
    expect(listEnvironmentCapabilityAllowlist()).toEqual(
      ENVIRONMENT_CAPABILITY_IDS,
    );
    expect(validateEnvironmentCapability("state.observe")).toBe(
      "state.observe",
    );

    const result = DeviceSchema.safeParse({
      id: "device:camera",
      displayName: "Camera",
      roomId: "room:office",
      capabilities: ["camera.stream"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects devices assigned to missing rooms and duplicate ids", () => {
    const missingRoom = EnvironmentRegistrySchema.safeParse({
      rooms: [],
      devices: [
        {
          id: "device:orphan",
          displayName: "Orphan",
          roomId: "room:missing",
          trustClass: "observe-only",
          capabilities: ["state.observe"],
        },
      ],
    });

    const duplicateIds = EnvironmentRegistrySchema.safeParse({
      rooms: [
        { id: "room:office", displayName: "Office" },
        { id: "room:office", displayName: "Office Duplicate" },
      ],
      devices: [
        {
          id: "device:lamp",
          displayName: "Lamp",
          roomId: "room:office",
          trustClass: "observe-only",
          capabilities: ["state.observe"],
        },
        {
          id: "device:lamp",
          displayName: "Lamp Duplicate",
          roomId: "room:office",
          trustClass: "observe-only",
          capabilities: ["state.observe"],
        },
      ],
    });

    expect(missingRoom.success).toBe(false);
    expect(duplicateIds.success).toBe(false);
  });

  it("keeps every Phase 6 disabled feature false by default", () => {
    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );

    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE6_FEATURE_FLAGS[feature]).toBe(false);
      expect(assertPhase6FeatureDisabled(feature)).toEqual({
        enabled: false,
        feature,
        reason: "phase6a1_disabled",
      });
    }
  });

  it("fails closed if a disabled Phase 6 feature flag is enabled", () => {
    expect(() =>
      assertPhase6FeatureDisabled("device_commands", {
        ...DEFAULT_PHASE6_FEATURE_FLAGS,
        device_commands: true as false,
      }),
    ).toThrow("Phase 6 feature must remain disabled: device_commands");
  });

  it("documents schema-only authority without physical-world side effects", () => {
    expect(environmentRegistryAuthorityNote()).toContain(
      "local schema metadata only",
    );
    expect(environmentRegistryAuthorityNote()).toContain(
      "does not grant physical-world authority",
    );
  });
});
