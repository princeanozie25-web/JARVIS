import type { VoiceRealtimeOrchestrationPipeline } from "./pipeline";
import type { VoiceOrchestrationSupervisor } from "./supervisor";
import { emitMetadataOnlyVoiceTelemetry } from "./telemetry-hygiene";
import type {
  VoiceBargeInAction,
  VoiceBargeInCoordinatorResult,
  VoiceBargeInIntent,
  VoiceBargeInRejectionReason,
  VoiceBargeInState,
  VoiceCaptureRearmBlockedReason,
  VoiceCaptureRearmIntentRecord,
  VoiceCaptureRearmResultRecord,
  VoiceCaptureRearmState,
  VoiceChunkReadinessRecord,
  VoiceOrchestrationTelemetryEvent,
  VoiceTurnPreemptionRecord,
  VoiceTurnState,
} from "./types";

export interface VoiceBargeInCoordinatorOptions {
  supervisor: VoiceOrchestrationSupervisor;
  pipeline: Pick<
    VoiceRealtimeOrchestrationPipeline,
    "cancelSession" | "interrupt" | "getPlaybackIntents" | "getChunkReadiness"
  >;
  now?: () => number;
  newId?: () => string;
  emitTelemetry?: (
    event: VoiceOrchestrationTelemetryEvent,
  ) => void | Promise<void>;
}

interface BargeInTransitionPlan {
  actions: VoiceBargeInAction[];
  states: VoiceBargeInState[];
  terminalMethod: "cancel" | "interrupt";
}

const TERMINAL_TURN_STATES = new Set<VoiceTurnState>([
  "interrupted",
  "cancelled",
  "completed",
  "failed",
]);

const TERMINAL_BARGE_IN_STATES = new Set<VoiceBargeInState>([
  "completed",
  "failed",
]);

export class VoiceBargeInCoordinator {
  private readonly stateBySession = new Map<string, VoiceBargeInState>();
  private readonly preemptionByTurn = new Map<
    string,
    VoiceTurnPreemptionRecord
  >();
  private readonly captureRearmIntentByTurn = new Map<
    string,
    VoiceCaptureRearmIntentRecord
  >();
  private readonly captureRearmResultByTurn = new Map<
    string,
    VoiceCaptureRearmResultRecord
  >();
  private readonly terminalTransitionInFlight = new Set<string>();

  constructor(private readonly opts: VoiceBargeInCoordinatorOptions) {}

  async handleIntent(
    intent: VoiceBargeInIntent,
  ): Promise<VoiceBargeInCoordinatorResult> {
    const session = this.opts.supervisor.getSession(intent.sessionId);
    const currentState = this.getState(intent.sessionId);
    const rejection = this.getRejectionReason(
      intent,
      currentState,
      session?.state,
    );
    const ownsTerminalTransition = rejection === null;
    if (ownsTerminalTransition) {
      this.terminalTransitionInFlight.add(intent.sessionId);
    }

    await this.emit(intent, "voice_barge_in_intent_received", true, {
      state: session?.state ?? "failed",
      bargeInState: currentState,
    });

    if (rejection) {
      await this.rejectIntent(intent, rejection, session?.state, currentState);
      await this.handleRejectedPreemption(
        intent,
        rejection,
        session?.state ?? "failed",
      );
      await this.handleRejectedCaptureRearm(
        intent,
        rejection,
        session?.state ?? "failed",
      );
      return {
        ok: false,
        intent: copyIntent(intent),
        reason: rejection,
        actions: ["no_op"],
        state: this.getState(intent.sessionId),
      };
    }

    const plan = transitionPlanForIntent(intent);
    try {
      await this.runTransitionPlan(intent, plan, session?.state ?? "failed");
    } catch {
      if (intentPreparesNewCapture(intent)) {
        await this.failCaptureRearm(
          intent,
          session?.state ?? "failed",
          "coordinator_failed",
        );
      }
      await this.transitionState(
        intent,
        this.getState(intent.sessionId),
        "failed",
        session?.state ?? "failed",
        false,
      );
      await this.emit(intent, "voice_barge_in_transition_failed", false, {
        state: session?.state ?? "failed",
        bargeInState: "failed",
        bargeInRejectionReason: "transition_failed",
      });
      return {
        ok: false,
        intent: copyIntent(intent),
        reason: "transition_failed",
        actions: ["no_op"],
        state: "failed",
      };
    } finally {
      if (ownsTerminalTransition) {
        this.terminalTransitionInFlight.delete(intent.sessionId);
      }
    }

    return {
      ok: true,
      intent: copyIntent(intent),
      actions: plan.actions,
      state: this.getState(intent.sessionId),
    };
  }

  getState(sessionId: string): VoiceBargeInState {
    return this.stateBySession.get(sessionId) ?? "idle";
  }

  getPreemptionRecords(sessionId?: string): VoiceTurnPreemptionRecord[] {
    return Array.from(this.preemptionByTurn.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyPreemptionRecord);
  }

  getPreemptionRecord(turnId: string): VoiceTurnPreemptionRecord | null {
    const record = this.preemptionByTurn.get(turnId);
    return record ? copyPreemptionRecord(record) : null;
  }

  getCaptureRearmIntentRecords(
    sessionId?: string,
  ): VoiceCaptureRearmIntentRecord[] {
    return Array.from(this.captureRearmIntentByTurn.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyCaptureRearmIntentRecord);
  }

  getCaptureRearmResultRecords(
    sessionId?: string,
  ): VoiceCaptureRearmResultRecord[] {
    return Array.from(this.captureRearmResultByTurn.values())
      .filter(
        (record) => sessionId === undefined || record.sessionId === sessionId,
      )
      .map(copyCaptureRearmResultRecord);
  }

  getCaptureRearmState(turnId: string): VoiceCaptureRearmState {
    return (
      this.captureRearmResultByTurn.get(turnId)?.state ??
      this.captureRearmIntentByTurn.get(turnId)?.state ??
      "not_requested"
    );
  }

  private async runTransitionPlan(
    intent: VoiceBargeInIntent,
    plan: BargeInTransitionPlan,
    turnState: VoiceTurnState,
  ): Promise<void> {
    let current = this.getState(intent.sessionId);
    for (const next of plan.states) {
      await this.transitionState(intent, current, next, turnState, true);
      current = next;
    }

    for (const action of plan.actions) {
      await this.emitAction(intent, action, turnState, true);
    }

    await this.recordPreemption(intent, turnState);
    if (plan.actions.includes("prepare_for_new_capture")) {
      await this.requestCaptureRearm(intent, turnState);
    }

    if (plan.terminalMethod === "cancel") {
      await this.opts.pipeline.cancelSession(intent.sessionId);
    } else {
      await this.opts.pipeline.interrupt(intent.sessionId);
    }

    await this.transitionState(
      intent,
      this.getState(intent.sessionId),
      "completed",
      turnState,
      true,
    );
  }

  private getRejectionReason(
    intent: VoiceBargeInIntent,
    currentState: VoiceBargeInState,
    sessionState: VoiceTurnState | undefined,
  ): VoiceBargeInRejectionReason | null {
    if (TERMINAL_BARGE_IN_STATES.has(currentState)) return "state_terminal";
    if (this.terminalTransitionInFlight.has(intent.sessionId)) {
      return "terminal_transition_in_flight";
    }
    if (!isValidIntentFromState(intent, currentState)) {
      return "invalid_transition";
    }
    if (!sessionState) return "session_not_found";
    if (this.opts.supervisor.getState().activeSessionId !== intent.sessionId) {
      return "stale_turn";
    }
    if (TERMINAL_TURN_STATES.has(sessionState)) return "session_terminal";
    return null;
  }

  private async rejectIntent(
    intent: VoiceBargeInIntent,
    reason: VoiceBargeInRejectionReason,
    turnState: VoiceTurnState | undefined,
    currentState: VoiceBargeInState,
  ): Promise<void> {
    const eventType =
      reason === "state_terminal"
        ? "voice_barge_in_terminal_noop"
        : reason === "invalid_transition"
          ? "voice_barge_in_invalid_transition"
          : "voice_barge_in_intent_rejected";
    await this.emit(intent, eventType, false, {
      state: turnState ?? "failed",
      bargeInState: currentState,
      bargeInRejectionReason: reason,
    });
    await this.emitAction(intent, "no_op", turnState ?? "failed", false);
  }

  private async recordPreemption(
    intent: VoiceBargeInIntent,
    state: VoiceTurnState,
  ): Promise<VoiceTurnPreemptionRecord> {
    const turnId = preemptionTurnId(intent);
    const existing = this.preemptionByTurn.get(turnId);
    if (existing) {
      await this.emitPreemption(
        intent,
        "voice_turn_preemption_noop",
        existing,
        {
          state,
          success: true,
        },
      );
      return copyPreemptionRecord(existing);
    }

    const playbackIntents = this.opts.pipeline.getPlaybackIntents(
      intent.sessionId,
    );
    const readiness = this.opts.pipeline.getChunkReadiness(intent.sessionId);
    const record: VoiceTurnPreemptionRecord = {
      id: this.newId(),
      sessionId: intent.sessionId,
      turnId,
      interruptedAt: this.now(),
      lastReadyChunkIndex: maxChunkIndex(
        readiness.filter(isReadyForPlayback).map((item) => item.chunkIndex),
      ),
      lastSequencedChunkIndex: maxChunkIndex(
        playbackIntents.map((item) => item.chunkIndex),
      ),
      pendingChunkCount: playbackIntents.length,
      reason: intent.category,
    };

    this.preemptionByTurn.set(turnId, record);
    await this.emitPreemption(
      intent,
      "voice_turn_preemption_recorded",
      record,
      {
        state,
        success: true,
      },
    );
    return copyPreemptionRecord(record);
  }

  private async handleRejectedPreemption(
    intent: VoiceBargeInIntent,
    reason: VoiceBargeInRejectionReason,
    state: VoiceTurnState,
  ): Promise<void> {
    const existing = this.preemptionByTurn.get(preemptionTurnId(intent));
    if (existing) {
      await this.emitPreemption(
        intent,
        "voice_turn_preemption_noop",
        existing,
        {
          state,
          success: true,
          bargeInRejectionReason: reason,
        },
      );
      return;
    }

    if (reason === "terminal_transition_in_flight") {
      await this.emit(intent, "voice_turn_preemption_noop", true, {
        state,
        turnId: preemptionTurnId(intent),
        preemptionReason: intent.category,
        bargeInRejectionReason: reason,
      });
      return;
    }

    await this.emit(intent, "voice_turn_preemption_rejected", false, {
      state,
      turnId: preemptionTurnId(intent),
      preemptionReason: intent.category,
      bargeInRejectionReason: reason,
    });
  }

  private async requestCaptureRearm(
    intent: VoiceBargeInIntent,
    state: VoiceTurnState,
  ): Promise<VoiceCaptureRearmResultRecord> {
    const turnId = preemptionTurnId(intent);
    const existing = this.captureRearmResultByTurn.get(turnId);
    if (existing) {
      await this.emitCaptureRearmResult(
        intent,
        "voice_capture_rearm_noop",
        existing,
        {
          state,
          success: true,
        },
      );
      return copyCaptureRearmResultRecord(existing);
    }

    const currentState = this.getState(intent.sessionId);
    if (TERMINAL_BARGE_IN_STATES.has(currentState)) {
      return this.blockCaptureRearm(
        intent,
        state,
        "state_terminal",
        "not_requested",
      );
    }

    const requestedAt = this.now();
    const request: VoiceCaptureRearmIntentRecord = {
      id: this.newId(),
      sessionId: intent.sessionId,
      turnId,
      bargeInIntentId: intent.id,
      reason: intent.category,
      state: "requested",
      requestedAt,
    };
    this.captureRearmIntentByTurn.set(turnId, request);
    await this.emitCaptureRearmRequest(intent, request, {
      state,
      previousCaptureRearmState: "not_requested",
      nextCaptureRearmState: "requested",
    });

    request.state = "clearing_previous_turn";
    await this.emitCaptureRearmRequest(intent, request, {
      state,
      previousCaptureRearmState: "requested",
      nextCaptureRearmState: "clearing_previous_turn",
    });

    request.state = "ready_for_new_capture";
    const result: VoiceCaptureRearmResultRecord = {
      id: this.newId(),
      intentId: request.id,
      sessionId: intent.sessionId,
      turnId,
      bargeInIntentId: intent.id,
      reason: intent.category,
      state: "ready_for_new_capture",
      completedAt: this.now(),
    };
    this.captureRearmResultByTurn.set(turnId, result);
    await this.emitCaptureRearmResult(
      intent,
      "voice_capture_rearm_ready",
      result,
      {
        state,
        success: true,
        previousCaptureRearmState: "clearing_previous_turn",
        nextCaptureRearmState: "ready_for_new_capture",
      },
    );
    return copyCaptureRearmResultRecord(result);
  }

  private async handleRejectedCaptureRearm(
    intent: VoiceBargeInIntent,
    reason: VoiceBargeInRejectionReason,
    state: VoiceTurnState,
  ): Promise<void> {
    if (!intentPreparesNewCapture(intent)) return;

    const turnId = preemptionTurnId(intent);
    const existing = this.captureRearmResultByTurn.get(turnId);
    if (existing) {
      await this.emitCaptureRearmResult(
        intent,
        "voice_capture_rearm_noop",
        existing,
        {
          state,
          success: true,
          captureRearmBlockedReason: reason,
        },
      );
      return;
    }

    if (reason === "terminal_transition_in_flight") {
      await this.emit(intent, "voice_capture_rearm_noop", true, {
        state,
        turnId,
        captureRearmState: this.getCaptureRearmState(turnId),
        captureRearmBlockedReason: reason,
      });
      return;
    }

    await this.blockCaptureRearm(
      intent,
      state,
      reason,
      this.getCaptureRearmState(turnId),
    );
  }

  private async blockCaptureRearm(
    intent: VoiceBargeInIntent,
    state: VoiceTurnState,
    reason: VoiceCaptureRearmBlockedReason,
    previousState: VoiceCaptureRearmState,
  ): Promise<VoiceCaptureRearmResultRecord> {
    const turnId = preemptionTurnId(intent);
    const fallbackIntentId = this.newId();
    const result: VoiceCaptureRearmResultRecord = {
      id: this.newId(),
      intentId:
        this.captureRearmIntentByTurn.get(turnId)?.id ?? fallbackIntentId,
      sessionId: intent.sessionId,
      turnId,
      bargeInIntentId: intent.id,
      reason: intent.category,
      state: "blocked",
      completedAt: this.now(),
      blockedReason: reason,
    };
    this.captureRearmResultByTurn.set(turnId, result);
    await this.emitCaptureRearmResult(
      intent,
      "voice_capture_rearm_blocked",
      result,
      {
        state,
        success: false,
        previousCaptureRearmState: previousState,
        nextCaptureRearmState: "blocked",
        captureRearmBlockedReason: reason,
      },
    );
    return copyCaptureRearmResultRecord(result);
  }

  private async failCaptureRearm(
    intent: VoiceBargeInIntent,
    state: VoiceTurnState,
    reason: VoiceCaptureRearmBlockedReason,
  ): Promise<VoiceCaptureRearmResultRecord> {
    const turnId = preemptionTurnId(intent);
    const existing = this.captureRearmResultByTurn.get(turnId);
    if (existing) return copyCaptureRearmResultRecord(existing);

    const fallbackIntentId = this.newId();
    const previousState = this.getCaptureRearmState(turnId);
    const result: VoiceCaptureRearmResultRecord = {
      id: this.newId(),
      intentId:
        this.captureRearmIntentByTurn.get(turnId)?.id ?? fallbackIntentId,
      sessionId: intent.sessionId,
      turnId,
      bargeInIntentId: intent.id,
      reason: intent.category,
      state: "failed",
      completedAt: this.now(),
      blockedReason: reason,
    };
    this.captureRearmResultByTurn.set(turnId, result);
    await this.emitCaptureRearmResult(
      intent,
      "voice_capture_rearm_failed",
      result,
      {
        state,
        success: false,
        previousCaptureRearmState: previousState,
        nextCaptureRearmState: "failed",
        captureRearmBlockedReason: reason,
      },
    );
    return copyCaptureRearmResultRecord(result);
  }

  private async transitionState(
    intent: VoiceBargeInIntent,
    previousState: VoiceBargeInState,
    nextState: VoiceBargeInState,
    turnState: VoiceTurnState,
    success: boolean,
  ): Promise<void> {
    if (previousState === nextState) return;
    this.stateBySession.set(intent.sessionId, nextState);
    await this.emit(intent, "voice_barge_in_state_transition", success, {
      state: turnState,
      previousBargeInState: previousState,
      nextBargeInState: nextState,
      bargeInState: nextState,
    });
  }

  private async emitAction(
    intent: VoiceBargeInIntent,
    action: VoiceBargeInAction,
    state: VoiceTurnState,
    success: boolean,
  ): Promise<void> {
    await this.emit(
      intent,
      action === "no_op"
        ? "voice_barge_in_noop"
        : "voice_barge_in_action_selected",
      success,
      {
        state,
        bargeInAction: action,
        bargeInState: this.getState(intent.sessionId),
      },
    );
  }

  private async emitPreemption(
    intent: VoiceBargeInIntent,
    eventType: Extract<
      VoiceOrchestrationTelemetryEvent["eventType"],
      "voice_turn_preemption_recorded" | "voice_turn_preemption_noop"
    >,
    record: VoiceTurnPreemptionRecord,
    fields: Partial<VoiceOrchestrationTelemetryEvent>,
  ): Promise<void> {
    await this.emit(intent, eventType, fields.success ?? true, {
      state: fields.state ?? "failed",
      preemptionRecordId: record.id,
      turnId: record.turnId,
      interruptedAt: record.interruptedAt,
      lastReadyChunkIndex: record.lastReadyChunkIndex,
      lastSequencedChunkIndex: record.lastSequencedChunkIndex,
      pendingChunkCount: record.pendingChunkCount,
      preemptionReason: record.reason,
      bargeInRejectionReason: fields.bargeInRejectionReason,
    });
  }

  private async emitCaptureRearmRequest(
    intent: VoiceBargeInIntent,
    record: VoiceCaptureRearmIntentRecord,
    fields: Partial<VoiceOrchestrationTelemetryEvent>,
  ): Promise<void> {
    await this.emit(intent, "voice_capture_rearm_requested", true, {
      state: fields.state ?? "failed",
      captureRearmIntentId: record.id,
      turnId: record.turnId,
      captureRearmState: record.state,
      previousCaptureRearmState: fields.previousCaptureRearmState,
      nextCaptureRearmState: fields.nextCaptureRearmState,
    });
  }

  private async emitCaptureRearmResult(
    intent: VoiceBargeInIntent,
    eventType: Extract<
      VoiceOrchestrationTelemetryEvent["eventType"],
      | "voice_capture_rearm_ready"
      | "voice_capture_rearm_blocked"
      | "voice_capture_rearm_failed"
      | "voice_capture_rearm_noop"
    >,
    record: VoiceCaptureRearmResultRecord,
    fields: Partial<VoiceOrchestrationTelemetryEvent>,
  ): Promise<void> {
    await this.emit(intent, eventType, fields.success ?? true, {
      state: fields.state ?? "failed",
      captureRearmIntentId: record.intentId,
      captureRearmResultId: record.id,
      turnId: record.turnId,
      captureRearmState: record.state,
      previousCaptureRearmState: fields.previousCaptureRearmState,
      nextCaptureRearmState: fields.nextCaptureRearmState,
      captureRearmBlockedReason:
        fields.captureRearmBlockedReason ?? record.blockedReason,
    });
  }

  private async emit(
    intent: VoiceBargeInIntent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
  ): Promise<void> {
    await emitMetadataOnlyVoiceTelemetry(this.opts.emitTelemetry, {
      eventType,
      sessionId: intent.sessionId,
      state: fields.state ?? "failed",
      success,
      streamId: intent.streamId,
      responseId: intent.responseId,
      playbackIntentId: intent.playbackIntentId,
      bargeInIntentId: intent.id,
      bargeInIntentCategory: intent.category,
      turnId: fields.turnId ?? intent.turnId,
      ...fields,
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private newId(): string {
    return this.opts.newId?.() ?? `preemption-${this.now()}`;
  }
}

function transitionPlanForIntent(
  intent: VoiceBargeInIntent,
): BargeInTransitionPlan {
  if (intent.category === "user_requested_stop") {
    return {
      actions: ["cancel_current_voice_pipeline", "clear_pending_audio_work"],
      states: [
        "observing_playback",
        "interrupt_requested",
        "cancelling_current_turn",
        "clearing_pending_work",
      ],
      terminalMethod: "cancel",
    };
  }
  if (intent.category === "playback_preempted") {
    return {
      actions: [
        "cancel_current_voice_pipeline",
        "clear_pending_audio_work",
        "mark_turn_interrupted",
      ],
      states: [
        "observing_playback",
        "interrupt_requested",
        "cancelling_current_turn",
        "clearing_pending_work",
      ],
      terminalMethod: "interrupt",
    };
  }
  return {
    actions: [
      "cancel_current_voice_pipeline",
      "clear_pending_audio_work",
      "mark_turn_interrupted",
      "prepare_for_new_capture",
    ],
    states: [
      "observing_playback",
      "interrupt_requested",
      "cancelling_current_turn",
      "clearing_pending_work",
      "preparing_new_capture",
      "ready_for_capture",
    ],
    terminalMethod: "interrupt",
  };
}

function isValidIntentFromState(
  intent: VoiceBargeInIntent,
  currentState: VoiceBargeInState,
): boolean {
  if (currentState === "idle") return true;
  if (currentState === "observing_playback") return true;
  return intent.category === "user_requested_stop";
}

function copyIntent(intent: VoiceBargeInIntent): VoiceBargeInIntent {
  return { ...intent };
}

function copyPreemptionRecord(
  record: VoiceTurnPreemptionRecord,
): VoiceTurnPreemptionRecord {
  return { ...record };
}

function copyCaptureRearmIntentRecord(
  record: VoiceCaptureRearmIntentRecord,
): VoiceCaptureRearmIntentRecord {
  return { ...record };
}

function copyCaptureRearmResultRecord(
  record: VoiceCaptureRearmResultRecord,
): VoiceCaptureRearmResultRecord {
  return { ...record };
}

function preemptionTurnId(intent: VoiceBargeInIntent): string {
  return intent.turnId ?? intent.sessionId;
}

function intentPreparesNewCapture(intent: VoiceBargeInIntent): boolean {
  return (
    intent.category === "user_ptt_pressed_during_playback" ||
    intent.category === "user_started_new_turn"
  );
}

function isReadyForPlayback(record: VoiceChunkReadinessRecord): boolean {
  return record.state === "ready_to_play" && !record.terminal;
}

function maxChunkIndex(indexes: number[]): number | undefined {
  return indexes.length > 0 ? Math.max(...indexes) : undefined;
}
