import type {
  VoiceEngineFailoverOptions,
  VoiceEngineFailoverReason,
  VoiceEngineHealth,
  VoiceSynthesisEngine,
} from "./types";

// E-011 — the ONE failover brain. This logic previously lived twice: as the
// demo-director narration loops (selectNarrationProvider / the
// prepareDemoNarration chain walk, Phase 23G) and as the PTT runtime-bridge's
// inline health-gate. Both subsystems now delegate here. The behaviour is the
// Phase 23 drilled behaviour, moved verbatim:
//   - engines ordered by priority, health-probed in order;
//   - the first healthy engine synthesizes; a synth error advances the chain;
//   - every advance emits a metadata-only failover event when a next engine
//     exists; the final selection emits a selected event;
//   - when EVERY engine is down, the terminal engine is still reported as
//     selected with ZERO cues — the caller's "no audio" signal (the demo
//     chain renders captions from lines; the PTT bridge fails the request).

// Health type as declared by a concrete engine (e.g. the demo chain's
// narrower DemoNarrationProviderHealth), so callers get back what they put in.
type EngineHealthOf<E> = E extends { health(): Promise<infer H> } ? H : never;

export interface VoiceEngineSelection<E> {
  readonly engine: E;
  readonly health: EngineHealthOf<E>[];
}

export type VoiceEngineChainOutcome<E, Cue> =
  | {
      readonly exhausted: false;
      readonly engine: E;
      readonly chain_position: number;
      readonly health: EngineHealthOf<E>[];
      readonly cues: Cue[];
      readonly last_failure: null;
    }
  | {
      readonly exhausted: true;
      readonly engine: E;
      readonly chain_position: number;
      readonly health: EngineHealthOf<E>[];
      readonly cues: readonly [];
      readonly last_failure: VoiceEngineFailoverReason;
    };

// Probes the chain in priority order and returns the first healthy engine.
// When none is healthy, the terminal engine is returned (and recorded as
// selected) so a degraded chain still has a designated floor.
export async function selectVoiceEngine<
  E extends VoiceSynthesisEngine<never, unknown>,
>(
  engines: readonly E[],
  options: VoiceEngineFailoverOptions = {},
): Promise<VoiceEngineSelection<E>> {
  const now = options.now ?? (() => Date.now());
  const ordered = [...engines].sort(
    (left, right) => left.priority - right.priority,
  );
  const health: EngineHealthOf<E>[] = [];
  let position = 0;
  for (const engine of ordered) {
    const checked = (await engine.health()) as EngineHealthOf<E> &
      VoiceEngineHealth;
    health.push(checked);
    if (checked.ok) {
      options.telemetry?.recordSelected({
        provider_id: engine.provider_id,
        chain_position: position,
        occurred_at_ms: now(),
      });
      return { engine, health };
    }
    const next = ordered[position + 1];
    if (next) {
      options.telemetry?.recordFailover({
        from_provider_id: engine.provider_id,
        to_provider_id: next.provider_id,
        reason: "health_probe_failed",
        chain_position: position,
        occurred_at_ms: now(),
      });
    }
    position += 1;
  }

  const fallback = ordered[ordered.length - 1];
  if (!fallback) {
    throw new Error("No synthesis engines configured.");
  }
  options.telemetry?.recordSelected({
    provider_id: fallback.provider_id,
    chain_position: ordered.length - 1,
    occurred_at_ms: now(),
  });
  return { engine: fallback, health };
}

// Walks the chain: first healthy engine synthesizes every line; a health
// failure or synth error advances to the next engine. Exhaustion returns the
// terminal engine with zero cues and the reason the last engine failed.
export async function synthesizeOverEngineChain<
  Line,
  Cue,
  E extends VoiceSynthesisEngine<Line, Cue>,
>(
  engines: readonly E[],
  lines: readonly Line[],
  options: VoiceEngineFailoverOptions = {},
): Promise<VoiceEngineChainOutcome<E, Cue>> {
  const now = options.now ?? (() => Date.now());
  const ordered = [...engines].sort(
    (left, right) => left.priority - right.priority,
  );
  const health: EngineHealthOf<E>[] = [];

  const recordFailover = (
    fromEngine: E,
    position: number,
    reason: VoiceEngineFailoverReason,
  ): void => {
    const next = ordered[position + 1];
    if (next) {
      options.telemetry?.recordFailover({
        from_provider_id: fromEngine.provider_id,
        to_provider_id: next.provider_id,
        reason,
        chain_position: position,
        occurred_at_ms: now(),
      });
    }
  };

  let lastFailure: VoiceEngineFailoverReason = "unreachable";
  let position = 0;
  for (const engine of ordered) {
    const checked = (await engine.health()) as EngineHealthOf<E> &
      VoiceEngineHealth;
    health.push(checked);
    if (!checked.ok) {
      recordFailover(engine, position, "health_probe_failed");
      lastFailure = "health_probe_failed";
      position += 1;
      continue;
    }

    try {
      const cues: Cue[] = [];
      if (engine.synthesize) {
        for (const lineItem of lines) {
          cues.push(await engine.synthesize(lineItem));
        }
      }
      options.telemetry?.recordSelected({
        provider_id: engine.provider_id,
        chain_position: position,
        occurred_at_ms: now(),
      });
      return {
        exhausted: false,
        engine,
        chain_position: position,
        health,
        cues,
        last_failure: null,
      };
    } catch {
      recordFailover(engine, position, "synth_error");
      lastFailure = "synth_error";
      position += 1;
      continue;
    }
  }

  const fallback = ordered[ordered.length - 1];
  if (!fallback) {
    throw new Error("No synthesis engines configured.");
  }
  options.telemetry?.recordSelected({
    provider_id: fallback.provider_id,
    chain_position: ordered.length - 1,
    occurred_at_ms: now(),
  });
  return {
    exhausted: true,
    engine: fallback,
    chain_position: ordered.length - 1,
    health,
    cues: [],
    last_failure: lastFailure,
  };
}
