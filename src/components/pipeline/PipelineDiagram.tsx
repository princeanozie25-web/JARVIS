import {
  buildPipelineViewModel,
  type PipelineStageId,
  type PipelineViewModel,
} from "@/lib/pipeline-visualization";
import {
  buildVoicePipelineVisibilityModel,
  type VoicePipelineVisibilityModel,
} from "@/lib/voice-operating-mode/pipeline-visibility";

/**
 * PipelineDiagram — UI.10.
 *
 * Read-only governance visualization that turns the existing Phase
 * 21K pipeline contract into a visual story:
 *
 *   Capture → Classify → Route → Human Gate → Execute → Audit
 *
 * Stage palette and emphasis follow the UI Polish Plan:
 *
 *   capture        cyan signal
 *   classify       sky focus
 *   route          violet
 *   human_gate     amber review — strongest emphasis, obvious gate
 *   execute        emerald local
 *   audit          neutral ink
 *
 * Forbidden edges are immediately visible in rose. Graphify
 * compatibility is preserved because the diagram consumes the
 * existing `buildPipelineViewModel()` output unchanged.
 *
 * No buttons. No actions. No controls. Read-only.
 */

interface StagePalette {
  cssVar: string;
  semanticToken:
    | "signal"
    | "focus"
    | "local"
    | "review"
    | "blocked"
    | "ink"
    | "violet";
  glyph: string;
}

const STAGE_PALETTE: Readonly<Record<PipelineStageId, StagePalette>> =
  Object.freeze({
    capture: {
      cssVar: "var(--jarvis-color-pipeline-capture)",
      semanticToken: "signal",
      glyph: "●",
    },
    classify: {
      cssVar: "var(--jarvis-color-pipeline-classify)",
      semanticToken: "focus",
      glyph: "◆",
    },
    route: {
      cssVar: "var(--jarvis-color-pipeline-route)",
      semanticToken: "violet",
      glyph: "◇",
    },
    human_gate: {
      cssVar: "var(--jarvis-color-pipeline-human-gate)",
      semanticToken: "review",
      glyph: "■",
    },
    execute: {
      cssVar: "var(--jarvis-color-pipeline-execute)",
      semanticToken: "local",
      glyph: "▲",
    },
    audit: {
      cssVar: "var(--jarvis-color-pipeline-audit)",
      semanticToken: "ink",
      glyph: "○",
    },
  });

export interface PipelineDiagramProps {
  viewModel?: PipelineViewModel;
  voiceModel?: VoicePipelineVisibilityModel;
}

export function PipelineDiagram({
  viewModel = buildPipelineViewModel(),
  voiceModel = buildVoicePipelineVisibilityModel(),
}: PipelineDiagramProps) {
  const forbiddenEdges = viewModel.edges.filter(
    (edge) => edge.policy === "forbidden",
  );
  const allowedAndGatedEdges = viewModel.edges.filter(
    (edge) => edge.policy !== "forbidden",
  );

  return (
    <section
      aria-label="Governed pipeline visualization"
      role="region"
      data-pipeline-diagram="read-only"
      data-pipeline-stage-count={String(viewModel.stages.length)}
      data-execute-affordance-present={String(
        viewModel.execute_affordance_present,
      )}
      data-approve-affordance-present={String(
        viewModel.approve_affordance_present,
      )}
      data-mutation-affordance-present={String(
        viewModel.mutation_affordance_present,
      )}
      className="relative grid w-full gap-8 overflow-hidden border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(8,18,38,0.82),rgba(2,6,23,0.96))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 motion-safe:animate-[cc-atmosphere-drift_22s_linear_infinite] [background:radial-gradient(circle_at_20%_8%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_72%_20%,rgba(245,158,11,0.12),transparent_26%),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px)] [background-size:auto,auto,48px_48px,48px_48px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-transparent opacity-80 blur-[1px]"
      />
      <header data-pipeline-region="header" className="relative grid gap-3">
        <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-signal">
          Pipeline visualization · read only
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {viewModel.title}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-ink/70">
          {viewModel.subtitle}
        </p>
      </header>

      <ol
        aria-label="Pipeline stages"
        data-pipeline-region="stages"
        className="relative grid gap-4 lg:grid-cols-6"
      >
        {viewModel.stages.map((stage) => (
          <PipelineStageCard
            key={stage.stage_id}
            stage={stage}
            palette={STAGE_PALETTE[stage.stage_id]}
          />
        ))}
      </ol>

      <section
        aria-label="Allowed and gated transitions"
        data-pipeline-region="transitions-allowed"
        className="relative grid gap-3"
      >
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-signal">
          Designed transitions
        </p>
        <ul className="grid gap-2">
          {allowedAndGatedEdges.map((edge) => (
            <li
              key={edge.transition_id}
              data-transition-id={edge.transition_id}
              data-transition-policy={edge.policy}
              data-transition-treatment={edge.visual_treatment}
              className="group flex flex-col gap-1 border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-2 text-sm text-ink/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_38px_rgba(8,47,73,0.12)] backdrop-blur-md transition duration-500 hover:border-cyan-200/30 hover:bg-cyan-200/[0.07] sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderLeftColor:
                  edge.policy === "gated"
                    ? "var(--jarvis-color-pipeline-human-gate)"
                    : "var(--jarvis-color-pipeline-execute)",
                borderLeftWidth: "3px",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[0.7rem] uppercase tracking-[0.18em]"
                  style={{
                    color:
                      edge.policy === "gated"
                        ? "var(--jarvis-color-pipeline-human-gate)"
                        : "var(--jarvis-color-pipeline-execute)",
                  }}
                >
                  {edge.policy === "gated" ? "[ GATE ]" : "[ OK ]"}
                </span>
                <span className="font-display text-sm transition duration-500 group-hover:text-white">
                  {edge.label}
                </span>
              </div>
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink/50">
                {edge.from_stage_id} → {edge.to_stage_id}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Forbidden transitions"
        data-pipeline-region="transitions-forbidden"
        className="relative grid gap-3"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center border border-blocked font-mono text-xs font-bold"
            style={{ color: "var(--jarvis-color-pipeline-forbidden)" }}
          >
            ✕
          </span>
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-blocked">
            Forbidden edges · disabled by design
          </p>
        </div>
        <ul className="grid gap-2">
          {forbiddenEdges.map((edge) => (
            <li
              key={edge.transition_id}
              data-transition-id={edge.transition_id}
              data-transition-policy={edge.policy}
              data-transition-treatment={edge.visual_treatment}
              data-forbidden="true"
              className="relative border border-blocked/50 bg-rose-950/[0.18] px-3 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_44px_rgba(244,63,94,0.12)] backdrop-blur-md"
              style={{
                borderLeftWidth: "4px",
                borderLeftColor: "var(--jarvis-color-pipeline-forbidden)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-blocked"
                >
                  [ BLOCKED ]
                </span>
                <span className="sr-only jarvis-sr-only">
                  Forbidden transition:
                </span>
                <span className="font-display text-sm text-ink line-through decoration-blocked decoration-2">
                  {edge.label}
                </span>
              </div>
              <p className="mt-2 text-[0.75rem] leading-5 text-ink/65">
                {edge.governance_note}
              </p>
              <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-blocked/80">
                {edge.from_stage_id} ⇸ {edge.to_stage_id} · disabled
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Governance boundaries"
        data-pipeline-region="boundaries"
        className="relative grid gap-3"
      >
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-signal">
          Governance boundaries
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {viewModel.boundaries.map((boundary) => (
            <li
              key={boundary.boundary_id}
              data-boundary-id={boundary.boundary_id}
              data-boundary-kind={boundary.kind}
              className="border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_38px_rgba(8,47,73,0.1)] backdrop-blur-md"
            >
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink/55">
                {boundary.kind.replaceAll("_", " ")}
              </p>
              <p className="mt-1 font-display text-sm text-ink">
                {boundary.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink/65">
                {boundary.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Voice activity"
        data-pipeline-region="voice-activity"
        data-voice-pipeline-authoritative-surface={
          voiceModel.authoritative_surface
        }
        className="relative grid gap-3"
      >
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-signal">
          Voice activity
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {voiceModel.events.map((event) => (
            <li
              key={event.event_id}
              data-voice-pipeline-event={event.kind}
              data-voice-tier={event.tier}
              data-voice-state={event.state}
              data-raw-audio-included={String(event.raw_audio_included)}
              data-transcript-included={String(event.transcript_included)}
              data-executable-payload-included={String(
                event.executable_payload_included,
              )}
              className="border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_38px_rgba(8,47,73,0.1)] backdrop-blur-md"
            >
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink/55">
                {event.tier} · {event.state}
              </p>
              <p className="mt-1 font-display text-sm text-ink">
                {event.label}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <footer
        data-pipeline-region="footer"
        className="relative font-mono text-[0.62rem] uppercase tracking-[0.24em] text-ink/45"
      >
        Read-only governance surface. No execute, no approve, no mutate.
      </footer>
    </section>
  );
}

interface StageCardProps {
  stage: PipelineViewModel["stages"][number];
  palette: StagePalette;
}

function PipelineStageCard({ stage, palette }: StageCardProps) {
  const isGate = stage.stage_id === "human_gate";
  return (
    <li
      data-pipeline-stage-id={stage.stage_id}
      data-pipeline-stage-status={stage.status}
      data-approval-gate-visible={String(stage.approval_gate_visible)}
      data-execution-boundary-visible={String(stage.execution_boundary_visible)}
      data-emphasis={isGate ? "primary" : "secondary"}
      className={`group relative overflow-hidden border bg-[linear-gradient(145deg,rgba(15,23,42,0.7),rgba(2,6,23,0.9))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_55px_rgba(0,0,0,0.32)] backdrop-blur-xl transition duration-700 hover:-translate-y-1 hover:bg-cyan-100/[0.065] ${
        isGate ? "lg:col-span-2 lg:scale-[1.04] border-2" : "border"
      }`}
      style={{
        borderColor: palette.cssVar,
        boxShadow: isGate
          ? `0 0 0 ${"var(--jarvis-focus-ring-width)"} ${palette.cssVar}, 0 0 90px rgba(245,158,11,0.28), 0 24px 80px rgba(2,6,23,0.72)`
          : `0 0 34px color-mix(in srgb, ${palette.cssVar} 14%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rotate-45 opacity-20 blur-2xl transition duration-700 group-hover:opacity-35 motion-safe:animate-pulse"
        style={{ backgroundColor: palette.cssVar }}
      />
      {isGate && (
        <span
          aria-label="Approval boundary — strongest emphasis"
          data-emphasis-badge="human-gate"
          className="absolute -top-3 left-3 inline-flex items-center gap-2 border bg-panel px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em]"
          style={{
            color: palette.cssVar,
            borderColor: palette.cssVar,
          }}
        >
          <span aria-hidden="true">■</span>
          Approval gate
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="font-mono text-base"
          style={{ color: palette.cssVar }}
        >
          {palette.glyph}
        </span>
        <p
          className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em]"
          style={{ color: palette.cssVar }}
        >
          {stage.stage_id.replaceAll("_", " ")}
        </p>
      </div>
      <h2
        className={`mt-2 font-display font-semibold text-ink ${
          isGate ? "text-2xl" : "text-lg"
        }`}
      >
        {stage.label}
      </h2>
      <p className="mt-2 text-xs leading-5 text-ink/72">{stage.description}</p>
      <dl className="mt-3 grid gap-1 text-[0.7rem]">
        <div className="flex items-center justify-between">
          <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
            Status
          </dt>
          <dd className="text-ink">{stage.status.replaceAll("_", " ")}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
            Approval gate
          </dt>
          <dd
            data-approval-required={String(stage.approval_gate_visible)}
            className="text-ink"
            style={{
              color: stage.approval_gate_visible
                ? "var(--jarvis-color-pipeline-human-gate)"
                : undefined,
            }}
          >
            {stage.approval_gate_visible ? "Required" : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
            Execution boundary
          </dt>
          <dd
            data-execution-enabled={String(stage.execution_boundary_visible)}
            className="text-ink"
            style={{
              color: stage.execution_boundary_visible
                ? "var(--jarvis-color-pipeline-execute)"
                : undefined,
            }}
          >
            {stage.execution_boundary_visible ? "Visible" : "—"}
          </dd>
        </div>
      </dl>
      {stage.governance_notes.length > 0 && (
        <ul className="mt-3 grid gap-1 text-[0.68rem] text-ink/60">
          {stage.governance_notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
      {stage.disabled_feature_notes.length > 0 && (
        <ul
          aria-label={`${stage.label} disabled features`}
          className="mt-2 grid gap-1 border border-blocked/30 bg-rose-950/[0.22] px-2 py-1 text-[0.66rem] text-blocked"
        >
          {stage.disabled_feature_notes.map((note) => (
            <li key={note}>✕ {note}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
