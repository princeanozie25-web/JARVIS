import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE6_FEATURE_FLAGS,
  PHASE6_DISABLED_FEATURES,
  createEnvironmentActionIntent,
  validateEnvironmentActionIntent,
} from "./index";

function validIntent() {
  return {
    id: "intent:lamp-on",
    targetKind: "device",
    targetId: "device:lamp",
    roomId: "room:office",
    capabilityId: "light.observe",
    operation: "set",
    requestedValue: { kind: "category", category: "on" },
    sourceSurface: "chat",
    requestedAt: 1_000,
    actor: {
      actorKind: "user",
      actorId: "user:local",
    },
    approvalExpectation: "unknown",
    metadataOnly: true,
  } as const;
}

describe("Phase 6C1 environmental action intent schema", () => {
  it("passes valid action intent schema", () => {
    const intent = createEnvironmentActionIntent(validIntent());

    expect(intent).toMatchObject({
      id: "intent:lamp-on",
      targetKind: "device",
      targetId: "device:lamp",
      capabilityId: "light.observe",
      operation: "set",
      requestedValue: { kind: "category", category: "on" },
      sourceSurface: "chat",
      metadataOnly: true,
      phase: {
        intent: true,
        planned: false,
        approved: false,
        executed: false,
        verified: false,
        commandsIssued: 0,
        physicalSideEffects: false,
        voiceGrantsAuthority: false,
      },
    });
    expect(validateEnvironmentActionIntent(validIntent())).toEqual({
      ok: true,
      intent,
      markers: intent.phase,
    });
  });

  it("rejects invalid capabilities and operations", () => {
    expect(
      validateEnvironmentActionIntent({
        ...validIntent(),
        capabilityId: "camera.stream",
      }),
    ).toMatchObject({
      ok: false,
      reason: "invalid_capability",
      planned: false,
      approved: false,
      executed: false,
      commandsIssued: 0,
      physicalSideEffects: false,
    });

    expect(
      validateEnvironmentActionIntent({
        ...validIntent(),
        operation: "execute",
      }),
    ).toMatchObject({
      ok: false,
      reason: "invalid_operation",
    });
  });

  it("rejects unsafe or unbounded requested values", () => {
    expect(
      validateEnvironmentActionIntent({
        ...validIntent(),
        requestedValue: {
          kind: "raw_stream",
          payload: "sensitive camera frame",
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: "unsafe_value",
      commandsIssued: 0,
      physicalSideEffects: false,
    });

    expect(
      validateEnvironmentActionIntent({
        ...validIntent(),
        requestedValue: {
          kind: "numeric",
          value: 72.4,
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: "unsafe_value",
    });
  });

  it("voice source does not imply approval or authority", () => {
    const voiceIntent = createEnvironmentActionIntent({
      ...validIntent(),
      id: "intent:voice",
      sourceSurface: "voice",
    });

    expect(voiceIntent).toMatchObject({
      sourceSurface: "voice",
      approvalExpectation: "unknown",
      phase: {
        approved: false,
        executed: false,
        commandsIssued: 0,
        physicalSideEffects: false,
        voiceGrantsAuthority: false,
      },
    });

    expect(
      validateEnvironmentActionIntent({
        ...validIntent(),
        id: "intent:voice-approved",
        sourceSurface: "voice",
        approvalExpectation: "requires_approval",
      }),
    ).toMatchObject({
      ok: false,
      reason: "voice_approval_not_allowed",
      approved: false,
      executed: false,
      commandsIssued: 0,
      physicalSideEffects: false,
    });
  });

  it("intent is not treated as plan, approval, execution, or verification", () => {
    const result = validateEnvironmentActionIntent(validIntent());

    expect(result).toMatchObject({
      ok: true,
      markers: {
        intent: true,
        planned: false,
        approved: false,
        executed: false,
        verified: false,
        commandsIssued: 0,
        physicalSideEffects: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('"executed":true');
    expect(JSON.stringify(result)).not.toContain('"planned":true');
    expect(JSON.stringify(result)).not.toContain('"approved":true');
  });

  it("rejects attempts to override no-execution phase markers", () => {
    expect(
      validateEnvironmentActionIntent({
        ...validIntent(),
        phase: {
          intent: true,
          planned: true,
          approved: true,
          executed: true,
          verified: true,
          commandsIssued: 1,
          physicalSideEffects: true,
          voiceGrantsAuthority: true,
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: "invalid_intent",
      planned: false,
      approved: false,
      executed: false,
      commandsIssued: 0,
      physicalSideEffects: false,
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
      expect(source).not.toContain("createEnvironmentActionIntent");
      expect(source).not.toContain("validateEnvironmentActionIntent");
      expect(source).not.toContain("environment/action-intent");
    }
  });
});
