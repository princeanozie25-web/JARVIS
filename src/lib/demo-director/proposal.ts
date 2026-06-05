/**
 * Demo Director proposal pipeline — DD.9.
 *
 * Pure, deterministic transformations:
 *   proposeDemo(audience)   → DemoProposal in "proposed" state
 *   appendToInbox(inbox, p) → new inbox with proposal added
 *   approveProposal(inbox, proposal_id) → inbox with that proposal "approved"
 *   denyProposal(inbox, proposal_id)    → inbox with that proposal "denied"
 *   isPlaybackEligible(p)   → true iff proposal status is "approved"
 *
 * No persistence. No side effects. No mutation of inputs. Every output
 * is a frozen value.
 */

import {
  type DemoAudience,
  type DemoProposal,
  type DemoProposalInbox,
} from "./contracts";
import { loadDemoScript } from "./fixtures";
import { parseDemoProposal } from "./schemas";

export const EMPTY_DEMO_PROPOSAL_INBOX: DemoProposalInbox = Object.freeze({
  inbox_id: "demo-director:suggestion-inbox",
  proposals: Object.freeze([]) as readonly DemoProposal[],
  metadata_only: true,
  read_only: true,
});

const AUDIENCE_SCRIPT_NAMES: Readonly<Record<DemoAudience, string>> = {
  recruiter: "recruiter",
  security: "security",
  technical: "technical",
  general: "general",
};

export interface ProposeDemoInput {
  audience: DemoAudience;
  /** Logical clock — caller-supplied so tests stay deterministic. */
  at_ms: number;
}

export function proposeDemo({
  audience,
  at_ms,
}: ProposeDemoInput): DemoProposal {
  const script = loadDemoScript(AUDIENCE_SCRIPT_NAMES[audience]);
  const proposal: DemoProposal = {
    proposal_id: `demo-proposal:${audience}:${at_ms}`,
    audience,
    status: "proposed",
    script,
    proposed_at_ms: at_ms,
    metadata_only: true,
    read_only: true,
  };
  return Object.freeze(parseDemoProposal(proposal)) as DemoProposal;
}

export function appendToInbox(
  inbox: DemoProposalInbox,
  proposal: DemoProposal,
): DemoProposalInbox {
  const next = Object.freeze([
    ...inbox.proposals,
    proposal,
  ]) as readonly DemoProposal[];
  return Object.freeze({
    inbox_id: inbox.inbox_id,
    proposals: next,
    metadata_only: true,
    read_only: true,
  } satisfies DemoProposalInbox);
}

function withStatus(
  inbox: DemoProposalInbox,
  proposal_id: string,
  status: "approved" | "denied",
): DemoProposalInbox {
  const next = inbox.proposals.map((proposal) =>
    proposal.proposal_id === proposal_id
      ? (Object.freeze({ ...proposal, status }) as DemoProposal)
      : proposal,
  );
  return Object.freeze({
    inbox_id: inbox.inbox_id,
    proposals: Object.freeze(next) as readonly DemoProposal[],
    metadata_only: true,
    read_only: true,
  } satisfies DemoProposalInbox);
}

export function approveProposal(
  inbox: DemoProposalInbox,
  proposal_id: string,
): DemoProposalInbox {
  return withStatus(inbox, proposal_id, "approved");
}

export function denyProposal(
  inbox: DemoProposalInbox,
  proposal_id: string,
): DemoProposalInbox {
  return withStatus(inbox, proposal_id, "denied");
}

export function findProposal(
  inbox: DemoProposalInbox,
  proposal_id: string,
): DemoProposal | null {
  return inbox.proposals.find((p) => p.proposal_id === proposal_id) ?? null;
}

export function isPlaybackEligible(proposal: DemoProposal): boolean {
  return proposal.status === "approved";
}
