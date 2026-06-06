/**
 * Demo Director playback engine — DD.10.
 *
 * Pure, deterministic playback. No timers in the core — the renderer
 * advances elapsed_ms and snapshots the resulting state. No audio, no
 * recording, no exports, no narration.
 *
 *   playbackSnapshot(script, elapsed_ms)
 *     → DemoPlaybackSnapshot
 *
 * The snapshot carries:
 *   - state            (idle / assembling / playing / halted / approved /
 *                       denied / complete)
 *   - assembly_stage   (only meaningful while assembling)
 *   - current_segment_id
 *   - active_cues      cues whose absolute timing falls within a small
 *                      window around the current elapsed_ms
 *
 * Every snapshot field is a metadata-only value.
 */

import {
  type DemoAssemblyStage,
  type DemoCue,
  type DemoPlaybackSnapshot,
  type DemoPlaybackState,
  type DemoScript,
  type DemoSegment,
} from "./contracts";
import { assemblyStageAt } from "./assembly-sequence";

/** Cues whose at_ms is within this window of elapsed_ms are "active". */
export const CUE_ACTIVATION_WINDOW_MS = 200;

interface AbsoluteCue {
  segment: DemoSegment;
  cue: DemoCue;
  absolute_ms: number;
}

function flattenCues(script: DemoScript): readonly AbsoluteCue[] {
  const flat: AbsoluteCue[] = [];
  let segmentStart = 0;
  for (const segment of script.segments) {
    for (const cue of segment.cues) {
      flat.push({
        segment,
        cue,
        absolute_ms: segmentStart + cue.at_ms,
      });
    }
    segmentStart += segment.duration_ms;
  }
  return Object.freeze(flat) as readonly AbsoluteCue[];
}

function findCurrentSegment(
  script: DemoScript,
  elapsed_ms: number,
): { segment: DemoSegment | null; offset_ms: number } {
  let start = 0;
  for (const segment of script.segments) {
    const end = start + segment.duration_ms;
    if (elapsed_ms < end) {
      return { segment, offset_ms: elapsed_ms - start };
    }
    start = end;
  }
  return { segment: null, offset_ms: 0 };
}

function resolvePlaybackState(
  script: DemoScript,
  elapsed_ms: number,
  activeCues: readonly DemoCue[],
): DemoPlaybackState {
  if (elapsed_ms <= 0) return "idle";
  if (elapsed_ms >= script.total_duration_ms) return "complete";
  // Halt / approve / deny — the most recent matching cue wins.
  for (const cue of [...activeCues].reverse()) {
    if (cue.kind === "deny") return "denied";
    if (cue.kind === "approve") return "approved";
    if (cue.kind === "halt") return "halted";
  }
  // Are we still in the assembly segment?
  const firstSegment = script.segments[0];
  if (firstSegment && firstSegment.kind === "assembly") {
    if (elapsed_ms < firstSegment.duration_ms) return "assembling";
  }
  return "playing";
}

function resolveAssemblyStage(
  script: DemoScript,
  elapsed_ms: number,
): DemoAssemblyStage {
  const firstSegment = script.segments[0];
  if (!firstSegment || firstSegment.kind !== "assembly") return "complete";
  if (elapsed_ms <= 0) return "black";
  if (elapsed_ms >= firstSegment.duration_ms) return "complete";
  return assemblyStageAt(elapsed_ms);
}

export function playbackSnapshot(
  script: DemoScript,
  elapsed_ms: number,
): DemoPlaybackSnapshot {
  const safeElapsed = Math.max(
    0,
    Math.min(script.total_duration_ms, Math.floor(elapsed_ms)),
  );
  const flat = flattenCues(script);
  const activeCues: DemoCue[] = flat
    .filter(
      (entry) =>
        Math.abs(entry.absolute_ms - safeElapsed) <= CUE_ACTIVATION_WINDOW_MS,
    )
    .map((entry) => entry.cue);
  const { segment } = findCurrentSegment(script, safeElapsed);
  const state = resolvePlaybackState(script, safeElapsed, activeCues);
  const assembly_stage = resolveAssemblyStage(script, safeElapsed);

  return Object.freeze({
    snapshot_id: `demo-snapshot:${script.script_id}:${safeElapsed}`,
    script_id: script.script_id,
    audience: script.audience,
    state,
    assembly_stage,
    current_segment_id: segment ? segment.segment_id : null,
    active_cues: Object.freeze(activeCues) as readonly DemoCue[],
    elapsed_ms: safeElapsed,
    metadata_only: true,
    read_only: true,
    execute_affordance_present: false,
    approve_affordance_present: false,
    mutation_affordance_present: false,
    recording_enabled: true,
    voice_enabled: true,
    export_enabled: true,
  } satisfies DemoPlaybackSnapshot);
}

/**
 * Convenience iterator over a fixed timeline of snapshots — used by
 * tests and the renderer to walk a script deterministically.
 */
export function* playbackTimeline(
  script: DemoScript,
  step_ms = 200,
): Generator<DemoPlaybackSnapshot> {
  const total = script.total_duration_ms;
  let last = 0;
  for (let t = 0; t <= total; t += step_ms) {
    last = t;
    yield playbackSnapshot(script, t);
  }
  if (last !== total) {
    yield playbackSnapshot(script, total);
  }
}
