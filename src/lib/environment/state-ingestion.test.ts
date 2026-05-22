import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  PassiveEnvironmentStateRecordSchema,
  createEnvironmentPolicy,
  createEnvironmentRegistry,
  createFakePassiveEnvironmentStateAdapter,
  ingestPassiveEnvironmentState,
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
      sourceKind: "test_fixture",
      originKind: "local_fixture",
      originRef: "fixture:lamp",
      collectedBy: "user_or_local_metadata",
    },
    metadataOnly: true,
    canonical: false,
    authoritative: false,
    physicalSideEffects: false,
    ...overrides,
  });
}

describe("Phase 6B3 passive environment state ingestion scaffold", () => {
  it("fake adapter emits valid bounded records only when enabled", () => {
    const record = stateRecord();
    const adapter = createFakePassiveEnvironmentStateAdapter({
      enabled: true,
      readings: [record],
    });

    expect(adapter).toMatchObject({
      kind: "fake_local_test",
      enabled: true,
      metadataOnly: true,
      localOnly: true,
      testOnly: true,
    });
    expect(adapter.read()).toEqual({
      adapterId: "fake-local-passive-state",
      adapterKind: "fake_local_test",
      enabled: true,
      metadataOnly: true,
      localOnly: true,
      testOnly: true,
      physicalSideEffects: false,
      commandsIssued: 0,
      policyMutations: 0,
      presenceInference: false,
      telemetryEmitted: false,
      readings: [record],
    });
  });

  it("disabled fake adapters do not emit records", () => {
    const adapter = createFakePassiveEnvironmentStateAdapter({
      enabled: false,
      readings: [stateRecord()],
    });
    const result = ingestPassiveEnvironmentState({
      registry: registry(),
      adapter,
    });

    expect(adapter.read().readings).toEqual([]);
    expect(result).toMatchObject({
      adapterEnabled: false,
      status: "ignored",
      accepted: [],
      itemResults: [
        {
          status: "ignored",
          reason: "adapter_disabled",
          metadataOnly: true,
          physicalSideEffects: false,
        },
      ],
      commandsIssued: 0,
      policyMutations: 0,
      presenceInference: false,
      telemetryEmitted: false,
      physicalSideEffects: false,
    });
  });

  it("ingestion accepts schema-valid records", () => {
    const record = stateRecord();
    const result = ingestPassiveEnvironmentState({
      registry: registry(),
      adapter: createFakePassiveEnvironmentStateAdapter({
        enabled: true,
        readings: [record],
      }),
    });

    expect(result).toMatchObject({
      status: "accepted",
      accepted: [record],
      metadataOnly: true,
      localOnly: true,
      testOnly: true,
      physicalSideEffects: false,
      commandsIssued: 0,
      policyMutations: 0,
      presenceInference: false,
      telemetryEmitted: false,
    });
    expect(result.itemResults).toEqual([
      {
        status: "accepted",
        record,
        metadataOnly: true,
        physicalSideEffects: false,
      },
    ]);
  });

  it("ingestion rejects raw stream or sensitive payloads", () => {
    const result = ingestPassiveEnvironmentState({
      registry: registry(),
      adapter: createFakePassiveEnvironmentStateAdapter({
        enabled: true,
        readings: [
          {
            ...stateRecord(),
            rawValue: "sensitive camera or microphone payload",
            streamUrl: "rtsp://camera.local/live",
          },
        ],
      }),
    });

    expect(result).toMatchObject({
      status: "rejected",
      accepted: [],
      itemResults: [
        {
          status: "rejected",
          reason: "invalid_shape",
        },
      ],
      physicalSideEffects: false,
      telemetryEmitted: false,
    });
  });

  it("ingestion rejects unknown devices and capabilities through registry validation", () => {
    const unknownDevice = ingestPassiveEnvironmentState({
      registry: registry(),
      adapter: createFakePassiveEnvironmentStateAdapter({
        enabled: true,
        readings: [stateRecord({ deviceId: "device:missing" })],
      }),
    });
    const unknownCapability = ingestPassiveEnvironmentState({
      registry: registry(),
      adapter: createFakePassiveEnvironmentStateAdapter({
        enabled: true,
        readings: [stateRecord({ capabilityId: "climate.observe" })],
      }),
    });

    expect(unknownDevice.itemResults).toEqual([
      {
        status: "rejected",
        reason: "unknown_device",
        metadataOnly: true,
        physicalSideEffects: false,
      },
    ]);
    expect(unknownCapability.itemResults).toEqual([
      {
        status: "rejected",
        reason: "capability_not_allowed",
        metadataOnly: true,
        physicalSideEffects: false,
      },
    ]);
  });

  it("unknown result is deterministic when enabled adapter has no readings", () => {
    const result = ingestPassiveEnvironmentState({
      registry: registry(),
      adapter: createFakePassiveEnvironmentStateAdapter({
        enabled: true,
        readings: [],
      }),
    });

    expect(result).toMatchObject({
      status: "unknown",
      accepted: [],
      itemResults: [
        {
          status: "unknown",
          reason: "no_readings",
          metadataOnly: true,
          physicalSideEffects: false,
        },
      ],
    });
  });

  it("ingestion does not mutate policy or trust classes", () => {
    const policyBefore: EnvironmentPolicy = createEnvironmentPolicy();
    const registryBefore = registry();
    const registrySnapshot = JSON.stringify(registryBefore.trustClasses);

    const result = ingestPassiveEnvironmentState({
      registry: registryBefore,
      adapter: createFakePassiveEnvironmentStateAdapter({
        enabled: true,
        readings: [stateRecord()],
      }),
    });

    expect(policyBefore).toEqual(createEnvironmentPolicy());
    expect(JSON.stringify(registryBefore.trustClasses)).toBe(registrySnapshot);
    expect(result.policyMutations).toBe(0);
    expect(result.commandsIssued).toBe(0);
    expect(result.presenceInference).toBe(false);
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
      expect(source).not.toContain("ingestPassiveEnvironmentState");
      expect(source).not.toContain("createFakePassiveEnvironmentStateAdapter");
      expect(source).not.toContain("environment/state-ingestion");
    }
  });
});
