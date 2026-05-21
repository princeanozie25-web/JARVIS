import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceCloudBudgetGuard } from "./cloud-budget-guard";
import { VoiceCloudRoutingPolicy } from "./cloud-routing-policy";
import type {
  VoiceCloudBudgetGuardRequest,
  VoiceCloudBudgetLimit,
  VoiceCloudBudgetUsage,
  VoiceOrchestrationTelemetryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness(enabled?: boolean) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const guard = new VoiceCloudBudgetGuard({
    enabled,
    newId: createIdGenerator("cloud-budget"),
    now: () => 10_000,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { guard, telemetry };
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
    {
      window: "per_session",
      dimension: "estimated_minutes",
      limit: 10,
    },
    {
      window: "daily",
      dimension: "estimated_cost_units",
      limit: 100,
    },
    {
      window: "monthly",
      dimension: "request_count",
      limit: 20,
    },
  ];
}

function budgetRequest(
  input: Partial<VoiceCloudBudgetGuardRequest> = {},
): VoiceCloudBudgetGuardRequest {
  return {
    id: input.id ?? "cloud-budget-request-1",
    sessionId: input.sessionId ?? "session-1",
    providerId: input.providerId ?? "openai_realtime",
    requestedCapability: input.requestedCapability ?? "realtime_voice",
    estimatedMinutes: input.estimatedMinutes ?? 1,
    estimatedCostUnits: input.estimatedCostUnits ?? 5,
    currentSessionUsage: input.currentSessionUsage ?? usage(),
    currentDailyUsage: input.currentDailyUsage ?? usage(),
    currentMonthlyUsage: input.currentMonthlyUsage ?? usage(),
    configuredLimits: input.configuredLimits ?? limits(),
    createdAt: 9_900,
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function requestWithUnsafePayloads(
  input: Partial<VoiceCloudBudgetGuardRequest> = {},
): VoiceCloudBudgetGuardRequest {
  return budgetRequest({
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
  } as unknown as Partial<VoiceCloudBudgetGuardRequest>);
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

describe("VoiceCloudBudgetGuard", () => {
  it("defaults to deny when not explicitly enabled", async () => {
    const { guard, telemetry } = createHarness();

    const result = await guard.evaluate(requestWithUnsafePayloads());

    expect(result).toEqual({
      request: expect.objectContaining({
        id: "cloud-budget-request-1",
        providerId: "openai_realtime",
        estimatedMinutes: 1,
        estimatedCostUnits: 5,
      }),
      record: {
        id: "cloud-budget-1",
        requestId: "cloud-budget-request-1",
        sessionId: "session-1",
        providerId: "openai_realtime",
        requestedCapability: "realtime_voice",
        decision: "denied_budget_missing",
        allowed: false,
        estimatedMinutes: 1,
        estimatedCostUnits: 5,
        requestCount: 1,
        currentSessionUsage: usage(),
        currentDailyUsage: usage(),
        currentMonthlyUsage: usage(),
        configuredLimitCount: 3,
        createdAt: 10_000,
        exceededWindow: undefined,
        exceededDimension: undefined,
        exceededLimit: undefined,
        projectedUsage: undefined,
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_budget_denied",
        cloudBudgetDecision: "denied_budget_missing",
        cloudBudgetAllowed: false,
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it("denies when no matching budget limit exists", async () => {
    const { guard, telemetry } = createHarness(true);

    const result = await guard.evaluate(
      budgetRequest({
        configuredLimits: [],
      }),
    );

    expect(result.record).toEqual(
      expect.objectContaining({
        decision: "denied_budget_missing",
        allowed: false,
        configuredLimitCount: 0,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_budget_denied",
      }),
    );
  });

  it.each([
    [
      "per_session",
      "estimated_minutes",
      { currentSessionUsage: usage({ estimatedMinutes: 9.5 }) },
      10.5,
    ],
    [
      "daily",
      "estimated_cost_units",
      { currentDailyUsage: usage({ estimatedCostUnits: 98 }) },
      103,
    ],
    [
      "monthly",
      "request_count",
      { currentMonthlyUsage: usage({ requestCount: 20 }) },
      21,
    ],
  ] as const)(
    "denies exceeded %s %s budget",
    async (window, dimension, usageInput, projectedUsage) => {
      const { guard, telemetry } = createHarness(true);

      const result = await guard.evaluate(budgetRequest(usageInput));

      expect(result.record).toEqual(
        expect.objectContaining({
          decision: "denied_budget_exceeded",
          allowed: false,
          exceededWindow: window,
          exceededDimension: dimension,
          exceededLimit:
            dimension === "estimated_cost_units"
              ? 100
              : dimension === "request_count"
                ? 20
                : 10,
          projectedUsage,
        }),
      );
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_cloud_budget_exceeded",
          cloudBudgetDecision: "denied_budget_exceeded",
        }),
      );
    },
  );

  it("allows valid configured budget metadata and can feed routing eligibility", async () => {
    const budgetTelemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const routingTelemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const guard = new VoiceCloudBudgetGuard({
      enabled: true,
      newId: createIdGenerator("cloud-budget"),
      now: () => 10_000,
      emitTelemetry: (event) => {
        budgetTelemetry.push(event);
      },
    });
    const routingPolicy = new VoiceCloudRoutingPolicy({
      enabled: true,
      newId: createIdGenerator("cloud-policy"),
      now: () => 10_100,
      emitTelemetry: (event) => {
        routingTelemetry.push(event);
      },
    });

    const budget = await guard.evaluate(budgetRequest());
    const routing = await routingPolicy.evaluate({
      id: "routing-request-1",
      sessionId: "session-1",
      providerId: budget.record.providerId,
      requestedCapability: budget.record.requestedCapability,
      consentGranted: true,
      costDisclosureAccepted: true,
      budgetAvailable: budget.record.allowed,
      localFallbackAvailable: true,
      voiceTurnState: "waiting_for_send",
    });

    expect(budget.record).toEqual(
      expect.objectContaining({
        decision: "allowed_metadata_only",
        allowed: true,
      }),
    );
    expect(routing.record).toEqual(
      expect.objectContaining({
        state: "eligible_metadata_only",
        decision: "allow_metadata_only",
        allowed: true,
      }),
    );
    expect(budgetTelemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_budget_allowed",
      }),
    );
    expectMetadataOnly({ budget, routing }, [
      ...budgetTelemetry,
      ...routingTelemetry,
    ]);
  });

  it.each([
    { estimatedMinutes: -1 },
    { estimatedCostUnits: Number.NaN },
    { currentDailyUsage: usage({ requestCount: -1 }) },
    { configuredLimits: [{ ...limits()[0], limit: Number.POSITIVE_INFINITY }] },
  ] satisfies Array<Partial<VoiceCloudBudgetGuardRequest>>)(
    "denies invalid estimates %o",
    async (input) => {
      const { guard, telemetry } = createHarness(true);

      const result = await guard.evaluate(budgetRequest(input));

      expect(result.record).toEqual(
        expect.objectContaining({
          decision: "denied_invalid_estimate",
          allowed: false,
        }),
      );
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_cloud_budget_invalid_estimate",
          cloudBudgetDecision: "denied_invalid_estimate",
        }),
      );
    },
  );

  it("denies disabled provider metadata", async () => {
    const { guard, telemetry } = createHarness(true);

    const result = await guard.evaluate(
      budgetRequest({
        providerId: "disabled",
      }),
    );

    expect(result.record).toEqual(
      expect.objectContaining({
        decision: "denied_provider_disabled",
        allowed: false,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_cloud_budget_denied",
        cloudProviderId: "disabled",
      }),
    );
  });

  it("does not introduce provider SDK, network, API key, runtime, approval, playback, chat, device, or browser wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/cloud-budget-guard.ts"),
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
