import {
  WORKING_SHELL_MODEL,
  createProjectionBackedPanels,
} from "./WorkingShell";
import type {
  WorkingPanelId,
  WorkingPanelViewModel,
  WorkingShellModel,
} from "./types";

/**
 * Mission-control cockpit for `/working` — UI.8.
 *
 * Recomposes the seven existing read-only panels from the panel
 * registry into the structure called out in the UI Polish Plan:
 *
 *   Row 1 (status)      SYSTEM STATUS · SUGGESTIONS · COST
 *   Row 2 (situation)   ROOM STATE · RECENT ACTIVITY
 *   Row 3 (operations)  MODEL ROUTER · SAFETY
 *   Row 4 (command bar) Presentational footer
 *
 * The component is a strict recompose — every panel in the registry
 * still renders, every governance attribute still surfaces, and the
 * fail-closed projection logic in `WorkingShell` is reused verbatim.
 * No buttons, no forms, no inputs, no anchors, no max-width
 * dashboard chrome.
 */

function formatStatus(status: WorkingPanelViewModel["status"]) {
  return status.replaceAll("_", " ");
}

function formatBadge(value: string) {
  return value.replaceAll("_", " ");
}

function statusClass(status: WorkingPanelViewModel["status"]) {
  switch (status) {
    case "placeholder":
      return "border-signal/30 bg-panel-soft text-ink";
    case "withheld":
      return "border-review/30 bg-panel-soft text-review";
    case "not_wired":
      return "border-border-subtle bg-panel-soft text-ink/70";
  }
}

const COCKPIT_ROWS = [
  {
    region: "status",
    columns: 3,
    panels: ["system_status", "suggestions_inbox", "cost_usage"] as const,
  },
  {
    region: "situation",
    columns: 2,
    panels: ["room_state", "recent_activity"] as const,
  },
  {
    region: "operations",
    columns: 2,
    panels: ["model_router", "safety_governance"] as const,
  },
] as const;

const REGION_COLUMNS: Record<string, string> = {
  status: "grid gap-4 lg:grid-cols-3",
  situation: "grid gap-4 lg:grid-cols-2",
  operations: "grid gap-4 lg:grid-cols-2",
};

export interface WorkingCockpitProps {
  model?: WorkingShellModel;
  projectionPanels?: readonly WorkingPanelViewModel[];
}

export function WorkingCockpit({
  model = WORKING_SHELL_MODEL,
  projectionPanels,
}: WorkingCockpitProps) {
  const panels = projectionPanels
    ? createProjectionBackedPanels(model.panels, projectionPanels)
    : model.panels;
  const panelsById = indexById(panels);

  return (
    <section
      aria-label="JARVIS Working cockpit shell"
      data-working-shell="read-only"
      data-working-cockpit="mission-control"
      data-local-only={String(model.localOnly)}
      data-metadata-only={String(model.metadataOnly)}
      data-authority={model.authority}
      className="grid w-full gap-6"
    >
      <header
        data-cockpit-region="header"
        className="relative overflow-hidden border border-border-subtle bg-panel/80 p-6 shadow-cockpit-depth"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,var(--color-theme-glow),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-signal">
              Command Center Cockpit
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {model.title}
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-ink/70">
              {model.subtitle}
            </p>
          </div>
          <dl
            aria-label="Working shell metadata badges"
            className="grid grid-cols-1 gap-2 text-left text-xs sm:grid-cols-3 lg:min-w-[30rem]"
          >
            <div className="border border-signal/30 bg-panel-soft px-3 py-2">
              <dt className="font-mono uppercase tracking-[0.18em] text-ink/50">
                Authority
              </dt>
              <dd className="mt-1 text-ink">{formatBadge("read_only")}</dd>
            </div>
            <div className="border border-local/30 bg-panel-soft px-3 py-2">
              <dt className="font-mono uppercase tracking-[0.18em] text-ink/50">
                Data
              </dt>
              <dd className="mt-1 text-ink">{formatBadge("metadata_only")}</dd>
            </div>
            <div className="border border-border-subtle bg-panel-soft px-3 py-2">
              <dt className="font-mono uppercase tracking-[0.18em] text-ink/50">
                Refresh
              </dt>
              <dd className="mt-1 text-ink">
                {formatBadge("static_placeholder")}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div
        aria-label="Working panel registry layout"
        data-cockpit-region="panels"
        className="grid gap-6"
      >
        {COCKPIT_ROWS.map((row) => (
          <div
            key={row.region}
            data-cockpit-region={row.region}
            data-cockpit-columns={String(row.columns)}
            className={REGION_COLUMNS[row.region]}
          >
            {row.panels.map((panelId) => {
              const panel = panelsById[panelId];
              if (!panel) return null;
              return <CockpitPanelCard key={panel.panel_id} panel={panel} />;
            })}
          </div>
        ))}
      </div>

      <footer
        aria-label="Command bar"
        data-cockpit-region="command-bar"
        className="relative border border-border-subtle bg-panel p-5 shadow-cockpit-depth"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-theme-primary)] to-transparent opacity-60"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-signal">
              Command bar
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Presentational only. Command, approval, and execution lanes live
              behind the governed approval lifecycle — no controls are surfaced
              on the Working cockpit.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="border border-border-subtle bg-panel-soft px-3 py-2">
              <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
                Mode
              </dt>
              <dd className="mt-1 text-ink">read only</dd>
            </div>
            <div className="border border-border-subtle bg-panel-soft px-3 py-2">
              <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
                Posture
              </dt>
              <dd className="mt-1 text-ink">local only</dd>
            </div>
            <div className="border border-border-subtle bg-panel-soft px-3 py-2">
              <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
                Data
              </dt>
              <dd className="mt-1 text-ink">metadata only</dd>
            </div>
          </dl>
        </div>
      </footer>
    </section>
  );
}

function indexById(
  panels: readonly WorkingPanelViewModel[],
): Record<WorkingPanelId, WorkingPanelViewModel | undefined> {
  const map: Partial<Record<WorkingPanelId, WorkingPanelViewModel>> = {};
  for (const panel of panels) {
    map[panel.panel_id] = panel;
  }
  return map as Record<WorkingPanelId, WorkingPanelViewModel | undefined>;
}

function CockpitPanelCard({ panel }: { panel: WorkingPanelViewModel }) {
  return (
    <article
      aria-label={panel.title}
      data-panel-id={panel.panel_id}
      data-panel-status={panel.status}
      data-metadata-only={String(panel.metadataOnly)}
      data-authority={panel.shellAuthority}
      data-registry-authority={panel.authority}
      data-refresh-policy={panel.refresh_policy}
      className="relative min-h-56 overflow-hidden border border-border-subtle bg-panel-soft/95 p-5 shadow-cockpit-depth"
      style={{
        transition:
          "border-color var(--jarvis-motion-duration-normal) var(--jarvis-motion-easing-smooth)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/40 to-transparent"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-signal">
            {panel.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">
            {panel.title}
          </h2>
        </div>
        <span
          className={`border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] ${statusClass(panel.status)}`}
        >
          {formatStatus(panel.status)}
        </span>
      </div>
      <p className="mt-5 text-sm leading-6 text-ink/70">{panel.description}</p>
      <div
        aria-label={`${panel.title} metadata badges`}
        className="mt-5 flex flex-wrap gap-2"
      >
        {[panel.authority, panel.data_classification, panel.refresh_policy].map(
          (badge) => (
            <span
              key={badge}
              className="border border-border-subtle bg-panel-soft px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-ink/55"
            >
              {formatBadge(badge)}
            </span>
          ),
        )}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
        {panel.placeholder_rows.map((row) => (
          <div
            key={row.label}
            className="border border-border-subtle bg-panel-soft px-3 py-2"
          >
            <dt className="font-mono uppercase tracking-[0.16em] text-ink/50">
              {row.label}
            </dt>
            <dd className="mt-1 text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-ink/45">
        Visual placeholder - no authority
      </p>
    </article>
  );
}
