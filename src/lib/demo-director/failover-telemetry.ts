import type { TelemetryEvent } from "@/lib/telemetry";

import type { DemoNarrationProviderId } from "./narration";

// Phase 23G-3 — metadata-only failover auditability (the second half of E-010).
// A silent failover is an unauditable (forbidden) action: every time the
// narration chain advances past a provider, and when one is finally selected,
// a metadata-only telemetry event is emitted and persisted to the existing
// sqlite sink (data/jarvis.db -> telemetry_events) via recordEvent. NO audio,
// transcript, text, URL, or path ever rides these events — only provider ids,
// an enum reason, an integer chain position, and a timestamp.

export const NARRATION_FAILOVER_REASONS = [
  "health_probe_failed",
  "synth_error",
  "unreachable",
] as const;
export type NarrationFailoverReason =
  (typeof NARRATION_FAILOVER_REASONS)[number];

export interface NarrationFailoverInfo {
  readonly from_provider_id: DemoNarrationProviderId;
  readonly to_provider_id: DemoNarrationProviderId;
  readonly reason: NarrationFailoverReason;
  readonly chain_position: number;
  readonly occurred_at_ms: number;
}

export interface NarrationProviderSelectedInfo {
  readonly provider_id: DemoNarrationProviderId;
  readonly chain_position: number;
  readonly occurred_at_ms: number;
}

export interface NarrationTelemetrySink {
  recordFailover(info: NarrationFailoverInfo): void;
  recordSelected(info: NarrationProviderSelectedInfo): void;
}

// Raw-content field names the failover audit must never carry. Matched on the
// normalized (alphanumeric-lowercased) key, exact membership — so a benign key
// is never a false positive.
export const NARRATION_TELEMETRY_FORBIDDEN_FIELDS = [
  "transcript",
  "audio",
  "text",
  "url",
  "path",
  "base64",
  "pcm",
  "waveform",
  "prompt",
  "response",
  "secret",
  "apikey",
] as const;

const FORBIDDEN_FIELD_SET = new Set<string>(
  NARRATION_TELEMETRY_FORBIDDEN_FIELDS.map(normalizeFieldName),
);

function normalizeFieldName(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

// The forbidden-field sentinel loop: returns the offending key if the payload
// carries any raw-content field, else null.
export function findForbiddenTelemetryField(
  payload: Record<string, unknown>,
): string | null {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_FIELD_SET.has(normalizeFieldName(key))) {
      return key;
    }
  }
  return null;
}

export interface NarrationFailoverTelemetrySinkDeps {
  // REQUIRED injected sink — the codebase pattern (cf. emitMetadataOnlyVoiceTelemetry):
  // the caller routes to the established recordEvent path. Server contexts pass
  // @/lib/telemetry's recordEvent (-> data/jarvis.db -> telemetry_events); tests
  // pass a capture or an in-memory insert. This lib never imports the DB layer
  // itself (which is `server-only`), so it stays safe for client/lib consumers.
  readonly recordEvent: (event: TelemetryEvent) => void;
  readonly sessionId?: string;
  // Invoked (instead of throwing) when a telemetry write fails — emission is
  // strictly non-fatal so narration/synthesis is never aborted by an audit
  // write. Defaults to a bounded console.warn.
  readonly onError?: (error: unknown) => void;
}

export function createNarrationFailoverTelemetrySink(
  deps: NarrationFailoverTelemetrySinkDeps,
): NarrationTelemetrySink {
  const record = deps.recordEvent;
  const onError =
    deps.onError ??
    ((error: unknown) => {
      console.warn(
        "[narration-failover-telemetry] audit write failed (non-fatal):",
        error instanceof Error ? error.message : String(error),
      );
    });

  const persist = (event: TelemetryEvent): void => {
    try {
      const forbidden = findForbiddenTelemetryField(
        event as unknown as Record<string, unknown>,
      );
      if (forbidden) {
        throw new Error(`forbidden telemetry field present: ${forbidden}`);
      }
      record(event);
    } catch (error) {
      // Non-fatal: a failed audit write must not break synthesis.
      onError(error);
    }
  };

  return {
    recordFailover(info: NarrationFailoverInfo): void {
      persist({
        timestamp: info.occurred_at_ms,
        event_type: "voice_provider_failover",
        success: true,
        session_id: deps.sessionId,
        tool_name: info.from_provider_id,
        error_class: info.reason,
        notes: `from=${info.from_provider_id} to=${info.to_provider_id} reason=${info.reason} chain_position=${info.chain_position}`,
      });
    },
    recordSelected(info: NarrationProviderSelectedInfo): void {
      persist({
        timestamp: info.occurred_at_ms,
        event_type: "voice_provider_selected",
        success: true,
        session_id: deps.sessionId,
        tool_name: info.provider_id,
        notes: `selected=${info.provider_id} chain_position=${info.chain_position}`,
      });
    },
  };
}
