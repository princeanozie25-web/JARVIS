export const VOICE_CONVERSATION_STATES = [
  "sleep",
  "wake",
  "active",
  "idle",
  "ending",
] as const;

export const VOICE_CONVERSATION_EVENTS = [
  "wake_detected",
  "activation_started",
  "speech_started",
  "speech_completed",
  "vad_timeout",
  "idle_timeout",
  "sleep_command",
  "sleep_completed",
  "cancel",
] as const;

export const VOICE_VAD_TIMEOUT_OPTIONS_MINUTES = [2, 3, 5] as const;

export type VoiceConversationState = (typeof VOICE_CONVERSATION_STATES)[number];
export type VoiceConversationEvent = (typeof VOICE_CONVERSATION_EVENTS)[number];
export type VoiceVadTimeoutMinutes =
  (typeof VOICE_VAD_TIMEOUT_OPTIONS_MINUTES)[number];

export type VoiceConversationTransitionResult =
  | {
      readonly ok: true;
      readonly previous_state: VoiceConversationState;
      readonly event: VoiceConversationEvent;
      readonly next_state: VoiceConversationState;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly previous_state: VoiceConversationState | null;
      readonly event: VoiceConversationEvent | null;
      readonly next_state: null;
      readonly reason: "invalid_state" | "invalid_event" | "invalid_transition";
      readonly metadata_only: true;
    };

export interface VoiceConversationConfig {
  readonly vad_timeout_minutes: VoiceVadTimeoutMinutes;
  readonly sleep_commands: readonly ["Jarvis sleep", "Goodnight Jarvis"];
  readonly no_pre_wake_audio_storage: true;
  readonly metadata_only: true;
}

export const DEFAULT_VOICE_CONVERSATION_CONFIG: VoiceConversationConfig =
  Object.freeze({
    vad_timeout_minutes: 3,
    sleep_commands: ["Jarvis sleep", "Goodnight Jarvis"] as const,
    no_pre_wake_audio_storage: true,
    metadata_only: true,
  });

const TRANSITIONS: Record<
  VoiceConversationState,
  Partial<Record<VoiceConversationEvent, VoiceConversationState>>
> = {
  sleep: {
    wake_detected: "wake",
  },
  wake: {
    activation_started: "active",
    speech_started: "active",
    idle_timeout: "sleep",
    sleep_command: "ending",
    cancel: "sleep",
  },
  active: {
    speech_completed: "idle",
    vad_timeout: "idle",
    sleep_command: "ending",
    cancel: "ending",
  },
  idle: {
    speech_started: "active",
    idle_timeout: "sleep",
    sleep_command: "ending",
    cancel: "sleep",
  },
  ending: {
    sleep_completed: "sleep",
    cancel: "sleep",
  },
};

export function transitionVoiceConversationState(
  currentState: unknown,
  event: unknown,
): VoiceConversationTransitionResult {
  if (!isVoiceConversationState(currentState)) {
    return failed(null, null, "invalid_state");
  }
  if (!isVoiceConversationEvent(event)) {
    return failed(currentState, null, "invalid_event");
  }

  const next = TRANSITIONS[currentState][event];
  if (!next) return failed(currentState, event, "invalid_transition");

  return {
    ok: true,
    previous_state: currentState,
    event,
    next_state: next,
    metadata_only: true,
  };
}

export function isVoiceConversationState(
  value: unknown,
): value is VoiceConversationState {
  return (
    typeof value === "string" &&
    (VOICE_CONVERSATION_STATES as readonly string[]).includes(value)
  );
}

export function isVoiceConversationEvent(
  value: unknown,
): value is VoiceConversationEvent {
  return (
    typeof value === "string" &&
    (VOICE_CONVERSATION_EVENTS as readonly string[]).includes(value)
  );
}

export function parseVoiceVadTimeoutMinutes(
  value: unknown,
): VoiceVadTimeoutMinutes {
  if (
    typeof value === "number" &&
    (VOICE_VAD_TIMEOUT_OPTIONS_MINUTES as readonly number[]).includes(value)
  ) {
    return value as VoiceVadTimeoutMinutes;
  }
  return DEFAULT_VOICE_CONVERSATION_CONFIG.vad_timeout_minutes;
}

export function voiceVadTimeoutMs(value: unknown): number {
  return parseVoiceVadTimeoutMinutes(value) * 60_000;
}

export function isVoiceSleepCommand(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
  return normalized === "jarvis sleep" || normalized === "goodnight jarvis";
}

function failed(
  previousState: VoiceConversationState | null,
  event: VoiceConversationEvent | null,
  reason: "invalid_state" | "invalid_event" | "invalid_transition",
): VoiceConversationTransitionResult {
  return {
    ok: false,
    previous_state: previousState,
    event,
    next_state: null,
    reason,
    metadata_only: true,
  };
}
