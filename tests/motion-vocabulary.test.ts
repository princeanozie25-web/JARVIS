import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  GATE_AFTERGLOW_BOX_SHADOW,
  MOTION_VOCABULARY,
  calmFade,
  gateArrival,
  gateResolve,
  measuredFill,
  vocabDurations,
} from "@/lib/design-language/motion-vocabulary";

// AP-J1 (I-APJ1-2) — the motion vocabulary is a SMALL closed set with a tight
// budget, kept in lockstep with the CSS tokens, and every primitive honors
// prefers-reduced-motion (the reduced branch is instant).

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, animate: vi.fn() };
});

const { animate } = await import("framer-motion");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokensCss = readFileSync(
  resolve(ROOT, "src", "lib", "design-tokens", "tokens.css"),
  "utf8",
);

describe("I-APJ1-2 — the vocabulary is the closed set", () => {
  it("exposes exactly the four documented beats", () => {
    expect(Object.keys(MOTION_VOCABULARY).sort()).toEqual([
      "calmFade",
      "gateArrival",
      "gateResolve",
      "measuredFill",
    ]);
  });

  it("keeps the tight budget: core beats 120-240ms, only the gate settles to 480ms", () => {
    expect(vocabDurations.fade).toBeGreaterThanOrEqual(0.12);
    expect(vocabDurations.fade).toBeLessThanOrEqual(0.24);
    expect(vocabDurations.fill).toBeGreaterThanOrEqual(0.12);
    expect(vocabDurations.fill).toBeLessThanOrEqual(0.24);
    expect(vocabDurations.gate).toBeGreaterThanOrEqual(0.12);
    expect(vocabDurations.gate).toBeLessThanOrEqual(0.24);
    // the ONE cinematic allowance — gate moments only, never past 480ms
    expect(vocabDurations.gateSettle).toBeLessThanOrEqual(0.48);
  });
});

describe("I-APJ1-2 — CSS/JS lockstep", () => {
  it("mirrors every vocabulary duration as a --jarvis-motion-vocab-* token", () => {
    expect(tokensCss).toContain(
      `--jarvis-motion-vocab-fade: ${vocabDurations.fade * 1000}ms;`,
    );
    expect(tokensCss).toContain(
      `--jarvis-motion-vocab-fill: ${vocabDurations.fill * 1000}ms;`,
    );
    expect(tokensCss).toContain(
      `--jarvis-motion-vocab-gate: ${vocabDurations.gate * 1000}ms;`,
    );
    expect(tokensCss).toContain(
      `--jarvis-motion-vocab-gate-settle: ${vocabDurations.gateSettle * 1000}ms;`,
    );
  });

  it("zeroes every vocabulary token under prefers-reduced-motion", () => {
    const reducedBlock = tokensCss.match(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\n\}/,
    );
    expect(reducedBlock).not.toBeNull();
    for (const name of ["fade", "fill", "gate", "gate-settle"]) {
      expect(reducedBlock![0]).toMatch(
        new RegExp(`--jarvis-motion-vocab-${name}:\\s*0ms`),
      );
    }
  });
});

describe("I-APJ1-2 — the reduced-motion branch is instant", () => {
  it("calmFade(reduced) has zero duration and no travel", () => {
    const variants = calmFade(true);
    expect(variants.hidden).toMatchObject({ opacity: 0 });
    expect(variants.visible).toMatchObject({
      opacity: 1,
      transition: { duration: 0 },
    });
    expect(variants.exit).toMatchObject({ transition: { duration: 0 } });
  });

  it("gateResolve(reduced) has zero duration and no scale travel", () => {
    const variants = gateResolve(true);
    expect(variants.visible).toMatchObject({ transition: { duration: 0 } });
    expect(variants.hidden).not.toHaveProperty("scale");
    expect(variants.visible).not.toHaveProperty("scale");
  });

  it("measuredFill(reduced) is instant; full motion is the fill beat", () => {
    expect(measuredFill(true)).toMatchObject({ duration: 0 });
    expect(measuredFill(false)).toMatchObject({
      duration: vocabDurations.fill,
    });
  });

  it("gateArrival no-ops under reduced motion and on a missing element", () => {
    vi.mocked(animate).mockClear();
    gateArrival(null);
    gateArrival({} as HTMLElement, { reduced: true });
    expect(animate).not.toHaveBeenCalled();
  });

  it("gateArrival pulses the amber afterglow once at the settle duration", () => {
    vi.mocked(animate).mockClear();
    const element = {} as HTMLElement;
    gateArrival(element, { reduced: false });
    expect(animate).toHaveBeenCalledTimes(1);
    const [target, keyframes, options] = vi.mocked(animate).mock.calls[0] as [
      HTMLElement,
      { boxShadow: string[] },
      { duration: number },
    ];
    expect(target).toBe(element);
    expect(keyframes.boxShadow).toEqual([...GATE_AFTERGLOW_BOX_SHADOW]);
    expect(options.duration).toBe(vocabDurations.gateSettle);
  });
});

describe("I-APJ1-2 — full-motion beats stay on budget", () => {
  it("calmFade uses the fade duration", () => {
    const variants = calmFade(false);
    expect(variants.visible).toMatchObject({
      transition: { duration: vocabDurations.fade },
    });
  });

  it("gateResolve (the signature) uses the gate beat with a subtle settle", () => {
    const variants = gateResolve(false);
    expect(variants.visible).toMatchObject({
      scale: 1,
      transition: { duration: vocabDurations.gate },
    });
    // instrumentation, not theatre: the scale travel is subtle
    const hidden = variants.hidden as { scale?: number };
    expect(hidden.scale ?? 1).toBeGreaterThanOrEqual(0.97);
  });

  it("the afterglow keyframes return to their base state (a pulse, not a new steady state)", () => {
    expect(GATE_AFTERGLOW_BOX_SHADOW).toHaveLength(3);
    expect(GATE_AFTERGLOW_BOX_SHADOW[0]).toBe(GATE_AFTERGLOW_BOX_SHADOW[2]);
  });
});
