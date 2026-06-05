import { Orb } from "@/components/orb/Orb";
import type { ReactNode } from "react";

import { GauntletCosmicViewport } from "./GauntletCosmicViewport";
import { GauntletPipeline } from "./GauntletPipeline";

const SYSTEM_STATUS = [
  ["System Health", "Optimal", "local"],
  ["Security", "Fortress Lock", "review"],
  ["Learning", "Active", "signal"],
  ["Energy", "Stable", "local"],
] as const;

const AUDIT_TRAIL = [
  ["Intent received", "10:42:01"],
  ["Classified", "10:42:02"],
  ["Routed", "10:42:03"],
  ["Gate proposal", "10:42:04"],
  ["Approved", "10:42:05"],
  ["Audited", "10:42:09"],
] as const;

const LIVE_PULSE_LEGEND = [
  ["Intent", "space"],
  ["Route", "reality"],
  ["Proposal", "gold"],
  ["Knowledge", "soul"],
  ["Agent", "time"],
  ["Council", "mind"],
] as const;

export function GauntletOverlay() {
  return (
    <div
      data-gauntlet-react-overlay="truth-layer"
      data-gauntlet-overlay-owns-labels="true"
      data-gauntlet-overlay-owns-metadata="true"
      data-gauntlet-overlay-owns-approval="false"
      className="relative z-10 grid min-h-[calc(100vh-2.5rem)] gap-3 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <aside
        aria-label="JARVIS Rest Mode reactor status"
        data-gauntlet-orb-panel="arc-reactor-heart"
        className="jarvis-gauntlet-hud-panel grid content-between gap-4 rounded-lg border border-cyan-100/10 bg-slate-950/55 p-4 shadow-[0_0_60px_rgba(14,165,233,0.14)]"
      >
        <header>
          <p className="font-mono text-sm uppercase tracking-[0.32em] text-cyan-100/80">
            JARVIS - Rest Mode
          </p>
        </header>
        <div
          aria-hidden="true"
          data-gauntlet-orb-visual-window="reactor-only"
          className="jarvis-gauntlet-orb-viewport overflow-hidden"
        >
          <div className="origin-top scale-[0.78] sm:scale-[0.82] xl:scale-[0.76]">
            <Orb activityState="idle" />
          </div>
        </div>
        <section aria-label="System standby" className="text-center">
          <p className="font-mono text-sm uppercase tracking-[0.22em] text-cyan-100/75">
            System Standby
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
            Awaiting intent
          </p>
        </section>
        <dl
          aria-label="Gauntlet status overview"
          className="grid gap-2 rounded-md border border-cyan-100/10 bg-black/20 p-3"
        >
          {SYSTEM_STATUS.map(([label, value, tone]) => (
            <div
              key={label}
              data-gauntlet-status-tone={tone}
              className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0"
            >
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-300">
                {label}
              </dt>
              <dd className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-100">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-center font-mono text-xs uppercase tracking-[0.24em] text-slate-400">
          I&apos;m here. Ready when you are.
        </p>
      </aside>

      <section
        id="gauntlet-pipeline"
        aria-label="Cinematic Living System Map"
        data-gauntlet-cinematic-stage="galaxy-map"
        className="jarvis-gauntlet-stage relative overflow-hidden rounded-lg border border-cyan-100/10 bg-slate-950/45 shadow-[0_0_90px_rgba(14,165,233,0.12)]"
      >
        <header className="relative z-20 flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
          <div>
            <p className="font-mono text-base uppercase tracking-[0.28em] text-cyan-100/90">
              JARVIS - Infinity Gauntlet
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
              Living system map
            </p>
          </div>
          <div
            aria-label="Gauntlet telemetry status"
            className="flex flex-wrap items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em]"
          >
            <span className="rounded border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
              Live
            </span>
            <span className="rounded border border-cyan-100/10 bg-black/25 px-2 py-1 text-slate-300">
              Telemetry: metadata only
            </span>
          </div>
        </header>

        <GauntletCosmicViewport>
          <GauntletPipeline presentation="cinematic" />
        </GauntletCosmicViewport>

        <aside
          aria-label="Audit trail"
          data-gauntlet-audit-trail="metadata-only"
          className="jarvis-gauntlet-audit-trail absolute right-5 top-[38%] z-30 hidden w-56 rounded-md border border-cyan-100/15 bg-slate-950/70 p-4 shadow-[0_0_50px_rgba(14,165,233,0.12)] backdrop-blur-md lg:block"
        >
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-slate-300">
            Audit Trail
          </p>
          <dl className="grid gap-2">
            {AUDIT_TRAIL.map(([label, time]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] gap-3">
                <dt className="font-mono text-[0.64rem] uppercase tracking-[0.13em] text-slate-300">
                  {label}
                </dt>
                <dd className="font-mono text-[0.64rem] text-slate-500">
                  {time}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <footer
        aria-label="Gauntlet bottom telemetry"
        data-gauntlet-bottom-telemetry="read-only"
        className="grid gap-3 lg:col-span-2 lg:grid-cols-[1fr_1.5fr_1fr_1fr_1fr]"
      >
        <MetricPanel title="Status Overview">
          <Metric label="Intents Today" value="24" />
          <Metric label="Tasks Completed" value="18" />
          <Metric label="Knowledge Growth" value="+42" />
          <Metric label="System Uptime" value="99.8%" />
        </MetricPanel>
        <MetricPanel title="Live Pulse Legend">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {LIVE_PULSE_LEGEND.map(([label, stone]) => (
              <span
                key={label}
                data-gauntlet-legend-stone={stone}
                className="rounded border border-cyan-100/10 bg-black/20 px-3 py-3 text-center font-mono text-[0.66rem] uppercase tracking-[0.12em] text-slate-200"
              >
                {label}
              </span>
            ))}
          </div>
        </MetricPanel>
        <MetricPanel title="Gate Status">
          <p className="font-mono text-xl uppercase tracking-[0.12em] text-emerald-200">
            Approved
          </p>
          <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">
            T1 path authorized
          </p>
        </MetricPanel>
        <MetricPanel title="System Trust">
          <p className="font-mono text-4xl text-emerald-200">92</p>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-emerald-300/70">
            High trust
          </p>
        </MetricPanel>
        <MetricPanel title="Cost Frame">
          <p className="font-mono text-xl uppercase tracking-[0.12em] text-emerald-200">
            T1
          </p>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-emerald-300/70">
            Optimized
          </p>
        </MetricPanel>
      </footer>
    </div>
  );
}

function MetricPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="jarvis-gauntlet-hud-panel rounded-lg border border-cyan-100/10 bg-slate-950/55 p-4">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-grid min-w-28 gap-1 rounded border border-cyan-100/10 bg-black/20 px-3 py-3">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-slate-500">
        {label}
      </span>
      <span className="font-mono text-xl text-cyan-100">{value}</span>
    </div>
  );
}
