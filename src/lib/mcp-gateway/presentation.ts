// MCP gateway — proposal presentation projection (24C-3): injection containment.
//
// THE THREATS (content injection): a client cannot author the EFFECT (FC-1/FC-2),
// but a client CAN attach free-text (a note/reason, or raw args surfaced for
// context). If that text reached a human-facing surface as the proposal's TRUTH,
// it could socially-engineer the approver (EoP-3), be spoken by JARVIS as its own
// recommendation (EoP-11), or be laundered through an aux summary (EoP-15).
//
// THE DEFENSE (structural separation, proven in DATA): this projection splits a
// proposal into TWO channels —
//   trusted{}              : the server-derived canonical effect + hash + risk +
//                            tier + target + summary. THE DECISION ANCHOR.
//   untrusted_client_text  : the client string, FENCED + LABELLED + render-hardened.
// The two never merge. Every consumer (presentation, voice, aux) reads the trusted
// channel for truth; the untrusted channel is always labelled untrusted and is
// never spoken/summarized AS the proposal's recommendation.
//
// NOTE: FC-1 already keeps client text OUT of the canonical effect (args are
// masked into a structural target). This projection covers the case where client
// text is surfaced ALONGSIDE the proposal for human context — proving it stays
// fenced. Final pixels are the UI capstone's job (EoP-11 binds it cross-phase);
// here we encode the render REQUIREMENT in the data.
//
// GATE-2: imports only local gateway TYPES (erased at runtime) — zero runtime
// dependencies, no mutator tree. (The leaf sanitizer is applied to the trusted
// channel by consumers/drills; the projection itself stays pure.)

import type {
  CanonicalApprovalTier,
  CanonicalEffect,
  CanonicalRiskClass,
} from "./canonicalize";
import type { CanonicalProposal } from "./proposal";

export const UNTRUSTED_CLIENT_TEXT_LABEL = "UNTRUSTED_CLIENT_INPUT" as const;
/** Untrusted client text is length-limited before it can reach any surface. */
export const UNTRUSTED_CLIENT_TEXT_MAX_LENGTH = 2000;

/** The TRUSTED channel — entirely server-derived. The human's decision anchors
 * here, never to the client's framing. */
export interface TrustedProposalChannel {
  client_id: string; // server-derived provenance (identity seam), not client body
  canonical_effect: CanonicalEffect;
  canonical_effect_hash: string;
  risk_class: CanonicalRiskClass;
  approval_tier: CanonicalApprovalTier;
  target: string;
  side_effect_summary: string;
}

/** Render-hardening the UI capstone MUST honor for untrusted text. Encoded here
 * so the requirement travels with the data even though final pixels are the
 * capstone's job (EoP-11). */
export interface UntrustedRenderHardening {
  escape_html: true;
  allow_markdown: false;
  allow_links: false;
  monospace: true;
  unicode_normalized: true;
  control_chars_stripped: true;
  truncated: boolean;
  max_length: number;
}

/** The UNTRUSTED channel — client free-text, fenced + labelled + hardened. */
export interface UntrustedClientText {
  /** Unicode-normalized, control/bidi-stripped, length-limited form. */
  value: string;
  /** `value` additionally HTML-escaped — safe for any future render (no live
   * markup, no executable control sequences). */
  sanitized: string;
  label: typeof UNTRUSTED_CLIENT_TEXT_LABEL;
  render_as: "untrusted";
  render_hardening: UntrustedRenderHardening;
}

export interface ProposalPresentation {
  trusted: TrustedProposalChannel;
  untrusted_client_text: UntrustedClientText | null;
}

/** The classic spoof toolkit: C0/C1 controls + DEL, zero-width chars, the BOM,
 * and bidi embeddings/overrides/isolates (RTL-override attacks). Matched by
 * numeric code point — no literal control chars in source. */
function isDangerousCodePoint(cp: number): boolean {
  return (
    (cp >= 0x00 && cp <= 0x1f) || // C0 controls (incl. newlines/tabs)
    (cp >= 0x7f && cp <= 0x9f) || // DEL + C1 controls
    (cp >= 0x200b && cp <= 0x200f) || // zero-width + LRM/RLM
    (cp >= 0x202a && cp <= 0x202e) || // bidi embeddings/overrides
    (cp >= 0x2066 && cp <= 0x2069) || // bidi isolates
    cp === 0xfeff // BOM / zero-width no-break space
  );
}

function stripDangerousChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && !isDangerousCodePoint(cp)) out += ch;
  }
  return out;
}

function hardenUntrustedText(raw: string): {
  value: string;
  sanitized: string;
  truncated: boolean;
} {
  const normalized = stripDangerousChars(raw.normalize("NFC"));
  const truncated = normalized.length > UNTRUSTED_CLIENT_TEXT_MAX_LENGTH;
  const value = truncated
    ? normalized.slice(0, UNTRUSTED_CLIENT_TEXT_MAX_LENGTH)
    : normalized;
  const sanitized = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return { value, sanitized, truncated };
}

/**
 * Build the two-channel presentation of a proposal. The trusted channel is the
 * server-derived effect; `clientText` (if any) is fenced into the untrusted
 * channel — NEVER merged into the trusted channel or the summary.
 */
export function buildProposalPresentation(
  proposal: CanonicalProposal,
  clientText: string | null = null,
): ProposalPresentation {
  const effect = proposal.canonical_effect;
  const trusted: TrustedProposalChannel = {
    client_id: proposal.client_id,
    canonical_effect: effect,
    canonical_effect_hash: proposal.canonical_effect_hash,
    risk_class: effect.risk_class,
    approval_tier: effect.approval_tier,
    target: effect.target,
    side_effect_summary: effect.side_effect_summary,
  };

  let untrusted: UntrustedClientText | null = null;
  if (typeof clientText === "string" && clientText.length > 0) {
    const { value, sanitized, truncated } = hardenUntrustedText(clientText);
    untrusted = {
      value,
      sanitized,
      label: UNTRUSTED_CLIENT_TEXT_LABEL,
      render_as: "untrusted",
      render_hardening: {
        escape_html: true,
        allow_markdown: false,
        allow_links: false,
        monospace: true,
        unicode_normalized: true,
        control_chars_stripped: true,
        truncated,
        max_length: UNTRUSTED_CLIENT_TEXT_MAX_LENGTH,
      },
    };
  }

  return { trusted, untrusted_client_text: untrusted };
}

/**
 * EoP-11. The string JARVIS would SPEAK/announce for a proposal — built from the
 * TRUSTED channel ONLY. It may, at most, announce that untrusted text EXISTS
 * (clearly fenced); it NEVER speaks the untrusted text as a recommendation.
 * (Data-layer string; no audio synthesis here — the voice stack consumes this.)
 */
export function proposalToSpeechString(
  presentation: ProposalPresentation,
): string {
  const t = presentation.trusted;
  const base =
    `Client ${t.client_id} submitted a proposal. ` +
    `Canonical effect: ${t.side_effect_summary}. ` +
    `Risk ${t.risk_class}; approval tier ${t.approval_tier}.`;
  if (presentation.untrusted_client_text === null) return base;
  return (
    `${base} The client also attached untrusted text; it is not part of this ` +
    `recommendation and is shown fenced for review.`
  );
}

/** EoP-15 aux summary result — stays LABELLED untrusted and never replaces the
 * server-derived canonical effect / risk. */
export interface AuxUntrustedSummary {
  summary_of_untrusted: string | null;
  label: typeof UNTRUSTED_CLIENT_TEXT_LABEL;
  render_as: "untrusted";
  /** Carried UNCHANGED from the trusted channel — the summary does not alter them. */
  canonical_effect_hash: string;
  risk_class: CanonicalRiskClass;
  replaces_canonical: false;
}

/** An injected aux summarizer (a model call in production; a stub in drills). It
 * runs ONLY on the untrusted text and its output stays untrusted. */
export type UntrustedSummarizer = (untrustedText: string) => string;

/**
 * EoP-15. Summarize the UNTRUSTED channel (only). The result is labelled
 * untrusted, does NOT replace canonical_effect / side_effect_summary, and does
 * NOT alter the server-derived risk_class — those are carried through unchanged.
 */
export function summarizeUntrustedClientText(
  presentation: ProposalPresentation,
  summarize: UntrustedSummarizer,
): AuxUntrustedSummary {
  const untrusted = presentation.untrusted_client_text;
  return {
    summary_of_untrusted: untrusted ? summarize(untrusted.value) : null,
    label: UNTRUSTED_CLIENT_TEXT_LABEL,
    render_as: "untrusted",
    canonical_effect_hash: presentation.trusted.canonical_effect_hash,
    risk_class: presentation.trusted.risk_class,
    replaces_canonical: false,
  };
}
