// E-020 — the serializable voice-pill VIEW contract shared by the server
// loader (src/app/working/voice-health.ts) and the client cockpit. Pure
// types + a synthetic default builder; imports NO probe, NO engine, NO
// transport, so it is safe in the client bundle.

import {
  buildSystemVoiceStackRuntimeState,
  type SystemVoiceProviderId,
} from "@/lib/voice-operating-mode/voice-stack";

export type CockpitVoiceProvenance = "live" | "synthetic";

export interface CockpitVoiceProviderView {
  /** Phase 22 DISPLAY id (terminal: "existing-local-runtime" — NOT the
   * drilled chain id; see the explicit mapping in voice-health.ts). */
  readonly provider_id: SystemVoiceProviderId;
  readonly ok: boolean;
  readonly degraded: boolean;
}

export interface CockpitVoiceView {
  readonly provenance: CockpitVoiceProvenance;
  readonly selected_provider: SystemVoiceProviderId;
  /** True when the chain head is down and a lower engine is the live pick. */
  readonly failed_over: boolean;
  readonly providers: readonly CockpitVoiceProviderView[];
  readonly checked_at_ms: number;
  readonly metadata_only: true;
  readonly read_only: true;
}

/** The pre-E-020 picture, now honestly labelled: the Phase 22 default stack
 * (no probes ran). Used as the initial/SSR state and the fail-closed view. */
export function syntheticCockpitVoiceView(): CockpitVoiceView {
  const stack = buildSystemVoiceStackRuntimeState();
  return {
    provenance: "synthetic",
    selected_provider: stack.selected_provider,
    failed_over: false,
    providers: stack.provider_health.map((entry) => ({
      provider_id: entry.provider_id,
      ok: entry.ok,
      degraded: entry.degraded,
    })),
    checked_at_ms: 0,
    metadata_only: true,
    read_only: true,
  };
}
