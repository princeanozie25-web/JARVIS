import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  jarvisMotion,
  jarvisMotionDurations,
  jarvisMotionEasings,
} from "@/lib/design-tokens";
import {
  durationSeconds,
  easingTuple,
  fadeIn,
  motion,
  motionDurations,
  motionEasings,
  motionVariants,
  orbPulse,
  panelEnter,
  prefersReducedMotion,
} from "@/lib/motion";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tokensCss = readFileSync(
  resolve(ROOT, "src", "lib", "design-tokens", "tokens.css"),
  "utf8",
);
const orbStatesCss = readFileSync(
  resolve(ROOT, "src", "components", "orb", "orb-states.css"),
  "utf8",
);

const REQUIRED_DURATIONS = [
  "instant",
  "fast",
  "normal",
  "slow",
  "cinematic",
] as const;
const REQUIRED_EASINGS = ["sharp", "smooth", "enter", "exit", "orbit"] as const;

describe("UI.5 motion tokens", () => {
  it("exposes every required duration token from src/lib/motion", () => {
    for (const name of REQUIRED_DURATIONS) {
      expect(motionDurations).toHaveProperty(name);
      expect(motionDurations[name]).toMatch(/^\d+ms$/);
    }
  });

  it("exposes every required easing token from src/lib/motion", () => {
    for (const name of REQUIRED_EASINGS) {
      expect(motionEasings).toHaveProperty(name);
      expect(motionEasings[name]).toMatch(/^cubic-bezier\(/);
    }
  });

  it("re-exports the design-tokens motion registry", () => {
    expect(motion).toBe(jarvisMotion);
    expect(motionDurations).toBe(jarvisMotionDurations);
    expect(motionEasings).toBe(jarvisMotionEasings);
  });

  it("converts duration tokens to framer-motion seconds", () => {
    expect(durationSeconds("instant")).toBe(0);
    expect(durationSeconds("fast")).toBeCloseTo(0.12, 5);
    expect(durationSeconds("cinematic")).toBeCloseTo(0.96, 5);
  });

  it("converts easing tokens to cubic-bezier tuples", () => {
    for (const name of REQUIRED_EASINGS) {
      const tuple = easingTuple(name);
      expect(tuple).toHaveLength(4);
      for (const value of tuple) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

describe("UI.5 motion variants", () => {
  it("exposes fadeIn, panelEnter, and orbPulse variants", () => {
    expect(motionVariants).toHaveProperty("fadeIn", fadeIn);
    expect(motionVariants).toHaveProperty("panelEnter", panelEnter);
    expect(motionVariants).toHaveProperty("orbPulse", orbPulse);
  });

  it("fadeIn drives opacity from 0 to 1", () => {
    expect(fadeIn.hidden).toMatchObject({ opacity: 0 });
    expect(fadeIn.visible).toMatchObject({ opacity: 1 });
  });

  it("panelEnter declares an enter and exit transition", () => {
    expect(panelEnter.hidden).toMatchObject({ opacity: 0, y: 8 });
    expect(panelEnter.visible).toMatchObject({ opacity: 1, y: 0 });
    expect(panelEnter.exit).toBeTruthy();
  });

  it("orbPulse loops a cinematic pulse via repeat: Infinity", () => {
    expect(orbPulse.rest).toMatchObject({ scale: 1 });
    const pulse = orbPulse.pulse as {
      transition?: { repeat?: number };
    };
    expect(pulse.transition?.repeat).toBe(Infinity);
  });
});

describe("UI.5 reduced-motion support", () => {
  it("declares a prefers-reduced-motion override in tokens.css", () => {
    expect(tokensCss).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
  });

  it("zeroes every duration token under reduced motion", () => {
    const reducedBlock = tokensCss.match(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\n\}/,
    );
    expect(reducedBlock).not.toBeNull();
    for (const name of REQUIRED_DURATIONS) {
      expect(reducedBlock![0]).toMatch(
        new RegExp(`--jarvis-motion-duration-${name}:\\s*0ms`),
      );
    }
  });

  it("neutralizes orb animations in orb-states.css under reduced motion", () => {
    expect(orbStatesCss).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(orbStatesCss).toMatch(/animation:\s*none\s*!important/);
    expect(orbStatesCss).toMatch(/transition:\s*none\s*!important/);
  });

  it("exposes a JS-side prefersReducedMotion helper that is SSR-safe", () => {
    // No window in node — must not throw and must return false.
    expect(prefersReducedMotion()).toBe(false);
  });
});
