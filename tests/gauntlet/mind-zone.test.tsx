import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MindZone } from "@/components/gauntlet/MindZone";
import {
  COUNCIL_STAGES,
  HUB_NODE_ID,
  buildGauntletViewModel,
  type CouncilStage,
} from "@/lib/gauntlet-visualization";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

const MIND_MEMBER_IDS = [
  "member_1",
  "member_2",
  "member_3",
  "member_4",
  "member_5",
  "member_6",
] as const;

function renderMind(stage?: CouncilStage): string {
  const model = buildGauntletViewModel({ councilStage: stage });
  const zone = model.zones.find((z) => z.zone_id === "mind")!;
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 1700">
      <MindZone
        zone={zone}
        councilStage={model.mind_council_stage}
        hub={model.hub}
      />
    </svg>,
  );
}

describe("DD.5 Mind zone — view model", () => {
  it("ships exactly six members + reviewer + chairman + coordinator (9 nodes)", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "mind")!;
    expect(zone.nodes.length).toBe(9);
    const members = zone.nodes
      .filter((n) => n.kind === "member")
      .map((n) => n.node_id);
    expect(members.sort()).toEqual([...MIND_MEMBER_IDS].sort());
    expect(zone.nodes.some((n) => n.node_id === "assistant_reviewer")).toBe(
      true,
    );
    expect(zone.nodes.some((n) => n.node_id === "chairman")).toBe(true);
    expect(zone.nodes.some((n) => n.node_id === "coordinator")).toBe(true);
  });

  it("members sit on a constant outer ring around the chairman", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "mind")!;
    const chairman = zone.nodes.find((n) => n.node_id === "chairman")!;
    const radii = zone.nodes
      .filter((n) => n.kind === "member")
      .map((member) => {
        const dx = member.position.x - chairman.position.x;
        const dy = member.position.y - chairman.position.y;
        return Math.round(Math.sqrt(dx * dx + dy * dy));
      });
    const unique = new Set(radii);
    expect(unique.size).toBe(1);
    expect([...unique][0]).toBeGreaterThan(150);
  });

  it("routes chairman → human-gate as the gated synthesis exit", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "mind")!;
    const exit = zone.edges.find((e) => e.kind === "exit");
    expect(exit).toBeDefined();
    expect(exit!.from_node_id).toBe("chairman");
    expect(exit!.to_node_id).toBe(HUB_NODE_ID);
    expect(exit!.policy).toBe("gated");
  });

  it("ships six peer-review edges around the hexagonal ring", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "mind")!;
    const peer = zone.edges.filter((e) => e.kind === "peer");
    expect(peer.length).toBe(6);
  });

  it("ships six review edges, one per member → reviewer", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "mind")!;
    const review = zone.edges.filter((e) => e.kind === "review");
    expect(review.length).toBe(6);
    for (const edge of review) {
      expect(edge.to_node_id).toBe("assistant_reviewer");
    }
  });

  it("ships a coordinator → chairman staging edge and a reviewer → chairman synthesis edge", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "mind")!;
    expect(
      zone.edges.some(
        (e) =>
          e.kind === "coordinator" &&
          e.from_node_id === "coordinator" &&
          e.to_node_id === "chairman",
      ),
    ).toBe(true);
    expect(
      zone.edges.some(
        (e) =>
          e.kind === "synthesis" &&
          e.from_node_id === "assistant_reviewer" &&
          e.to_node_id === "chairman",
      ),
    ).toBe(true);
  });

  it("declares the council stage state-machine union", () => {
    expect(COUNCIL_STAGES).toEqual([
      "idle",
      "independent",
      "peer_review",
      "assistant_review",
      "chairman_synthesis",
    ]);
  });
});

describe("DD.5 MindZone component — rendering", () => {
  it("emits the populated zone marker and idle council stage by default", () => {
    const markup = renderMind();
    expect(markup).toContain('data-gauntlet-zone="mind"');
    expect(markup).toContain('data-gauntlet-zone-populated="true"');
    expect(markup).toContain('data-mind-council-stage="idle"');
  });

  it("renders all 9 node IDs with the right kinds", () => {
    const markup = renderMind();
    for (const id of MIND_MEMBER_IDS) {
      expect(markup).toContain(`data-mind-node-id="${id}"`);
    }
    expect(markup).toContain('data-mind-node-id="assistant_reviewer"');
    expect(markup).toContain('data-mind-node-id="chairman"');
    expect(markup).toContain('data-mind-node-id="coordinator"');
    expect(markup).toContain('data-mind-node-kind="member"');
    expect(markup).toContain('data-mind-node-kind="reviewer"');
    expect(markup).toContain('data-mind-node-kind="chairman"');
    expect(markup).toContain('data-mind-node-kind="coordinator"');
  });

  it("renders the chairman halo element targeted by the synthesis animation", () => {
    const markup = renderMind();
    expect(markup).toContain('data-mind-chairman-halo="true"');
  });

  it("changes data-mind-council-stage across the council sequence", () => {
    for (const stage of COUNCIL_STAGES) {
      const markup = renderMind(stage);
      expect(markup).toContain(`data-mind-council-stage="${stage}"`);
    }
  });

  it("colors nodes through stone tokens — no raw hex", () => {
    const markup = renderMind();
    expect(markup).toContain("var(--jarvis-color-stone-mind)");
    expect(markup).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("exposes no interactive controls in any council stage", () => {
    for (const stage of COUNCIL_STAGES) {
      const markup = renderMind(stage);
      expect(markup).not.toMatch(/<button\b/i);
      expect(markup).not.toMatch(/<form\b/i);
      expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
      expect(markup).not.toMatch(/<a\b/i);
    }
  });
});

describe("DD.5 gauntlet.css — Mind council rules + reduced motion", () => {
  it("declares thought-exchange, member-ignition, and chairman-accumulate keyframes", () => {
    expect(gauntletCss).toMatch(
      /@keyframes\s+jarvis-gauntlet-thought-exchange/,
    );
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-member-ignition/);
    expect(gauntletCss).toMatch(
      /@keyframes\s+jarvis-gauntlet-chairman-accumulate/,
    );
  });

  it("idle peer edges run thought-exchange at the long pulse duration", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="mind"\]\s*\[data-mind-edge-kind="peer"\][^{]*\{[^}]*jarvis-gauntlet-thought-exchange/,
    );
  });

  it("independent stage ignites members", () => {
    expect(gauntletCss).toMatch(
      /\[data-mind-council-stage="independent"\][^{]+\[data-mind-node-kind="member"\][^{]*\{[^}]*jarvis-gauntlet-member-ignition/,
    );
  });

  it("peer_review tightens peer edges and assistant_review lights review edges", () => {
    expect(gauntletCss).toMatch(
      /\[data-mind-council-stage="peer_review"\][^{]+\[data-mind-edge-kind="peer"\]/,
    );
    expect(gauntletCss).toMatch(
      /\[data-mind-council-stage="assistant_review"\][^{]+\[data-mind-edge-kind="review"\]/,
    );
  });

  it("chairman_synthesis runs the chairman halo accumulate animation", () => {
    expect(gauntletCss).toMatch(
      /\[data-mind-council-stage="chairman_synthesis"\][\s\S]*?jarvis-gauntlet-chairman-accumulate/,
    );
  });

  it("reduced-motion neutralizes every Mind animation", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="mind"\]\s*\*[\s,][^{]*\{[\s\S]*?animation:\s*none\s*!important/,
    );
  });
});
