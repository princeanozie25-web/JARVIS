import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HumanReviewItem } from "@/lib/human-review";
import { HumanReviewQueuePanel } from "./HumanReviewQueuePanel";

const pendingItem: HumanReviewItem = {
  id: "memory_candidate:cand-1",
  item_type: "memory_candidate",
  title: "Memory candidate: decision",
  summary: "Candidate content to review.",
  source_id: "cand-1",
  source_type: "memory_candidate",
  status: "pending",
  created_at: 1_000,
  updated_at: 1_000,
  provenance: {
    session_id: "session-1",
    source_message_ids: ["m1"],
    proposed_sensitivity: "personal",
  },
  decision_reason: null,
};

const dismissedItem: HumanReviewItem = {
  id: "curator_audit:audit-1",
  item_type: "curator_audit",
  title: "Curator action: curator_archive",
  summary: "manual curation: archive",
  source_id: "audit-1",
  source_type: "curator_audit",
  status: "dismissed",
  created_at: 2_000,
  updated_at: 3_000,
  provenance: {
    target_type: "candidate",
    target_ids: ["cand-1"],
  },
  decision_reason: "Reviewed.",
};

describe("HumanReviewQueuePanel", () => {
  it("renders pending inbox, history, provenance, and manual controls", () => {
    const html = renderToStaticMarkup(
      <HumanReviewQueuePanel
        items={[pendingItem, dismissedItem]}
        consentEnabled
        onUpdateStatus={() => undefined}
        onDismiss={() => undefined}
      />,
    );

    expect(html).toContain("Human Review Queue");
    expect(html).toContain("Manual inbox only");
    expect(html).toContain("Pending Review Inbox");
    expect(html).toContain("Review History");
    expect(html).toContain("Candidate content to review.");
    expect(html).toContain("curator_audit:audit-1");
    expect(html).toContain("Provenance:");
    expect(html).toContain("Accept Review");
    expect(html).toContain("Reject Review");
    expect(html).toContain("Dismiss");
  });

  it("shows disabled consent state and empty inbox copy", () => {
    const html = renderToStaticMarkup(
      <HumanReviewQueuePanel
        items={[]}
        consentEnabled={false}
        onUpdateStatus={() => undefined}
        onDismiss={() => undefined}
      />,
    );

    expect(html).toContain(
      "Human Review Queue is disabled until consent is enabled.",
    );
    expect(html).toContain("No pending review items.");
    expect(html).toContain("No accepted, rejected, or dismissed review items.");
  });
});
