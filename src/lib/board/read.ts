import type DatabaseType from "better-sqlite3";

// Program U.5 (E-032) — the Notice Board's READS. Gate cards are the REAL
// pending approvals (joined to their tool_calls row for the human-readable
// tool name and safety tags); sealed cards are the decided/consumed rows —
// receipts. Raw SELECTs on purpose: this module must never import the
// approvals module (the mutators live there), never expire, never decide.
// FC-1 AS LAYOUT: a Gate card shows the SERVER-DERIVED canonical effect
// (approvals.canonical_effect_json, written by the FC-2 freeze) when the row
// carries one; it never renders the tool's raw input_json.

export type BoardProvenance = "live" | "unreachable";

export interface GateCardEffect {
  readonly capability: string;
  readonly mutation_type: string;
  readonly target: string;
  readonly risk_class: string;
  readonly approval_tier: string;
  readonly side_effect_summary: string;
}

export interface GateCard {
  readonly id: string;
  readonly execution_id: string | null;
  readonly tool_id: string;
  readonly tool_name: string;
  readonly required_safety_tag: string;
  readonly safety_tag: string;
  readonly scope_hash_short: string;
  readonly expires_at: number | null;
  readonly origin: "gateway" | "chat";
  /** Server-derived effect (FC-1) or null for a legacy chat approval. */
  readonly effect: GateCardEffect | null;
  readonly metadata_only: true;
}

export type SealedKind = "approved" | "denied" | "expired" | "cancelled";

export interface SealedCard {
  readonly id: string;
  readonly tool_id: string;
  readonly kind: SealedKind;
  readonly decided_at: number;
  readonly consumed: boolean;
  readonly metadata_only: true;
}

export interface BoardRead {
  readonly gate: readonly GateCard[];
  readonly sealed: readonly SealedCard[];
  readonly provenance: BoardProvenance;
}

interface PendingRow {
  id: string;
  execution_id: string | null;
  tool_id: string;
  scope_hash: string;
  expires_at: number | null;
  canonical_effect_json: string | null;
  client_id: string | null;
  tool_name: string | null;
  required_safety_tag: string | null;
  safety_tag: string | null;
}

interface SealedRow {
  id: string;
  tool_id: string;
  state: string;
  decided_at: number;
  consumed_at: number | null;
}

const EFFECT_KEYS = [
  "capability",
  "mutation_type",
  "target",
  "risk_class",
  "approval_tier",
  "side_effect_summary",
] as const;

export function parseCanonicalEffect(json: string | null): GateCardEffect | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (parsed.server_derived !== true) return null;
    const out: Record<string, string> = {};
    for (const key of EFFECT_KEYS) {
      const value = parsed[key];
      if (typeof value !== "string") return null;
      out[key] = value.slice(0, 240);
    }
    return out as unknown as GateCardEffect;
  } catch {
    return null;
  }
}

export function readBoard(
  db: DatabaseType.Database,
  now: number = Date.now(),
  limits: { gate?: number; sealed?: number } = {},
): BoardRead {
  try {
    const pending = db
      .prepare(
        `SELECT a.id, a.execution_id, a.tool_id, a.scope_hash, a.expires_at,
                a.canonical_effect_json, a.client_id,
                t.tool_name, t.required_safety_tag, t.safety_tag
         FROM approvals a
         LEFT JOIN tool_calls t ON t.execution_id = a.execution_id
         WHERE a.state = 'pending'
           AND (a.expires_at IS NULL OR a.expires_at > ?)
         ORDER BY a.decided_at DESC, a.rowid DESC
         LIMIT ?`,
      )
      .all(now, limits.gate ?? 20) as PendingRow[];
    const sealed = db
      .prepare(
        `SELECT id, tool_id, state, decided_at, consumed_at
         FROM approvals
         WHERE state IN ('approved', 'denied', 'expired', 'cancelled')
         ORDER BY decided_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(limits.sealed ?? 12) as SealedRow[];

    return {
      gate: pending.map((row) => ({
        id: row.id,
        execution_id: row.execution_id,
        tool_id: row.tool_id,
        tool_name: row.tool_name ?? row.tool_id,
        required_safety_tag: row.required_safety_tag ?? "CONFIRM_ALWAYS",
        safety_tag: row.safety_tag ?? "BLOCK",
        scope_hash_short: row.scope_hash.slice(0, 12),
        expires_at: row.expires_at,
        origin: row.client_id ? "gateway" : "chat",
        effect: parseCanonicalEffect(row.canonical_effect_json),
        metadata_only: true,
      })),
      sealed: sealed.map((row) => ({
        id: row.id,
        tool_id: row.tool_id,
        kind: row.state as SealedKind,
        decided_at: row.decided_at,
        consumed: row.consumed_at !== null,
        metadata_only: true,
      })),
      provenance: "live",
    };
  } catch {
    return { gate: [], sealed: [], provenance: "unreachable" };
  }
}
