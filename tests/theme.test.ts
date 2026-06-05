import { describe, expect, it } from "vitest";

import {
  DEFAULT_JARVIS_THEME,
  JARVIS_THEMES,
  JARVIS_THEME_DESCRIPTORS,
  THEME_CSS_VARIABLE_NAMES,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  createLedSyncHub,
  isJarvisTheme,
  loadPersistedTheme,
  persistTheme,
  resolveTheme,
  themeCSSVars,
  type JarvisTheme,
  type ThemeStorage,
  type ThemeStyleTarget,
} from "@/lib/theme";

function createFakeStorage(
  initial: Record<string, string> = {},
): ThemeStorage & {
  store: Record<string, string>;
} {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      store[key] = value;
    },
  };
}

function createFakeRoot(): ThemeStyleTarget & {
  recorded: Record<string, string>;
} {
  const recorded: Record<string, string> = {};
  return {
    recorded,
    style: {
      setProperty(name, value) {
        recorded[name] = value;
      },
    },
  };
}

describe("UI.7 theme registry", () => {
  it("exposes exactly five themes", () => {
    expect(JARVIS_THEMES).toEqual(["blue", "red", "amber", "purple", "green"]);
  });

  it("provides a descriptor for every theme with primary + glow + semantic", () => {
    for (const theme of JARVIS_THEMES) {
      const descriptor = JARVIS_THEME_DESCRIPTORS[theme];
      expect(descriptor.theme).toBe(theme);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.primary).toMatch(/^#|rgba?\(/);
      expect(descriptor.glow).toMatch(/^rgba\(/);
      expect(descriptor.semantic).toMatch(
        /^(signal|focus|local|review|blocked)$/,
      );
    }
  });

  it("freezes the descriptor registry against mutation", () => {
    expect(Object.isFrozen(JARVIS_THEME_DESCRIPTORS)).toBe(true);
  });
});

describe("UI.7 theme resolution", () => {
  it("isJarvisTheme accepts every known theme and rejects everything else", () => {
    for (const theme of JARVIS_THEMES) {
      expect(isJarvisTheme(theme)).toBe(true);
    }
    for (const noise of ["", "rainbow", 42, null, undefined, {}]) {
      expect(isJarvisTheme(noise)).toBe(false);
    }
  });

  it("resolveTheme deny-defaults to the blue descriptor", () => {
    expect(resolveTheme("not-a-theme")).toBe(
      JARVIS_THEME_DESCRIPTORS[DEFAULT_JARVIS_THEME],
    );
    expect(resolveTheme(null)).toBe(
      JARVIS_THEME_DESCRIPTORS[DEFAULT_JARVIS_THEME],
    );
    expect(DEFAULT_JARVIS_THEME).toBe("blue");
  });

  it("themeCSSVars returns the two CSS variables the contract names", () => {
    expect(THEME_CSS_VARIABLE_NAMES).toEqual([
      "--color-theme-primary",
      "--color-theme-glow",
    ]);
    for (const theme of JARVIS_THEMES) {
      const vars = themeCSSVars(theme);
      expect(Object.keys(vars).sort()).toEqual(
        [...THEME_CSS_VARIABLE_NAMES].sort(),
      );
      expect(vars["--color-theme-primary"]).toBe(
        JARVIS_THEME_DESCRIPTORS[theme].primary,
      );
      expect(vars["--color-theme-glow"]).toBe(
        JARVIS_THEME_DESCRIPTORS[theme].glow,
      );
    }
  });

  it("themeCSSVars deny-defaults for unknown input", () => {
    const blueVars = themeCSSVars("blue");
    const fallbackVars = themeCSSVars("not-a-theme");
    expect(fallbackVars).toEqual(blueVars);
  });
});

describe("UI.7 theme application", () => {
  it("applyThemeToDocument writes both CSS variables to the supplied root", () => {
    const root = createFakeRoot();
    applyThemeToDocument("red", root);
    expect(root.recorded["--color-theme-primary"]).toBe(
      JARVIS_THEME_DESCRIPTORS.red.primary,
    );
    expect(root.recorded["--color-theme-glow"]).toBe(
      JARVIS_THEME_DESCRIPTORS.red.glow,
    );
  });

  it("applyThemeToDocument is a no-op when no root is available (SSR safe)", () => {
    expect(() => applyThemeToDocument("blue", null)).not.toThrow();
  });

  it("switching themes overwrites the previous CSS variables", () => {
    const root = createFakeRoot();
    applyThemeToDocument("blue", root);
    applyThemeToDocument("amber", root);
    expect(root.recorded["--color-theme-primary"]).toBe(
      JARVIS_THEME_DESCRIPTORS.amber.primary,
    );
  });
});

describe("UI.7 theme persistence", () => {
  it("THEME_STORAGE_KEY is the documented key", () => {
    expect(THEME_STORAGE_KEY).toBe("jarvis.theme");
  });

  it("persistTheme + loadPersistedTheme round-trips through ThemeStorage", () => {
    const storage = createFakeStorage();
    persistTheme("green", storage);
    expect(storage.store[THEME_STORAGE_KEY]).toBe("green");
    expect(loadPersistedTheme(storage)).toBe<JarvisTheme>("green");
  });

  it("loadPersistedTheme returns null when storage holds an unknown value", () => {
    const storage = createFakeStorage({
      [THEME_STORAGE_KEY]: "rainbow",
    });
    expect(loadPersistedTheme(storage)).toBeNull();
  });

  it("returns null when storage is unavailable", () => {
    expect(loadPersistedTheme(null)).toBeNull();
  });

  it("swallows storage errors so persistence never crashes the app", () => {
    const flaky: ThemeStorage = {
      getItem() {
        throw new Error("storage offline");
      },
      setItem() {
        throw new Error("storage offline");
      },
    };
    expect(() => persistTheme("blue", flaky)).not.toThrow();
    expect(loadPersistedTheme(flaky)).toBeNull();
  });
});

describe("UI.7 LED sync hub", () => {
  it("registers listeners, emits descriptors, and supports unsubscribe", () => {
    const hub = createLedSyncHub();
    const seen: string[] = [];
    const unsubscribe = hub.register((descriptor) =>
      seen.push(descriptor.theme),
    );

    expect(hub.count()).toBe(1);
    hub.emit(JARVIS_THEME_DESCRIPTORS.purple);
    hub.emit(JARVIS_THEME_DESCRIPTORS.green);
    expect(seen).toEqual(["purple", "green"]);

    unsubscribe();
    expect(hub.count()).toBe(0);
    hub.emit(JARVIS_THEME_DESCRIPTORS.red);
    expect(seen).toEqual(["purple", "green"]);
  });

  it("isolates listener errors — one throwing listener does not block others", () => {
    const hub = createLedSyncHub();
    const seen: string[] = [];
    hub.register(() => {
      throw new Error("bad listener");
    });
    hub.register((d) => seen.push(d.theme));
    expect(() => hub.emit(JARVIS_THEME_DESCRIPTORS.blue)).not.toThrow();
    expect(seen).toEqual(["blue"]);
  });

  it("clear() removes every listener", () => {
    const hub = createLedSyncHub();
    hub.register(() => undefined);
    hub.register(() => undefined);
    expect(hub.count()).toBe(2);
    hub.clear();
    expect(hub.count()).toBe(0);
  });
});
