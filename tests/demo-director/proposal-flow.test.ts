import { describe, expect, it } from "vitest";

import {
  EMPTY_DEMO_PROPOSAL_INBOX,
  appendToInbox,
  approveProposal,
  denyProposal,
  findProposal,
  isPlaybackEligible,
  proposeDemo,
} from "@/lib/demo-director";

describe("DD.9 proposal flow — Suggestion Inbox integration", () => {
  it("proposeDemo returns a frozen proposal in 'proposed' status", () => {
    const proposal = proposeDemo({ audience: "recruiter", at_ms: 0 });
    expect(proposal.status).toBe("proposed");
    expect(proposal.audience).toBe("recruiter");
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(proposal.proposal_id).toBe("demo-proposal:recruiter:0");
  });

  it("appendToInbox produces a new inbox without mutating the source", () => {
    const proposal = proposeDemo({ audience: "security", at_ms: 5 });
    const next = appendToInbox(EMPTY_DEMO_PROPOSAL_INBOX, proposal);
    expect(EMPTY_DEMO_PROPOSAL_INBOX.proposals).toHaveLength(0);
    expect(next.proposals).toHaveLength(1);
    expect(next.proposals[0]!.audience).toBe("security");
  });

  it("approveProposal transitions only the matching proposal", () => {
    const a = proposeDemo({ audience: "recruiter", at_ms: 0 });
    const b = proposeDemo({ audience: "security", at_ms: 1 });
    const inbox = appendToInbox(appendToInbox(EMPTY_DEMO_PROPOSAL_INBOX, a), b);
    const approved = approveProposal(inbox, b.proposal_id);
    const aAfter = findProposal(approved, a.proposal_id);
    const bAfter = findProposal(approved, b.proposal_id);
    expect(aAfter?.status).toBe("proposed");
    expect(bAfter?.status).toBe("approved");
  });

  it("denyProposal transitions only the matching proposal", () => {
    const proposal = proposeDemo({ audience: "general", at_ms: 0 });
    const inbox = appendToInbox(EMPTY_DEMO_PROPOSAL_INBOX, proposal);
    const denied = denyProposal(inbox, proposal.proposal_id);
    expect(findProposal(denied, proposal.proposal_id)?.status).toBe("denied");
  });

  it("findProposal returns null for unknown ids", () => {
    expect(findProposal(EMPTY_DEMO_PROPOSAL_INBOX, "missing")).toBeNull();
  });

  it("isPlaybackEligible only returns true for approved proposals", () => {
    const proposed = proposeDemo({ audience: "technical", at_ms: 0 });
    expect(isPlaybackEligible(proposed)).toBe(false);
    const inbox = approveProposal(
      appendToInbox(EMPTY_DEMO_PROPOSAL_INBOX, proposed),
      proposed.proposal_id,
    );
    const approved = findProposal(inbox, proposed.proposal_id)!;
    expect(isPlaybackEligible(approved)).toBe(true);
    const denied = denyProposal(inbox, proposed.proposal_id);
    expect(
      isPlaybackEligible(findProposal(denied, proposed.proposal_id)!),
    ).toBe(false);
  });

  it("the inbox identifier never drifts from the suggestion-inbox tag", () => {
    expect(EMPTY_DEMO_PROPOSAL_INBOX.inbox_id).toBe(
      "demo-director:suggestion-inbox",
    );
  });
});
