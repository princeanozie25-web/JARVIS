import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceBargeInCoordinator } from "./barge-in-coordinator";
import { VoiceCloudBudgetGuard } from "./cloud-budget-guard";
import { VoiceCloudConsentPolicy } from "./cloud-consent-policy";
import { VoiceCloudRoutingPolicy } from "./cloud-routing-policy";
import { VoicePlaybackSequencer } from "./playback-sequencer";
import { VoicePrivacyPolicy } from "./privacy-policy";
import { VoiceRealtimeOrchestrationPipeline } from "./pipeline";
import { VoiceRestrictedContentBoundary } from "./restricted-content-boundary";
import { VoiceRuntimeBoundaryCoordinator } from "./runtime-boundary-coordinator";
import { VoiceResponseChunkScheduler } from "./scheduler";
import { VoiceOrchestrationSupervisor } from "./supervisor";
import { VoiceSynthesisOrchestrationQueue } from "./synthesis-queue";
import {
  sanitizeVoiceTelemetryEvent,
  VOICE_TELEMETRY_ALLOWED_KEYS,
  VOICE_TELEMETRY_FORBIDDEN_KEY_LIST,
} from "./telemetry-hygiene";
import type {
  AssistantResponseStreamMetadataEvent,
  VoiceBargeInIntent,
  VoiceCloudBudgetGuardRequest,
  VoiceCloudBudgetLimit,
  VoiceCloudBudgetUsage,
  VoiceCloudConsentPolicyRequest,
  VoiceCloudRoutingPolicyRequest,
  VoiceOrchestrationTelemetryEvent,
  VoiceOrchestrationTelemetryEventType,
  VoicePrivacyPolicyDescriptor,
  VoiceRestrictedContentDescriptor,
  VoiceRuntimeBoundaryEvent,
} from "./types";

const ALL_VOICE_TELEMETRY_EVENT_TYPES = [
  "voice_session_started",
  "voice_session_cancelled",
  "voice_session_completed",
  "voice_session_failed",
  "voice_orchestration_interrupted",
  "voice_response_metadata_stream_started",
  "voice_response_metadata_stream_completed",
  "voice_response_metadata_stream_failed",
  "voice_response_chunk_scheduled",
  "voice_response_chunk_schedule_dropped",
  "voice_response_chunk_schedule_overflow",
  "voice_response_chunk_duplicate_dropped",
  "voice_response_chunk_gap_detected",
  "voice_response_chunk_out_of_order",
  "voice_response_chunk_scheduling_cancelled",
  "voice_response_chunk_scheduling_interrupted",
  "voice_synthesis_queue_item_enqueued",
  "voice_synthesis_queue_item_dropped",
  "voice_synthesis_queue_overflow",
  "voice_synthesis_queue_cancelled",
  "voice_synthesis_queue_interrupted",
  "voice_playback_sequence_intent_created",
  "voice_playback_sequence_item_dropped",
  "voice_playback_sequence_overflow",
  "voice_playback_sequence_cancelled",
  "voice_playback_sequence_interrupted",
  "voice_realtime_pipeline_started",
  "voice_realtime_pipeline_playback_intent_created",
  "voice_realtime_pipeline_completed",
  "voice_realtime_pipeline_cancelled",
  "voice_realtime_pipeline_interrupted",
  "voice_realtime_pipeline_failed",
  "voice_realtime_pipeline_dropped",
  "voice_realtime_pipeline_stale_event_rejected",
  "voice_realtime_pipeline_fanout_started",
  "voice_realtime_pipeline_fanout_completed",
  "voice_realtime_pipeline_fanout_noop",
  "voice_realtime_pipeline_terminal_started",
  "voice_realtime_pipeline_terminal_completed",
  "voice_realtime_pipeline_terminal_failed",
  "voice_realtime_pipeline_terminal_noop",
  "voice_realtime_chunk_readiness_changed",
  "voice_realtime_first_chunk_ready",
  "voice_realtime_chunk_readiness_timeout",
  "voice_realtime_stage_latency_marker",
  "voice_barge_in_intent_received",
  "voice_barge_in_action_selected",
  "voice_barge_in_noop",
  "voice_barge_in_intent_rejected",
  "voice_barge_in_state_transition",
  "voice_barge_in_invalid_transition",
  "voice_barge_in_terminal_noop",
  "voice_barge_in_transition_failed",
  "voice_turn_preemption_recorded",
  "voice_turn_preemption_noop",
  "voice_turn_preemption_rejected",
  "voice_capture_rearm_requested",
  "voice_capture_rearm_ready",
  "voice_capture_rearm_blocked",
  "voice_capture_rearm_failed",
  "voice_capture_rearm_noop",
  "voice_runtime_boundary_event_received",
  "voice_runtime_boundary_advisory_selected",
  "voice_runtime_boundary_voice_approval_rejected",
  "voice_runtime_boundary_noop",
  "voice_runtime_boundary_voice_approval_attempt_received",
  "voice_runtime_boundary_on_screen_confirmation_required",
  "voice_runtime_boundary_voice_approval_noop",
  "voice_runtime_boundary_lifecycle_state_changed",
  "voice_runtime_boundary_duplicate_noop",
  "voice_runtime_boundary_stale_rejected",
  "voice_runtime_boundary_out_of_order_observed",
  "voice_restricted_content_descriptor_received",
  "voice_restricted_content_allowed",
  "voice_restricted_content_blocked",
  "voice_restricted_content_noop",
  "voice_cloud_routing_policy_evaluated",
  "voice_cloud_routing_policy_allowed",
  "voice_cloud_routing_policy_denied",
  "voice_cloud_routing_policy_consent_required",
  "voice_cloud_routing_policy_cost_disclosure_required",
  "voice_cloud_routing_policy_budget_required",
  "voice_cloud_budget_evaluated",
  "voice_cloud_budget_allowed",
  "voice_cloud_budget_denied",
  "voice_cloud_budget_exceeded",
  "voice_cloud_budget_invalid_estimate",
  "voice_cloud_consent_evaluated",
  "voice_cloud_consent_allowed",
  "voice_cloud_consent_denied",
  "voice_cloud_consent_disclosure_missing",
  "voice_privacy_policy_evaluated",
  "voice_privacy_policy_allowed",
  "voice_privacy_policy_denied",
  "voice_privacy_policy_unknown_payload",
] satisfies VoiceOrchestrationTelemetryEventType[];

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function unsafe<T extends object>(value: T): T {
  return {
    transcript: "secret transcript payload",
    transcriptText: "secret transcript text payload",
    spokenText: "secret spoken payload",
    assistantText: "secret assistant text payload",
    assistantBody: "secret assistant body payload",
    toolOutput: "secret tool output payload",
    fileContent: "secret file content payload",
    code: "secret code payload",
    codeBlock: "secret code block payload",
    personalContext: "secret personal_context payload",
    auditLog: "secret audit log payload",
    approvalPayload: "secret approval payload",
    approvalRequestId: "approval-request-secret",
    apiKey: "secret api key payload",
    providerSecret: "secret provider secret payload",
    requestPayload: {
      rawAudio: "secret raw audio payload",
      audioData: "secret audio data payload",
      audioBlob: "secret audio blob payload",
      audioUrl: "secret audio url payload",
      pcm: "secret pcm payload",
    },
    ...value,
  };
}

function expectMetadataOnly(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret transcript text payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant text payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret tool output payload");
  expect(serialized).not.toContain("secret file content payload");
  expect(serialized).not.toContain("secret code payload");
  expect(serialized).not.toContain("secret code block payload");
  expect(serialized).not.toContain("secret personal_context payload");
  expect(serialized).not.toContain("secret audit log payload");
  expect(serialized).not.toContain("secret approval payload");
  expect(serialized).not.toContain("approval-request-secret");
  expect(serialized).not.toContain("secret api key payload");
  expect(serialized).not.toContain("secret provider secret payload");
  expect(serialized).not.toContain("secret request payload");
  expect(serialized).not.toContain("secret raw audio payload");
  expect(serialized).not.toContain("secret audio data payload");
  expect(serialized).not.toContain("secret audio blob payload");
  expect(serialized).not.toContain("secret audio url payload");
  expect(serialized).not.toContain("secret pcm payload");
}

function assertTelemetryMetadataOnly(
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  expect(telemetry.length).toBeGreaterThan(0);
  for (const event of telemetry) {
    for (const key of Object.keys(event)) {
      expect(VOICE_TELEMETRY_ALLOWED_KEYS.has(key)).toBe(true);
      expect(
        VOICE_TELEMETRY_FORBIDDEN_KEY_LIST.includes(
          key as (typeof VOICE_TELEMETRY_FORBIDDEN_KEY_LIST)[number],
        ),
      ).toBe(false);
    }
  }
  expectMetadataOnly(telemetry);
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
    { window: "daily", dimension: "estimated_cost_units", limit: 20 },
    { window: "monthly", dimension: "request_count", limit: 30 },
  ];
}

function consentRequest(
  input: Partial<VoiceCloudConsentPolicyRequest> = {},
): VoiceCloudConsentPolicyRequest {
  return {
    id: input.id ?? "consent-1",
    sessionId: input.sessionId ?? "session-policy",
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
    id: input.id ?? "budget-1",
    sessionId: input.sessionId ?? "session-policy",
    providerId: input.providerId ?? "openai_realtime",
    requestedCapability: input.requestedCapability ?? "realtime_voice",
    estimatedMinutes: input.estimatedMinutes ?? 1,
    estimatedCostUnits: input.estimatedCostUnits ?? 2,
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
    id: input.id ?? "routing-1",
    sessionId: input.sessionId ?? "session-policy",
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

function privacyDescriptor(
  input: Partial<VoicePrivacyPolicyDescriptor> = {},
): VoicePrivacyPolicyDescriptor {
  return {
    id: input.id ?? "privacy-1",
    sessionId: input.sessionId ?? "session-policy",
    classification: input.classification ?? "local_voice_metadata",
    sourceId: "privacy-source-1",
    turnId: "turn-privacy",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function restrictedDescriptor(
  input: Partial<VoiceRestrictedContentDescriptor> = {},
): VoiceRestrictedContentDescriptor {
  return {
    id: input.id ?? "restricted-1",
    sessionId: input.sessionId ?? "session-policy",
    classification: input.classification ?? "tool_output",
    contentRefId: "content-ref-1",
    sourceId: "source-1",
    turnId: "turn-restricted",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function runtimeEvent(
  input: Partial<VoiceRuntimeBoundaryEvent> = {},
): VoiceRuntimeBoundaryEvent {
  return {
    id: input.id ?? "runtime-1",
    type: input.type ?? "runtime_tool_started",
    sessionId: input.sessionId ?? "session-policy",
    runtimeCallId: "runtime-call-1",
    toolName: "safe_tool_name",
    turnId: "turn-runtime",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

async function createPipelineHarness(
  telemetry: VoiceOrchestrationTelemetryEvent[],
) {
  let now = 1_000;
  const nextTime = () => {
    now += 10;
    return now;
  };
  const emitTelemetry = (event: VoiceOrchestrationTelemetryEvent) => {
    telemetry.push(event);
  };
  const supervisor = new VoiceOrchestrationSupervisor({
    newId: createIdGenerator("session"),
    now: nextTime,
    emitTelemetry,
  });
  const scheduler = new VoiceResponseChunkScheduler({
    supervisor,
    newId: createIdGenerator("schedule"),
    now: nextTime,
    emitTelemetry,
  });
  const synthesisQueue = new VoiceSynthesisOrchestrationQueue({
    supervisor,
    newId: createIdGenerator("synthesis"),
    now: nextTime,
    emitTelemetry,
  });
  const playbackSequencer = new VoicePlaybackSequencer({
    supervisor,
    newId: createIdGenerator("playback"),
    now: nextTime,
    emitTelemetry,
  });
  const pipeline = new VoiceRealtimeOrchestrationPipeline({
    supervisor,
    scheduler,
    synthesisQueue,
    playbackSequencer,
    now: nextTime,
    readinessTimeoutMs: 5,
    emitTelemetry,
  });
  const started = await supervisor.startSession();
  if (!started.ok) throw new Error("failed_to_start_session");
  return { supervisor, pipeline, sessionId: started.session.id, nextTime };
}

describe("Phase 4H privacy and telemetry freeze invariants", () => {
  it("stress handles mixed privacy and telemetry events across every voice boundary", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const emitTelemetry = (event: VoiceOrchestrationTelemetryEvent) => {
      telemetry.push(event);
    };
    const { supervisor, pipeline, sessionId } =
      await createPipelineHarness(telemetry);

    await pipeline.ingest(
      unsafe({
        type: "response_started",
        sessionId,
        streamId: "stream-freeze",
        responseId: "response-freeze",
      }) as unknown as AssistantResponseStreamMetadataEvent,
    );
    await pipeline.ingest(
      unsafe({
        type: "chunk_available",
        sessionId,
        streamId: "stream-freeze",
        responseId: "response-freeze",
        chunkId: "chunk-freeze-0",
        index: 0,
      }) as unknown as AssistantResponseStreamMetadataEvent,
    );
    await pipeline.detectReadinessTimeouts(sessionId, 1_000_000);

    const bargeIn = new VoiceBargeInCoordinator({
      supervisor,
      pipeline,
      newId: createIdGenerator("barge-freeze"),
      now: () => 2_000,
      emitTelemetry,
    });
    await bargeIn.handleIntent(
      unsafe({
        id: "barge-1",
        sessionId,
        category: "user_ptt_pressed_during_playback",
        turnId: "turn-barge",
        streamId: "stream-freeze",
        responseId: "response-freeze",
      }) as unknown as VoiceBargeInIntent,
    );

    const privacy = new VoicePrivacyPolicy({
      newId: createIdGenerator("privacy-freeze"),
      now: () => 3_000,
      emitTelemetry,
    });
    await privacy.evaluate(
      unsafe(
        privacyDescriptor({
          id: "privacy-allowed",
          classification: "local_voice_metadata",
        }),
      ) as unknown as VoicePrivacyPolicyDescriptor,
    );
    await privacy.evaluate(
      unsafe(
        privacyDescriptor({
          id: "privacy-denied",
          classification: "raw_audio",
        }),
      ) as unknown as VoicePrivacyPolicyDescriptor,
    );

    const runtime = new VoiceRuntimeBoundaryCoordinator({
      newId: createIdGenerator("runtime-freeze"),
      now: () => 4_000,
      getActiveSessionId: () => "session-policy",
      emitTelemetry,
    });
    await runtime.handleEvent(
      unsafe(
        runtimeEvent({
          id: "runtime-approval",
          type: "runtime_pending_approval_detected",
          runtimeCallId: undefined,
          voiceApprovalAttemptCategory: "spoken_yes",
        }),
      ) as unknown as VoiceRuntimeBoundaryEvent,
    );
    await runtime.handleEvent(
      unsafe(
        runtimeEvent({
          id: "runtime-tool-started",
          type: "runtime_tool_started",
          runtimeCallId: "runtime-tool-freeze",
        }),
      ) as unknown as VoiceRuntimeBoundaryEvent,
    );
    await runtime.handleEvent(
      unsafe(
        runtimeEvent({
          id: "runtime-tool-completed",
          type: "runtime_tool_completed",
          runtimeCallId: "runtime-tool-freeze",
        }),
      ) as unknown as VoiceRuntimeBoundaryEvent,
    );

    const restricted = new VoiceRestrictedContentBoundary({
      newId: createIdGenerator("restricted-freeze"),
      now: () => 5_000,
      emitTelemetry,
    });
    await restricted.evaluateDescriptor(
      unsafe(
        restrictedDescriptor({
          id: "restricted-tool",
          classification: "tool_output",
        }),
      ) as unknown as VoiceRestrictedContentDescriptor,
    );

    const consent = new VoiceCloudConsentPolicy({
      enabled: true,
      newId: createIdGenerator("consent-freeze"),
      now: () => 6_000,
      emitTelemetry,
    });
    const budget = new VoiceCloudBudgetGuard({
      enabled: true,
      newId: createIdGenerator("budget-freeze"),
      now: () => 6_100,
      emitTelemetry,
    });
    const routing = new VoiceCloudRoutingPolicy({
      enabled: true,
      newId: createIdGenerator("routing-freeze"),
      now: () => 6_200,
      emitTelemetry,
    });
    const consentResult = await consent.evaluate(
      unsafe(consentRequest()) as unknown as VoiceCloudConsentPolicyRequest,
    );
    const budgetResult = await budget.evaluate(
      unsafe(budgetRequest()) as unknown as VoiceCloudBudgetGuardRequest,
    );
    await routing.evaluate(
      unsafe(
        routingRequest({
          consentGranted: consentResult.record.allowed,
          costDisclosureAccepted: consentResult.record.allowed,
          budgetAvailable: budgetResult.record.allowed,
        }),
      ) as unknown as VoiceCloudRoutingPolicyRequest,
    );

    sanitizeVoiceTelemetryEvent(
      unsafe({
        eventType: "voice_privacy_policy_denied",
        sessionId: "session-policy",
        state: "waiting_for_send",
        success: false,
        error: "secret assistant body payload with spaces",
      }),
    );

    expect(telemetry.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "voice_realtime_pipeline_playback_intent_created",
        "voice_barge_in_intent_received",
        "voice_turn_preemption_recorded",
        "voice_privacy_policy_allowed",
        "voice_privacy_policy_denied",
        "voice_runtime_boundary_voice_approval_rejected",
        "voice_runtime_boundary_lifecycle_state_changed",
        "voice_restricted_content_blocked",
        "voice_cloud_consent_allowed",
        "voice_cloud_budget_allowed",
        "voice_cloud_routing_policy_allowed",
      ]),
    );
    assertTelemetryMetadataOnly(telemetry);
  });

  it("freezes telemetry hygiene for forbidden, nested, unsafe scalar, non-scalar, and every event type", () => {
    const sanitizedEvents = ALL_VOICE_TELEMETRY_EVENT_TYPES.map((eventType) =>
      sanitizeVoiceTelemetryEvent(
        unsafe({
          eventType,
          sessionId: "session-freeze",
          state: "waiting_for_send",
          success: true,
          chunkIndex: 1,
          error: "secret transcript payload with spaces",
          nestedPayload: {
            transcriptText: "secret transcript text payload",
            rawAudio: "secret raw audio payload",
          },
          chunkId: { audioUrl: "secret audio url payload" },
        }),
      ),
    );

    for (const result of sanitizedEvents) {
      expect(result.event).toEqual(
        expect.objectContaining({
          sessionId: "session-freeze",
          state: "waiting_for_send",
          success: true,
          chunkIndex: 1,
          error: "redacted_metadata_only",
        }),
      );
      expect(result.event).not.toHaveProperty("chunkId");
      expect(result.removedKeys).toEqual(
        expect.arrayContaining([
          "transcript",
          "transcriptText",
          "spokenText",
          "assistantText",
          "assistantBody",
          "toolOutput",
          "fileContent",
          "code",
          "codeBlock",
          "personalContext",
          "auditLog",
          "approvalPayload",
          "approvalRequestId",
          "apiKey",
          "providerSecret",
          "requestPayload",
          "requestPayload.rawAudio",
          "requestPayload.audioData",
          "requestPayload.audioBlob",
          "requestPayload.audioUrl",
          "requestPayload.pcm",
          "nestedPayload",
          "nestedPayload.transcriptText",
          "nestedPayload.rawAudio",
          "chunkId",
          "chunkId.audioUrl",
        ]),
      );
      for (const key of Object.keys(result.event)) {
        expect(VOICE_TELEMETRY_ALLOWED_KEYS.has(key)).toBe(true);
      }
    }
    expect(
      sanitizedEvents.map((result) => result.event.eventType).sort(),
    ).toEqual([...ALL_VOICE_TELEMETRY_EVENT_TYPES].sort());
    expectMetadataOnly(sanitizedEvents);
  });

  it("freezes voice privacy policy decisions as metadata-only", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const policy = new VoicePrivacyPolicy({
      newId: createIdGenerator("privacy-freeze"),
      now: () => 7_000,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });

    const classifications = [
      ["local_voice_metadata", "allowed_metadata_only", true],
      ["raw_audio", "denied_raw_audio_retention", false],
      ["transcript_text", "denied_transcript_upload", false],
      ["assistant_speech_text", "denied_speech_text_retention", false],
      ["synthesized_audio", "denied_audio_upload", false],
      ["audio_url", "denied_audio_upload", false],
      ["cloud_voice_request", "denied_cloud_request", false],
      ["unknown_payload", "denied_unknown_payload", false],
    ] as const;

    const results = [];
    for (const [classification, decision, allowed] of classifications) {
      const result = await policy.evaluate(
        unsafe(
          privacyDescriptor({
            id: `privacy-${classification}`,
            classification,
          }),
        ) as unknown as VoicePrivacyPolicyDescriptor,
      );
      expect(result.record).toEqual(
        expect.objectContaining({
          classification,
          decision,
          allowed,
        }),
      );
      results.push(result);
    }
    assertTelemetryMetadataOnly(telemetry);
    expectMetadataOnly(results);
  });

  it("freezes forbidden wiring scans for Phase 4H and voice-streaming sources", () => {
    const dir = join(process.cwd(), "src/lib/voice-streaming");
    const source = readdirSync(dir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => file !== "types.ts")
      .map((file) => readFileSync(join(dir, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /navigator\.mediaDevices|getUserMedia|MediaRecorder|AudioContext|microphone/i,
    );
    expect(source).not.toMatch(
      /captureAudio|retainRawAudio|uploadAudio|uploadTranscript|rawAudio\s*[:=]|audioData\s*[:=]|audioBlob\s*[:=]|pcm\s*[:=]/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|https?:\/\//i,
    );
    expect(source).not.toMatch(
      /from\s+["'][^"']*(openai|realtime|sdk)|new\s+OpenAI|createRealtime/i,
    );
    expect(source).not.toMatch(
      /process\.env|Authorization|OPENAI_API_KEY|apiKey\s*[:=]|providerSecret\s*[:=]/i,
    );
    expect(source).not.toMatch(/runtime-commands|executeRuntime|runTool/i);
    expect(source).not.toMatch(
      /approveRuntime|executeApproval|bypass|submitApproval|grantApproval/i,
    );
    expect(source).not.toMatch(
      /from\s+["'][^"']*(audio-player|tts-runtime|speech-synthesis)|synthesize\(|HTMLAudioElement|startPlayback|\.play\(|autoplay\s*[:=]\s*true/i,
    );
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(
      /keyboard|addEventListener|window\.|document\./i,
    );
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
  });
});
