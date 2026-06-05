import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SoulZone } from "@/components/gauntlet/SoulZone";
import {
  HUB_NODE_ID,
  SOUL_STATES,
  buildGauntletViewModel,
  type SoulState,
} from "@/lib/gauntlet-visualization";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

const SOUL_NODE_IDS = [
  "obsidian_vault",
  "sqlite_vec",
  "librarian_agent",
  "llm_wiki",
  "session_memory",
  "project_intelligence",
  "knowledge_compounding",
] as const;

function renderSoul(state?: SoulState): string {
  const model = buildGauntletViewModel({ soulState: state });
  const zone = model.zones.find((z) => z.zone_id === "soul")!;
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 2700">
      <SoulZone zone={zone} state={model.soul_state} hub={model.hub} />
    </svg>,
  );
}

describe("DD.6 Soul zone — view model", () => {
  it("ships exactly the seven required nodes", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "soul")!;
    const ids = zone.nodes.map((n) => n.node_id).sort();
    expect(ids).toEqual([...SOUL_NODE_IDS].sort());
  });

  it("vault sits at the orbital center; compounding is the gated exit", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "soul")!;
    const vault = zone.nodes.find((n) => n.node_id === "obsidian_vault");
    const compounding = zone.nodes.find(
      (n) => n.node_id === "knowledge_compounding",
    );
    expect(vault?.kind).toBe("vault");
    expect(compounding?.kind).toBe("compounding");
    expect(compounding?.approaches_hub).toBe(true);
  });

  it("retrieval flow is vault → sqlite_vec → librarian → wiki", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "soul")!;
    const edges = zone.edges;
    const vaultToVec = edges.find((e) => e.kind === "index");
    const vecToLib = edges.find((e) => e.kind === "retrieval");
    const libToWiki = edges.find((e) => e.kind === "publish");
    expect(vaultToVec?.from_node_id).toBe("obsidian_vault");
    expect(vaultToVec?.to_node_id).toBe("sqlite_vec");
    expect(vecToLib?.from_node_id).toBe("sqlite_vec");
    expect(vecToLib?.to_node_id).toBe("librarian_agent");
    expect(libToWiki?.from_node_id).toBe("librarian_agent");
    expect(libToWiki?.to_node_id).toBe("llm_wiki");
  });

  it("knowledge proposal exits gated to the Human Gate", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "soul")!;
    const exit = zone.edges.find((e) => e.kind === "exit");
    expect(exit).toBeDefined();
    expect(exit!.from_node_id).toBe("knowledge_compounding");
    expect(exit!.to_node_id).toBe(HUB_NODE_ID);
    expect(exit!.policy).toBe("gated");
  });

  it("declares exactly the activation state union", () => {
    expect(SOUL_STATES).toEqual(["idle", "retrieval", "knowledge_write"]);
  });
});

describe("DD.6 SoulZone component — rendering", () => {
  it("emits the populated zone marker and idle state by default", () => {
    const markup = renderSoul();
    expect(markup).toContain('data-gauntlet-zone="soul"');
    expect(markup).toContain('data-gauntlet-zone-populated="true"');
    expect(markup).toContain('data-soul-state="idle"');
  });

  it("renders all 7 Soul nodes", () => {
    const markup = renderSoul();
    for (const id of SOUL_NODE_IDS) {
      expect(markup).toContain(`data-soul-node-id="${id}"`);
    }
    expect(markup).toContain('data-soul-node-kind="vault"');
    expect(markup).toContain('data-soul-node-kind="compounding"');
  });

  it("emits the gated exit pulse and vault heartbeat element", () => {
    const markup = renderSoul();
    expect(markup).toContain('data-soul-pulse-kind="exit"');
    expect(markup).toContain('data-soul-vault-heartbeat="true"');
  });

  it("colors nodes through stone tokens — no raw hex", () => {
    const markup = renderSoul();
    expect(markup).toContain("var(--jarvis-color-stone-soul)");
    expect(markup).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("changes data-soul-state across the activation cycle", () => {
    for (const state of SOUL_STATES) {
      const markup = renderSoul(state);
      expect(markup).toContain(`data-soul-state="${state}"`);
    }
  });

  it("exposes no interactive controls", () => {
    const markup = renderSoul();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});

describe("DD.6 gauntlet.css — Soul activation rules + reduced motion", () => {
  it("declares memory circulation, vault heartbeat, retrieval keyframes", () => {
    expect(gauntletCss).toMatch(
      /@keyframes\s+jarvis-gauntlet-memory-circulation/,
    );
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-vault-heartbeat/);
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-retrieval-glow/);
  });

  it("idle memory veins breathe at the long pulse duration", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="soul"\][\s\S]*?animation:\s*jarvis-gauntlet-memory-circulation\s+var\(--jarvis-pulse-duration-long\)/,
    );
  });

  it("retrieval state lights the retrieval and publish channels", () => {
    expect(gauntletCss).toMatch(
      /\[data-soul-state="retrieval"\][\s\S]*?\[data-soul-edge-kind="retrieval"\]/,
    );
  });

  it("reduced motion neutralizes every Soul animation", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="soul"\]\s*\*[\s,][\s\S]*?animation:\s*none\s*!important/,
    );
  });
});
