// FC-2 + GATE-5 invariants I-24C2-1 .. I-24C2-8 (24C-2).
//
// The enqueue boundary is the entire security surface of this slice: it accepts
// ONLY a fully server-built canonical proposal and rejects every client-authored
// field. Persistence is proven through the REAL db createPendingApproval path
// over an in-memory better-sqlite3 database (tests may import db/ — the GATE-2
// walk only roots at the gateway, never at test files).

import Database from "better-sqlite3";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyMigrations } from "@/lib/db/schema";
import { createPendingApproval, getApprovalById } from "@/lib/db/approvals";
import {
  ApprovalProposalContractSchema,
  validateApprovalProposalContract,
} from "@/lib/approval-runtime";

import {
  buildCanonicalProposal,
  canonicalizeProposalRequest,
  computeCanonicalEffectHash,
  enqueueCanonicalProposal,
  findForbiddenFields,
  submitProposalRequest,
  type CanonicalEffect,
  type CanonicalProposal,
  type EnqueueProposal,
  type ToolMetadata,
  type ToolMetadataLookup,
} from "./index";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
const writeArgs = z.object({ path: z.string().min(1), content: z.string() });
const writeMeta: ToolMetadata = {
  capability: "fs.create_file",
  reversibilityClass: "REVERSIBLE_WRITE",
  requiredSafetyTag: "CONFIRM_ONCE",
  proposalExposable: true,
  validateArgs: (a) =>
    writeArgs.safeParse(a).success ? { ok: true } : { ok: false },
  deriveTarget: (a) => writeArgs.parse(a).path,
};
const lookup: ToolMetadataLookup = (id) =>
  id === "fs.create_file" ? writeMeta : null;

const CLIENT_ID = "mcp-client:aaaaaaaaaaaaaaaa";
const NOW = 1_000_000;
const TTL = 300_000;

function effectFor(path: string): CanonicalEffect {
  const canon = canonicalizeProposalRequest(
    { tool: "fs.create_file", args: { path, content: "hello" } },
    lookup,
  );
  if (!canon.ok) throw new Error(`canonicalize failed: ${canon.reason}`);
  return canon.canonical_effect;
}

function serverProposal(
  path = "/home/owner/n.md",
  proposal_id = "proposal:test01",
): CanonicalProposal {
  return buildCanonicalProposal({
    canonical_effect: effectFor(path),
    client_id: CLIENT_ID,
    now_ms: NOW,
    ttl_ms: TTL,
    proposal_id,
  });
}

const noopEnqueue: EnqueueProposal = (p) => ({ proposal_id: p.proposal_id });

// Host-side adapter: maps a canonical proposal onto the REAL createPendingApproval
// path. Lives in the test (the host wires this OUTSIDE the gateway graph).
function realEnqueue(db: Database.Database): EnqueueProposal {
  return (proposal) => {
    createPendingApproval(db, {
      id: proposal.proposal_id,
      execution_id: proposal.proposal_id,
      session_id: proposal.client_id,
      tool_id: proposal.canonical_effect.tool_id,
      scope_hash: proposal.scope_snapshot_ref_hash,
      created_at: proposal.created_at_ms,
      ttl_ms: proposal.expires_at_ms - proposal.created_at_ms,
      canonical_effect_hash: proposal.canonical_effect_hash,
      scope_snapshot_hash: proposal.scope_snapshot_ref_hash,
    });
    return { proposal_id: proposal.proposal_id };
  };
}

const GATEWAY_DIR = dirname(fileURLToPath(import.meta.url));
const readSrc = (name: string): string =>
  readFileSync(resolve(GATEWAY_DIR, name), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "");

// frozen approval-runtime contract builders (mirrors approval-lifecycle-contract.test.ts)
function replay() {
  return {
    schema_version: "approval-runtime.v18a1",
    replay_safe: true,
    local_first: true,
    deterministic_replay_key_hash: "hash:approval-replay-key",
    source_event_hash: "hash:source-event",
    originating_session_hash: "hash:session",
    sequence_index: 0,
  };
}
function redaction() {
  return {
    redaction_status: "metadata_only",
    redaction_safe: true,
    metadata_only: true,
    raw_payload_included: false,
    raw_tool_arguments_included: false,
    raw_execution_command_included: false,
    secret_material_included: false,
    pii_included: false,
  };
}
function guard() {
  return {
    contract_only: true,
    metadata_only: true,
    lifecycle_processor_supported: false,
    approval_creation_supported: false,
    approval_decision_supported: false,
    execution_supported: false,
    verification_supported: false,
    compensation_execution_supported: false,
    persistence_supported: false,
    event_store_integration_supported: false,
    ui_integration_supported: false,
    tool_runtime_integration_supported: false,
    adapter_integration_supported: false,
    scheduler_supported: false,
    network_allowed: false,
    cloud_allowed: false,
  };
}
function baseContract(): Record<string, unknown> {
  return {
    contract_version: "18A.1",
    proposal_id: "proposal:phase18a1-review",
    approval_id: null,
    proposal_kind: "tool_write",
    risk_class: "medium",
    source_ref_hash: "hash:source-ref",
    subject_ref_hash: "hash:subject-ref",
    dry_run_preview_ref_hash: "hash:dry-run-preview",
    created_at_ms: 1_000,
    expires_at_ms: 301_000,
    replay: replay(),
    redaction: redaction(),
    guard: guard(),
  };
}

// ===========================================================================
// I-24C2-1 — server-computed hash
// ===========================================================================
describe("I-24C2-1 (server hash): canonical_effect_hash is a server digest", () => {
  it("same effect -> same hash; different effect -> different hash", () => {
    const a = effectFor("/a/note.md");
    const b = effectFor("/b/other.md"); // same shape -> same masked target/effect
    const c = effectFor("/a/note.txt"); // .txt -> different masked target
    expect(computeCanonicalEffectHash(a)).toBe(computeCanonicalEffectHash(b));
    expect(computeCanonicalEffectHash(a)).not.toBe(
      computeCanonicalEffectHash(c),
    );
  });

  it("the hash is a hash:sha256:<64hex> reference", () => {
    const p = serverProposal();
    expect(p.canonical_effect_hash).toMatch(/^hash:sha256:[0-9a-f]{64}$/);
    expect(p.scope_snapshot_ref_hash).toMatch(/^hash:sha256:[0-9a-f]{64}$/);
  });

  it("a client-supplied (forged) hash is rejected at the enqueue boundary", () => {
    const forged = {
      ...serverProposal(),
      canonical_effect_hash: `hash:sha256:${"0".repeat(64)}`,
    };
    expect(enqueueCanonicalProposal(forged, noopEnqueue)).toEqual({
      ok: false,
      reason: "hash_mismatch",
    });
  });
});

// ===========================================================================
// I-24C2-2 — GATE-5 needle's eye
// ===========================================================================
describe("I-24C2-2 (GATE-5): the enqueue boundary rejects every client-authored field", () => {
  it("ONLY the exact server-built proposal passes", () => {
    expect(enqueueCanonicalProposal(serverProposal(), noopEnqueue)).toEqual({
      ok: true,
      proposal_id: "proposal:test01",
    });
  });

  it("rejects an extra status / approval / decision / metadata field", () => {
    for (const extra of [
      { status: "approved" },
      { approval: { decided: true } },
      { decision: "APPROVED_ONCE" },
      { metadata: { anything: true } },
      { state: "approved" },
    ]) {
      const res = enqueueCanonicalProposal(
        { ...serverProposal(), ...extra },
        noopEnqueue,
      );
      expect(res, JSON.stringify(extra)).toEqual({
        ok: false,
        reason: "malformed_proposal",
      });
    }
  });

  it("rejects a client-injected effect field (effect schema is strict)", () => {
    const p = serverProposal();
    const tampered = {
      ...p,
      canonical_effect: { ...p.canonical_effect, risk_override: "low" },
    };
    expect(enqueueCanonicalProposal(tampered, noopEnqueue)).toEqual({
      ok: false,
      reason: "malformed_proposal",
    });
  });

  it("rejects a forged scope-snapshot hash", () => {
    const forged = {
      ...serverProposal(),
      scope_snapshot_ref_hash: `hash:sha256:${"f".repeat(64)}`,
    };
    expect(enqueueCanonicalProposal(forged, noopEnqueue)).toEqual({
      ok: false,
      reason: "scope_hash_mismatch",
    });
  });

  it("the submit pipeline rejects a raw request carrying client-authored fields (FC-1/GATE-3)", () => {
    for (const extra of [
      { client_id: "attacker" },
      { risk_class: "low" },
      { canonical_effect_hash: "hash:x" },
      { canonical_effect: {} },
    ]) {
      const res = submitProposalRequest(
        {
          tool: "fs.create_file",
          args: { path: "/a/b.md", content: "x" },
          ...extra,
        },
        {
          lookup,
          clientId: CLIENT_ID,
          enqueue: noopEnqueue,
          now_ms: NOW,
          ttl_ms: TTL,
        },
      );
      expect(res.ok, JSON.stringify(extra)).toBe(false);
      if (!res.ok) {
        expect(res.stage).toBe("canonicalize");
        expect(res.reason).toBe("malformed_request");
      }
    }
  });
});

// ===========================================================================
// I-24C2-3 — additive contract mapping (per GATE-1)
// ===========================================================================
describe("I-24C2-3 (additive contract): maps onto the frozen contract via optional fields only", () => {
  it("the contract now carries the two additive OPTIONAL hash fields", () => {
    expect(
      ApprovalProposalContractSchema.shape.canonical_effect_hash,
    ).toBeDefined();
    expect(
      ApprovalProposalContractSchema.shape.scope_snapshot_ref_hash,
    ).toBeDefined();
  });

  it("a contract WITHOUT the new fields is still valid (optional, no existing field altered)", () => {
    expect(validateApprovalProposalContract(baseContract())).toMatchObject({
      valid: true,
      reason: "valid_contract",
    });
  });

  it("a contract carrying the FC-2 hashes validates", () => {
    const p = serverProposal();
    const withHashes = {
      ...baseContract(),
      canonical_effect_hash: p.canonical_effect_hash,
      scope_snapshot_ref_hash: p.scope_snapshot_ref_hash,
    };
    expect(validateApprovalProposalContract(withHashes)).toMatchObject({
      valid: true,
      reason: "valid_contract",
    });
  });

  it("the FC-2 hash is shaped to ride the contract's hash field", () => {
    expect(serverProposal().canonical_effect_hash).toMatch(
      /^hash:[a-z0-9._:-]+$/,
    );
  });
});

// ===========================================================================
// I-24C2-4 — provenance (EoP-5)
// ===========================================================================
describe("I-24C2-4 (provenance / EoP-5): no server client_id => no queue", () => {
  it("submit with a null identity is rejected at the provenance stage", () => {
    const res = submitProposalRequest(
      { tool: "fs.create_file", args: { path: "/a/b.md", content: "x" } },
      {
        lookup,
        clientId: null,
        enqueue: noopEnqueue,
        now_ms: NOW,
        ttl_ms: TTL,
      },
    );
    expect(res).toEqual({
      ok: false,
      stage: "provenance",
      reason: "no_provenance",
    });
  });

  it("the enqueue boundary rejects a blank-client_id proposal", () => {
    expect(
      enqueueCanonicalProposal(
        { ...serverProposal(), client_id: "" },
        noopEnqueue,
      ),
    ).toEqual({ ok: false, reason: "no_provenance" });
  });
});

// ===========================================================================
// I-24C2-5 — pending only; no execution path
// ===========================================================================
describe("I-24C2-5 (pending only): the proposal sits pending; no execution", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(":memory:");
    applyMigrations(db);
  });
  afterEach(() => db.close());

  it("an enqueued proposal lands in state 'pending' / decision 'PENDING'", () => {
    const res = submitProposalRequest(
      { tool: "fs.create_file", args: { path: "/a/b.md", content: "x" } },
      {
        lookup,
        clientId: CLIENT_ID,
        enqueue: realEnqueue(db),
        now_ms: NOW,
        ttl_ms: TTL,
        proposal_id: "proposal:pending01",
      },
    );
    expect(res.ok).toBe(true);
    const row = getApprovalById(db, "proposal:pending01");
    expect(row?.state).toBe("pending");
    expect(row?.decision).toBe("PENDING");
  });

  it("neither gateway write module references runTool / approve / execute / decision", () => {
    for (const file of ["proposal.ts", "enqueue.ts"]) {
      const code = readSrc(file);
      expect(/\.runTool\s*\(/.test(code), file).toBe(false);
      expect(/\bapproveApproval\b|\bdecideApproval\b/.test(code), file).toBe(
        false,
      );
      expect(/\bexecute\s*\(/.test(code), file).toBe(false);
    }
  });
});

// ===========================================================================
// I-24C2-6 — GATE-2 still green (structural leaf)
// ===========================================================================
describe("I-24C2-6 (GATE-2 leaf): the write modules import no mutator tree", () => {
  const ALLOWED = new Set([
    "node:crypto",
    "zod",
    "./sanitizer",
    "./canonicalize",
    "./proposal",
    "./scope",
  ]);
  it("proposal.ts + enqueue.ts only import the allowed gateway/leaf modules", () => {
    for (const file of ["proposal.ts", "enqueue.ts"]) {
      const froms = [
        ...readSrc(file).matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ].map((m) => m[1]);
      for (const f of froms) {
        expect(ALLOWED.has(f), `${file} -> ${f}`).toBe(true);
      }
    }
  });

  it("references no denied tree", () => {
    for (const file of ["proposal.ts", "enqueue.ts"]) {
      const code = readSrc(file);
      for (const denied of [
        "lib/db",
        "approval-runtime",
        "lib/tools",
        "lib/chat",
        "lib/router",
        "lib/runtime",
      ]) {
        expect(
          code.includes(denied),
          `${file} must not reference ${denied}`,
        ).toBe(false);
      }
    }
  });
});

// ===========================================================================
// I-24C2-7 — persistence via the REAL createPendingApproval path
// ===========================================================================
describe("I-24C2-7 (persistence): hash-frozen proposal round-trips the real queue", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(":memory:");
    applyMigrations(db);
  });
  afterEach(() => db.close());

  it("the enqueued proposal reads back with its canonical_effect_hash intact", () => {
    const res = submitProposalRequest(
      {
        tool: "fs.create_file",
        args: { path: "/data/report.md", content: "x" },
      },
      {
        lookup,
        clientId: CLIENT_ID,
        enqueue: realEnqueue(db),
        now_ms: NOW,
        ttl_ms: TTL,
        proposal_id: "proposal:persist01",
      },
    );
    expect(res.ok).toBe(true);
    const expected = computeCanonicalEffectHash(effectFor("/data/report.md"));

    const row = getApprovalById(db, "proposal:persist01");
    expect(row).toBeDefined();
    expect(row?.canonical_effect_hash).toBe(expected);
    expect(row?.scope_snapshot_hash).toMatch(/^hash:sha256:[0-9a-f]{64}$/);
    expect(row?.session_id).toBe(CLIENT_ID); // provenance persisted
  });
});

// ===========================================================================
// I-24C2-8 — metadata-only
// ===========================================================================
describe("I-24C2-8 (metadata-only): no raw payload/body/secret leaks", () => {
  it("a secret path + body never appears in the proposal; effect is sanitizer-clean", () => {
    const secretPath = "/home/owner/private/merger-secret-acquisition.md";
    const secretBody = "TOP-SECRET-PRICE-42000000";
    const canon = canonicalizeProposalRequest(
      {
        tool: "fs.create_file",
        args: { path: secretPath, content: secretBody },
      },
      lookup,
    );
    expect(canon.ok).toBe(true);
    if (!canon.ok) return;
    const p = buildCanonicalProposal({
      canonical_effect: canon.canonical_effect,
      client_id: CLIENT_ID,
      now_ms: NOW,
      ttl_ms: TTL,
      proposal_id: "proposal:secret01",
    });

    const json = JSON.stringify(p);
    expect(json).not.toContain(secretPath);
    expect(json).not.toContain(secretBody);
    expect(json).not.toContain("merger-secret-acquisition");

    // the effect (the content surface) is clean by the leaf sentinel
    expect(findForbiddenFields(p.canonical_effect)).toEqual([]);

    // the whole proposal MINUS the intentional sha256 digests (which match the
    // sentinel's long-hex secret heuristic by construction) is also clean
    const scrubbed = {
      ...p,
      canonical_effect_hash: "",
      scope_snapshot_ref_hash: "",
    };
    expect(findForbiddenFields(scrubbed)).toEqual([]);
  });
});
