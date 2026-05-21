import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  DEFAULT_PHASE6_FEATURE_FLAGS,
  evaluateEnvironmentAction,
  PHASE6_DISABLED_FEATURES,
  type EnvironmentPolicyInput,
  type EnvironmentPolicy,
  type EnvironmentRegistry,
} from "./index";

function registryWithDevice(input: {
  trustClass?:
    | "observe-only"
    | "safe-mutate"
    | "restricted-mutate"
    | "forbidden";
  capabilities?: Array<
    | "state.observe"
    | "power.observe"
    | "light.observe"
    | "climate.observe"
    | "media.observe"
    | "lock.observe"
    | "environment.observe"
    | "automation.plan"
  >;
}): EnvironmentRegistry {
  return createEnvironmentRegistry({
    rooms: [{ id: "room:office", displayName: "Office", kind: "room" }],
    devices: [
      {
        id: "device:lamp",
        displayName: "Lamp",
        roomId: "room:office",
        trustClass: input.trustClass ?? "observe-only",
        capabilities: input.capabilities ?? ["state.observe"],
      },
    ],
  });
}

function policy(input: EnvironmentPolicyInput = {}): EnvironmentPolicy {
  return createEnvironmentPolicy({
    ...input,
    capabilityEligibility: input.capabilityEligibility ?? [
      {
        capabilityId: "state.observe",
        safeMutationEligible: true,
        requiresFreshState: true,
      },
      {
        capabilityId: "light.observe",
        safeMutationEligible: true,
        requiresFreshState: true,
      },
    ],
    roomPolicies: input.roomPolicies ?? [
      {
        roomId: "room:office",
        safeMutateCapabilities: ["state.observe", "light.observe"],
        deniedCapabilities: [],
      },
    ],
  });
}

describe("Phase 6A3 environment policy evaluator", () => {
  it("denies by default for unknown devices", () => {
    const result = evaluateEnvironmentAction({
      registry: createEnvironmentRegistry({
        rooms: [{ id: "room:office", displayName: "Office", kind: "room" }],
      }),
      policy: createEnvironmentPolicy(),
      action: {
        deviceId: "device:missing",
        capabilityId: "state.observe",
        action: "read",
      },
    });

    expect(result).toMatchObject({
      decision: "denied",
      reason: "unknown_device",
      policyOnly: true,
      physicalSideEffects: false,
      voiceBypassAllowed: false,
    });
  });

  it("allows observe-only reads but denies observe-only mutations", () => {
    const registry = registryWithDevice({ trustClass: "observe-only" });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "state.observe",
          action: "read",
        },
      }),
    ).toMatchObject({
      decision: "allowed",
      reason: "observe_only_read_allowed",
      approvalRequired: false,
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "state.observe",
          action: "mutate",
          nowMs: 10_000,
          stateObservedAtMs: 9_000,
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "trust_class_denied",
    });
  });

  it("allows safe-mutate only for declared safe capabilities", () => {
    const registry = registryWithDevice({
      trustClass: "safe-mutate",
      capabilities: ["state.observe", "power.observe"],
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "state.observe",
          action: "mutate",
          nowMs: 10_000,
          stateObservedAtMs: 9_000,
        },
      }),
    ).toMatchObject({
      decision: "allowed",
      reason: "allowed_safe_mutate",
      physicalSideEffects: false,
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "power.observe",
          action: "mutate",
          nowMs: 10_000,
          stateObservedAtMs: 9_000,
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "capability_not_allowed",
    });
  });

  it("requires approval for restricted-mutate devices", () => {
    const result = evaluateEnvironmentAction({
      registry: registryWithDevice({
        trustClass: "restricted-mutate",
        capabilities: ["state.observe"],
      }),
      policy: policy(),
      action: {
        deviceId: "device:lamp",
        capabilityId: "state.observe",
        action: "mutate",
        nowMs: 10_000,
        stateObservedAtMs: 9_000,
      },
    });

    expect(result).toMatchObject({
      decision: "requires_approval",
      reason: "restricted_requires_approval",
      approvalRequired: true,
      physicalSideEffects: false,
    });
  });

  it("always denies forbidden devices with no runtime override path", () => {
    const read = evaluateEnvironmentAction({
      registry: registryWithDevice({
        trustClass: "forbidden",
        capabilities: ["state.observe"],
      }),
      policy: policy(),
      action: {
        deviceId: "device:lamp",
        capabilityId: "state.observe",
        action: "read",
      },
    });
    const mutate = evaluateEnvironmentAction({
      registry: registryWithDevice({
        trustClass: "forbidden",
        capabilities: ["state.observe"],
      }),
      policy: policy(),
      action: {
        deviceId: "device:lamp",
        capabilityId: "state.observe",
        action: "mutate",
        nowMs: 10_000,
        stateObservedAtMs: 9_000,
      },
    });

    expect(read).toMatchObject({
      decision: "denied",
      reason: "forbidden_device",
      approvalRequired: false,
    });
    expect(mutate).toMatchObject({
      decision: "denied",
      reason: "forbidden_device",
      approvalRequired: false,
    });
  });

  it("denies mutations during quiet hours", () => {
    const result = evaluateEnvironmentAction({
      registry: registryWithDevice({
        trustClass: "safe-mutate",
        capabilities: ["state.observe"],
      }),
      policy: policy({
        roomPolicies: [
          {
            roomId: "room:office",
            safeMutateCapabilities: ["state.observe"],
            deniedCapabilities: [],
            quietHours: {
              enabled: true,
              startMinute: 22 * 60,
              endMinute: 7 * 60,
              denyMutations: true,
            },
          },
        ],
      }),
      action: {
        deviceId: "device:lamp",
        capabilityId: "state.observe",
        action: "mutate",
        requestedAtMinute: 23 * 60,
        nowMs: 10_000,
        stateObservedAtMs: 9_000,
      },
    });

    expect(result).toMatchObject({
      decision: "denied",
      reason: "quiet_hours_denied",
    });
  });

  it("denies unknown rooms", () => {
    const registry = createEnvironmentRegistry({
      rooms: [{ id: "room:office", displayName: "Office", kind: "room" }],
      devices: [
        {
          id: "device:lamp",
          displayName: "Lamp",
          roomId: "room:office",
          trustClass: "safe-mutate",
          capabilities: ["state.observe"],
        },
      ],
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          roomId: "room:other",
          capabilityId: "state.observe",
          action: "read",
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "unknown_room",
    });
  });

  it("denies invalid or unknown capabilities", () => {
    const registry = registryWithDevice({
      trustClass: "safe-mutate",
      capabilities: ["state.observe"],
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "camera.stream",
          action: "read",
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "capability_not_allowed",
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "light.observe",
          action: "read",
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "capability_not_allowed",
    });
  });

  it("denies mutation when state is stale or missing", () => {
    const registry = registryWithDevice({
      trustClass: "safe-mutate",
      capabilities: ["state.observe"],
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy(),
        action: {
          deviceId: "device:lamp",
          capabilityId: "state.observe",
          action: "mutate",
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "stale_or_missing_state",
    });

    expect(
      evaluateEnvironmentAction({
        registry,
        policy: policy({ staleStateAfterMs: 100 }),
        action: {
          deviceId: "device:lamp",
          capabilityId: "state.observe",
          action: "mutate",
          nowMs: 10_000,
          stateObservedAtMs: 9_000,
        },
      }),
    ).toMatchObject({
      decision: "denied",
      reason: "stale_or_missing_state",
    });
  });

  it("keeps disabled Phase 6 feature defaults unchanged", () => {
    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );
    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE6_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("is not imported by router, chat, voice, or tool execution paths", () => {
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
      expect(source).not.toContain("evaluateEnvironmentAction");
      expect(source).not.toContain("EnvironmentPolicy");
      expect(source).not.toContain("environment/policy");
    }
  });
});
