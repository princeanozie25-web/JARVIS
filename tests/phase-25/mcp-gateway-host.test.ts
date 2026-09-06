import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createPendingApproval } from "../../src/lib/db/approvals";
import { applyMigrations } from "../../src/lib/db/schema";
import {
  startStdioServer,
  UNIFORM_DENIAL_MESSAGE,
} from "../../src/lib/mcp-gateway";
import { parseClientRegistryFromEnv } from "../../src/lib/mcp-gateway/client-registry";
import { hashToken } from "../../src/lib/mcp-gateway/identity";
import {
  admissionLimitsFromEnv,
  createApprovalsQueueSource,
  createFileLastUsedRecorder,
  createFileMuteStore,
  createPendingCountForClient,
} from "../../src/lib/mcp-gateway-host/seams";

// Phase 25B / E-045 — the gateway host's seams, and the frozen stdio gateway
// driven END TO END with those seams injected (the thing no script did until
// now): a provisioned client reads a LIVE queue-status; an unprovisioned one
// gets the uniform denial. In-memory DB, in-memory streams, no network.

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  applyMigrations(db);
  return db;
}

function pending(
  db: Database.Database,
  id: string,
  clientId: string | null,
  now: number,
  ttl = 60_000,
) {
  return createPendingApproval(db, {
    execution_id: `exec-${id}`,
    session_id: "s",
    tool_id: "tool.note",
    scope_hash: "scope",
    created_at: now,
    ttl_ms: ttl,
    client_id: clientId,
  });
}

describe("E-045 host seams — narrow, read-only projections over the approvals table", () => {
  it("counts pending-and-unexpired rows in total and per client", () => {
    const db = freshDb();
    const now = 1_000_000;
    pending(db, "a", "claude", now);
    pending(db, "b", "claude", now);
    pending(db, "c", "codex", now);
    pending(db, "expired", "claude", now - 120_000, 60_000); // already expired
    const total = createApprovalsQueueSource(db, () => now);
    const perClient = createPendingCountForClient(db, () => now);
    expect(total()).toBe(3);
    expect(perClient("claude")).toBe(2);
    expect(perClient("codex")).toBe(1);
    expect(perClient("nobody")).toBe(0);
    expect(perClient("")).toBe(0);
  });
});

describe("E-045 host seams — durable stores", () => {
  it("mute store persists across instances and is read-only to the gateway", () => {
    const dir = mkdtempSync(join(tmpdir(), "jarvis-mcp-host-"));
    const path = join(dir, "mutes.json");
    const a = createFileMuteStore(path);
    expect(a.isMuted("x")).toBe(false);
    a.mute("x", "flood", 5);
    expect(a.isMuted("x")).toBe(true);
    const b = createFileMuteStore(path); // "restart"
    expect(b.isMuted("x")).toBe(true);
    b.unmute("x");
    expect(createFileMuteStore(path).isMuted("x")).toBe(false);
  });

  it("last-used recorder persists id + timestamp only", () => {
    const dir = mkdtempSync(join(tmpdir(), "jarvis-mcp-host-"));
    const path = join(dir, "last-used.json");
    const r = createFileLastUsedRecorder(path);
    r("claude", 42);
    expect(createFileLastUsedRecorder(path).list()).toEqual({ claude: 42 });
  });

  it("admission limits come from env pairs, defaults otherwise", () => {
    expect(admissionLimitsFromEnv({})).toEqual({});
    expect(
      admissionLimitsFromEnv({
        JARVIS_MCP_STANDING_QUOTA_MAX: "10",
        JARVIS_MCP_STANDING_QUOTA_PER_MS: "60000",
        JARVIS_MCP_MAX_PENDING_PER_CLIENT: "3",
        JARVIS_MCP_READ_RATE_MAX: "not-a-number",
      }),
    ).toEqual({
      standing_quota: { max: 10, per_ms: 60_000 },
      max_pending_per_client: 3,
    });
  });
});

// ---- the frozen gateway, hosted ---------------------------------------------------

interface RpcOut {
  id: number;
  result?: {
    contents?: { uri: string; text: string }[];
    protocolVersion?: string;
  };
  error?: { message: string };
}

async function drive(
  input: {
    token: string | null;
    registry: Map<string, unknown>;
    db: Database.Database;
    now: number;
  },
  requests: Record<string, unknown>[],
): Promise<RpcOut[]> {
  const inStream = new PassThrough();
  const outStream = new PassThrough();
  const chunks: Buffer[] = [];
  outStream.on("data", (c: Buffer) => chunks.push(c));
  const server = startStdioServer({
    input: inStream,
    output: outStream,
    presentedToken: input.token,
    clientRegistry: input.registry as never,
    queueStatusSource: createApprovalsQueueSource(input.db, () => input.now),
    pendingCountForClient: createPendingCountForClient(
      input.db,
      () => input.now,
    ),
    clientMuteStore: createFileMuteStore(
      join(mkdtempSync(join(tmpdir(), "jarvis-mcp-host-")), "mutes.json"),
    ),
    now: () => input.now,
  });
  for (const r of requests)
    inStream.write(`${JSON.stringify({ jsonrpc: "2.0", ...r })}\n`);
  await new Promise((r) => setTimeout(r, 30));
  server.stop();
  inStream.end();
  return Buffer.concat(chunks)
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RpcOut);
}

describe("E-045 — the stdio gateway hosted with live seams", () => {
  const token = "tok_test_provisioned_client_0123456789abcdef";
  const registry = new Map([
    [
      hashToken(token),
      {
        client_id: "claude-desktop",
        enabled: true,
        created_at_ms: 0,
        rotated_from_hash: null,
        scope: null,
      },
    ],
  ]);

  it("a provisioned client initializes and reads a LIVE bucketed queue-status", async () => {
    const db = freshDb();
    const now = 5_000_000;
    pending(db, "1", "claude-desktop", now);
    pending(db, "2", "claude-desktop", now);
    const out = await drive({ token, registry, db, now }, [
      { id: 1, method: "initialize", params: {} },
      {
        id: 2,
        method: "resources/read",
        params: { uri: "jarvis://approvals/queue-status" },
      },
    ]);
    expect(out.find((o) => o.id === 1)?.result?.protocolVersion).toBeTruthy();
    const read = out.find((o) => o.id === 2)!;
    expect(read.error).toBeUndefined();
    const text = read.result!.contents![0]!.text;
    expect(text).toMatch(/bucket/i);
    expect(text).toMatch(/\d/);
    // ID-1 redaction: a count + a bucket, never a row, never a token, never a client id.
    expect(text).not.toMatch(/exec-|tok_|claude-desktop|token/);
  });

  it("an unprovisioned token collapses to the uniform denial for everything (FC-3, ID-5)", async () => {
    const db = freshDb();
    const out = await drive(
      {
        token: "tok_not_provisioned_0000000000000000000000",
        registry,
        db,
        now: 1,
      },
      [
        { id: 1, method: "initialize", params: {} },
        {
          id: 2,
          method: "resources/read",
          params: { uri: "jarvis://approvals/queue-status" },
        },
      ],
    );
    for (const o of out) expect(o.error?.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });

  it("no token at all is refused the same way", async () => {
    const out = await drive({ token: null, registry, db: freshDb(), now: 1 }, [
      { id: 1, method: "initialize", params: {} },
    ]);
    expect(out[0]?.error?.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });

  it("through the REAL env registry path: a scoped client reads live; an unscoped entry fails closed (FC-3 + ID-2)", async () => {
    const db = freshDb();
    const now = 9_000_000;
    pending(db, "z", "claude-desktop", now);
    const scoped = parseClientRegistryFromEnv({
      JARVIS_MCP_CLIENT_REGISTRY: JSON.stringify({
        [hashToken(token)]: {
          client_id: "claude-desktop",
          enabled: true,
          scope: { read: ["queue-status"], propose: [] },
        },
      }),
    });
    const live = await drive({ token, registry: scoped as never, db, now }, [
      {
        id: 2,
        method: "resources/read",
        params: { uri: "jarvis://approvals/queue-status" },
      },
    ]);
    expect(live[0]?.error).toBeUndefined();
    expect(live[0]?.result?.contents?.[0]?.text).toMatch(/bucket/i);

    const unscoped = parseClientRegistryFromEnv({
      JARVIS_MCP_CLIENT_REGISTRY: JSON.stringify({
        [hashToken(token)]: { client_id: "claude-desktop", enabled: true },
      }),
    });
    const denied = await drive(
      { token, registry: unscoped as never, db, now },
      [
        {
          id: 2,
          method: "resources/read",
          params: { uri: "jarvis://approvals/queue-status" },
        },
      ],
    );
    expect(denied[0]?.error?.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });

  it("a muted client is denied reads even when provisioned (24D-3 via the host's durable store)", async () => {
    const db = freshDb();
    const dir = mkdtempSync(join(tmpdir(), "jarvis-mcp-host-"));
    const mutes = createFileMuteStore(join(dir, "mutes.json"));
    mutes.mute("claude-desktop", "operator", 1);
    const inStream = new PassThrough();
    const outStream = new PassThrough();
    const chunks: Buffer[] = [];
    outStream.on("data", (c: Buffer) => chunks.push(c));
    const server = startStdioServer({
      input: inStream,
      output: outStream,
      presentedToken: token,
      clientRegistry: registry as never,
      queueStatusSource: createApprovalsQueueSource(db),
      clientMuteStore: mutes,
    });
    inStream.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "resources/read", params: { uri: "jarvis://approvals/queue-status" } })}\n`,
    );
    await new Promise((r) => setTimeout(r, 30));
    server.stop();
    const out = JSON.parse(
      Buffer.concat(chunks).toString("utf8").trim().split("\n")[0]!,
    ) as RpcOut;
    expect(out.error?.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });
});
