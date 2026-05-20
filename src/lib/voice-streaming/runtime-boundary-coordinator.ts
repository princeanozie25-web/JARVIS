import type {
  VoiceApprovalAttemptCategory,
  VoiceApprovalRefusalRecord,
  VoiceOrchestrationTelemetryEvent,
  VoiceRuntimeBoundaryAdvisoryAction,
  VoiceRuntimeBoundaryAdvisoryRecord,
  VoiceRuntimeBoundaryAdvisoryState,
  VoiceRuntimeBoundaryCoordinatorResult,
  VoiceRuntimeBoundaryEvent,
  VoiceRuntimeBoundaryRejectionReason,
} from "./types";

export interface VoiceRuntimeBoundaryCoordinatorOptions {
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

export class VoiceRuntimeBoundaryCoordinator {
  private readonly advisoryByEventId = new Map<
    string,
    VoiceRuntimeBoundaryAdvisoryRecord
  >();
  private readonly approvalRefusalByEventId = new Map<
    string,
    VoiceApprovalRefusalRecord
  >();

  constructor(private readonly opts: VoiceRuntimeBoundaryCoordinatorOptions) {}

  async handleEvent(
    event: VoiceRuntimeBoundaryEvent,
  ): Promise<VoiceRuntimeBoundaryCoordinatorResult> {
    const safeEvent = copyRuntimeBoundaryEvent(event);
    await this.emit(safeEvent, "voice_runtime_boundary_event_received", true);

    const existing = this.advisoryByEventId.get(safeEvent.id);
    if (existing) {
      await this.emitApprovalAttemptNoop(safeEvent);
      const noop = this.createAdvisory(
        safeEvent,
        "no_op",
        "noop",
        existing.reason,
      );
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_noop",
        noop,
        true,
      );
      return { ok: true, event: safeEvent, advisory: noop };
    }

    if (isVoiceApprovalAttempt(safeEvent)) {
      const category =
        safeEvent.voiceApprovalAttemptCategory ?? "ambiguous_voice_response";
      await this.emit(
        safeEvent,
        "voice_runtime_boundary_voice_approval_attempt_received",
        false,
        {
          voiceApprovalAttemptCategory: category,
        },
      );
      const refusal = this.createApprovalRefusal(safeEvent, category);
      this.approvalRefusalByEventId.set(safeEvent.id, refusal);
      const advisory = this.createAdvisory(
        safeEvent,
        "require_on_screen_confirmation",
        "rejected",
        "voice_approval_rejected",
      );
      this.advisoryByEventId.set(safeEvent.id, advisory);
      await this.emitApprovalRefusal(safeEvent, refusal);
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_on_screen_confirmation_required",
        advisory,
        false,
      );
      return {
        ok: false,
        event: safeEvent,
        advisory,
        reason: "voice_approval_rejected",
      };
    }

    const advisory = this.createAdvisory(
      safeEvent,
      advisoryActionForEvent(safeEvent),
      "advisory",
    );
    this.advisoryByEventId.set(safeEvent.id, advisory);
    await this.emitAdvisory(
      safeEvent,
      "voice_runtime_boundary_advisory_selected",
      advisory,
      true,
    );
    return { ok: true, event: safeEvent, advisory };
  }

  getAdvisories(sessionId?: string): VoiceRuntimeBoundaryAdvisoryRecord[] {
    return Array.from(this.advisoryByEventId.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyAdvisoryRecord);
  }

  getVoiceApprovalRefusals(sessionId?: string): VoiceApprovalRefusalRecord[] {
    return Array.from(this.approvalRefusalByEventId.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyApprovalRefusalRecord);
  }

  private createAdvisory(
    event: VoiceRuntimeBoundaryEvent,
    action: VoiceRuntimeBoundaryAdvisoryAction,
    state: VoiceRuntimeBoundaryAdvisoryState,
    reason?: VoiceRuntimeBoundaryRejectionReason,
  ): VoiceRuntimeBoundaryAdvisoryRecord {
    return {
      id: this.newId(),
      eventId: event.id,
      eventType: event.type,
      sessionId: event.sessionId,
      createdAt: this.now(),
      action,
      state,
      turnId: event.turnId,
      runtimeCallId: event.runtimeCallId,
      approvalRequestId: event.approvalRequestId,
      toolName: event.toolName,
      reason,
    };
  }

  private createApprovalRefusal(
    event: VoiceRuntimeBoundaryEvent,
    category: VoiceApprovalAttemptCategory,
  ): VoiceApprovalRefusalRecord {
    return {
      id: this.newId(),
      eventId: event.id,
      sessionId: event.sessionId,
      createdAt: this.now(),
      category,
      action: "rejected_voice_approval",
      reason: "voice_approval_rejected",
      turnId: event.turnId,
      runtimeCallId: event.runtimeCallId,
      toolName: event.toolName,
    };
  }

  private async emitApprovalRefusal(
    event: VoiceRuntimeBoundaryEvent,
    refusal: VoiceApprovalRefusalRecord,
  ): Promise<void> {
    await this.emit(
      event,
      "voice_runtime_boundary_voice_approval_rejected",
      false,
      {
        voiceApprovalAttemptCategory: refusal.category,
        voiceApprovalRefusalId: refusal.id,
        voiceApprovalRefusalAction: refusal.action,
        runtimeBoundaryReason: refusal.reason,
      },
    );
  }

  private async emitApprovalAttemptNoop(
    event: VoiceRuntimeBoundaryEvent,
  ): Promise<void> {
    if (!isVoiceApprovalAttempt(event)) return;
    await this.emit(event, "voice_runtime_boundary_voice_approval_noop", true, {
      voiceApprovalAttemptCategory:
        event.voiceApprovalAttemptCategory ?? "ambiguous_voice_response",
      voiceApprovalRefusalAction: "no_op",
      runtimeBoundaryReason: "voice_approval_rejected",
    });
  }

  private async emitAdvisory(
    event: VoiceRuntimeBoundaryEvent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    advisory: VoiceRuntimeBoundaryAdvisoryRecord,
    success: boolean,
  ): Promise<void> {
    await this.emit(event, eventType, success, {
      runtimeBoundaryAdvisoryId: advisory.id,
      runtimeBoundaryAction: advisory.action,
      runtimeBoundaryState: advisory.state,
      runtimeBoundaryReason: advisory.reason,
    });
  }

  private async emit(
    event: VoiceRuntimeBoundaryEvent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
      eventType,
      sessionId: event.sessionId,
      state: event.voiceTurnState ?? "waiting_for_send",
      success,
      turnId: event.turnId,
      runtimeBoundaryEventId: event.id,
      runtimeBoundaryEventType: event.type,
      runtimeCallId: event.runtimeCallId,
      toolName: event.toolName,
      ...fields,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `runtime-boundary-${this.now()}`;
  }
}

function advisoryActionForEvent(
  event: VoiceRuntimeBoundaryEvent,
): VoiceRuntimeBoundaryAdvisoryAction {
  if (event.type === "runtime_pending_approval_detected") {
    return "surface_approval_required";
  }
  if (event.type === "runtime_tool_started") return "surface_tool_running";
  if (event.type === "runtime_tool_completed") return "surface_tool_completed";
  if (event.type === "runtime_tool_failed") return "surface_tool_failed";
  if (event.type === "runtime_cancel_requested") {
    return "request_runtime_cancel_advisory";
  }
  if (event.type === "runtime_cancel_denied") {
    return "surface_runtime_cancel_denied";
  }
  return "surface_runtime_cancel_acknowledged";
}

function copyRuntimeBoundaryEvent(
  event: VoiceRuntimeBoundaryEvent,
): VoiceRuntimeBoundaryEvent {
  return {
    id: event.id,
    type: event.type,
    sessionId: event.sessionId,
    createdAt: event.createdAt,
    turnId: event.turnId,
    runtimeCallId: event.runtimeCallId,
    approvalRequestId: event.approvalRequestId,
    toolName: event.toolName,
    voiceTurnState: event.voiceTurnState,
    voiceApprovalAttempted: event.voiceApprovalAttempted,
    voiceApprovalAttemptCategory: event.voiceApprovalAttemptCategory,
    voiceApprovalAttemptId: event.voiceApprovalAttemptId,
  };
}

function copyAdvisoryRecord(
  record: VoiceRuntimeBoundaryAdvisoryRecord,
): VoiceRuntimeBoundaryAdvisoryRecord {
  return { ...record };
}

function copyApprovalRefusalRecord(
  record: VoiceApprovalRefusalRecord,
): VoiceApprovalRefusalRecord {
  return { ...record };
}

function isVoiceApprovalAttempt(event: VoiceRuntimeBoundaryEvent): boolean {
  return (
    event.voiceApprovalAttempted === true ||
    event.voiceApprovalAttemptCategory !== undefined
  );
}
