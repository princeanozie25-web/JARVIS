"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { CorePresence } from "@/lib/core";
import {
  AnimatePresence,
  capstoneTransition,
  motion,
  useReducedMotion,
} from "@/lib/design-language/motion-vocabulary";
import {
  INITIAL_SHELL_STATE,
  PILL_ITEMS,
  keyToShellAction,
  shellReducer,
  type PillId,
  type PresenceMark,
  type ShellState,
} from "@/lib/shell";

import { PanelBody } from "./panels";

// Program U.4 (E-031) — THE SHELL. Brief A2/A4/A8: one pill nav, two rails,
// a voice pill and a spend number, a thin ticker, panels that slide over the
// Core (depth 1), ⌘K, Escape-to-Core, keys 1–5 / A / M. Spatial constancy
// via a shared layoutId on the active pill. Depth never exceeds 2.
// AUTHORITY: none. The shell navigates; it never approves, executes or
// mutates — every control here is a navigation control (asserted).

const THEME_KEY = "jarvis.cc.theme";

export interface CommandCenterShellProps {
  readonly presence: CorePresence;
  readonly agents: readonly PresenceMark[];
  /** The Core element (server-rendered child). */
  readonly children: ReactNode;
  readonly initialTheme?: ShellState["theme"];
}

export function CommandCenterShell({
  presence,
  agents,
  children,
  initialTheme = "night",
}: CommandCenterShellProps) {
  const [state, dispatch] = useReducer(shellReducer, {
    ...INITIAL_SHELL_STATE,
    theme: initialTheme,
  });
  const reduced = useReducedMotion();
  const [hydratedTheme, setHydratedTheme] = useState(false);

  // Persisted theme (per-viewer convenience only; wrapped, never required).
  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(THEME_KEY);
        if (stored === "night" || stored === "day")
          dispatch({ type: "theme", theme: stored });
      } catch {
        /* storage unavailable: stay on the default */
      }
      setHydratedTheme(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    if (!hydratedTheme) return;
    try {
      window.localStorage.setItem(THEME_KEY, state.theme);
    } catch {
      /* ignore */
    }
  }, [state.theme, hydratedTheme]);

  // Keyboard map — brief A4.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inEditable = Boolean(
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)),
      );
      const action = keyToShellAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        inEditable,
      });
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback((to: PillId) => dispatch({ type: "go", to }), []);
  const activePill: PillId = state.panel ?? "core";
  const panelOpen = state.panel !== null;

  return (
    <div
      data-capstone-theme={state.theme}
      data-capstone-surface="shell"
      data-shell-panel={state.panel ?? "none"}
      data-shell-depth={state.paletteOpen ? "2" : panelOpen ? "1" : "0"}
      data-shell-authority="none"
      className="relative min-h-dvh w-full overflow-hidden bg-cc-field text-cc-ink"
    >
      {/* brand mark — small, top-left; the name never sits behind the Core */}
      <span
        data-shell-brand="true"
        className="absolute left-20 top-7 z-30 font-cc-sans text-cc-ink-muted"
        style={{
          fontSize: "var(--jarvis-cc-text-data-size)",
          letterSpacing: "0.28em",
        }}
      >
        JARVIS
      </span>

      {/* ── pill nav (brief A2) ── */}
      <nav
        aria-label="Command center"
        data-shell-nav="pill"
        className="absolute left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-cc-hairline bg-cc-surface/80 p-1 backdrop-blur"
      >
        {PILL_ITEMS.map((item) => {
          const active = item.id === activePill;
          return (
            <button
              key={item.id}
              type="button"
              data-shell-pill={item.id}
              data-active={String(active)}
              aria-current={active ? "page" : undefined}
              onClick={() => go(item.id)}
              className="relative rounded-full px-4 py-1.5 font-cc-sans text-cc-ink-muted transition-colors data-[active=true]:text-cc-ink"
              style={{
                fontSize: "var(--jarvis-cc-text-data-size)",
                letterSpacing: "0.02em",
              }}
            >
              {active ? (
                <motion.span
                  layoutId="shell-pill-active"
                  data-shell-pill-indicator="true"
                  className="absolute inset-0 rounded-full bg-cc-accent/15 ring-1 ring-cc-accent/40"
                  transition={capstoneTransition("pillGlide", Boolean(reduced))}
                />
              ) : null}
              <span className="relative">{item.label}</span>
              <kbd
                className="relative ml-2 font-mono text-cc-ink-muted/60"
                style={{ fontSize: "10px" }}
              >
                {item.key}
              </kbd>
            </button>
          );
        })}
      </nav>

      {/* top-right: theme + palette hints */}
      <div
        className="absolute right-6 top-6 z-30 flex items-center gap-3 font-mono text-cc-ink-muted"
        style={{ fontSize: "var(--jarvis-cc-text-ticker-size)" }}
      >
        <button
          type="button"
          data-shell-theme-toggle={state.theme}
          onClick={() => dispatch({ type: "toggle-theme" })}
          className="rounded-full border border-cc-hairline px-3 py-1 hover:text-cc-ink"
        >
          {state.theme === "night" ? "DAY" : "NIGHT"}
        </button>
        <button
          type="button"
          data-shell-palette-trigger="true"
          onClick={() => dispatch({ type: "palette", open: true })}
          className="rounded-full border border-cc-hairline px-3 py-1 hover:text-cc-ink"
        >
          ⌘K
        </button>
      </div>

      {/* ── ticker (brief A8) ── */}
      <div
        data-shell-ticker="true"
        data-shell-ticker-state="empty"
        className="absolute left-1/2 top-16 z-20 -translate-x-1/2 font-mono text-cc-ink-muted/70"
        style={{ fontSize: "var(--jarvis-cc-text-ticker-size)" }}
      >
        No activity yet
      </div>

      {/* ── left rail: presence (brief A1 Agent) ── */}
      <aside
        aria-label="Agents"
        data-shell-rail="agents"
        data-presence-provenance="registry"
        className="absolute bottom-0 left-0 top-0 z-20 flex flex-col items-center gap-3 border-r border-cc-hairline bg-cc-rail/60 pt-28"
        style={{ width: "var(--jarvis-cc-rail-left)" }}
      >
        {agents.map((mark) => (
          <span
            key={mark.id}
            data-presence-mark={mark.id}
            data-presence-state={mark.state}
            title={`${mark.label} — ${mark.state}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-cc-hairline font-mono text-cc-ink-muted/60 data-[presence-state=working]:text-cc-accent"
            style={{ fontSize: "10px" }}
          >
            {mark.initials}
          </span>
        ))}
      </aside>

      {/* ── right rail: rooms (content in U.6) ── */}
      <aside
        aria-label="Rooms"
        data-shell-rail="rooms"
        data-shell-rail-state="empty"
        className="absolute bottom-0 right-0 top-0 z-20 hidden flex-col gap-3 border-l border-cc-hairline bg-cc-rail/40 px-4 pt-28 font-cc-sans text-cc-ink-muted lg:flex"
        style={{
          width: "var(--jarvis-cc-rail-right)",
          fontSize: "var(--jarvis-cc-text-data-size)",
        }}
      >
        <span
          className="font-mono uppercase tracking-widest text-cc-ink-muted/60"
          style={{ fontSize: "10px" }}
        >
          Rooms
        </span>
        <span>No rooms yet.</span>
      </aside>

      {/* ── bottom-left voice pill · bottom-right spend (live in U.6) ── */}
      <div
        data-shell-voice-pill="placeholder"
        className="absolute bottom-5 left-20 z-20 rounded-full border border-cc-hairline px-3 py-1 font-mono text-cc-ink-muted"
        style={{ fontSize: "var(--jarvis-cc-text-ticker-size)" }}
      >
        MIC OFF · TTS —
      </div>
      <div
        data-shell-spend="no-data"
        className="absolute bottom-5 right-6 z-20 font-mono text-cc-ink-muted"
        style={{ fontSize: "var(--jarvis-cc-text-ticker-size)" }}
      >
        SPEND · no cost data
      </div>

      {/* ── the Core (depth 0), reduced to a corner ring when a panel is open ── */}
      <motion.div
        data-shell-core={panelOpen ? "corner" : "hero"}
        className="absolute inset-0"
        animate={
          panelOpen
            ? { scale: 0.28, x: "-36%", y: "-36%", opacity: 0.9 }
            : { scale: 1, x: 0, y: 0, opacity: 1 }
        }
        transition={capstoneTransition("pillGlide", Boolean(reduced))}
        style={{ transformOrigin: "50% 50%" }}
      >
        {children}
      </motion.div>

      {/* ── panels (depth 1) ── */}
      <AnimatePresence initial={false}>
        {state.panel ? (
          <motion.section
            key={state.panel}
            aria-label={state.panel}
            data-shell-panel-surface={state.panel}
            className="absolute bottom-0 top-0 z-10 border-l border-cc-hairline bg-cc-surface/95 backdrop-blur"
            style={{ left: "var(--jarvis-cc-rail-left)", right: 0 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={capstoneTransition("panelSlide", Boolean(reduced))}
          >
            <PanelBody panel={state.panel} />
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* ── ⌘K palette (depth 2 at most) ── */}
      <CommandDialog
        open={state.paletteOpen}
        onOpenChange={(open) => dispatch({ type: "palette", open })}
        title="Command palette"
        description="Go anywhere. Approvals happen only on the Gate card."
      >
        <Command data-shell-palette="cmdk">
          <CommandInput placeholder="Go to…" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup heading="Go">
              {PILL_ITEMS.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`go ${item.label}`}
                  onSelect={() => go(item.id)}
                >
                  {item.label}
                  <span className="ml-auto font-mono text-cc-ink-muted">
                    {item.key}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Act">
              <CommandItem
                value="approve waiting open first gate card"
                onSelect={() => dispatch({ type: "open-first-gate" })}
              >
                Open the first waiting Gate card
                <span className="ml-auto font-mono text-cc-ink-muted">A</span>
              </CommandItem>
              <CommandItem
                value="toggle theme night day"
                onSelect={() => dispatch({ type: "toggle-theme" })}
              >
                Switch to {state.theme === "night" ? "Day" : "Night"}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      {/* status for assistive tech: what the Core says, without looking */}
      <span
        className="sr-only"
        aria-live="polite"
        data-shell-live-status={presence.state}
      >
        {presence.statusLine}
      </span>
    </div>
  );
}
