import type {
  CockpitVoiceProviderView,
  CockpitVoiceView,
} from "@/components/working/voice-view";
import { syntheticCockpitVoiceView } from "@/components/working/voice-view";
import { createRuntimeNarrationProviders } from "@/lib/demo-director/chatterbox";
import {
  buildSystemVoiceStackRuntimeState,
  type SystemVoiceProviderHealth,
  type SystemVoiceProviderId,
} from "@/lib/voice-operating-mode/voice-stack";
import {
  snapshotVoiceEngineHealth,
  type CanonicalTtsEngineId,
  type VoiceSynthesisEngine,
} from "@/lib/voice/tts-engine";

// E-020 — the READ half of the voice-pill wire: probe the REAL canonical
// engine chain (post-E-011) and translate the result into the Phase 22
// display stack. STRICTLY read-only: only health() probes run (see
// snapshotVoiceEngineHealth) — no synthesis, no failover selection, no
// telemetry, no authority. The engines are the same registered adapters the
// consolidated chain uses (Chatterbox :8004 / Kokoro :8880 HTTP probes; the
// Piper terminal's fail-closed on-disk check) — health-only here.
//
// THE ID-TRAP, handled explicitly (do NOT merge these):
//   - "existing-local-fallback"  = the Phase 23 DRILLED chain-terminal id
//     (canonical in the E-011 registry). It names the failover contract.
//   - "existing-local-runtime"   = the Phase 22 DISPLAY/system-stack id.
//     It names the cockpit's presentation contract.
// This module translates chain ids -> display ids at the boundary, one way,
// for presentation only. Both contracts keep their own id unchanged.
export const CANONICAL_TO_DISPLAY_PROVIDER_ID: Record<
  CanonicalTtsEngineId,
  SystemVoiceProviderId
> = {
  "chatterbox-tts-server": "chatterbox-tts-server",
  kokoro: "kokoro",
  "existing-local-fallback": "existing-local-runtime",
};

// Sidecar probes get a short budget: this runs for a status pill, not a
// synthesis attempt — a down sidecar should read "down" quickly.
const DISPLAY_PROBE_TIMEOUT_MS = 900;

export interface LoadCockpitVoiceViewOptions {
  /** Injection seam for tests — real callers omit it and probe the actual
   * registered engines. Only health() is ever invoked on these. */
  readonly engines?: readonly VoiceSynthesisEngine<never, unknown>[];
  readonly now?: () => number;
}

export async function loadCockpitVoiceView(
  options: LoadCockpitVoiceViewOptions = {},
): Promise<CockpitVoiceView> {
  try {
    const engines =
      options.engines ??
      createRuntimeNarrationProviders({ timeout_ms: DISPLAY_PROBE_TIMEOUT_MS });
    const snapshot = await snapshotVoiceEngineHealth(engines, {
      now: options.now,
    });

    const displayHealth: SystemVoiceProviderHealth[] = snapshot.engines.map(
      (entry, index) => ({
        provider_id: toDisplayId(entry.provider_id),
        priority: index,
        ok: entry.ok,
        degraded: entry.degraded,
        checked_at_ms: entry.checked_at_ms,
        local_only: true,
        metadata_only: true,
      }),
    );
    const stack = buildSystemVoiceStackRuntimeState(displayHealth);
    const providers: CockpitVoiceProviderView[] = displayHealth.map(
      (entry) => ({
        provider_id: entry.provider_id,
        ok: entry.ok,
        degraded: entry.degraded,
      }),
    );
    return {
      // Probes RAN — this is the real picture, even when it says "all down,
      // terminal only": honest "down" beats a fake "all healthy".
      provenance: "live",
      selected_provider: stack.selected_provider,
      failed_over: snapshot.failed_over,
      providers,
      checked_at_ms: snapshot.checked_at_ms,
      metadata_only: true,
      read_only: true,
    };
  } catch {
    // Fail-closed: when the probe path itself is unavailable, fall back to
    // the Phase 22 default picture — labelled synthetic, never faked live.
    return syntheticCockpitVoiceView();
  }
}

function toDisplayId(canonicalId: string): SystemVoiceProviderId {
  const mapped =
    CANONICAL_TO_DISPLAY_PROVIDER_ID[canonicalId as CanonicalTtsEngineId];
  // Fail-closed for an unknown engine id: present it as the local terminal
  // slot rather than inventing a display id outside the Phase 22 contract.
  return mapped ?? "existing-local-runtime";
}
