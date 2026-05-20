import type { VoiceRealtimeOrchestrationPipeline } from "./pipeline";
import type { VoiceOrchestrationSupervisor } from "./supervisor";
import type {
  VoiceBargeInAction,
  VoiceBargeInCoordinatorResult,
  VoiceBargeInIntent,
  VoiceBargeInRejectionReason,
  VoiceBargeInState,
  VoiceOrchestrationTelemetryEvent,
  VoiceTurnState,
} from "./types";

export interface VoiceBargeInCoordinatorOptions {
  supervisor: VoiceOrchestrationSupervisor;
  pipeline: Pick<
    VoiceRealtimeOrchestrationPipeline,
    "cancelSession" | "interrupt"
  >;
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
      ...fields,
    });
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
