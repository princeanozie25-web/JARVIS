import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GauntletHub } from "@/components/gauntlet/GauntletHub";
import {
  GAUNTLET_HUB_STATES,
  buildGauntletViewModel,
  type GauntletHubState,
} from "@/lib/gauntlet-visualization";

function renderHub(state: GauntletHubState): string {
  const model = buildGauntletViewModel({ hubState: state });
  return renderToStaticMarkup(
    <svg viewBox="0 0 1600 900">
      <GauntletHub hub={model.hub} />
    </svg>,
  );
}

describe("DD.2 GauntletHub — state machine rendering", () => {
  it("renders every hub state with the correct data attribute", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderHub(state);
      expect(markup).toContain(`data-gauntlet-hub="${state}"`);
    }
  });

  it("marks the hub as always visible regardless of state", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderHub(state);
      expect(markup).toContain('data-gauntlet-always-visible="true"');
    }
  });

  it("labels the hub for screen readers in every state", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderHub(state);
      expect(markup).toMatch(/aria-label="Human Gate hub — [^"]+"/);
    }
  });

  it("emits the hub-ring element targeted by gauntlet.css animations", () => {
    const markup = renderHub("default");
    expect(markup).toContain("data-gauntlet-hub-ring");
  });

  it("default state surfaces the gold ring color (no hardcoded hex)", () => {
    const markup = renderHub("default");
    expect(markup).toContain("var(--jarvis-color-gold)");
  });

  it("proposal_pending uses the pipeline human-gate token", () => {
    const markup = renderHub("proposal_pending");
    expect(markup).toContain("var(--jarvis-color-pipeline-human-gate)");
  });

  it("approved uses the execute (green) token", () => {
    const markup = renderHub("approved");
    expect(markup).toContain("var(--jarvis-color-pipeline-execute)");
  });

  it("denied uses the forbidden (red) token", () => {
    const markup = renderHub("denied");
    expect(markup).toContain("var(--jarvis-color-pipeline-forbidden)");
  });

  it("exposes no interactive controls (read-only invariant)", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderHub(state);
      expect(markup).not.toMatch(/<button\b/i);
      expect(markup).not.toMatch(/<form\b/i);
      expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
      expect(markup).not.toMatch(/<a\b/i);
      expect(markup).not.toMatch(/\brole="button"/i);
    }
  });
});
