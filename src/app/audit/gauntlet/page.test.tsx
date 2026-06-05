import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditPage from "../page";
import HomePage from "../../page";
import GauntletPage from "./page";

const gauntletCss = readFileSync(
  "src/components/gauntlet/gauntlet.css",
  "utf8",
);

describe("/audit/gauntlet cinematic galaxy HUD", () => {
  it("renders the cinematic Gauntlet route shell", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-gauntlet-cinematic-shell="true"');
    expect(markup).toContain('data-gauntlet-galaxy-backdrop="starfield"');
    expect(markup).toContain('data-gauntlet-nebula-backdrop="cosmic-depth"');
    expect(markup).toContain(
      'data-gauntlet-asset-backdrop="nasa-webb-carina-cosmic-cliffs"',
    );
    expect(markup).toContain('data-gauntlet-cinematic-stage="galaxy-map"');
    expect(markup).toContain("JARVIS - Infinity Gauntlet");
  });

  it("renders the left Orb reactor panel with reactor hooks preserved", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-gauntlet-orb-panel="arc-reactor-heart"');
    expect(markup).toContain('data-orb-atmosphere="threejs"');
    expect(markup).toContain('data-orb-reactor-layer="fusion_core"');
    expect(markup).toContain('data-orb-layer="plasma"');
  });

  it("renders cinematic hooks for every stone and the Human Gate authority core", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-gauntlet-cosmic-territories="true"');
    for (const territory of [
      "space",
      "time",
      "mind",
      "soul",
      "reality",
      "power",
    ]) {
      expect(markup).toContain(`data-gauntlet-cosmic-territory="${territory}"`);
    }
    expect(markup).toContain('data-space-tesseract-core="true"');
    expect(markup).toContain('data-space-pipeline-core="true"');
    expect(markup).toContain('data-time-gravity-orbit-core="true"');
    expect(markup).toContain('data-mind-cognition-crystal="true"');
    expect(markup).toContain('data-soul-molten-crystal="true"');
    expect(markup).toContain('data-reality-electric-crystal="true"');
    expect(markup).toContain('data-power-fortress-reactor="true"');
    expect(markup).toContain('data-human-gate-authority-core="true"');
    expect(markup).toContain('data-human-gate-authority-crystal="true"');
  });

  it("renders pan, zoom, and stone-focus affordances without execution authority", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-gauntlet-pan-zoom="interactive"');
    expect(markup).toContain(
      'data-gauntlet-navigation-affordance="pan-zoom-focus"',
    );
    expect(markup).toContain(
      'data-gauntlet-territory-artifact-layer="cosmic-fields"',
    );
    expect(markup).toContain('data-gauntlet-territory-artifact="space"');
    expect(markup).toContain('data-gauntlet-territory-artifact="human_gate"');
    expect(markup).toContain('data-gauntlet-drag-surface="pointer-drag"');
    expect(markup).toContain('data-gauntlet-focus-target="space"');
    expect(markup).toContain('data-gauntlet-focus-target="human_gate"');
    expect(markup).toContain('data-gauntlet-execution-authority="none"');
  });

  it("keeps Three.js/canvas atmosphere layers aria-hidden and non-interactive", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain(
      'data-gauntlet-cosmic-canvas-layer="r3f-presentational"',
    );
    expect(markup).toContain('data-gauntlet-canvas="react-three-fiber"');
    expect(markup).toContain('data-gauntlet-canvas-owns-metadata="false"');
    expect(markup).toContain('data-gauntlet-canvas-owns-routing="false"');
    expect(markup).toContain('data-gauntlet-canvas-owns-approval="false"');
    expect(markup).toContain('data-orb-atmosphere="threejs"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).not.toMatch(
      /OrbitControls|CameraControls|PresentationControls/,
    );
  });

  it("adds no execution controls or mutation affordances", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/data-(execute|approve|mutation)-control/i);
    expect(markup).not.toMatch(/>\s*(Run|Send|Execute|Approve|Mutate)\s*</i);
  });

  it("links the root and audit index to the cinematic Gauntlet route", () => {
    const homeMarkup = renderToStaticMarkup(<HomePage />);
    const markup = renderToStaticMarkup(<AuditPage />);

    expect(homeMarkup).toContain('href="/audit/gauntlet"');
    expect(homeMarkup).toContain(
      'data-root-gauntlet-nav-link="living-system-map"',
    );
    expect(homeMarkup).toContain("Open Living System Map");
    expect(markup).toContain('href="/audit/gauntlet"');
    expect(markup).toContain(
      'data-audit-gauntlet-nav-link="cinematic-gauntlet"',
    );
  });

  it("declares starfield, galaxy, and reduced-motion CSS hooks", () => {
    expect(gauntletCss).toContain(".jarvis-gauntlet-cinematic");
    expect(gauntletCss).toContain(".jarvis-gauntlet-cosmic-asset-backdrop");
    expect(gauntletCss).toContain(".jarvis-gauntlet-galaxy-backdrop");
    expect(gauntletCss).toContain(".jarvis-gauntlet-nebula");
    expect(gauntletCss).toContain(".jarvis-gauntlet-camera-plane");
    expect(gauntletCss).toContain("data-space-tesseract-core");
    expect(gauntletCss).toContain("data-human-gate-authority-core");
    expect(gauntletCss).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it("documents the permissive cosmic asset manifest and local asset", () => {
    const manifest = readFileSync(
      "docs/assets/COSMIC_GAUNTLET_ASSETS.md",
      "utf8",
    );

    expect(manifest).toContain("NASA Webb Carina Cosmic Cliffs");
    expect(manifest).toContain("Poly Haven Kloppenheim 02 Pure Sky HDRI");
    expect(manifest).toContain("public/assets/cosmic-gauntlet");
    expect(manifest).toContain("No copyrighted Marvel");
    expect(
      existsSync(
        "public/assets/cosmic-gauntlet/nasa-webb-carina-cosmic-cliffs.webp",
      ),
    ).toBe(true);
    expect(existsSync("public/assets/cosmic-gauntlet/starfield.hdr")).toBe(
      true,
    );
  });
});
