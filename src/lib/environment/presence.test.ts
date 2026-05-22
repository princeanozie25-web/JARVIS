import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  deriveEnvironmentPresence,
  type PassiveEnvironmentStateRecord,
} from "./index";

function presenceRecord(
  overrides: Partial<PassiveEnvironmentStateRecord> = {},
): PassiveEnvironmentStateRecord {
  return PassiveEnvironmentStateRecordSchema.parse({
    id: "state:presence",
    deviceId: "device:presence-sensor",
    roomId: "room:office",
    capabilityId: "environment.observe",
    stateLayer: "observed_state",
    observedValue: { kind: "category", category: "active" },
    observedAt: 10_000,
    freshness: {
      status: "fresh",
      observedAgeMs: 0,
      staleAfterMs: 60_000,
    },
    confidence: 0.9,
    provenance: {
      sourceKind: "test_fixture",
      originKind: "local_fixture",
      originRef: "fixture:presence",
      collectedBy: "user_or_local_metadata",
    },
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
    ...overrides,
  });
}

describe("Phase 6B4 conservative derived presence", () => {
  it("resolves missing signals to unknown", () => {
    expect(
      deriveEnvironmentPresence({
        records: [],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 11_000,
      }),
    ).toEqual({
      targetKind: "room",
      targetId: "room:office",
      status: "unknown",
      reason: "missing_signal",
      derived: true,
      canonical: false,
      authoritative: false,
      physicalSideEffects: false,
      cannotTriggerActions: true,
      sourceRecordId: null,
      confidence: null,
      observedAt: null,
    });
  });

  it("resolves stale and expired signals to unknown", () => {
    const stale = presenceRecord({ observedAt: 1_000 });
    const expired = presenceRecord({ observedAt: 1_000 });

    expect(
      deriveEnvironmentPresence({
        records: [stale],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 10_000,
        config: { staleAfterMs: 5_000, expireAfterMs: 20_000 },
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "stale_signal",
      cannotTriggerActions: true,
    });

    expect(
      deriveEnvironmentPresence({
        records: [expired],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 40_000,
        config: { staleAfterMs: 5_000, expireAfterMs: 20_000 },
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "expired_signal",
      cannotTriggerActions: true,
    });
  });

  it("resolves conflicting signals to unknown", () => {
    const active = presenceRecord({
      id: "state:active",
      observedAt: 10_000,
      observedValue: { kind: "category", category: "active" },
    });
    const idle = presenceRecord({
      id: "state:idle",
      observedAt: 10_500,
      observedValue: { kind: "category", category: "idle" },
    });

    expect(
      deriveEnvironmentPresence({
        records: [active, idle],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 11_000,
        config: { conflictWindowMs: 1_000 },
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "conflicting_signal",
    });
  });

  it("resolves low-confidence signals to unknown", () => {
    expect(
      deriveEnvironmentPresence({
        records: [presenceRecord({ confidence: 0.3 })],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 11_000,
        config: { minConfidence: 0.5 },
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "low_confidence",
    });
  });

  it("derives present only from fresh high-confidence bounded active signal", () => {
    const record = presenceRecord({
      id: "state:active",
      observedValue: { kind: "category", category: "active" },
      confidence: 0.95,
    });

    expect(
      deriveEnvironmentPresence({
        records: [record],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 11_000,
      }),
    ).toEqual({
      targetKind: "room",
      targetId: "room:office",
      status: "present",
      reason: "bounded_active_signal",
      derived: true,
      canonical: false,
      authoritative: false,
      physicalSideEffects: false,
      cannotTriggerActions: true,
      sourceRecordId: "state:active",
      confidence: 0.95,
      observedAt: 10_000,
    });
  });

  it("does not infer absence from lack of activity unless explicitly represented", () => {
    expect(
      deriveEnvironmentPresence({
        records: [
          presenceRecord({
            observedValue: { kind: "category", category: "nominal" },
          }),
        ],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 11_000,
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "unsupported_signal",
    });

    expect(
      deriveEnvironmentPresence({
        records: [
          presenceRecord({
            id: "state:idle",
            observedValue: { kind: "category", category: "idle" },
          }),
        ],
        targetKind: "room",
        targetId: "room:office",
        nowMs: 11_000,
      }),
    ).toMatchObject({
      status: "absent",
      reason: "bounded_idle_signal",
      cannotTriggerActions: true,
    });
  });

  it("does not derive presence from unsupported bounded bands", () => {
    expect(
      deriveEnvironmentPresence({
        records: [
          presenceRecord({
            observedValue: { kind: "band", band: "high" },
          }),
        ],
        targetKind: "device",
        targetId: "device:presence-sensor",
        nowMs: 11_000,
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "unsupported_signal",
    });
  });

  it("user presence remains unknown without explicit bounded passive state target", () => {
    expect(
      deriveEnvironmentPresence({
        records: [presenceRecord()],
        targetKind: "user",
        targetId: "user:local",
        nowMs: 11_000,
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "missing_signal",
      cannotTriggerActions: true,
    });
  });

  it("presence outputs are derived and cannot trigger actions", () => {
    const output = deriveEnvironmentPresence({
      records: [presenceRecord()],
      targetKind: "room",
      targetId: "room:office",
      nowMs: 11_000,
    });

    expect(output).toMatchObject({
      derived: true,
      canonical: false,
      authoritative: false,
      physicalSideEffects: false,
      cannotTriggerActions: true,
    });
    expect(JSON.stringify(output)).not.toContain(
      '"cannotTriggerActions":false',
    );
  });

  it("keeps disabled-feature defaults unchanged", () => {
    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );
    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE6_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("is not imported by router, chat, tools, voice, or real adapter paths", () => {
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
      expect(source).not.toContain("deriveEnvironmentPresence");
      expect(source).not.toContain("EnvironmentPresenceSignal");
      expect(source).not.toContain("environment/presence");
    }
  });
});
