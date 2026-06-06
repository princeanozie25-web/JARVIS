import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CosmicGauntletPrototypePage from "../../app/cosmic-gauntlet-prototype/page";
import {
  CINEMATIC_PROTOTYPE_CONTRACT,
  COSMIC_GAUNTLET_GALAXIES,
  COSMIC_PIPELINE_PATHS,
  COSMIC_WORLD,
  EXTERNAL_FIDELITY_RESEARCH,
  HUMAN_GATE,
  NASA_M83_GALAXY_CLOUD_ASSET,
  TIME_STONE_REFERENCE_ASSET,
} from "@/components/cosmic-gauntlet-prototype";

const ROOT = resolve(__dirname, "../..");

function renderPrototype(): string {
  return renderToStaticMarkup(<CosmicGauntletPrototypePage />);
}

describe("cosmic gauntlet standalone cinematic prototype", () => {
  it("renders the isolated cinematic route shell", () => {
    const markup = renderPrototype();

    expect(markup).toContain(
      'data-cosmic-gauntlet-prototype="cinematic-scene"',
    );
    expect(markup).toContain(
      `data-cinematic-priority="${CINEMATIC_PROTOTYPE_CONTRACT.priority}"`,
    );
    expect(markup).toContain('data-isolated-prototype="true"');
    expect(markup).toContain(
      'data-visual-reference="time-stone-galaxy-minimum-bar"',
    );
    expect(markup).toContain(
      'data-navigation-model="google-maps-for-a-cosmic-ai-system"',
    );
    expect(CINEMATIC_PROTOTYPE_CONTRACT.route).toBe(
      "/cosmic-gauntlet-prototype",
    );
  });

  it("uses a large world that starts focused into Time before the full universe", () => {
    const markup = renderPrototype();

    expect(COSMIC_WORLD.width).toBeGreaterThan(5000);
    expect(COSMIC_WORLD.height).toBeGreaterThan(3500);
    expect(COSMIC_WORLD.overviewScale).toBeLessThan(0.3);
    expect(markup).toContain('data-cg-starts-focused-galaxy="time"');
    expect(markup).toContain(
      'data-cg-cinematic-world="procedural-8k-capable-six-galaxy-universe"',
    );
  });

  it("ships all six galaxy territories with orbit nodes", () => {
    const markup = renderPrototype();

    expect(COSMIC_GAUNTLET_GALAXIES.map((galaxy) => galaxy.id)).toEqual([
      "time",
      "mind",
      "space",
      "soul",
      "reality",
      "power",
    ]);
    expect(markup.match(/data-cg-territory=/g)).toHaveLength(6);
    for (const galaxy of COSMIC_GAUNTLET_GALAXIES) {
      expect(galaxy.orbitNodes.length).toBeGreaterThanOrEqual(5);
      expect(markup).toContain(`data-cg-territory="${galaxy.id}"`);
      expect(markup).toContain(`data-stone-type="${galaxy.stoneType}"`);
    }
  });

  it("requires every galaxy to declare cloudy fields and molten artifact centers", () => {
    const markup = renderPrototype();

    expect(markup.match(/data-cg-cloudy-galaxy="true"/g)).toHaveLength(6);
    expect(markup.match(/data-cg-molten-artifact-centre="true"/g)).toHaveLength(
      6,
    );
    for (const galaxy of COSMIC_GAUNTLET_GALAXIES) {
      expect(galaxy.stoneType).toMatch(/molten/i);
      expect(galaxy.description).toMatch(
        /plasma|nebula|fire|lightning|tesseract|reactor/i,
      );
    }
  });

  it("renders the central Human Gate authority crystal", () => {
    const markup = renderPrototype();

    expect(HUMAN_GATE.id).toBe("human-gate");
    expect(markup).toContain('data-human-gate-core="golden-authority-crystal"');
    expect(markup).toContain("Sovereign gravity well");
  });

  it("renders the Space tesseract pipeline and packet lanes", () => {
    const markup = renderPrototype();

    expect(COSMIC_PIPELINE_PATHS).toHaveLength(6);
    expect(markup).toContain(
      'data-space-tesseract-pipeline="blue-glass-energy-streams"',
    );
    for (const lane of COSMIC_PIPELINE_PATHS) {
      expect(markup).toContain(`data-cg-pipeline-lane="${lane.id}"`);
    }
  });

  it("exposes pan, zoom, focus, and reset navigation controls", () => {
    const markup = renderPrototype();

    expect(markup).toContain('data-cg-pan-zoom-controls="true"');
    expect(markup).toContain('data-cg-focus-controls="true"');
    expect(markup).toContain('aria-label="Zoom in"');
    expect(markup).toContain('aria-label="Zoom out"');
    expect(markup).toContain('aria-label="View full universe"');
    expect(markup).toContain('aria-label="Reset to Time"');
    expect(markup).toContain('data-cg-focus-target="overview"');
    expect(markup).toContain('data-cg-focus-target="human-gate"');
  });

  it("records the external fidelity tools researched before implementation", () => {
    expect(EXTERNAL_FIDELITY_RESEARCH.map((tool) => tool.name)).toEqual([
      "Spline",
      "Blender",
      "GSAP",
      "Theatre.js",
      "Three.js / R3F / Drei / Postprocessing",
    ]);
    expect(
      EXTERNAL_FIDELITY_RESEARCH.some((tool) => tool.status === "installed"),
    ).toBe(true);
  });

  it("does not expose execution, approval, or mutation affordances", () => {
    const markup = renderPrototype();
    const actionLabels = Array.from(markup.matchAll(/aria-label="([^"]+)"/g))
      .map((match) => match[1])
      .join(" ");

    expect(CINEMATIC_PROTOTYPE_CONTRACT.executionControls).toBe(false);
    expect(CINEMATIC_PROTOTYPE_CONTRACT.approvalControls).toBe(false);
    expect(CINEMATIC_PROTOTYPE_CONTRACT.mutationControls).toBe(false);
    expect(actionLabels).not.toMatch(
      /\b(approve|execute|mutate|delete|run)\b/i,
    );
    expect(markup).not.toContain("data-approval-control");
    expect(markup).not.toContain("data-execution-control");
    expect(markup).not.toContain("data-mutation-control");
  });

  it("declares a reduced-motion fallback in markup and CSS", () => {
    const markup = renderPrototype();
    const css = readFileSync(
      resolve(
        ROOT,
        "src/components/cosmic-gauntlet-prototype/cosmic-gauntlet-prototype.css",
      ),
      "utf8",
    );

    expect(markup).toContain('data-reduced-motion-fallback="true"');
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(CINEMATIC_PROTOTYPE_CONTRACT.reducedMotionFallback).toBe(true);
  });

  it("keeps the supplied visual authority asset and manifest valid", () => {
    const timeReference = `public/${TIME_STONE_REFERENCE_ASSET.replace(/^\//, "")}`;
    const nasaCloud = `public/${NASA_M83_GALAXY_CLOUD_ASSET.replace(/^\//, "")}`;
    const manifest = readFileSync(
      resolve(ROOT, "docs/assets/COSMIC_GAUNTLET_ASSETS.md"),
      "utf8",
    );

    expect(existsSync(resolve(ROOT, timeReference))).toBe(true);
    expect(existsSync(resolve(ROOT, nasaCloud))).toBe(true);
    expect(manifest).toContain(
      "public/assets/cosmic-gauntlet/prototype/time-stone-galaxy-reference.png",
    );
    expect(manifest).toContain(
      "public/assets/cosmic-gauntlet/prototype/nasa-m83-galaxy-cloud.jpg",
    );
  });
});
