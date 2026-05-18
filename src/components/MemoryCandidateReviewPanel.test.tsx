import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MemoryCandidateRow } from "@/lib/db/node";
import { MemoryCandidateReviewPanel } from "./MemoryCandidateReviewPanel";

const candidate: MemoryCandidateRow = {
  id: "cand-1",
  session_id: "session-1",
  source_message_ids_json: JSON.stringify(["m1"]),
  proposed_category: "decision",
  proposed_content: "Phase 3C.6 candidates remain drafts.",
  proposed_tags_json: JSON.stringify(["#phase3", "#memory"]),
  proposed_sensitivity: "personal",
  rationale: "The user explicitly set the boundary.",
  status: "draft",
  created_at: 2_000,
  reviewed_at: null,
};

describe("MemoryCandidateReviewPanel", () => {
  it("renders candidates for review", () => {
    const html = renderToStaticMarkup(
      <MemoryCandidateReviewPanel candidates={[candidate]} />,
    );

    expect(html).toContain("Memory Candidates");
    expect(html).toContain("1 candidates");
    expect(html).toContain("Phase 3C.6 candidates remain drafts.");
    expect(html).toContain("decision");
    expect(html).toContain("personal");
    expect(html).toContain("The user explicitly set the boundary.");
    expect(html).toContain("#phase3");
    expect(html).toContain("Accept");
    expect(html).toContain("Edit");
    expect(html).toContain("Reject");
  });

  it("shows an empty state", () => {
    const html = renderToStaticMarkup(
      <MemoryCandidateReviewPanel candidates={[]} />,
    );

    expect(html).toContain("No memory candidates generated yet.");
  });
});
