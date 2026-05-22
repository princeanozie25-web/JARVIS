import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  classifyEnvironmentStateLayer,
  createEnvironmentRegistry,
  resolvePassiveEnvironmentState,
  validatePassiveEnvironmentStateRecord,
  type EnvironmentRegistry,
  type PassiveEnvironmentStateRecord,
} from "./index";

function registry(): EnvironmentRegistry {
  return createEnvironmentRegistry({
    rooms: [{ id: "room:office", displayName: "Office", kind: "room" }],
    devices: [
      {
        id: "device:lamp",
        displayName: "Lamp",
        roomId: "room:office",
        trustClass: "observe-only",
        capabilities: ["state.observe", "light.observe"],
      },
    ],
  });
}

function stateRecord(
  overrides: Partial<PassiveEnvironmentStateRecord> = {},
): PassiveEnvironmentStateRecord {
  return PassiveEnvironmentStateRecordSchema.parse({
    id: "state:lamp-light",
    deviceId: "device:lamp",
    roomId: "room:office",
    capabilityId: "light.observe",
    stateLayer: "observed_state",
    observedValue: { kind: "category", category: "on" },
    observedAt: 1_000,
    freshness: {
      status: "fresh",
      observedAgeMs: 0,
      staleAfterMs: 60_000,
    },
    confidence: 0.9,
    provenance: {
      sourceKind: "manual_metadata",
      originKind: "user_declared",
      originRef: "manual:lamp",
      collectedBy: "user_or_local_metadata",
    },
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
    ...overrides,
  });
}

describe("Phase 6B1 passive environment state schema", () => {
  it("validates passive observed state records as metadata-only non-authoritative state", () => {
    const parsed = stateRecord();

    expect(parsed).toMatchObject({
      deviceId: "device:lamp",
      roomId: "room:office",
      capabilityId: "light.observe",
      stateLayer: "observed_state",
      observedValue: { kind: "category", category: "on" },
      metadataOnly: true,
      canonical: false,
      authoritative: false,
      physicalSideEffects: false,
    });
  });

  it("supports bounded category and band observed values only", () => {
    expect(
      PassiveEnvironmentStateRecordSchema.safeParse(
        stateRecord({
          observedValue: { kind: "band", band: "medium" },
        }),
      ).success,
    ).toBe(true);

    expect(
      PassiveEnvironmentStateRecordSchema.safeParse({
        ...stateRecord(),
        observedValue: {
          kind: "raw_stream",
          bytes: "sensitive camera or microphone payload",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects raw sensitive stream fields", () => {
    const result = PassiveEnvironmentStateRecordSchema.safeParse({
      ...stateRecord(),
      rawValue: "precise transcript or camera frame",
      streamUrl: "rtsp://camera.local/live",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid registered device and capability references", () => {
    expect(
      validatePassiveEnvironmentStateRecord(
        registry(),
        stateRecord({ deviceId: "device:missing" }),
      ),
    ).toEqual({ ok: false, reason: "unknown_device" });

    expect(
      validatePassiveEnvironmentStateRecord(
        registry(),
        stateRecord({ roomId: "room:missing" }),
      ),
    ).toEqual({ ok: false, reason: "unknown_room" });

    expect(
      validatePassiveEnvironmentStateRecord(
        registry(),
        stateRecord({ capabilityId: "climate.observe" }),
      ),
    ).toEqual({ ok: false, reason: "capability_not_allowed" });
  });

  it("accepts records that reference registered rooms, devices, and capabilities", () => {
    expect(
      validatePassiveEnvironmentStateRecord(registry(), stateRecord()),
    ).toEqual({ ok: true, record: stateRecord() });
  });

  it("resolves absence of state as unknown, not absent or off", () => {
    const result = resolvePassiveEnvironmentState({
      records: [],
      deviceId: "device:lamp",
      capabilityId: "light.observe",
    });

    expect(result).toEqual({
      found: false,
      unknown: {
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        stateLayer: "observed_state",
        status: "unknown",
        reason: "state_absent",
        metadataOnly: true,
        canonical: false,
        authoritative: false,
        physicalSideEffects: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain("off");
    expect(JSON.stringify(result)).not.toContain('"status":"absent"');
  });

  it("returns the newest matching observed state when present", () => {
    const older = stateRecord({
      id: "state:old",
      observedValue: { kind: "category", category: "off" },
      observedAt: 1_000,
    });
    const newer = stateRecord({
      id: "state:new",
      observedValue: { kind: "category", category: "on" },
      observedAt: 2_000,
    });

    expect(
      resolvePassiveEnvironmentState({
        records: [older, newer],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
      }),
    ).toEqual({ found: true, record: newer });
  });

  it("keeps declared, observed, and derived state layers distinct", () => {
    expect(classifyEnvironmentStateLayer("declared_registry")).toEqual({
      layer: "declared_registry",
      metadataOnly: true,
      canonical: true,
      authoritative: false,
    });
    expect(classifyEnvironmentStateLayer("observed_state")).toEqual({
      layer: "observed_state",
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    });
    expect(classifyEnvironmentStateLayer("derived_state")).toEqual({
      layer: "derived_state",
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    });
  });

  it("keeps Phase 6 disabled-feature defaults unchanged", () => {
    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );
    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE6_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("is not imported by router, chat, tools, voice, or adapter paths", () => {
    const repoRoot = process.cwd();
    const files = [
      "src/lib/tools/registry.ts",
      "src/lib/tools/runtime.ts",
      "src/lib/tools/projects.ts",
      "src/lib/chat/tool-continuation.ts",
      "src/lib/chat/tool-approvals.ts",
      "src/lib/router/index.ts",
      "src/lib/router/selection.ts",
      "src/lib/router/enforcement.ts",
      "src/lib/voice-streaming/project-tool-boundary.ts",
      "app/api/chat/route.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      expect(source).not.toContain("PassiveEnvironmentState");
      expect(source).not.toContain("resolvePassiveEnvironmentState");
      expect(source).not.toContain("environment/state");
    }
  });
});
