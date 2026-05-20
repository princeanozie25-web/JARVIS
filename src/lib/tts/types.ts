export type SpeechSynthesisInputSource =
  | "assistant_prose"
  | "tool_output"
  | "code_block"
  | "audit_runtime_output"
  | "personal_context";

export interface SpeechSynthesisInput {
  text: string;
  source: SpeechSynthesisInputSource;
  contentTags?: readonly string[];
  voiceId?: string;
  language?: string;
}

export type SpeechSynthesisResultStatus =
  | "completed"
  | "disabled"
  | "blocked"
  | "error";

export type SpeechSynthesisRefusalReason =
  | "provider_disabled"
  | "provider_unavailable"
  | "tool_output_blocked"
  | "code_block_blocked"
  | "audit_runtime_output_blocked"
  | "personal_context_blocked"
  | "assistant_prose_required"
  | "empty_text";

export interface SpeechSynthesisResult {
  status: SpeechSynthesisResultStatus;
  providerId: string;
  audio: null;
  reason?: SpeechSynthesisRefusalReason;
  errorMessage?: string;
}

export type SpeechProviderStatus =
  | "disabled"
  | "not_installed"
  | "loading"
  | "unavailable"
  | "ready"
  | "error";

export interface SpeechProviderMetadata {
  runsLocally: boolean;
  requiresNetwork: boolean;
  storesAudio: boolean;
  supportsStreaming: boolean;
}

export interface SpeechProvider {
  readonly id: string;
  readonly enabled: boolean;
  readonly status: SpeechProviderStatus;
  readonly metadata: SpeechProviderMetadata;
  readonly config?: LocalSpeechProviderConfig;
  synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisResult>;
}

export interface LocalSpeechProviderConfig {
  binaryPath: string | null;
  voiceModelPath: string | null;
  speakerId: string | null;
  sampleRate: number | null;
  startupTimeoutMs: number;
}

export type SpeechPlaybackStateStatus =
  | "idle"
  | "disabled"
  | "blocked"
  | "error";

export interface SpeechPlaybackState {
  status: SpeechPlaybackStateStatus;
  providerId: string | null;
  activeUtteranceId: string | null;
  errorMessage?: string;
}
