import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RealityZone } from "@/components/gauntlet/RealityZone";
import {
  HUB_NODE_ID,
  REALITY_STATES,
  buildGauntletViewModel,
  type RealityState,
} from "@/lib/gauntlet-visualization";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

const REALITY_NODE_IDS = [
  "theme_engine",
  "room_registry",
  "hue_bridge",
  "fancyled",
  "nanoleaf",
  "tapo_plugs",
  "ruview_sensors",
] as const;

const ADAPTER_IDS = ["hue_bridge", "fancyled", "nanoleaf", "tapo_plugs"];

function renderReality(state?: RealityState): string {
  const model = buildGauntletViewModel({ realityState: state });
  const zone = model.zones.find((z) => z.zone_id === "reality")!;
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 2700">
      <RealityZone zone={zone} state={model.reality_state} hub={model.hub} />
    </svg>,
  );
}

describe("DD.7 Reality zone — view model", () => {
  it("ships exactly the seven required nodes", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "reality")!;
    const ids = zone.nodes.map((n) => n.node_id).sort();
    expect(ids).toEqual([...REALITY_NODE_IDS].sort());
  });

  it("theme_engine is at the center and approaches the hub", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "reality")!;
    const engine = zone.nodes.find((n) => n.node_id === "theme_engine");
    expect(engine?.kind).toBe("theme_engine");
    expect(engine?.approaches_hub).toBe(true);
  });

  it("every device adapter is flagged as a mock kind", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "reality")!;
    for (const id of ADAPTER_IDS) {
      const node = zone.nodes.find((n) => n.node_id === id);
      expect(node?.kind).toBe("adapter_mock");
    }
  });

  it("emits a theme-engine→adapter sync edge for every adapter", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "reality")!;
    const syncEdges = zone.edges.filter((e) => e.kind === "sync");
    expect(syncEdges).toHaveLength(ADAPTER_IDS.length);
    for (const id of ADAPTER_IDS) {
      const edge = syncEdges.find((e) => e.to_node_id === id);
      expect(edge?.from_node_id).toBe("theme_engine");
      expect(edge?.policy).toBe("allowed");
    }
  });

  it("theme_engine exits gated to the Human Gate", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "reality")!;
    const exit = zone.edges.find((e) => e.kind === "exit");
    expect(exit).toBeDefined();
    expect(exit!.from_node_id).toBe("theme_engine");
    expect(exit!.to_node_id).toBe(HUB_NODE_ID);
    expect(exit!.policy).toBe("gated");
  });

  it("declares exactly the activation state union", () => {
    expect(REALITY_STATES).toEqual(["idle", "room_action", "theme_sync"]);
  });
});

describe("DD.7 RealityZone component — rendering", () => {
  it("emits the populated zone marker and idle state by default", () => {
    const markup = renderReality();
    expect(markup).toContain('data-gauntlet-zone="reality"');
    expect(markup).toContain('data-gauntlet-zone-populated="true"');
    expect(markup).toContain('data-reality-state="idle"');
  });

  it("renders every adapter with the mock attribute and MOCK badge", () => {
    const markup = renderReality();
    for (const id of ADAPTER_IDS) {
      expect(markup).toContain(`data-reality-node-id="${id}"`);
    }
    expect(markup).toContain('data-reality-mock="true"');
    expect(markup).toContain('data-reality-mock-badge="true"');
    expect(markup).toMatch(/>MOCK</);
  });

  it("emits the gated exit pulse and crystal halo on theme_engine", () => {
    const markup = renderReality();
    expect(markup).toContain('data-reality-pulse-kind="exit"');
    expect(markup).toContain('data-reality-crystal-halo="true"');
  });

  it("colors nodes through stone tokens — no raw hex", () => {
    const markup = renderReality();
    expect(markup).toContain("var(--jarvis-color-stone-reality)");
    expect(markup).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("changes data-reality-state across the activation cycle", () => {
    for (const state of REALITY_STATES) {
      const markup = renderReality(state);
      expect(markup).toContain(`data-reality-state="${state}"`);
    }
  });

  it("exposes no interactive controls", () => {
    const markup = renderReality();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});

describe("DD.7 gauntlet.css — Reality activation rules + reduced motion", () => {
  it("declares electrical idle, theme sync, and room action keyframes", () => {
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-electrical-idle/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-theme-sync/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-room-action/);
  });

  it("theme_sync state animates the sync edges", () => {
    expect(gauntletCss).toMatch(
      /\[data-reality-state="theme_sync"\][\s\S]*?\[data-reality-edge-kind="sync"\][\s\S]*?animation:\s*jarvis-gauntlet-theme-sync/,
    );
  });

  it("mock adapters render at reduced opacity", () => {
    expect(gauntletCss).toMatch(
      /\[data-reality-mock="true"\][^{]*\{[^}]*opacity:\s*0\.6/,
    );
  });

  it("reduced motion neutralizes every Reality animation", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="reality"\]\s*\*[\s,][\s\S]*?animation:\s*none\s*!important/,
    );
  });
});
