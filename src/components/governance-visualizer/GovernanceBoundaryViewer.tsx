"use client";

import { useMemo, useState } from "react";

import {
  GOVERNANCE_BOUNDARY_GATE_TYPES,
  GOVERNANCE_BOUNDARY_TRUST_CLASSES,
  assertGovernanceBoundarySafe,
  buildGovernanceBoundaryProjection,
  buildGovernanceBoundaryStats,
  getGovernanceBoundaryEdgesForNode,
  getGovernanceBoundaryInboundEdges,
  getGovernanceBoundaryOutboundEdges,
  listGovernanceBoundaryEdges,
  listGovernanceBoundaryEdgesByGate,
  listGovernanceBoundaryEdgesByPolicy,
  listGovernanceBoundaryNodes,
  listGovernanceBoundaryTripwires,
  listGovernanceBoundaryTripwiresForNode,
  listGovernanceBoundaryWarnings,
  scanGovernanceBoundarySafety,
  summarizeGovernanceBoundaryNode,
  type GovernanceBoundaryEdge,
  type GovernanceBoundaryGateType,
  type GovernanceBoundaryNode,
  type GovernanceBoundaryNodeSummary,
  type GovernanceBoundaryPolicy,
  type GovernanceBoundaryPolicyKind,
  type GovernanceBoundaryProjection,
  type GovernanceBoundarySeverity,
  type GovernanceBoundaryStats,
  type GovernanceBoundaryTripwire,
  type GovernanceBoundaryTrustClass,
  type GovernanceBoundaryWarning,
} from "@/lib/governance-visualizer";

type PolicyFilter = GovernanceBoundaryPolicyKind | "all";
type GateFilter = GovernanceBoundaryGateType | "all";
type TrustFilter = GovernanceBoundaryTrustClass | "all";

const SUMMARY_NODE_IDS = [
  "governance-node:approval-runtime",
  "governance-node:voice-runtime",
  "governance-node:scheduler",
] as const;

const DISABLED_CAPABILITY_LABELS: readonly string[] = [
  "Execution",
  "Approval decisions",
  "Mutation",
  "Async handoff",
  "Runtime control",
  "Telemetry intake",
  "Store reads",
  "File reads",
  "Observers",
  "Authority surfaces",
];

const POLICY_FILTERS: readonly PolicyFilter[] = [
  "all",
  "allowed",
  "gated",
  "forbidden",
];

export interface GovernanceBoundaryViewerSummary {
  node_id: string;
  label: string;
  summary: GovernanceBoundaryNodeSummary;
  edge_count: number;
}

export interface GovernanceBoundaryViewerModel {
  projection: GovernanceBoundaryProjection;
  stats: GovernanceBoundaryStats;
  nodes: readonly GovernanceBoundaryNode[];
  edges: readonly GovernanceBoundaryEdge[];
  policies: readonly GovernanceBoundaryPolicy[];
  allowed_edges: readonly GovernanceBoundaryEdge[];
  gated_edges: readonly GovernanceBoundaryEdge[];
  forbidden_edges: readonly GovernanceBoundaryEdge[];
  approval_gate_edges: readonly GovernanceBoundaryEdge[];
  disabled_feature_edges: readonly GovernanceBoundaryEdge[];
  tripwires: readonly GovernanceBoundaryTripwire[];
  warnings: readonly GovernanceBoundaryWarning[];
  summaries: readonly GovernanceBoundaryViewerSummary[];
  projection_safety_checked: true;
  metadata_only: true;
  read_only: true;
}

export interface GovernanceBoundaryViewerControls {
  selectedNodeId?: string;
  selectedEdgeId?: string;
  policyFilter?: PolicyFilter;
  gateFilter?: GateFilter;
  trustFilter?: TrustFilter;
  showTripwires?: boolean;
  showWarnings?: boolean;
  searchQuery?: string;
}

export interface GovernanceBoundaryViewerEdgeDetail {
  edge: GovernanceBoundaryEdge;
  from_label: string;
  to_label: string;
  policy_label: string;
  gate_label: string;
  trust_class: GovernanceBoundaryTrustClass;
  trust_label: string;
  severity: GovernanceBoundarySeverity;
  tripwire_status: string;
  rationale: string;
  metadata_only: true;
  read_only: true;
}

export interface GovernanceBoundaryViewerNodeDetail {
  node: GovernanceBoundaryNode;
  summary: GovernanceBoundaryNodeSummary;
  inbound_edges: readonly GovernanceBoundaryEdge[];
  outbound_edges: readonly GovernanceBoundaryEdge[];
  gated_paths: readonly GovernanceBoundaryEdge[];
  forbidden_paths: readonly GovernanceBoundaryEdge[];
  tripwires: readonly GovernanceBoundaryTripwire[];
  related_warnings: readonly GovernanceBoundaryWarning[];
  metadata_only: true;
  read_only: true;
}

export interface GovernanceBoundaryViewerState {
  selected_node_id: string;
  selected_edge_id: string;
  policy_filter: PolicyFilter;
  gate_filter: GateFilter;
  trust_filter: TrustFilter;
  show_tripwires: boolean;
  show_warnings: boolean;
  search_query: string;
  visible_nodes: readonly GovernanceBoundaryNode[];
  visible_edges: readonly GovernanceBoundaryEdge[];
  visible_tripwires: readonly GovernanceBoundaryTripwire[];
  visible_warnings: readonly GovernanceBoundaryWarning[];
  selected_node_detail: GovernanceBoundaryViewerNodeDetail;
  selected_edge_detail: GovernanceBoundaryViewerEdgeDetail;
  metadata_only: true;
  read_only: true;
}

export function buildGovernanceBoundaryViewerModel(): GovernanceBoundaryViewerModel {
  const projection = buildGovernanceBoundaryProjection();
  assertGovernanceBoundarySafe(projection);
  const safety = scanGovernanceBoundarySafety(projection, "projection");
  if (!safety.passed) {
    throw new Error("Governance boundary projection withheld by safety guard");
  }

  return {
    projection,
    stats: buildGovernanceBoundaryStats(),
    nodes: listGovernanceBoundaryNodes(),
    edges: listGovernanceBoundaryEdges(),
    policies: projection.policies,
    allowed_edges: listGovernanceBoundaryEdgesByPolicy("allowed"),
    gated_edges: listGovernanceBoundaryEdgesByPolicy("gated"),
    forbidden_edges: listGovernanceBoundaryEdgesByPolicy("forbidden"),
    approval_gate_edges: listGovernanceBoundaryEdgesByGate("approval"),
    disabled_feature_edges:
      listGovernanceBoundaryEdgesByGate("disabled_feature"),
    tripwires: listGovernanceBoundaryTripwires(),
    warnings: listGovernanceBoundaryWarnings(),
    summaries: SUMMARY_NODE_IDS.map((nodeId) => {
      const summary = summarizeGovernanceBoundaryNode(nodeId);
      if (!summary) {
        throw new Error(`Missing governance boundary summary for ${nodeId}`);
      }

      return {
        node_id: nodeId,
        label: summary.label,
        summary,
        edge_count: getGovernanceBoundaryEdgesForNode(nodeId).length,
      };
    }),
    projection_safety_checked: true,
    metadata_only: true,
    read_only: true,
  };
}

export function buildGovernanceBoundaryViewerState(
  model: GovernanceBoundaryViewerModel,
  controls: GovernanceBoundaryViewerControls = {},
): GovernanceBoundaryViewerState {
  const policyFilter = controls.policyFilter ?? "all";
  const gateFilter = controls.gateFilter ?? "all";
  const trustFilter = controls.trustFilter ?? "all";
  const showTripwires = controls.showTripwires ?? true;
  const showWarnings = controls.showWarnings ?? true;
  const searchQuery = controls.searchQuery ?? "";
  const visibleEdges = filterGovernanceBoundaryViewerEdges(model, {
    policyFilter,
    gateFilter,
    trustFilter,
    showTripwires,
    searchQuery,
  });
  const visibleNodes = filterGovernanceBoundaryViewerNodes(model, {
    trustFilter,
    searchQuery,
  });
  const selectedNodeId =
    selectNode(model, controls.selectedNodeId, visibleNodes)?.node_id ??
    model.nodes[0].node_id;
  const selectedEdgeId =
    selectEdge(model, controls.selectedEdgeId, visibleEdges)?.edge_id ??
    model.edges[0].edge_id;

  return {
    selected_node_id: selectedNodeId,
    selected_edge_id: selectedEdgeId,
    policy_filter: policyFilter,
    gate_filter: gateFilter,
    trust_filter: trustFilter,
    show_tripwires: showTripwires,
    show_warnings: showWarnings,
    search_query: searchQuery,
    visible_nodes: visibleNodes,
    visible_edges: visibleEdges,
    visible_tripwires: showTripwires ? model.tripwires : [],
    visible_warnings: showWarnings ? model.warnings : [],
    selected_node_detail: buildNodeDetail(model, selectedNodeId),
    selected_edge_detail: buildEdgeDetail(model, selectedEdgeId),
    metadata_only: true,
    read_only: true,
  };
}

export function filterGovernanceBoundaryViewerNodes(
  model: GovernanceBoundaryViewerModel,
  filters: {
    readonly trustFilter: TrustFilter;
    readonly searchQuery: string;
  },
): readonly GovernanceBoundaryNode[] {
  const search = filters.searchQuery.trim().toLowerCase();
  return model.nodes.filter((node) => {
    if (
      filters.trustFilter !== "all" &&
      node.trust_class !== filters.trustFilter
    ) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [node.node_id, node.label, node.subsystem_ref].some((value) =>
      value.toLowerCase().includes(search),
    );
  });
}

export function filterGovernanceBoundaryViewerEdges(
  model: GovernanceBoundaryViewerModel,
  filters: {
    readonly policyFilter: PolicyFilter;
    readonly gateFilter: GateFilter;
    readonly trustFilter: TrustFilter;
    readonly showTripwires: boolean;
    readonly searchQuery: string;
  },
): readonly GovernanceBoundaryEdge[] {
  const search = filters.searchQuery.trim().toLowerCase();
  return model.edges.filter((edge) => {
    if (
      filters.policyFilter !== "all" &&
      edge.policy !== filters.policyFilter
    ) {
      return false;
    }
    if (filters.gateFilter !== "all" && edge.gate_type !== filters.gateFilter) {
      return false;
    }
    if (
      filters.trustFilter !== "all" &&
      edgeTrustClass(model, edge) !== filters.trustFilter
    ) {
      return false;
    }
    if (!filters.showTripwires && edge.policy === "forbidden") {
      return false;
    }
    if (!search) {
      return true;
    }

    const fromLabel = nodeLabel(model, edge.from_node_id);
    const toLabel = nodeLabel(model, edge.to_node_id);
    return [edge.edge_id, edge.label, fromLabel, toLabel].some((value) =>
      value.toLowerCase().includes(search),
    );
  });
}

export function GovernanceBoundaryViewer() {
  const model = useMemo(() => buildGovernanceBoundaryViewerModel(), []);
  const [selectedNodeId, setSelectedNodeId] = useState(model.nodes[0].node_id);
  const [selectedEdgeId, setSelectedEdgeId] = useState(model.edges[0].edge_id);
  const [policyFilter, setPolicyFilter] = useState<PolicyFilter>("all");
  const [gateFilter, setGateFilter] = useState<GateFilter>("all");
  const [trustFilter, setTrustFilter] = useState<TrustFilter>("all");
  const [showTripwires, setShowTripwires] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const state = useMemo(
    () =>
      buildGovernanceBoundaryViewerState(model, {
        selectedNodeId,
        selectedEdgeId,
        policyFilter,
        gateFilter,
        trustFilter,
        showTripwires,
        showWarnings,
        searchQuery,
      }),
    [
      gateFilter,
      model,
      policyFilter,
      searchQuery,
      selectedEdgeId,
      selectedNodeId,
      showTripwires,
      showWarnings,
      trustFilter,
    ],
  );

  return (
    <main
      data-governance-boundary-viewer="read-only"
      data-metadata-only={String(model.metadata_only)}
      data-read-only={String(model.read_only)}
      data-projection-safety-checked={String(model.projection_safety_checked)}
      className="min-h-screen bg-[#02030a] px-6 py-8 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(125,211,252,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.035)_1px,transparent_1px)] bg-[size:76px_76px]"
      />
      <div className="relative mx-auto grid max-w-7xl gap-6">
        <header className="border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.36)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
            Phase 19C visibility surface
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Governance Boundaries
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/75">
                Read-only safety boundary visualizer for trust classes, gates,
                forbidden paths, tripwires, and disabled capability posture.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[38rem]">
              <Stat label="Nodes" value={model.stats.node_count} />
              <Stat label="Edges" value={model.stats.edge_count} />
              <Stat label="Gated" value={model.stats.gated_edge_count} />
              <Stat
                label="Forbidden"
                value={model.stats.forbidden_edge_count}
              />
            </dl>
          </div>
        </header>

        <section
          aria-label="Governance boundary stats"
          className="grid gap-3 md:grid-cols-4 xl:grid-cols-8"
        >
          <Stat label="Allowed" value={model.stats.allowed_edge_count} />
          <Stat label="Tripwires" value={model.stats.tripwire_count} />
          <Stat label="Warnings" value={model.stats.warning_count} />
          <Stat
            label="Disabled features"
            value={model.stats.disabled_feature_boundary_count}
          />
          <Stat
            label="Approval gates"
            value={model.approval_gate_edges.length}
          />
          <Stat
            label="Disabled gates"
            value={model.disabled_feature_edges.length}
          />
          <Stat label="Safety" value="checked" />
          <Stat label="Mode" value="read only" />
        </section>

        <section
          aria-label="Governance disabled capability indicators"
          className="grid gap-3 border border-white/10 bg-slate-950/62 p-5 md:grid-cols-3 xl:grid-cols-5"
        >
          {DISABLED_CAPABILITY_LABELS.map((label) => (
            <Capability
              key={label}
              label={label}
              value={label === "Authority surfaces" ? "none" : "off"}
            />
          ))}
        </section>

        <section
          aria-label="Governance local filters"
          className="grid gap-4 border border-white/10 bg-slate-950/62 p-5"
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
            <label className="grid gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Find boundary
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Node or edge label/id"
                className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                aria-label="Search governance boundaries"
              />
            </label>

            <FilterSelect
              label="Policy"
              value={policyFilter}
              options={POLICY_FILTERS}
              onChange={(value) => setPolicyFilter(value as PolicyFilter)}
            />
            <FilterSelect
              label="Gate type"
              value={gateFilter}
              options={["all", ...GOVERNANCE_BOUNDARY_GATE_TYPES]}
              onChange={(value) => setGateFilter(value as GateFilter)}
            />
            <FilterSelect
              label="Trust class"
              value={trustFilter}
              options={["all", ...GOVERNANCE_BOUNDARY_TRUST_CLASSES]}
              onChange={(value) => setTrustFilter(value as TrustFilter)}
              formatLabel={formatTrustClass}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterToggle
              active={showTripwires}
              label="Tripwires"
              onClick={() => setShowTripwires((current) => !current)}
            />
            <FilterToggle
              active={showWarnings}
              label="Warnings"
              onClick={() => setShowWarnings((current) => !current)}
            />
          </div>
        </section>

        <section
          aria-label="Governance inspection workspace"
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.72fr)]"
        >
          <section className="grid gap-4">
            <section aria-label="Governance subsystem nodes">
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Subsystem Nodes
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {state.visible_nodes.map((node) => (
                  <NodeCard
                    key={node.node_id}
                    node={node}
                    selected={node.node_id === state.selected_node_id}
                    onSelect={() => setSelectedNodeId(node.node_id)}
                  />
                ))}
                {state.visible_nodes.length === 0 ? (
                  <EmptyState label="No nodes match the local filters." />
                ) : null}
              </div>
            </section>

            <section aria-label="Governance edge policies">
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Boundary Edges
              </h2>
              <div className="grid gap-3">
                {state.visible_edges.map((edge) => (
                  <EdgeCard
                    key={edge.edge_id}
                    edge={edge}
                    model={model}
                    selected={edge.edge_id === state.selected_edge_id}
                    onSelect={() => setSelectedEdgeId(edge.edge_id)}
                  />
                ))}
                {state.visible_edges.length === 0 ? (
                  <EmptyState label="No edges match the local filters." />
                ) : null}
              </div>
            </section>
          </section>

          <section className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
            <NodeDetail detail={state.selected_node_detail} />
            <EdgeDetail detail={state.selected_edge_detail} />
          </section>
        </section>

        <section
          aria-label="Governance trust and gate summaries"
          className="grid gap-4 lg:grid-cols-2"
        >
          <div className="border border-white/10 bg-slate-950/62 p-5">
            <h2 className="text-xl font-semibold text-white">Trust Classes</h2>
            <dl className="mt-4 grid gap-2">
              {GOVERNANCE_BOUNDARY_TRUST_CLASSES.map((trustClass) => (
                <DetailStat
                  key={trustClass}
                  label={formatTrustClass(trustClass)}
                  value={`${model.nodes.filter((node) => node.trust_class === trustClass).length} nodes`}
                />
              ))}
            </dl>
          </div>
          <div className="border border-white/10 bg-slate-950/62 p-5">
            <h2 className="text-xl font-semibold text-white">Gate Types</h2>
            <dl className="mt-4 grid gap-2">
              {GOVERNANCE_BOUNDARY_GATE_TYPES.map((gateType) => (
                <DetailStat
                  key={gateType}
                  label={formatToken(gateType)}
                  value={`${listGovernanceBoundaryEdgesByGate(gateType).length} edges`}
                />
              ))}
            </dl>
          </div>
        </section>

        {showTripwires ? (
          <section
            aria-label="Governance tripwire warnings"
            className="border border-rose-100/15 bg-rose-300/[0.045] p-5"
          >
            <h2 className="text-xl font-semibold text-rose-50">
              Tripwire Warnings
            </h2>
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {state.visible_tripwires.map((tripwire) => (
                <li
                  key={tripwire.tripwire_id}
                  className="border border-rose-100/15 bg-black/20 px-3 py-2 text-sm text-rose-50/85"
                >
                  {safeGovernanceLabel(tripwire.label)}
                  <span className="ml-2 text-xs uppercase tracking-[0.14em] text-rose-100/55">
                    warning only
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {showWarnings ? (
          <section
            aria-label="Governance warnings"
            className="border border-amber-100/15 bg-amber-300/[0.045] p-5"
          >
            <h2 className="text-xl font-semibold text-amber-50">
              Boundary Warnings
            </h2>
            <ul className="mt-4 grid gap-2">
              {state.visible_warnings.map((warning) => (
                <li
                  key={warning.warning_id}
                  className="border border-amber-100/15 bg-black/20 px-3 py-2 text-sm text-amber-50/85"
                >
                  {safeGovernanceLabel(warning.label)}
                  <span className="ml-2 text-xs uppercase tracking-[0.14em] text-amber-100/55">
                    informational
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  readonly node: GovernanceBoundaryNode;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <article
      data-governance-node={node.node_id}
      data-selected={String(selected)}
      className={`border p-4 ${
        selected
          ? "border-cyan-200/50 bg-cyan-300/[0.055]"
          : "border-white/10 bg-slate-950/62"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/60">
        {formatTrustClass(node.trust_class)}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-white">{node.label}</h3>
      <p className="mt-2 text-sm text-slate-300/75">{node.subsystem_ref}</p>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-white/[0.07]"
      >
        Inspect node
      </button>
    </article>
  );
}

function EdgeCard({
  edge,
  model,
  selected,
  onSelect,
}: {
  readonly edge: GovernanceBoundaryEdge;
  readonly model: GovernanceBoundaryViewerModel;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <article
      data-governance-edge={edge.edge_id}
      data-selected={String(selected)}
      className={`border p-4 ${
        selected
          ? "border-amber-200/50 bg-amber-300/[0.055]"
          : "border-white/10 bg-slate-950/62"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/60">
            {formatToken(edge.policy)}
            {edge.gate_type ? ` / ${formatToken(edge.gate_type)}` : ""}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {safeGovernanceLabel(edge.label)}
          </h3>
          <p className="mt-2 text-sm text-slate-300/75">
            {nodeLabel(model, edge.from_node_id)} to{" "}
            {nodeLabel(model, edge.to_node_id)}
          </p>
        </div>
        <span className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
          {formatTrustClass(edgeTrustClass(model, edge))}
        </span>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-white/[0.07]"
      >
        Inspect path
      </button>
    </article>
  );
}

function NodeDetail({
  detail,
}: {
  readonly detail: GovernanceBoundaryViewerNodeDetail;
}) {
  return (
    <aside
      data-governance-node-detail="read-only"
      className="border border-white/10 bg-slate-950/72 p-5"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
        Node Inspection
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {detail.node.label}
      </h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <DetailStat label="Node id" value={detail.node.node_id} />
        <DetailStat
          label="Trust class"
          value={formatTrustClass(detail.node.trust_class)}
        />
        <DetailStat
          label="Inbound edges"
          value={String(detail.inbound_edges.length)}
        />
        <DetailStat
          label="Outbound edges"
          value={String(detail.outbound_edges.length)}
        />
        <DetailStat
          label="Gated paths"
          value={String(detail.gated_paths.length)}
        />
        <DetailStat
          label="Forbidden paths"
          value={String(detail.forbidden_paths.length)}
        />
      </dl>
      <DetailList title="Inbound Edges" edges={detail.inbound_edges} />
      <DetailList title="Outbound Edges" edges={detail.outbound_edges} />
      <DetailList title="Gated Paths" edges={detail.gated_paths} />
      <DetailList title="Forbidden Paths" edges={detail.forbidden_paths} />
      <TripwireList tripwires={detail.tripwires} />
      <WarningList warnings={detail.related_warnings} />
    </aside>
  );
}

function EdgeDetail({
  detail,
}: {
  readonly detail: GovernanceBoundaryViewerEdgeDetail;
}) {
  return (
    <aside
      data-governance-edge-detail="read-only"
      className="border border-white/10 bg-slate-950/72 p-5"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
        Edge Inspection
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {safeGovernanceLabel(detail.edge.label)}
      </h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <DetailStat label="From" value={detail.from_label} />
        <DetailStat label="To" value={detail.to_label} />
        <DetailStat label="Policy" value={detail.policy_label} />
        <DetailStat label="Gate type" value={detail.gate_label} />
        <DetailStat label="Trust class" value={detail.trust_label} />
        <DetailStat label="Severity" value={detail.severity} />
        <DetailStat label="Tripwire status" value={detail.tripwire_status} />
        <DetailStat label="Rationale" value={detail.rationale} />
      </dl>
    </aside>
  );
}

function DetailList({
  title,
  edges,
}: {
  readonly title: string;
  readonly edges: readonly GovernanceBoundaryEdge[];
}) {
  return (
    <section className="mt-5">
      <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-slate-300">
        {edges.length > 0 ? (
          edges.map((edge) => (
            <li
              key={edge.edge_id}
              className="border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              {safeGovernanceLabel(edge.label)}
            </li>
          ))
        ) : (
          <li className="border border-white/10 bg-white/[0.03] px-3 py-2">
            None
          </li>
        )}
      </ul>
    </section>
  );
}

function TripwireList({
  tripwires,
}: {
  readonly tripwires: readonly GovernanceBoundaryTripwire[];
}) {
  return (
    <section className="mt-5">
      <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
        Related Tripwires
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-slate-300">
        {tripwires.length > 0 ? (
          tripwires.map((tripwire) => (
            <li
              key={tripwire.tripwire_id}
              className="border border-rose-100/15 bg-rose-300/[0.045] px-3 py-2"
            >
              {safeGovernanceLabel(tripwire.label)}
              <span className="ml-2 text-xs uppercase tracking-[0.14em] text-rose-100/55">
                warning only
              </span>
            </li>
          ))
        ) : (
          <li className="border border-white/10 bg-white/[0.03] px-3 py-2">
            None
          </li>
        )}
      </ul>
    </section>
  );
}

function WarningList({
  warnings,
}: {
  readonly warnings: readonly GovernanceBoundaryWarning[];
}) {
  return (
    <section className="mt-5">
      <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
        Related Warnings
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-slate-300">
        {warnings.length > 0 ? (
          warnings.map((warning) => (
            <li
              key={warning.warning_id}
              className="border border-amber-100/15 bg-amber-300/[0.045] px-3 py-2"
            >
              {safeGovernanceLabel(warning.label)}
            </li>
          ))
        ) : (
          <li className="border border-white/10 bg-white/[0.03] px-3 py-2">
            None
          </li>
        )}
      </ul>
    </section>
  );
}

function EmptyState({ label }: { readonly label: string }) {
  return (
    <div className="border border-white/10 bg-slate-950/62 p-5 text-sm text-slate-300">
      {label}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  formatLabel = formatToken,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
  readonly formatLabel?: (value: string) => string;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterToggle({
  active,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
        active
          ? "border-cyan-200/40 bg-cyan-300/[0.075] text-cyan-50"
          : "border-white/10 bg-white/[0.03] text-slate-400"
      }`}
    >
      {active ? "Show" : "Hide"} {label}
    </button>
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

function Capability({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-100">{value}</dd>
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
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}

function buildNodeDetail(
  model: GovernanceBoundaryViewerModel,
  nodeId: string,
): GovernanceBoundaryViewerNodeDetail {
  const node =
    model.nodes.find((item) => item.node_id === nodeId) ?? model.nodes[0];
  const summary = summarizeGovernanceBoundaryNode(node.node_id);
  if (!summary) {
    throw new Error(`Missing governance boundary summary for ${node.node_id}`);
  }

  const inboundEdges = getGovernanceBoundaryInboundEdges(node.node_id);
  const outboundEdges = getGovernanceBoundaryOutboundEdges(node.node_id);
  const allEdges = [...inboundEdges, ...outboundEdges];
  const edgeIds = new Set(allEdges.map((edge) => edge.edge_id));
  const tripwireIds = new Set(
    allEdges
      .map((edge) => edge.tripwire_id)
      .filter((tripwireId): tripwireId is string => Boolean(tripwireId)),
  );

  return {
    node,
    summary,
    inbound_edges: inboundEdges,
    outbound_edges: outboundEdges,
    gated_paths: allEdges.filter((edge) => edge.policy === "gated"),
    forbidden_paths: allEdges.filter((edge) => edge.policy === "forbidden"),
    tripwires: listGovernanceBoundaryTripwiresForNode(node.node_id),
    related_warnings: model.warnings.filter(
      (warning) =>
        warning.node_id === node.node_id ||
        (warning.edge_id ? edgeIds.has(warning.edge_id) : true) ||
        (warning.tripwire_id ? tripwireIds.has(warning.tripwire_id) : false),
    ),
    metadata_only: true,
    read_only: true,
  };
}

function buildEdgeDetail(
  model: GovernanceBoundaryViewerModel,
  edgeId: string,
): GovernanceBoundaryViewerEdgeDetail {
  const edge =
    model.edges.find((item) => item.edge_id === edgeId) ?? model.edges[0];
  const tripwire = edge.tripwire_id
    ? model.tripwires.find((item) => item.tripwire_id === edge.tripwire_id)
    : null;
  const trustClass = edgeTrustClass(model, edge);

  return {
    edge,
    from_label: nodeLabel(model, edge.from_node_id),
    to_label: nodeLabel(model, edge.to_node_id),
    policy_label: formatToken(edge.policy),
    gate_label: edge.gate_type ? formatToken(edge.gate_type) : "none",
    trust_class: trustClass,
    trust_label: formatTrustClass(trustClass),
    severity:
      tripwire?.severity ?? (edge.policy === "allowed" ? "info" : "warning"),
    tripwire_status: edge.tripwire_id ? "warning only" : "none",
    rationale: rationaleForEdge(edge),
    metadata_only: true,
    read_only: true,
  };
}

function selectNode(
  model: GovernanceBoundaryViewerModel,
  nodeId: string | undefined,
  visibleNodes: readonly GovernanceBoundaryNode[],
): GovernanceBoundaryNode | null {
  if (nodeId) {
    const visibleMatch = visibleNodes.find((node) => node.node_id === nodeId);
    if (visibleMatch) return visibleMatch;
  }
  return visibleNodes[0] ?? model.nodes[0] ?? null;
}

function selectEdge(
  model: GovernanceBoundaryViewerModel,
  edgeId: string | undefined,
  visibleEdges: readonly GovernanceBoundaryEdge[],
): GovernanceBoundaryEdge | null {
  if (edgeId) {
    const visibleMatch = visibleEdges.find((edge) => edge.edge_id === edgeId);
    if (visibleMatch) return visibleMatch;
  }
  return visibleEdges[0] ?? model.edges[0] ?? null;
}

function nodeLabel(
  model: GovernanceBoundaryViewerModel,
  nodeId: string,
): string {
  return model.nodes.find((node) => node.node_id === nodeId)?.label ?? nodeId;
}

function edgeTrustClass(
  model: GovernanceBoundaryViewerModel,
  edge: GovernanceBoundaryEdge,
): GovernanceBoundaryTrustClass {
  return (
    model.policies.find((policy) => policy.policy_id === edge.policy_id)
      ?.trust_class ?? "forbidden"
  );
}

function rationaleForEdge(edge: GovernanceBoundaryEdge): string {
  if (edge.policy === "allowed") {
    return "Read-only metadata path.";
  }
  if (edge.policy === "gated") {
    return "Visible as gate metadata; no capability is created.";
  }
  return "Blocked path shown only as tripwire metadata.";
}

function formatToken(value: string): string {
  return value.replaceAll("_", " ");
}

function formatTrustClass(value: string): string {
  if (value === "safe_mutate") {
    return "safe change";
  }
  if (value === "restricted_mutate") {
    return "restricted change";
  }
  return formatToken(value);
}

function safeGovernanceLabel(value: string): string {
  return value
    .replaceAll("Tool Execution", "Tool Effect Path")
    .replaceAll("Execution", "Effect Path")
    .replaceAll("execute tools", "activate tool paths")
    .replaceAll("execute", "activate")
    .replaceAll("Runtime Mutation", "Runtime State Change")
    .replaceAll("Mutation", "State Change")
    .replaceAll("mutate runtime state", "change runtime state")
    .replaceAll("mutate", "change");
}
