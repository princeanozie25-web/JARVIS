// DoS-family admission invariants I-24D3-1 .. I-24D3-8 (24D-3).
//
// The DoS gates EoP-9 (stolen token weaponizes the queue) and EoP-10 (rogue/noisy
// valid client poisons it / floods reads). Counters are in-memory; mute +
// pending-count are injected. Every denial carries only a reason enum; the wire
// collapses it to the uniform denial; no counter is keyed by a token; one client
// never affects another.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GatewayAdmissionController,
  type ClientMuteStore,
  type ProposalAdmissionRequest,
} from "./admission";
import {
  createQueueStatusReader,
  handleJsonRpcRequest,
  QUEUE_STATUS_URI,
  submitProposalRequest,
  UNIFORM_DENIAL_MESSAGE,
  type ClientScope,
  type EnqueueProposal,
  type GatewaySession,
  type ToolMetadata,
} from "./index";

const GENEROUS = { max: 1000, per_ms: 1000 };
const wideLimits = {
  standing_quota: GENEROUS,
  read_rate: GENEROUS,
  max_pending_per_client: 1000,
};

interface GatewayResp {
  result?: { contents?: Array<{ text: string }> };
  error?: { code: number; message: string };
}

// ===========================================================================
// I-24D3-1 — per-capability rate limit (the DECLARED rate is enforced + refills)
// ===========================================================================
describe("I-24D3-1 (rate limit): declared {max, per_ms} enforced, then refills", () => {
  it("admits up to max, rejects the next, refills over time", () => {
    let t = 0;
    const c = new GatewayAdmissionController({
      limits: wideLimits,
      now: () => t,
    });
    const req: ProposalAdmissionRequest = {
      clientId: "A",
      capability: "memory.note",
      rateLimit: { max: 3, per_ms: 1000 },
    };
    expect(c.admitProposal(req).ok).toBe(true);
    expect(c.admitProposal(req).ok).toBe(true);
    expect(c.admitProposal(req).ok).toBe(true);
    expect(c.admitProposal(req)).toEqual({
      ok: false,
      reason: "rate_exceeded",
    });
    t = 1000; // a full window later: the bucket refills
    expect(c.admitProposal(req).ok).toBe(true);
  });

  it("FAIL-CLOSED: a grant that declared no rate limit is denied (no_rate_limit)", () => {
    const c = new GatewayAdmissionController({
      limits: wideLimits,
      now: () => 0,
    });
    expect(
      c.admitProposal({ clientId: "A", capability: "memory.note" }),
    ).toEqual({ ok: false, reason: "no_rate_limit" });
    expect(
      c.admitProposal({
        clientId: "A",
        capability: "memory.note",
        rateLimit: { max: 0, per_ms: 1000 },
      }),
    ).toEqual({ ok: false, reason: "no_rate_limit" });
  });
});

// ===========================================================================
// I-24D3-2 — standing quota (caps total across DIFFERENT capabilities)
// ===========================================================================
describe("I-24D3-2 (quota): a standing per-client cap spans all capabilities", () => {
  it("rejects past the quota even when spread across capabilities", () => {
    const c = new GatewayAdmissionController({
      limits: {
        standing_quota: { max: 4, per_ms: 3_600_000 },
        read_rate: GENEROUS,
        max_pending_per_client: 1000,
      },
      now: () => 0,
    });
    const cap = (capability: string): ProposalAdmissionRequest => ({
      clientId: "A",
      capability,
      rateLimit: { max: 100, per_ms: 1000 }, // generous per-cap so quota trips first
    });
    expect(c.admitProposal(cap("capA")).ok).toBe(true);
    expect(c.admitProposal(cap("capB")).ok).toBe(true);
    expect(c.admitProposal(cap("capA")).ok).toBe(true);
    expect(c.admitProposal(cap("capB")).ok).toBe(true);
    expect(c.admitProposal(cap("capA"))).toEqual({
      ok: false,
      reason: "quota_exceeded",
    });
  });
});

// ===========================================================================
// I-24D3-3 — queue-depth cap (per client, via injected pending-count)
// ===========================================================================
describe("I-24D3-3 (queue-depth cap): per-client pending cap, no cross-client coupling", () => {
  it("rejects at/over the cap for one client; another at low depth is unaffected", () => {
    const c = new GatewayAdmissionController({
      limits: { ...wideLimits, max_pending_per_client: 2 },
      pendingCount: (clientId) => (clientId === "A" ? 2 : 0),
      now: () => 0,
    });
    const rate = { max: 100, per_ms: 1000 };
    expect(
      c.admitProposal({ clientId: "A", capability: "x", rateLimit: rate }),
    ).toEqual({ ok: false, reason: "queue_depth_exceeded" });
    expect(
      c.admitProposal({ clientId: "B", capability: "x", rateLimit: rate }).ok,
    ).toBe(true);
  });
});

// ===========================================================================
// I-24D3-4 — durable client mute (via the injected store)
// ===========================================================================
describe("I-24D3-4 (mute): a muted client is rejected; unmute restores; durable + isolated", () => {
  function muteStore(): ClientMuteStore {
    const muted = new Set<string>();
    return {
      isMuted: (id) => muted.has(id),
      mute: (id) => muted.add(id),
      unmute: (id) => muted.delete(id),
    };
  }

  it("rejects a muted client, leaves others alone, and restores on unmute", () => {
    const store = muteStore();
    const c = new GatewayAdmissionController({
      muteStore: store,
      limits: wideLimits,
      now: () => 0,
    });
    const rate = { max: 100, per_ms: 1000 };
    store.mute("A", "flood", 0);
    expect(
      c.admitProposal({ clientId: "A", capability: "x", rateLimit: rate }),
    ).toEqual({ ok: false, reason: "muted" });
    expect(
      c.admitProposal({ clientId: "B", capability: "x", rateLimit: rate }).ok,
    ).toBe(true);
    store.unmute("A");
    expect(
      c.admitProposal({ clientId: "A", capability: "x", rateLimit: rate }).ok,
    ).toBe(true);
  });

  it("is DURABLE: a fresh controller over the SAME store still sees the mute", () => {
    const store = muteStore();
    store.mute("A", "flood", 0);
    // a new controller (simulating a server restart) reads the durable store
    const restarted = new GatewayAdmissionController({
      muteStore: store,
      limits: wideLimits,
      now: () => 0,
    });
    expect(
      restarted.admitProposal({
        clientId: "A",
        capability: "x",
        rateLimit: { max: 100, per_ms: 1000 },
      }),
    ).toEqual({ ok: false, reason: "muted" });
  });

  it("auto-mute is FLAG-ONLY + opt-in + human-confirmed: it suggests, never mutes", () => {
    const flags: Array<{ id: string; count: number }> = [];
    const store = muteStore();
    const c = new GatewayAdmissionController({
      muteStore: store,
      limits: { ...wideLimits, standing_quota: { max: 2, per_ms: 3_600_000 } },
      autoMuteThreshold: 2,
      onSuspiciousVolume: (id, count) => flags.push({ id, count }),
      now: () => 0,
    });
    const req: ProposalAdmissionRequest = {
      clientId: "A",
      capability: "x",
      rateLimit: { max: 100, per_ms: 1000 },
    };
    c.admitProposal(req); // quota 1 ok
    c.admitProposal(req); // quota 2 ok
    c.admitProposal(req); // quota trip #1
    c.admitProposal(req); // quota trip #2 -> flag fires once
    c.admitProposal(req); // quota trip #3 -> NOT flagged again
    expect(flags).toEqual([{ id: "A", count: 2 }]);
    // the FLAG never muted the client; a human must confirm via the store
    expect(store.isMuted("A")).toBe(false);
  });
});

// ===========================================================================
// I-24D3-5 — read rate limit (ID-3), controller + handler
// ===========================================================================
describe("I-24D3-5 (read rate / ID-3): per-client read cap on top of the cadence cache", () => {
  it("controller: excess reads from one client denied; another unaffected; refills", () => {
    let t = 0;
    const c = new GatewayAdmissionController({
      limits: { ...wideLimits, read_rate: { max: 2, per_ms: 1000 } },
      now: () => t,
    });
    expect(c.admitRead("A").ok).toBe(true);
    expect(c.admitRead("A").ok).toBe(true);
    expect(c.admitRead("A")).toEqual({ ok: false, reason: "rate_exceeded" });
    expect(c.admitRead("B").ok).toBe(true); // no cross-client coupling
    t = 1000;
    expect(c.admitRead("A").ok).toBe(true); // refilled
  });

  it("handler: an over-rate read collapses to the uniform denial (cadence still feeds the allowed read)", () => {
    const t = 0; // fixed clock: max:1 means the SECOND read is over-rate
    const c = new GatewayAdmissionController({
      limits: { ...wideLimits, read_rate: { max: 1, per_ms: 1000 } },
      now: () => t,
    });
    const admitRead = (id: string | null): boolean => c.admitRead(id).ok;
    const session: GatewaySession = {
      authenticated: true,
      clientId: "mcp-client:A",
    };
    const reader = createQueueStatusReader({ source: () => 3, now: () => t });
    const read = (): GatewayResp =>
      handleJsonRpcRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "resources/read",
          params: { uri: QUEUE_STATUS_URI },
        },
        session,
        reader,
        admitRead,
      ) as unknown as GatewayResp;

    const first = read();
    expect(first.result?.contents).toBeDefined(); // served (read-rate had a token)
    const second = read();
    expect(second.error?.message).toBe(UNIFORM_DENIAL_MESSAGE); // over-rate -> uniform
  });
});

// ===========================================================================
// I-24D3-1..4 wired into submitProposalRequest — rejected BEFORE freeze/enqueue
// ===========================================================================
describe("admission wired into submitProposalRequest: rejects BEFORE freeze", () => {
  const memoryMeta: ToolMetadata = {
    capability: "memory.note",
    reversibilityClass: "REVERSIBLE_WRITE",
    requiredSafetyTag: "CONFIRM_ONCE",
    proposalExposable: true,
    validateArgs: () => ({ ok: true }),
    deriveTarget: () => "memory:note:x",
  };
  const scope = (rateLimit?: { max: number; per_ms: number }): ClientScope => ({
    read: [],
    propose: [{ capability: "memory.note", rate_limit: rateLimit }],
  });

  function run(
    controller: GatewayAdmissionController,
    clientScope: ClientScope,
  ): { outcome: ReturnType<typeof submitProposalRequest>; enqueued: number } {
    let enqueued = 0;
    const enqueue: EnqueueProposal = (p) => {
      enqueued += 1;
      return { proposal_id: p.proposal_id };
    };
    const outcome = submitProposalRequest(
      { tool: "memory.note", args: { slug: "x", body: "hi" } },
      {
        lookup: () => memoryMeta,
        clientId: "mcp-client:A",
        enqueue,
        now_ms: 0,
        ttl_ms: 1000,
        scope: clientScope,
        admit: (req) => controller.admitProposal(req),
        proposal_id: "proposal:dos01",
      },
    );
    return { outcome, enqueued };
  }

  it("a muted client never reaches the enqueue boundary (stage 'admission')", () => {
    const muted = new Set<string>(["mcp-client:A"]);
    const c = new GatewayAdmissionController({
      muteStore: {
        isMuted: (id) => muted.has(id),
        mute: () => {},
        unmute: () => {},
      },
      limits: wideLimits,
      now: () => 0,
    });
    const { outcome, enqueued } = run(c, scope({ max: 5, per_ms: 1000 }));
    expect(outcome).toEqual({
      ok: false,
      stage: "admission",
      reason: "muted",
    });
    expect(enqueued).toBe(0); // rejected BEFORE freeze/enqueue
  });

  it("rate exhaustion rejects at stage 'admission'; only the within-rate ones enqueue", () => {
    const c = new GatewayAdmissionController({
      limits: wideLimits,
      now: () => 0,
    });
    const s = scope({ max: 2, per_ms: 1000 });
    expect(run(c, s).outcome.ok).toBe(true);
    expect(run(c, s).outcome.ok).toBe(true);
    const third = run(c, s);
    expect(third.outcome).toEqual({
      ok: false,
      stage: "admission",
      reason: "rate_exceeded",
    });
    expect(third.enqueued).toBe(0);
  });

  it("a grant with no declared rate is fail-closed (stage 'admission', no_rate_limit)", () => {
    const c = new GatewayAdmissionController({
      limits: wideLimits,
      now: () => 0,
    });
    const { outcome, enqueued } = run(c, scope(undefined));
    expect(outcome).toEqual({
      ok: false,
      stage: "admission",
      reason: "no_rate_limit",
    });
    expect(enqueued).toBe(0);
  });
});

// ===========================================================================
// I-24D3-7 — uniform + no cross-client + no token in keys
// ===========================================================================
describe("I-24D3-7 (uniform, no cross-client leak, no token in keys)", () => {
  const ADMISSION_SRC = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "admission.ts"),
    "utf8",
  );
  const codeOnly = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");

  it("denials carry ONLY a reason enum — no client id, no count, no target", () => {
    const c = new GatewayAdmissionController({
      muteStore: { isMuted: () => true, mute: () => {}, unmute: () => {} },
      limits: wideLimits,
      now: () => 0,
    });
    const result = c.admitProposal({
      clientId: "mcp-client:secretname",
      capability: "memory.note",
      rateLimit: { max: 5, per_ms: 1000 },
    });
    expect(result).toEqual({ ok: false, reason: "muted" });
    expect(JSON.stringify(result)).not.toContain("secretname");
  });

  it("counters are keyed by client_id only — no AUTH-token / hash vocabulary in code", () => {
    const code = codeOnly(ADMISSION_SRC);
    // the rate-limit "token bucket" legitimately uses the word "token"; what must
    // be ABSENT is any AUTH-token / secret / hash vocabulary in a key or log.
    for (const forbidden of [
      "tokenHash",
      "hashToken",
      "token_hash",
      "presentedToken",
      "secret",
      "sha256",
    ]) {
      expect(code.includes(forbidden), `must not reference ${forbidden}`).toBe(
        false,
      );
    }
    // keys are built from the client identity, never a token
    expect(code).toContain("clientId");
  });

  it("no cross-client coupling: A exhausted, muted, and at depth never blocks B", () => {
    const c = new GatewayAdmissionController({
      muteStore: {
        isMuted: (id) => id === "A",
        mute: () => {},
        unmute: () => {},
      },
      limits: { ...wideLimits, max_pending_per_client: 1 },
      pendingCount: (id) => (id === "A" ? 5 : 0),
      now: () => 0,
    });
    expect(
      c.admitProposal({
        clientId: "A",
        capability: "x",
        rateLimit: { max: 1, per_ms: 1000 },
      }).ok,
    ).toBe(false);
    expect(
      c.admitProposal({
        clientId: "B",
        capability: "x",
        rateLimit: { max: 1, per_ms: 1000 },
      }).ok,
    ).toBe(true);
  });
});

// ===========================================================================
// I-24D3-8 (partial) — GATE-2: the admission leaf imports nothing
// ===========================================================================
describe("I-24D3-8 (GATE-2 leaf): admission.ts imports nothing", () => {
  const SELF = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "admission.ts"),
    "utf8",
  );
  const codeOnly = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");

  it("has zero module import edges (a pure in-memory leaf)", () => {
    const froms = [
      ...codeOnly(SELF).matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);
    expect(froms).toEqual([]);
  });

  it("references no mutator tree", () => {
    const code = codeOnly(SELF);
    for (const denied of [
      "lib/db",
      "lib/tools",
      "lib/chat",
      "approval-runtime",
      "lib/router",
    ]) {
      expect(code.includes(denied), `must not reference ${denied}`).toBe(false);
    }
  });
});
