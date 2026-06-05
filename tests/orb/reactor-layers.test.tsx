import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Orb reactor refinement - layer presence", () => {
  it("exposes the seven engineered reactor layers", () => {
    const markup = render();

    for (const reactorLayer of [
      "atmospheric_halo",
      "outer_containment_ring",
      "compression_ring",
      "counter_rotating_containment_lattice",
      "turbine_ring",
      "plasma_compression_chamber",
      "fusion_core",
    ]) {
      expect(markup).toContain(`data-orb-reactor-layer="${reactorLayer}"`);
    }
  });

  it("documents purpose, identity, and motion for every reactor layer", () => {
    const markup = render();
    const reactorLayerMatches =
      markup.match(/data-orb-reactor-layer="[^"]+"/g) ?? [];
    const primaryLayerCount = reactorLayerMatches.filter(
      (match) => !match.includes("fusion_flame"),
    ).length;

    expect(primaryLayerCount).toBe(7);
    expect(markup.match(/data-orb-layer-purpose="/g)).toHaveLength(8);
    expect(markup.match(/data-orb-layer-identity="/g)).toHaveLength(8);
    expect(markup.match(/data-orb-layer-motion="/g)).toHaveLength(8);
  });

  it("preserves the original ring / sweep / core layers", () => {
    const markup = render();
    expect(markup).toContain('data-orb-layer="ring"');
    expect(markup).toContain('data-orb-layer="sweep"');
    expect(markup).toContain('data-orb-layer="core"');
  });

  it("preserves atmosphere, containment, turbine, and plasma layers", () => {
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

describe("Orb reactor refinement - CSS contract", () => {
  it("declares atmosphere, containment, turbine, plasma, and reactor keyframes", () => {
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-atmosphere-breath/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-containment-counter/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-turbine-spin/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-plasma-compress/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-compression-tighten/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-fusion-heartbeat/);
    expect(orbCss).toMatch(/@keyframes\s+jarvis-orb-overload-flicker/);
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
    expect(orbCss).toMatch(
      /\[data-orb-reactor-layer="compression_ring"\][^{]*\{[^}]*var\(--jarvis-motion-duration-/,
    );
  });

  it("includes the reactor layers in the reduced-motion neutralization block", () => {
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
    expect(block).toContain("data-orb-reactor-layer");
  });

  it("differentiates reactor motion across the visible activity states", () => {
    const stateExpectations = [
      {
        state: "idle",
        layer: "compression_ring",
        token: "var(--jarvis-motion-duration-cinematic)",
      },
      {
        state: "listening",
        layer: "compression_ring",
        token: "var(--jarvis-color-focus)",
      },
      {
        state: "processing",
        layer: "outer_containment_ring",
        token: "var(--jarvis-color-focus)",
      },
      {
        state: "speaking",
        layer: "fusion_flame",
        token: "jarvis-orb-plasma-release",
      },
      {
        state: "approval_needed",
        layer: "outer_containment_ring",
        token: "var(--jarvis-color-review)",
      },
      {
        state: "alert",
        layer: "outer_containment_ring",
        token: "var(--jarvis-color-blocked)",
      },
    ] as const;

    for (const { state, layer, token } of stateExpectations) {
      expect(orbCss).toMatch(
        new RegExp(
          `\\[data-orb-activity-state="${state}"\\][\\s\\S]*?\\[data-orb-reactor-layer="${layer}"\\][\\s\\S]*?\\{[\\s\\S]*?${escapeRegex(token)}`,
        ),
      );
    }
  });
});
