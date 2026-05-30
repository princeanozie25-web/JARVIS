import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ArchitectureGraphPage from "./page";

describe("Phase 19A.7 audit architecture graph route", () => {
  it("/audit/architecture-graph renders the read-only graph viewer", () => {
    const html = renderToStaticMarkup(<ArchitectureGraphPage />);

    expect(html).toContain('data-architecture-graph-viewer="read-only"');
    expect(html).toContain("Architecture Graph");
    expect(html).toContain("Tripwire Warnings");
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain('data-architecture-graph-controls="safe-read-only"');
    expect(html).toContain("Selected node");
    expect(html).not.toMatch(
      /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i,
    );
  });
});
