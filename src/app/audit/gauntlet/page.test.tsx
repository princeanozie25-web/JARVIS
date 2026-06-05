import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditPage from "../page";
import GauntletPage from "./page";

const gauntletCss = readFileSync("src/components/gauntlet/gauntlet.css", "utf8");

describe("/audit/gauntlet cinematic galaxy HUD", () => {
  it("renders the cinematic Gauntlet route shell", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-gauntlet-cinematic-shell="true"');
    expect(markup).toContain('data-gauntlet-galaxy-backdrop="starfield"');
    expect(markup).toContain('data-gauntlet-nebula-backdrop="cosmic-depth"');
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

    expect(markup).toContain('data-space-tesseract-core="true"');
    expect(markup).toContain('data-space-pipeline-core="true"');
    expect(markup).toContain('data-time-gravity-orbit-core="true"');
    expect(markup).toContain('data-mind-cognition-crystal="true"');
    expect(markup).toContain('data-soul-molten-crystal="true"');
    expect(markup).toContain('data-reality-electric-crystal="true"');
    expect(markup).toContain('data-power-fortress-reactor="true"');
    expect(markup).toContain('data-human-gate-authority-core="true"');
  });

  it("keeps Three.js/canvas atmosphere layers aria-hidden and non-interactive", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-gauntlet-atmosphere="threejs"');
    expect(markup).toContain('data-orb-atmosphere="threejs"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).not.toMatch(/OrbitControls|CameraControls|PresentationControls/);
  });

  it("adds no execution controls or mutation affordances", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);

    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/\brole="button"/i);
  });

  it("links the audit index to the cinematic Gauntlet route", () => {
    const markup = renderToStaticMarkup(<AuditPage />);

    expect(markup).toContain('href="/audit/gauntlet"');
    expect(markup).toContain(
      'data-audit-gauntlet-nav-link="cinematic-gauntlet"',
    );
  });

  it("declares starfield, galaxy, and reduced-motion CSS hooks", () => {
    expect(gauntletCss).toContain(".jarvis-gauntlet-cinematic");
    expect(gauntletCss).toContain(".jarvis-gauntlet-galaxy-backdrop");
    expect(gauntletCss).toContain(".jarvis-gauntlet-nebula");
    expect(gauntletCss).toContain("data-space-tesseract-core");
    expect(gauntletCss).toContain("data-human-gate-authority-core");
    expect(gauntletCss).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
