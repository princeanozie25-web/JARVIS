import {
  buildPipelineViewModel,
  type PipelineStageId,
  type PipelineViewModel,
} from "@/lib/pipeline-visualization";
import {
  buildLaneViewModel,
  PIPELINE_LANES,
  type PipelineLaneViewModel,
} from "@/lib/pipeline-visualization/lane-registry";

import "./pipeline-map.css";

/**
 * PipelineDiagram — UI.10, restyled to the capstone language (AP-J4).
 *
 * Read-only governance visualization of the Phase 21K pipeline contract:
 *
 *   Capture → Classify → Route → Human Gate → Execute → Audit
 *
 * Color law (inherited from AP-J1, not restated): amber marks
 * Gate-touching state ONLY — the Human Gate's position in the flow, the
 * pending checkpoint on its approach, gated transitions. Flow/progress
 * rides the emerald→sky range. Forbidden edges use the blocked register.
 * Everything else is neutral structure.
 *
 * The map is SVG (addressable, testable), never canvas. Provenance is
 * honest per panel: this topology is the DESIGN — the map of the rules —
 * never presented as runtime traffic (real-vs-synthetic ledger, Surface 5).
 *
 * No buttons. No actions. No controls. Read-only.
 */

const STAGE_GLYPH: Readonly<Record<PipelineStageId, string>> = Object.freeze({
  capture: "●",
  classify: "◆",
  route: "◇",
  human_gate: "■",
  execute: "▲",
  audit: "○",
});

/* Map geometry — deterministic, derived from stage order alone. */
const MAP_W = 1240;
const MAP_H = 300;
const NODE_W = 168;
const NODE_H = 96;
const NODE_Y = 46;
const NODE_GAP = (MAP_W - 40 * 2 - NODE_W * 6) / 5;

function nodeX(index: number): number {
  return 40 + index * (NODE_W + NODE_GAP);
}

export interface PipelineDiagramProps {
  viewModel?: PipelineViewModel;
  laneViewModels?: readonly PipelineLaneViewModel[];
}

export function PipelineDiagram({
  viewModel = buildPipelineViewModel(),
  laneViewModels = PIPELINE_LANES.map((lane) => buildLaneViewModel(lane)),
}: PipelineDiagramProps) {
  const forbiddenEdges = viewModel.edges.filter(
    (edge) => edge.policy === "forbidden",
  );
  const allowedAndGatedEdges = viewModel.edges.filter(
    (edge) => edge.policy !== "forbidden",
  );
  const stageIndex = new Map(
    viewModel.stages.map((stage, index) => [stage.stage_id, index]),
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
      className="plm-root"
    >
      <header data-pipeline-region="header" className="grid gap-3">
        <p className="plm-eyebrow">Pipeline visualization · read only</p>
        <h1 className="plm-title">{viewModel.title}</h1>
        <p className="plm-body">{viewModel.subtitle}</p>
        <p
          className="jcc-honest plm-honest"
          data-honest-state="synthetic"
          data-panel-provenance="synthetic-by-design"
        >
          governance topology — the map of the rules, not runtime traffic
        </p>
      </header>

      <figure
        data-pipeline-region="map"
        aria-label="Operating map — the six-stage governed spine"
        className="plm-map"
      >
        <svg
          data-pipeline-map="true"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          role="img"
          aria-label="Capture flows to Classify, Route, the Human Gate, Execute, then Audit. Forbidden shortcuts are drawn severed beneath the spine."
        >
          <defs>
            {/* userSpaceOnUse: a bbox gradient on a horizontal line has a
                zero-height box and vanishes; this also lets the whole spine
                read emerald at capture -> sky at audit */}
            <linearGradient
              id="plm-flow"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={MAP_W}
              y2="0"
            >
              <stop offset="0%" stopColor="var(--jarvis-color-emerald-local)" />
              <stop offset="100%" stopColor="var(--jarvis-color-sky-focus)" />
            </linearGradient>
          </defs>

          {/* spine edges — flow in emerald→sky; the approach INTO the Gate
              is the pending checkpoint, so that hop alone is amber */}
          {viewModel.stages.slice(0, -1).map((stage, index) => {
            const next = viewModel.stages[index + 1];
            const gateTouching = next.stage_id === "human_gate";
            const x1 = nodeX(index) + NODE_W;
            const x2 = nodeX(index + 1);
            const y = NODE_Y + NODE_H / 2;
            return (
              <g
                key={`spine-${stage.stage_id}`}
                data-map-edge={`${stage.stage_id}--${next.stage_id}`}
                data-map-edge-tone={gateTouching ? "gate" : "flow"}
              >
                <line
                  className={gateTouching ? "plm-edge-gated" : "plm-edge-flow"}
                  stroke={gateTouching ? undefined : "url(#plm-flow)"}
                  x1={x1}
                  y1={y}
                  x2={x2 - 8}
                  y2={y}
                />
                <polygon
                  className={gateTouching ? "plm-checkpoint--gate" : undefined}
                  fill={gateTouching ? undefined : "url(#plm-flow)"}
                  stroke="none"
                  points={`${x2 - 8},${y - 5} ${x2},${y} ${x2 - 8},${y + 5}`}
                />
                {gateTouching && (
                  <rect
                    data-map-checkpoint="pending-approval"
                    className="plm-checkpoint--gate"
                    x={(x1 + x2) / 2 - 5}
                    y={y - 5}
                    width={10}
                    height={10}
                    transform={`rotate(45 ${(x1 + x2) / 2} ${y})`}
                  />
                )}
              </g>
            );
          })}

          {/* stage nodes — neutral structure; the Gate alone wears amber */}
          {viewModel.stages.map((stage, index) => {
            const isGate = stage.stage_id === "human_gate";
            const x = nodeX(index);
            return (
              <g
                key={stage.stage_id}
                data-map-stage={stage.stage_id}
                data-map-tone={isGate ? "gate" : "calm"}
              >
                <rect
                  className={
                    isGate ? "plm-node-box plm-node-box--gate" : "plm-node-box"
                  }
                  x={x}
                  y={NODE_Y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                />
                <text className="plm-node-glyph" x={x + 14} y={NODE_Y + 26}>
                  {STAGE_GLYPH[stage.stage_id]}
                </text>
                <text className="plm-node-id" x={x + 34} y={NODE_Y + 25}>
                  {stage.stage_id.replaceAll("_", " ")}
                </text>
                <text className="plm-node-label" x={x + 14} y={NODE_Y + 52}>
                  {stage.label}
                </text>
                <text className="plm-node-status" x={x + 14} y={NODE_Y + 74}>
                  {stage.status.replaceAll("_", " ")}
                </text>
                {isGate && (
                  <text
                    className="plm-node-tag--gate"
                    x={x + NODE_W - 14}
                    y={NODE_Y + 25}
                    textAnchor="end"
                  >
                    GATE
                  </text>
                )}
              </g>
            );
          })}

          {/* forbidden shortcuts — severed beneath the spine */}
          {forbiddenEdges.map((edge, index) => {
            const fromIdx = stageIndex.get(edge.from_stage_id) ?? 0;
            const toIdx = stageIndex.get(edge.to_stage_id) ?? 0;
            const x1 = nodeX(fromIdx) + NODE_W / 2;
            const x2 = nodeX(toIdx) + NODE_W / 2;
            const yBase = NODE_Y + NODE_H;
            const dip = 44 + index * 22;
            const midX = (x1 + x2) / 2;
            return (
              <g
                key={edge.transition_id}
                data-map-forbidden={edge.transition_id}
              >
                <path
                  className="plm-edge-forbidden"
                  d={`M ${x1} ${yBase} Q ${midX} ${yBase + dip * 2} ${x2} ${yBase}`}
                />
                <text
                  className="plm-forbidden-mark"
                  x={midX}
                  y={yBase + dip + 4}
                  textAnchor="middle"
                >
                  ✕
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption
          className="jcc-honest plm-honest"
          data-honest-state="synthetic"
        >
          static governance topology (phase 21k contract) — positions and edges
          are the design, not live traffic
        </figcaption>
      </figure>

      <ol
        aria-label="Pipeline stages"
        data-pipeline-region="stages"
        className="grid gap-4 lg:grid-cols-6"
      >
        {viewModel.stages.map((stage) => (
          <PipelineStageCard key={stage.stage_id} stage={stage} />
        ))}
      </ol>

      <section
        aria-label="Allowed and gated transitions"
        data-pipeline-region="transitions-allowed"
        className="grid gap-3"
      >
        <p className="plm-eyebrow">Designed transitions</p>
        <ul className="grid gap-2">
          {allowedAndGatedEdges.map((edge) => (
            <li
              key={edge.transition_id}
              data-transition-id={edge.transition_id}
              data-transition-policy={edge.policy}
              data-transition-treatment={edge.visual_treatment}
              className={`flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between ${
                edge.policy === "gated"
                  ? "plm-row plm-row--gated"
                  : "plm-row plm-row--ok"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={
                    edge.policy === "gated" ? "plm-mark-gate" : "plm-mark-ok"
                  }
                >
                  {edge.policy === "gated" ? "[ GATE ]" : "[ OK ]"}
                </span>
                <span className="plm-data text-sm">{edge.label}</span>
              </div>
              <span className="plm-mono">
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
            className="plm-mark-blocked inline-flex h-6 w-6 items-center justify-center"
            style={{ color: "var(--jarvis-color-pipeline-forbidden)" }}
          >
            ✕
          </span>
          <p className="plm-mark-blocked">
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
              className="plm-row plm-row--blocked text-sm"
              style={{
                borderLeftColor: "var(--jarvis-color-pipeline-forbidden)",
              }}
            >
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="plm-mark-blocked">
                  [ BLOCKED ]
                </span>
                <span className="sr-only jarvis-sr-only">
                  Forbidden transition:
                </span>
                <span className="plm-data text-sm line-through">
                  {edge.label}
                </span>
              </div>
              <p className="plm-body mt-2 text-[0.75rem] leading-5">
                {edge.governance_note}
              </p>
              <p className="plm-mono mt-1">
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
        <p className="plm-eyebrow">Governance boundaries</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {viewModel.boundaries.map((boundary) => (
            <li
              key={boundary.boundary_id}
              data-boundary-id={boundary.boundary_id}
              data-boundary-kind={boundary.kind}
              className="plm-tile"
            >
              <p className="plm-mono">{boundary.kind.replaceAll("_", " ")}</p>
              <p className="plm-data mt-1 text-sm">{boundary.label}</p>
              <p className="plm-body mt-1 text-xs leading-5">
                {boundary.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {laneViewModels.map((lane) => (
        <section
          key={lane.lane_id}
          aria-label={`${lane.label} activity`}
          data-pipeline-region={`lane-${lane.lane_id}`}
          data-lane-authoritative-surface={lane.authoritative_surface}
          data-lane-synthetic-fixture={String(lane.synthetic_fixture)}
          data-execute-affordance-present={String(
            lane.execute_affordance_present,
          )}
          data-approve-affordance-present={String(
            lane.approve_affordance_present,
          )}
          data-mutation-affordance-present={String(
            lane.mutation_affordance_present,
          )}
          className="grid gap-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="plm-eyebrow">{lane.label} activity</p>
            <p
              className="jcc-honest plm-honest"
              data-honest-state={lane.synthetic_fixture ? "synthetic" : "live"}
            >
              {lane.synthetic_fixture
                ? "synthetic — deterministic fixture, labelled by design"
                : "live — metadata-only projection"}
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lane.items.map((item) => (
              <li
                key={item.item_id}
                data-lane-item={item.kind}
                data-lane-stage={item.stage_id}
                data-lane-tier={item.tier ?? "none"}
                data-lane-state={item.state}
                data-raw-audio-included={String(item.raw_audio_included)}
                data-transcript-included={String(item.transcript_included)}
                data-executable-payload-included={String(
                  item.executable_payload_included,
                )}
                className="plm-tile"
              >
                <p className="plm-mono">
                  {[item.tier, item.state].filter(Boolean).join(" · ")}
                </p>
                <p className="plm-data mt-1 text-sm">{item.label}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer data-pipeline-region="footer" className="plm-mono">
        Read-only governance surface. No execute, no approve, no mutate.
      </footer>
    </section>
  );
}

interface StageCardProps {
  stage: PipelineViewModel["stages"][number];
}

function PipelineStageCard({ stage }: StageCardProps) {
  const isGate = stage.stage_id === "human_gate";
  return (
    <li
      data-pipeline-stage-id={stage.stage_id}
      data-pipeline-stage-status={stage.status}
      data-approval-gate-visible={String(stage.approval_gate_visible)}
      data-execution-boundary-visible={String(stage.execution_boundary_visible)}
      data-emphasis={isGate ? "primary" : "secondary"}
      className={isGate ? "plm-card plm-card--gate lg:col-span-2" : "plm-card"}
    >
      {isGate && (
        <span
          aria-label="Approval boundary — strongest emphasis"
          data-emphasis-badge="human-gate"
          className="plm-badge--gate"
        >
          <span aria-hidden="true">■</span>
          Approval gate
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="plm-mono text-base"
          style={
            isGate
              ? { color: "var(--jarvis-color-pipeline-human-gate)" }
              : undefined
          }
        >
          {STAGE_GLYPH[stage.stage_id]}
        </span>
        <p
          className="plm-mono"
          style={
            isGate
              ? { color: "var(--jarvis-color-pipeline-human-gate)" }
              : undefined
          }
        >
          {stage.stage_id.replaceAll("_", " ")}
        </p>
      </div>
      <h2 className={`plm-data mt-2 ${isGate ? "text-2xl" : "text-lg"}`}>
        {stage.label}
      </h2>
      <p className="plm-body mt-2 text-xs leading-5">{stage.description}</p>
      <dl className="mt-3 grid gap-1 text-[0.7rem]">
        <div className="flex items-center justify-between">
          <dt className="plm-mono">Status</dt>
          <dd className="plm-data text-xs">
            {stage.status.replaceAll("_", " ")}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="plm-mono">Approval gate</dt>
          <dd
            data-approval-required={String(stage.approval_gate_visible)}
            className="plm-data text-xs"
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
          <dt className="plm-mono">Execution boundary</dt>
          <dd
            data-execution-enabled={String(stage.execution_boundary_visible)}
            className="plm-data text-xs"
          >
            {stage.execution_boundary_visible ? "Visible" : "—"}
          </dd>
        </div>
      </dl>
      {stage.governance_notes.length > 0 && (
        <ul className="plm-body mt-3 grid gap-1 text-[0.68rem]">
          {stage.governance_notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
      {stage.disabled_feature_notes.length > 0 && (
        <ul
          aria-label={`${stage.label} disabled features`}
          className="plm-row plm-row--blocked mt-2 grid gap-1 text-[0.66rem]"
        >
          {stage.disabled_feature_notes.map((note) => (
            <li key={note} className="plm-mark-blocked normal-case">
              ✕ {note}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
