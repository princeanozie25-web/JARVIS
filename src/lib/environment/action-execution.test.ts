import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  EnvironmentActionLifecycleProposalSchema,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  approveEnvironmentActionLifecycleProposal,
  cancelEnvironmentActionLifecycleProposal,
  createDryRunEnvironmentActionPlan,
  createEnvironmentActionIntent,
  createEnvironmentActionLifecycleProposal,
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  createFakeLocalEnvironmentActionAdapter,
  executeEnvironmentActionWithFakeLocalAdapter,
  expireEnvironmentActionLifecycleProposal,
  verifyFakeLocalEnvironmentActionExecution,
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
    expiresAt?: number | null;
  } = {},
): EnvironmentActionLifecycleProposal {
  return createEnvironmentActionLifecycleProposal({
    id: "proposal:test",
    plan: planFor(input),
    nowMs: 11_000,
    expiresAt: input.expiresAt,
  });
}

function approvedProposal(): EnvironmentActionLifecycleProposal {
  const approval = approveEnvironmentActionLifecycleProposal({
    proposal: proposalFor(),
    approvedAt: 12_000,
    approvalId: "approval:fake-local",
    approvedByActorId: "user:local",
    approvalSurface: "test",
  });

  if (!approval.ok) throw new Error("expected approved proposal");
  return approval.proposal;
}

describe("Phase 6C4 fake local environmental adapter execution", () => {
  it("executes approved proposals only through the fake local adapter", () => {
    const execution = executeEnvironmentActionWithFakeLocalAdapter({
      proposal: approvedProposal(),
      adapter: createFakeLocalEnvironmentActionAdapter({
        adapterId: "adapter:fake-local-test",
      }),
    });

    expect(execution).toEqual({
      kind: "environment.action.execution_result",
      proposalId: "proposal:test",
      planIntentId: "intent:lamp",
      adapterId: "adapter:fake-local-test",
      adapterKind: "fake_local",
      status: "simulated_success",
      reason: "approved_fake_local_simulation",
      simulated: true,
      testOnly: true,
      localOnly: true,
      physicalSideEffects: false,
      realDeviceTouched: false,
      commandsIssued: 0,
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    });
  });

  it("skips proposals that still require approval", () => {
    const result = executeEnvironmentActionWithFakeLocalAdapter({
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
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "approval_required",
      adapterKind: "fake_local",
      testOnly: true,
      localOnly: true,
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
    });
  });

  it("does not execute denied proposals", () => {
    const result = executeEnvironmentActionWithFakeLocalAdapter({
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
    });

    expect(result).toMatchObject({
      status: "simulated_denied",
      reason: "proposal_denied",
      physicalSideEffects: false,
      realDeviceTouched: false,
      commandsIssued: 0,
    });
  });

  it("does not execute expired proposals", () => {
    const expired = expireEnvironmentActionLifecycleProposal({
      proposal: proposalFor({ expiresAt: 12_000 }),
      nowMs: 12_000,
    });
    if (!expired.ok) throw new Error("expected expired proposal");

    expect(
      executeEnvironmentActionWithFakeLocalAdapter({
        proposal: expired.proposal,
      }),
    ).toMatchObject({
      status: "skipped",
      reason: "proposal_expired",
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
    });
  });

  it("does not execute cancelled proposals", () => {
    const cancelled = cancelEnvironmentActionLifecycleProposal({
      proposal: proposalFor(),
      cancelledAt: 12_000,
    });
    if (!cancelled.ok) throw new Error("expected cancelled proposal");

    expect(
      executeEnvironmentActionWithFakeLocalAdapter({
        proposal: cancelled.proposal,
      }),
    ).toMatchObject({
      status: "skipped",
      reason: "proposal_cancelled",
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
    });
  });

  it("does not execute voice-origin approvals", () => {
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
      executeEnvironmentActionWithFakeLocalAdapter({
        proposal: forgedApprovedVoice,
      }),
    ).toMatchObject({
      status: "simulated_denied",
      reason: "voice_origin_not_executable",
      commandsIssued: 0,
      physicalSideEffects: false,
      realDeviceTouched: false,
    });
  });

  it("returns fake verification metadata only", () => {
    const execution = executeEnvironmentActionWithFakeLocalAdapter({
      proposal: approvedProposal(),
    });
    const verification = verifyFakeLocalEnvironmentActionExecution(execution);

    expect(verification).toEqual({
      kind: "environment.action.verification_result",
      proposalId: "proposal:test",
      executionStatus: "simulated_success",
      adapterId: "adapter:fake-local-environment-action",
      adapterKind: "fake_local",
      status: "simulated_verified",
      simulated: true,
      testOnly: true,
      localOnly: true,
      physicalSideEffects: false,
      realDeviceTouched: false,
      commandsIssued: 0,
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    });
  });

  it("can skip disabled fake local adapters without side effects", () => {
    const result = executeEnvironmentActionWithFakeLocalAdapter({
      proposal: approvedProposal(),
      adapter: createFakeLocalEnvironmentActionAdapter({ enabled: false }),
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "adapter_disabled",
      testOnly: true,
      localOnly: true,
      physicalSideEffects: false,
      realDeviceTouched: false,
      commandsIssued: 0,
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
      expect(source).not.toContain(
        "executeEnvironmentActionWithFakeLocalAdapter",
      );
      expect(source).not.toContain("createFakeLocalEnvironmentActionAdapter");
      expect(source).not.toContain("environment/action-execution");
    }
  });
});
