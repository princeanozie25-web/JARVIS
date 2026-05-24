import type { WorkingPanelPlaceholder, WorkingShellModel } from "./types";

export const WORKING_SHELL_MODEL: WorkingShellModel = Object.freeze({
  title: "JARVIS Working",
  subtitle: "Read-only cockpit shell. Static placeholder regions only.",
  posture: "read_only_placeholder",
  localOnly: true,
  metadataOnly: true,
  authority: "none",
  panels: Object.freeze([
    {
      id: "system_status",
      title: "System status",
      eyebrow: "Local shell",
      summary:
        "Host readiness indicators will appear here after observation wiring.",
      status: "placeholder",
      metadataOnly: true,
      authority: "none",
    },
    {
      id: "room_state",
      title: "Room state",
      eyebrow: "Room OS",
      summary:
        "Room topology summaries are withheld until read-only projections exist.",
      status: "withheld",
      metadataOnly: true,
      authority: "none",
    },
    {
      id: "recent_activity",
      title: "Recent activity",
      eyebrow: "Timeline",
      summary: "Append-only event summaries will render here in a later slice.",
      status: "placeholder",
      metadataOnly: true,
      authority: "none",
    },
    {
      id: "model_router_status",
      title: "Model/router status",
      eyebrow: "Routing",
      summary: "Routing status remains disconnected from this shell.",
      status: "not_wired",
      metadataOnly: true,
      authority: "none",
    },
    {
      id: "suggestions_inbox",
      title: "Suggestions inbox",
      eyebrow: "Assistance",
      summary:
        "Suggestion summaries are visual placeholders with no action surface.",
      status: "placeholder",
      metadataOnly: true,
      authority: "none",
    },
    {
      id: "cost_usage",
      title: "Cost/usage",
      eyebrow: "Budget",
      summary: "Usage bands will stay metadata-only when connected later.",
      status: "placeholder",
      metadataOnly: true,
      authority: "none",
    },
    {
      id: "safety_governance",
      title: "Safety/governance",
      eyebrow: "Policy",
      summary:
        "Governance posture is visible only; no decisions are made here.",
      status: "withheld",
      metadataOnly: true,
      authority: "none",
    },
  ] satisfies WorkingPanelPlaceholder[]),
});

function formatStatus(status: WorkingPanelPlaceholder["status"]) {
  return status.replaceAll("_", " ");
}

export interface WorkingShellProps {
  model?: WorkingShellModel;
}

export function WorkingShell({
  model = WORKING_SHELL_MODEL,
}: WorkingShellProps) {
  return (
    <section
      aria-label="JARVIS Working cockpit shell"
      data-working-shell="read-only"
      data-local-only={String(model.localOnly)}
      data-metadata-only={String(model.metadataOnly)}
      data-authority={model.authority}
      className="grid gap-6"
    >
      <header className="grid gap-3 border-b border-white/10 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/70">
            Command Center
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">
            {model.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/75">
            {model.subtitle}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-left text-xs">
          <div className="border border-white/10 bg-white/[0.035] px-3 py-2">
            <dt className="uppercase tracking-[0.18em] text-slate-500">Mode</dt>
            <dd className="mt-1 text-slate-100">Working</dd>
          </div>
          <div className="border border-white/10 bg-white/[0.035] px-3 py-2">
            <dt className="uppercase tracking-[0.18em] text-slate-500">Data</dt>
            <dd className="mt-1 text-slate-100">Static</dd>
          </div>
          <div className="border border-white/10 bg-white/[0.035] px-3 py-2">
            <dt className="uppercase tracking-[0.18em] text-slate-500">
              Authority
            </dt>
            <dd className="mt-1 text-slate-100">None</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {model.panels.map((panel) => (
          <article
            key={panel.id}
            aria-label={panel.title}
            data-panel-id={panel.id}
            data-panel-status={panel.status}
            data-metadata-only={String(panel.metadataOnly)}
            data-authority={panel.authority}
            className="min-h-44 border border-white/10 bg-slate-950/55 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.28)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/60">
                  {panel.eyebrow}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  {panel.title}
                </h2>
              </div>
              <span className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-slate-400">
                {formatStatus(panel.status)}
              </span>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300/72">
              {panel.summary}
            </p>
            <p className="mt-6 text-xs uppercase tracking-[0.18em] text-slate-500">
              Metadata only · no authority
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
