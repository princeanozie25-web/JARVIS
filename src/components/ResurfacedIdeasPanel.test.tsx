import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  dismissSurfacedMemory,
  ResurfacedIdeasPanel,
  type SurfacedMemory,
  visibleSurfacedMemories,
} from "./ResurfacedIdeasPanel";

const memory: SurfacedMemory = {
  id: "mem-1",
  category: "decision",
  content: "Use hybrid retrieval for manual memory recall.",
  project: "jarvis",
  tags: ["#phase3", "#memory"],
  sensitivity: "personal",
  retrievalMode: "hybrid",
  score: {
    keywordRank: 1,
    vectorRank: 2,
    fusedScore: 0.032522,
    sourceType: "hybrid",
  },
};

describe("ResurfacedIdeasPanel", () => {
  it("renders returned memories with retrieval metadata", () => {
    const html = renderToStaticMarkup(
      <ResurfacedIdeasPanel memories={[memory]} />,
    );

    expect(html).toContain("Resurfaced Ideas");
    expect(html).toContain("Use hybrid retrieval for manual memory recall.");
    expect(html).toContain("decision");
    expect(html).toContain("project: jarvis");
    expect(html).toContain("#phase3");
    expect(html).toContain("personal");
    expect(html).toContain("mode: hybrid");
    expect(html).toContain("keyword: 1");
    expect(html).toContain("vector: 2");
    expect(html).toContain("fused: 0.032522");
  });

  it("dismiss hides a memory from the current view only", () => {
    const dismissed = dismissSurfacedMemory(new Set(), "mem-1");

    expect(visibleSurfacedMemories([memory], dismissed)).toEqual([]);
    expect(visibleSurfacedMemories([memory], new Set())).toEqual([memory]);
  });

  it("renders promote as a disabled placeholder", () => {
    const html = renderToStaticMarkup(
      <ResurfacedIdeasPanel memories={[memory]} />,
    );

    expect(html).toContain("Promote");
    expect(html).toContain("disabled");
    expect(html).toContain("Memory weighting will come later.");
  });

  it("does not mutate or delete memory rows when dismissed", () => {
    const memories = [memory];
    const dismissed = dismissSurfacedMemory(new Set(), memory.id);

    expect(memories).toHaveLength(1);
    expect(memories[0]).toEqual(memory);
    expect(dismissed.has(memory.id)).toBe(true);
  });
});
