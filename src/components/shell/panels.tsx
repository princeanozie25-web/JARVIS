// Program U.4 (E-031) — the four panels' DESIGNED empty states (brief A7).
// Content arrives in U.5 (Standup, Board), U.6 (Rooms), U.7 (Evidence).
// Nothing here can act: Evidence links are plain read-only navigation to the
// existing audit cockpits, which carry their own I5 no-affordance contracts.

import type { ShellPanel } from "@/lib/shell";

export interface PanelCopy {
  readonly title: string;
  readonly empty: string;
  readonly hint: string;
}

export const PANEL_COPY: Readonly<Record<ShellPanel, PanelCopy>> = {
  standup: {
    title: "Standup",
    empty: "Your agents are quiet.",
    hint: "Summon one with @name in the composer, or press / to start typing.",
  },
  board: {
    title: "Board",
    empty: "Nothing to decide.",
    hint: "Gate cards land here when an agent proposes something that touches the world.",
  },
  rooms: {
    title: "Rooms",
    empty: "No rooms yet — say what you're working on.",
    hint: "Each room is a project: its lane, its map, its nodes.",
  },
  evidence: {
    title: "Evidence",
    empty: "The proof, read-only.",
    hint: "Pipeline map, audit chain, drills and telemetry. Nothing here has a button that does things.",
  },
};

const EVIDENCE_LINKS = [
  { href: "/audit/pipeline", label: "Pipeline map" },
  { href: "/audit", label: "Audit chain" },
  { href: "/audit/telemetry-cockpit", label: "Telemetry" },
  { href: "/audit/governance-boundaries", label: "Governance boundaries" },
  { href: "/audit/red-team-sandbox", label: "Red-team drills" },
] as const;

export function PanelBody({ panel }: { panel: ShellPanel }) {
  const copy = PANEL_COPY[panel];
  return (
    <div
      data-shell-panel-body={panel}
      data-shell-panel-state="empty"
      className="flex h-full flex-col gap-6 px-10 pt-24"
    >
      <h2
        className="font-cc-sans text-cc-ink"
        style={{
          fontSize: "var(--jarvis-cc-text-h1-size)",
          lineHeight: "var(--jarvis-cc-text-h1-line-height)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {copy.title}
      </h2>
      <p
        className="max-w-[28rem] font-cc-sans text-cc-ink"
        style={{
          fontSize: "var(--jarvis-cc-text-h2-size)",
          lineHeight: "var(--jarvis-cc-text-h2-line-height)",
        }}
      >
        {copy.empty}
      </p>
      <p
        className="max-w-[28rem] font-cc-sans text-cc-ink-muted"
        style={{ fontSize: "var(--jarvis-cc-text-body-size)" }}
      >
        {copy.hint}
      </p>
      {panel === "evidence" ? (
        <ul
          data-shell-evidence-links="read-only"
          className="mt-4 flex flex-col gap-2 font-mono text-cc-ink-muted"
          style={{ fontSize: "var(--jarvis-cc-text-data-size)" }}
        >
          {EVIDENCE_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="underline-offset-4 hover:text-cc-ink hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
