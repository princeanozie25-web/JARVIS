// Self Model (E-050) — composition.
//
// A SelfModel owns five source functions and nothing else. `snapshot()`
// runs them (each isolated: a source that throws becomes a warning and an
// "unavailable" record, never a crash), reconciles claims by precedence,
// decays stale live claims to unknown, and leak-checks the result. The
// snapshot is cached briefly so a burst of self.* tool calls costs one
// probe round.
import {
  SelfSnapshotSchema,
  SELF_MODEL_CONTRACT_VERSION,
  type SelfClaim,
  type SelfClaimCategory,
  type SelfClaimStatus,
  type SelfSnapshot,
  type SelfSourceRecord,
} from "./contracts";
import { assertNoSelfLeak } from "./redaction";
import { decayStaleClaim, freshnessOf, reconcileClaims } from "./reconcile";

export type SelfSourceFn = () => SelfClaim[] | Promise<SelfClaim[]>;

export interface SelfModelSources {
  constitutional: SelfSourceFn;
  capabilities: SelfSourceFn;
  runtime: SelfSourceFn;
  experience: SelfSourceFn;
  repository: SelfSourceFn;
}

export interface SelfModelOptions {
  sources: SelfModelSources;
  now?: () => Date;
  cacheTtlMs?: number;
  // Called after each fresh snapshot (the controlled writer hooks in here).
  onSnapshot?: (snapshot: SelfSnapshot) => void;
}

export const SELF_MODEL_DEFAULT_CACHE_TTL_MS = 15_000;

const HEADLINE_SUBJECTS = new Set([
  "provider:ollama",
  "voice:tts-server",
  "runtime.db",
  "runtime.doctor",
  "node:local",
]);

export interface SelfStatusSummary {
  generated_at: string;
  headline: "operational" | "degraded" | "offline" | "unknown";
  counts: Record<SelfClaimStatus, number>;
  stale: number;
  contradictions: number;
  sources: SelfSourceRecord[];
  warnings: string[];
}

export class SelfModel {
  private readonly sources: SelfModelSources;
  private readonly now: () => Date;
  private readonly cacheTtlMs: number;
  private readonly onSnapshot?: (s: SelfSnapshot) => void;
  private cached: { at: number; snapshot: SelfSnapshot } | null = null;

  constructor(options: SelfModelOptions) {
    this.sources = options.sources;
    this.now = options.now ?? (() => new Date());
    this.cacheTtlMs = options.cacheTtlMs ?? SELF_MODEL_DEFAULT_CACHE_TTL_MS;
    this.onSnapshot = options.onSnapshot;
  }

  async snapshot(options: { force?: boolean } = {}): Promise<SelfSnapshot> {
    const nowDate = this.now();
    const nowMs = nowDate.getTime();
    if (
      !options.force &&
      this.cached &&
      nowMs - this.cached.at <= this.cacheTtlMs
    ) {
      return this.cached.snapshot;
    }
    const generatedAt = nowDate.toISOString();
    const records: SelfSourceRecord[] = [];
    const warnings: string[] = [];
    const raw: SelfClaim[] = [];
    for (const [id, fn] of Object.entries(this.sources) as [
      keyof SelfModelSources,
      SelfSourceFn,
    ][]) {
      try {
        const claims = await fn();
        raw.push(...claims);
        records.push({
          source_id: id,
          ok: true,
          observed_at: generatedAt,
          claim_count: claims.length,
        });
      } catch (error) {
        const note = error instanceof Error ? error.message : String(error);
        records.push({
          source_id: id,
          ok: false,
          observed_at: generatedAt,
          claim_count: 0,
          note: note.slice(0, 320),
        });
        warnings.push(`source ${id} unavailable: ${note}`.slice(0, 320));
      }
    }
    const reconciled = reconcileClaims(raw).map((c) =>
      decayStaleClaim(c, nowMs),
    );
    const snapshot = SelfSnapshotSchema.parse({
      contract_version: SELF_MODEL_CONTRACT_VERSION,
      generated_at: generatedAt,
      claims: reconciled,
      sources: records,
      warnings: warnings.slice(0, 64),
      metadata_only: true,
      secret_material_included: false,
    });
    assertNoSelfLeak(snapshot);
    this.cached = { at: nowMs, snapshot };
    this.onSnapshot?.(snapshot);
    return snapshot;
  }

  invalidate(): void {
    this.cached = null;
  }

  async claims(
    filter: {
      category?: SelfClaimCategory;
      status?: SelfClaimStatus;
      subjectPrefix?: string;
    } = {},
  ): Promise<SelfClaim[]> {
    const s = await this.snapshot();
    return s.claims.filter(
      (c) =>
        (!filter.category || c.category === filter.category) &&
        (!filter.status || c.status === filter.status) &&
        (!filter.subjectPrefix || c.subject.startsWith(filter.subjectPrefix)),
    );
  }

  async find(key: string): Promise<SelfClaim | null> {
    const s = await this.snapshot();
    return (
      s.claims.find((c) => c.claim_id === key) ??
      s.claims.find((c) => c.subject === key) ??
      s.claims.find((c) => c.claim_id === `self:${key}`) ??
      null
    );
  }

  async status(): Promise<SelfStatusSummary> {
    const s = await this.snapshot();
    const nowMs = this.now().getTime();
    const counts = Object.fromEntries(
      [
        "operational",
        "degraded",
        "offline",
        "experimental",
        "planned",
        "unsupported",
        "unknown",
      ].map((k) => [k, 0]),
    ) as Record<SelfClaimStatus, number>;
    let stale = 0;
    let contradictions = 0;
    for (const c of s.claims) {
      counts[c.status] += 1;
      if (freshnessOf(c, nowMs) === "stale") stale += 1;
      contradictions += c.contradictions.length;
    }
    // Headline follows the live runtime claims for the subsystems a turn
    // depends on. Optional persistence (event store) and by-design
    // disabled features never degrade it.
    const live = s.claims.filter(
      (c) =>
        c.trust_class === "current_verified_runtime" &&
        (HEADLINE_SUBJECTS.has(c.subject) || c.subject.startsWith("model:")),
    );
    const headline: SelfStatusSummary["headline"] =
      live.length === 0
        ? "unknown"
        : live.some(
              (c) => c.status === "offline" && c.subject === "provider:ollama",
            )
          ? "offline"
          : live.some((c) => c.status === "offline" || c.status === "degraded")
            ? "degraded"
            : "operational";
    return {
      generated_at: s.generated_at,
      headline,
      counts,
      stale,
      contradictions,
      sources: s.sources,
      warnings: s.warnings,
    };
  }
}
