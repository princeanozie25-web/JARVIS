import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MemoryWeightingProjection } from "@/lib/memory-weighting";
import { MemoryWeightingPreviewPanel } from "./MemoryWeightingPreviewPanel";

const weight: MemoryWeightingProjection = {
  item_id: "mem-1",
  item_type: "long_term_memory",
  base_score: 1,
  recency_score: 0.5,
  pin_score: 0,
  usage_score: 0.2,
  final_weight: 1.7,
  explanation:
    "preview only / not applied to retrieval; base=1 recency=0.5 pinned=false usage_count=2",
};

describe("MemoryWeightingPreviewPanel", () => {
  it("renders weighted items, scores, explanation, and preview-only label", () => {
    const html = renderToStaticMarkup(
      <MemoryWeightingPreviewPanel
        weights={[weight]}
        consentEnabled
        selectedItemType=""
        onItemTypeChange={() => undefined}
      />,
    );

    expect(html).toContain("Memory Weighting Preview");
    expect(html).toContain("Preview only / not applied to retrieval");
    expect(html).toContain("Long-Term Memory");
    expect(html).toContain("Memory Candidate");
    expect(html).toContain("mem-1");
    expect(html).toContain("1.7");
    expect(html).toContain("usage_count=2");
  });

  it("shows disabled consent state", () => {
    const html = renderToStaticMarkup(
      <MemoryWeightingPreviewPanel
        weights={[]}
        consentEnabled={false}
        selectedItemType=""
        onItemTypeChange={() => undefined}
      />,
    );

    expect(html).toContain(
      "Memory weighting is disabled until consent is enabled.",
    );
    expect(html).toContain("No memory weights available.");
  });
});
