import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PowerZone } from "@/components/gauntlet/PowerZone";
import {
  HUB_NODE_ID,
  POWER_STATES,
  buildGauntletViewModel,
  type PowerState,
} from "@/lib/gauntlet-visualization";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

const POWER_NODE_IDS = [
  "reactor_core",
  "architecture_graph",
  "telemetry_cockpit",
  "governance_visualizer",
  "cai_manifest",
  "cai_adapter",
  "red_team_sandbox",
  "cai_execution_gate",
] as const;

function renderPower(state?: PowerState): string {
  const model = buildGauntletViewModel({ powerState: state });
  const zone = model.zones.find((z) => z.zone_id === "power")!;
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 2700">
      <PowerZone zone={zone} state={model.power_state} hub={model.hub} />
    </svg>,
  );
}

describe("DD.8 Power zone — view model", () => {
  it("ships the required node set", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "power")!;
    const ids = zone.nodes.map((n) => n.node_id).sort();
    expect(ids).toEqual([...POWER_NODE_IDS].sort());
  });

  it("audit heartbeat is a closed cycle of three audit edges", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "power")!;
    const audits = zone.edges.filter((e) => e.kind === "audit");
    expect(audits).toHaveLength(3);
    const fromSet = new Set(audits.map((e) => e.from_node_id));
    const toSet = new Set(audits.map((e) => e.to_node_id));
    for (const id of [
      "architecture_graph",
      "telemetry_cockpit",
      "governance_visualizer",
    ]) {
      expect(fromSet.has(id)).toBe(true);
      expect(toSet.has(id)).toBe(true);
    }
  });

  it("red_team_sandbox flags a forbidden edge through governance", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "power")!;
    const forbidden = zone.edges.find((e) => e.kind === "forbidden");
    expect(forbidden).toBeDefined();
    expect(forbidden!.from_node_id).toBe("red_team_sandbox");
    expect(forbidden!.to_node_id).toBe("governance_visualizer");
  });

  it("cai_execution_gate is the gated exit to the Human Gate", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "power")!;
    const exit = zone.edges.find((e) => e.kind === "exit");
    expect(exit).toBeDefined();
    expect(exit!.from_node_id).toBe("cai_execution_gate");
    expect(exit!.to_node_id).toBe(HUB_NODE_ID);
    expect(exit!.policy).toBe("gated");
    const gateNode = zone.nodes.find((n) => n.node_id === "cai_execution_gate");
    expect(gateNode?.approaches_hub).toBe(true);
  });

  it("declares exactly the activation state union", () => {
    expect(POWER_STATES).toEqual(["idle", "audit_cycle", "forbidden_alert"]);
  });
});

describe("DD.8 PowerZone component — rendering", () => {
  it("emits the populated zone marker and idle state by default", () => {
    const markup = renderPower();
    expect(markup).toContain('data-gauntlet-zone="power"');
    expect(markup).toContain('data-gauntlet-zone-populated="true"');
    expect(markup).toContain('data-power-state="idle"');
  });

  it("renders the reactor frame, gate lock, and cost/event metadata", () => {
    const markup = renderPower();
    expect(markup).toContain('data-power-fortress-frame="true"');
    expect(markup).toContain('data-power-gate-lock="true"');
    expect(markup).toContain('data-power-cost-counter="true"');
    expect(markup).toContain('data-power-event-rate="true"');
    expect(markup).toMatch(/DEMO/);
  });

  it("emits the gated exit pulse and a forbidden edge", () => {
    const markup = renderPower();
    expect(markup).toContain('data-power-pulse-kind="exit"');
    expect(markup).toContain('data-power-edge-kind="forbidden"');
  });

  it("colors nodes through stone tokens — no raw hex", () => {
    const markup = renderPower();
    expect(markup).toContain("var(--jarvis-color-stone-power)");
    expect(markup).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("changes data-power-state across the activation cycle", () => {
    for (const state of POWER_STATES) {
      const markup = renderPower(state);
      expect(markup).toContain(`data-power-state="${state}"`);
    }
  });

  it("exposes no interactive controls", () => {
    const markup = renderPower();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});

describe("DD.8 gauntlet.css — Power activation rules + reduced motion", () => {
  it("declares audit heartbeat, fortress flash, and forbidden glow keyframes", () => {
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-audit-heartbeat/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-fortress-flash/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-forbidden-glow/);
  });

  it("audit edges heartbeat at the long pulse duration by default", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="power"\]\s*\[data-power-edge-kind="audit"\][^{]*\{[^}]*animation:\s*jarvis-gauntlet-audit-heartbeat\s+var\(--jarvis-pulse-duration-long\)/,
    );
  });

  it("forbidden_alert state lights the fortress frame and the forbidden edge", () => {
    expect(gauntletCss).toMatch(
      /\[data-power-state="forbidden_alert"\][\s\S]*?\[data-power-fortress-frame="true"\][\s\S]*?animation:\s*jarvis-gauntlet-fortress-flash/,
    );
    expect(gauntletCss).toMatch(
      /\[data-power-state="forbidden_alert"\][\s\S]*?\[data-power-edge-kind="forbidden"\][\s\S]*?animation:\s*jarvis-gauntlet-forbidden-glow/,
    );
  });

  it("reduced motion neutralizes every Power animation", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="power"\]\s*\*[\s,][\s\S]*?animation:\s*none\s*!important/,
    );
  });
});
