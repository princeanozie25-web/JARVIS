import {
  buildPipelineViewModel,
  type PipelineStageId,
  type PipelineViewModel,
} from "@/lib/pipeline-visualization";

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
}

export function PipelineDiagram({
  viewModel = buildPipelineViewModel(),
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
      className="grid w-full gap-8 border border-border-subtle bg-panel p-6 shadow-cockpit-depth sm:p-10"
    >
      <header data-pipeline-region="header" className="grid gap-3">
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
        className="grid gap-4 lg:grid-cols-6"
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
        className="grid gap-3"
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
              className="flex flex-col gap-1 border border-border-subtle bg-panel-soft px-3 py-2 text-sm text-ink/80 sm:flex-row sm:items-center sm:justify-between"
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
                <span className="font-display text-sm">{edge.label}</span>
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
        className="grid gap-3"
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
              className="relative border border-blocked/60 bg-panel-soft px-3 py-3 text-sm"
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
        className="grid gap-3"
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
              className="border border-border-subtle bg-panel-soft px-3 py-2"
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

      <footer
        data-pipeline-region="footer"
        className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-ink/45"
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
      className={`relative border bg-panel-soft p-4 ${
        isGate ? "lg:col-span-2 lg:scale-[1.04] border-2" : "border"
      }`}
      style={{
        borderColor: palette.cssVar,
        boxShadow: isGate
          ? `0 0 0 ${"var(--jarvis-focus-ring-width)"} ${palette.cssVar}, 0 18px 60px rgba(2,6,23,0.45)`
          : undefined,
      }}
    >
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
      <p className="mt-2 text-xs leading-5 text-ink/70">{stage.description}</p>
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
          className="mt-2 grid gap-1 border border-blocked/30 bg-panel px-2 py-1 text-[0.66rem] text-blocked"
        >
          {stage.disabled_feature_notes.map((note) => (
            <li key={note}>✕ {note}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
