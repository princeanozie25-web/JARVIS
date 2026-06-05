import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Orb } from "./Orb";
import {
  ORB_ACTIVITY_DESCRIPTORS,
  ORB_ACTIVITY_STATES,
} from "./activity-states";

describe("UI.6 Orb — activity state rendering", () => {
  for (const state of ORB_ACTIVITY_STATES) {
    it(`renders the "${state}" state with data attributes from the descriptor`, () => {
      const html = renderToStaticMarkup(<Orb activityState={state} />);
      const descriptor = ORB_ACTIVITY_DESCRIPTORS[state];
      expect(html).toContain(`data-orb-activity-state="${descriptor.state}"`);
      expect(html).toContain(`data-orb-activity-tone="${descriptor.semantic}"`);
      expect(html).toContain(
        `data-orb-activity-animation="${descriptor.animation}"`,
      );
      expect(html).toContain(descriptor.label);
    });
  }

  it("defaults to idle when no activityState prop is provided", () => {
    const html = renderToStaticMarkup(<Orb />);
    expect(html).toContain('data-orb-activity-state="idle"');
    expect(html).toContain('data-orb-activity-tone="signal"');
    expect(html).toContain('data-orb-activity-animation="breathing"');
  });

  it("falls back to idle without crashing when given an unknown activity state", () => {
    const html = renderToStaticMarkup(<Orb activityState="not-a-real-state" />);
    expect(html).toContain('data-orb-activity-state="idle"');
    expect(html).not.toContain('data-orb-activity-state="not-a-real-state"');
  });

  it("emits the orb layer hooks the CSS state machine targets", () => {
    const html = renderToStaticMarkup(<Orb activityState="processing" />);
    expect(html).toContain('data-orb-layer="ring"');
    expect(html).toContain('data-orb-layer="sweep"');
    expect(html).toContain('data-orb-layer="core"');
  });
});
