import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceCloudRoutingPolicy } from "./cloud-routing-policy";
import type {
  VoiceCloudRoutingPolicyRequest,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness(enabled?: boolean) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const policy = new VoiceCloudRoutingPolicy({
    enabled,
    newId: createIdGenerator("cloud-policy"),
    now: () => 9_000,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { policy, telemetry };
}

function routingRequest(
  input: Partial<VoiceCloudRoutingPolicyRequest> = {},
): VoiceCloudRoutingPolicyRequest {
  return {
    id: input.id ?? "cloud-routing-request-1",
    sessionId: input.sessionId ?? "session-1",
    providerId: input.providerId ?? "openai_realtime",
    requestedCapability: input.requestedCapability ?? "realtime_voice",
    consentGranted: input.consentGranted ?? true,
    costDisclosureAccepted: input.costDisclosureAccepted ?? true,
    budgetAvailable: input.budgetAvailable ?? true,
    localFallbackAvailable: input.localFallbackAvailable ?? true,
    createdAt: 8_900,
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function requestWithUnsafePayloads(
  input: Partial<VoiceCloudRoutingPolicyRequest> = {},
): VoiceCloudRoutingPolicyRequest {
  return routingRequest({
    transcript: "secret transcript payload",
    spokenText: "secret spoken payload",
    assistantBody: "secret assistant body payload",
    toolOutput: "secret tool output payload",
    fileContent: "secret file content payload",
    codeBlock: "secret code block payload",
    personalContext: "secret personal_context payload",
    auditLog: "secret audit log payload",
    approvalPayload: "secret approval payload",
    approvalRequestId: "approval-request-secret",
    apiKey: "secret api key payload",
    audio: "secret audio payload",
    ...input,
  } as unknown as Partial<VoiceCloudRoutingPolicyRequest>);
}

function expectMetadataOnly(
  records: unknown,
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  const serialized = JSON.stringify({ records, telemetry });
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret tool output payload");
  expect(serialized).not.toContain("secret file content payload");
  expect(serialized).not.toContain("secret code block payload");
  expect(serialized).not.toContain("secret personal_context payload");
  expect(serialized).not.toContain("secret audit log payload");
  expect(serialized).not.toContain("secret approval payload");
  expect(serialized).not.toContain("approval-request-secret");
  expect(serialized).not.toContain("secret api key payload");
  expect(serialized).not.toContain("secret audio payload");

  for (const event of telemetry) {
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "transcript",
        "spokenText",
        "assistantBody",
        "toolOutput",
        "fileContent",
        "codeBlock",
        "personalContext",
        "auditLog",
        "approvalPayload",
        "approvalRequestId",
        "apiKey",
        "audio",
      ]),
    );
  }
}

describe("VoiceCloudRoutingPolicy", () => {
  it("defaults to disabled and denies all cloud routing metadata", async () => {
    const { policy, telemetry } = createHarness();

    const result = await policy.evaluate(requestWithUnsafePayloads());

    expect(result).toEqual({
      request: {
        id: "cloud-routing-request-1",
        sessionId: "session-1",
        providerId: "openai_realtime",
        requestedCapability: "realtime_voice",
        consentGranted: true,
        costDisclosureAccepted: true,
        budgetAvailable: true,
        localFallbackAvailable: true,
        createdAt: 8_900,
        voiceTurnState: "waiting_for_send",
      },
      record: {
        id: "cloud-policy-1",
        requestId: "cloud-routing-request-1",
        sessionId: "session-1",
        providerId: "openai_realtime",
        requestedCapability: "realtime_voice",
        state: "disabled",
        decision: "deny_metadata_only",
        allowed: false,
        consentGranted: true,
        costDisclosureAccepted: true,
        budgetAvailable: true,
        localFallbackAvailable: true,
        createdAt: 9_000,
        denialReason: "policy_disabled",
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_evaluated",
        cloudProviderId: "openai_realtime",
        cloudRoutingPolicyState: "disabled",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_denied",
        cloudRoutingDecision: "deny_metadata_only",
        cloudRoutingAllowed: false,
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it("requires consent, cost disclosure, and budget before eligibility", async () => {
    const missingConsent = createHarness(true);
    const missingCost = createHarness(true);
    const missingBudget = createHarness(true);
    const eligible = createHarness(true);

    await expect(
      missingConsent.policy.evaluate(routingRequest({ consentGranted: false })),
    ).resolves.toMatchObject({
      record: {
        state: "consent_required",
        decision: "deny_metadata_only",
        denialReason: "consent_required",
      },
    });
    await expect(
      missingCost.policy.evaluate(
        routingRequest({ costDisclosureAccepted: false }),
      ),
    ).resolves.toMatchObject({
      record: {
        state: "cost_disclosure_required",
        decision: "deny_metadata_only",
        denialReason: "cost_disclosure_required",
      },
    });
    await expect(
      missingBudget.policy.evaluate(routingRequest({ budgetAvailable: false })),
    ).resolves.toMatchObject({
      record: {
        state: "budget_required",
        decision: "deny_metadata_only",
        denialReason: "budget_required",
      },
    });
    await expect(
      eligible.policy.evaluate(routingRequest()),
    ).resolves.toMatchObject({
      record: {
        state: "eligible_metadata_only",
        decision: "allow_metadata_only",
        allowed: true,
      },
    });

    expect(missingConsent.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_consent_required",
      }),
    );
    expect(missingCost.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_cost_disclosure_required",
      }),
    );
    expect(missingBudget.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_budget_required",
      }),
    );
    expect(eligible.telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_allowed",
      }),
    );
  });

  it("records local fallback availability as metadata only", async () => {
    const { policy, telemetry } = createHarness(true);

    const result = await policy.evaluate(
      routingRequest({
        providerId: "cloud_stt",
        requestedCapability: "speech_to_text",
        localFallbackAvailable: false,
      }),
    );

    expect(result.record).toEqual(
      expect.objectContaining({
        providerId: "cloud_stt",
        requestedCapability: "speech_to_text",
        state: "eligible_metadata_only",
        localFallbackAvailable: false,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        cloudLocalFallbackAvailable: false,
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it("denies unsupported provider capability pairs as metadata only", async () => {
    const { policy, telemetry } = createHarness(true);

    const result = await policy.evaluate(
      routingRequest({
        providerId: "cloud_tts",
        requestedCapability: "speech_to_text",
      }),
    );

    expect(result.record).toEqual(
      expect.objectContaining({
        state: "denied",
        decision: "deny_metadata_only",
        allowed: false,
        denialReason: "capability_not_supported",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_routing_policy_denied",
        cloudRoutingPolicyState: "denied",
      }),
    );
  });

  it("does not introduce provider SDK, network, API key, runtime, approval, playback, chat, device, or browser wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/cloud-routing-policy.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'][^"']*(openai|realtime|sdk)/i);
    expect(source).not.toMatch(
      /new\s+OpenAI|OpenAI\(|WebSocket|createRealtime/i,
    );
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest|EventSource/i);
    expect(source).not.toMatch(/process\.env|api[_-]?key|Authorization/i);
    expect(source).not.toMatch(/runtime-commands|executeRuntime|runTool/i);
    expect(source).not.toMatch(/approveRuntime|executeApproval|bypass/i);
    expect(source).not.toMatch(/from\s+["'][^"']*(tts|audio|playback)/i);
    expect(source).not.toMatch(
      /synthesize|HTMLAudioElement|startPlayback|\.play\(/i,
    );
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(/microphone|navigator|mediaDevices/i);
    expect(source).not.toMatch(
      /keyboard|addEventListener|window\.|document\./i,
    );
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
  });
});
