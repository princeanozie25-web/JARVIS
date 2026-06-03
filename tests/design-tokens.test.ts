import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  jarvisColors,
  jarvisRadii,
  jarvisSemanticColors,
  jarvisShadows,
  jarvisSpace,
  jarvisTokens,
  type JarvisColorRole,
} from "@/lib/design-tokens";

const TOKENS_CSS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "lib",
  "design-tokens",
  "tokens.css",
);

const tokensCss = readFileSync(TOKENS_CSS_PATH, "utf8");

const REQUIRED_BASE_COLOR_ROLES: readonly JarvisColorRole[] = [
  "void",
  "ink",
  "panel",
  "panel-soft",
  "border-subtle",
  "cyan-signal",
  "sky-focus",
  "emerald-local",
  "amber-review",
  "rose-blocked",
  "white",
  "black",
];

const REQUIRED_SEMANTIC_ALIASES = [
  "signal",
  "focus",
  "local",
  "review",
  "blocked",
] as const;

const REQUIRED_RADII = ["sm", "md", "lg", "pill"] as const;
const REQUIRED_SPACES = ["xs", "sm", "md", "lg", "xl"] as const;
const REQUIRED_SHADOWS = ["orb-atmosphere", "cockpit-depth"] as const;
const REQUIRED_FONTS = ["display", "body", "mono"] as const;

describe("UI.2 design tokens — registry", () => {
  it("exposes every required base color role", () => {
    for (const role of REQUIRED_BASE_COLOR_ROLES) {
      expect(jarvisColors).toHaveProperty(role);
      expect(jarvisColors[role]).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it("exposes every required semantic alias and resolves each to a base role", () => {
    for (const alias of REQUIRED_SEMANTIC_ALIASES) {
      expect(jarvisSemanticColors).toHaveProperty(alias);
      const baseRole = jarvisSemanticColors[alias];
      expect(jarvisColors).toHaveProperty(baseRole);
    }
  });

  it("exposes the radius, space, and shadow scales", () => {
    for (const key of REQUIRED_RADII) {
      expect(jarvisRadii[key]).toMatch(/^\d+px$|^9999px$/);
    }
    for (const key of REQUIRED_SPACES) {
      expect(jarvisSpace[key]).toMatch(/^\d+px$/);
    }
    for (const key of REQUIRED_SHADOWS) {
      expect(jarvisShadows[key]).toMatch(/rgba?\(/);
    }
  });

  it("exposes display, body, and mono font tokens", () => {
    for (const key of REQUIRED_FONTS) {
      expect(jarvisTokens.fonts[key]).toMatch(/--font-jarvis-(display|mono)/);
    }
  });

  it("matches the DESIGN.md frontmatter palette exactly", () => {
    expect(jarvisColors).toStrictEqual({
      void: "#0a0a0a",
      ink: "#ededed",
      panel: "#020617",
      "panel-soft": "#0f172a",
      "border-subtle": "#ffffff1a",
      "cyan-signal": "#22d3ee",
      "sky-focus": "#38bdf8",
      "emerald-local": "#6ee7b7",
      "amber-review": "#fbbf24",
      "rose-blocked": "#fb7185",
      white: "#ffffff",
      black: "#000000",
    });
  });
});

describe("UI.2 design tokens — tokens.css mirror", () => {
  it("declares every base color role under the --jarvis-color-* namespace", () => {
    for (const role of REQUIRED_BASE_COLOR_ROLES) {
      const declaration = `--jarvis-color-${role}: ${jarvisColors[role]};`;
      expect(tokensCss).toContain(declaration);
    }
  });

  it("declares semantic aliases that resolve through var() to base roles", () => {
    for (const alias of REQUIRED_SEMANTIC_ALIASES) {
      const baseRole = jarvisSemanticColors[alias];
      const declaration = `--jarvis-color-${alias}: var(--jarvis-color-${baseRole});`;
      expect(tokensCss).toContain(declaration);
    }
  });

  it("declares every radius, space, and shadow token", () => {
    for (const key of REQUIRED_RADII) {
      expect(tokensCss).toContain(
        `--jarvis-radius-${key}: ${jarvisRadii[key]};`,
      );
    }
    for (const key of REQUIRED_SPACES) {
      expect(tokensCss).toContain(
        `--jarvis-space-${key}: ${jarvisSpace[key]};`,
      );
    }
    for (const key of REQUIRED_SHADOWS) {
      expect(tokensCss).toContain(
        `--jarvis-shadow-${key}: ${jarvisShadows[key]};`,
      );
    }
  });

  it("declares display, body, and mono font tokens", () => {
    expect(tokensCss).toContain("--jarvis-font-display:");
    expect(tokensCss).toContain("--jarvis-font-body:");
    expect(tokensCss).toContain("--jarvis-font-mono:");
  });

  it("reserves motion tokens for UI.5 without exposing live values", () => {
    expect(tokensCss).toMatch(/RESERVED for UI\.5/i);
    expect(tokensCss).not.toMatch(/^\s*--jarvis-motion-/m);
  });
});
