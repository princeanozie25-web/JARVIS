import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceRestrictedContentBoundary } from "./restricted-content-boundary";
import { VoiceRuntimeBoundaryCoordinator } from "./runtime-boundary-coordinator";
import type {
  VoiceApprovalAttemptCategory,
  VoiceOrchestrationTelemetryEvent,
  VoiceRestrictedContentClassification,
  VoiceRestrictedContentDescriptor,
  VoiceRuntimeBoundaryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness(activeSessionId: string | null = "session-1") {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const runtime = new VoiceRuntimeBoundaryCoordinator({
    newId: createIdGenerator("runtime-freeze"),
    now: () => 8_000,
    getActiveSessionId: () => activeSessionId,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  const restrictedContent = new VoiceRestrictedContentBoundary({
    newId: createIdGenerator("restricted-freeze"),
    now: () => 8_500,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { runtime, restrictedContent, telemetry };
}

function runtimeEvent(
  input: Partial<VoiceRuntimeBoundaryEvent> = {},
): VoiceRuntimeBoundaryEvent {
  return {
    id: input.id ?? "runtime-event-1",
    type: input.type ?? "runtime_tool_started",
    sessionId: input.sessionId ?? "session-1",
    turnId: "turn-1",
    runtimeCallId: "runtime-call-1",
    approvalRequestId: "approval-request-secret",
    toolName: "safe_tool_name",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function descriptor(
  input: Partial<VoiceRestrictedContentDescriptor> = {},
): VoiceRestrictedContentDescriptor {
  return {
    id: input.id ?? "descriptor-1",
    sessionId: input.sessionId ?? "session-1",
    turnId: "turn-1",
    classification: input.classification ?? "tool_output",
    contentRefId: "content-ref-1",
    sourceId: "source-1",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function withUnsafePayloads<T extends object>(value: T): T {
  return {
    toolOutput: "secret tool output payload",
    fileContent: "secret file content payload",
    codeBlock: "secret code block payload",
    personalContext: "secret personal_context payload",
    auditLog: "secret audit log payload",
    transcript: "secret transcript payload",
    spokenText: "secret spoken payload",
    assistantBody: "secret assistant body payload",
    approvalPayload: "secret approval payload",
    approvalId: "secret approval id",
    audio: "secret audio payload",
    ...value,
  };
}

function expectMetadataOnly(
  records: unknown,
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  const serialized = JSON.stringify({ records, telemetry });
  expect(serialized).not.toContain("secret tool output payload");
  expect(serialized).not.toContain("secret file content payload");
  expect(serialized).not.toContain("secret code block payload");
  expect(serialized).not.toContain("secret personal_context payload");
  expect(serialized).not.toContain("secret audit log payload");
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret approval payload");
  expect(JSON.stringify(telemetry)).not.toContain("approval-request-secret");
  expect(JSON.stringify(telemetry)).not.toContain("secret approval id");
  expect(serialized).not.toContain("secret audio payload");

  for (const event of telemetry) {
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "toolOutput",
        "fileContent",
        "codeBlock",
        "personalContext",
        "auditLog",
        "transcript",
        "spokenText",
        "assistantBody",
        "approvalPayload",
        "approvalId",
        "approvalRequestId",
        "audio",
      ]),
    );
  }
}

function countTelemetry(
  telemetry: VoiceOrchestrationTelemetryEvent[],
  eventType: VoiceOrchestrationTelemetryEvent["eventType"],
): number {
  return telemetry.filter((event) => event.eventType === eventType).length;
}

describe("Phase 4F runtime boundary freeze invariants", () => {
  it("stress handles rapid mixed runtime and restricted-content metadata safely", async () => {
    const { runtime, restrictedContent, telemetry } = createHarness();

    const runtimeInputs: VoiceRuntimeBoundaryEvent[] = [
      runtimeEvent({
        id: "pending-1",
        type: "runtime_pending_approval_detected",
        runtimeCallId: undefined,
        approvalRequestId: "approval-request-secret",
      }),
      runtimeEvent({
        id: "pending-1",
        type: "runtime_pending_approval_detected",
        runtimeCallId: undefined,
        approvalRequestId: "approval-request-secret",
      }),
      runtimeEvent({
        id: "voice-attempt-1",
        type: "runtime_pending_approval_detected",
        runtimeCallId: undefined,
        approvalRequestId: "approval-request-secret-voice",
        voiceApprovalAttemptCategory: "spoken_yes",
      }),
      runtimeEvent({
        id: "tool-started-1",
        type: "runtime_tool_started",
        runtimeCallId: "runtime-tool-normal",
      }),
      runtimeEvent({
        id: "tool-completed-1",
        type: "runtime_tool_completed",
        runtimeCallId: "runtime-tool-normal",
      }),
      runtimeEvent({
        id: "tool-completed-duplicate",
        type: "runtime_tool_completed",
        runtimeCallId: "runtime-tool-normal",
      }),
      runtimeEvent({
        id: "tool-failed-before-start",
        type: "runtime_tool_failed",
        runtimeCallId: "runtime-tool-out-of-order",
      }),
      runtimeEvent({
        id: "cancel-requested-1",
        type: "runtime_cancel_requested",
        runtimeCallId: "runtime-cancel-normal",
      }),
      runtimeEvent({
        id: "cancel-acknowledged-1",
        type: "runtime_cancel_acknowledged",
        runtimeCallId: "runtime-cancel-normal",
      }),
      runtimeEvent({
        id: "cancel-denied-1",
        type: "runtime_cancel_denied",
        runtimeCallId: "runtime-cancel-normal",
      }),
      runtimeEvent({
        id: "cancel-ack-before-request",
        type: "runtime_cancel_acknowledged",
        runtimeCallId: "runtime-cancel-out-of-order",
      }),
      runtimeEvent({
        id: "stale-tool-started",
        type: "runtime_tool_started",
        sessionId: "stale-session",
        runtimeCallId: "runtime-stale",
      }),
    ].map((event) =>
      withUnsafePayloads(event),
    ) as unknown as VoiceRuntimeBoundaryEvent[];

    const runtimeResults = [];
    for (const event of runtimeInputs) {
      runtimeResults.push(await runtime.handleEvent(event));
    }

    const descriptorInputs = [
      descriptor({
        id: "assistant-descriptor",
        classification: "assistant_prose_metadata",
      }),
      descriptor({ id: "tool-descriptor", classification: "tool_output" }),
      descriptor({ id: "tool-descriptor", classification: "tool_output" }),
      descriptor({
        id: "audit-descriptor",
        classification: "audit_log",
      }),
    ].map((item) =>
      withUnsafePayloads(item),
    ) as unknown as VoiceRestrictedContentDescriptor[];

    const descriptorResults = [];
    for (const item of descriptorInputs) {
      descriptorResults.push(await restrictedContent.evaluateDescriptor(item));
    }

    expect(runtimeResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ok: false,
          reason: "voice_approval_rejected",
        }),
        expect.objectContaining({
          ok: false,
          reason: "stale_session_rejected",
        }),
        expect.objectContaining({
          ok: true,
          advisory: expect.objectContaining({
            orderingIssue: "duplicate",
            state: "no_op",
          }),
        }),
        expect.objectContaining({
          ok: true,
          advisory: expect.objectContaining({
            orderingIssue: "out_of_order",
            state: "failed_metadata_only",
          }),
        }),
      ]),
    );
    expect(descriptorResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record: expect.objectContaining({
            decision: "allowed_for_speech_metadata",
          }),
        }),
        expect.objectContaining({
          record: expect.objectContaining({
            decision: "blocked_from_speech",
          }),
        }),
        expect.objectContaining({
          record: expect.objectContaining({
            decision: "no_op",
          }),
        }),
      ]),
    );
    const advisories = runtime.getAdvisories("session-1");
    expect(advisories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "runtime_pending_approval_detected",
          state: "waiting_for_on_screen_confirmation",
        }),
        expect.objectContaining({
          eventType: "runtime_pending_approval_detected",
          state: "rejected",
        }),
        expect.objectContaining({
          eventType: "runtime_cancel_requested",
          state: "advisory_created",
        }),
        expect.objectContaining({
          eventType: "runtime_cancel_acknowledged",
          state: "acknowledged_metadata_only",
        }),
        expect.objectContaining({
          eventType: "runtime_cancel_denied",
          state: "denied_metadata_only",
        }),
        expect.objectContaining({
          eventType: "runtime_cancel_acknowledged",
          orderingIssue: "out_of_order",
        }),
        expect.objectContaining({
          eventType: "runtime_tool_started",
          state: "advisory_created",
        }),
        expect.objectContaining({
          eventType: "runtime_tool_completed",
          state: "completed_metadata_only",
        }),
        expect.objectContaining({
          eventType: "runtime_tool_failed",
          orderingIssue: "out_of_order",
        }),
      ]),
    );
    expect(
      advisories
        .filter((record) => record.operationId === "runtime-tool-normal")
        .map((record) => record.eventType),
    ).toEqual(["runtime_tool_started", "runtime_tool_completed"]);
    expect(runtime.getVoiceApprovalRefusals("session-1")).toHaveLength(1);
    expect(restrictedContent.getDecisions("session-1")).toHaveLength(3);
    expect(
      countTelemetry(telemetry, "voice_runtime_boundary_duplicate_noop"),
    ).toBeGreaterThanOrEqual(2);
    expect(
      countTelemetry(telemetry, "voice_runtime_boundary_out_of_order_observed"),
    ).toBeGreaterThanOrEqual(2);
    expect(
      countTelemetry(telemetry, "voice_runtime_boundary_stale_rejected"),
    ).toBe(1);
    expectMetadataOnly(
      {
        runtime: runtime.getAdvisories(),
        refusals: runtime.getVoiceApprovalRefusals(),
        restricted: restrictedContent.getDecisions(),
      },
      telemetry,
    );
  });

  it.each([
    "spoken_yes",
    "spoken_confirm",
    "spoken_approve",
    "inferred_consent",
    "ambiguous_voice_response",
    "replayed_voice_response",
  ] satisfies VoiceApprovalAttemptCategory[])(
    "freezes voice approval attempt category %s as rejected",
    async (category) => {
      const { runtime, telemetry } = createHarness();

      const result = await runtime.handleEvent(
        runtimeEvent({
          id: `voice-attempt-${category}`,
          type: "runtime_pending_approval_detected",
          runtimeCallId: undefined,
          approvalRequestId: `approval-request-secret-${category}`,
          voiceApprovalAttemptCategory: category,
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        reason: "voice_approval_rejected",
        advisory: {
          action: "require_on_screen_confirmation",
          state: "rejected",
          reason: "voice_approval_rejected",
        },
      });
      expect(runtime.getVoiceApprovalRefusals()).toEqual([
        expect.objectContaining({
          category,
          action: "rejected_voice_approval",
        }),
      ]);
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_runtime_boundary_on_screen_confirmation_required",
          runtimeBoundaryAction: "require_on_screen_confirmation",
          success: false,
        }),
      );
      expectMetadataOnly(runtime.getAdvisories(), telemetry);
    },
  );

  it("keeps runtime cancel metadata advisory-only across requested, acknowledged, and denied states", async () => {
    const { runtime, telemetry } = createHarness();

    await runtime.handleEvent(
      runtimeEvent({
        id: "cancel-requested",
        type: "runtime_cancel_requested",
        runtimeCallId: "runtime-cancel-freeze",
      }),
    );
    await runtime.handleEvent(
      runtimeEvent({
        id: "cancel-acknowledged",
        type: "runtime_cancel_acknowledged",
        runtimeCallId: "runtime-cancel-freeze",
      }),
    );
    await runtime.handleEvent(
      runtimeEvent({
        id: "cancel-denied",
        type: "runtime_cancel_denied",
        runtimeCallId: "runtime-cancel-freeze",
      }),
    );

    expect(runtime.getAdvisories("session-1")).toEqual([
      expect.objectContaining({
        action: "request_runtime_cancel_advisory",
        state: "advisory_created",
      }),
      expect.objectContaining({
        action: "surface_runtime_cancel_acknowledged",
        state: "acknowledged_metadata_only",
      }),
      expect.objectContaining({
        action: "surface_runtime_cancel_denied",
        state: "denied_metadata_only",
      }),
    ]);
    expectMetadataOnly(runtime.getAdvisories(), telemetry);
  });

  it.each([
    ["assistant_prose_metadata", "allowed_for_speech_metadata"],
    ["tool_output", "blocked_from_speech"],
    ["file_content", "blocked_from_speech"],
    ["code_block", "blocked_from_speech"],
    ["personal_context", "blocked_from_speech"],
    ["audit_log", "blocked_from_speech"],
    ["runtime_output", "blocked_from_speech"],
    ["transcript", "blocked_from_speech"],
    ["unknown_restricted", "blocked_from_speech"],
  ] satisfies Array<[VoiceRestrictedContentClassification, string]>)(
    "freezes restricted content classification %s as %s",
    async (classification, decision) => {
      const { restrictedContent, telemetry } = createHarness();

      const result = await restrictedContent.evaluateDescriptor(
        withUnsafePayloads(
          descriptor({
            classification,
          }),
        ) as unknown as VoiceRestrictedContentDescriptor,
      );

      expect(result.record).toEqual(
        expect.objectContaining({
          classification,
          decision,
        }),
      );
      expectMetadataOnly(restrictedContent.getDecisions(), telemetry);
    },
  );

  it("freezes forbidden wiring scans for Phase 4F sources", () => {
    const source = [
      "src/lib/voice-streaming/runtime-boundary-coordinator.ts",
      "src/lib/voice-streaming/restricted-content-boundary.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/from\s+["']\.\.\/runtime-commands/i);
    expect(source).not.toMatch(/runtime-commands|executeRuntime|runTool/i);
    expect(source).not.toMatch(/from\s+["']\.\.\/approvals/i);
    expect(source).not.toMatch(/approveRuntime|executeApproval|bypass/i);
    expect(source).not.toMatch(/acceptApproval|grantApproval|submitApproval/i);
    expect(source).not.toMatch(/from\s+["'][^"']*(tts|audio|playback)/i);
    expect(source).not.toMatch(
      /synthesize|HTMLAudioElement|startPlayback|\.play\(/i,
    );
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(/OpenAI|chat\.completions|\/realtime/i);
    expect(source).not.toMatch(/cloud\s*(stream|streaming)|cloudStreaming/i);
    expect(source).not.toMatch(/microphone|navigator|mediaDevices/i);
    expect(source).not.toMatch(
      /keyboard|addEventListener|window\.|document\./i,
    );
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
  });
});
