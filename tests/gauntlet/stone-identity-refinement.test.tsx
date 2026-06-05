import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GauntletPipeline } from "@/components/gauntlet/GauntletPipeline";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

describe("Gauntlet visual refinement — backdrop", () => {
  it("paints a panel, grid, and atmospheric vignette layer", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);
    expect(markup).toContain('data-gauntlet-backdrop="panel"');
    expect(markup).toContain('data-gauntlet-backdrop="grid"');
    expect(markup).toContain('data-gauntlet-backdrop="atmosphere"');
    expect(markup).toContain('fill="var(--jarvis-color-panel)"');
    expect(markup).toContain('id="gauntlet-atmosphere"');
  });
});

describe("Gauntlet visual refinement — per-stone identity hooks", () => {
  it("declares stone-specific atmosphere keyframes routed through pulse tokens", () => {
    expect(gauntletCss).toMatch(
      /@keyframes\s+jarvis-gauntlet-coordinator-gravity/,
    );
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-chairman-drift/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-soul-pressure/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-crystal-rotate/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-fortress-watch/);
  });

  it("Mind chairman halo drifts at the long pulse duration", () => {
    expect(gauntletCss).toMatch(
      /\[data-mind-chairman-halo="true"\][^{]*\{[^}]*animation:[^;]*var\(--jarvis-pulse-duration-long\)/,
    );
  });

  it("Reality crystal halo rotates at the long pulse duration", () => {
    expect(gauntletCss).toMatch(
      /\[data-reality-crystal-halo="true"\][^{]*\{[^}]*animation:[^;]*var\(--jarvis-pulse-duration-long\)/,
    );
  });

  it("Power fortress frame keeps a watchful idle beat", () => {
    expect(gauntletCss).toMatch(
      /\[data-power-fortress-frame="true"\][^{]*\{[^}]*animation:[^;]*jarvis-gauntlet-fortress-watch/,
    );
  });

  it("preserves the read-only contract after refinement", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);
    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });

  it("preserves every populated zone data attribute", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);
    for (const zone of ["space", "time", "mind", "soul", "reality", "power"]) {
      expect(markup).toContain(`data-gauntlet-zone="${zone}"`);
    }
  });
});
