import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  classifyEnvironmentStateLayer,
  createEnvironmentRegistry,
  evaluatePassiveEnvironmentStateFreshness,
  resolveCurrentPassiveEnvironmentState,
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

describe("Phase 6B2 passive environment freshness and unknown propagation", () => {
  it("keeps fresh state usable as observed metadata without promoting it to current truth", () => {
    const record = stateRecord({ observedAt: 10_000, confidence: 0.9 });

    expect(
      evaluatePassiveEnvironmentStateFreshness({
        record,
        nowMs: 20_000,
      }),
    ).toEqual({
      status: "fresh",
      observedAgeMs: 10_000,
      staleAfterMs:
        DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG.staleAfterMs,
      expireAfterMs:
        DEFAULT_PASSIVE_ENVIRONMENT_STATE_FRESHNESS_CONFIG.expireAfterMs,
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [record],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 20_000,
        policySensitive: true,
      }),
    ).toMatchObject({
      found: true,
      current: record,
      currentTruth: false,
      policySensitiveUsable: true,
      reason: "current_observation",
      metadataOnly: true,
      canonical: false,
      authoritative: false,
      physicalSideEffects: false,
    });
  });

  it("resolves stale state to unknown for current-state queries", () => {
    const stale = stateRecord({ observedAt: 1_000 });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [stale],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 10_000,
        config: {
          staleAfterMs: 5_000,
          expireAfterMs: 20_000,
        },
        policySensitive: true,
      }),
    ).toMatchObject({
      found: false,
      unknown: {
        status: "unknown",
        reason: "state_stale",
      },
      lastKnown: stale,
      freshness: {
        status: "stale",
      },
      currentTruth: false,
      policySensitiveUsable: false,
    });
  });

  it("resolves expired state to unknown", () => {
    const expired = stateRecord({ observedAt: 1_000 });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [expired],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 40_000,
        config: {
          staleAfterMs: 5_000,
          expireAfterMs: 20_000,
        },
      }),
    ).toMatchObject({
      found: false,
      unknown: {
        status: "unknown",
        reason: "state_expired",
      },
      freshness: {
        status: "expired",
      },
      currentTruth: false,
    });
  });

  it("resolves missing state to unknown", () => {
    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 10_000,
      }),
    ).toMatchObject({
      found: false,
      unknown: {
        status: "unknown",
        reason: "state_absent",
      },
      lastKnown: null,
      freshness: {
        status: "unknown",
        observedAgeMs: null,
      },
    });
  });

  it("resolves conflicting fresh records to unknown", () => {
    const on = stateRecord({
      id: "state:on",
      observedAt: 10_000,
      observedValue: { kind: "category", category: "on" },
    });
    const off = stateRecord({
      id: "state:off",
      observedAt: 10_500,
      observedValue: { kind: "category", category: "off" },
    });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [on, off],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 11_000,
        config: { conflictWindowMs: 1_000 },
      }),
    ).toMatchObject({
      found: false,
      unknown: {
        reason: "state_conflict",
      },
      currentTruth: false,
      policySensitiveUsable: false,
    });
  });

  it("resolves low-confidence state to unknown below threshold", () => {
    const lowConfidence = stateRecord({
      observedAt: 10_000,
      confidence: 0.4,
    });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [lowConfidence],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 11_000,
        config: { minConfidence: 0.5 },
      }),
    ).toMatchObject({
      found: false,
      unknown: {
        reason: "low_confidence",
      },
      lastKnown: lowConfidence,
      currentTruth: false,
    });
  });

  it("never promotes last-known state to current truth", () => {
    const lastKnown = stateRecord({ observedAt: 1_000 });
    const result = resolveCurrentPassiveEnvironmentState({
      records: [lastKnown],
      deviceId: "device:lamp",
      capabilityId: "light.observe",
      nowMs: 40_000,
      config: {
        staleAfterMs: 5_000,
        expireAfterMs: 20_000,
      },
    });

    expect(result).toMatchObject({
      found: false,
      lastKnown,
      currentTruth: false,
      policySensitiveUsable: false,
    });
    expect(JSON.stringify(result)).not.toContain('"currentTruth":true');
  });

  it("excludes stale and expired values from policy-sensitive outputs", () => {
    const stale = stateRecord({ id: "state:stale", observedAt: 1_000 });
    const expired = stateRecord({ id: "state:expired", observedAt: 1_000 });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [stale],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 10_000,
        config: {
          staleAfterMs: 5_000,
          expireAfterMs: 20_000,
        },
        policySensitive: true,
      }),
    ).toMatchObject({
      found: false,
      policySensitiveUsable: false,
      unknown: { reason: "state_stale" },
    });

    expect(
      resolveCurrentPassiveEnvironmentState({
        records: [expired],
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        nowMs: 40_000,
        config: {
          staleAfterMs: 5_000,
          expireAfterMs: 20_000,
        },
        policySensitive: true,
      }),
    ).toMatchObject({
      found: false,
      policySensitiveUsable: false,
      unknown: { reason: "state_expired" },
    });
  });
});
