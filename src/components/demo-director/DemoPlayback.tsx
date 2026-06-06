import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";
import {
  ASSEMBLY_STAGE_ORDER,
  playbackSnapshot,
  type DemoAssemblyStage,
  type DemoCue,
  type DemoPlaybackSnapshot,
  type DemoScript,
} from "@/lib/demo-director";

/**
 * Demo playback surface — DD.10.
 *
 * Composes the governed PipelineDiagram inside a read-only shell that
 * exposes assembly stage, materialised set, active cues, and playback
 * state via data attributes. Animation is CSS-only (demo-playback.css).
 *
 * Strict read-only contract:
 *   - no <button>, <form>, <input>, <select>, <a>
 *   - no execute, approve, or mutation affordances
 *   - no recording, voice, narration, or export hooks
 */

export interface DemoPlaybackProps {
  script: DemoScript;
  /**
   * Logical playback time in milliseconds. The renderer (or a test)
   * supplies elapsed_ms — the component is otherwise time-agnostic.
   */
  elapsedMs?: number;
  /** Optional pre-computed snapshot — overrides elapsedMs when present. */
  snapshot?: DemoPlaybackSnapshot;
}

function materialisedSet(stage: DemoAssemblyStage): string {
  const labels: string[] = [];
  const order = ASSEMBLY_STAGE_ORDER;
  const reached = order.indexOf(stage);
  if (reached < 0) return "";
  // Stones materialise in the order they appear in the sequence.
  const stones = ["orb", "space", "time", "mind", "soul", "reality", "power"];
  for (const stone of stones) {
    const idx = order.indexOf(stone as DemoAssemblyStage);
    if (idx >= 0 && idx <= reached) labels.push(stone);
  }
  if (reached >= order.indexOf("human_gate")) labels.push("human-gate");
  return labels.join(" ");
}

function activeStoneTargets(cues: readonly DemoCue[]): string {
  const targets = new Set<string>();
  for (const cue of cues) {
    if (cue.target) targets.add(cue.target);
  }
  return Array.from(targets).join(" ");
}

export function DemoPlayback({
  script,
  elapsedMs = 0,
  snapshot,
}: DemoPlaybackProps) {
  const current = snapshot ?? playbackSnapshot(script, elapsedMs);
  const materialised = materialisedSet(current.assembly_stage);
  const activeTargets = activeStoneTargets(current.active_cues);
  const climax = current.assembly_stage === "human_gate";

  return (
    <section
      aria-label={`JARVIS Demo Playback — ${script.title}`}
      role="region"
      data-demo-playback="read-only"
      data-demo-state={current.state}
      data-demo-stage={current.assembly_stage}
      data-demo-materialised={materialised}
      data-demo-active-targets={activeTargets}
      data-demo-climax={String(climax)}
      data-demo-audience={script.audience}
      data-demo-script-id={script.script_id}
      data-execute-affordance-present={String(
        current.execute_affordance_present,
      )}
      data-approve-affordance-present={String(
        current.approve_affordance_present,
      )}
      data-mutation-affordance-present={String(
        current.mutation_affordance_present,
      )}
      data-recording-enabled={String(current.recording_enabled)}
      data-voice-enabled={String(current.voice_enabled)}
      data-export-enabled={String(current.export_enabled)}
      className="grid w-full gap-6 border border-border-subtle bg-panel p-6 shadow-cockpit-depth"
    >
      <header className="grid gap-2">
        <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-signal">
          Demo Director · playback · read only
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {script.title}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-ink/70">
          {script.subtitle}
        </p>
        <p
          data-demo-stage-label="true"
          className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-ink/55"
        >
          Stage · {current.assembly_stage} · State · {current.state}
        </p>
      </header>

      <div data-demo-stage-target="governed-pipeline">
        <PipelineDiagram />
      </div>

      <footer className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-ink/45">
        Read-only playback · no recording · no voice · no narration · no exports
        · no ffmpeg
      </footer>
    </section>
  );
}
