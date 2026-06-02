import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createUnavailableVerificationConfidenceSurfaceViewModel,
  createVerificationConfidenceSurfaceViewModel,
} from "../../lib/verification-agent";
import { VerificationConfidenceSurface } from "./VerificationConfidenceSurface";

const COMPONENT_SOURCE =
  "src/components/verification-agent/VerificationConfidenceSurface.tsx";
const RAW_ANSWER_MARKER = "raw answer body must not render";
const RAW_VERIFIER_MARKER = "raw verifier body must not render";

function renderSurface(
  model = createVerificationConfidenceSurfaceViewModel({
    state: "verified",
    confidence: "medium",
    caveat: "The answer is supported, with source limits.",
    risk_flags: ["insufficient_sources", "overconfident_answer"],
  }),
) {
  return renderToStaticMarkup(<VerificationConfidenceSurface model={model} />);
}

function assertNoForbiddenAffordances(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<a\b/i);
  expect(html).not.toMatch(
    /\b(approve|approval|execute|dispatch|retry|run verification|rewrite answer)\b/i,
  );
}

describe("Phase 21A.5 Verification confidence surface", () => {
  it("renders confidence, caveat, risk flags, and advisory-only metadata", () => {
    const html = renderSurface();

    expect(html).toContain("Verification");
    expect(html).toContain("Advisory verification metadata");
    expect(html).toContain("Not a source of truth");
    expect(html).toContain("medium confidence");
    expect(html).toContain("The answer is supported, with source limits.");
    expect(html).toContain("insufficient sources");
    expect(html).toContain("overconfident answer");
    expect(html).toContain('data-verification-confidence-surface="verified"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-advisory-only="true"');
    assertNoForbiddenAffordances(html);
  });

  it("makes low confidence visually and semantically distinct", () => {
    const html = renderSurface(
      createVerificationConfidenceSurfaceViewModel({
        state: "unverified",
        confidence: "low",
        caveat: "Support is weak and the answer should be treated carefully.",
        risk_flags: ["unsupported_claim", "conflicting_context"],
      }),
    );

    expect(html).toContain('data-confidence="low"');
    expect(html).toContain('data-confidence-tone="danger"');
    expect(html).toContain("low confidence");
    expect(html).toContain("unsupported claim");
    expect(html).toContain("conflicting context");
    assertNoForbiddenAffordances(html);
  });

  it("renders unavailable and failed states clearly", () => {
    const unavailable = renderSurface(
      createUnavailableVerificationConfidenceSurfaceViewModel(
        "Verifier provider unavailable.",
      ),
    );
    const failed = renderSurface(
      createVerificationConfidenceSurfaceViewModel({
        state: "failed",
        confidence: "low",
        caveat: "Verifier failed closed.",
        risk_flags: ["model_disagreement"],
      }),
    );

    expect(unavailable).toContain(
      'data-verification-confidence-surface="unavailable"',
    );
    expect(unavailable).toContain("Verifier provider unavailable.");
    expect(unavailable).toContain("unknown confidence");
    expect(failed).toContain('data-verification-confidence-surface="failed"');
    expect(failed).toContain("Verifier failed closed.");
    expect(failed).toContain("model disagreement");
    assertNoForbiddenAffordances(unavailable);
    assertNoForbiddenAffordances(failed);
  });

  it("supports skipped and unverified states without raw answer bodies", () => {
    const html = renderSurface(
      createVerificationConfidenceSurfaceViewModel({
        state: "skipped",
        confidence: "unknown",
        caveat: "Verification skipped; no raw answer required.",
        risk_flags: [],
      }),
    );

    expect(html).toContain('data-verification-confidence-surface="skipped"');
    expect(html).toContain("Verification skipped; no raw answer required.");
    expect(html).toContain("none");
    expect(html).not.toContain(RAW_ANSWER_MARKER);
    expect(html).not.toContain(RAW_VERIFIER_MARKER);
    assertNoForbiddenAffordances(html);
  });

  it("does not render raw prompt, answer, verifier body, execution, or approval controls", () => {
    const html = renderSurface();
    const source = readFileSync(COMPONENT_SOURCE, "utf8");

    expect(html).not.toMatch(
      /raw_prompt|raw answer|raw verifier|prompt body|answer body|verifier body|model output/i,
    );
    expect(source).not.toMatch(
      /\b(onClick|button|form|href|approve|execute|dispatch|retry|rewrite)\b/i,
    );
    assertNoForbiddenAffordances(html);
  });
});
