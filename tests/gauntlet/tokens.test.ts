import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  JARVIS_STONE_IDS,
  jarvisPulse,
  jarvisPulseDurations,
  jarvisStones,
  jarvisTokens,
  stoneColorVar,
} from "@/lib/design-tokens";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokensCss = readFileSync(
  resolve(ROOT, "src", "lib", "design-tokens", "tokens.css"),
  "utf8",
);

describe("DD.0 stone palette tokens", () => {
  it("exposes all six stone zone IDs", () => {
    expect(JARVIS_STONE_IDS).toEqual([
      "space",
      "time",
      "mind",
      "soul",
      "reality",
      "power",
    ]);
  });

  it("includes the gold / flame / ruby accents", () => {
    expect(jarvisStones).toHaveProperty("gold");
    expect(jarvisStones).toHaveProperty("flame");
    expect(jarvisStones).toHaveProperty("ruby");
  });

  it("every stone resolves to a valid color value", () => {
    for (const key of Object.keys(jarvisStones)) {
      const value = jarvisStones[key as keyof typeof jarvisStones];
      expect(value).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it("declares every stone variable in tokens.css", () => {
    for (const stone of JARVIS_STONE_IDS) {
      expect(tokensCss).toMatch(new RegExp(`--jarvis-color-stone-${stone}:`));
    }
    expect(tokensCss).toMatch(/--jarvis-color-gold:/);
    expect(tokensCss).toMatch(/--jarvis-color-flame:/);
    expect(tokensCss).toMatch(/--jarvis-color-ruby:/);
  });

  it("the power stone reuses the existing violet token (no parallel hex)", () => {
    expect(tokensCss).toMatch(
      /--jarvis-color-stone-reality:\s*var\(--jarvis-color-cyan-signal\)/,
    );
    expect(tokensCss).toMatch(
      /--jarvis-color-stone-power:\s*var\(--jarvis-color-ruby\)/,
    );
  });

  it("stoneColorVar returns the correct CSS variable expression", () => {
    expect(stoneColorVar("space")).toBe("var(--jarvis-color-stone-space)");
    expect(stoneColorVar("gold")).toBe("var(--jarvis-color-gold)");
    expect(stoneColorVar("ruby")).toBe("var(--jarvis-color-ruby)");
  });
});

describe("DD.0 pulse timing tokens", () => {
  const REQUIRED_PULSE = ["short", "normal", "long", "dwell"] as const;

  it("exposes short / normal / long / dwell durations from the typed registry", () => {
    for (const name of REQUIRED_PULSE) {
      expect(jarvisPulseDurations).toHaveProperty(name);
      expect(jarvisPulseDurations[name]).toMatch(/^\d+ms$/);
    }
  });

  it("re-exports through jarvisTokens.pulse", () => {
    expect(jarvisTokens.pulse).toBe(jarvisPulse);
    expect(jarvisTokens.pulse.duration).toBe(jarvisPulseDurations);
  });

  it("declares every pulse duration in tokens.css", () => {
    for (const name of REQUIRED_PULSE) {
      expect(tokensCss).toMatch(
        new RegExp(`--jarvis-pulse-duration-${name}:\\s*\\d+ms`),
      );
    }
  });

  it("anchors pulse easing to the existing motion-easing-orbit token", () => {
    expect(tokensCss).toMatch(
      /--jarvis-pulse-easing:\s*var\(--jarvis-motion-easing-orbit\)/,
    );
  });

  it("collapses every pulse duration to 0ms under prefers-reduced-motion", () => {
    const reducedBlock = tokensCss.match(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\n\}/,
    );
    expect(reducedBlock).not.toBeNull();
    for (const name of REQUIRED_PULSE) {
      expect(reducedBlock![0]).toMatch(
        new RegExp(`--jarvis-pulse-duration-${name}:\\s*0ms`),
      );
    }
  });
});
