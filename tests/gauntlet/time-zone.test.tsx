import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TimeZone } from "@/components/gauntlet/TimeZone";
import {
  HUB_NODE_ID,
  TIME_ACTIVATION_STATES,
  buildGauntletViewModel,
  type TimeActivationState,
} from "@/lib/gauntlet-visualization";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gauntletCss = readFileSync(
  resolve(ROOT, "src", "components", "gauntlet", "gauntlet.css"),
  "utf8",
);

const TIME_AGENT_IDS = [
  "life_coach",
  "build_monitor",
  "research",
  "cv_maintenance",
  "job_scout",
  "morning_brief",
  "deadline",
  "cost_monitor",
] as const;

function renderTime(state?: TimeActivationState): string {
  const model = buildGauntletViewModel({ timeState: state });
  const zone = model.zones.find((z) => z.zone_id === "time")!;
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 1700">
      <TimeZone zone={zone} state={model.time_state} hub={model.hub} />
    </svg>,
  );
}

describe("DD.4 Time zone — view model", () => {
  it("ships exactly the eight required agent nodes", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "time")!;
    const agentIds = zone.nodes
      .filter((n) => n.kind === "agent")
      .map((n) => n.node_id);
    expect(agentIds.sort()).toEqual([...TIME_AGENT_IDS].sort());
  });

  it("places the coordinator at the orbital center with the suggestion inbox exit", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "time")!;
    const coordinator = zone.nodes.find(
      (n) => n.node_id === "agent_coordinator",
    );
    const inbox = zone.nodes.find((n) => n.node_id === "suggestion_inbox");
    expect(coordinator?.kind).toBe("coordinator");
    expect(inbox?.kind).toBe("suggestion_inbox");
    expect(inbox?.approaches_hub).toBe(true);
  });

  it("places agents on an orbit around the coordinator (constant radius)", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "time")!;
    const center = zone.nodes.find(
      (n) => n.node_id === "agent_coordinator",
    )!.position;
    const radii = zone.nodes
      .filter((n) => n.kind === "agent")
      .map((agent) => {
        const dx = agent.position.x - center.x;
        const dy = agent.position.y - center.y;
        return Math.round(Math.sqrt(dx * dx + dy * dy));
      });
    const unique = new Set(radii);
    expect(unique.size).toBe(1);
    expect([...unique][0]).toBeGreaterThan(150);
  });

  it("routes the exit edge from suggestion_inbox to the Human Gate (gated)", () => {
    const model = buildGauntletViewModel();
    const zone = model.zones.find((z) => z.zone_id === "time")!;
    const exit = zone.edges.find((e) => e.kind === "exit");
    expect(exit).toBeDefined();
    expect(exit!.from_node_id).toBe("suggestion_inbox");
    expect(exit!.to_node_id).toBe(HUB_NODE_ID);
    expect(exit!.policy).toBe("gated");
  });

  it("declares exactly the activation state union", () => {
    expect(TIME_ACTIVATION_STATES).toEqual([
      "idle",
      "scheduler_tick",
      "coordinator_pulse",
      "agent_ignition",
      "suggestion_pulse",
    ]);
  });
});

describe("DD.4 TimeZone component — rendering", () => {
  it("emits the populated zone marker and idle state by default", () => {
    const markup = renderTime();
    expect(markup).toContain('data-gauntlet-zone="time"');
    expect(markup).toContain('data-gauntlet-zone-populated="true"');
    expect(markup).toContain('data-time-state="idle"');
  });

  it("renders all 8 agents + coordinator + suggestion_inbox = 10 nodes", () => {
    const markup = renderTime();
    for (const id of TIME_AGENT_IDS) {
      expect(markup).toContain(`data-time-node-id="${id}"`);
    }
    expect(markup).toContain('data-time-node-id="agent_coordinator"');
    expect(markup).toContain('data-time-node-id="suggestion_inbox"');
    expect(markup).toContain('data-time-node-kind="agent"');
    expect(markup).toContain('data-time-node-kind="coordinator"');
    expect(markup).toContain('data-time-node-kind="suggestion_inbox"');
  });

  it("emits a pulse per edge with the exit pulse marked", () => {
    const markup = renderTime();
    expect(markup).toContain('data-gauntlet-pulse="true"');
    expect(markup).toContain('data-time-pulse-kind="agent_feed"');
    expect(markup).toContain('data-time-pulse-kind="aggregate"');
    expect(markup).toContain('data-time-pulse-kind="exit"');
  });

  it("colors nodes through stone tokens — no raw hex", () => {
    const markup = renderTime();
    expect(markup).toContain("var(--jarvis-color-stone-time)");
    expect(markup).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("changes data-time-state across the activation cycle", () => {
    for (const state of TIME_ACTIVATION_STATES) {
      const markup = renderTime(state);
      expect(markup).toContain(`data-time-state="${state}"`);
    }
  });

  it("exposes no interactive controls", () => {
    const markup = renderTime();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });
});

describe("DD.4 gauntlet.css — Time activation rules + reduced motion", () => {
  it("declares orbital breathing and agent-ignition keyframes", () => {
    expect(gauntletCss).toMatch(
      /@keyframes\s+jarvis-gauntlet-orbital-breathing/,
    );
    expect(gauntletCss).toMatch(/@keyframes\s+jarvis-gauntlet-agent-ignition/);
  });

  it("idle agents breathe at the long pulse duration", () => {
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="time"\]\s*\[data-time-node-kind="agent"\][^{]*\{[^}]*animation:[^;]*var\(--jarvis-pulse-duration-long\)/,
    );
  });

  it("agent_ignition state runs the ignition animation at short duration", () => {
    expect(gauntletCss).toMatch(
      /\[data-time-state="agent_ignition"\][^{]+\[data-time-node-kind="agent"\][^{]*\{[^}]*jarvis-gauntlet-agent-ignition[\s\S]*?var\(--jarvis-pulse-duration-short\)/,
    );
  });

  it("reduced-motion neutralizes every Time animation", () => {
    expect(gauntletCss).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(gauntletCss).toMatch(
      /\[data-gauntlet-zone="time"\]\s*\*[\s,][^{]*\{[\s\S]*?animation:\s*none\s*!important/,
    );
  });
});
