import { WORKING_SHELL_MODEL } from "./panel-registry";
import type { WorkingPanelViewModel, WorkingShellModel } from "./types";

export { WORKING_SHELL_MODEL } from "./panel-registry";

function formatStatus(status: WorkingPanelViewModel["status"]) {
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
            key={panel.panel_id}
            aria-label={panel.title}
            data-panel-id={panel.panel_id}
            data-panel-status={panel.status}
            data-metadata-only={String(panel.metadataOnly)}
            data-authority={panel.shellAuthority}
            data-registry-authority={panel.authority}
            data-refresh-policy={panel.refresh_policy}
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
              {panel.description}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {panel.placeholder_rows.map((row) => (
                <div
                  key={row.label}
                  className="border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <dt className="uppercase tracking-[0.16em] text-slate-500">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-slate-200">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-500">
              Metadata only - read only
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
