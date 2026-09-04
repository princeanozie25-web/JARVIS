import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// E-029 — Program U.2 foundation invariants.
// The capstone is ADDITIVE: new tokens beside the old, scoped shadcn
// variables, Geist beside Fraunces. These tests are the design read's
// Gate 1 written as assertions.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const tokens = read("src/lib/design-tokens/tokens.css");
const globals = read("app/globals.css");
const layout = read("app/layout.tsx");
const components = read("components.json");

describe("U.2 foundation — Deep Blue tokens", () => {
  it("declares the brief §2 Night palette as --jarvis-cc-* tokens", () => {
    for (const [name, hex] of [
      ["field", "#06122b"],
      ["surface", "#0b1b3a"],
      ["hairline", "#1e2f55"],
      ["ink", "#e8eef9"],
      ["ink-muted", "#8fa3c8"],
      ["accent", "#3b82f6"],
      ["gate", "#f5a524"],
    ]) {
      expect(tokens).toMatch(new RegExp(`--jarvis-cc-${name}:\\s*${hex};`));
    }
  });

  it("declares the Day canvas and keeps accent + gate identical across themes", () => {
    const day = tokens.slice(tokens.indexOf('[data-capstone-theme="day"]'));
    expect(day).toContain("--jarvis-cc-field: #f6f3ee;");
    expect(day).not.toContain("--jarvis-cc-accent:");
    expect(day).not.toContain("--jarvis-cc-gate:");
  });

  it("reserves amber for the Gate: no other cc token carries the gate hex", () => {
    const gateHex = /#f5a524/gi;
    const hits = tokens.match(gateHex) ?? [];
    // exactly one declaration: --jarvis-cc-gate (glow uses rgba)
    expect(hits).toHaveLength(1);
  });

  it("declares the brief §2 motion grammar with the non-keyword easing", () => {
    expect(tokens).toContain("--jarvis-cc-motion-hover: 100ms;");
    expect(tokens).toContain("--jarvis-cc-motion-stagger: 60ms;");
    expect(tokens).toContain("--jarvis-cc-motion-collapse: 180ms;");
    expect(tokens).toContain("--jarvis-cc-motion-theme: 240ms;");
    expect(tokens).toContain("--jarvis-cc-motion-core-breath: 4000ms;");
    expect(tokens).toContain("--jarvis-cc-motion-gate-pulse: 1200ms;");
    expect(tokens).toContain(
      "--jarvis-cc-motion-ease: cubic-bezier(0.22, 1, 0.36, 1);",
    );
    expect(tokens).not.toMatch(/--jarvis-cc-motion-ease:\s*ease/);
  });

  it("collapses capstone motion under prefers-reduced-motion", () => {
    const reduced = tokens.slice(
      tokens.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toContain("--jarvis-cc-motion-core-breath: 0ms;");
    expect(reduced).toContain("--jarvis-cc-motion-gate-pulse: 0ms;");
  });
});

describe("U.2 foundation — additive, never a rename", () => {
  it("keeps every legacy font token and the Fraunces routing intact", () => {
    expect(tokens).toMatch(
      /--jarvis-font-display:\s*var\(\s*--font-jarvis-display/,
    );
    expect(tokens).toMatch(
      /--jarvis-font-body:\s*var\(\s*--font-jarvis-display/,
    );
    expect(tokens).toContain("Fraunces");
    expect(tokens).toContain("JetBrains Mono");
  });

  it("adds Geist as new sans/wordmark roles bundled through next/font/local", () => {
    expect(tokens).toMatch(/--jarvis-font-sans:\s*var\(\s*--font-geist-sans/);
    expect(tokens).toMatch(
      /--jarvis-font-wordmark:\s*var\(\s*--font-geist-sans/,
    );
    expect(layout).toContain('from "geist/font/sans"');
    expect(layout).toContain("GeistSans.variable");
    expect(layout).toContain('from "next/font/local"');
    expect(layout).not.toContain("next/font/google");
  });

  it("scopes the shadcn variable contract to [data-capstone-theme] roots", () => {
    expect(globals).toContain("[data-capstone-theme] {");
    const scoped = globals.slice(globals.indexOf("[data-capstone-theme] {"));
    expect(scoped).toContain("--background: var(--jarvis-cc-field);");
    expect(scoped).toContain("--primary: var(--jarvis-cc-accent);");
    expect(scoped).toContain("--border: var(--jarvis-cc-hairline);");
    // legacy root mapping untouched
    expect(globals).toContain("--background: var(--jarvis-color-void);");
    expect(globals).toContain("--color-cc-gate: var(--jarvis-cc-gate);");
  });

  it("has a shadcn components.json pointing at the existing aliases", () => {
    const parsed = JSON.parse(components) as {
      tailwind: { css: string; cssVariables: boolean };
      aliases: Record<string, string>;
    };
    expect(parsed.tailwind.css).toBe("app/globals.css");
    expect(parsed.tailwind.cssVariables).toBe(true);
    expect(parsed.aliases.utils).toBe("@/lib/utils");
    expect(parsed.aliases.ui).toBe("@/components/ui");
  });

  it("does not import the Beautiful UI foundation stylesheet globally", () => {
    // Evaluated and rejected as a global import (body stripes, --color-ink
    // collision, --font-sans override, shadow-plugin dependency). Its motion
    // grammar is transcribed into --jarvis-cc-motion-*; per-component CSS is
    // adopted with each component in U.5.
    expect(globals).not.toMatch(/beautifui|foundation\.css|shadow-plugin/);
  });
});
