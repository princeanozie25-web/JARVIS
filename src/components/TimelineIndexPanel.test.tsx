import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "@/lib/timeline";
import { TIMELINE_PROJECTION_NOTICE } from "../lib/timeline";
import { TimelineIndexPanel } from "./TimelineIndexPanel";

const entry: TimelineEntry = {
  id: "session_summary:hash-1",
  type: "session_summary",
  title: "Session summary session-1",
  summary: "User asked to keep timeline read-only.",
  timestamp: 2_000,
  source_id: "hash-1",
  source_label: "Session summary projection",
  projection_notice: TIMELINE_PROJECTION_NOTICE,
};

describe("TimelineIndexPanel", () => {
  it("renders chronological entries, type badges, filters, and projection notice", () => {
    const html = renderToStaticMarkup(
      <TimelineIndexPanel
        entries={[entry]}
        consentEnabled
        selectedType=""
        onTypeChange={() => undefined}
      />,
    );

    expect(html).toContain("Timeline Index");
    expect(html).toContain("Session Summary");
    expect(html).toContain("Project State");
    expect(html).toContain("Goal");
    expect(html).toContain("Preference");
    expect(html).toContain("Session summary session-1");
    expect(html).toContain("User asked to keep timeline read-only.");
    expect(html).toContain(TIMELINE_PROJECTION_NOTICE);
  });

  it("shows disabled consent state", () => {
    const html = renderToStaticMarkup(
      <TimelineIndexPanel
        entries={[]}
        consentEnabled={false}
        selectedType=""
        onTypeChange={() => undefined}
      />,
    );

    expect(html).toContain("Timeline is disabled until consent is enabled.");
    expect(html).toContain("No timeline projections available.");
  });
});
