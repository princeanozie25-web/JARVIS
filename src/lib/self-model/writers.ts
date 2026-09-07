// Self Model (E-050) — the controlled writers.
//
// The Self Model has exactly two ways to persist anything, both typed,
// both appending to the EXISTING event store (Phase 11 `events` table via
// EventStore.appendEvent — no new database, no new table):
//   self.snapshot_recorded   — counts and source health of a snapshot
//   self.observation         — a probe failure / contradiction / expiry
// No claim text, no free-form prose, no raw payloads; every metadata
// object is schema-validated and leak-checked before it is written. An LLM
// cannot reach these: they are not tools.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SELF_MODEL_CONTRACT_VERSION, type SelfSnapshot } from "./contracts";
import { assertNoSelfLeak } from "./redaction";

export const SELF_MODEL_WRITER_OPERATIONS = [
  "record_snapshot",
  "record_observation",
] as const;
export const SELF_MODEL_EVENT_SOURCE = "self-model" as const;
export const SELF_SNAPSHOT_EVENT_TYPE = "self.snapshot_recorded" as const;
export const SELF_OBSERVATION_EVENT_TYPE = "self.observation" as const;

export interface SelfEventSink {
  appendEvent(input: {
    readonly eventId: string;
    readonly eventType: string;
    readonly occurredAtMs: number;
    readonly source: string;
    readonly aggregateId?: string | null;
    readonly metadataJson?: string;
  }): void;
}

export const SelfSnapshotEventMetadataSchema = z.strictObject({
  contract_version: z.literal(SELF_MODEL_CONTRACT_VERSION),
  generated_at: z.string().max(40),
  claim_count: z.number().int().nonnegative(),
  by_status: z.record(z.string(), z.number().int().nonnegative()),
  sources: z
    .array(
      z.strictObject({
        source_id: z.string().max(80),
        ok: z.boolean(),
        claim_count: z.number().int().nonnegative(),
      }),
    )
    .max(16),
  warning_count: z.number().int().nonnegative(),
  contradiction_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const SELF_OBSERVATION_KINDS = [
  "probe_failure",
  "contradiction",
  "freshness_expired",
] as const;
export const SelfObservationSchema = z.strictObject({
  kind: z.enum(SELF_OBSERVATION_KINDS),
  subject: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(280),
  observed_at: z.string().max(40),
  metadata_only: z.literal(true),
});
export type SelfObservation = z.infer<typeof SelfObservationSchema>;

export interface SelfModelWriter {
  recordSnapshot(snapshot: SelfSnapshot): { eventId: string } | null;
  recordObservation(
    observation: Omit<SelfObservation, "metadata_only">,
  ): { eventId: string } | null;
}

export function createSelfModelWriter(
  sink: SelfEventSink | null,
): SelfModelWriter {
  return {
    recordSnapshot(snapshot) {
      if (!sink) return null;
      const byStatus: Record<string, number> = {};
      let contradictions = 0;
      for (const c of snapshot.claims) {
        byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
        contradictions += c.contradictions.length;
      }
      const metadata = assertNoSelfLeak(
        SelfSnapshotEventMetadataSchema.parse({
          contract_version: SELF_MODEL_CONTRACT_VERSION,
          generated_at: snapshot.generated_at,
          claim_count: snapshot.claims.length,
          by_status: byStatus,
          sources: snapshot.sources.map((s) => ({
            source_id: s.source_id,
            ok: s.ok,
            claim_count: s.claim_count,
          })),
          warning_count: snapshot.warnings.length,
          contradiction_count: contradictions,
          metadata_only: true,
        }),
      );
      const eventId = randomUUID();
      sink.appendEvent({
        eventId,
        eventType: SELF_SNAPSHOT_EVENT_TYPE,
        occurredAtMs: Date.parse(snapshot.generated_at) || Date.now(),
        source: SELF_MODEL_EVENT_SOURCE,
        aggregateId: "self",
        metadataJson: JSON.stringify(metadata),
      });
      return { eventId };
    },
    recordObservation(observation) {
      if (!sink) return null;
      const metadata = assertNoSelfLeak(
        SelfObservationSchema.parse({ ...observation, metadata_only: true }),
      );
      const eventId = randomUUID();
      sink.appendEvent({
        eventId,
        eventType: SELF_OBSERVATION_EVENT_TYPE,
        occurredAtMs: Date.parse(metadata.observed_at) || Date.now(),
        source: SELF_MODEL_EVENT_SOURCE,
        aggregateId: `self:${metadata.subject}`,
        metadataJson: JSON.stringify(metadata),
      });
      return { eventId };
    },
  };
}
