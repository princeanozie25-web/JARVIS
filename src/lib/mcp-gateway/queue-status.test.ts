// MCP gateway — queue-status invariants I-24B2-1 .. I-24B2-7.
//
// The whole job of this slice is to prove that a client polling the approval
// queue learns NOTHING about what the owner is actually doing — only "is there
// something pending, roughly how much, refreshed slowly". These tests seed a
// queue full of sensitive data and prove the snapshot carries none of it, that
// every refusal is indistinguishable, that rapid polling cannot observe
// sub-cadence deltas, and that the read path is a structural leaf (GATE-2).

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";

import { applyMigrations } from "@/lib/db/schema";
import { recordApproval } from "@/lib/db/approvals";

import {
  EXPOSED_RESOURCES,
  QUEUE_STATUS_NAME,
  QUEUE_STATUS_URI,
  UNIFORM_DENIAL_MESSAGE,
  createQueueStatusReader,
  findForbiddenFields,
  handleJsonRpcRequest,
  hashToken,
  listExposedResourceNames,
  projectQueueStatus,
  sanitizeReadPayload,
  startStdioServer,
  type GatewaySession,
} from "./index";

// Loose structural view of a JSON-RPC response for assertions (no `any`).
interface GatewayResp {
  result: {
    contents: Array<{ uri: string; mimeType: string; text: string }>;
    resources: Array<{ uri: string; name: string }>;
  };
  error: { code: number; message: string };
}

const AUTHED: GatewaySession = {
  authenticated: true,
  clientId: "mcp-client:test",
};

// Recognizable sensitive strings planted into EVERY text column of the seeded
// approvals. If any rode the snapshot, the redaction assertions would catch it.
const SENTINELS = {
  project: "Acme-Merger-SECRET",
  notePath: "/home/owner/notes/merger-due-diligence.md",
  email: "[email protected]",
  client: "active-client-Zenith-Corp",
} as const;

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

/** Seed 7 PENDING approvals (each carrying sentinels) + 3 resolved ones that
 * must NOT count toward "pending". 7 > 4 => bucket "many". */
function seedRichQueue(): void {
  for (let i = 0; i < 7; i++) {
    recordApproval(db, {
      id: `pending-${i}`,
      execution_id: `${SENTINELS.notePath}#${i}`,
      session_id: SENTINELS.email,
      tool_id: `${SENTINELS.project}-${i}`,
      scope_hash: SENTINELS.client,
      decision: "PENDING",
      state: "pending",
      decided_at: 1_000 + i,
      expires_at: null,
    });
  }
  recordApproval(db, {
    id: "approved-1",
    session_id: "s",
    tool_id: "t",
    scope_hash: "h",
    decision: "APPROVED_ONCE",
    state: "approved",
    decided_at: 2_000,
  });
  recordApproval(db, {
    id: "denied-1",
    session_id: "s",
    tool_id: "t",
    scope_hash: "h",
    decision: "DENIED",
    state: "denied",
    decided_at: 2_001,
  });
  recordApproval(db, {
    id: "expired-1",
    session_id: "s",
    tool_id: "t",
    scope_hash: "h",
    decision: "EXPIRED",
    state: "expired",
    decided_at: 2_002,
  });
}

/** The injected counts source: reads the pending count from the approvals DB —
 * OUTSIDE the gateway import graph. Typed as a bare number return. */
const pendingCount = (): number =>
  (
    db
      .prepare("SELECT COUNT(*) AS n FROM approvals WHERE state = 'pending'")
      .get() as { n: number }
  ).n;

const ALLOWED_SNAPSHOT_KEYS = [
  "cadence_seconds",
  "metadata_only",
  "pending_bucket",
  "pending_count",
  "read_only",
];

function collectResponses(
  stream: PassThrough,
  count: number,
  timeoutMs = 3000,
): Promise<GatewayResp[]> {
  return new Promise((resolvePromise, rejectPromise) => {
    const out: GatewayResp[] = [];
    let buffer = "";
    stream.setEncoding("utf8");
    const timer = setTimeout(
      () =>
        rejectPromise(
          new Error(`timed out waiting for ${count} (got ${out.length})`),
        ),
      timeoutMs,
    );
    stream.on("data", (chunk: string) => {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line.length > 0) out.push(JSON.parse(line) as GatewayResp);
        index = buffer.indexOf("\n");
      }
      if (out.length >= count) {
        clearTimeout(timer);
        resolvePromise(out);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// I-24B2-1 — exposure: resources/list == {pipeline-view-model, queue-status}
// ---------------------------------------------------------------------------
describe("I-24B2-1 (exposure): list is exactly the two reads, no third", () => {
  it("the registry and resources/list both report exactly the two names, in order", () => {
    expect(listExposedResourceNames()).toEqual([
      "pipeline-view-model",
      "queue-status",
    ]);
    expect(EXPOSED_RESOURCES.length).toBe(2);

    const list = handleJsonRpcRequest(
      { jsonrpc: "2.0", id: 1, method: "resources/list" },
      AUTHED,
    ) as unknown as GatewayResp;
    const names = list.result.resources.map((r) => r.name);
    expect(names).toEqual(["pipeline-view-model", "queue-status"]);
    expect(names).toHaveLength(2); // no third surface

    const queueDescriptor = list.result.resources.find(
      (r) => r.name === QUEUE_STATUS_NAME,
    );
    expect(queueDescriptor?.uri).toBe(QUEUE_STATUS_URI);
  });
});

// ---------------------------------------------------------------------------
// I-24B2-2 — ID-1 redaction: a queue full of sensitive data yields a snapshot
// that is ONLY a count + coarse bucket. No per-proposal field of any kind.
// ---------------------------------------------------------------------------
describe("I-24B2-2 (ID-1 counts-only): rich seeded queue, snapshot carries no specifics", () => {
  it("the reader returns exactly the counts-only shape and none of the seeded sentinels", () => {
    seedRichQueue();
    const reader = createQueueStatusReader({ source: pendingCount });
    const snap = reader.read();

    // count is the real pending count; resolved rows are excluded
    expect(snap.pending_count).toBe(7);
    expect(snap.pending_bucket).toBe("many");

    // the ENTIRE shape is the five allowed keys — nothing else can ride
    expect(Object.keys(snap).sort()).toEqual(ALLOWED_SNAPSHOT_KEYS);
    expect(snap.metadata_only).toBe(true);
    expect(snap.read_only).toBe(true);

    // not one sentinel — proposal body/target, project, note path, email,
    // active-client name — appears anywhere in the serialized snapshot
    const json = JSON.stringify(snap);
    for (const sentinel of Object.values(SENTINELS)) {
      expect(json).not.toContain(sentinel);
    }
    // and the structural sentinel agrees the snapshot is clean
    expect(findForbiddenFields(snap)).toEqual([]);
  });

  it("end-to-end over stdio: the server serves the db-backed counts-only snapshot", async () => {
    seedRichQueue();
    const TOKEN = "queue-status-e2e-token";
    const input = new PassThrough();
    const output = new PassThrough();
    const pending = collectResponses(output, 2);
    const server = startStdioServer({
      input,
      output,
      presentedToken: TOKEN,
      provisionedTokenHashes: new Set<string>([hashToken(TOKEN)]),
      queueStatusSource: pendingCount,
    });
    expect(server.authenticated).toBe(true);

    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })}\n`,
    );
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: QUEUE_STATUS_URI } })}\n`,
    );

    const [, readResp] = await pending;
    const text = readResp.result.contents[0].text;
    const snap = JSON.parse(text) as Record<string, unknown>;
    expect(snap.pending_count).toBe(7);
    expect(snap.pending_bucket).toBe("many");
    expect(Object.keys(snap).sort()).toEqual(ALLOWED_SNAPSHOT_KEYS);
    for (const sentinel of Object.values(SENTINELS)) {
      expect(text).not.toContain(sentinel);
    }
    server.stop();
  });
});

// ---------------------------------------------------------------------------
// I-24B2-3 — the snapshot passes the outbound sanitizer at every bucket
// ---------------------------------------------------------------------------
describe("I-24B2-3 (sanitizer clean): every projected snapshot is hygiene-clean", () => {
  it("is clean across the bucket range and survives the fail-closed gate", () => {
    for (const count of [0, 1, 4, 5, 100, 9_999]) {
      const snap = projectQueueStatus(count);
      expect(findForbiddenFields(snap)).toEqual([]);
      expect(() => sanitizeReadPayload(snap)).not.toThrow();
    }
  });

  it("buckets are coarse (none/few/many) and the count is floored, clamped, finite-guarded", () => {
    expect(projectQueueStatus(0).pending_bucket).toBe("none");
    expect(projectQueueStatus(4).pending_bucket).toBe("few");
    expect(projectQueueStatus(5).pending_bucket).toBe("many");
    expect(projectQueueStatus(-3).pending_count).toBe(0);
    expect(projectQueueStatus(Number.NaN).pending_count).toBe(0);
    expect(projectQueueStatus(3.9).pending_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// I-24B2-4 — GATE-2 leaf: the new read path imports NOTHING, so it cannot drag
// a mutator tree into the gateway graph. (The full transitive walk — which now
// includes this file — lives in transitive-import-allowlist.test.ts; the
// allowlist is UNCHANGED because queue-status.ts is already under the allowed
// src/lib/mcp-gateway/ prefix and the raw count is injected from outside.)
// ---------------------------------------------------------------------------
describe("I-24B2-4 (GATE-2 leaf): queue-status read path has no imports", () => {
  it("queue-status.ts contains no static import, dynamic import, or require", () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "queue-status.ts"),
      "utf8",
    );
    // strip comments so prose ("imports nothing", "import graph") cannot match
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\n)\s*\/\/[^\n]*/g, "");
    expect(/(^|\n)\s*import\b/.test(code)).toBe(false);
    expect(/\bimport\s*\(/.test(code)).toBe(false);
    expect(/\brequire\s*\(/.test(code)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// I-24B2-5 — ID-5 uniform denial: a client probing for the queue surface gets
// the SAME refusal whether the URI is unknown, forbidden, or exposed-but-unwired
// ---------------------------------------------------------------------------
describe("I-24B2-5 (ID-5 uniform denial): refusals are indistinguishable", () => {
  it("unknown URI, forbidden tree, and unwired queue-status all collapse to the same error", () => {
    const reader = createQueueStatusReader({ source: () => 3 });

    const unknown = handleJsonRpcRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "jarvis://unknown/surface" },
      },
      AUTHED,
      reader,
    ) as unknown as GatewayResp;
    const forbidden = handleJsonRpcRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: { uri: "jarvis://approvals/db" },
      },
      AUTHED,
      reader,
    ) as unknown as GatewayResp;
    // queue-status URI itself, but with NO counts source wired
    const unwired = handleJsonRpcRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "resources/read",
        params: { uri: QUEUE_STATUS_URI },
      },
      AUTHED,
      null,
    ) as unknown as GatewayResp;

    expect(unknown.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
    expect(forbidden.error.code).toBe(unknown.error.code);
    expect(forbidden.error.message).toBe(unknown.error.message);
    expect(unwired.error.code).toBe(unknown.error.code);
    expect(unwired.error.message).toBe(unknown.error.message);
    // the error names neither the surface nor the scope
    expect(JSON.stringify(unwired.error)).not.toContain("queue");
    expect(JSON.stringify(unwired.error)).not.toContain("approval");
  });
});

// ---------------------------------------------------------------------------
// I-24B2-6 — ID-3 cadence: rapid reads within the window return the SAME count;
// it only changes after the interval (no sub-cadence timing channel)
// ---------------------------------------------------------------------------
describe("I-24B2-6 (ID-3 anti-poll cadence): sub-interval polling sees a frozen count", () => {
  it("serves a cached snapshot within cadenceMs even as the underlying queue changes", () => {
    let count = 1;
    let clockMs = 10_000;
    const reader = createQueueStatusReader({
      source: () => count,
      cadenceMs: 30_000,
      now: () => clockMs,
    });

    const first = reader.read();
    expect(first.pending_count).toBe(1);

    // the queue jumps and the client polls rapidly inside the window — the
    // server keeps serving the SAME number (and literally the same object)
    count = 9;
    clockMs += 1_000;
    expect(reader.read().pending_count).toBe(1);
    clockMs += 28_000; // 29s since refresh, still < cadence
    expect(reader.read().pending_count).toBe(1);
    expect(reader.read()).toBe(first);

    // only once the cadence elapses may the count move
    clockMs += 2_000; // 31s since refresh
    expect(reader.read().pending_count).toBe(9);
  });

  it("the disclosed cadence_seconds reflects the server-set interval", () => {
    const reader = createQueueStatusReader({
      source: () => 2,
      cadenceMs: 30_000,
      now: () => 0,
    });
    expect(reader.read().cadence_seconds).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// I-24B2-7 — no cross-client visibility: the snapshot carries no client/session
// identity and does not vary by who is asking
// ---------------------------------------------------------------------------
describe("I-24B2-7 (no cross-client): the snapshot is client-agnostic and identity-free", () => {
  it("two different clients get byte-identical contents carrying no identity field", () => {
    seedRichQueue();
    const reader = createQueueStatusReader({ source: pendingCount });
    const sessionA: GatewaySession = {
      authenticated: true,
      clientId: "mcp-client:aaaaaaaaaaaaaaaa",
    };
    const sessionB: GatewaySession = {
      authenticated: true,
      clientId: "mcp-client:bbbbbbbbbbbbbbbb",
    };
    const read = (session: GatewaySession): GatewayResp =>
      handleJsonRpcRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "resources/read",
          params: { uri: QUEUE_STATUS_URI },
        },
        session,
        reader,
      ) as unknown as GatewayResp;

    const textA = read(sessionA).result.contents[0].text;
    const textB = read(sessionB).result.contents[0].text;
    expect(textA).toBe(textB);
    expect(textA).not.toContain("mcp-client");

    const normalize = (key: string): string =>
      key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const keys = Object.keys(JSON.parse(textA) as Record<string, unknown>).map(
      normalize,
    );
    for (const forbidden of [
      "client",
      "clientid",
      "session",
      "sessionid",
      "owner",
      "user",
      "actor",
      "by",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
