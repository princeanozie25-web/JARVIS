import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TelemetryCockpitPage from "./page";

const forbiddenRenderedAffordancePattern =
  /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i;

const forbiddenRenderedPayloadPattern =
  /raw_payload|tool_args|raw_prompt|model output|voice transcript|transcript|ocr text|frame bytes|secret|approval token/i;

describe("Phase 19B.4 audit telemetry cockpit route", () => {
  it("/audit/telemetry-cockpit renders the read-only telemetry cockpit explorer", () => {
    const html = renderToStaticMarkup(<TelemetryCockpitPage />);

    expect(html).toContain('data-telemetry-cockpit-viewer="read-only"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Telemetry Cockpit");
    expect(html).toContain("Cockpit Warnings");
    expect(html).toContain("Panel Summaries");
    expect(html).toContain("Panel Inspection");
    expect(html).toContain("Search panels");
    expect(html).toContain("Panel kind");
    expect(html).toContain("Health band");
    expect(html).toContain("Architecture Graph");
    expect(html).not.toMatch(forbiddenRenderedAffordancePattern);
    expect(html).not.toMatch(forbiddenRenderedPayloadPattern);
  });
});
