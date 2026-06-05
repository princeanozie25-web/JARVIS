import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GauntletAtmosphere } from "@/components/gauntlet/GauntletAtmosphere";
import { GauntletPipeline } from "@/components/gauntlet/GauntletPipeline";

const atmosphereSource = readFileSync(
  "src/components/gauntlet/GauntletAtmosphere.tsx",
  "utf8",
);
const pipelineSource = readFileSync(
  "src/components/gauntlet/GauntletPipeline.tsx",
  "utf8",
);

describe("Gauntlet Three.js atmosphere", () => {
  it("renders an optional non-interactive atmosphere wrapper with safe fallback", () => {
    const markup = renderToStaticMarkup(
      <GauntletAtmosphere presentationalMode="focused" />,
    );

    expect(markup).toContain('data-gauntlet-atmosphere="threejs"');
    expect(markup).toContain('data-gauntlet-atmosphere-mode="focused"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain(
      'data-gauntlet-atmosphere-fallback="reduced-motion-or-webgl-unavailable"',
    );
  });

  it("uses React Three Fiber and drei without camera/control helpers", () => {
    expect(atmosphereSource).toContain('from "@react-three/fiber"');
    expect(atmosphereSource).toContain('from "@react-three/drei"');
    expect(atmosphereSource).toContain("<Canvas");
    expect(atmosphereSource).not.toMatch(
      /OrbitControls|CameraControls|PresentationControls/,
    );
  });

  it("keeps the Canvas presentational and pointer-events disabled", () => {
    expect(atmosphereSource).toMatch(/<Canvas[\s\S]*aria-hidden="true"/);
    expect(atmosphereSource).toMatch(
      /<Canvas[\s\S]*className="pointer-events-none/,
    );
    expect(atmosphereSource).not.toMatch(/\bonClick\b|\bonPointerDown\b/);
  });

  it("contains reduced-motion and WebGL fallback gates", () => {
    expect(atmosphereSource).toContain("prefers-reduced-motion: reduce");
    expect(atmosphereSource).toContain("canUseWebGL");
    expect(atmosphereSource).toContain(
      'data-gauntlet-atmosphere-fallback="reduced-motion-or-webgl-unavailable"',
    );
  });

  it("mounts behind the SVG Gauntlet while preserving SVG truth state", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);

    expect(markup).toContain('data-gauntlet-atmosphere-shell="optional"');
    expect(markup).toContain('data-gauntlet-atmosphere="threejs"');
    expect(markup).toContain('data-gauntlet-pipeline="read-only"');
    expect(markup).toContain('aria-label="Living System Map governance flow"');
    expect(markup.indexOf('data-gauntlet-atmosphere="threejs"')).toBeLessThan(
      markup.indexOf('data-gauntlet-pipeline="read-only"'),
    );
  });

  it("passes only presentational mode into the atmosphere layer", () => {
    expect(pipelineSource).toContain(
      "<GauntletAtmosphere presentationalMode={atmosphereMode} />",
    );
    expect(pipelineSource).not.toContain("viewModel={");
    expect(pipelineSource).not.toContain("model={");
  });

  it("keeps read-only invariants intact", () => {
    const markup = renderToStaticMarkup(
      <GauntletPipeline hubState="proposal_pending" />,
    );

    expect(markup).toContain('data-gauntlet-atmosphere-mode="warning"');
    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).not.toMatch(
      /<button\b|<form\b|<input\b|<textarea\b|<select\b|<a\b/i,
    );
  });
});
