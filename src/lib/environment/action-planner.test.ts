import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  createDryRunEnvironmentActionPlan,
  createEnvironmentActionIntent,
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  type EnvironmentActionIntent,
  type EnvironmentPolicy,
  type EnvironmentRegistry,
  type PassiveEnvironmentStateRecord,
} from "./index";

function registry(): EnvironmentRegistry {
  return createEnvironmentRegistry({
    rooms: [
      { id: "room:office", displayName: "Office", kind: "room" },
      { id: "room:lab", displayName: "Lab", kind: "room" },
    ],
    devices: [
      {
        id: "device:lamp",
        displayName: "Lamp",
        roomId: "room:office",
        trustClass: "safe-mutate",
        capabilities: ["light.observe"],
      },
      {
        id: "device:lock",
        displayName: "Lock",
        roomId: "room:office",
        trustClass: "restricted-mutate",
        capabilities: ["lock.observe"],
      },
      {
        id: "device:sealed",
        displayName: "Sealed Device",
        roomId: "room:lab",
        trustClass: "forbidden",
        capabilities: ["state.observe"],
      },
    ],
  });
}

function policy(): EnvironmentPolicy {
  return createEnvironmentPolicy({
    staleStateAfterMs: 60_000,
    capabilityEligibility: [
      {
        capabilityId: "light.observe",
        safeMutationEligible: true,
        requiresFreshState: true,
      },
      {
        capabilityId: "lock.observe",
        safeMutationEligible: true,
        requiresFreshState: true,
      },
      {
        capabilityId: "state.observe",
        safeMutationEligible: true,
        requiresFreshState: true,
      },
    ],
    roomPolicies: [
      {
        roomId: "room:office",
        safeMutateCapabilities: ["light.observe", "lock.observe"],
        deniedCapabilities: [],
      },
      {
        roomId: "room:lab",
        safeMutateCapabilities: ["state.observe"],
        deniedCapabilities: [],
      },
    ],
  });
}

function intent(
  overrides: Partial<Parameters<typeof createEnvironmentActionIntent>[0]> = {},
): EnvironmentActionIntent {
  return createEnvironmentActionIntent({
    id: "intent:lamp-on",
    targetKind: "device",
    targetId: "device:lamp",
    roomId: "room:office",
    capabilityId: "light.observe",
    operation: "set",
    requestedValue: { kind: "category", category: "on" },
    sourceSurface: "chat",
    requestedAt: 10_000,
    ...overrides,
  });
}

function stateRecord(
  overrides: Partial<PassiveEnvironmentStateRecord> = {},
): PassiveEnvironmentStateRecord {
  return PassiveEnvironmentStateRecordSchema.parse({
    id: "state:lamp",
    deviceId: "device:lamp",
    roomId: "room:office",
    capabilityId: "light.observe",
    stateLayer: "observed_state",
    observedValue: { kind: "category", category: "off" },
    observedAt: 9_000,
    freshness: {
      status: "fresh",
      observedAgeMs: 1_000,
      staleAfterMs: 60_000,
    },
    confidence: 0.9,
    provenance: {
      sourceKind: "manual_metadata",
      originKind: "user_declared",
      originRef: "manual:bounded-state",
      collectedBy: "user_or_local_metadata",
    },
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
    ...overrides,
  });
}

function planFor(input: {
  intent?: EnvironmentActionIntent;
  states?: PassiveEnvironmentStateRecord[];
}) {
  return createDryRunEnvironmentActionPlan({
    registry: registry(),
    policy: policy(),
    intent: input.intent ?? intent(),
    passiveStateRecords: input.states ?? [stateRecord()],
    nowMs: 10_000,
  });
}

describe("Phase 6C2 dry-run environmental action planner", () => {
  it("produces a dry-run allowed plan for valid safe intents only", () => {
    const result = planFor({});

    expect(result).toMatchObject({
      ok: true,
      plan: {
        kind: "environment.action.dry_run_plan",
        dryRun: true,
        planned: true,
        approved: false,
        executed: false,
        verified: false,
        commandsIssued: 0,
        physicalSideEffects: false,
        planDecision: "allowed",
        approvalRequired: false,
        executionDenied: false,
        policy: {
          decision: "allowed",
          reason: "allowed_safe_mutate",
          approvalRequired: false,
          policyOnly: true,
          physicalSideEffects: false,
          voiceBypassAllowed: false,
        },
        state: {
          checked: true,
          freshnessStatus: "fresh",
          policySensitiveUsable: true,
          currentTruth: false,
          authoritative: false,
        },
        phase: {
          dryRun: true,
          planned: true,
          approved: false,
          executed: false,
          verified: false,
          commandsIssued: 0,
          physicalSideEffects: false,
        },
        metadataOnly: true,
        canonical: false,
        authoritative: false,
      },
    });
  });

  it("resolves room targets to a deterministic registered device", () => {
    const result = planFor({
      intent: intent({
        id: "intent:office-light",
        targetKind: "room",
        targetId: "room:office",
        roomId: undefined,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      plan: {
        targetKind: "room",
        targetId: "room:office",
        roomId: "room:office",
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        operation: "set",
        requestedValue: { kind: "category", category: "on" },
        planDecision: "allowed",
      },
    });
  });

  it("produces a dry-run requires-approval plan for restricted intents only", () => {
    const restricted = intent({
      id: "intent:lock",
      targetId: "device:lock",
      capabilityId: "lock.observe",
      requestedValue: { kind: "category", category: "closed" },
    });
    const result = planFor({
      intent: restricted,
      states: [
        stateRecord({
          id: "state:lock",
          deviceId: "device:lock",
          capabilityId: "lock.observe",
          observedValue: { kind: "category", category: "open" },
        }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      plan: {
        planDecision: "requires_approval",
        approvalRequired: true,
        executionDenied: false,
        policy: {
          decision: "requires_approval",
          reason: "restricted_requires_approval",
        },
        phase: {
          approved: false,
          executed: false,
          commandsIssued: 0,
          physicalSideEffects: false,
        },
      },
    });
  });

  it("produces a denied plan for forbidden devices", () => {
    const result = planFor({
      intent: intent({
        id: "intent:sealed",
        targetId: "device:sealed",
        roomId: "room:lab",
        capabilityId: "state.observe",
        requestedValue: { kind: "category", category: "nominal" },
      }),
      states: [
        stateRecord({
          id: "state:sealed",
          deviceId: "device:sealed",
          roomId: "room:lab",
          capabilityId: "state.observe",
        }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      plan: {
        planDecision: "denied",
        executionDenied: true,
        policy: {
          decision: "denied",
          reason: "forbidden_device",
          approvalRequired: false,
        },
        phase: {
          executed: false,
          commandsIssued: 0,
          physicalSideEffects: false,
        },
      },
    });
  });

  it("denies unknown devices, rooms, and capabilities", () => {
    expect(
      planFor({
        intent: intent({
          id: "intent:missing-device",
          targetId: "device:missing",
        }),
      }),
    ).toMatchObject({
      ok: true,
      plan: {
        planDecision: "denied",
        policy: { reason: "unknown_device" },
      },
    });

    expect(
      planFor({
        intent: intent({
          id: "intent:missing-room",
          roomId: "room:missing",
        }),
      }),
    ).toMatchObject({
      ok: true,
      plan: {
        planDecision: "denied",
        policy: { reason: "unknown_room" },
      },
    });

    expect(
      planFor({
        intent: intent({
          id: "intent:wrong-capability",
          capabilityId: "climate.observe",
          requestedValue: { kind: "band", band: "medium" },
        }),
      }),
    ).toMatchObject({
      ok: true,
      plan: {
        planDecision: "denied",
        policy: { reason: "capability_not_allowed" },
      },
    });
  });

  it("prevents stale and unknown passive state from becoming execution certainty", () => {
    const stale = planFor({
      states: [
        stateRecord({
          observedAt: 1_000,
          freshness: {
            status: "stale",
            observedAgeMs: 9_000,
            staleAfterMs: 5_000,
          },
        }),
      ],
    });
    const missing = planFor({ states: [] });

    expect(stale).toMatchObject({
      ok: true,
      plan: {
        planDecision: "denied",
        executionDenied: true,
        policy: { reason: "stale_or_missing_state" },
        state: {
          freshnessStatus: "stale",
          reason: "state_stale",
          policySensitiveUsable: false,
          currentTruth: false,
        },
      },
    });
    expect(missing).toMatchObject({
      ok: true,
      plan: {
        planDecision: "denied",
        policy: { reason: "stale_or_missing_state" },
        state: {
          freshnessStatus: "unknown",
          reason: "state_absent",
          policySensitiveUsable: false,
          currentTruth: false,
        },
      },
    });
  });

  it("keeps voice as a request surface without bypassing approval or policy", () => {
    const result = planFor({
      intent: intent({
        id: "intent:voice-lock",
        targetId: "device:lock",
        capabilityId: "lock.observe",
        sourceSurface: "voice",
        requestedValue: { kind: "category", category: "closed" },
      }),
      states: [
        stateRecord({
          id: "state:voice-lock",
          deviceId: "device:lock",
          capabilityId: "lock.observe",
          observedValue: { kind: "category", category: "open" },
        }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      plan: {
        sourceSurface: "voice",
        planDecision: "requires_approval",
        approvalRequired: true,
        policy: {
          reason: "restricted_requires_approval",
          voiceBypassAllowed: false,
        },
        phase: {
          voiceGrantsAuthority: false,
          approved: false,
          executed: false,
          commandsIssued: 0,
        },
      },
    });
  });

  it("keeps every plan dry-run with no approval, execution, commands, or side effects", () => {
    const result = planFor({});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected dry-run plan");

    expect(result.plan.phase).toEqual({
      dryRun: true,
      planned: true,
      approved: false,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      voiceGrantsAuthority: false,
    });
    expect(JSON.stringify(result.plan)).not.toContain('"executed":true');
    expect(JSON.stringify(result.plan)).not.toContain('"approved":true');
    expect(JSON.stringify(result.plan)).not.toContain('"commandsIssued":1');
    expect(JSON.stringify(result.plan)).not.toContain(
      '"physicalSideEffects":true',
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
      expect(source).not.toContain("createDryRunEnvironmentActionPlan");
      expect(source).not.toContain("EnvironmentDryRunActionPlan");
      expect(source).not.toContain("environment/action-planner");
    }
  });
});
