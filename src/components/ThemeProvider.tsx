"use client";

/**
 * JARVIS ThemeProvider — UI.7.
 *
 * Mounts the active theme by writing `--color-theme-primary` and
 * `--color-theme-glow` onto the document root. Persists the user's
 * choice through `localStorage` via `persistTheme`. Exposes a typed
 * `useTheme()` hook and an LED-sync hub for downstream consumers to
 * register against — no hardware calls.
 */

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_JARVIS_THEME,
  JARVIS_THEME_DESCRIPTORS,
  type JarvisTheme,
  type JarvisThemeDescriptor,
  type LedSyncHub,
  type LedSyncListener,
  type ThemeStorage,
  applyThemeToDocument,
  createLedSyncHub,
  loadPersistedTheme,
  persistTheme,
  resolveTheme,
} from "@/lib/theme";

export interface ThemeContextValue {
  theme: JarvisTheme;
  descriptor: JarvisThemeDescriptor;
  setTheme(next: JarvisTheme): void;
  registerLedSync(listener: LedSyncListener): () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Initial theme before persisted preference is read. Defaults to blue. */
  defaultTheme?: JarvisTheme;
  /** Optional storage override (tests pass an in-memory fake). */
  storage?: ThemeStorage | null;
  /** Optional pre-built LED sync hub override (tests inspect emissions). */
  ledHub?: LedSyncHub;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_JARVIS_THEME,
  storage,
  ledHub,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<JarvisTheme>(defaultTheme);
  const hubRef = useRef<LedSyncHub>(ledHub ?? createLedSyncHub());

  // Restore persisted preference on mount. The transition wrapper keeps
  // the linter happy and lets React batch the resulting paint.
  useEffect(() => {
    const persisted = loadPersistedTheme(storage ?? undefined);
    if (persisted && persisted !== theme) {
      startTransition(() => {
        setThemeState(persisted);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply CSS variables + notify LED hub whenever the active theme changes.
  useEffect(() => {
    const descriptor = resolveTheme(theme);
    applyThemeToDocument(descriptor);
    hubRef.current.emit(descriptor);
  }, [theme]);

  const setTheme = useCallback(
    (next: JarvisTheme) => {
      setThemeState(next);
      persistTheme(next, storage ?? undefined);
    },
    [storage],
  );

  const registerLedSync = useCallback(
    (listener: LedSyncListener) => hubRef.current.register(listener),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      descriptor: JARVIS_THEME_DESCRIPTORS[theme],
      setTheme,
      registerLedSync,
    }),
    [theme, setTheme, registerLedSync],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside a <ThemeProvider>.");
  }
  return ctx;
}

export { ThemeContext };
