import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  JARVIS_STATUS_INDICATORS,
  getStatusIndicator,
  statusColorVar,
  statusPresentation,
  type JarvisStatusKind,
} from "@/lib/accessibility";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tokensCss = readFileSync(
  resolve(ROOT, "src", "lib", "design-tokens", "tokens.css"),
  "utf8",
);
const accessibilityCss = readFileSync(
  resolve(ROOT, "src", "lib", "accessibility.css"),
  "utf8",
);
const globalsCss = readFileSync(resolve(ROOT, "app", "globals.css"), "utf8");
const orbStatesCss = readFileSync(
  resolve(ROOT, "src", "components", "orb", "orb-states.css"),
  "utf8",
);

const REQUIRED_STATUS_KINDS: readonly JarvisStatusKind[] = [
  "signal",
  "focus",
  "local",
  "review",
  "blocked",
  "neutral",
];

describe("UI.9 focus ring tokens", () => {
  it("declares the focus-ring tokens in tokens.css", () => {
    expect(tokensCss).toMatch(/--jarvis-focus-ring-color:\s*var\(/);
    expect(tokensCss).toMatch(/--jarvis-focus-ring-width:\s*\d+px/);
    expect(tokensCss).toMatch(/--jarvis-focus-ring-offset:\s*\d+px/);
  });

  it("anchors the default focus-ring color to the semantic signal token", () => {
    expect(tokensCss).toMatch(
      /--jarvis-focus-ring-color:\s*var\(--jarvis-color-signal\)/,
    );
  });
});

describe("UI.9 global :focus-visible style", () => {
  it("declares a global :focus-visible rule in accessibility.css", () => {
    expect(accessibilityCss).toMatch(/:focus-visible\)?\s*\{/);
  });

  it("the focus rule consumes the focus-ring tokens (no raw color)", () => {
    expect(accessibilityCss).toMatch(/outline:[^;]*var\(--jarvis-focus-ring-/);
    expect(accessibilityCss).toMatch(
      /outline-offset:\s*var\(--jarvis-focus-ring-offset\)/,
    );
  });

  it("ships a skip-link helper and screen-reader-only utility", () => {
    expect(accessibilityCss).toContain(".jarvis-skip-link");
    expect(accessibilityCss).toContain(".jarvis-sr-only");
  });

  it("is imported globally through app/globals.css", () => {
    expect(globalsCss).toMatch(
      /@import\s+"\.\.\/src\/lib\/accessibility\.css"/,
    );
  });
});

describe("UI.9 status indicators — color-independent cues", () => {
  it("covers every semantic governance kind plus neutral", () => {
    for (const kind of REQUIRED_STATUS_KINDS) {
      expect(JARVIS_STATUS_INDICATORS).toHaveProperty(kind);
    }
  });

  it("each indicator carries a unique non-color glyph and an aria label", () => {
    const glyphs = new Set<string>();
    for (const kind of REQUIRED_STATUS_KINDS) {
      const indicator = JARVIS_STATUS_INDICATORS[kind];
      expect(indicator.glyph.length).toBeGreaterThan(0);
      expect(indicator.label.length).toBeGreaterThan(0);
      expect(indicator.ariaLabel.toLowerCase()).toContain("status");
      expect(glyphs.has(indicator.glyph)).toBe(false);
      glyphs.add(indicator.glyph);
    }
  });

  it("each indicator semantic token resolves to an existing CSS variable family", () => {
    const allowed = new Set([
      "signal",
      "focus",
      "local",
      "review",
      "blocked",
      "ink",
    ]);
    for (const kind of REQUIRED_STATUS_KINDS) {
      expect(allowed.has(JARVIS_STATUS_INDICATORS[kind].semanticToken)).toBe(
        true,
      );
    }
  });

  it("getStatusIndicator deny-defaults to neutral for unknown input", () => {
    expect(getStatusIndicator("not-a-status")).toBe(
      JARVIS_STATUS_INDICATORS.neutral,
    );
    expect(getStatusIndicator(null)).toBe(JARVIS_STATUS_INDICATORS.neutral);
    expect(getStatusIndicator(42)).toBe(JARVIS_STATUS_INDICATORS.neutral);
  });

  it("statusColorVar returns a CSS variable expression for every kind", () => {
    for (const kind of REQUIRED_STATUS_KINDS) {
      expect(statusColorVar(kind)).toMatch(/^var\(--jarvis-color-/);
    }
  });

  it("statusPresentation bundles indicator + colorVar without duplication", () => {
    const presentation = statusPresentation("review");
    expect(presentation.kind).toBe("review");
    expect(presentation.glyph).toBe(JARVIS_STATUS_INDICATORS.review.glyph);
    expect(presentation.colorVar).toBe(statusColorVar("review"));
  });

  it("freezes the indicator registry", () => {
    expect(Object.isFrozen(JARVIS_STATUS_INDICATORS)).toBe(true);
  });
});

describe("UI.9 reduced-motion compliance", () => {
  it("tokens.css collapses motion durations under prefers-reduced-motion", () => {
    expect(tokensCss).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
  });

  it("orb-states.css neutralizes animations under prefers-reduced-motion", () => {
    expect(orbStatesCss).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(orbStatesCss).toMatch(/animation:\s*none\s*!important/);
  });
});

describe("UI.9 semantic landmark + ARIA presence on shipped surfaces", () => {
  const surfaces = [
    { path: ["app", "page.tsx"], landmark: "<main" },
    { path: ["src", "app", "working", "page.tsx"], landmark: "<main" },
    {
      path: ["src", "app", "audit", "pipeline", "page.tsx"],
      landmark: "<main",
    },
  ] as const;

  for (const surface of surfaces) {
    const file = resolve(ROOT, ...surface.path);
    const source = readFileSync(file, "utf8");
    it(`${surface.path.join("/")} declares a <main> landmark`, () => {
      expect(source).toContain(surface.landmark);
    });
    it(`${surface.path.join("/")} uses aria-label on regions`, () => {
      expect(source).toMatch(/aria-label="[^"]+"/);
    });
  }
});
