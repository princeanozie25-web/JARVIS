// E-011 — canonical TTS engine layer, SHARED MECHANISM ONLY.
//
// This module owns the ONE definition of "which TTS engine + what fallback":
// the engine shape, the health contract, and the failover telemetry contract.
// It is consumed by BOTH voice subsystems (the demo-director narration chain
// and the PTT voice runtime). It deliberately knows NOTHING about either
// subsystem's policy — each subsystem keeps its own policy wrapper and merely
// delegates the engine-selection mechanism here.

// A metadata-only health probe result for one engine in a chain.
export interface VoiceEngineHealth {
  readonly provider_id: string;
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly checked_at_ms: number;
  readonly metadata_only: true;
}

// The minimal engine shape the failover mechanism needs: an id, a chain
// priority, a health probe, and (optionally) a synthesis function. `Line` and
// `Cue` are opaque to this layer — the demo chain synthesizes narration lines
// into demo cues, the PTT runtime synthesizes TTS requests into TTS results.
export interface VoiceSynthesisEngine<Line, Cue> {
  readonly provider_id: string;
  readonly priority: number;
  health(): Promise<VoiceEngineHealth>;
  synthesize?(line: Line): Promise<Cue>;
}

export const VOICE_ENGINE_FAILOVER_REASONS = [
  "health_probe_failed",
  "synth_error",
  "unreachable",
] as const;

export type VoiceEngineFailoverReason =
  (typeof VOICE_ENGINE_FAILOVER_REASONS)[number];

// Metadata-only failover audit events. Only ids, an enum reason, an integer
// chain position, and a timestamp ever ride these — never raw content.
export interface VoiceEngineFailoverInfo {
  readonly from_provider_id: string;
  readonly to_provider_id: string;
  readonly reason: VoiceEngineFailoverReason;
  readonly chain_position: number;
  readonly occurred_at_ms: number;
}

export interface VoiceEngineSelectedInfo {
  readonly provider_id: string;
  readonly chain_position: number;
  readonly occurred_at_ms: number;
}

export interface VoiceEngineTelemetrySink {
  recordFailover(info: VoiceEngineFailoverInfo): void;
  recordSelected(info: VoiceEngineSelectedInfo): void;
}

export interface VoiceEngineFailoverOptions {
  readonly telemetry?: VoiceEngineTelemetrySink;
  readonly now?: () => number;
}
