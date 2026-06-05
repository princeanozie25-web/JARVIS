import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GauntletPipeline } from "@/components/gauntlet/GauntletPipeline";
import {
  COUNCIL_STAGES,
  HUB_NODE_ID,
  TIME_ACTIVATION_STATES,
  buildGauntletViewModel,
} from "@/lib/gauntlet-visualization";

describe("DD.4-DD.8 — every populated zone routes through the Human Gate", () => {
  it("every populated zone with an exit edge terminates at the hub id", () => {
    const model = buildGauntletViewModel();
    const populated = model.zones.filter(
      (z) => z.populated && z.zone_id !== "space",
    );
    expect(populated.length).toBe(5); // time + mind + soul + reality + power
    for (const zone of populated) {
      const exits = zone.edges.filter((e) => e.kind === "exit");
      expect(exits.length).toBeGreaterThan(0);
      for (const exit of exits) {
        expect(exit.to_node_id).toBe(HUB_NODE_ID);
        expect(exit.policy).toBe("gated");
      }
    }
  });

  it("Soul, Reality, and Power each contribute exactly one gated exit", () => {
    const model = buildGauntletViewModel();
    const soulExit = model.zones
      .find((z) => z.zone_id === "soul")!
      .edges.filter((e) => e.kind === "exit");
    const realityExit = model.zones
      .find((z) => z.zone_id === "reality")!
      .edges.filter((e) => e.kind === "exit");
    const powerExit = model.zones
      .find((z) => z.zone_id === "power")!
      .edges.filter((e) => e.kind === "exit");
    for (const exits of [soulExit, realityExit, powerExit]) {
      expect(exits).toHaveLength(1);
      expect(exits[0]!.to_node_id).toBe(HUB_NODE_ID);
      expect(exits[0]!.policy).toBe("gated");
    }
  });

  it("every exit pulse from Time/Mind/Soul/Reality/Power halts at proposal_pending", () => {
    const pending = renderToStaticMarkup(
      <GauntletPipeline hubState="proposal_pending" />,
    );
    expect(pending).toContain('data-hub-state="proposal_pending"');
    const exitEdgeIds = [
      "time-edge:inbox-to-gate",
      "mind-edge:chairman-to-gate",
      "soul-edge:compounding-to-gate",
      "reality-edge:theme-to-gate",
      "power-edge:gate-to-hub",
    ];
    for (const id of exitEdgeIds) {
      expect(pending).toContain(`data-gauntlet-pulse-edge-id="${id}"`);
    }

    const approved = renderToStaticMarkup(
      <GauntletPipeline hubState="approved" />,
    );
    expect(approved).toContain('data-hub-state="approved"');
  });
});

describe("DD.4-DD.8 — pipeline composition surfaces every ecosystem", () => {
  it("renders Time/Mind/Soul/Reality/Power alongside Space, hub paints on top", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);
    const spaceIdx = markup.indexOf('data-gauntlet-zone="space"');
    const timeIdx = markup.indexOf('data-gauntlet-zone="time"');
    const mindIdx = markup.indexOf('data-gauntlet-zone="mind"');
    const soulIdx = markup.indexOf('data-gauntlet-zone="soul"');
    const realityIdx = markup.indexOf('data-gauntlet-zone="reality"');
    const powerIdx = markup.indexOf('data-gauntlet-zone="power"');
    const hubIdx = markup.indexOf("data-gauntlet-hub=");
    expect(spaceIdx).toBeGreaterThanOrEqual(0);
    expect(timeIdx).toBeGreaterThan(spaceIdx);
    expect(mindIdx).toBeGreaterThan(timeIdx);
    expect(soulIdx).toBeGreaterThan(mindIdx);
    expect(realityIdx).toBeGreaterThan(soulIdx);
    expect(powerIdx).toBeGreaterThan(realityIdx);
    expect(hubIdx).toBeGreaterThan(powerIdx);
  });

  it("populated_zones lists every stone", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);
    expect(markup).toContain(
      'data-populated-zones="space,time,mind,soul,reality,power"',
    );
  });

  it("threads timeState through to the SVG root and Time zone", () => {
    for (const state of TIME_ACTIVATION_STATES) {
      const markup = renderToStaticMarkup(
        <GauntletPipeline timeState={state} />,
      );
      expect(markup).toContain(`data-time-state="${state}"`);
    }
  });

  it("threads councilStage through to the SVG root and Mind zone", () => {
    for (const stage of COUNCIL_STAGES) {
      const markup = renderToStaticMarkup(
        <GauntletPipeline councilStage={stage} />,
      );
      expect(markup).toContain(`data-mind-council-stage="${stage}"`);
    }
  });

  it("read-only invariants stay green with every zone mounted", () => {
    const markup = renderToStaticMarkup(<GauntletPipeline />);
    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});
