import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GauntletPipeline } from "@/components/gauntlet/GauntletPipeline";
import GauntletPage from "@/app/audit/gauntlet/page";
import {
  GAUNTLET_HUB_STATES,
  type GauntletHubState,
} from "@/lib/gauntlet-visualization";

function renderPipeline(state?: GauntletHubState): string {
  return renderToStaticMarkup(<GauntletPipeline hubState={state} />);
}

describe("DD.2 + DD.3 GauntletPipeline — composition", () => {
  it("mounts an SVG with the read-only pipeline marker and viewBox", () => {
    const markup = renderPipeline();
    expect(markup).toContain('data-gauntlet-pipeline="read-only"');
    // DD.4 + DD.5 extended the viewBox vertically so Time and Mind get
    // their own band beneath the Space cockpit.
    expect(markup).toContain('viewBox="0 0 1600 2700"');
  });

  it("data-hub-state on the SVG root drives halt/resume CSS", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderPipeline(state);
      expect(markup).toContain(`data-hub-state="${state}"`);
    }
  });

  it("emits the Human Gate hub in every state — always visible", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderPipeline(state);
      expect(markup).toContain(`data-gauntlet-hub="${state}"`);
      expect(markup).toContain('data-gauntlet-always-visible="true"');
      expect(markup).toMatch(/aria-label="Human Gate hub — [^"]+"/);
    }
  });

  it("the hub element appears AFTER the space zone so it paints on top", () => {
    const markup = renderPipeline();
    const zoneIdx = markup.indexOf('data-gauntlet-zone="space"');
    const hubIdx = markup.indexOf("data-gauntlet-hub=");
    expect(zoneIdx).toBeGreaterThanOrEqual(0);
    expect(hubIdx).toBeGreaterThan(zoneIdx);
  });

  it("populates Space, Time, Mind, Soul, Reality, and Power zones", () => {
    const markup = renderPipeline();
    expect(markup).toContain(
      'data-populated-zones="space,time,mind,soul,reality,power"',
    );
    expect(markup).toContain('data-gauntlet-zone="space"');
    expect(markup).toContain('data-gauntlet-zone="time"');
    expect(markup).toContain('data-gauntlet-zone="mind"');
    expect(markup).toContain('data-gauntlet-zone="soul"');
    expect(markup).toContain('data-gauntlet-zone="reality"');
    expect(markup).toContain('data-gauntlet-zone="power"');
  });

  it("declares strict read-only contract markers", () => {
    const markup = renderPipeline();
    expect(markup).toContain('data-living-system-map="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
    expect(markup).toContain('data-recording-enabled="false"');
    expect(markup).toContain('data-voice-enabled="false"');
    expect(markup).toContain('data-export-enabled="false"');
    expect(markup).toContain('data-live-telemetry-subscribed="false"');
  });

  it("exposes no execution affordances anywhere in the markup", () => {
    for (const state of GAUNTLET_HUB_STATES) {
      const markup = renderPipeline(state);
      expect(markup).not.toMatch(/<button\b/i);
      expect(markup).not.toMatch(/<form\b/i);
      expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
      expect(markup).not.toMatch(/<a\b/i);
      expect(markup).not.toMatch(/\brole="button"/i);
    }
  });
});

describe("DD.3 /audit/gauntlet route", () => {
  it("mounts the pipeline under a <main> landmark with a skip link", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);
    expect(markup).toContain('data-audit-surface="gauntlet"');
    expect(markup).toContain('id="gauntlet-pipeline"');
    expect(markup).toContain('class="jarvis-skip-link"');
    expect(markup).toContain('data-gauntlet-pipeline="read-only"');
  });

  it("the route surfaces every Space node id", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);
    const ids = [
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
    ];
    for (const id of ids) {
      expect(markup).toContain(`data-gauntlet-node-id="${id}"`);
    }
  });

  it("the route exposes no execution, approval, or mutation controls", () => {
    const markup = renderToStaticMarkup(<GauntletPage />);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).toContain(
      'data-gauntlet-navigation-affordance="pan-zoom-focus"',
    );
    expect(markup).not.toMatch(/data-(execute|approve|mutation)-control/i);
    expect(markup).not.toMatch(/>\s*(Run|Send|Execute|Approve|Mutate)\s*</i);
  });
});
