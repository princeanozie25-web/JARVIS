import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";

import {
  CommandCenterNav,
  type CommandCenterRouteId,
} from "./CommandCenterNav";

type Suggestion = Readonly<{
  id: string;
  label: string;
  title: string;
  body: string;
  signal: "cyan" | "emerald" | "amber" | "violet";
}>;

const REST_SUGGESTIONS: readonly Suggestion[] = Object.freeze([
  {
    id: "suggest-newsletter",
    label: "AI Daily Newsletter",
    title: "Compile today's model + agent shifts",
    body: "Prepared as a read-only prompt for future gate review.",
    signal: "cyan",
  },
  {
    id: "suggest-job-scout",
    label: "Job Scout Report",
    title: "Surface new AI systems roles",
    body: "Can become a proposal later; this card does not act.",
    signal: "emerald",
  },
  {
    id: "suggest-resume-workflow",
    label: "Resume Jarvis UI work",
    title: "Pick up command-center polish",
    body: "Route context is visible; execution remains absent.",
    signal: "violet",
  },
  {
    id: "suggest-morning-brief",
    label: "Morning Brief",
    title: "Review scheduler digest",
    body: "Digest preview only. No reminder is created here.",
    signal: "amber",
  },
  {
    id: "suggest-knowledge",
    label: "Knowledge Compounding Draft",
    title: "Prepare vault enrichment outline",
    body: "Metadata-safe draft signal for the working gate.",
    signal: "cyan",
  },
  {
    id: "suggest-cost",
    label: "Cost/Telemetry Check",
    title: "Inspect today's spend posture",
    body: "Navigates attention only; no telemetry row changes.",
    signal: "emerald",
  },
]);

const STATUS_READOUTS = [
  { label: "Mode", value: "standing pipeline" },
  { label: "Authority", value: "none" },
  { label: "Wake word", value: "visual state only" },
  { label: "Suggestions", value: "proposal seeds" },
] as const;

const SIGNAL_CLASS = {
  cyan: "border-cyan-200/30 bg-cyan-300/[0.06] text-cyan-100",
  emerald: "border-emerald-200/30 bg-emerald-300/[0.06] text-emerald-100",
  amber: "border-amber-200/35 bg-amber-300/[0.07] text-amber-100",
  violet: "border-violet-200/30 bg-violet-300/[0.06] text-violet-100",
} satisfies Record<Suggestion["signal"], string>;

export interface RestCommandCenterProps {
  activeRoute: CommandCenterRouteId;
  marker: string;
}

export function RestCommandCenter({
  activeRoute,
  marker,
}: RestCommandCenterProps) {
  return (
    <div
      data-command-center-shell="pipeline-rest"
      data-rest-layout="pipeline-command-center"
      className="cc-shell min-h-screen overflow-hidden bg-void p-4 text-ink"
    >
      <div className="cc-atmosphere" aria-hidden="true" />
      <div className="relative mx-auto grid h-[calc(100vh-2rem)] min-h-[720px] max-w-[1720px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-cyan-100/14 bg-slate-950/64 shadow-[0_32px_130px_rgba(2,8,23,0.72)]">
        <header className="cc-shell-header grid min-h-16 grid-cols-[220px_minmax(0,1fr)_360px] items-center gap-4 border-b border-cyan-100/12 px-4">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-cyan-200/62">
              Jarvis
            </p>
            <h1 className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-white">
              Pipeline Core
            </h1>
          </div>
          <CommandCenterNav active={activeRoute} />
          <div className="grid grid-cols-2 gap-2 text-[0.65rem] uppercase tracking-[0.14em]">
            <Readout label="Marker" value={marker} />
            <Readout label="Posture" value="standing by" />
          </div>
        </header>

        <section className="relative grid min-h-0 grid-cols-[minmax(240px,0.78fr)_minmax(560px,1.44fr)_minmax(260px,0.82fr)] gap-4 overflow-hidden px-4 py-5">
          <aside
            aria-label="Suggestion inbox"
            data-suggestion-inbox="pipeline-hud"
            className="cc-hud-column cc-hud-left"
          >
            {REST_SUGGESTIONS.slice(0, 3).map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
          </aside>

          <div
            aria-label="Standing-by governed pipeline"
            data-rest-pipeline-surface="standing-by"
            className="relative min-h-0 overflow-auto"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-8%] bg-[radial-gradient(circle_at_50%_38%,rgba(125,211,252,0.18),transparent_34%),linear-gradient(rgba(125,211,252,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.028)_1px,transparent_1px)] bg-[length:auto,36px_36px,36px_36px]"
            />
            <div className="relative">
              <PipelineDiagram />
            </div>
          </div>

          <aside
            aria-label="Suggestion status"
            data-suggestion-inbox="pipeline-hud-secondary"
            className="cc-hud-column cc-hud-right"
          >
            {REST_SUGGESTIONS.slice(3).map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
          </aside>
        </section>

        <footer className="grid min-h-12 grid-cols-[1fr_1.2fr_1fr] items-center border-t border-cyan-100/12 px-4 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
          <span>Synthetic demo-safe only - Metadata-only visual layer</span>
          <dl className="grid grid-cols-4 gap-2">
            {STATUS_READOUTS.map((entry) => (
              <div key={entry.label} className="min-w-0">
                <dt className="truncate text-slate-600">{entry.label}</dt>
                <dd className="truncate text-cyan-100/78">{entry.value}</dd>
              </div>
            ))}
          </dl>
          <span className="text-right">No execution authority</span>
        </footer>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <article
      data-suggestion-card={suggestion.id}
      data-suggestion-executable="false"
      data-authority="none"
      className={`cc-suggestion-card ${SIGNAL_CLASS[suggestion.signal]}`}
    >
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] opacity-70">
        {suggestion.label}
      </p>
      <h2 className="mt-2 font-display text-base font-semibold text-white">
        {suggestion.title}
      </h2>
      <p className="mt-2 text-sm leading-5 text-slate-300/78">
        {suggestion.body}
      </p>
      <p className="mt-4 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
        suggestion only - no hidden write
      </p>
    </article>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-cyan-100/12 bg-cyan-300/[0.04] px-3 py-2">
      <p className="truncate text-slate-500">{label}</p>
      <p className="truncate text-cyan-100">{value}</p>
    </div>
  );
}
