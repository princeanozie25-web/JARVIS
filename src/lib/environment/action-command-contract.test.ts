import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  EnvironmentActionLifecycleProposalSchema,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  approveEnvironmentActionLifecycleProposal,
  createDryRunEnvironmentActionPlan,
  createEnvironmentActionIntent,
  createEnvironmentActionLifecycleProposal,
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  preflightEnvironmentLocalCommand,
  type EnvironmentActionIntent,
  type EnvironmentActionLifecycleProposal,
  type EnvironmentDryRunActionPlan,
  type EnvironmentPolicy,
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
        displayName: "Sealed",
        roomId: "room:office",
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
    ],
  });
}

function intent(
  overrides: Partial<Parameters<typeof createEnvironmentActionIntent>[0]> = {},
): EnvironmentActionIntent {
  return createEnvironmentActionIntent({
    id: "intent:lamp",
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
}): EnvironmentDryRunActionPlan {
  const result = createDryRunEnvironmentActionPlan({
    registry: registry(),
    policy: policy(),
    intent: input.intent ?? intent(),
    passiveStateRecords: input.states ?? [stateRecord()],
    nowMs: 10_000,
  });

  if (!result.ok) throw new Error("expected dry-run plan");
  return result.plan;
}

function proposalFor(
  input: {
    intent?: EnvironmentActionIntent;
    states?: PassiveEnvironmentStateRecord[];
  } = {},
): EnvironmentActionLifecycleProposal {
  return createEnvironmentActionLifecycleProposal({
    id: "proposal:test",
    plan: planFor(input),
    nowMs: 11_000,
  });
}

function approvedProposal(
  input: {
    proposal?: EnvironmentActionLifecycleProposal;
  } = {},
): EnvironmentActionLifecycleProposal {
  const approval = approveEnvironmentActionLifecycleProposal({
    proposal: input.proposal ?? proposalFor(),
    approvedAt: 12_000,
    approvalId: "approval:local-contract",
    approvedByActorId: "user:local",
    approvalSurface: "test",
  });

  if (!approval.ok) throw new Error("expected approved proposal");
  return approval.proposal;
}

describe("Phase 6C5a single-device local command contract guard", () => {
  it("allows approved safe single-device commands through preflight only", () => {
    const preflight = preflightEnvironmentLocalCommand({
      proposal: approvedProposal(),
      registry: registry(),
    });

    expect(preflight).toMatchObject({
      kind: "environment.local_command_preflight",
      result: "eligible_for_local_adapter",
      actionKind: "single_device",
      deviceId: "device:lamp",
      capabilityId: "light.observe",
      policyDecision: "allowed",
      trustClass: "safe-mutate",
      preflightOnly: true,
      adapterInvoked: false,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
      contract: {
        kind: "environment.local_command_contract",
        proposalId: "proposal:test",
        intentId: "intent:lamp",
        deviceId: "device:lamp",
        capabilityId: "light.observe",
        operation: "set",
        actionKind: "single_device",
        targetDeviceCount: 1,
        adapterInvoked: false,
        executed: false,
        commandsIssued: 0,
        physicalSideEffects: false,
        realDeviceTouched: false,
      },
    });
  });

  it("blocks restricted commands without approval", () => {
    const preflight = preflightEnvironmentLocalCommand({
      proposal: proposalFor({
        intent: intent({
          id: "intent:lock",
          targetId: "device:lock",
          capabilityId: "lock.observe",
          requestedValue: { kind: "category", category: "closed" },
        }),
        states: [
          stateRecord({
            id: "state:lock",
            deviceId: "device:lock",
            capabilityId: "lock.observe",
            observedValue: { kind: "category", category: "open" },
          }),
        ],
      }),
      registry: registry(),
    });

    expect(preflight).toMatchObject({
      result: "blocked_requires_approval",
      policyDecision: "requires_approval",
      adapterInvoked: false,
      commandsIssued: 0,
      realDeviceTouched: false,
    });
  });

  it("blocks denied policy results", () => {
    const preflight = preflightEnvironmentLocalCommand({
      proposal: proposalFor({
        intent: intent({
          id: "intent:sealed",
          targetId: "device:sealed",
          capabilityId: "state.observe",
          requestedValue: { kind: "category", category: "nominal" },
        }),
        states: [
          stateRecord({
            id: "state:sealed",
            deviceId: "device:sealed",
            capabilityId: "state.observe",
          }),
        ],
      }),
      registry: registry(),
    });

    expect(preflight).toMatchObject({
      result: "blocked_policy_denied",
      policyDecision: "denied",
      trustClass: "forbidden",
      contract: null,
      physicalSideEffects: false,
    });
  });

  it("blocks stale or unknown state where freshness is required", () => {
    const preflight = preflightEnvironmentLocalCommand({
      proposal: proposalFor({
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
      }),
      registry: registry(),
    });

    expect(preflight).toMatchObject({
      result: "blocked_stale_or_unknown_state",
      stateReason: "state_stale",
      adapterInvoked: false,
      commandsIssued: 0,
      realDeviceTouched: false,
    });
  });

  it("blocks multi-device actions", () => {
    const preflight = preflightEnvironmentLocalCommand({
      proposal: approvedProposal(),
      registry: registry(),
      targetDeviceIds: ["device:lamp", "device:lock"],
    });

    expect(preflight).toMatchObject({
      result: "blocked_multi_device",
      adapterInvoked: false,
      executed: false,
      commandsIssued: 0,
      realDeviceTouched: false,
    });
  });

  it("blocks scene, routine, and macro attempts", () => {
    for (const actionKind of ["scene", "routine", "macro"] as const) {
      expect(
        preflightEnvironmentLocalCommand({
          proposal: approvedProposal(),
          registry: registry(),
          actionKind,
        }),
      ).toMatchObject({
        result: "blocked_disabled_feature",
        actionKind,
        adapterInvoked: false,
        commandsIssued: 0,
        physicalSideEffects: false,
      });
    }
  });

  it("blocks voice-origin approval attempts", () => {
    const voiceProposal = proposalFor({
      intent: intent({
        id: "intent:voice",
        sourceSurface: "voice",
      }),
    });
    const forgedApprovedVoice = EnvironmentActionLifecycleProposalSchema.parse({
      ...voiceProposal,
      state: "approved",
      reason: "metadata_approved",
      approval: {
        ...voiceProposal.approval,
        approvalId: "approval:forged-voice",
        approvalSurface: "test",
        approvedByActorId: "user:local",
        approvedAt: 12_000,
      },
    });

    expect(
      preflightEnvironmentLocalCommand({
        proposal: forgedApprovedVoice,
        registry: registry(),
      }),
    ).toMatchObject({
      result: "blocked_voice_authority",
      adapterInvoked: false,
      commandsIssued: 0,
      realDeviceTouched: false,
    });
  });

  it("blocks unsupported capabilities", () => {
    const registryWithoutLampCapability = createEnvironmentRegistry({
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
      preflightEnvironmentLocalCommand({
        proposal: approvedProposal(),
        registry: registryWithoutLampCapability,
      }),
    ).toMatchObject({
      result: "blocked_unsupported_capability",
      deviceId: "device:lamp",
      capabilityId: "light.observe",
      contract: null,
      adapterInvoked: false,
      commandsIssued: 0,
    });
  });

  it("blocks disabled feature attempts such as cloud bridges or discovery", () => {
    for (const feature of [
      "cloud_smart_home_bridges",
      "lan_auto_discovery",
      "autonomous_routines",
    ] as const) {
      expect(
        preflightEnvironmentLocalCommand({
          proposal: approvedProposal(),
          registry: registry(),
          requestedDisabledFeature: feature,
        }),
      ).toMatchObject({
        result: "blocked_disabled_feature",
        requestedDisabledFeature: feature,
        adapterInvoked: false,
        executed: false,
        commandsIssued: 0,
        physicalSideEffects: false,
        realDeviceTouched: false,
      });
    }
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
      expect(source).not.toContain("preflightEnvironmentLocalCommand");
      expect(source).not.toContain("EnvironmentLocalCommandContract");
      expect(source).not.toContain("environment/action-command-contract");
    }
  });
});
