// Phase 25B / E-045 — the gateway HOST's injected seams.
//
// The frozen Phase 24 gateway never imports db/ (GATE-2). It exposes narrow
// injection points instead (24B-2 "narrow-projection / injected-source"
// template): a `() => number` queue-status source, a per-client pending count,
// a durable mute store, a last-used recorder, admission limits. This module is
// the host side of those seams — it lives OUTSIDE the gateway import graph,
// touches the app DB read-only for counts, and persists the two small
// operator-facing stores as JSON files. It hands the gateway functions and
// numbers, never the DB handle (EoP-18).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type DatabaseType from "better-sqlite3";

import type {
  AdmissionLimits,
  ClientMuteStore,
  PendingCountForClient,
} from "../mcp-gateway/admission";
import type { RecordLastUsed } from "../mcp-gateway/client-registry";
import type { QueueStatusSource } from "../mcp-gateway/queue-status";

// ---- pending counts (read-only projections over the approvals table) --------

// Pending AND not yet expired — the honest live number, without mutating rows
// (expiry sweeps belong to the approval runtime, not the gateway host).
export function createApprovalsQueueSource(
  db: DatabaseType.Database,
  now: () => number = () => Date.now(),
): QueueStatusSource {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS n FROM approvals
     WHERE state = 'pending' AND (expires_at IS NULL OR expires_at > ?)`,
  );
  return () => {
    const row = stmt.get(now()) as { n: number } | undefined;
    return row?.n ?? 0;
  };
}

export function createPendingCountForClient(
  db: DatabaseType.Database,
  now: () => number = () => Date.now(),
): PendingCountForClient {
  const stmt = db.prepare(
    `SELECT COUNT(*) AS n FROM approvals
     WHERE state = 'pending' AND client_id = ?
       AND (expires_at IS NULL OR expires_at > ?)`,
  );
  return (clientId) => {
    if (!clientId) return 0;
    const row = stmt.get(clientId, now()) as { n: number } | undefined;
    return row?.n ?? 0;
  };
}

// ---- durable, human-written mute store ------------------------------------------

interface MuteRecord {
  readonly reason: string;
  readonly at_ms: number;
}

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback; // unreadable => treat as empty, never crash the host
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

// The gateway only ever READS this (isMuted); mute/unmute are for the host's
// operator command path. Persisted so a restart cannot silently un-mute.
export function createFileMuteStore(path: string): ClientMuteStore & {
  list(): Record<string, MuteRecord>;
} {
  let mutes = readJson<Record<string, MuteRecord>>(path, {});
  return {
    isMuted: (clientId) =>
      Object.prototype.hasOwnProperty.call(mutes, clientId),
    mute: (clientId, reason, atMs) => {
      mutes = { ...mutes, [clientId]: { reason, at_ms: atMs } };
      writeJson(path, mutes);
    },
    unmute: (clientId) => {
      const next = { ...mutes };
      delete next[clientId];
      mutes = next;
      writeJson(path, mutes);
    },
    list: () => ({ ...mutes }),
  };
}

// Last-used per client_id (operational discipline for token rotation — the
// threat model's "Token lifecycle"). Metadata only: id + timestamp.
export function createFileLastUsedRecorder(path: string): RecordLastUsed & {
  list(): Record<string, number>;
} {
  let seen = readJson<Record<string, number>>(path, {});
  const recorder = ((clientId: string, atMs: number) => {
    seen = { ...seen, [clientId]: atMs };
    writeJson(path, seen);
  }) as RecordLastUsed & { list(): Record<string, number> };
  recorder.list = () => ({ ...seen });
  return recorder;
}

// ---- admission limits from env (defaults stay the gateway's) --------------------

function envInt(value: string | undefined): number | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

export function admissionLimitsFromEnv(
  env: Record<string, string | undefined>,
): Partial<AdmissionLimits> {
  const out: Partial<AdmissionLimits> = {};
  const sqMax = envInt(env.JARVIS_MCP_STANDING_QUOTA_MAX);
  const sqPer = envInt(env.JARVIS_MCP_STANDING_QUOTA_PER_MS);
  if (sqMax !== undefined && sqPer !== undefined) {
    out.standing_quota = { max: sqMax, per_ms: sqPer };
  }
  const rrMax = envInt(env.JARVIS_MCP_READ_RATE_MAX);
  const rrPer = envInt(env.JARVIS_MCP_READ_RATE_PER_MS);
  if (rrMax !== undefined && rrPer !== undefined) {
    out.read_rate = { max: rrMax, per_ms: rrPer };
  }
  const maxPending = envInt(env.JARVIS_MCP_MAX_PENDING_PER_CLIENT);
  if (maxPending !== undefined) out.max_pending_per_client = maxPending;
  return out;
}

export const MCP_GATEWAY_HOST_ENV_KEYS = [
  "JARVIS_MCP_CLIENT_REGISTRY",
  "JARVIS_MCP_HOST_DATA_DIR",
  "JARVIS_MCP_QUEUE_STATUS_CADENCE_MS",
  "JARVIS_MCP_STANDING_QUOTA_MAX",
  "JARVIS_MCP_STANDING_QUOTA_PER_MS",
  "JARVIS_MCP_READ_RATE_MAX",
  "JARVIS_MCP_READ_RATE_PER_MS",
  "JARVIS_MCP_MAX_PENDING_PER_CLIENT",
] as const;
