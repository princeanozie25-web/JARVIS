"use client";

import { useMemo, useState } from "react";

import {
  assertArchitectureGraphProjectionSafe,
  buildArchitectureGraphProjection,
  buildArchitectureGraphProjectionStats,
  getArchitectureNodeDependencies,
  getArchitectureNodeDependents,
  getArchitectureNodeForbiddenEdges,
  getArchitectureNodeGovernanceEdges,
  getArchitectureNodeInboundEdges,
  getArchitectureNodeOutboundEdges,
  listArchitectureGraphProjectionWarnings,
  summarizeArchitectureNode,
  type ArchitectureGraphEdge,
  type ArchitectureGraphEdgeKind,
  type ArchitectureGraphNodeSummary,
  type ArchitectureGraphProjection,
  type ArchitectureGraphProjectionEdge,
  type ArchitectureGraphProjectionGroup,
  type ArchitectureGraphProjectionNode,
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

type ArchitectureGraphGroupFilter =
  | "all"
  | ArchitectureGraphProjectionGroup["id"];
type ArchitectureGraphEdgeFilter =
  | "all"
  | "dependency"
  | "read"
  | "write"
  | "gate"
  | "observe"
  | "async"
  | "projection"
  | "render"
  | "tripwire";

export interface ArchitectureGraphViewerControls {
  selectedNodeId?: string;
  groupFilter?: ArchitectureGraphGroupFilter;
  edgeFilter?: ArchitectureGraphEdgeFilter;
  showTripwires?: boolean;
  searchQuery?: string;
}

export interface ArchitectureGraphViewerEdgeDetail {
  id: string;
  label: string;
  kind: ArchitectureGraphEdgeKind;
  layer: string;
  tripwire: boolean;
}

export interface ArchitectureGraphViewerNodeDetail {
  node: ArchitectureGraphProjectionNode;
  summary: ArchitectureGraphNodeSummary;
  inbound_edges: readonly ArchitectureGraphViewerEdgeDetail[];
  outbound_edges: readonly ArchitectureGraphViewerEdgeDetail[];
  dependencies: readonly string[];
  dependents: readonly string[];
  governance_edges: readonly ArchitectureGraphViewerEdgeDetail[];
  tripwire_edges: readonly ArchitectureGraphViewerEdgeDetail[];
}

export interface ArchitectureGraphViewerState {
  selected_node_id: string;
  group_filter: ArchitectureGraphGroupFilter;
  edge_filter: ArchitectureGraphEdgeFilter;
  show_tripwires: boolean;
  search_query: string;
  visible_nodes: readonly ArchitectureGraphProjectionNode[];
  visible_edges: readonly ArchitectureGraphProjectionEdge[];
  visible_groups: readonly ArchitectureGraphProjectionGroup[];
  visible_warnings: readonly ArchitectureGraphProjectionWarning[];
  selected_detail: ArchitectureGraphViewerNodeDetail;
  metadata_only: true;
  read_only: true;
}

const EDGE_FILTER_TO_KIND: Record<
  Exclude<ArchitectureGraphEdgeFilter, "all">,
  ArchitectureGraphEdgeKind
> = {
  dependency: "depends_on",
  read: "reads_from",
  write: "writes_to",
  gate: "gates",
  observe: "observes",
  async: "dispatches_to",
  projection: "projects_to",
  render: "renders",
  tripwire: "forbidden",
};

const EDGE_FILTER_OPTIONS: readonly {
  readonly id: ArchitectureGraphEdgeFilter;
  readonly label: string;
}[] = [
  { id: "all", label: "Any path" },
  { id: "dependency", label: "Dependency" },
  { id: "read", label: "Read path" },
  { id: "write", label: "Write path" },
  { id: "gate", label: "Governance gate" },
  { id: "observe", label: "Observation path" },
  { id: "async", label: "Async boundary" },
  { id: "projection", label: "Projection path" },
  { id: "render", label: "Render path" },
  { id: "tripwire", label: "Tripwire" },
];

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

export function buildArchitectureGraphViewerState(
  model: ArchitectureGraphViewerModel,
  controls: ArchitectureGraphViewerControls = {},
): ArchitectureGraphViewerState {
  const groupFilter = controls.groupFilter ?? "all";
  const edgeFilter = controls.edgeFilter ?? "all";
  const showTripwires = controls.showTripwires ?? true;
  const searchQuery = (controls.searchQuery ?? "").trim().toLowerCase();

  const searchedNodes = model.projection.nodes.filter((node) => {
    const matchesGroup =
      groupFilter === "all" || node.display_group === groupFilter;
    const matchesSearch =
      searchQuery.length === 0 ||
      node.label.toLowerCase().includes(searchQuery) ||
      node.id.toLowerCase().includes(searchQuery);

    return matchesGroup && matchesSearch;
  });
  const visibleNodeIds = new Set(searchedNodes.map((node) => node.id));

  const visibleEdges = model.projection.edges.filter((edge) => {
    const matchesNode =
      visibleNodeIds.has(edge.from) || visibleNodeIds.has(edge.to);
    const matchesTripwire = showTripwires || !edge.tripwire;
    const matchesKind =
      edgeFilter === "all" || edge.kind === EDGE_FILTER_TO_KIND[edgeFilter];

    return matchesNode && matchesTripwire && matchesKind;
  });
  const visibleWarnings = showTripwires
    ? model.warnings.filter((warning) =>
        visibleEdges.some((edge) => edge.id === warning.edge_id),
      )
    : [];
  const selectedNodeId =
    searchedNodes.find((node) => node.id === controls.selectedNodeId)?.id ??
    searchedNodes[0]?.id ??
    model.projection.nodes[0].id;
  const selectedNode =
    model.projection.nodes.find((node) => node.id === selectedNodeId) ??
    model.projection.nodes[0];
  const summary = summarizeArchitectureNode(selectedNode.id);

  if (!summary) {
    throw new Error(
      `Missing architecture graph detail summary for ${selectedNode.id}`,
    );
  }

  return {
    selected_node_id: selectedNode.id,
    group_filter: groupFilter,
    edge_filter: edgeFilter,
    show_tripwires: showTripwires,
    search_query: searchQuery,
    visible_nodes: searchedNodes,
    visible_edges: visibleEdges,
    visible_groups: model.projection.groups
      .map((group) => ({
        ...group,
        node_ids: group.node_ids.filter((nodeId) => visibleNodeIds.has(nodeId)),
      }))
      .filter((group) => group.node_ids.length > 0),
    visible_warnings: visibleWarnings,
    selected_detail: {
      node: selectedNode,
      summary,
      inbound_edges: getArchitectureNodeInboundEdges(selectedNode.id).map(
        edgeDetail,
      ),
      outbound_edges: getArchitectureNodeOutboundEdges(selectedNode.id).map(
        edgeDetail,
      ),
      dependencies: getArchitectureNodeDependencies(selectedNode.id).map(
        (node) => node.label,
      ),
      dependents: getArchitectureNodeDependents(selectedNode.id).map(
        (node) => node.label,
      ),
      governance_edges: getArchitectureNodeGovernanceEdges(selectedNode.id).map(
        edgeDetail,
      ),
      tripwire_edges: getArchitectureNodeForbiddenEdges(selectedNode.id).map(
        edgeDetail,
      ),
    },
    metadata_only: true,
    read_only: true,
  };
}

export function ArchitectureGraphViewer() {
  const model = useMemo(() => buildArchitectureGraphViewerModel(), []);
  const [selectedNodeId, setSelectedNodeId] = useState(
    "arch-node:approval-runtime",
  );
  const [groupFilter, setGroupFilter] =
    useState<ArchitectureGraphGroupFilter>("all");
  const [edgeFilter, setEdgeFilter] =
    useState<ArchitectureGraphEdgeFilter>("all");
  const [showTripwires, setShowTripwires] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const state = useMemo(
    () =>
      buildArchitectureGraphViewerState(model, {
        selectedNodeId,
        groupFilter,
        edgeFilter,
        showTripwires,
        searchQuery,
      }),
    [
      edgeFilter,
      groupFilter,
      model,
      searchQuery,
      selectedNodeId,
      showTripwires,
    ],
  );
  const { projection, stats, summaries } = model;

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
          aria-label="Architecture graph explorer controls"
          data-architecture-graph-controls="safe-read-only"
          className="grid gap-3 border border-white/10 bg-slate-950/62 p-5 lg:grid-cols-[1.4fr_1fr_1fr_auto]"
        >
          <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            Find node
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              className="border border-white/10 bg-white/[0.04] px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
              placeholder="Label or id"
            />
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            Group
            <select
              value={groupFilter}
              onChange={(event) =>
                setGroupFilter(event.currentTarget.value as never)
              }
              className="border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
            >
              <option value="all">All groups</option>
              {projection.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            Edge path
            <select
              value={edgeFilter}
              onChange={(event) =>
                setEdgeFilter(event.currentTarget.value as never)
              }
              className="border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
            >
              {EDGE_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-3 border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={showTripwires}
              onChange={(event) =>
                setShowTripwires(event.currentTarget.checked)
              }
              className="h-4 w-4"
            />
            Show tripwires
          </label>
        </section>

        <section
          aria-label="Architecture graph node groups"
          className="grid gap-4 xl:grid-cols-2"
        >
          {state.visible_groups.map((group) => {
            const nodes = group.node_ids
              .map((nodeId) =>
                state.visible_nodes.find((node) => node.id === nodeId),
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
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(node.id)}
                            className="text-left font-semibold text-slate-100 underline decoration-cyan-200/30 underline-offset-4"
                          >
                            {node.label}
                          </button>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                            {formatToken(node.kind)} / {node.health}
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

        <NodeInspectionPanel detail={state.selected_detail} />

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
            {state.visible_edges.map((edge) => (
              <li
                key={edge.id}
                className="border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300"
              >
                <span className="font-medium text-slate-100">
                  {safeEdgeLabel(edge)}
                </span>
                <span className="ml-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {safeLegendLabel(edge.kind)} / {formatToken(edge.layer)}
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
            {state.visible_warnings.map((warning) => (
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

function NodeInspectionPanel({
  detail,
}: {
  readonly detail: ArchitectureGraphViewerNodeDetail;
}) {
  return (
    <section
      aria-label="Architecture graph node inspection"
      data-selected-node-id={detail.node.id}
      className="border border-cyan-100/15 bg-cyan-300/[0.04] p-5"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
            Selected node
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {detail.node.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {detail.node.id}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <MiniStat label="In" value={detail.summary.inbound_edge_count} />
          <MiniStat label="Out" value={detail.summary.outbound_edge_count} />
          <MiniStat label="Gov" value={detail.summary.governance_edge_count} />
          <MiniStat label="Trip" value={detail.summary.forbidden_edge_count} />
        </dl>
      </div>

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
        <DetailStat label="Kind" value={formatToken(detail.node.kind)} />
        <DetailStat
          label="Group"
          value={formatToken(detail.node.display_group)}
        />
        <DetailStat label="Health" value={detail.node.health} />
        <DetailStat
          label="Observed calls"
          value={String(detail.node.activity_summary.observed_call_count)}
        />
      </dl>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DetailList title="Inbound edges" items={detail.inbound_edges} />
        <DetailList title="Outbound edges" items={detail.outbound_edges} />
        <TextList title="Dependencies" items={detail.dependencies} />
        <TextList title="Dependents" items={detail.dependents} />
        <DetailList title="Governance edges" items={detail.governance_edges} />
        <DetailList title="Tripwire edges" items={detail.tripwire_edges} />
      </div>
    </section>
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

function DetailStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="border border-white/10 bg-black/15 px-3 py-2">
      <dt className="uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}

function TextList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  return (
    <section className="border border-white/10 bg-black/15 p-3">
      <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {formatList(items)}
      </p>
    </section>
  );
}

function DetailList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly ArchitectureGraphViewerEdgeDetail[];
}) {
  return (
    <section className="border border-white/10 bg-black/15 p-3">
      <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-slate-300">
        {items.length > 0 ? (
          items.map((item) => (
            <li key={item.id}>
              <span className="text-slate-100">{item.label}</span>
              <span className="ml-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                {safeLegendLabel(item.kind)}
              </span>
            </li>
          ))
        ) : (
          <li>None</li>
        )}
      </ul>
    </section>
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

function edgeDetail(
  edge: ArchitectureGraphEdge,
): ArchitectureGraphViewerEdgeDetail {
  return {
    id: edge.edge_id,
    label:
      edge.kind === "forbidden" ? safeTripwireText(edge.edge_id) : edge.label,
    kind: edge.kind,
    layer: edge.layer,
    tripwire: edge.kind === "forbidden",
  };
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
