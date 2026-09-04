import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { initializeEventStore, type EventStore } from "./event-store";

// Phase 25B-2 (E-038) — the ONE Phase 11 event store the app writes to and
// the cockpit's ROOM / COST / ACTIVITY panels read from. Before this file the
// store existed as a schema (db/migrations/0001_init.sql) and a contract, but
// nothing in the app instantiated it, so the panels could only ever be
// synthetic. Path from env (POSIX default under data/), kill switch
// `JARVIS_EVENT_STORE_ENABLED=false`. The store's own schema keeps it
// metadata-only and local-only (CHECK constraints on every row).

export const DEFAULT_EVENT_STORE_PATH = "data/event-store.db";

export function resolveEventStorePath(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const enabled = env.JARVIS_EVENT_STORE_ENABLED?.trim().toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") return null;
  const configured = env.JARVIS_EVENT_DB_PATH?.trim();
  return resolve(configured || DEFAULT_EVENT_STORE_PATH);
}

let singleton: { path: string; store: EventStore } | null = null;

/** Lazy, process-wide store. Returns null when disabled or when the file
 *  cannot be created — callers degrade honestly (the panels stay synthetic). */
export function getAppEventStore(
  env: Record<string, string | undefined> = process.env,
): EventStore | null {
  const path = resolveEventStorePath(env);
  if (!path) return null;
  if (singleton && singleton.path === path) return singleton.store;
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const store = initializeEventStore({ databasePath: path });
    singleton = { path, store };
    return store;
  } catch {
    return null;
  }
}

/** Test seam. */
export function resetAppEventStore(): void {
  singleton?.store.close();
  singleton = null;
}

export interface ChatModelCallRecord {
  readonly sessionId: string;
  readonly assistantMessageId: string;
  readonly providerId: string;
  /** "local" | "cloud" — cloud calls are NOT stored (the schema forbids them). */
  readonly runtimeClass: "local" | "cloud";
  readonly modelId: string;
  readonly latencyMs: number;
  readonly timeToFirstTokenMs?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly costUsd: number;
  readonly intent: string;
  readonly tier: string;
  readonly safetyTag: string;
  readonly occurredAtMs?: number;
}

export type ChatModelCallResult =
  | { readonly ok: true; readonly eventId: string }
  | {
      readonly ok: false;
      readonly reason: "store_disabled" | "cloud_not_stored" | "append_failed";
    };

/** Append ONE metadata-only model-call row for a finished chat turn. Never
 *  throws: a store failure is reported, the chat stream is never affected. */
export function recordChatModelCall(
  store: EventStore | null,
  record: ChatModelCallRecord,
): ChatModelCallResult {
  if (!store) return { ok: false, reason: "store_disabled" };
  if (record.runtimeClass !== "local")
    return { ok: false, reason: "cloud_not_stored" };
  const occurredAtMs = record.occurredAtMs ?? Date.now();
  const eventId = `evt_chat_${record.assistantMessageId}`;
  const metadata = {
    source: "chat_route",
    session_id: record.sessionId,
    assistant_message_id: record.assistantMessageId,
    provider_id: record.providerId,
    runtime_class: record.runtimeClass,
    model_id: record.modelId,
    latency_ms: record.latencyMs,
    time_to_first_token_ms: record.timeToFirstTokenMs ?? null,
    input_tokens: record.inputTokens ?? null,
    output_tokens: record.outputTokens ?? null,
    cost_usd: record.costUsd,
    intent: record.intent,
    tier: record.tier,
    safety_tag: record.safetyTag,
    redaction_status: "metadata_only",
    prompt_payload_retained: false,
  };
  try {
    store.appendModelCall({
      eventId,
      eventType: "model.call",
      occurredAtMs,
      source: "chat_route",
      aggregateId: record.sessionId,
      metadataJson: JSON.stringify(metadata),
      modelCallId: `mc_chat_${record.assistantMessageId}`,
      // the cockpit's COST split keys on /local/i in the provider bucket
      providerId: `local:${record.providerId}`,
      modelId: record.modelId,
    });
    return { ok: true, eventId };
  } catch {
    return { ok: false, reason: "append_failed" };
  }
}
