// MCP gateway — connection-time identity seam (STUB this slice, 24B-1).
//
// Scope this slice: prove the seam exists and is FAIL-CLOSED. A connection must
// present a human-provisioned token; an absent or non-provisioned token is
// refused; the client CANNOT choose its own identity — client_id is derived
// server-side from the token hash, never read from a request body. The full
// token lifecycle (rotation, revocation, last-used, scope, rate limits) is 24D
// and is intentionally NOT built here.
//
// node:crypto is a read-only hashing primitive (no mutation, no I/O); it is the
// single builtin this module needs and is allowlisted by GATE-2.

import { createHash } from "node:crypto";

export interface ConnectionAuthGranted {
  ok: true;
  /** Server-derived from the token hash. Never client-supplied. */
  clientId: string;
}

export interface ConnectionAuthRefused {
  ok: false;
  /** Internal reason; the wire NEVER surfaces this (ID-5 uniform denial). */
  reason: "absent_token" | "not_provisioned";
}

export type ConnectionAuthResult =
  | ConnectionAuthGranted
  | ConnectionAuthRefused;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** client_id is a stable, opaque function of the token — derived, not chosen. */
export function deriveClientId(token: string): string {
  return `mcp-client:${hashToken(token).slice(0, 16)}`;
}

/**
 * Authenticate a connection. The token is presented out-of-band (env/spawn
 * config), never in a request body; `provisionedTokenHashes` is the
 * human-provisioned allowlist (also out-of-band). Fail-closed on absent or
 * unprovisioned token. On success, client_id is DERIVED server-side.
 */
export function authenticateConnection(input: {
  presentedToken?: string | null;
  provisionedTokenHashes: ReadonlySet<string>;
}): ConnectionAuthResult {
  const token = input.presentedToken;
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, reason: "absent_token" };
  }
  const hash = hashToken(token);
  if (!input.provisionedTokenHashes.has(hash)) {
    return { ok: false, reason: "not_provisioned" };
  }
  return { ok: true, clientId: deriveClientId(token) };
}

/**
 * Load the provisioned token-hash allowlist from the environment (a
 * comma/space-separated list of sha256 hex hashes). Tokens and hashes live
 * OUTSIDE the repo (threat-model token-lifecycle rule); this reads hashes only,
 * never a plaintext token, and never logs them. Empty/absent => empty set =>
 * every connection refused (fail-closed).
 */
export function loadProvisionedTokenHashesFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ReadonlySet<string> {
  const raw = env.JARVIS_MCP_PROVISIONED_TOKEN_HASHES ?? "";
  const hashes = raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[a-f0-9]{64}$/.test(entry));
  return new Set(hashes);
}
