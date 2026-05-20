import type { VoiceRealtimeOrchestrationPipeline } from "./pipeline";
import type { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  VoiceBargeInAction,
  VoiceBargeInCoordinatorResult,
  VoiceBargeInIntent,
  VoiceBargeInRejectionReason,
  VoiceBargeInState,
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

  constructor(private readonly opts: VoiceBargeInCoordinatorOptions) {}

  async handleIntent(
    intent: VoiceBargeInIntent,
  ): Promise<VoiceBargeInCoordinatorResult> {
    const session = this.opts.supervisor.getSession(intent.sessionId);
    const currentState = this.getState(intent.sessionId);

    await this.emit(intent, "voice_barge_in_intent_received", true, {
      state: session?.state ?? "failed",
      bargeInState: currentState,
    });

    const rejection = this.getRejectionReason(
      intent,
      currentState,
      session?.state,
    );
    if (rejection) {
      await this.rejectIntent(intent, rejection, session?.state, currentState);
      await this.handleRejectedPreemption(
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

    await this.emit(intent, "voice_turn_preemption_rejected", false, {
      state,
      turnId: preemptionTurnId(intent),
      preemptionReason: intent.category,
      bargeInRejectionReason: reason,
    });
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

  private async emit(
    intent: VoiceBargeInIntent,
    eventType: VoiceOrchestrationTelemetryEvent["eventType"],
    success: boolean,
    fields: Partial<VoiceOrchestrationTelemetryEvent> = {},
  ): Promise<void> {
    await this.opts.emitTelemetry?.({
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

function preemptionTurnId(intent: VoiceBargeInIntent): string {
  return intent.turnId ?? intent.sessionId;
}

function isReadyForPlayback(record: VoiceChunkReadinessRecord): boolean {
  return record.state === "ready_to_play" && !record.terminal;
}

function maxChunkIndex(indexes: number[]): number | undefined {
  return indexes.length > 0 ? Math.max(...indexes) : undefined;
}
