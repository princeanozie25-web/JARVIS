import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENVIRONMENT_LOCAL_COMMAND_EXECUTION_CONSENT,
  DEFAULT_PHASE6_FEATURE_FLAGS,
  EnvironmentActionLifecycleProposalSchema,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  approveEnvironmentActionLifecycleProposal,
  cancelEnvironmentActionLifecycleProposal,
  createDryRunEnvironmentActionPlan,
  createEnvironmentActionIntent,
  createEnvironmentActionLifecycleProposal,
  createEnvironmentLocalCommandAdapterContract,
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  executeEnvironmentLocalCommandBoundary,
  expireEnvironmentActionLifecycleProposal,
  preflightEnvironmentLocalCommand,
  verifyEnvironmentLocalCommandBoundary,
  type EnvironmentActionIntent,
  type EnvironmentActionLifecycleProposal,
  type EnvironmentDryRunActionPlan,
  type EnvironmentLocalCommandPreflight,
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
    approvalId: "approval:local-command",
    approvedByActorId: "user:local",
    approvalSurface: "test",
  });

  if (!approval.ok) throw new Error("expected approved proposal");
  return approval.proposal;
}

function preflight(
  proposal: EnvironmentActionLifecycleProposal,
  overrides: Partial<
    Parameters<typeof preflightEnvironmentLocalCommand>[0]
  > = {},
): EnvironmentLocalCommandPreflight {
  return preflightEnvironmentLocalCommand({
    proposal,
    registry: registry(),
    ...overrides,
  });
}

function adapter() {
  return createEnvironmentLocalCommandAdapterContract({
    adapterId: "adapter:lamp-local-stub",
    supportedDeviceId: "device:lamp",
    supportedCapabilityId: "light.observe",
    supportedOperation: "set",
  });
}

describe("Phase 6C5b single-device local command path", () => {
  it("defaults the local command feature flag and consent toggle off", () => {
    expect(DEFAULT_ENVIRONMENT_LOCAL_COMMAND_EXECUTION_CONSENT).toEqual({
      enabled: false,
      userConsented: false,
      localOnly: true,
      realAdaptersEnabled: false,
      physicalSideEffectsAllowed: false,
      metadataOnly: true,
    });
  });

  it("blocks execution when the feature flag is off", () => {
    const proposal = approvedProposal();
    const execution = executeEnvironmentLocalCommandBoundary({
      proposal,
      preflight: preflight(proposal),
      adapter: adapter(),
    });

    expect(execution).toMatchObject({
      status: "blocked_feature_disabled",
      adapterKind: "local_contract_stub",
      adapterInvoked: false,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
    });
  });

  it("passes the local command boundary only when enabled and preflight-eligible", () => {
    const proposal = approvedProposal();
    const execution = executeEnvironmentLocalCommandBoundary({
      proposal,
      preflight: preflight(proposal),
      adapter: adapter(),
      consent: {
        enabled: true,
        userConsented: true,
      },
    });

    expect(execution).toMatchObject({
      kind: "environment.local_command_execution_result",
      status: "local_boundary_accepted",
      capabilityId: "light.observe",
      operation: "set",
      preflightResult: "eligible_for_local_adapter",
      boundaryOnly: true,
      localOnly: true,
      stubOnly: true,
      adapterInvoked: true,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
      metadataOnly: true,
    });
  });

  it("blocks unapproved, requires_approval, denied, expired, and cancelled proposals", () => {
    const proposed = proposalFor();
    const restricted = proposalFor({
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
    });
    const denied = proposalFor({
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
    });
    const expired = expireEnvironmentActionLifecycleProposal({
      proposal: proposalFor(),
      nowMs: 12_000,
    });
    const cancelled = cancelEnvironmentActionLifecycleProposal({
      proposal: proposalFor(),
      cancelledAt: 12_000,
    });

    const cases = [
      [proposed, "blocked_requires_approval"],
      [restricted, "blocked_requires_approval"],
      [denied, "blocked_policy_denied"],
      [expired.proposal, "blocked_policy_denied"],
      [cancelled.proposal, "blocked_policy_denied"],
    ] as const;

    for (const [proposal, status] of cases) {
      expect(
        executeEnvironmentLocalCommandBoundary({
          proposal,
          preflight: preflight(proposal),
          adapter: adapter(),
          consent: {
            enabled: true,
            userConsented: true,
          },
        }),
      ).toMatchObject({
        status,
        adapterInvoked: false,
        commandsIssued: 0,
        physicalSideEffects: false,
        realDeviceTouched: false,
      });
    }
  });

  it("blocks voice-origin approvals", () => {
    const voice = proposalFor({
      intent: intent({
        id: "intent:voice",
        sourceSurface: "voice",
      }),
    });
    const forgedApprovedVoice = EnvironmentActionLifecycleProposalSchema.parse({
      ...voice,
      state: "approved",
      reason: "metadata_approved",
      approval: {
        ...voice.approval,
        approvalId: "approval:forged-voice",
        approvalSurface: "test",
        approvedByActorId: "user:local",
        approvedAt: 12_000,
      },
    });

    expect(
      executeEnvironmentLocalCommandBoundary({
        proposal: forgedApprovedVoice,
        preflight: preflight(forgedApprovedVoice),
        adapter: adapter(),
        consent: {
          enabled: true,
          userConsented: true,
        },
      }),
    ).toMatchObject({
      status: "blocked_voice_authority",
      adapterInvoked: false,
      commandsIssued: 0,
      realDeviceTouched: false,
    });
  });

  it("blocks multi-device, scene, routine, and macro attempts", () => {
    const proposal = approvedProposal();
    const attempts = [
      preflight(proposal, {
        targetDeviceIds: ["device:lamp", "device:lock"],
      }),
      preflight(proposal, { actionKind: "scene" }),
      preflight(proposal, { actionKind: "routine" }),
      preflight(proposal, { actionKind: "macro" }),
    ];

    for (const item of attempts) {
      expect(
        executeEnvironmentLocalCommandBoundary({
          proposal,
          preflight: item,
          adapter: adapter(),
          consent: {
            enabled: true,
            userConsented: true,
          },
        }),
      ).toMatchObject({
        status:
          item.result === "blocked_multi_device"
            ? "blocked_multi_device"
            : "blocked_disabled_feature",
        adapterInvoked: false,
        commandsIssued: 0,
        physicalSideEffects: false,
      });
    }
  });

  it("blocks unsupported capabilities", () => {
    const proposal = approvedProposal();
    const execution = executeEnvironmentLocalCommandBoundary({
      proposal,
      preflight: preflight(proposal),
      adapter: createEnvironmentLocalCommandAdapterContract({
        adapterId: "adapter:wrong-capability",
        supportedDeviceId: "device:lamp",
        supportedCapabilityId: "state.observe",
        supportedOperation: "set",
      }),
      consent: {
        enabled: true,
        userConsented: true,
      },
    });

    expect(execution).toMatchObject({
      status: "blocked_unsupported_capability",
      adapterInvoked: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
    });
  });

  it("blocks stale or unknown required state", () => {
    const staleProposal = proposalFor({
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

    expect(
      executeEnvironmentLocalCommandBoundary({
        proposal: staleProposal,
        preflight: preflight(staleProposal),
        adapter: adapter(),
        consent: {
          enabled: true,
          userConsented: true,
        },
      }),
    ).toMatchObject({
      status: "blocked_stale_or_unknown_state",
      adapterInvoked: false,
      commandsIssued: 0,
      realDeviceTouched: false,
    });
  });

  it("returns metadata-only verification results", () => {
    const proposal = approvedProposal();
    const execution = executeEnvironmentLocalCommandBoundary({
      proposal,
      preflight: preflight(proposal),
      adapter: adapter(),
      consent: {
        enabled: true,
        userConsented: true,
      },
    });
    const verification = verifyEnvironmentLocalCommandBoundary(execution);

    expect(verification).toEqual({
      kind: "environment.local_command_verification_result",
      proposalId: "proposal:test",
      executionStatus: "local_boundary_accepted",
      adapterId: "adapter:lamp-local-stub",
      adapterKind: "local_contract_stub",
      status: "metadata_verified",
      boundaryOnly: true,
      localOnly: true,
      stubOnly: true,
      metadataOnly: true,
      physicalSideEffects: false,
      realDeviceTouched: false,
      commandsIssued: 0,
      canonical: false,
      authoritative: false,
    });
  });

  it("keeps disabled-feature defaults unchanged", () => {
    expect(Object.keys(DEFAULT_PHASE6_FEATURE_FLAGS).sort()).toEqual(
      [...PHASE6_DISABLED_FEATURES].sort(),
    );
    for (const feature of PHASE6_DISABLED_FEATURES) {
      expect(DEFAULT_PHASE6_FEATURE_FLAGS[feature]).toBe(false);
    }
  });

  it("is not imported by router, chat, tools, voice, cloud, discovery, or autonomous paths", () => {
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
      expect(source).not.toContain("executeEnvironmentLocalCommandBoundary");
      expect(source).not.toContain(
        "createEnvironmentLocalCommandAdapterContract",
      );
      expect(source).not.toContain("environment/action-local-command");
    }
  });
});
