import type {
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

  constructor(private readonly opts: VoiceRuntimeBoundaryCoordinatorOptions) {}

  async handleEvent(
    event: VoiceRuntimeBoundaryEvent,
  ): Promise<VoiceRuntimeBoundaryCoordinatorResult> {
    const safeEvent = copyRuntimeBoundaryEvent(event);
    await this.emit(safeEvent, "voice_runtime_boundary_event_received", true);

    const existing = this.advisoryByEventId.get(safeEvent.id);
    if (existing) {
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

    if (safeEvent.voiceApprovalAttempted) {
      const advisory = this.createAdvisory(
        safeEvent,
        "reject_voice_approval",
        "rejected",
        "voice_approval_rejected",
      );
      this.advisoryByEventId.set(safeEvent.id, advisory);
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_voice_approval_rejected",
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
      approvalRequestId: event.approvalRequestId,
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
  };
}

function copyAdvisoryRecord(
  record: VoiceRuntimeBoundaryAdvisoryRecord,
): VoiceRuntimeBoundaryAdvisoryRecord {
  return { ...record };
}
