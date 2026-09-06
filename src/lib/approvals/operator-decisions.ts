// Phase 25B / E-046 — the OPERATOR DECISION TRANSPORT (25A LI #12).
//
// Lets the human decide pending approvals from a loopback operator surface
// (the cockpit's Gate rail) instead of only the originating chat stream —
// WITHOUT touching the frozen Phase 18 lifecycle or adding a mutation path:
//
//   list   -> trusted channel (server-derived effect) + fenced untrusted text,
//             plus a per-row, single-use DECISION TOKEN bound to the effect
//             hash the operator is looking at (view-binding, EoP-16)
//   decide -> verify the decision token + the hash the operator saw, take the
//             minted approval token from the operator store, and enter the
//             frozen `resumeApproval` exactly as the chat inlet does (token
//             check, FC-2 revalidation, then the same `runtime.runTool` site).
//
// Routes enforce loopback + same-origin (EoP-17). Every rejection is uniform.
// This module calls no runtime directly — `runtime.runTool` stays at 2 sites.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type DatabaseType from "better-sqlite3";

import { resumeApproval, safeToolInputSummary } from "../chat/tool-approvals";
import {
  forgetOperatorToken,
  hasOperatorToken,
  peekOperatorToken,
} from "./operator-token-store";

type ResumeInput = Parameters<typeof resumeApproval>[0];
export type OperatorDecision = ResumeInput["decision"];
export type OperatorDecisionResult = Awaited<ReturnType<typeof resumeApproval>>;

// ---- decision tokens: view-bound, single-use, short TTL ------------------------

export const OPERATOR_DECISION_TOKEN_TTL_MS = 5 * 60_000;

interface IssuedDecisionToken {
  readonly hash: string;
  readonly boundHash: string;
  readonly expiresAt: number;
  consumed: boolean;
}

const issued = new Map<string, IssuedDecisionToken>();

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

export function issueDecisionToken(
  executionId: string,
  boundHash: string,
  now: number = Date.now(),
  ttlMs: number = OPERATOR_DECISION_TOKEN_TTL_MS,
): string {
  const token = `dec_${randomBytes(24).toString("hex")}`;
  issued.set(executionId, {
    hash: sha256(token),
    boundHash,
    expiresAt: now + ttlMs,
    consumed: false,
  });
  return token;
}

export type DecisionTokenVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "unknown"
        | "invalid"
        | "expired"
        | "consumed"
        | "hash_mismatch";
    };

export function verifyDecisionToken(
  executionId: string,
  token: string,
  presentedBoundHash: string,
  now: number = Date.now(),
): DecisionTokenVerdict {
  const entry = issued.get(executionId);
  if (!entry) return { ok: false, reason: "unknown" };
  if (typeof token !== "string" || token.length < 16)
    return { ok: false, reason: "invalid" };
  if (!safeEqualHex(sha256(token), entry.hash))
    return { ok: false, reason: "invalid" };
  if (entry.consumed) return { ok: false, reason: "consumed" };
  if (entry.expiresAt <= now) return { ok: false, reason: "expired" };
  if (presentedBoundHash !== entry.boundHash)
    return { ok: false, reason: "hash_mismatch" };
  return { ok: true };
}

function consumeDecisionToken(executionId: string): void {
  const entry = issued.get(executionId);
  if (entry) entry.consumed = true;
}

export function resetDecisionTokensForTests(): void {
  issued.clear();
}

// ---- listing: trusted channel + fenced untrusted text (ID-6 / EoP-11) -----------

export interface OperatorPendingRow {
  readonly execution_id: string;
  readonly session_id: string;
  readonly tool_id: string;
  readonly tool_name: string | null;
  readonly required_safety_tag: string | null;
  readonly client_id: string | null;
  readonly expires_at: number | null;
  /** TRUSTED: the server-derived canonical effect (gateway rows), else null. */
  readonly canonical_effect_json: string | null;
  /** What the decision is bound to: canonical_effect_hash for gateway rows,
   *  the frozen scope_hash for chat rows. */
  readonly bound_hash: string;
  /** UNTRUSTED: the client's input, summarised by the existing sanitizer. The
   *  UI must render it fenced and labelled, never as JARVIS's own words. */
  readonly untrusted_client_text: string;
  readonly decision_token: string;
  /** false after a server restart — the row can only expire (fail-closed). */
  readonly operator_token_available: boolean;
  readonly metadata_only: true;
}

interface JoinedRow {
  execution_id: string;
  session_id: string;
  tool_id: string;
  client_id: string | null;
  expires_at: number | null;
  canonical_effect_hash: string | null;
  canonical_effect_json: string | null;
  scope_hash: string;
  tool_name: string | null;
  required_safety_tag: string | null;
  input_json: string | null;
}

export function listPendingForOperator(
  db: DatabaseType.Database,
  now: number = Date.now(),
  issue: typeof issueDecisionToken = issueDecisionToken,
): OperatorPendingRow[] {
  const rows = db
    .prepare(
      `SELECT a.execution_id, a.session_id, a.tool_id, a.client_id, a.expires_at,
              a.canonical_effect_hash, a.canonical_effect_json, a.scope_hash,
              t.tool_name, t.required_safety_tag, t.input_json
         FROM approvals a
         LEFT JOIN tool_calls t ON t.execution_id = a.execution_id
        WHERE a.state = 'pending' AND (a.expires_at IS NULL OR a.expires_at > ?)
        ORDER BY a.decided_at DESC`,
    )
    .all(now) as JoinedRow[];

  return rows.map((r) => {
    const boundHash = r.canonical_effect_hash ?? r.scope_hash;
    let untrusted = "";
    if (r.input_json) {
      try {
        untrusted = safeToolInputSummary(
          JSON.parse(r.input_json) as unknown,
          db,
        );
      } catch {
        untrusted = "(unreadable input)";
      }
    }
    return {
      execution_id: r.execution_id,
      session_id: r.session_id,
      tool_id: r.tool_id,
      tool_name: r.tool_name,
      required_safety_tag: r.required_safety_tag,
      client_id: r.client_id,
      expires_at: r.expires_at,
      canonical_effect_json: r.canonical_effect_json,
      bound_hash: boundHash,
      untrusted_client_text: untrusted,
      decision_token: issue(r.execution_id, boundHash, now),
      operator_token_available: hasOperatorToken(r.execution_id, now),
      metadata_only: true,
    };
  });
}

// ---- deciding --------------------------------------------------------------------

export interface OperatorDecideInput {
  readonly db: DatabaseType.Database;
  readonly runtime: ResumeInput["runtime"];
  readonly executionId: string;
  readonly decision: OperatorDecision;
  readonly decisionToken: string;
  readonly boundHash: string;
  readonly now?: number;
  readonly signal?: AbortSignal;
  readonly recordEvent?: ResumeInput["recordEvent"];
  readonly currentGrant?: ResumeInput["currentGrant"];
}

const UNIFORM_REJECTION: OperatorDecisionResult = {
  httpStatus: 401,
  body: {
    ok: false,
    executionId: "",
    decision: "DENIED",
    reason: "operator_decision_rejected",
    message: "Operator decision rejected.",
  },
};

export async function decideAsOperator(
  input: OperatorDecideInput,
): Promise<OperatorDecisionResult> {
  const now = input.now ?? Date.now();
  const verdict = verifyDecisionToken(
    input.executionId,
    input.decisionToken,
    input.boundHash,
    now,
  );
  if (!verdict.ok) {
    // Uniform: a forged id, a replay, a stale view and a wrong hash all look the same.
    return {
      ...UNIFORM_REJECTION,
      body: {
        ...UNIFORM_REJECTION.body,
        executionId: input.executionId,
        decision: input.decision,
      },
    };
  }
  consumeDecisionToken(input.executionId); // single-use, even if what follows fails

  const approvalToken = peekOperatorToken(input.executionId, now);
  if (approvalToken === null) {
    return {
      httpStatus: 409,
      body: {
        ok: false,
        executionId: input.executionId,
        decision: input.decision,
        reason: "operator_token_unavailable",
        message:
          "This approval can no longer be decided from the operator surface; it will expire.",
      },
    };
  }

  // The frozen path, exactly as the chat inlet enters it.
  const result = await resumeApproval({
    db: input.db,
    runtime: input.runtime,
    executionId: input.executionId,
    decision: input.decision,
    approvalToken,
    now,
    signal: input.signal,
    recordEvent: input.recordEvent,
    currentGrant: input.currentGrant,
  });
  forgetOperatorToken(input.executionId);
  return result;
}

// ---- loopback + same-origin guard (EoP-17) -------------------------------------------

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isOperatorRequestAllowed(
  req: {
    readonly url: string;
    readonly headers: { get(name: string): string | null };
  },
  options: { readonly mutating: boolean },
): boolean {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return false;
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) return false;

  const site = req.headers.get("sec-fetch-site");
  if (site !== null) {
    if (
      options.mutating
        ? site !== "same-origin"
        : site !== "same-origin" && site !== "none"
    ) {
      return false;
    }
  }
  const origin = req.headers.get("origin");
  if (origin !== null && origin !== url.origin) return false;
  // A mutating request with neither header is a non-browser client on loopback
  // (curl, a script): allowed — the same trust as the chat route today.
  return true;
}
