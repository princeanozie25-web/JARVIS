// MCP gateway — approval-queue STATUS read (24B-2). The DANGEROUS surface,
// made safe by redaction discipline.
//
// Read naively, the approval queue leaks the owner's whole working life
// (proposal bodies/targets, project names, note paths, email domains, calendar,
// job applications, which clients are active, per-proposal timestamps, risk
// classes). A client polling "status" every few seconds would build a
// real-time surveillance feed without reading a single payload. This module
// makes the surface useful ("is something pending?") while leaking NONE of it:
//
//   ID-1 redaction   — the snapshot carries ONLY a pending count + a coarse
//                       bucket. No per-proposal field of ANY kind. The output
//                       shape is structurally incapable of carrying one (the
//                       source is typed as a bare number).
//   ID-3 anti-poll   — a server-side cadence cache: within `cadenceMs`, every
//                       read returns the SAME snapshot, so rapid polling cannot
//                       observe sub-interval count deltas (the timing channel
//                       that, correlated with a connected client, deanonymizes).
//
// GATE-2: this module is a LEAF — it imports nothing. The raw count is supplied
// by an INJECTED source (a `() => number`) wired OUTSIDE the gateway's import
// graph, so the gateway never imports the approvals/db/approval-runtime trees.

export const QUEUE_STATUS_URI = "jarvis://approvals/queue-status" as const;
export const QUEUE_STATUS_NAME = "queue-status" as const;

/** ID-3: the cadence at which the cached count may refresh. */
export const DEFAULT_QUEUE_STATUS_CADENCE_MS = 30_000;

export type QueueStatusBucket = "none" | "few" | "many";

/**
 * The ENTIRE queue-status response. ID-1: a pending count + a coarse bucket +
 * the disclosed cadence — and nothing else. No proposal id/body/target, no
 * project/path/email, no timestamp, no risk/tier/title, no client identity, no
 * other lifecycle state (surfacing approved/denied/expired counts would leak
 * the owner's RESOLUTION activity — also surveillance). "pending" is the only
 * live state, and it is the awaiting-human state in the frozen Phase 18
 * lifecycle.
 */
export interface QueueStatusSnapshot {
  pending_count: number;
  pending_bucket: QueueStatusBucket;
  cadence_seconds: number;
  metadata_only: true;
  read_only: true;
}

/** The injected raw-count source. Typed as a bare number so it is STRUCTURALLY
 * incapable of carrying a per-proposal field into the gateway. Reads the
 * approvals table OUTSIDE the gateway's import graph (host/test wires it). */
export type QueueStatusSource = () => number;

export interface QueueStatusReader {
  read(): QueueStatusSnapshot;
}

function bucketOf(count: number): QueueStatusBucket {
  if (count <= 0) return "none";
  if (count <= 4) return "few";
  return "many";
}

/** Redact a raw pending count down to the counts-only snapshot (ID-1). */
export function projectQueueStatus(
  pendingCount: number,
  cadenceMs: number = DEFAULT_QUEUE_STATUS_CADENCE_MS,
): QueueStatusSnapshot {
  const safe =
    Number.isFinite(pendingCount) && pendingCount > 0
      ? Math.floor(pendingCount)
      : 0;
  return {
    pending_count: safe,
    pending_bucket: bucketOf(safe),
    cadence_seconds: Math.max(1, Math.round(cadenceMs / 1000)),
    metadata_only: true,
    read_only: true,
  };
}

/**
 * Build a reader with a SERVER-SIDE cadence cache (ID-3). The first read (cold
 * cache) computes; subsequent reads within `cadenceMs` return the SAME cached
 * snapshot regardless of how fast the client polls or how the underlying queue
 * changes. The cadence + clock are server-controlled, never client-settable.
 *
 * RESIDUAL after hardening: a slow, coarse pending count. A client can still
 * learn "roughly how many things are pending, refreshed at most every N
 * seconds" — bounded and documented, not a real-time feed. Per-proposal data,
 * resolution activity, and sub-cadence deltas remain unobservable.
 */
export function createQueueStatusReader(options: {
  source: QueueStatusSource;
  cadenceMs?: number;
  now?: () => number;
}): QueueStatusReader {
  const cadenceMs = options.cadenceMs ?? DEFAULT_QUEUE_STATUS_CADENCE_MS;
  const clock = options.now ?? (() => Date.now());
  let cached: QueueStatusSnapshot | null = null;
  let lastRefreshedMs = Number.NEGATIVE_INFINITY;

  return {
    read(): QueueStatusSnapshot {
      const nowMs = clock();
      if (cached === null || nowMs - lastRefreshedMs >= cadenceMs) {
        cached = projectQueueStatus(options.source(), cadenceMs);
        lastRefreshedMs = nowMs;
      }
      return cached;
    },
  };
}
