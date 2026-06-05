import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GauntletPage from "@/app/audit/gauntlet/page";

const canvasSource = readFileSync(
  "src/components/gauntlet/GauntletCanvas.tsx",
  "utf8",
);
const starfieldSource = readFileSync(
  "src/components/gauntlet/CosmicStarfield.tsx",
  "utf8",
);
const postProcessingSource = readFileSync(
  "src/components/gauntlet/PostProcessing.tsx",
  "utf8",
);
const pulseSource = readFileSync(
  "src/components/gauntlet/ConnectionPulse.tsx",
  "utf8",
);
const overlaySource = readFileSync(
  "src/components/gauntlet/GauntletOverlay.tsx",
  "utf8",
);
const pipelineSource = readFileSync(
  "src/components/gauntlet/GauntletPipeline.tsx",
  "utf8",
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("Gauntlet cosmic canvas architecture", () => {
  it("declares the required React Three Fiber ecosystem dependencies", () => {
    expect(packageJson.dependencies?.three).toBeDefined();
    expect(packageJson.dependencies?.["@react-three/fiber"]).toBeDefined();
    expect(packageJson.dependencies?.["@react-three/drei"]).toBeDefined();
    expect(
      packageJson.dependencies?.["@react-three/postprocessing"],
    ).toBeDefined();
    expect(packageJson.devDependencies?.["@types/three"]).toBeDefined();
  });

  it("renders a presentational canvas layer behind the React truth overlay", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain(
      'data-gauntlet-two-layer-architecture="canvas-plus-react-overlay"',
    );
    expect(markup).toContain(
      'data-gauntlet-cosmic-canvas-layer="r3f-presentational"',
    );
    expect(markup).toContain('data-gauntlet-react-overlay="truth-layer"');
    expect(markup).toContain('data-gauntlet-canvas-owns-metadata="false"');
    expect(markup).toContain('data-gauntlet-canvas-owns-routing="false"');
    expect(markup).toContain('data-gauntlet-canvas-owns-approval="false"');
    expect(markup).toContain('data-gauntlet-overlay-owns-labels="true"');
    expect(markup).toContain('data-gauntlet-overlay-owns-metadata="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
  });

  it("uses Stars, HDRI environment, OrbitControls, and bloom postprocessing", () => {
    expect(canvasSource).toContain('from "@react-three/fiber"');
    expect(canvasSource).toContain('from "@react-three/drei"');
    expect(canvasSource).toContain("<Canvas");
    expect(canvasSource).toContain("<OrbitControls");
    expect(canvasSource).toContain("enablePan");
    expect(canvasSource).toContain("enableZoom");
    expect(canvasSource).toContain("enableRotate={false}");
    expect(canvasSource).toContain("target={[0, 0, 0]}");

    expect(starfieldSource).toContain("<Stars");
    expect(starfieldSource).toContain("count={8000}");
    expect(starfieldSource).toContain(
      'files="/assets/cosmic-gauntlet/starfield.hdr"',
    );

    expect(postProcessingSource).toContain(
      'from "@react-three/postprocessing"',
    );
    expect(postProcessingSource).toContain("<EffectComposer");
    expect(postProcessingSource).toContain("<Bloom");
    expect(postProcessingSource).toContain("intensity={1.5}");
  });

  it("uses 3D tube geometry and moving pulses for zone-to-gate connections", () => {
    expect(pulseSource).toContain("CatmullRomCurve3");
    expect(pulseSource).toContain("<Tube");
    expect(pulseSource).toContain("useFrame");
    expect(pulseSource).toContain("getPointAt");
    expect(pulseSource).not.toContain("<line");
    expect(pulseSource).not.toContain("strokeDasharray");
  });

  it("keeps the React overlay free of Three.js ownership", () => {
    expect(overlaySource).toContain(
      'data-gauntlet-react-overlay="truth-layer"',
    );
    expect(overlaySource).toContain(
      'data-gauntlet-overlay-owns-metadata="true"',
    );
    expect(overlaySource).toContain(
      'data-gauntlet-overlay-owns-approval="false"',
    );
    expect(overlaySource).not.toMatch(
      /@react-three|from "three"|<Canvas|useFrame/,
    );
  });

  it("keeps SVG/React as the read-only governance truth layer", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(pipelineSource).not.toContain("GauntletAtmosphere");
    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).toContain('data-gauntlet-pipeline="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
    expect(markup).not.toMatch(/data-(execute|approve|mutation)-control/i);
    expect(markup).not.toMatch(/>\s*(Run|Send|Execute|Approve|Mutate)\s*</i);
  });

  it("keeps reduced-motion fallback in both canvas and overlay layers", () => {
    const css = readFileSync("src/components/gauntlet/gauntlet.css", "utf8");

    expect(canvasSource).toContain("prefers-reduced-motion: reduce");
    expect(canvasSource).toContain("reducedMotion");
    expect(starfieldSource).toContain("reducedMotion ? 0 : 0.3");
    expect(pulseSource).toContain("if (reducedMotion)");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
