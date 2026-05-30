import {
  assertArchitectureGraphProjectionSafe,
  buildArchitectureGraphProjection,
  buildArchitectureGraphProjectionStats,
  getArchitectureNodeDependencies,
  getArchitectureNodeDependents,
  listArchitectureGraphProjectionWarnings,
  summarizeArchitectureNode,
  type ArchitectureGraphNodeSummary,
  type ArchitectureGraphProjection,
  type ArchitectureGraphProjectionEdge,
  type ArchitectureGraphProjectionStats,
  type ArchitectureGraphProjectionWarning,
} from "@/lib/architecture-graph";

const SUMMARY_NODE_IDS = [
  "arch-node:approval-runtime",
  "arch-node:command-center",
  "arch-node:architecture-graph",
] as const;

export interface ArchitectureGraphViewerSummary {
  node_id: string;
  label: string;
  dependency_labels: readonly string[];
  dependent_labels: readonly string[];
  summary: ArchitectureGraphNodeSummary;
}

export interface ArchitectureGraphViewerModel {
  projection: ArchitectureGraphProjection;
  stats: ArchitectureGraphProjectionStats;
  warnings: readonly ArchitectureGraphProjectionWarning[];
  summaries: readonly ArchitectureGraphViewerSummary[];
  projection_safety_checked: true;
  metadata_only: true;
  read_only: true;
}

export function buildArchitectureGraphViewerModel(): ArchitectureGraphViewerModel {
  const projection = buildArchitectureGraphProjection();
  assertArchitectureGraphProjectionSafe(projection);

  return {
    projection,
    stats: buildArchitectureGraphProjectionStats(),
    warnings: listArchitectureGraphProjectionWarnings(),
    summaries: SUMMARY_NODE_IDS.map((nodeId) => {
      const summary = summarizeArchitectureNode(nodeId);
      if (!summary) {
        throw new Error(`Missing architecture graph summary for ${nodeId}`);
      }

      return {
        node_id: nodeId,
        label: summary.node.label,
        dependency_labels: getArchitectureNodeDependencies(nodeId).map(
          (node) => node.label,
        ),
        dependent_labels: getArchitectureNodeDependents(nodeId).map(
          (node) => node.label,
        ),
        summary,
      };
    }),
    projection_safety_checked: true,
    metadata_only: true,
    read_only: true,
  };
}

export function ArchitectureGraphViewer() {
  const model = buildArchitectureGraphViewerModel();
  const { projection, stats, warnings, summaries } = model;

  return (
    <main
      data-architecture-graph-viewer="read-only"
      data-metadata-only={String(model.metadata_only)}
      data-read-only={String(model.read_only)}
      data-projection-safety-checked={String(model.projection_safety_checked)}
      className="min-h-screen bg-[#02040a] px-6 py-8 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:72px_72px]"
      />
      <div className="relative mx-auto grid max-w-7xl gap-6">
        <header className="border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.36)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
            Phase 19A visibility surface
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Architecture Graph
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/75">
                Read-only subsystem map for designed dependencies, governance
                boundaries, and tripwire metadata.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[36rem]">
              <Stat label="Nodes" value={stats.node_count} />
              <Stat label="Edges" value={stats.edge_count} />
              <Stat label="Tripwires" value={stats.forbidden_edge_count} />
              <Stat label="Governed" value={stats.governance_edge_count} />
            </dl>
          </div>
        </header>

        <section
          aria-label="Architecture graph projection stats"
          className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          <Stat label="Read edges" value={stats.read_edge_count} />
          <Stat label="Write edges" value={stats.write_edge_count} />
          <Stat label="Static edges" value={stats.static_edge_count} />
          <Stat label="Observed edges" value={stats.observed_edge_count} />
          <Stat label="Discrepancies" value={stats.discrepancy_count} />
          <Stat label="Safety" value="checked" />
        </section>

        <section
          aria-label="Architecture graph node groups"
          className="grid gap-4 xl:grid-cols-2"
        >
          {projection.groups.map((group) => {
            const nodes = group.node_ids
              .map((nodeId) =>
                projection.nodes.find((node) => node.id === nodeId),
              )
              .filter((node) => !!node);

            return (
              <section
                key={group.id}
                aria-label={`${group.label} nodes`}
                className="border border-white/10 bg-slate-950/62 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-xl font-semibold text-white">
                    {group.label}
                  </h2>
                  <span className="border border-cyan-100/15 bg-cyan-300/[0.045] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/80">
                    {nodes.length} nodes
                  </span>
                </div>
                <ul className="mt-4 grid gap-3">
                  {nodes.map((node) => (
                    <li
                      key={node.id}
                      className="border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-100">
                            {node.label}
                          </h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                            {formatToken(node.kind)} · {node.health}
                          </p>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <MiniStat
                            label="In"
                            value={node.inbound_edge_count}
                          />
                          <MiniStat
                            label="Out"
                            value={node.outbound_edge_count}
                          />
                          <MiniStat
                            label="Gov"
                            value={node.governance_edge_count}
                          />
                          <MiniStat
                            label="Trip"
                            value={node.forbidden_edge_count}
                          />
                        </dl>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </section>

        <section
          aria-label="Architecture graph edges"
          className="border border-white/10 bg-slate-950/62 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Edges</h2>
            <span className="border border-slate-100/15 bg-slate-300/[0.035] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-slate-200/70">
              metadata links
            </span>
          </div>
          <ul className="mt-4 grid gap-2 lg:grid-cols-2">
            {projection.edges.map((edge) => (
              <li
                key={edge.id}
                className="border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300"
              >
                <span className="font-medium text-slate-100">
                  {safeEdgeLabel(edge)}
                </span>
                <span className="ml-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {formatToken(edge.kind)} · {formatToken(edge.layer)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-label="Architecture graph legend"
          className="border border-white/10 bg-slate-950/62 p-5"
        >
          <h2 className="text-xl font-semibold text-white">Legend</h2>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {projection.legend.map((item) => (
              <div
                key={item.edge_kind}
                className="border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {formatToken(item.display_style_token)}
                </dt>
                <dd className="mt-1 text-sm text-slate-200">
                  {safeLegendLabel(item.edge_kind)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-label="Architecture graph tripwire warnings"
          className="border border-amber-100/15 bg-amber-300/[0.045] p-5"
        >
          <h2 className="text-xl font-semibold text-amber-50">
            Tripwire Warnings
          </h2>
          <ul className="mt-4 grid gap-2">
            {warnings.map((warning) => (
              <li
                key={warning.id}
                className="border border-amber-100/15 bg-black/20 px-3 py-2 text-sm text-amber-50/85"
              >
                {safeWarningLabel(warning)}
                <span className="ml-2 text-xs uppercase tracking-[0.14em] text-amber-100/55">
                  warning only
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-label="Architecture graph dependency summaries"
          className="grid gap-4 lg:grid-cols-3"
        >
          {summaries.map((summary) => (
            <article
              key={summary.node_id}
              className="border border-white/10 bg-slate-950/62 p-5"
            >
              <h2 className="text-lg font-semibold text-white">
                {summary.label}
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <MiniStat
                  label="Dependencies"
                  value={summary.summary.dependency_count}
                />
                <MiniStat
                  label="Dependents"
                  value={summary.summary.dependent_count}
                />
              </dl>
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">
                Depends on
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {formatList(summary.dependency_labels)}
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">
                Used by
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {formatList(summary.dependent_labels)}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-2 py-1">
      <dt className="uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}

function formatToken(value: string): string {
  return value.replaceAll("_", " ");
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

function safeLegendLabel(edgeKind: string): string {
  switch (edgeKind) {
    case "depends_on":
      return "Dependency";
    case "reads_from":
      return "Read path";
    case "writes_to":
      return "Write path";
    case "gates":
      return "Governance gate";
    case "observes":
      return "Observation path";
    case "dispatches_to":
      return "Async boundary";
    case "projects_to":
      return "Projection path";
    case "renders":
      return "Render path";
    case "forbidden":
      return "Tripwire";
    default:
      return formatToken(edgeKind);
  }
}

function safeEdgeLabel(edge: ArchitectureGraphProjectionEdge): string {
  if (!edge.tripwire) {
    return edge.label;
  }

  return safeTripwireText(edge.id);
}

function safeWarningLabel(warning: ArchitectureGraphProjectionWarning): string {
  return safeTripwireText(warning.edge_id);
}

function safeTripwireText(edgeId: string): string {
  switch (edgeId) {
    case "arch-edge:voice-runtime-forbidden-approve-actions":
      return "Voice Runtime approval tripwire";
    case "arch-edge:vision-runtime-forbidden-room-actions":
      return "Vision Runtime room-action tripwire";
    case "arch-edge:scheduler-forbidden-execute-tools":
      return "Scheduler side-effect tripwire";
    case "arch-edge:command-center-forbidden-mutate-state":
      return "Command Center state-change tripwire";
    case "arch-edge:architecture-graph-forbidden-execute-traces":
      return "Architecture Graph trace tripwire";
    case "arch-edge:observability-surfaces-forbidden-live-store-write":
      return "Observability live-store tripwire";
    default:
      return "Governance tripwire";
  }
}
