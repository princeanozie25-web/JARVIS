"use client";

import { useMemo, useState } from "react";

import {
  TELEMETRY_COCKPIT_HEALTH_BANDS,
  TELEMETRY_COCKPIT_PANEL_KINDS,
  assertTelemetryCockpitSafe,
  buildTelemetryCockpitProjection,
  buildTelemetryCockpitStats,
  getTelemetryCockpitAlertsForPanel,
  getTelemetryCockpitMetricsForPanel,
  getTelemetryCockpitWarningsForPanel,
  listTelemetryCockpitPanels,
  listTelemetryCockpitWarnings,
  scanTelemetryCockpitSafety,
  summarizeTelemetryCockpitPanel,
  type TelemetryCockpitAlert,
  type TelemetryCockpitHealthBand,
  type TelemetryCockpitMetric,
  type TelemetryCockpitPanel,
  type TelemetryCockpitPanelKind,
  type TelemetryCockpitPanelSummary,
  type TelemetryCockpitProjection,
  type TelemetryCockpitStats,
  type TelemetryCockpitWarning,
} from "@/lib/telemetry-cockpit";

type PanelKindFilter = TelemetryCockpitPanelKind | "all";
type HealthBandFilter = TelemetryCockpitHealthBand | "all";

export interface TelemetryCockpitViewerPanel {
  panel: TelemetryCockpitPanel;
  summary: TelemetryCockpitPanelSummary;
  metrics: readonly TelemetryCockpitMetric[];
  alerts: readonly TelemetryCockpitAlert[];
  warnings: readonly TelemetryCockpitWarning[];
}

export interface TelemetryCockpitViewerFilters {
  panelKind: PanelKindFilter;
  healthBand: HealthBandFilter;
  showWarnings: boolean;
  showAlerts: boolean;
  search: string;
}

export interface TelemetryCockpitViewerModel {
  projection: TelemetryCockpitProjection;
  stats: TelemetryCockpitStats;
  panels: readonly TelemetryCockpitViewerPanel[];
  warnings: readonly TelemetryCockpitWarning[];
  projection_safety_checked: true;
  metadata_only: true;
  read_only: true;
}

const DEFAULT_FILTERS: TelemetryCockpitViewerFilters = {
  panelKind: "all",
  healthBand: "all",
  showWarnings: true,
  showAlerts: true,
  search: "",
};

const DISABLED_CAPABILITY_LABELS: readonly string[] = [
  "Execution",
  "Repeat action",
  "Approval",
  "Mutation",
  "Async handoff",
  "Authority",
  "Telemetry intake",
  "Live feed",
  "Observers",
  "Store access",
];

export function buildTelemetryCockpitViewerModel(): TelemetryCockpitViewerModel {
  const projection = buildTelemetryCockpitProjection();
  assertTelemetryCockpitSafe(projection);
  const safety = scanTelemetryCockpitSafety(projection, "projection");
  if (!safety.passed) {
    throw new Error("Telemetry cockpit projection withheld by safety guard");
  }

  return {
    projection,
    stats: buildTelemetryCockpitStats(),
    panels: listTelemetryCockpitPanels().map((panel) => {
      const summary = summarizeTelemetryCockpitPanel(panel.panel_id);
      if (!summary) {
        throw new Error(
          `Missing telemetry cockpit panel summary: ${panel.panel_id}`,
        );
      }

      return {
        panel,
        summary,
        metrics: getTelemetryCockpitMetricsForPanel(panel.panel_id),
        alerts: getTelemetryCockpitAlertsForPanel(panel.panel_id),
        warnings: getTelemetryCockpitWarningsForPanel(panel.panel_id),
      };
    }),
    warnings: listTelemetryCockpitWarnings(),
    projection_safety_checked: true,
    metadata_only: true,
    read_only: true,
  };
}

export function filterTelemetryCockpitViewerPanels(
  panels: readonly TelemetryCockpitViewerPanel[],
  filters: TelemetryCockpitViewerFilters,
): readonly TelemetryCockpitViewerPanel[] {
  const search = filters.search.trim().toLowerCase();

  return panels.filter((item) => {
    if (filters.panelKind !== "all" && item.panel.kind !== filters.panelKind) {
      return false;
    }
    if (
      filters.healthBand !== "all" &&
      item.panel.health_band !== filters.healthBand
    ) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [
      item.panel.panel_id,
      item.panel.title,
      item.panel.kind,
      item.summary.title,
    ].some((value) => value.toLowerCase().includes(search));
  });
}

export function selectTelemetryCockpitViewerPanel(
  panels: readonly TelemetryCockpitViewerPanel[],
  selectedPanelId: string,
): TelemetryCockpitViewerPanel | null {
  return panels.find((item) => item.panel.panel_id === selectedPanelId) ?? null;
}

export function TelemetryCockpitViewer() {
  const model = useMemo(() => buildTelemetryCockpitViewerModel(), []);
  const [filters, setFilters] =
    useState<TelemetryCockpitViewerFilters>(DEFAULT_FILTERS);
  const [selectedPanelId, setSelectedPanelId] = useState(
    model.panels[0]?.panel.panel_id ?? "",
  );

  const visiblePanels = useMemo(
    () => filterTelemetryCockpitViewerPanels(model.panels, filters),
    [filters, model.panels],
  );
  const selectedPanel =
    selectTelemetryCockpitViewerPanel(visiblePanels, selectedPanelId) ??
    visiblePanels[0] ??
    null;

  return (
    <main
      data-telemetry-cockpit-viewer="read-only"
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
            Phase 19B visibility surface
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Telemetry Cockpit
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/75">
                Read-only observability cockpit for subsystem health, activity,
                cost bands, and governance posture.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[36rem]">
              <Stat label="Panels" value={model.stats.panel_count} />
              <Stat label="Metrics" value={model.stats.metric_count} />
              <Stat label="Alerts" value={model.stats.alert_count} />
              <Stat label="Warnings" value={model.stats.warning_count} />
            </dl>
          </div>
        </header>

        <section
          aria-label="Telemetry cockpit stats"
          className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          <Stat label="Healthy" value={model.stats.healthy_panel_count} />
          <Stat label="Degraded" value={model.stats.degraded_panel_count} />
          <Stat label="Blocked" value={model.stats.blocked_panel_count} />
          <Stat label="Sources" value={model.stats.metadata_source_count} />
          <Stat
            label="Window"
            value={formatToken(model.projection.time_window)}
          />
          <Stat label="Safety" value="checked" />
        </section>

        <section
          aria-label="Telemetry cockpit disabled capability indicators"
          className="grid gap-3 border border-white/10 bg-slate-950/62 p-5 md:grid-cols-3 xl:grid-cols-5"
        >
          {DISABLED_CAPABILITY_LABELS.map((label) => (
            <Capability
              key={label}
              label={label}
              value={label === "Authority" ? "none" : "off"}
            />
          ))}
        </section>

        <section
          aria-label="Telemetry cockpit local filters"
          className="grid gap-4 border border-white/10 bg-slate-950/62 p-5"
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <label className="grid gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Search panels
              </span>
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Panel label, id, or kind"
                className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                aria-label="Search telemetry panels"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Panel kind
              </span>
              <select
                value={filters.panelKind}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    panelKind: event.target.value as PanelKindFilter,
                  }))
                }
                className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                aria-label="Filter by panel kind"
              >
                <option value="all">all</option>
                {TELEMETRY_COCKPIT_PANEL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {formatToken(kind)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Health band
              </span>
              <select
                value={filters.healthBand}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    healthBand: event.target.value as HealthBandFilter,
                  }))
                }
                className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                aria-label="Filter by health band"
              >
                <option value="all">all</option>
                {TELEMETRY_COCKPIT_HEALTH_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {formatToken(band)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterToggle
              active={filters.showWarnings}
              label="Warnings"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  showWarnings: !current.showWarnings,
                }))
              }
            />
            <FilterToggle
              active={filters.showAlerts}
              label="Alerts"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  showAlerts: !current.showAlerts,
                }))
              }
            />
          </div>
        </section>

        <section
          aria-label="Telemetry cockpit inspection workspace"
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.65fr)]"
        >
          <section aria-label="Telemetry cockpit panel summaries">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              Panel Summaries
            </h2>
            <div className="grid gap-4">
              {visiblePanels.map((item) => (
                <PanelCard
                  key={item.panel.panel_id}
                  item={item}
                  selected={
                    item.panel.panel_id === selectedPanel?.panel.panel_id
                  }
                  showAlerts={filters.showAlerts}
                  showWarnings={filters.showWarnings}
                  onSelect={() => setSelectedPanelId(item.panel.panel_id)}
                />
              ))}
              {visiblePanels.length === 0 ? (
                <div className="border border-white/10 bg-slate-950/62 p-5 text-sm text-slate-300">
                  No panels match the current local filters.
                </div>
              ) : null}
            </div>
          </section>

          <PanelDetail
            item={selectedPanel}
            showAlerts={filters.showAlerts}
            showWarnings={filters.showWarnings}
          />
        </section>

        <section
          aria-label="Telemetry cockpit warnings"
          className="border border-amber-100/15 bg-amber-300/[0.045] p-5"
        >
          <h2 className="text-xl font-semibold text-amber-50">
            Cockpit Warnings
          </h2>
          <ul className="mt-4 grid gap-2">
            {model.warnings.map((warning) => (
              <li
                key={warning.warning_id}
                className="border border-amber-100/15 bg-black/20 px-3 py-2 text-sm text-amber-50/85"
              >
                {warning.label}
                <span className="ml-2 text-xs uppercase tracking-[0.14em] text-amber-100/55">
                  metadata only
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function PanelCard({
  item,
  selected,
  showAlerts,
  showWarnings,
  onSelect,
}: {
  readonly item: TelemetryCockpitViewerPanel;
  readonly selected: boolean;
  readonly showAlerts: boolean;
  readonly showWarnings: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <article
      data-telemetry-panel-kind={item.panel.kind}
      data-selected={String(selected)}
      className={`border p-5 ${
        selected
          ? "border-cyan-200/50 bg-cyan-300/[0.055]"
          : "border-white/10 bg-slate-950/62"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
            {formatToken(item.panel.kind)}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {item.panel.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300/75">
            {safePanelSummary(item.panel)}
          </p>
        </div>
        <span className="border border-cyan-100/15 bg-cyan-300/[0.045] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/80">
          {formatToken(item.panel.health_band)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <MiniStat label="Metrics" value={item.summary.metric_count} />
        <MiniStat label="Alerts" value={item.summary.alert_count} />
        <MiniStat label="Warnings" value={item.summary.warning_count} />
        <MiniStat label="Sources" value={item.summary.source_ref_count} />
      </dl>

      <section className="mt-5">
        <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Metrics
        </h3>
        <MetricList metrics={item.metrics} />
      </section>

      {showAlerts ? <NoticeList title="Alerts" items={item.alerts} /> : null}
      {showWarnings ? (
        <NoticeList title="Warnings" items={item.warnings} />
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        className="mt-5 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-white/[0.07]"
      >
        Inspect panel
      </button>
    </article>
  );
}

function PanelDetail({
  item,
  showAlerts,
  showWarnings,
}: {
  readonly item: TelemetryCockpitViewerPanel | null;
  readonly showAlerts: boolean;
  readonly showWarnings: boolean;
}) {
  if (!item) {
    return (
      <aside className="border border-white/10 bg-slate-950/62 p-5 text-sm text-slate-300">
        No panel selected.
      </aside>
    );
  }

  return (
    <aside
      data-telemetry-panel-detail="read-only"
      className="border border-white/10 bg-slate-950/72 p-5 xl:sticky xl:top-6 xl:self-start"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
        Panel Inspection
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {item.panel.title}
      </h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <DetailStat label="Panel id" value={item.panel.panel_id} />
        <DetailStat label="Panel kind" value={formatToken(item.panel.kind)} />
        <DetailStat
          label="Health band"
          value={formatToken(item.panel.health_band)}
        />
        <DetailStat
          label="Activity summary"
          value={`${item.summary.metric_count} metrics, ${item.summary.source_ref_count} metadata sources`}
        />
      </dl>

      <section className="mt-5">
        <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Metrics
        </h3>
        <MetricList metrics={item.metrics} compact />
      </section>

      {showAlerts ? <NoticeList title="Alerts" items={item.alerts} /> : null}
      {showWarnings ? (
        <NoticeList title="Warnings" items={item.warnings} />
      ) : null}

      <section className="mt-5">
        <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Disabled capabilities
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DISABLED_CAPABILITY_LABELS.map((label) => (
            <Capability
              key={label}
              label={label}
              value={label === "Authority" ? "none" : "off"}
            />
          ))}
        </div>
      </section>
    </aside>
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
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
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

function MetricList({
  metrics,
  compact = false,
}: {
  readonly metrics: readonly TelemetryCockpitMetric[];
  readonly compact?: boolean;
}) {
  return (
    <ul className="mt-2 grid gap-2">
      {metrics.map((metric) => (
        <li
          key={metric.metric_id}
          className="border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300"
        >
          <span className="font-medium text-slate-100">{metric.label}</span>
          <span className="ml-2 text-xs uppercase tracking-[0.14em] text-slate-500">
            {formatToken(metric.kind)} / {formatToken(metric.band)}
          </span>
          {!compact ? (
            <p className="mt-1 text-slate-300/75">{metric.value_label}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function NoticeList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly (TelemetryCockpitAlert | TelemetryCockpitWarning)[];
}) {
  return (
    <section className="mt-5">
      <h3 className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-slate-300">
        {items.length > 0 ? (
          items.map((item) => (
            <li
              key={"alert_id" in item ? item.alert_id : item.warning_id}
              className="border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              {item.label}
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

function formatToken(value: string): string {
  return value.replaceAll("_", " ");
}

function safePanelSummary(panel: TelemetryCockpitPanel): string {
  if (panel.kind === "voice_runtime") {
    return "Voice runtime posture represented as redaction-safe metadata bands.";
  }
  if (panel.kind === "approval_runtime") {
    return "Approval lifecycle posture summarized without creating records.";
  }
  return panel.summary;
}
