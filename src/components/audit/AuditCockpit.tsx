import type { ReactNode } from "react";

import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";

import type { AuditPanelViewModel } from "./types";

type AuditViewId = "trace" | "architecture" | "telemetry" | "governance";

type TraceEvent = {
  id: string;
  ts: string;
  kind: "intent" | "safety" | "route" | "tool" | "model" | "error" | "gate";
  label: string;
  tag: string;
  latency: string;
  cost: string;
  success: boolean;
};

type ReplayStep = {
  label: string;
  detail: string;
  boundary: string;
};

type GraphNode = {
  id: string;
  label: string;
  kind: "phase" | "module" | "adapter" | "boundary";
  health: "ok" | "degraded" | "offline";
  x: number;
  y: number;
};

type GraphEdge = {
  from: string;
  to: string;
  layer: "static" | "observed";
  status: "normal" | "designed_unused" | "undesigned_used" | "forbidden";
};

type BoundaryView = {
  id: string;
  label: string;
  trustClass:
    | "observe_only"
    | "safe_mutate"
    | "restricted_mutate"
    | "forbidden";
  tripwire: boolean;
  detail: string;
};

type DisabledFeature = {
  name: string;
  reason: string;
};

const AUDIT_VIEWS: Array<{
  id: AuditViewId;
  href: string;
  label: string;
  phase: string;
  question: string;
}> = [
  {
    id: "trace",
    href: "#audit-trace",
    label: "Trace Timeline",
    phase: "Phase 12",
    question: "What happened, in order?",
  },
  {
    id: "architecture",
    href: "#audit-architecture",
    label: "Architecture Graph",
    phase: "Phase 19A",
    question: "How is it wired?",
  },
  {
    id: "telemetry",
    href: "#audit-telemetry",
    label: "Telemetry Cockpit",
    phase: "Phase 19B",
    question: "What is happening now?",
  },
  {
    id: "governance",
    href: "#audit-governance",
    label: "Governance Boundary",
    phase: "Phase 19C",
    question: "Did the boundaries hold?",
  },
];

const TRACE_EVENTS: TraceEvent[] = [
  {
    id: "trace-4291",
    ts: "09:42:16",
    kind: "intent",
    label: "Operator asks for project status",
    tag: "intent.project.status",
    latency: "18 ms",
    cost: "$0.0000",
    success: true,
  },
  {
    id: "trace-4292",
    ts: "09:42:17",
    kind: "safety",
    label: "Safety tier classified",
    tag: "observe_only",
    latency: "12 ms",
    cost: "$0.0000",
    success: true,
  },
  {
    id: "trace-4293",
    ts: "09:42:18",
    kind: "route",
    label: "Router chooses local path",
    tag: "local.small",
    latency: "34 ms",
    cost: "$0.0000",
    success: true,
  },
  {
    id: "trace-4294",
    ts: "09:42:19",
    kind: "model",
    label: "Response metadata sealed",
    tag: "hash:7b31f2",
    latency: "189 ms",
    cost: "$0.0012",
    success: true,
  },
  {
    id: "trace-4295",
    ts: "09:42:21",
    kind: "gate",
    label: "Human Gate recorded no side effect",
    tag: "decision:none",
    latency: "8 ms",
    cost: "$0.0000",
    success: true,
  },
];

const REPLAY_STEPS: ReplayStep[] = [
  {
    label: "Input fingerprint",
    detail: "request hash 7b31f2, session local-18",
    boundary: "content withheld",
  },
  {
    label: "Intent classified",
    detail: "project.status with 0.94 confidence",
    boundary: "observe_only",
  },
  {
    label: "Safety tag",
    detail: "metadata view, no room authority",
    boundary: "Gate bypass not allowed",
  },
  {
    label: "Route chosen",
    detail: "local.small tier, cost below daily cap",
    boundary: "local only",
  },
  {
    label: "Result recorded",
    detail: "answer hash c901aa, trace sealed",
    boundary: "audit row read-only",
  },
];

const GRAPH_NODES: GraphNode[] = [
  {
    id: "phase11",
    label: "Phase 11 Store",
    kind: "phase",
    health: "ok",
    x: 8,
    y: 38,
  },
  {
    id: "observability",
    label: "Observability API",
    kind: "module",
    health: "ok",
    x: 30,
    y: 18,
  },
  {
    id: "audit",
    label: "Audit Route",
    kind: "module",
    health: "ok",
    x: 52,
    y: 40,
  },
  {
    id: "gate",
    label: "Human Gate",
    kind: "boundary",
    health: "ok",
    x: 72,
    y: 20,
  },
  {
    id: "adapters",
    label: "Adapters",
    kind: "adapter",
    health: "degraded",
    x: 76,
    y: 62,
  },
  {
    id: "disabled",
    label: "Disabled Surface",
    kind: "boundary",
    health: "ok",
    x: 30,
    y: 72,
  },
];

const GRAPH_EDGES: GraphEdge[] = [
  {
    from: "phase11",
    to: "observability",
    layer: "observed",
    status: "normal",
  },
  {
    from: "observability",
    to: "audit",
    layer: "observed",
    status: "normal",
  },
  {
    from: "audit",
    to: "gate",
    layer: "static",
    status: "designed_unused",
  },
  {
    from: "audit",
    to: "adapters",
    layer: "observed",
    status: "forbidden",
  },
  {
    from: "disabled",
    to: "audit",
    layer: "static",
    status: "normal",
  },
];

const TELEMETRY_POINTS = [
  42, 46, 51, 49, 58, 64, 69, 76, 71, 68, 74, 81, 78, 72, 67, 62,
] as const;

const BOUNDARIES: BoundaryView[] = [
  {
    id: "boundary-observe",
    label: "Observability read surface",
    trustClass: "observe_only",
    tripwire: false,
    detail: "Telemetry rows are metadata only.",
  },
  {
    id: "boundary-safe",
    label: "Room safe lane",
    trustClass: "safe_mutate",
    tripwire: false,
    detail: "Visible for working gate review only.",
  },
  {
    id: "boundary-restricted",
    label: "Restricted adapter lane",
    trustClass: "restricted_mutate",
    tripwire: false,
    detail: "Requires explicit Human Gate decision.",
  },
  {
    id: "boundary-forbidden",
    label: "Audit to adapter path",
    trustClass: "forbidden",
    tripwire: true,
    detail: "Synthetic drift drill marked this edge red.",
  },
];

const DISABLED_FEATURES: DisabledFeature[] = [
  {
    name: "Wake word",
    reason: "No ambient listener in this shell.",
  },
  {
    name: "Always listening",
    reason: "Operator presence is not sampled.",
  },
  {
    name: "Background camera",
    reason: "Visual capture is outside the audit surface.",
  },
  {
    name: "Auto authority",
    reason: "Every side effect belongs to working mode gate review.",
  },
  {
    name: "Public dashboards",
    reason: "Tauri remains local to loopback.",
  },
  {
    name: "Background indexing",
    reason: "Audit displays records; it does not start watchers.",
  },
];

const HEALTH_COLOR: Record<GraphNode["health"], string> = {
  ok: "border-emerald-200/40 bg-emerald-300/[0.08] text-emerald-100",
  degraded: "border-amber-200/45 bg-amber-300/[0.08] text-amber-100",
  offline: "border-rose-200/45 bg-rose-300/[0.08] text-rose-100",
};

const EDGE_COLOR: Record<GraphEdge["status"], string> = {
  normal: "rgba(125, 211, 252, 0.72)",
  designed_unused: "rgba(251, 191, 36, 0.78)",
  undesigned_used: "rgba(168, 85, 247, 0.78)",
  forbidden: "rgba(248, 113, 113, 0.92)",
};

const TRUST_CLASS = {
  observe_only: "border-cyan-200/45 bg-cyan-300/[0.08] text-cyan-100",
  safe_mutate: "border-emerald-200/45 bg-emerald-300/[0.08] text-emerald-100",
  restricted_mutate: "border-amber-200/45 bg-amber-300/[0.08] text-amber-100",
  forbidden: "border-rose-200/55 bg-rose-400/[0.12] text-rose-100",
} satisfies Record<BoundaryView["trustClass"], string>;

export interface AuditCockpitProps {
  marker: string;
  projectionPanels: readonly AuditPanelViewModel[];
}

export function AuditCockpit({ marker, projectionPanels }: AuditCockpitProps) {
  const replayPanel = projectionPanels.find(
    (panel) => panel.panel_id === "replay_timeline",
  );
  const matrixPanel = projectionPanels.find(
    (panel) => panel.panel_id === "disabled_feature_matrix",
  );

  return (
    <section
      aria-label="JARVIS Audit fortress"
      data-audit-cockpit="read-only-fortress"
      data-audit-shell="read-only"
      data-command-center-shell="audit"
      data-audit-authority="none"
      data-metadata-only="true"
      data-zero-mutation="true"
      className="relative grid h-[calc(100vh-2rem)] min-h-[620px] overflow-hidden border border-cyan-100/12 bg-[#020817] text-slate-100 shadow-[0_32px_110px_rgba(2,6,23,0.65)]"
    >
      <AuditAtmosphere />
      <AuditTopbar marker={marker} />
      <div className="relative grid min-h-0 grid-cols-[204px_minmax(0,1fr)] border-t border-cyan-100/10">
        <AuditSidebar />
        <main className="min-h-0 overflow-y-auto px-5 py-5">
          <HeroStrip replayPanel={replayPanel} matrixPanel={matrixPanel} />
          <div className="mt-5 grid gap-5">
            <TraceTimeline />
            <ArchitectureGraph />
            <TelemetryCockpit />
            <GovernanceBoundary />
          </div>
        </main>
      </div>
      <AuditStatusBar />
    </section>
  );
}

function AuditAtmosphere() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.045)_1px,transparent_1px)] bg-[size:54px_54px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(14,165,233,0.24),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(20,184,166,0.16),transparent_28%),radial-gradient(circle_at_62%_70%,rgba(245,158,11,0.09),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,8,23,0.94)_76%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-28 h-px w-full animate-pulse bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-20 right-[-10%] h-px w-2/3 animate-pulse bg-gradient-to-r from-transparent via-amber-200/45 to-transparent"
      />
    </>
  );
}

function AuditTopbar({ marker }: { marker: string }) {
  return (
    <header className="cc-shell-header relative z-10 grid h-16 grid-cols-[170px_minmax(390px,520px)_minmax(420px,1fr)_330px] items-center gap-4 border-b border-cyan-100/10 bg-slate-950/64 px-4 backdrop-blur">
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-cyan-200/60">
          Jarvis
        </p>
        <h1 className="text-base font-semibold uppercase tracking-[0.16em] text-white">
          Audit Mode
        </h1>
      </div>
      <CommandCenterNav active="audit" compact />
      <nav
        aria-label="Audit view navigation"
        className="grid grid-cols-4 gap-1 text-[0.62rem] uppercase tracking-[0.12em]"
      >
        {AUDIT_VIEWS.map((view) => (
          <a
            key={view.id}
            href={view.href}
            data-audit-view-link={view.id}
            className="truncate border border-cyan-100/12 bg-cyan-300/[0.035] px-2 py-2 text-center text-cyan-100/72"
          >
            {view.label}
          </a>
        ))}
      </nav>
      <div className="grid grid-cols-3 gap-2 text-[0.65rem] uppercase tracking-[0.14em]">
        <Readout label="Data" value="metadata" tone="cyan" />
        <Readout label="Authority" value="none" tone="emerald" />
        <Readout label="Marker" value={marker} tone="slate" />
      </div>
    </header>
  );
}

function AuditSidebar() {
  return (
    <aside className="relative z-10 min-h-0 border-r border-cyan-100/10 bg-slate-950/54 p-3">
      <div className="space-y-5">
        <SidebarGroup title="Audit Views">
          {AUDIT_VIEWS.map((view) => (
            <a
              key={view.id}
              href={view.href}
              data-audit-sidebar-link={view.id}
              className="block border border-cyan-100/12 bg-white/[0.025] px-3 py-3 text-left"
            >
              <span className="block text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/60">
                {view.phase}
              </span>
              <span className="mt-1 block text-sm font-semibold text-slate-100">
                {view.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">
                {view.question}
              </span>
            </a>
          ))}
        </SidebarGroup>
        <SidebarGroup title="Forensic Posture">
          <div className="space-y-2 text-xs">
            <PostureRow label="Mode" value="inspection" />
            <PostureRow label="Transport" value="loopback" />
            <PostureRow label="Payloads" value="withheld" />
            <PostureRow label="Rows" value="append-only" />
          </div>
        </SidebarGroup>
      </div>
    </aside>
  );
}

function HeroStrip({
  replayPanel,
  matrixPanel,
}: {
  replayPanel?: AuditPanelViewModel;
  matrixPanel?: AuditPanelViewModel;
}) {
  return (
    <section className="relative overflow-hidden border border-cyan-100/12 bg-white/[0.035] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/50 to-transparent"
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/65">
            Command Center Forensics
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            JARVIS Room OS - Audit Mode
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/78">
            The fortress view shows traces, wiring, telemetry, and boundaries as
            evidence. Records are inspectable, animated, and spatial, but every
            row remains read-only.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <FactBox label="Traces" value={rowValue(replayPanel, "Traces")} />
          <FactBox
            label="Replay path"
            value={rowValue(matrixPanel, "Replay path")}
          />
          <FactBox
            label="Graph path"
            value={rowValue(matrixPanel, "Graph path")}
          />
          <FactBox label="Authority" value="none" />
        </dl>
      </div>
    </section>
  );
}

function TraceTimeline() {
  return (
    <AuditSection
      id="audit-trace"
      title="Trace Timeline"
      eyebrow="Phase 12"
      summary="A horizontal record of decision metadata. The replay viewer is evidence, not a trigger."
      dataView="trace"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="relative overflow-x-auto overflow-y-hidden border border-cyan-100/12 bg-slate-950/42 p-4">
          <div className="absolute left-8 right-8 top-[6.6rem] h-px bg-cyan-100/20" />
          <div className="relative grid min-w-[780px] grid-cols-5 gap-3">
            {TRACE_EVENTS.map((event, index) => (
              <article
                key={event.id}
                data-trace-event={event.kind}
                className="relative min-h-52 border border-cyan-100/12 bg-white/[0.025] p-3"
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-[4.9rem] h-4 w-4 -translate-x-1/2 rounded-full border ${
                    event.success
                      ? "border-cyan-100/70 bg-cyan-300/45 shadow-[0_0_22px_rgba(125,211,252,0.65)]"
                      : "border-rose-100/70 bg-rose-300/45 shadow-[0_0_22px_rgba(251,113,133,0.65)]"
                  } ${index === 3 ? "animate-pulse" : ""}`}
                />
                <p className="text-[0.62rem] uppercase tracking-[0.16em] text-cyan-200/55">
                  {event.ts}
                </p>
                <h3 className="mt-12 text-sm font-semibold text-slate-100">
                  {event.label}
                </h3>
                <dl className="mt-3 space-y-2 text-[0.68rem] text-slate-400">
                  <TraceKV label="id" value={event.id} />
                  <TraceKV label="tag" value={event.tag} />
                  <TraceKV label="latency" value={event.latency} />
                  <TraceKV label="cost" value={event.cost} />
                </dl>
              </article>
            ))}
          </div>
        </div>
        <Panel title="Replay Viewer" badge="metadata chain">
          <ol className="space-y-3">
            {REPLAY_STEPS.map((step, index) => (
              <li
                key={step.label}
                className="grid grid-cols-[2rem_1fr] gap-3 border border-cyan-100/10 bg-cyan-300/[0.035] p-3"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full border border-cyan-100/25 bg-cyan-300/[0.08] text-xs text-cyan-100">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-100">
                    {step.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    {step.detail}
                  </span>
                  <span className="mt-2 inline-block border border-amber-200/30 bg-amber-300/[0.08] px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-amber-100">
                    {step.boundary}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </AuditSection>
  );
}

function ArchitectureGraph() {
  return (
    <AuditSection
      id="audit-architecture"
      title="Architecture Graph"
      eyebrow="Phase 19A"
      summary="Designed wiring and observed paths are shown together so drift becomes visible."
      dataView="architecture"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative h-[420px] overflow-hidden border border-cyan-100/12 bg-slate-950/48">
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            {GRAPH_EDGES.map((edge) => {
              const from = GRAPH_NODES.find((node) => node.id === edge.from)!;
              const to = GRAPH_NODES.find((node) => node.id === edge.to)!;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x + 7}
                  y1={from.y + 4}
                  x2={to.x + 7}
                  y2={to.y + 4}
                  stroke={EDGE_COLOR[edge.status]}
                  strokeWidth={edge.status === "forbidden" ? 0.9 : 0.55}
                  strokeDasharray={edge.layer === "static" ? "3 2" : "0"}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          {GRAPH_NODES.map((node) => (
            <article
              key={node.id}
              data-graph-node={node.kind}
              data-node-health={node.health}
              className={`absolute w-36 border px-3 py-2 shadow-[0_0_28px_rgba(14,165,233,0.16)] ${
                HEALTH_COLOR[node.health]
              }`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <p className="text-[0.62rem] uppercase tracking-[0.16em] opacity-70">
                {node.kind}
              </p>
              <h3 className="mt-1 text-sm font-semibold">{node.label}</h3>
            </article>
          ))}
          <div
            aria-hidden="true"
            className="absolute left-6 top-6 h-2 w-2 animate-ping rounded-full bg-cyan-200/70"
          />
        </div>
        <Panel title="Designed vs Observed" badge="drift lens">
          <div className="space-y-3 text-xs">
            <LegendLine color="bg-cyan-300" label="Observed normal path" />
            <LegendLine color="bg-amber-300" label="Designed but unused" />
            <LegendLine color="bg-rose-300" label="Forbidden edge tripwire" />
          </div>
          <div className="mt-5 space-y-3">
            {GRAPH_EDGES.map((edge) => (
              <div
                key={`${edge.from}-${edge.to}-card`}
                data-graph-edge-status={edge.status}
                className={`border p-3 text-xs ${
                  edge.status === "forbidden"
                    ? "border-rose-200/45 bg-rose-400/[0.09] text-rose-100"
                    : "border-cyan-100/12 bg-white/[0.025] text-slate-300"
                }`}
              >
                <p className="font-semibold uppercase tracking-[0.14em]">
                  {edge.status.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-slate-400">
                  {nodeLabel(edge.from)}
                  {" -> "}
                  {nodeLabel(edge.to)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AuditSection>
  );
}

function TelemetryCockpit() {
  return (
    <AuditSection
      id="audit-telemetry"
      title="Telemetry Cockpit"
      eyebrow="Phase 19B"
      summary="Cost, latency, error rate, and trace volume pulse as read-only observability signals."
      dataView="telemetry"
    >
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <Panel title="Live Rollup" badge="synthetic now">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="cost/min" value="$0.014" sub="below cap" />
            <Metric label="p95" value="412 ms" sub="drift watch" />
            <Metric label="errors" value="0.8%" sub="steady" />
            <Metric label="traces" value="1,284" sub="24h sealed" />
          </div>
        </Panel>
        <div className="relative overflow-hidden border border-cyan-100/12 bg-slate-950/44 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/60">
                Latency Wave
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                p50 to p95 drift monitor
              </h3>
            </div>
            <span className="border border-amber-200/30 bg-amber-300/[0.08] px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-amber-100">
              anomaly marker
            </span>
          </div>
          <div className="flex h-56 items-end gap-2 border border-white/10 bg-white/[0.025] p-3">
            {TELEMETRY_POINTS.map((value, index) => (
              <div
                key={`${value}-${index}`}
                className={`flex-1 bg-gradient-to-t from-cyan-500/55 to-cyan-100/80 shadow-[0_0_18px_rgba(34,211,238,0.28)] ${
                  index === 11 ? "from-amber-500/70 to-amber-100/90" : ""
                }`}
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
        </div>
        <Panel title="Model Mix" badge="read-only">
          <StackBar label="local.small" value={68} tone="cyan" />
          <StackBar label="local.reason" value={21} tone="emerald" />
          <StackBar label="cloud gated" value={11} tone="amber" />
          <div className="mt-5 border border-cyan-100/10 bg-cyan-300/[0.035] p-3 text-xs leading-5 text-slate-300">
            Spike drill-down is navigation to timeline context only. No trace
            row becomes a command.
          </div>
        </Panel>
      </div>
    </AuditSection>
  );
}

function GovernanceBoundary() {
  return (
    <AuditSection
      id="audit-governance"
      title="Governance Boundary"
      eyebrow="Phase 19C"
      summary="Trust classes, disabled features, and forbidden tripwires are visible in one place."
      dataView="governance"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3 md:grid-cols-2">
          {BOUNDARIES.map((boundary) => (
            <article
              key={boundary.id}
              data-boundary-id={boundary.id}
              data-trust-class={boundary.trustClass}
              data-tripwire-fired={String(boundary.tripwire)}
              className={`relative min-h-44 overflow-hidden border p-4 ${
                TRUST_CLASS[boundary.trustClass]
              } ${boundary.tripwire ? "shadow-[0_0_34px_rgba(248,113,113,0.22)]" : ""}`}
            >
              {boundary.tripwire ? (
                <span
                  aria-hidden="true"
                  className="absolute right-4 top-4 h-3 w-3 animate-ping rounded-full bg-rose-300"
                />
              ) : null}
              <p className="text-[0.62rem] uppercase tracking-[0.16em] opacity-70">
                {boundary.trustClass}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{boundary.label}</h3>
              <p className="mt-3 text-sm leading-6 opacity-78">
                {boundary.detail}
              </p>
              <p className="mt-4 text-[0.65rem] uppercase tracking-[0.16em]">
                {boundary.tripwire ? "tripwire fired" : "boundary clear"}
              </p>
            </article>
          ))}
        </div>
        <Panel title="Disabled Feature Matrix" badge="structural off">
          <div className="grid gap-2">
            {DISABLED_FEATURES.map((feature) => (
              <div
                key={feature.name}
                data-disabled-feature={feature.name}
                className="grid grid-cols-[150px_1fr] gap-3 border border-white/10 bg-white/[0.025] p-3 text-xs"
              >
                <span className="font-semibold text-slate-100">
                  {feature.name}
                </span>
                <span className="leading-5 text-slate-400">
                  {feature.reason}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AuditSection>
  );
}

function AuditSection({
  id,
  title,
  eyebrow,
  summary,
  dataView,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  dataView: AuditViewId;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-audit-view={dataView}
      data-read-only-audit-view="true"
      className="scroll-mt-20 border border-cyan-100/12 bg-slate-950/36 p-4"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/60">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {summary}
          </p>
        </div>
        <span className="border border-cyan-100/18 bg-cyan-300/[0.05] px-3 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-cyan-100/80">
          read-only
        </span>
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <article className="border border-cyan-100/12 bg-slate-950/48 p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-100">
          {title}
        </h3>
        <span className="border border-cyan-100/16 bg-cyan-300/[0.05] px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-cyan-100/70">
          {badge}
        </span>
      </header>
      {children}
    </article>
  );
}

function SidebarGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function PostureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-white/10 bg-white/[0.025] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "slate";
}) {
  const tones = {
    cyan: "border-cyan-100/15 bg-cyan-300/[0.05] text-cyan-100",
    emerald: "border-emerald-100/15 bg-emerald-300/[0.05] text-emerald-100",
    slate: "border-slate-100/15 bg-slate-300/[0.04] text-slate-200",
  };
  return (
    <div className={`min-w-0 border px-2 py-1.5 ${tones[tone]}`}>
      <p className="truncate text-[0.58rem] text-slate-500">{label}</p>
      <p className="truncate text-[0.7rem]">{value}</p>
    </div>
  );
}

function FactBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cyan-100/12 bg-cyan-300/[0.035] px-3 py-2">
      <dt className="uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-100">{value}</dd>
    </div>
  );
}

function TraceKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-px w-10 ${color}`} />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.025] p-3">
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function StackBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "amber";
}) {
  const tones = {
    cyan: "bg-cyan-300",
    emerald: "bg-emerald-300",
    amber: "bg-amber-300",
  };
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-500">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden bg-white/[0.06]">
        <div
          className={`h-full ${tones[tone]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function AuditStatusBar() {
  return (
    <footer className="relative z-10 grid h-9 grid-cols-5 items-center gap-2 border-t border-cyan-100/10 bg-slate-950/72 px-4 text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
      <span>audit: read-only</span>
      <span>replay: data record</span>
      <span>transport: local</span>
      <span>tripwire: 1 drill fired</span>
      <span className="text-right text-cyan-100/70">phase 19 preview</span>
    </footer>
  );
}

function rowValue(panel: AuditPanelViewModel | undefined, label: string) {
  return (
    panel?.placeholder_rows.find((row) => row.label === label)?.value ??
    "withheld"
  );
}

function nodeLabel(id: string) {
  return GRAPH_NODES.find((node) => node.id === id)?.label ?? id;
}
