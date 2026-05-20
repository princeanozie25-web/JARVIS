import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceRuntimeBoundaryCoordinator } from "./runtime-boundary-coordinator";
import type {
  VoiceApprovalAttemptCategory,
  VoiceOrchestrationTelemetryEvent,
  VoiceRuntimeBoundaryEvent,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness(activeSessionId?: string | null) {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const coordinator = new VoiceRuntimeBoundaryCoordinator({
    newId: createIdGenerator("runtime-advisory"),
    now: () => 6_000,
    getActiveSessionId:
      activeSessionId === undefined ? undefined : () => activeSessionId,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { coordinator, telemetry };
}

function boundaryEvent(
  input: Partial<VoiceRuntimeBoundaryEvent> = {},
): VoiceRuntimeBoundaryEvent {
  return {
    id: input.id ?? "runtime-event-1",
    type: input.type ?? "runtime_pending_approval_detected",
    sessionId: input.sessionId ?? "session-1",
    turnId: "turn-1",
    runtimeCallId: "runtime-call-1",
    approvalRequestId: "approval-request-1",
    toolName: "safe_tool_name",
    voiceTurnState: "waiting_for_send",
    ...input,
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
  expect(serialized).not.toContain("secret audio payload");
  expect(JSON.stringify(telemetry)).not.toContain("approval-request-1");

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
        "audio",
        "approvalRequestId",
        "approvalPayload",
      ]),
    );
  }
}

describe("VoiceRuntimeBoundaryCoordinator", () => {
  it("turns pending approval events into advisory-only metadata", async () => {
    const { coordinator, telemetry } = createHarness();

    const result = await coordinator.handleEvent(
      boundaryEvent({
        toolOutput: "secret tool output payload",
        fileContent: "secret file content payload",
        codeBlock: "secret code block payload",
        personalContext: "secret personal_context payload",
        auditLog: "secret audit log payload",
      } as unknown as Partial<VoiceRuntimeBoundaryEvent>),
    );

    expect(result).toEqual({
      ok: true,
      event: expect.objectContaining({
        id: "runtime-event-1",
        type: "runtime_pending_approval_detected",
      }),
      advisory: {
        id: "runtime-advisory-1",
        eventId: "runtime-event-1",
        eventType: "runtime_pending_approval_detected",
        sessionId: "session-1",
        createdAt: 6_000,
        action: "surface_approval_required",
        state: "waiting_for_on_screen_confirmation",
        operationId: "runtime-call-1",
        turnId: "turn-1",
        runtimeCallId: "runtime-call-1",
        approvalRequestId: "approval-request-1",
        toolName: "safe_tool_name",
        reason: undefined,
        orderingIssue: undefined,
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_event_received",
        runtimeBoundaryEventType: "runtime_pending_approval_detected",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_advisory_selected",
        runtimeBoundaryAction: "surface_approval_required",
        runtimeBoundaryState: "waiting_for_on_screen_confirmation",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_lifecycle_state_changed",
        previousRuntimeBoundaryState: "observed",
        nextRuntimeBoundaryState: "waiting_for_on_screen_confirmation",
      }),
    );
    expectMetadataOnly(coordinator.getAdvisories("session-1"), telemetry);
  });

  it("rejects voice approval attempts as no-execution metadata", async () => {
    const { coordinator, telemetry } = createHarness();

    const result = await coordinator.handleEvent(
      boundaryEvent({
        voiceApprovalAttempted: true,
        voiceApprovalAttemptCategory: "spoken_yes",
        voiceApprovalAttemptId: "voice-attempt-secret-id",
      }),
    );

    expect(result).toEqual({
      ok: false,
      event: expect.objectContaining({
        voiceApprovalAttempted: true,
      }),
      advisory: expect.objectContaining({
        action: "require_on_screen_confirmation",
        state: "rejected",
        reason: "voice_approval_rejected",
      }),
      reason: "voice_approval_rejected",
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_voice_approval_attempt_received",
        voiceApprovalAttemptCategory: "spoken_yes",
        success: false,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_voice_approval_rejected",
        voiceApprovalRefusalAction: "rejected_voice_approval",
        runtimeBoundaryReason: "voice_approval_rejected",
        success: false,
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_on_screen_confirmation_required",
        runtimeBoundaryAction: "require_on_screen_confirmation",
        success: false,
      }),
    );
    expect(coordinator.getVoiceApprovalRefusals()).toEqual([
      {
        id: "runtime-advisory-1",
        eventId: "runtime-event-1",
        sessionId: "session-1",
        createdAt: 6_000,
        category: "spoken_yes",
        action: "rejected_voice_approval",
        reason: "voice_approval_rejected",
        turnId: "turn-1",
        runtimeCallId: "runtime-call-1",
        toolName: "safe_tool_name",
      },
    ]);
    expectMetadataOnly(coordinator.getAdvisories(), telemetry);
  });

  it.each([
    "spoken_yes",
    "spoken_confirm",
    "spoken_approve",
    "inferred_consent",
    "ambiguous_voice_response",
    "replayed_voice_response",
  ] satisfies VoiceApprovalAttemptCategory[])(
    "refuses %s voice approval attempts",
    async (category) => {
      const { coordinator, telemetry } = createHarness();

      const result = await coordinator.handleEvent(
        boundaryEvent({
          id: `runtime-event-${category}`,
          voiceApprovalAttemptCategory: category,
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        advisory: {
          action: "require_on_screen_confirmation",
          state: "rejected",
          reason: "voice_approval_rejected",
        },
        reason: "voice_approval_rejected",
      });
      expect(coordinator.getVoiceApprovalRefusals()).toEqual([
        expect.objectContaining({
          category,
          action: "rejected_voice_approval",
          reason: "voice_approval_rejected",
        }),
      ]);
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_runtime_boundary_voice_approval_rejected",
          voiceApprovalAttemptCategory: category,
          voiceApprovalRefusalAction: "rejected_voice_approval",
        }),
      );
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_runtime_boundary_on_screen_confirmation_required",
          runtimeBoundaryAction: "require_on_screen_confirmation",
        }),
      );
    },
  );

  it("keeps repeated voice approval attempts idempotent", async () => {
    const { coordinator, telemetry } = createHarness();
    const event = boundaryEvent({
      voiceApprovalAttemptCategory: "spoken_confirm",
    });

    const first = await coordinator.handleEvent(event);
    const repeated = await coordinator.handleEvent(event);

    expect(first).toMatchObject({
      ok: false,
      reason: "voice_approval_rejected",
    });
    expect(repeated).toMatchObject({
      ok: true,
      advisory: {
        action: "no_op",
        state: "no_op",
      },
    });
    expect(coordinator.getVoiceApprovalRefusals()).toHaveLength(1);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_voice_approval_noop",
        voiceApprovalAttemptCategory: "spoken_confirm",
        voiceApprovalRefusalAction: "no_op",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_duplicate_noop",
        runtimeBoundaryOrderingIssue: "duplicate",
      }),
    );
  });

  it("keeps runtime cancel requests advisory-only and idempotent", async () => {
    const { coordinator, telemetry } = createHarness();

    const first = await coordinator.handleEvent(
      boundaryEvent({
        type: "runtime_cancel_requested",
      }),
    );
    const repeated = await coordinator.handleEvent(
      boundaryEvent({
        type: "runtime_cancel_requested",
      }),
    );

    expect(first).toMatchObject({
      ok: true,
      advisory: {
        action: "request_runtime_cancel_advisory",
        state: "advisory_created",
      },
    });
    expect(repeated).toMatchObject({
      ok: true,
      advisory: {
        action: "no_op",
        state: "no_op",
      },
    });
    expect(coordinator.getAdvisories("session-1")).toEqual([
      expect.objectContaining({
        action: "request_runtime_cancel_advisory",
      }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_duplicate_noop",
        runtimeBoundaryAction: "no_op",
        runtimeBoundaryOrderingIssue: "duplicate",
      }),
    );
  });

  it("maps tool and runtime lifecycle events to safe advisory actions", async () => {
    const { coordinator, telemetry } = createHarness();

    const eventTypes: Array<
      [VoiceRuntimeBoundaryEvent["type"], string, string, string]
    > = [
      [
        "runtime_tool_started",
        "surface_tool_running",
        "runtime-event-started",
        "advisory_created",
      ],
      [
        "runtime_tool_completed",
        "surface_tool_completed",
        "runtime-event-completed",
        "completed_metadata_only",
      ],
      [
        "runtime_tool_failed",
        "surface_tool_failed",
        "runtime-event-failed",
        "failed_metadata_only",
      ],
      [
        "runtime_cancel_denied",
        "surface_runtime_cancel_denied",
        "runtime-event-cancel-denied",
        "denied_metadata_only",
      ],
      [
        "runtime_cancel_acknowledged",
        "surface_runtime_cancel_acknowledged",
        "runtime-event-cancel-acknowledged",
        "acknowledged_metadata_only",
      ],
    ];

    for (const [type, action, id, state] of eventTypes) {
      await expect(
        coordinator.handleEvent(boundaryEvent({ id, type })),
      ).resolves.toMatchObject({
        ok: true,
        advisory: { action, state },
      });
    }

    expect(coordinator.getAdvisories("session-1")).toHaveLength(5);
    expectMetadataOnly(coordinator.getAdvisories(), telemetry);
  });

  it("orders normal tool lifecycle metadata deterministically per runtime operation", async () => {
    const { coordinator, telemetry } = createHarness();

    await coordinator.handleEvent(
      boundaryEvent({
        id: "runtime-event-started",
        type: "runtime_tool_started",
        runtimeCallId: "runtime-call-ordered",
      }),
    );
    await coordinator.handleEvent(
      boundaryEvent({
        id: "runtime-event-completed",
        type: "runtime_tool_completed",
        runtimeCallId: "runtime-call-ordered",
      }),
    );

    expect(coordinator.getAdvisories("session-1")).toEqual([
      expect.objectContaining({
        operationId: "runtime-call-ordered",
        eventType: "runtime_tool_started",
        state: "advisory_created",
      }),
      expect.objectContaining({
        operationId: "runtime-call-ordered",
        eventType: "runtime_tool_completed",
        state: "completed_metadata_only",
      }),
    ]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_lifecycle_state_changed",
        previousRuntimeBoundaryState: "advisory_created",
        nextRuntimeBoundaryState: "completed_metadata_only",
      }),
    );
  });

  it("suppresses duplicate lifecycle events by runtime operation and type", async () => {
    const { coordinator, telemetry } = createHarness();

    const first = await coordinator.handleEvent(
      boundaryEvent({
        id: "runtime-event-started-1",
        type: "runtime_tool_started",
        runtimeCallId: "runtime-call-duplicate",
      }),
    );
    const duplicate = await coordinator.handleEvent(
      boundaryEvent({
        id: "runtime-event-started-2",
        type: "runtime_tool_started",
        runtimeCallId: "runtime-call-duplicate",
      }),
    );

    expect(first).toMatchObject({
      ok: true,
      advisory: { state: "advisory_created" },
    });
    expect(duplicate).toMatchObject({
      ok: true,
      advisory: {
        action: "no_op",
        state: "no_op",
        orderingIssue: "duplicate",
      },
    });
    expect(coordinator.getAdvisories("session-1")).toHaveLength(1);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_duplicate_noop",
        runtimeBoundaryOrderingIssue: "duplicate",
      }),
    );
  });

  it("observes out-of-order lifecycle events without execution side effects", async () => {
    const { coordinator, telemetry } = createHarness();

    const completedFirst = await coordinator.handleEvent(
      boundaryEvent({
        id: "runtime-event-completed-first",
        type: "runtime_tool_completed",
        runtimeCallId: "runtime-call-out-of-order",
      }),
    );
    const cancelAckFirst = await coordinator.handleEvent(
      boundaryEvent({
        id: "runtime-event-cancel-ack-first",
        type: "runtime_cancel_acknowledged",
        runtimeCallId: "runtime-call-cancel-out-of-order",
      }),
    );

    expect(completedFirst).toMatchObject({
      ok: true,
      advisory: {
        state: "completed_metadata_only",
        orderingIssue: "out_of_order",
      },
    });
    expect(cancelAckFirst).toMatchObject({
      ok: true,
      advisory: {
        state: "acknowledged_metadata_only",
        orderingIssue: "out_of_order",
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_out_of_order_observed",
        runtimeBoundaryOrderingIssue: "out_of_order",
        success: false,
      }),
    );
    expectMetadataOnly(coordinator.getAdvisories(), telemetry);
  });

  it("rejects stale non-active session events", async () => {
    const { coordinator, telemetry } = createHarness("active-session");

    const result = await coordinator.handleEvent(
      boundaryEvent({
        sessionId: "stale-session",
        id: "runtime-event-stale",
        type: "runtime_tool_started",
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "stale_session_rejected",
      advisory: {
        action: "no_op",
        state: "rejected",
        reason: "stale_session_rejected",
        orderingIssue: "stale_session",
      },
    });
    expect(coordinator.getAdvisories()).toEqual([]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_stale_rejected",
        runtimeBoundaryReason: "stale_session_rejected",
        runtimeBoundaryOrderingIssue: "stale_session",
        success: false,
      }),
    );
  });

  it("does not import runtime or approval execution modules", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/voice-streaming/runtime-boundary-coordinator.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/runtime-commands|executeRuntime|runTool/i);
    expect(source).not.toMatch(/approveRuntime|executeApproval|bypass/i);
    expect(source).not.toMatch(/acceptApproval|grantApproval|submitApproval/i);
    expect(source).not.toMatch(/from\s+["']\.\.\/runtime-commands/i);
    expect(source).not.toMatch(/from\s+["']\.\.\/approvals/i);
  });

  it("does not introduce autoplay, chat, cloud, mic, keyboard, UI, browser, or audio wiring", () => {
    const source = [
      "src/lib/voice-streaming/runtime-boundary-coordinator.ts",
      "src/lib/voice-streaming/types.ts",
      "src/lib/voice-streaming/index.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n")
      .replace(/canAutoplay/g, "");

    expect(source).not.toMatch(/microphone|navigator|mediaDevices/i);
    expect(source).not.toMatch(
      /keyboard|addEventListener|window\.|document\./i,
    );
    expect(source).not.toMatch(/autoplay|HTMLAudioElement|\.play\(/i);
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(/OpenAI|chat\.completions|\/realtime/i);
    expect(source).not.toMatch(/cloud\s*(stream|streaming)|cloudStreaming/i);
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
  });
});
