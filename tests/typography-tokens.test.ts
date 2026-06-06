import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  jarvisFonts,
  jarvisTypography,
  type JarvisTextRole,
} from "@/lib/design-tokens";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tokensCss = readFileSync(
  resolve(ROOT, "src", "lib", "design-tokens", "tokens.css"),
  "utf8",
);
const globalsCss = readFileSync(resolve(ROOT, "app", "globals.css"), "utf8");
const designMd = readFileSync(resolve(ROOT, "DESIGN.md"), "utf8");
const layoutTsx = readFileSync(resolve(ROOT, "app", "layout.tsx"), "utf8");

const REQUIRED_SCALE: readonly JarvisTextRole[] = [
  "display",
  "headline",
  "title",
  "body",
  "label",
];

describe("UI.3 typography — registry", () => {
  it("exposes display, headline, title, body, and label tiers", () => {
    for (const role of REQUIRED_SCALE) {
      expect(jarvisTypography).toHaveProperty(role);
      const style = jarvisTypography[role];
      expect(style.fontFamily).toBeTruthy();
      expect(style.fontSize).toMatch(/rem$/);
      expect(typeof style.fontWeight).toBe("number");
      expect(style.lineHeight).toBeTruthy();
      expect(style.letterSpacing).toBeTruthy();
    }
  });

  it("routes display, headline, and title through the bundled Fraunces display font", () => {
    for (const role of ["display", "headline", "title"] as const) {
      expect(jarvisTypography[role].fontFamily).toBe(jarvisFonts.display);
    }
    expect(jarvisFonts.display).toContain("--font-jarvis-display");
    expect(jarvisFonts.display).toContain('"Fraunces"');
  });

  it("routes body through the bundled display serif and label through JetBrains Mono", () => {
    expect(jarvisTypography.body.fontFamily).toBe(jarvisFonts.body);
    expect(jarvisTypography.label.fontFamily).toBe(jarvisFonts.mono);
    expect(jarvisTypography.label.textTransform).toBe("uppercase");
    expect(jarvisFonts.body).toContain("--font-jarvis-display");
    expect(jarvisFonts.body).toContain('"Fraunces"');
  });

  it("never falls back to Arial anywhere in the scale", () => {
    for (const role of REQUIRED_SCALE) {
      expect(jarvisTypography[role].fontFamily.toLowerCase()).not.toContain(
        "arial",
      );
    }
  });

  it("matches DESIGN.md hierarchy weights and label tracking", () => {
    expect(jarvisTypography.body.fontWeight).toBe(400);
    expect(jarvisTypography.title.fontWeight).toBe(600);
    expect(jarvisTypography.label.fontWeight).toBe(600);
    expect(jarvisTypography.label.letterSpacing).toBe("0.16em");
  });
});

describe("UI.3 typography — wiring", () => {
  it("declares local-first Fraunces and JetBrains Mono in tokens.css", () => {
    expect(tokensCss).toMatch(
      /--jarvis-font-display:\s*var\(\s*--font-jarvis-display/,
    );
    expect(tokensCss).toMatch(
      /--jarvis-font-body:\s*var\(\s*--font-jarvis-display/,
    );
    expect(tokensCss).toMatch(
      /--jarvis-font-mono:\s*var\(\s*--font-jarvis-mono/,
    );
    expect(tokensCss).toContain("Fraunces");
    expect(tokensCss).toContain("JetBrains Mono");
  });

  it("loads Fraunces and JetBrains Mono through bundled next/font/local assets", () => {
    expect(layoutTsx).toMatch(/from "next\/font\/local"/);
    expect(layoutTsx).not.toMatch(/from "next\/font\/google"/);
    expect(layoutTsx).toMatch(/Fraunces-Regular-400\.ttf/);
    expect(layoutTsx).toMatch(/Fraunces-Italic-400\.ttf/);
    expect(layoutTsx).toMatch(/JetBrainsMono-400\.ttf/);
    expect(layoutTsx).toContain("--font-jarvis-display");
    expect(layoutTsx).toContain("--font-jarvis-mono");
  });

  it("removes Arial from app/globals.css and DESIGN.md token block", () => {
    expect(globalsCss.toLowerCase()).not.toContain("arial");
    const frontmatter = designMd.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter![1].toLowerCase()).not.toContain("arial");
  });

  it("exposes the body font on the body element", () => {
    expect(globalsCss).toMatch(/font-family:\s*var\(--jarvis-font-body\)/);
  });

  it("re-exports JARVIS fonts through the Tailwind v4 @theme block", () => {
    expect(globalsCss).toMatch(/--font-sans:\s*var\(--jarvis-font-body\)/);
    expect(globalsCss).toMatch(
      /--font-display:\s*var\(--jarvis-font-display\)/,
    );
    expect(globalsCss).toMatch(/--font-mono:\s*var\(--jarvis-font-mono\)/);
  });
});
