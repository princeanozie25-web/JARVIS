import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpaceZone } from "@/components/gauntlet/SpaceZone";
import { buildGauntletViewModel } from "@/lib/gauntlet-visualization";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

const ALL_SPACE_NODE_IDS = [
  "input_gateway",
  "intent_classifier",
  "safety_classifier",
  "router",
  "tier_t0",
  "tier_t1",
  "tier_t2",
  "tier_t3",
  "tier_t4",
  "tool_runtime",
  "audit_store",
] as const;

function renderSpace(): string {
  const model = buildGauntletViewModel();
  const space = model.zones.find((z) => z.zone_id === "space")!;
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 900">
      <SpaceZone zone={space} />
    </svg>,
  );
}

describe("DD.3 SpaceZone — node rendering", () => {
  it("renders all eleven Space nodes", () => {
    const markup = renderSpace();
    for (const id of ALL_SPACE_NODE_IDS) {
      expect(markup).toContain(`data-gauntlet-node-id="${id}"`);
    }
  });

  it("labels every node visually and for screen readers", () => {
    const markup = renderSpace();
    const model = buildGauntletViewModel();
    const space = model.zones.find((z) => z.zone_id === "space")!;
    for (const node of space.nodes) {
      expect(markup).toContain(node.label);
      expect(markup).toContain(`aria-label="${node.label}"`);
    }
  });

  it("emits an edge line for every Space edge with the policy data attr", () => {
    const markup = renderSpace();
    const model = buildGauntletViewModel();
    const space = model.zones.find((z) => z.zone_id === "space")!;
    for (const edge of space.edges) {
      expect(markup).toContain(`data-gauntlet-edge-id="${edge.edge_id}"`);
      expect(markup).toContain(`data-gauntlet-edge-policy="${edge.policy}"`);
    }
  });

  it("emits a pulse circle per edge with from/to translation CSS vars", () => {
    const markup = renderSpace();
    expect(markup).toContain('data-gauntlet-pulse="true"');
    expect(markup).toContain("--pulse-from-x");
    expect(markup).toContain("--pulse-to-x");
    expect(markup).toContain("--pulse-from-y");
    expect(markup).toContain("--pulse-to-y");
    expect(markup).toContain("--pulse-delay");
  });

  it("mirrors edge policy onto each pulse for halt/resume targeting", () => {
    const markup = renderSpace();
    expect(markup).toContain('data-gauntlet-pulse-policy="gated"');
    expect(markup).toContain('data-gauntlet-pulse-policy="allowed"');
  });

  it("colors nodes and pulses through stone tokens — no raw hex", () => {
    const markup = renderSpace();
    expect(markup).toContain("var(--jarvis-color-stone-space)");
    // Sanity: no Tailwind gray / blue defaults leaked into the SVG.
    expect(markup).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("exposes no interactive controls", () => {
    const markup = renderSpace();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});

describe("DD.3 gauntlet.css — halt / resume mechanics", () => {
  it("declares the pulse-flow keyframe", () => {
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-pulse-flow/);
  });

  it("pauses gated pulses when the hub is in proposal_pending", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-pipeline\]\[data-hub-state="proposal_pending"\][^{]+\[data-gauntlet-pulse-policy="gated"\][^{]*\{[^}]*animation-play-state:\s*paused/,
    );
  });

  it("pauses gated pulses when the hub is in denied", () => {
    expect(gauntletCss).toMatch(
      /\[data-hub-state="denied"\][^{]+\[data-gauntlet-pulse-policy="gated"\][^{]*\{[^}]*animation-play-state:\s*paused/,
    );
  });

  it("resumes gated pulses when the hub is in approved", () => {
    expect(gauntletCss).toMatch(
      /\[data-hub-state="approved"\][^{]+\[data-gauntlet-pulse-policy="gated"\][^{]*\{[^}]*animation-play-state:\s*running/,
    );
  });

  it("neutralizes every gauntlet animation under prefers-reduced-motion", () => {
    expect(gauntletCss).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(gauntletCss).toMatch(/animation:\s*none\s*!important/);
  });

  it("anchors pulse durations to the DD.0 pulse-duration tokens", () => {
    expect(gauntletCss).toMatch(/var\(--jarvis-pulse-duration-normal\)/);
    expect(gauntletCss).toMatch(/var\(--jarvis-pulse-duration-long\)/);
    expect(gauntletCss).toMatch(/var\(--jarvis-pulse-duration-short\)/);
    expect(gauntletCss).toMatch(/var\(--jarvis-pulse-easing\)/);
  });
});
