// Program U.4 (E-031) — the shell's navigation model as PURE data + a
// reducer, so the keyboard map (brief A4) is testable without a DOM.
//   Pill nav 1–5 · Escape → Core · ⌘K palette · `/` composer · `A` first
//   Gate card · `M` mic (PTT). Nothing here can approve, execute or mutate;
//   "open first Gate card" only opens the Board panel — the card itself is
//   the only place a decision is made, and it is not in this slice.

export const SHELL_PANELS = ["standup", "board", "rooms", "evidence"] as const;
export type ShellPanel = (typeof SHELL_PANELS)[number];

/** Pill order — brief A2. Index 0 is the Core (no panel). */
export const PILL_ITEMS = [
  { id: "core", label: "Core", key: "1" },
  { id: "standup", label: "Standup", key: "2" },
  { id: "board", label: "Board", key: "3" },
  { id: "rooms", label: "Rooms", key: "4" },
  { id: "evidence", label: "Evidence", key: "5" },
] as const;
export type PillId = (typeof PILL_ITEMS)[number]["id"];

export interface ShellState {
  readonly panel: ShellPanel | null;
  readonly paletteOpen: boolean;
  readonly theme: "night" | "day";
  /** Set by `/`; the composer (U.5) consumes and clears it. */
  readonly composerFocusRequested: boolean;
  /** Set by `M`; the voice pill (U.6) consumes it. Never grants authority. */
  readonly micToggleRequested: boolean;
}

export const INITIAL_SHELL_STATE: ShellState = {
  panel: null,
  paletteOpen: false,
  theme: "night",
  composerFocusRequested: false,
  micToggleRequested: false,
};

export type ShellAction =
  | { type: "go"; to: PillId }
  | { type: "escape" }
  | { type: "palette"; open: boolean }
  | { type: "theme"; theme: ShellState["theme"] }
  | { type: "toggle-theme" }
  | { type: "open-first-gate" }
  | { type: "focus-composer" }
  | { type: "toggle-mic" }
  | { type: "consume-composer-focus" }
  | { type: "consume-mic-toggle" };

export function shellReducer(
  state: ShellState,
  action: ShellAction,
): ShellState {
  switch (action.type) {
    case "go":
      return {
        ...state,
        panel: action.to === "core" ? null : action.to,
        paletteOpen: false,
      };
    case "escape":
      // Escape ALWAYS returns to the Core — palette first, then panel.
      if (state.paletteOpen) return { ...state, paletteOpen: false };
      return { ...state, panel: null };
    case "palette":
      return { ...state, paletteOpen: action.open };
    case "theme":
      return { ...state, theme: action.theme };
    case "toggle-theme":
      return { ...state, theme: state.theme === "night" ? "day" : "night" };
    case "open-first-gate":
      // Opens the Board (where Gate cards live). Approving is NOT an action
      // this reducer knows.
      return { ...state, panel: "board", paletteOpen: false };
    case "focus-composer":
      return { ...state, composerFocusRequested: true, paletteOpen: false };
    case "toggle-mic":
      return { ...state, micToggleRequested: true };
    case "consume-composer-focus":
      return { ...state, composerFocusRequested: false };
    case "consume-mic-toggle":
      return { ...state, micToggleRequested: false };
  }
}

export interface KeyEventLike {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  /** True when the event target is an editable field — single keys are ignored there. */
  readonly inEditable?: boolean;
}

/** Brief A4 keyboard map → action, or null when the key means nothing here. */
export function keyToShellAction(event: KeyEventLike): ShellAction | null {
  const mod = Boolean(event.metaKey || event.ctrlKey);
  if (mod && (event.key === "k" || event.key === "K")) {
    return { type: "palette", open: true };
  }
  if (event.key === "Escape") return { type: "escape" };
  if (event.inEditable || mod || event.altKey) return null;
  switch (event.key) {
    case "1":
    case "2":
    case "3":
    case "4":
    case "5": {
      const item = PILL_ITEMS[Number(event.key) - 1];
      return item ? { type: "go", to: item.id } : null;
    }
    case "/":
      return { type: "focus-composer" };
    case "a":
    case "A":
      return { type: "open-first-gate" };
    case "m":
    case "M":
      return { type: "toggle-mic" };
    default:
      return null;
  }
}

export function isShellPanel(value: unknown): value is ShellPanel {
  return (
    typeof value === "string" &&
    (SHELL_PANELS as readonly string[]).includes(value)
  );
}
