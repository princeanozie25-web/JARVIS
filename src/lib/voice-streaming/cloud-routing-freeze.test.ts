import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceCloudBudgetGuard } from "./cloud-budget-guard";
import { VoiceCloudConsentPolicy } from "./cloud-consent-policy";
import { VoiceCloudRoutingPolicy } from "./cloud-routing-policy";
import type {
  VoiceCloudBudgetGuardRequest,
  VoiceCloudBudgetLimit,
  VoiceCloudBudgetUsage,
  VoiceCloudConsentPolicyRequest,
  VoiceCloudRoutingPolicyRequest,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function usage(
  input: Partial<VoiceCloudBudgetUsage> = {},
): VoiceCloudBudgetUsage {
  return {
    estimatedMinutes: input.estimatedMinutes ?? 0,
    estimatedCostUnits: input.estimatedCostUnits ?? 0,
    requestCount: input.requestCount ?? 0,
  };
}

function limits(): VoiceCloudBudgetLimit[] {
  return [
    { window: "per_session", dimension: "estimated_minutes", limit: 10 },
    { window: "daily", dimension: "estimated_cost_units", limit: 100 },
    { window: "monthly", dimension: "request_count", limit: 20 },
  ];
}

function consentRequest(
  input: Partial<VoiceCloudConsentPolicyRequest> = {},
): VoiceCloudConsentPolicyRequest {
  return {
    id: input.id ?? "consent-request-1",
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
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function budgetRequest(
  input: Partial<VoiceCloudBudgetGuardRequest> = {},
): VoiceCloudBudgetGuardRequest {
  return {
    id: input.id ?? "budget-request-1",
    sessionId: input.sessionId ?? "session-1",
    providerId: input.providerId ?? "openai_realtime",
    requestedCapability: input.requestedCapability ?? "realtime_voice",
    estimatedMinutes: input.estimatedMinutes ?? 1,
    estimatedCostUnits: input.estimatedCostUnits ?? 5,
    currentSessionUsage: input.currentSessionUsage ?? usage(),
    currentDailyUsage: input.currentDailyUsage ?? usage(),
    currentMonthlyUsage: input.currentMonthlyUsage ?? usage(),
    configuredLimits: input.configuredLimits ?? limits(),
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function routingRequest(
  input: Partial<VoiceCloudRoutingPolicyRequest> = {},
): VoiceCloudRoutingPolicyRequest {
  return {
    id: input.id ?? "routing-request-1",
    sessionId: input.sessionId ?? "session-1",
    providerId: input.providerId ?? "openai_realtime",
    requestedCapability: input.requestedCapability ?? "realtime_voice",
    consentGranted: input.consentGranted ?? true,
    costDisclosureAccepted: input.costDisclosureAccepted ?? true,
    budgetAvailable: input.budgetAvailable ?? true,
    localFallbackAvailable: input.localFallbackAvailable ?? true,
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function unsafe<T extends object>(value: T): T {
  return {
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
    providerSecret: "secret provider secret payload",
    requestPayload: "secret request payload",
    audio: "secret audio payload",
    ...value,
  };
}

function createGovernanceHarness(enabled = true) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const consent = new VoiceCloudConsentPolicy({
    enabled,
    now: () => 12_000,
    newId: createIdGenerator("consent-freeze"),
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const budget = new VoiceCloudBudgetGuard({
    enabled,
    now: () => 12_100,
    newId: createIdGenerator("budget-freeze"),
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const routing = new VoiceCloudRoutingPolicy({
    enabled,
    now: () => 12_200,
    newId: createIdGenerator("routing-freeze"),
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { consent, budget, routing, telemetry };
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
  expect(serialized).not.toContain("secret provider secret payload");
  expect(serialized).not.toContain("secret request payload");
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
        "providerSecret",
        "requestPayload",
        "audio",
      ]),
    );
  }
}

describe("Phase 4G cloud routing freeze invariants", () => {
  it("stress evaluates mixed cloud policy outcomes without live wiring", async () => {
    const { consent, budget, routing, telemetry } = createGovernanceHarness();

    const allowedConsent = await consent.evaluate(
      unsafe(
        consentRequest({ id: "consent-allowed" }),
      ) as VoiceCloudConsentPolicyRequest,
    );
    const missingDisclosure = await consent.evaluate(
      consentRequest({
        id: "consent-missing-disclosure",
        providerRetentionDisclosureAccepted: false,
      }),
    );
    const allowedBudget = await budget.evaluate(
      unsafe(
        budgetRequest({ id: "budget-allowed" }),
      ) as VoiceCloudBudgetGuardRequest,
    );
    const exceededBudget = await budget.evaluate(
      budgetRequest({
        id: "budget-exceeded",
        currentDailyUsage: usage({ estimatedCostUnits: 99 }),
      }),
    );
    const unsupportedRouting = await routing.evaluate(
      routingRequest({
        id: "routing-unsupported",
        providerId: "cloud_tts",
        requestedCapability: "speech_to_text",
      }),
    );
    const fallbackRouting = await routing.evaluate(
      routingRequest({
        id: "routing-fallback",
        providerId: "cloud_stt",
        requestedCapability: "speech_to_text",
        localFallbackAvailable: false,
      }),
    );
    const eligibleRouting = await routing.evaluate(
      routingRequest({
        id: "routing-eligible",
        consentGranted: allowedConsent.record.allowed,
        costDisclosureAccepted: allowedConsent.record.allowed,
        budgetAvailable: allowedBudget.record.allowed,
      }),
    );

    expect(allowedConsent.record.decision).toBe("allowed_metadata_only");
    expect(missingDisclosure.record.decision).toBe(
      "denied_retention_disclosure_missing",
    );
    expect(allowedBudget.record.decision).toBe("allowed_metadata_only");
    expect(exceededBudget.record).toEqual(
      expect.objectContaining({
        decision: "denied_budget_exceeded",
        exceededWindow: "daily",
        exceededDimension: "estimated_cost_units",
      }),
    );
    expect(unsupportedRouting.record).toEqual(
      expect.objectContaining({
        state: "denied",
        denialReason: "capability_not_supported",
      }),
    );
    expect(fallbackRouting.record).toEqual(
      expect.objectContaining({
        state: "eligible_metadata_only",
        localFallbackAvailable: false,
      }),
    );
    expect(eligibleRouting.record).toEqual(
      expect.objectContaining({
        state: "eligible_metadata_only",
        decision: "allow_metadata_only",
        allowed: true,
      }),
    );
    expectMetadataOnly(
      {
        allowedConsent,
        missingDisclosure,
        allowedBudget,
        exceededBudget,
        unsupportedRouting,
        fallbackRouting,
        eligibleRouting,
      },
      telemetry,
    );
  });

  it("freezes default deny and required gate invariants", async () => {
    const disabled = createGovernanceHarness(false);
    const enabled = createGovernanceHarness(true);

    await expect(
      disabled.consent.evaluate(consentRequest()),
    ).resolves.toMatchObject({
      record: { allowed: false, decision: "denied_consent_missing" },
    });
    await expect(
      disabled.budget.evaluate(budgetRequest()),
    ).resolves.toMatchObject({
      record: { allowed: false, decision: "denied_budget_missing" },
    });
    await expect(
      disabled.routing.evaluate(routingRequest()),
    ).resolves.toMatchObject({
      record: { allowed: false, state: "disabled" },
    });

    await expect(
      enabled.consent.evaluate(consentRequest({ consentGranted: false })),
    ).resolves.toMatchObject({
      record: { decision: "denied_consent_missing" },
    });
    await expect(
      enabled.consent.evaluate(
        consentRequest({ costDisclosureAccepted: false }),
      ),
    ).resolves.toMatchObject({
      record: { decision: "denied_cost_disclosure_missing" },
    });
    await expect(
      enabled.consent.evaluate(
        consentRequest({ providerRetentionDisclosureAccepted: false }),
      ),
    ).resolves.toMatchObject({
      record: { decision: "denied_retention_disclosure_missing" },
    });
    await expect(
      enabled.consent.evaluate(
        consentRequest({ audioLeavesDeviceDisclosureAccepted: false }),
      ),
    ).resolves.toMatchObject({
      record: { decision: "denied_audio_disclosure_missing" },
    });
    await expect(
      enabled.consent.evaluate(
        consentRequest({ transcriptLeavesDeviceDisclosureAccepted: false }),
      ),
    ).resolves.toMatchObject({
      record: { decision: "denied_transcript_disclosure_missing" },
    });
    await expect(
      enabled.routing.evaluate(routingRequest({ budgetAvailable: false })),
    ).resolves.toMatchObject({
      record: { state: "budget_required" },
    });
    await expect(
      enabled.budget.evaluate(
        budgetRequest({
          currentSessionUsage: usage({ estimatedMinutes: 10 }),
        }),
      ),
    ).resolves.toMatchObject({
      record: { decision: "denied_budget_exceeded" },
    });
    await expect(
      enabled.routing.evaluate(
        routingRequest({
          providerId: "cloud_tts",
          requestedCapability: "speech_to_text",
        }),
      ),
    ).resolves.toMatchObject({
      record: { state: "denied" },
    });

    const consentPass = await enabled.consent.evaluate(consentRequest());
    const budgetPass = await enabled.budget.evaluate(budgetRequest());
    const routingPass = await enabled.routing.evaluate(
      routingRequest({
        consentGranted: consentPass.record.allowed,
        costDisclosureAccepted: consentPass.record.allowed,
        budgetAvailable: budgetPass.record.allowed,
      }),
    );
    expect(routingPass.record).toEqual(
      expect.objectContaining({
        state: "eligible_metadata_only",
        allowed: true,
      }),
    );
    expectMetadataOnly(
      { disabled: disabled.telemetry, enabled: enabled.telemetry },
      [...disabled.telemetry, ...enabled.telemetry],
    );
  });

  it("covers all Phase 4G telemetry events with metadata only", async () => {
    const { consent, budget, routing, telemetry } = createGovernanceHarness();

    await consent.evaluate(consentRequest());
    await consent.evaluate(consentRequest({ consentGranted: false }));
    await consent.evaluate(consentRequest({ costDisclosureAccepted: false }));
    await budget.evaluate(budgetRequest());
    await budget.evaluate(budgetRequest({ configuredLimits: [] }));
    await budget.evaluate(
      budgetRequest({ currentDailyUsage: usage({ estimatedCostUnits: 100 }) }),
    );
    await budget.evaluate(budgetRequest({ estimatedMinutes: Number.NaN }));
    await routing.evaluate(routingRequest());
    await routing.evaluate(routingRequest({ providerId: "disabled" }));
    await routing.evaluate(routingRequest({ consentGranted: false }));
    await routing.evaluate(routingRequest({ costDisclosureAccepted: false }));
    await routing.evaluate(routingRequest({ budgetAvailable: false }));

    const eventTypes = Array.from(
      new Set(telemetry.map((event) => event.eventType)),
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        "voice_cloud_consent_evaluated",
        "voice_cloud_consent_allowed",
        "voice_cloud_consent_denied",
        "voice_cloud_consent_disclosure_missing",
        "voice_cloud_budget_evaluated",
        "voice_cloud_budget_allowed",
        "voice_cloud_budget_denied",
        "voice_cloud_budget_exceeded",
        "voice_cloud_budget_invalid_estimate",
        "voice_cloud_routing_policy_evaluated",
        "voice_cloud_routing_policy_allowed",
        "voice_cloud_routing_policy_denied",
        "voice_cloud_routing_policy_consent_required",
        "voice_cloud_routing_policy_cost_disclosure_required",
        "voice_cloud_routing_policy_budget_required",
      ]),
    );
    expectMetadataOnly({ telemetry }, telemetry);
  });

  it("freezes forbidden wiring scans for Phase 4G policy sources", () => {
    const source = [
      "src/lib/voice-streaming/cloud-routing-policy.ts",
      "src/lib/voice-streaming/cloud-budget-guard.ts",
      "src/lib/voice-streaming/cloud-consent-policy.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/from\s+["'][^"']*(openai|realtime|sdk)/i);
    expect(source).not.toMatch(
      /new\s+OpenAI|OpenAI\(|WebSocket|createRealtime/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|EventSource|https?:\/\//i,
    );
    expect(source).not.toMatch(/process\.env|api[_-]?key|Authorization/i);
    expect(source).not.toMatch(/providerSecret|clientSecret|secretKey/i);
    expect(source).not.toMatch(/cloudStt|cloudTts|realtimeSession/i);
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
