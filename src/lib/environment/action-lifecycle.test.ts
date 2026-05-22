import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  approveEnvironmentActionLifecycleProposal,
  cancelEnvironmentActionLifecycleProposal,
  createDryRunEnvironmentActionPlan,
  createEnvironmentActionIntent,
  createEnvironmentActionLifecycleProposal,
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  expireEnvironmentActionLifecycleProposal,
  type EnvironmentActionIntent,
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

describe("Phase 6C3 environmental action lifecycle state model", () => {
  it("creates a non-executed lifecycle proposal from an allowed dry-run plan", () => {
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:lamp",
      plan: planFor({}),
      nowMs: 11_000,
      expiresAt: 20_000,
    });

    expect(proposal).toMatchObject({
      kind: "environment.action.lifecycle_proposal",
      state: "proposed",
      reason: "proposal_created",
      approvalLifecycleOnly: true,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
      approval: {
        approvalRequired: false,
        approvalId: null,
        approvedAt: null,
        expiresAt: 20_000,
        sessionApprovalAllowed: false,
        metadataOnly: true,
      },
      metadataOnly: true,
      canonical: false,
      authoritative: false,
    });
  });

  it("creates requires_approval for restricted dry-run plans, not approved", () => {
    const plan = planFor({
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
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:lock",
      plan,
      nowMs: 11_000,
    });

    expect(proposal).toMatchObject({
      state: "requires_approval",
      reason: "restricted_requires_approval",
      approval: {
        approvalRequired: true,
        approvedAt: null,
      },
      executed: false,
      commandsIssued: 0,
    });
    expect(JSON.stringify(proposal)).not.toContain('"state":"approved"');
  });

  it("creates denied lifecycle state for denied policy results", () => {
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:sealed",
      plan: planFor({
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
      nowMs: 11_000,
    });

    expect(proposal).toMatchObject({
      state: "denied",
      reason: "policy_denied",
      deniedAt: 11_000,
      approvalLifecycleOnly: true,
      executed: false,
      verified: false,
      commandsIssued: 0,
      physicalSideEffects: false,
    });
  });

  it("does not approve expired proposals", () => {
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:expires",
      plan: planFor({}),
      nowMs: 11_000,
      expiresAt: 12_000,
    });
    const result = approveEnvironmentActionLifecycleProposal({
      proposal,
      approvedAt: 12_000,
      approvalId: "approval:late",
      approvedByActorId: "user:local",
      approvalSurface: "test",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "expired_proposal_not_approvable",
      proposal: {
        state: "expired",
        expiredAt: 12_000,
        approval: {
          approvalId: null,
          approvedAt: null,
        },
        executed: false,
        commandsIssued: 0,
      },
      physicalSideEffects: false,
    });
  });

  it("does not approve cancelled proposals", () => {
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:cancel",
      plan: planFor({}),
      nowMs: 11_000,
    });
    const cancelled = cancelEnvironmentActionLifecycleProposal({
      proposal,
      cancelledAt: 11_500,
    });
    if (!cancelled.ok) throw new Error("expected cancellation");

    const result = approveEnvironmentActionLifecycleProposal({
      proposal: cancelled.proposal,
      approvedAt: 12_000,
      approvalId: "approval:cancelled",
      approvedByActorId: "user:local",
      approvalSurface: "test",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "cancelled_proposal_not_approvable",
      proposal: {
        state: "cancelled",
        approval: {
          approvalId: null,
          approvedAt: null,
        },
        executed: false,
        commandsIssued: 0,
      },
    });
  });

  it("voice source cannot approve proposals", () => {
    const voiceProposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:voice",
      plan: planFor({
        intent: intent({
          id: "intent:voice",
          sourceSurface: "voice",
        }),
      }),
      nowMs: 11_000,
    });

    const result = approveEnvironmentActionLifecycleProposal({
      proposal: voiceProposal,
      approvedAt: 12_000,
      approvalId: "approval:voice",
      approvedByActorId: "user:local",
      approvalSurface: "test",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "voice_approval_not_allowed",
      proposal: {
        state: "proposed",
        sourceSurface: "voice",
        approval: {
          approvalId: null,
          approvedAt: null,
        },
      },
      executed: false,
      commandsIssued: 0,
      physicalSideEffects: false,
    });
  });

  it("approval metadata does not imply execution", () => {
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:approve",
      plan: planFor({}),
      nowMs: 11_000,
    });
    const result = approveEnvironmentActionLifecycleProposal({
      proposal,
      approvedAt: 12_000,
      approvalId: "approval:metadata",
      approvedByActorId: "user:local",
      approvalSurface: "test",
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        state: "approved",
        reason: "metadata_approved",
        approval: {
          approvalId: "approval:metadata",
          approvalSurface: "test",
          approvedByActorId: "user:local",
          approvedAt: 12_000,
          sessionApprovalAllowed: false,
          metadataOnly: true,
        },
        approvalLifecycleOnly: true,
        executed: false,
        verified: false,
        commandsIssued: 0,
        physicalSideEffects: false,
      },
    });
  });

  it("expiry helper marks pending proposals expired without execution", () => {
    const proposal = createEnvironmentActionLifecycleProposal({
      id: "proposal:expire-helper",
      plan: planFor({}),
      nowMs: 11_000,
      expiresAt: 20_000,
    });
    const result = expireEnvironmentActionLifecycleProposal({
      proposal,
      nowMs: 20_000,
    });

    expect(result).toMatchObject({
      ok: true,
      reason: "proposal_expired",
      proposal: {
        state: "expired",
        expiredAt: 20_000,
        approvalLifecycleOnly: true,
        executed: false,
        commandsIssued: 0,
        physicalSideEffects: false,
      },
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
      expect(source).not.toContain("createEnvironmentActionLifecycleProposal");
      expect(source).not.toContain("approveEnvironmentActionLifecycleProposal");
      expect(source).not.toContain("environment/action-lifecycle");
    }
  });
});
