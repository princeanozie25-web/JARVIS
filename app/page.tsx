import Link from "next/link";

import { Orb } from "@/components/orb/Orb";

const COMMAND_NAV = [
  {
    href: "/rest",
    title: "Rest",
    summary: "Orb-led idle posture, governance heartbeat, and load band.",
    role: "signal",
  },
  {
    href: "/working",
    title: "Working",
    summary: "Active operational shell — queues, panes, and approval flow.",
    role: "focus",
  },
  {
    href: "/audit",
    title: "Audit",
    summary:
      "Telemetry cockpit, governance boundaries, architecture graph, red team.",
    role: "review",
  },
  {
    href: "/converse",
    title: "Converse",
    summary:
      "The conversational lane — chat, voice draft, approvals, provider routing.",
    role: "local",
  },
] as const;

const SYSTEM_STATUS = [
  { label: "Phase", value: "21 closed · UI Polish active" },
  { label: "Substrate", value: "Phases 1-20 governed" },
  { label: "Authority", value: "Approval-gated · T3 manual-only" },
  { label: "Posture", value: "Local-first · cloud opt-in" },
] as const;

const RECENT_ACTIVITY = [
  {
    label: "Social Extraction",
    detail: "yt-dlp + faster-whisper smoke green",
    tone: "local" as const,
  },
  {
    label: "Knowledge Compounding",
    detail: "draft generator approval-gated",
    tone: "review" as const,
  },
  {
    label: "Live Council",
    detail: "cost-gated, advisory-only synthesis",
    tone: "signal" as const,
  },
  {
    label: "UI Polish",
    detail: "tokens + typography landed",
    tone: "focus" as const,
  },
] as const;

const SUGGESTIONS = [
  "Begin UI.5 (Motion tokens) only after UI.4 review",
  "Phase 22 Voice Overhaul remains MacBook-gated",
  "Drive writes remain forbidden by governance",
] as const;

const GOVERNANCE_POSTURE = [
  "No autonomous execution",
  "No graph-driven execution",
  "No raw payload telemetry",
  "No silent writes",
  "No cloud wake word",
] as const;

const TONE_TEXT_CLASS = {
  signal: "text-cyan-signal",
  focus: "text-sky-focus",
  local: "text-emerald-local",
  review: "text-amber-review",
  blocked: "text-rose-blocked",
} as const;

const TONE_BORDER_CLASS = {
  signal: "border-cyan-signal/30",
  focus: "border-sky-focus/30",
  local: "border-emerald-local/30",
  review: "border-amber-review/30",
  blocked: "border-rose-blocked/30",
} as const;

export default function Home() {
  return (
    <main
      data-surface="command-center"
      className="flex min-h-screen flex-col gap-12 bg-void px-6 py-10 text-ink sm:px-10"
    >
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-emerald-local/70">
          JARVIS · Governed Orbital Command Room
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Command Center
        </h1>
        <p className="max-w-prose text-base leading-7 text-ink/70">
          Read-only system presence. Operational lanes live in their dedicated
          cockpits. The conversational lane has its own route at{" "}
          <Link
            href="/converse"
            className="text-cyan-signal underline-offset-4 hover:underline"
          >
            /converse
          </Link>
          .
        </p>
      </header>

      <section
        aria-label="System orb"
        className="border border-border-subtle bg-panel/60 px-4 py-8 shadow-cockpit-depth sm:px-10"
      >
        <Orb />
      </section>

      <section
        aria-label="System status"
        data-region="system-status"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {SYSTEM_STATUS.map((entry) => (
          <article
            key={entry.label}
            className="border border-border-subtle bg-panel-soft px-4 py-3"
          >
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink/55">
              {entry.label}
            </p>
            <p className="mt-1 font-display text-base text-ink">
              {entry.value}
            </p>
          </article>
        ))}
      </section>

      <section
        aria-label="Quick navigation"
        data-region="quick-nav"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {COMMAND_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-cockpit={item.href.replace("/", "")}
            className={`group flex flex-col gap-2 border bg-panel px-5 py-5 transition-colors ${
              TONE_BORDER_CLASS[item.role]
            } hover:bg-panel-soft`}
          >
            <p
              className={`font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] ${
                TONE_TEXT_CLASS[item.role]
              }`}
            >
              {item.href}
            </p>
            <p className="font-display text-xl font-semibold text-ink">
              {item.title}
            </p>
            <p className="text-sm leading-6 text-ink/65">{item.summary}</p>
          </Link>
        ))}
      </section>

      <section
        aria-label="Recent activity"
        data-region="recent-activity"
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <div className="border border-border-subtle bg-panel-soft p-5">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ink/55">
            Recent activity
          </p>
          <ul className="mt-4 space-y-3">
            {RECENT_ACTIVITY.map((entry) => (
              <li
                key={entry.label}
                className="flex flex-col gap-1 border-l-2 pl-3"
                style={{
                  borderColor: `var(--jarvis-color-${entry.tone === "focus" ? "sky-focus" : entry.tone === "local" ? "emerald-local" : entry.tone === "review" ? "amber-review" : "cyan-signal"})`,
                }}
              >
                <p
                  className={`font-mono text-[0.66rem] font-semibold uppercase tracking-[0.2em] ${TONE_TEXT_CLASS[entry.tone]}`}
                >
                  {entry.label}
                </p>
                <p className="text-sm text-ink/75">{entry.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside
          aria-label="Suggestions summary"
          data-region="suggestions"
          className="border border-border-subtle bg-panel-soft p-5"
        >
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ink/55">
            Suggestions
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink/75">
            {SUGGESTIONS.map((entry) => (
              <li key={entry} className="leading-6">
                {entry}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section
        aria-label="Governance posture"
        data-region="governance-posture"
        className="border border-border-subtle bg-panel p-5"
      >
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-local">
          Governance posture
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GOVERNANCE_POSTURE.map((rule) => (
            <li
              key={rule}
              className="flex items-center gap-3 border border-border-subtle bg-panel-soft px-3 py-2 text-sm text-ink/80"
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-emerald-local"
              />
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <footer className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-ink/40">
        Read-only surface. Operational lanes carry side-effects, not this view.
      </footer>
    </main>
  );
}
