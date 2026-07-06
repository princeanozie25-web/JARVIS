import type { VoiceEngineHealth, VoiceSynthesisEngine } from "./types";

// E-020 — a READ-ONLY health snapshot of an engine chain, for DISPLAY
// surfaces (status pills). This is strictly an observation: it calls each
// engine's health() probe and NOTHING else — no synthesize, no failover
// telemetry, no selection side effects. A display reading this can never
// make an engine speak. It is mechanism-only like the rest of this layer:
// the caller supplies the engines; no subsystem is imported here.

export interface VoiceEngineHealthSnapshot {
  /** Per-engine probe results, in chain (priority) order. */
  readonly engines: readonly VoiceEngineHealth[];
  /** The engine the chain WOULD select right now (first healthy), or null
   * when every probe failed. Derived from the same priority order the
   * failover brain uses — but nothing is selected or invoked here. */
  readonly active_engine_id: string | null;
  /** True when the active engine is not the chain head (a failover picture). */
  readonly failed_over: boolean;
  /** True when the terminal (last) engine probed healthy. */
  readonly terminal_ready: boolean;
  readonly checked_at_ms: number;
  readonly metadata_only: true;
  readonly read_only: true;
}

export async function snapshotVoiceEngineHealth<
  E extends VoiceSynthesisEngine<never, unknown>,
>(
  engines: readonly E[],
  options: { readonly now?: () => number } = {},
): Promise<VoiceEngineHealthSnapshot> {
  const now = options.now ?? (() => Date.now());
  const ordered = [...engines].sort(
    (left, right) => left.priority - right.priority,
  );
  // Probes run in parallel — this is observation, not failover walking, so
  // there is no short-circuit to preserve; a hung probe must not serialize.
  const health = await Promise.all(
    ordered.map(
      async (engine): Promise<VoiceEngineHealth> =>
        engine.health().catch(() => ({
          provider_id: engine.provider_id,
          ok: false,
          degraded: true,
          checked_at_ms: now(),
          metadata_only: true,
        })),
    ),
  );

  const active = health.find((entry) => entry.ok) ?? null;
  const terminal = health[health.length - 1] ?? null;
  return {
    engines: health,
    active_engine_id: active?.provider_id ?? null,
    failed_over:
      active !== null && active.provider_id !== health[0]?.provider_id,
    terminal_ready: terminal?.ok === true,
    checked_at_ms: now(),
    metadata_only: true,
    read_only: true,
  };
}
