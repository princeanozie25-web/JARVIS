// FC-2 approval-time re-validation — unit invariants (24C-2b).
//
// The cross-check test pins the executor-side recompute to the gateway's
// computeCanonicalEffectHash so the two hashing paths can never drift (the
// executor never imports the gateway in production; this TEST imports both
// purely to assert byte-identical output).

import { describe, expect, it } from "vitest";

import {
  canonicalizeProposalRequest,
  computeCanonicalEffectHash,
  stableStringify,
  type ToolMetadata,
  type ToolMetadataLookup,
} from "../mcp-gateway";
import {
  recomputeCanonicalEffectHash,
  revalidateGatewayProposal,
} from "./approval-revalidation";
import type { ClassificationLookup } from "@/lib/canonical-policy";

const meta: ToolMetadata = {
  capability: "fs.create_file",
  reversibilityClass: "REVERSIBLE_WRITE",
  requiredSafetyTag: "CONFIRM_ONCE",
  proposalExposable: true,
  validateArgs: () => ({ ok: true }),
  deriveTarget: () => "/home/x/y.md",
};
const lookup: ToolMetadataLookup = () => meta;

function sampleEffect() {
  const canon = canonicalizeProposalRequest(
    { tool: "fs.create_file", args: { path: "/home/x/y.md" } },
    lookup,
  );
  if (!canon.ok) throw new Error(`canonicalize failed: ${canon.reason}`);
  return canon.canonical_effect;
}

describe("recomputeCanonicalEffectHash (parity with the gateway)", () => {
  it("matches the gateway's computeCanonicalEffectHash byte-for-byte", () => {
    const effect = sampleEffect();
    expect(recomputeCanonicalEffectHash(stableStringify(effect))).toBe(
      computeCanonicalEffectHash(effect),
    );
  });

  it("produces a hash:sha256:<64hex> reference", () => {
    expect(recomputeCanonicalEffectHash('{"a":1}')).toMatch(
      /^hash:sha256:[0-9a-f]{64}$/,
    );
  });

  it("is deterministic and input-sensitive", () => {
    expect(recomputeCanonicalEffectHash("x")).toBe(
      recomputeCanonicalEffectHash("x"),
    );
    expect(recomputeCanonicalEffectHash("x")).not.toBe(
      recomputeCanonicalEffectHash("y"),
    );
  });
});

describe("revalidateGatewayProposal", () => {
  const json = stableStringify(sampleEffect());
  const hash = recomputeCanonicalEffectHash(json);
  const FUTURE = 10_000;
  const NOW = 1_000;

  it("I-24C2b-4 (legacy): a null hash is 'legacy' (proceed unchanged)", () => {
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: null,
          canonical_effect_json: null,
          expires_at: null,
        },
        NOW,
      ),
    ).toEqual({ kind: "legacy" });
  });

  it("I-24C2b-3 (valid): a matching hash + unexpired is ok", () => {
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: hash,
          canonical_effect_json: json,
          expires_at: FUTURE,
        },
        NOW,
      ),
    ).toEqual({ kind: "ok" });
  });

  it("I-24C2b-1 (hash drift): a json that no longer hashes to the stored hash denies", () => {
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: hash,
          canonical_effect_json: `${json} DRIFTED`,
          expires_at: FUTURE,
        },
        NOW,
      ),
    ).toEqual({ kind: "deny", reason: "hash_mismatch" });
  });

  it("I-24C2b-2 (expiry): past expires_at denies", () => {
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: hash,
          canonical_effect_json: json,
          expires_at: 500,
        },
        NOW,
      ),
    ).toEqual({ kind: "deny", reason: "expired" });
  });

  it("I-24C2b-6 (fail-closed): a claimed gateway proposal with a blank hash denies", () => {
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: "",
          canonical_effect_json: json,
          expires_at: FUTURE,
        },
        NOW,
      ),
    ).toEqual({ kind: "deny", reason: "hash_missing" });
  });

  it("I-24C2b-6 (fail-closed): a hash present but missing frozen serialization denies", () => {
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: hash,
          canonical_effect_json: null,
          expires_at: FUTURE,
        },
        NOW,
      ),
    ).toEqual({ kind: "deny", reason: "effect_missing" });
  });
});

// ===========================================================================
// 24D-2b — registry-drift re-check at the decision point (closes E-016)
//
// The hash proves the effect is UNCHANGED; these prove it is also STILL VALID
// against CURRENT policy. `classify` is injected to simulate drift between
// queueing and approval. The frozen sample effect is fs.create_file @ tier
// confirm_once (its live classification), so the default path stays "ok".
// ===========================================================================
describe("revalidateGatewayProposal — registry-drift re-check (24D-2b)", () => {
  const json = stableStringify(sampleEffect()); // capability fs.create_file
  const hash = recomputeCanonicalEffectHash(json);
  const NOW = 1_000;
  const FUTURE = 10_000;
  const row = {
    canonical_effect_hash: hash,
    canonical_effect_json: json,
    expires_at: FUTURE,
  };

  it("I-24D2b-5 (no drift): with the live policy unchanged, a hash-valid proposal proceeds", () => {
    // default classify = the live canonical-policy map; fs.create_file is still
    // exposable @ confirm_once, so the re-check passes and the outcome is ok.
    expect(revalidateGatewayProposal(row, NOW)).toEqual({ kind: "ok" });
  });

  it("I-24D2b-6 (drift: declassified): a capability no longer classified denies tool_declassified", () => {
    const classifyNone: ClassificationLookup = () => null;
    expect(revalidateGatewayProposal(row, NOW, classifyNone)).toEqual({
      kind: "deny",
      reason: "tool_declassified",
    });
  });

  it("I-24D2b-6 (drift: hidden): a capability flipped mcp_exposable:false denies tool_declassified", () => {
    const classifyHidden: ClassificationLookup = () => ({
      mcp_exposable: false,
      proposal_allowed: true,
      required_scope: "fs.write",
      required_approval_tier: "confirm_once",
    });
    expect(revalidateGatewayProposal(row, NOW, classifyHidden)).toEqual({
      kind: "deny",
      reason: "tool_declassified",
    });
  });

  it("I-24D2b-7 (drift: tier tightened): a tightened approval tier denies approval_policy_changed", () => {
    const classifyTightened: ClassificationLookup = () => ({
      mcp_exposable: true,
      proposal_allowed: true,
      required_scope: "fs.write",
      required_approval_tier: "confirm_always", // was confirm_once at freeze
    });
    expect(revalidateGatewayProposal(row, NOW, classifyTightened)).toEqual({
      kind: "deny",
      reason: "approval_policy_changed",
    });
  });

  it("I-24D2b-8 (ordering): the hash check fires BEFORE the policy re-check", () => {
    // even with a declassifying policy, a DRIFTED hash denies on hash_mismatch —
    // the re-check only inspects a hash-verified blob, never an unverified one.
    const classifyNone: ClassificationLookup = () => null;
    expect(
      revalidateGatewayProposal(
        { ...row, canonical_effect_json: `${json} DRIFTED` },
        NOW,
        classifyNone,
      ),
    ).toEqual({ kind: "deny", reason: "hash_mismatch" });
  });

  it("I-24D2b-8 (effect_unparsable): a hash-matched but non-JSON effect denies", () => {
    const garbage = "not-json{";
    const garbageHash = recomputeCanonicalEffectHash(garbage);
    expect(
      revalidateGatewayProposal(
        {
          canonical_effect_hash: garbageHash,
          canonical_effect_json: garbage,
          expires_at: FUTURE,
        },
        NOW,
      ),
    ).toEqual({ kind: "deny", reason: "effect_unparsable" });
  });
});
