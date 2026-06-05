import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Orb } from "@/components/orb/Orb";
import { ORB_ACTIVITY_STATES } from "@/components/orb/activity-states";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const orbCss = readFileSync(
  resolve(ROOT, "src", "components", "orb", "orb-states.css"),
  "utf8",
);

function render(activityState: string = "idle"): string {
  return renderToStaticMarkup(<Orb activityState={activityState} />);
}

describe("Orb reactor refinement — layer presence", () => {
  it("preserves the original ring / sweep / core layers", () => {
    const markup = render();
    expect(markup).toContain('data-orb-layer="ring"');
    expect(markup).toContain('data-orb-layer="sweep"');
    expect(markup).toContain('data-orb-layer="core"');
  });

  it("introduces atmosphere, containment, turbine, and plasma layers", () => {
    const markup = render();
    expect(markup).toContain('data-orb-layer="atmosphere"');
    expect(markup).toContain('data-orb-layer="containment"');
    expect(markup).toContain('data-orb-layer="turbine"');
    expect(markup).toContain('data-orb-layer="plasma"');
  });

  it("exposes every activity state through data-orb-activity-state", () => {
    for (const state of ORB_ACTIVITY_STATES) {
      const markup = render(state);
      expect(markup).toContain(`data-orb-activity-state="${state}"`);
    }
  });

  it("exposes no interactive controls or links inside the orb shell", () => {
    const markup = render();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});

describe("Orb reactor refinement — CSS contract", () => {
  it("declares atmosphere, containment, turbine, and plasma keyframes", () => {
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-atmosphere-breath/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-containment-counter/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-turbine-spin/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-plasma-compress/);
  });

  it("routes every reactor layer through motion / pulse duration tokens", () => {
    expect(orbCss).toMatch(
      /\[data-orb-layer="atmosphere"\][^{]*\{[^}]*var\(--jarvis-motion-duration-/,
    );
    expect(orbCss).toMatch(
      /\[data-orb-layer="turbine"\][^{]*\{[^}]*var\(--jarvis-pulse-duration-/,
    );
    expect(orbCss).toMatch(
      /\[data-orb-layer="plasma"\][^{]*\{[^}]*var\(--jarvis-motion-duration-/,
    );
  });

  it("includes the new layers in the reduced-motion neutralization block", () => {
    const reducedMotionBlock = orbCss.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n?$/m,
    );
    expect(reducedMotionBlock).not.toBeNull();
    const block = reducedMotionBlock![0]!;
    for (const layer of [
      "atmosphere",
      "containment",
      "turbine",
      "plasma",
      "core",
      "sweep",
      "ring",
    ]) {
      expect(block).toContain(`data-orb-layer="${layer}"`);
    }
  });
});
