import type {
  VoiceApprovalAttemptCategory,
  VoiceApprovalRefusalRecord,
  VoiceOrchestrationTelemetryEvent,
  VoiceRuntimeBoundaryAdvisoryAction,
  VoiceRuntimeBoundaryAdvisoryRecord,
  VoiceRuntimeBoundaryAdvisoryState,
  VoiceRuntimeBoundaryCoordinatorResult,
  VoiceRuntimeBoundaryEvent,
  VoiceRuntimeBoundaryEventType,
  VoiceRuntimeBoundaryOrderingIssue,
  VoiceRuntimeBoundaryRejectionReason,
} from "./types";

export interface VoiceRuntimeBoundaryCoordinatorOptions {
  now?: () => number;
  newId?: () => string;
  getActiveSessionId?: () => string | null;
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
  private readonly stateByOperationId = new Map<
    string,
    VoiceRuntimeBoundaryAdvisoryState
  >();
  private readonly seenTypesByOperationId = new Map<
    string,
    Set<VoiceRuntimeBoundaryEventType>
  >();

  constructor(private readonly opts: VoiceRuntimeBoundaryCoordinatorOptions) {}

  async handleEvent(
    event: VoiceRuntimeBoundaryEvent,
  ): Promise<VoiceRuntimeBoundaryCoordinatorResult> {
    const safeEvent = copyRuntimeBoundaryEvent(event);
    await this.emit(safeEvent, "voice_runtime_boundary_event_received", true);

    if (!this.isActiveSession(safeEvent)) {
      const advisory = this.createAdvisory(
        safeEvent,
        "no_op",
        "rejected",
        "stale_session_rejected",
        "stale_session",
      );
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_stale_rejected",
        advisory,
        false,
      );
      return {
        ok: false,
        event: safeEvent,
        advisory,
        reason: "stale_session_rejected",
      };
    }

    const duplicate = this.findDuplicate(safeEvent);
    if (duplicate) {
      await this.emitApprovalAttemptNoop(safeEvent);
      const noop = this.createAdvisory(
        safeEvent,
        "no_op",
        "no_op",
        duplicate.reason,
        "duplicate",
      );
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_duplicate_noop",
        noop,
        true,
      );
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_noop",
        noop,
        true,
      );
      return { ok: true, event: safeEvent, advisory: noop };
    }

    const operationId = operationIdForEvent(safeEvent);
    const previousState =
      this.stateByOperationId.get(operationId) ?? "observed";
    const orderingIssue = this.detectOrderingIssue(safeEvent);

    if (orderingIssue === "out_of_order") {
      const observed = this.createAdvisory(
        safeEvent,
        advisoryActionForEvent(safeEvent),
        previousState,
        undefined,
        orderingIssue,
      );
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_out_of_order_observed",
        observed,
        false,
      );
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
          runtimeBoundaryOperationId: operationId,
        },
      );
      const refusal = this.createApprovalRefusal(safeEvent, category);
      this.approvalRefusalByEventId.set(safeEvent.id, refusal);
      const advisory = this.createAdvisory(
        safeEvent,
        "require_on_screen_confirmation",
        "rejected",
        "voice_approval_rejected",
        orderingIssue,
      );
      this.storeAdvisory(safeEvent, advisory);
      await this.emitApprovalRefusal(safeEvent, refusal);
      await this.emitAdvisory(
        safeEvent,
        "voice_runtime_boundary_on_screen_confirmation_required",
        advisory,
        false,
      );
      await this.emitLifecycleStateChanged(safeEvent, advisory, previousState);
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
      advisoryStateForEvent(safeEvent),
      undefined,
      orderingIssue,
    );
    this.storeAdvisory(safeEvent, advisory);
    await this.emitAdvisory(
      safeEvent,
      "voice_runtime_boundary_advisory_selected",
      advisory,
      true,
    );
    await this.emitLifecycleStateChanged(safeEvent, advisory, previousState);
    return { ok: true, event: safeEvent, advisory };
  }

  getAdvisories(sessionId?: string): VoiceRuntimeBoundaryAdvisoryRecord[] {
    return Array.from(this.advisoryByEventId.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .sort(compareAdvisoryRecords)
      .map(copyAdvisoryRecord);
  }

  getVoiceApprovalRefusals(sessionId?: string): VoiceApprovalRefusalRecord[] {
    return Array.from(this.approvalRefusalByEventId.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyApprovalRefusalRecord);
  }

  private storeAdvisory(
    event: VoiceRuntimeBoundaryEvent,
    advisory: VoiceRuntimeBoundaryAdvisoryRecord,
  ): void {
    this.advisoryByEventId.set(event.id, advisory);
    this.stateByOperationId.set(advisory.operationId, advisory.state);
    const seenTypes =
      this.seenTypesByOperationId.get(advisory.operationId) ?? new Set();
    seenTypes.add(event.type);
    this.seenTypesByOperationId.set(advisory.operationId, seenTypes);
  }

  private createAdvisory(
    event: VoiceRuntimeBoundaryEvent,
    action: VoiceRuntimeBoundaryAdvisoryAction,
    state: VoiceRuntimeBoundaryAdvisoryState,
    reason?: VoiceRuntimeBoundaryRejectionReason,
    orderingIssue?: VoiceRuntimeBoundaryOrderingIssue,
  ): VoiceRuntimeBoundaryAdvisoryRecord {
    return {
      id: this.newId(),
      eventId: event.id,
      eventType: event.type,
      sessionId: event.sessionId,
      createdAt: this.now(),
      action,
      state,
      operationId: operationIdForEvent(event),
      turnId: event.turnId,
      runtimeCallId: event.runtimeCallId,
      approvalRequestId: event.approvalRequestId,
      toolName: event.toolName,
      reason,
      orderingIssue,
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

  private findDuplicate(
    event: VoiceRuntimeBoundaryEvent,
  ): VoiceRuntimeBoundaryAdvisoryRecord | undefined {
    const existing = this.advisoryByEventId.get(event.id);
    if (existing) return existing;
    const seenTypes = this.seenTypesByOperationId.get(
      operationIdForEvent(event),
    );
    if (!seenTypes?.has(event.type)) return undefined;
    return this.createAdvisory(event, "no_op", "no_op", undefined, "duplicate");
  }

  private detectOrderingIssue(
    event: VoiceRuntimeBoundaryEvent,
  ): VoiceRuntimeBoundaryOrderingIssue | undefined {
    const seenTypes = this.seenTypesByOperationId.get(
      operationIdForEvent(event),
    );
    if (
      (event.type === "runtime_tool_completed" ||
        event.type === "runtime_tool_failed") &&
      !seenTypes?.has("runtime_tool_started")
    ) {
      return "out_of_order";
    }
    if (
      (event.type === "runtime_cancel_acknowledged" ||
        event.type === "runtime_cancel_denied") &&
      !seenTypes?.has("runtime_cancel_requested")
    ) {
      return "out_of_order";
    }
    return undefined;
  }

  private isActiveSession(event: VoiceRuntimeBoundaryEvent): boolean {
    const activeSessionId = this.opts.getActiveSessionId?.();
    return activeSessionId === undefined || activeSessionId === null
      ? true
      : activeSessionId === event.sessionId;
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
        runtimeBoundaryOperationId: operationIdForEvent(event),
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
      runtimeBoundaryOperationId: operationIdForEvent(event),
      runtimeBoundaryOrderingIssue: "duplicate",
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
      runtimeBoundaryOperationId: advisory.operationId,
      runtimeBoundaryOrderingIssue: advisory.orderingIssue,
    });
  }

  private async emitLifecycleStateChanged(
    event: VoiceRuntimeBoundaryEvent,
    advisory: VoiceRuntimeBoundaryAdvisoryRecord,
    previousState: VoiceRuntimeBoundaryAdvisoryState,
  ): Promise<void> {
    await this.emit(
      event,
      "voice_runtime_boundary_lifecycle_state_changed",
      advisory.state !== "rejected",
      {
        runtimeBoundaryAdvisoryId: advisory.id,
        runtimeBoundaryAction: advisory.action,
        previousRuntimeBoundaryState: previousState,
        nextRuntimeBoundaryState: advisory.state,
        runtimeBoundaryState: advisory.state,
        runtimeBoundaryReason: advisory.reason,
        runtimeBoundaryOperationId: advisory.operationId,
        runtimeBoundaryOrderingIssue: advisory.orderingIssue,
      },
    );
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
      runtimeBoundaryOperationId: operationIdForEvent(event),
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

function advisoryStateForEvent(
  event: VoiceRuntimeBoundaryEvent,
): VoiceRuntimeBoundaryAdvisoryState {
  if (event.type === "runtime_pending_approval_detected") {
    return "waiting_for_on_screen_confirmation";
  }
  if (event.type === "runtime_tool_completed") {
    return "completed_metadata_only";
  }
  if (event.type === "runtime_tool_failed") return "failed_metadata_only";
  if (event.type === "runtime_cancel_denied") return "denied_metadata_only";
  if (event.type === "runtime_cancel_acknowledged") {
    return "acknowledged_metadata_only";
  }
  return "advisory_created";
}

function operationIdForEvent(event: VoiceRuntimeBoundaryEvent): string {
  return event.runtimeCallId ?? `${event.sessionId}:${event.type}:${event.id}`;
}

function lifecycleRank(record: VoiceRuntimeBoundaryAdvisoryRecord): number {
  if (record.eventType === "runtime_pending_approval_detected") return 10;
  if (record.eventType === "runtime_tool_started") return 20;
  if (record.eventType === "runtime_cancel_requested") return 20;
  if (record.eventType === "runtime_tool_completed") return 30;
  if (record.eventType === "runtime_tool_failed") return 30;
  if (record.eventType === "runtime_cancel_denied") return 30;
  if (record.eventType === "runtime_cancel_acknowledged") return 30;
  return 99;
}

function compareAdvisoryRecords(
  left: VoiceRuntimeBoundaryAdvisoryRecord,
  right: VoiceRuntimeBoundaryAdvisoryRecord,
): number {
  return (
    left.sessionId.localeCompare(right.sessionId) ||
    left.operationId.localeCompare(right.operationId) ||
    lifecycleRank(left) - lifecycleRank(right) ||
    left.createdAt - right.createdAt ||
    left.id.localeCompare(right.id)
  );
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
