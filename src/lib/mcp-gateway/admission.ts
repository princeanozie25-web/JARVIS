// MCP gateway — the DoS family: admission control (24D-3).
//
// THE THREAT: a stolen token (EoP-9) or a rogue/noisy valid client (EoP-10)
// turns the proposal queue into a weapon — flood it to bury real proposals,
// trigger alert fatigue, or hammer reads for resource exhaustion (ID-3). Scope
// (24D-2a) DECLARED a per-grant rate_limit; this slice ENFORCES it, and adds the
// per-client caps scope could not express: a standing quota, a queue-depth cap,
// a durable mute, and a read rate limit. Every check sits BEFORE freeze/enqueue
// (proposals) or before the read (resources/read) — reject early, never queue.
//
// STATE MODEL (owner-approved):
//   * rate / quota / read-rate counters = IN-MEMORY, per-server-session. A restart
//     does not help an attacker mid-flood; cold start = empty buckets + fail-closed
//     defaults. Simple and GATE-2-clean (no db).
//   * durable state that SHOULD survive restart (client MUTE) = via an INJECTED
//     store (the 24D-1 pattern), never importing db/.
//   * queue depth = via an INJECTED pending-count (the host reads the queue OUTSIDE
//     the gateway graph; the gateway never imports db/).
//
// KEYS + LEAKS: every counter is keyed by client_id (+ capability), NEVER by a
// token or hash — this module never even receives a token. Denials carry only a
// coarse reason enum; the wire collapses them to the uniform denial (ID-5). One
// client's buckets/quota/mute never touch another's (no cross-client coupling).
//
// GATE-2: this module imports NOTHING. A pure in-memory leaf; durable mute and
// pending-count enter as injected callbacks the host wires outside the graph.

/** A declared rate: at most `max` events per `per_ms` window (structurally the
 * same shape scope.ts's ProposeGrant.rate_limit carries). */
export interface RateLimit {
  max: number;
  per_ms: number;
}

/** Server-policy caps applied to EVERY client (independent of per-grant rate).
 * The host supplies these; sane conservative defaults apply if it does not. */
export interface AdmissionLimits {
  /** Standing per-client quota over a long window, across ALL capabilities — so
   * a client cannot spread a flood thinly across many capabilities. */
  standing_quota: RateLimit;
  /** Per-client rate limit on reads (resources/read), on top of the cadence cache. */
  read_rate: RateLimit;
  /** Max PENDING proposals one client may hold in the queue at once. */
  max_pending_per_client: number;
}

/** Conservative defaults (the host should override per deployment). */
export const DEFAULT_ADMISSION_LIMITS: AdmissionLimits = {
  standing_quota: { max: 120, per_ms: 60 * 60 * 1000 }, // 120/hour
  read_rate: { max: 60, per_ms: 60 * 1000 }, // 60/minute
  max_pending_per_client: 20,
};

export type AdmissionDenyReason =
  | "no_identity" // missing client_id (no provenance => no admission)
  | "muted" // client is muted (durable, admin/auto-flagged + human-confirmed)
  | "queue_depth_exceeded" // at/over the per-client pending cap
  | "quota_exceeded" // over the standing per-client quota (all capabilities)
  | "no_rate_limit" // FAIL-CLOSED: the grant declared no per-capability rate
  | "rate_exceeded"; // over the declared per-capability rate

export type AdmissionResult =
  | { ok: true }
  | { ok: false; reason: AdmissionDenyReason };

/** Injected DURABLE mute store (host-wired to db/file OUTSIDE the gateway graph).
 * Keyed by client_id. The mute/unmute operations are the human/admin action; the
 * gateway only READS isMuted at the boundary. */
export interface ClientMuteStore {
  isMuted(clientId: string): boolean;
  mute(clientId: string, reason: string, atMs: number): void;
  unmute(clientId: string): void;
}

/** Injected pending-count: how many PENDING proposals this client holds RIGHT
 * NOW. The host computes it OUTSIDE the gateway graph (the gateway never imports
 * db/). Keyed by client_id. */
export type PendingCountForClient = (clientId: string) => number;

/** Injected conservative auto-mute FLAG (opt-in). When a client trips the quota/
 * rate `autoMuteThreshold` times, the controller calls this ONCE to SUGGEST a
 * mute to a human — it NEVER mutes automatically (a human confirms via
 * muteStore.mute). Keyed by client_id; carries only a count. */
export type RecordSuspiciousVolume = (
  clientId: string,
  tripCount: number,
) => void;

interface Bucket {
  tokens: number;
  lastMs: number;
}

/** A set of token buckets keyed by an opaque string. Each key refills `max`
 * tokens per `per_ms`, bursting up to `max`. Fail-closed: a non-positive limit
 * never admits. The key is always a client_id (+ capability) — never a token. */
class TokenBucketSet {
  private readonly buckets = new Map<string, Bucket>();

  tryConsume(key: string, limit: RateLimit, now: number): boolean {
    if (
      !Number.isFinite(limit.max) ||
      !Number.isFinite(limit.per_ms) ||
      limit.max <= 0 ||
      limit.per_ms <= 0
    ) {
      return false; // fail-closed: a missing/zero/garbage limit denies
    }
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: limit.max, lastMs: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = Math.max(0, now - bucket.lastMs);
    const refill = (elapsed / limit.per_ms) * limit.max;
    bucket.tokens = Math.min(limit.max, bucket.tokens + refill);
    bucket.lastMs = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }
}

export interface AdmissionControllerOptions {
  limits?: Partial<AdmissionLimits>;
  /** Durable mute store (injected). Absent => nothing is ever muted. */
  muteStore?: ClientMuteStore;
  /** Pending-count source (injected). Absent => the depth cap is not enforced. */
  pendingCount?: PendingCountForClient;
  now?: () => number;
  /** Opt-in conservative auto-mute: trips before a human-confirmed mute SUGGESTION
   * fires. Unset => never flags. The flag never mutes; a human confirms. */
  autoMuteThreshold?: number;
  onSuspiciousVolume?: RecordSuspiciousVolume;
}

export interface ProposalAdmissionRequest {
  clientId: string | null;
  capability: string;
  /** The per-capability declared rate from the client's grant (scope). Missing/
   * undefined => fail-closed deny (no_rate_limit). */
  rateLimit?: RateLimit;
}

/**
 * In-memory, per-server-session admission controller. Construct ONCE per server
 * session and share it across the propose path (admitProposal, wired into
 * submitProposalRequest BEFORE freeze) and the read path (admitRead, wired into
 * handleJsonRpcRequest's resources/read). All counters are in-memory; mute and
 * pending-count are injected. Nothing here is keyed by, logs, or receives a token.
 */
export class GatewayAdmissionController {
  private readonly limits: AdmissionLimits;
  private readonly muteStore?: ClientMuteStore;
  private readonly pendingCount?: PendingCountForClient;
  private readonly now: () => number;
  private readonly autoMuteThreshold?: number;
  private readonly onSuspiciousVolume?: RecordSuspiciousVolume;

  private readonly capacityBuckets = new TokenBucketSet(); // per (client,capability)
  private readonly quotaBuckets = new TokenBucketSet(); // per client (standing)
  private readonly readBuckets = new TokenBucketSet(); // per client (reads)
  private readonly tripCounts = new Map<string, number>();
  private readonly flagged = new Set<string>();

  constructor(options: AdmissionControllerOptions = {}) {
    this.limits = { ...DEFAULT_ADMISSION_LIMITS, ...options.limits };
    this.muteStore = options.muteStore;
    this.pendingCount = options.pendingCount;
    this.now = options.now ?? (() => Date.now());
    this.autoMuteThreshold = options.autoMuteThreshold;
    this.onSuspiciousVolume = options.onSuspiciousVolume;
  }

  /**
   * Admit (or reject) a propose request BEFORE freeze. Order: identity -> mute ->
   * queue-depth -> per-capability rate -> standing quota. Fail-closed throughout.
   * Keyed by client_id (+ capability); never by a token.
   */
  admitProposal(request: ProposalAdmissionRequest): AdmissionResult {
    const clientId = request.clientId;
    if (!clientId || clientId.trim().length === 0) {
      return { ok: false, reason: "no_identity" };
    }
    if (this.muteStore?.isMuted(clientId)) {
      return { ok: false, reason: "muted" };
    }
    if (
      this.pendingCount &&
      this.pendingCount(clientId) >= this.limits.max_pending_per_client
    ) {
      return { ok: false, reason: "queue_depth_exceeded" };
    }

    const now = this.now();
    // per-capability rate (the tightest, declared limit) first — FAIL-CLOSED if
    // the grant declared no usable limit: missing, zero, negative, or non-finite
    // all mean "no rate budget" and DENY (no_rate_limit), never allow.
    const rate = request.rateLimit;
    if (
      !rate ||
      !Number.isFinite(rate.max) ||
      !Number.isFinite(rate.per_ms) ||
      rate.max <= 0 ||
      rate.per_ms <= 0
    ) {
      return { ok: false, reason: "no_rate_limit" };
    }
    const capKey = `${clientId}::${request.capability}`;
    if (!this.capacityBuckets.tryConsume(capKey, rate, now)) {
      this.recordTrip(clientId);
      return { ok: false, reason: "rate_exceeded" };
    }
    // standing quota (broad, per-client, across all capabilities).
    if (
      !this.quotaBuckets.tryConsume(clientId, this.limits.standing_quota, now)
    ) {
      this.recordTrip(clientId);
      return { ok: false, reason: "quota_exceeded" };
    }
    return { ok: true };
  }

  /**
   * Admit (or reject) a read BEFORE serving it (ID-3 extension). A muted client
   * is cut off from reads too. Keyed by client_id; never by a token.
   */
  admitRead(clientId: string | null): AdmissionResult {
    if (!clientId || clientId.trim().length === 0) {
      return { ok: false, reason: "no_identity" };
    }
    if (this.muteStore?.isMuted(clientId)) {
      return { ok: false, reason: "muted" };
    }
    if (
      !this.readBuckets.tryConsume(clientId, this.limits.read_rate, this.now())
    ) {
      return { ok: false, reason: "rate_exceeded" };
    }
    return { ok: true };
  }

  /** Conservative, opt-in auto-mute FLAG. Counts quota/rate trips per client and,
   * once the threshold is reached, SUGGESTS a mute to a human exactly once. It
   * never mutes — a human confirms via muteStore.mute. */
  private recordTrip(clientId: string): void {
    if (this.autoMuteThreshold === undefined || !this.onSuspiciousVolume)
      return;
    const count = (this.tripCounts.get(clientId) ?? 0) + 1;
    this.tripCounts.set(clientId, count);
    if (count >= this.autoMuteThreshold && !this.flagged.has(clientId)) {
      this.flagged.add(clientId);
      this.onSuspiciousVolume(clientId, count);
    }
  }
}
