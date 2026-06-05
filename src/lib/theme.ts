/**
 * JARVIS theme engine — UI.7.
 *
 * Five typed, token-driven themes (`blue`, `red`, `amber`, `purple`,
 * `green`). Each descriptor controls `--color-theme-primary` and
 * `--color-theme-glow` only — components consume those CSS variables
 * (never raw hex). Persistence and LED-sync hooks are factored out as
 * pure helpers so they can be tested without a DOM.
 *
 * No hardware. The LED-sync hub is a typed observer registry meant for
 * future Phase-25/26 sensing work to attach to; this module never
 * imports an adapter, calls `fetch`, opens a serial port, or speaks to
 * any device.
 */

import { jarvisColors } from "@/lib/design-tokens";

export const JARVIS_THEMES = [
  "blue",
  "red",
  "amber",
  "purple",
  "green",
] as const;

export type JarvisTheme = (typeof JARVIS_THEMES)[number];

export type JarvisThemeSemantic =
  | "signal"
  | "focus"
  | "local"
  | "review"
  | "blocked";

export interface JarvisThemeDescriptor {
  /** Theme key. */
  theme: JarvisTheme;
  /** Human-readable label. */
  label: string;
  /** Resolved primary color for `--color-theme-primary`. */
  primary: string;
  /** Resolved glow color for `--color-theme-glow`. */
  glow: string;
  /**
   * Semantic governance alias the theme leans on. Purely descriptive —
   * does not gate behavior.
   */
  semantic: JarvisThemeSemantic;
}

export const JARVIS_THEME_DESCRIPTORS: Readonly<
  Record<JarvisTheme, JarvisThemeDescriptor>
> = Object.freeze({
  blue: {
    theme: "blue",
    label: "Blue",
    primary: jarvisColors["sky-focus"],
    glow: "rgba(56, 189, 248, 0.32)",
    semantic: "focus",
  },
  red: {
    theme: "red",
    label: "Red",
    primary: jarvisColors["rose-blocked"],
    glow: "rgba(251, 113, 133, 0.32)",
    semantic: "blocked",
  },
  amber: {
    theme: "amber",
    label: "Amber",
    primary: jarvisColors["amber-review"],
    glow: "rgba(251, 191, 36, 0.32)",
    semantic: "review",
  },
  purple: {
    theme: "purple",
    label: "Purple",
    primary: jarvisColors.violet,
    glow: "rgba(167, 139, 250, 0.32)",
    semantic: "signal",
  },
  green: {
    theme: "green",
    label: "Green",
    primary: jarvisColors["emerald-local"],
    glow: "rgba(110, 231, 183, 0.32)",
    semantic: "local",
  },
});

const KNOWN_THEMES: ReadonlySet<string> = new Set(JARVIS_THEMES);

/** Type guard. */
export function isJarvisTheme(input: unknown): input is JarvisTheme {
  return typeof input === "string" && KNOWN_THEMES.has(input);
}

export const DEFAULT_JARVIS_THEME: JarvisTheme = "blue";

/**
 * Deny-by-default resolver. Returns the blue descriptor for any
 * unrecognised input — never throws.
 */
export function resolveTheme(input: unknown): JarvisThemeDescriptor {
  if (isJarvisTheme(input)) {
    return JARVIS_THEME_DESCRIPTORS[input];
  }
  return JARVIS_THEME_DESCRIPTORS[DEFAULT_JARVIS_THEME];
}

/** The two CSS variables every component reads through. */
export const THEME_CSS_VARIABLE_NAMES = [
  "--color-theme-primary",
  "--color-theme-glow",
] as const;

export type ThemeCssVariableName = (typeof THEME_CSS_VARIABLE_NAMES)[number];

/**
 * Returns the CSS-variable map for the given theme. Used by
 * `ThemeProvider` to mount the theme, by tests to assert the contract,
 * and by future LED-sync consumers that want the values without a DOM.
 */
export function themeCSSVars(
  input: JarvisTheme | JarvisThemeDescriptor | string,
): Record<ThemeCssVariableName, string> {
  const descriptor =
    typeof input === "string" || typeof input === "undefined"
      ? resolveTheme(input)
      : input;
  return {
    "--color-theme-primary": descriptor.primary,
    "--color-theme-glow": descriptor.glow,
  };
}

export const THEME_STORAGE_KEY = "jarvis.theme";

/**
 * Minimal storage contract — matches `window.localStorage`'s slice we
 * need but lets tests pass a fake. SSR-safe.
 */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ThemeStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns the persisted theme or `null` if nothing valid is stored. */
export function loadPersistedTheme(
  storage: ThemeStorage | null = defaultStorage(),
): JarvisTheme | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isJarvisTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Best-effort persistence. Never throws. */
export function persistTheme(
  theme: JarvisTheme,
  storage: ThemeStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* swallow — persistence is best-effort */
  }
}

/**
 * Minimal element contract used by `applyThemeToDocument`. Lets tests
 * supply a stub `{ style: { setProperty } }` instead of a JSDOM root.
 */
export interface ThemeStyleTarget {
  style: { setProperty(name: string, value: string): void };
}

function defaultRoot(): ThemeStyleTarget | null {
  if (typeof document === "undefined") return null;
  return document.documentElement as unknown as ThemeStyleTarget;
}

/** Writes the theme's CSS variables onto the supplied element. */
export function applyThemeToDocument(
  input: JarvisTheme | JarvisThemeDescriptor,
  root: ThemeStyleTarget | null = defaultRoot(),
): void {
  if (!root) return;
  const vars = themeCSSVars(input);
  for (const name of THEME_CSS_VARIABLE_NAMES) {
    root.style.setProperty(name, vars[name]);
  }
}

// ---------------------------------------------------------------------------
// LED sync hub — typed observer registry. NO hardware.
// ---------------------------------------------------------------------------

export type LedSyncListener = (descriptor: JarvisThemeDescriptor) => void;

export interface LedSyncHub {
  register(listener: LedSyncListener): () => void;
  emit(descriptor: JarvisThemeDescriptor): void;
  count(): number;
  clear(): void;
}

/** Pure factory. No I/O, no side effects, no hardware. */
export function createLedSyncHub(): LedSyncHub {
  const listeners = new Set<LedSyncListener>();
  return {
    register(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(descriptor) {
      for (const listener of listeners) {
        try {
          listener(descriptor);
        } catch {
          /* one bad listener must not block the rest — no hardware here */
        }
      }
    },
    count() {
      return listeners.size;
    },
    clear() {
      listeners.clear();
    },
  };
}
