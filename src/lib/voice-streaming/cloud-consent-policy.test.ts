import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceCloudConsentPolicy } from "./cloud-consent-policy";
import { VoiceCloudRoutingPolicy } from "./cloud-routing-policy";
import type {
  VoiceCloudConsentPolicyRequest,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness(enabled?: boolean) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const policy = new VoiceCloudConsentPolicy({
    enabled,
    newId: createIdGenerator("cloud-consent"),
    now: () => 11_000,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { policy, telemetry };
}

function consentRequest(
  input: Partial<VoiceCloudConsentPolicyRequest> = {},
): VoiceCloudConsentPolicyRequest {
  return {
    id: input.id ?? "cloud-consent-request-1",
    sessionId: input.sessionId ?? "session-1",
    providerId: input.providerId ?? "openai_realtime",
    requestedCapability: input.requestedCapability ?? "realtime_voice",
    consentGranted: input.consentGranted ?? true,
    costDisclosureAccepted: input.costDisclosureAccepted ?? true,
    providerRetentionDisclosureAccepted:
      input.providerRetentionDisclosureAccepted ?? true,
    audioLeavesDeviceDisclosureAccepted:
      input.audioLeavesDeviceDisclosureAccepted ?? true,
    transcriptLeavesDeviceDisclosureAccepted:
      input.transcriptLeavesDeviceDisclosureAccepted ?? true,
    createdAt: 10_900,
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function requestWithUnsafePayloads(
  input: Partial<VoiceCloudConsentPolicyRequest> = {},
): VoiceCloudConsentPolicyRequest {
  return consentRequest({
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
  } as unknown as Partial<VoiceCloudConsentPolicyRequest>);
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

describe("VoiceCloudConsentPolicy", () => {
  it("defaults to deny when not explicitly enabled", async () => {
    const { policy, telemetry } = createHarness();

    const result = await policy.evaluate(requestWithUnsafePayloads());

    expect(result).toEqual({
      request: {
        id: "cloud-consent-request-1",
        sessionId: "session-1",
        providerId: "openai_realtime",
        requestedCapability: "realtime_voice",
        consentGranted: true,
        costDisclosureAccepted: true,
        providerRetentionDisclosureAccepted: true,
        audioLeavesDeviceDisclosureAccepted: true,
        transcriptLeavesDeviceDisclosureAccepted: true,
        createdAt: 10_900,
        voiceTurnState: "waiting_for_send",
      },
      record: {
        id: "cloud-consent-1",
        requestId: "cloud-consent-request-1",
        sessionId: "session-1",
        providerId: "openai_realtime",
        requestedCapability: "realtime_voice",
        consentState: "disabled",
        disclosureState: "not_evaluated",
        decision: "denied_consent_missing",
        allowed: false,
        consentGranted: true,
        costDisclosureAccepted: true,
        providerRetentionDisclosureAccepted: true,
        audioLeavesDeviceDisclosureAccepted: true,
        transcriptLeavesDeviceDisclosureAccepted: true,
        createdAt: 11_000,
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_consent_denied",
        cloudConsentDecision: "denied_consent_missing",
        cloudConsentAllowed: false,
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it.each([
    [
      "missing consent",
      { consentGranted: false },
      "denied_consent_missing",
      "consent_missing",
      "not_evaluated",
      "voice_cloud_consent_denied",
    ],
    [
      "missing cost disclosure",
      { costDisclosureAccepted: false },
      "denied_cost_disclosure_missing",
      "consent_granted_metadata_only",
      "cost_disclosure_missing",
      "voice_cloud_consent_disclosure_missing",
    ],
    [
      "missing retention disclosure",
      { providerRetentionDisclosureAccepted: false },
      "denied_retention_disclosure_missing",
      "consent_granted_metadata_only",
      "provider_retention_disclosure_missing",
      "voice_cloud_consent_disclosure_missing",
    ],
    [
      "missing audio disclosure",
      { audioLeavesDeviceDisclosureAccepted: false },
      "denied_audio_disclosure_missing",
      "consent_granted_metadata_only",
      "audio_leaves_device_disclosure_missing",
      "voice_cloud_consent_disclosure_missing",
    ],
    [
      "missing transcript disclosure",
      { transcriptLeavesDeviceDisclosureAccepted: false },
      "denied_transcript_disclosure_missing",
      "consent_granted_metadata_only",
      "transcript_leaves_device_disclosure_missing",
      "voice_cloud_consent_disclosure_missing",
    ],
  ] as const)(
    "denies %s",
    async (
      _label,
      input,
      decision,
      consentState,
      disclosureState,
      eventType,
    ) => {
      const { policy, telemetry } = createHarness(true);

      const result = await policy.evaluate(consentRequest(input));

      expect(result.record).toEqual(
        expect.objectContaining({
          consentState,
          disclosureState,
          decision,
          allowed: false,
        }),
      );
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType,
          cloudConsentDecision: decision,
          cloudConsentAllowed: false,
        }),
      );
      expectMetadataOnly(result, telemetry);
    },
  );

  it("allows all explicit consent and disclosure flags as metadata-only eligibility", async () => {
    const { policy, telemetry } = createHarness(true);

    const result = await policy.evaluate(consentRequest());

    expect(result.record).toEqual(
      expect.objectContaining({
        consentState: "consent_granted_metadata_only",
        disclosureState: "disclosures_complete_metadata_only",
        decision: "allowed_metadata_only",
        allowed: true,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_consent_allowed",
        cloudConsentAllowed: true,
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it("denies disabled provider metadata", async () => {
    const { policy, telemetry } = createHarness(true);

    const result = await policy.evaluate(
      consentRequest({
        providerId: "disabled",
      }),
    );

    expect(result.record).toEqual(
      expect.objectContaining({
        consentState: "provider_disabled",
        disclosureState: "provider_disabled",
        decision: "denied_provider_disabled",
        allowed: false,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_consent_denied",
        cloudProviderId: "disabled",
      }),
    );
  });

  it("can feed routing eligibility using metadata-only consent output", async () => {
    const consentTelemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const routingTelemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const consentPolicy = new VoiceCloudConsentPolicy({
      enabled: true,
      newId: createIdGenerator("cloud-consent"),
      now: () => 11_000,
      emitTelemetry: (event) => {
        consentTelemetry.push(event);
      },
    });
    const routingPolicy = new VoiceCloudRoutingPolicy({
      enabled: true,
      newId: createIdGenerator("cloud-policy"),
      now: () => 11_100,
      emitTelemetry: (event) => {
        routingTelemetry.push(event);
      },
    });

    const consent = await consentPolicy.evaluate(consentRequest());
    const routing = await routingPolicy.evaluate({
      id: "routing-request-1",
      sessionId: "session-1",
      providerId: consent.record.providerId,
      requestedCapability: consent.record.requestedCapability,
      consentGranted: consent.record.allowed,
      costDisclosureAccepted: consent.record.allowed,
      budgetAvailable: true,
      localFallbackAvailable: true,
      voiceTurnState: "waiting_for_send",
    });

    expect(consent.record.allowed).toBe(true);
    expect(routing.record).toEqual(
      expect.objectContaining({
        state: "eligible_metadata_only",
        decision: "allow_metadata_only",
        allowed: true,
      }),
    );
    expectMetadataOnly({ consent, routing }, [
      ...consentTelemetry,
      ...routingTelemetry,
    ]);
  });

  it("does not introduce provider SDK, network, API key, runtime, approval, playback, chat, device, or browser wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/cloud-consent-policy.ts"),
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
