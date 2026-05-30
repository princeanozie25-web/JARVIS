import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GovernanceBoundariesPage from "./page";

const forbiddenRenderedAffordancePattern =
  /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i;

const forbiddenRenderedPayloadPattern =
  /raw_payload|tool_args|raw_prompt|model output|voice transcript|ocr text|frame bytes|secret|approval token/i;

describe("Phase 19C.4 audit governance boundaries route", () => {
  it("/audit/governance-boundaries renders the read-only governance visualizer", () => {
    const html = renderToStaticMarkup(<GovernanceBoundariesPage />);

    expect(html).toContain('data-governance-boundary-viewer="read-only"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Governance Boundaries");
    expect(html).toContain("Subsystem Nodes");
    expect(html).toContain("Boundary Edges");
    expect(html).toContain("Find boundary");
    expect(html).toContain("Node Inspection");
    expect(html).toContain("Edge Inspection");
    expect(html).toContain("Tripwire Warnings");
    expect(html).toContain("Boundary Warnings");
    expect(html).not.toMatch(forbiddenRenderedAffordancePattern);
    expect(html).not.toMatch(forbiddenRenderedPayloadPattern);
  });
});
