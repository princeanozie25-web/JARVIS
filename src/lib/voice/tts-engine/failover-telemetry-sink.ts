// E-012 (Phase 25C) — the ONE failover-audit sink for the canonical engine
// layer, usable by BOTH consuming chains. The demo-director has carried its
// own copy since 23G-3 (recording-only); the live PTT runtime had none — a
// silent failover on the live path was an unauditable action. This sink is
// mechanism only (E-011: shared mechanism, never shared authority): it turns
// the chain's metadata-only failover/selection facts into TelemetryEvents and
// hands them to an INJECTED recordEvent (server contexts pass
// @/lib/telemetry's, which persists to data/jarvis.db -> telemetry_events;
// tests pass a capture). It never imports the DB layer, never carries raw
// content, and never throws into synthesis.

import type { TelemetryEvent } from "../../telemetry/types";
import type {
  VoiceEngineFailoverInfo,
  VoiceEngineSelectedInfo,
  VoiceEngineTelemetrySink,
} from "./types";

// Field names that must never ride a failover audit event (I2). Matched on the
// event object itself, case-insensitively, before it reaches the sink.
export const VOICE_ENGINE_AUDIT_FORBIDDEN_FIELDS = [
  "text",
  "raw_text",
  "transcript",
  "audio",
  "raw_audio",
  "audio_bytes",
  "waveform",
  "pcm",
  "output_ref",
  "file_path",
  "prompt",
  "response",
  "model_output",
  "api_key",
  "secret",
] as const;

export function findForbiddenAuditField(
  record: Record<string, unknown>,
): string | null {
  const forbidden = new Set<string>(VOICE_ENGINE_AUDIT_FORBIDDEN_FIELDS);
  for (const key of Object.keys(record)) {
    if (forbidden.has(key.toLowerCase())) return key;
  }
  return null;
}

export interface VoiceEngineFailoverTelemetrySinkDeps {
  readonly recordEvent: (event: TelemetryEvent) => void;
  readonly sessionId?: string;
  /** Called instead of throwing when an audit write fails — non-fatal by design. */
  readonly onError?: (error: unknown) => void;
}

export function createVoiceEngineFailoverTelemetrySink(
  deps: VoiceEngineFailoverTelemetrySinkDeps,
): VoiceEngineTelemetrySink {
  const onError =
    deps.onError ??
    ((error: unknown) => {
      console.warn(
        "[voice-engine-failover-audit] write failed (non-fatal):",
        error instanceof Error ? error.message : String(error),
      );
    });
  const persist = (event: TelemetryEvent): void => {
    try {
      const forbidden = findForbiddenAuditField(
        event as unknown as Record<string, unknown>,
      );
      if (forbidden) throw new Error(`forbidden audit field: ${forbidden}`);
      deps.recordEvent(event);
    } catch (error) {
      onError(error);
    }
  };
  return {
    recordFailover(info: VoiceEngineFailoverInfo): void {
      persist({
        timestamp: info.occurred_at_ms,
        event_type: "voice_provider_failover",
        success: true,
        session_id: deps.sessionId,
        tool_name: info.from_provider_id,
        error_class: info.reason,
        notes: `from=${info.from_provider_id} to=${info.to_provider_id} reason=${info.reason} chain_position=${info.chain_position} path=live`,
      });
    },
    recordSelected(info: VoiceEngineSelectedInfo): void {
      persist({
        timestamp: info.occurred_at_ms,
        event_type: "voice_provider_selected",
        success: true,
        session_id: deps.sessionId,
        tool_name: info.provider_id,
        notes: `selected=${info.provider_id} chain_position=${info.chain_position} path=live`,
      });
    },
  };
}
