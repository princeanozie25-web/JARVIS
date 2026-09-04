"use client";

import type { CorePresence } from "@/lib/core";

import { CoreRing } from "./CoreRing";

// Program U.3 (E-030) + v3.2 amendment (E-032) — THE CORE. One hero object:
// the reactor is the Human Gate's face on a TRUE BLACK field, one status line
// under it. No wordmark behind it (operator amendment, 2026-09-04).
// The DOM here is the truth layer (state, count, provenance as data
// attributes; the status line as text); the ring only paints it.
// Amber reaches this component only through a CorePresence resolved by
// resolveCoreState, which admits it solely from a live store read.
// This surface has no buttons, forms, links or handlers: the approve flow
// (brief A6) arrives with the shell's keyboard map in U.4 and opens the Gate
// card — the Core itself never approves.

export interface CoreProps {
  readonly presence: CorePresence;
  readonly theme?: "night" | "day";
}

export function Core({ presence, theme = "night" }: CoreProps) {
  return (
    <section
      aria-label={`JARVIS core — ${presence.statusLine}`}
      data-capstone-theme={theme}
      data-capstone-surface="core"
      data-core-state={presence.state}
      data-core-amber={String(presence.amber)}
      data-core-count={String(presence.count)}
      data-core-provenance={presence.provenance}
      data-core-authority="none"
      data-metadata-only="true"
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-cc-field text-cc-ink"
    >
      <div
        className="relative flex flex-col items-center"
        style={{
          width: "var(--jarvis-cc-core-size)",
          height: "var(--jarvis-cc-core-size)",
        }}
      >
        <CoreRing state={presence.state} />
      </div>

      <p
        data-core-status-line="true"
        className="absolute font-cc-sans text-cc-ink-muted"
        style={{
          top: "calc(50% + var(--jarvis-cc-core-size) / 2 + 12px)",
          fontSize: "var(--jarvis-cc-text-body-size)",
          letterSpacing: "0.02em",
        }}
      >
        {presence.statusLine}
        {presence.count > 0 ? (
          <span
            data-core-count-badge="true"
            className="ml-3 font-mono text-cc-gate"
          >
            {presence.count}
          </span>
        ) : null}
      </p>
    </section>
  );
}
