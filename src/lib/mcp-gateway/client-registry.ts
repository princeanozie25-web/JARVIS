// MCP gateway — FC-3 identity + token lifecycle (24D-1).
//
// "WHO are you and may you connect" — NOT "what may you do" (per-client scope is
// 24D-2). A connection presents a token out-of-band (spawn env), never in a
// request body. The server hashes it, looks the hash up in the human-provisioned
// client registry (the allowlist), and derives client_id from the registry —
// the client can NEVER choose its own identity (FC-3).
//
// TOKEN LIFECYCLE (operational discipline — without it a token is long-lived local
// root to the queue):
//   * hashes live OUTSIDE the repo: the registry is carried by an env var
//     (JARVIS_MCP_CLIENT_REGISTRY) holding ONLY token HASHES + metadata. The
//     plaintext token exists only at the client. The repo contains NO token, NO
//     hash, NO secrets file (.env* is gitignored; the default registry is EMPTY =>
//     refuse-all, fail-closed).
//   * human-provisioned: JARVIS never issues a token to itself or a client. A human
//     generates a token, stores its sha256 hash in the registry, and hands the
//     plaintext to the client (see PROVISIONING below).
//   * revocable: set `enabled: false` for a client (or remove it) => refused at
//     connection. (FC-2's 24C-2b guard re-checks at approval time.)
//   * rotatable: provision a NEW hash and disable the OLD one (record the old hash
//     in `rotated_from_hash`). Rotation revokes the prior token.
//   * last-used: recorded per client via an INJECTED store (the gateway never
//     imports db/) — keyed by client_id, NEVER by token/hash.
//   * NEVER logged: this module returns a coarse refusal reason (an enum, never the
//     token); the wire collapses every refusal to the uniform denial (ID-5). The
//     token and its hash appear in NO log, telemetry, audit, or error string.
//   * backup-excluded: the env-carried registry is a secret; back it up out of band,
//     never in a repo/export that could leak hashes.
//
// PROVISIONING (a human does this; JARVIS does not):
//   1. token="$(openssl rand -base64 32 | tr -d '\n')"   # generate at the client
//   2. hash="$(printf %s "$token" | openssl dgst -sha256 -hex | awk '{print $NF}')"
//   3. add to the env JSON (outside the repo):
//        JARVIS_MCP_CLIENT_REGISTRY='{"<hash>":{"client_id":"mcp-client:phone",
//          "enabled":true,"created_at_ms":1750000000000}}'
//   4. give the PLAINTEXT token to the client; never store the plaintext anywhere.
//
// GATE-2: imports only node:crypto (allowlisted) + the local identity leaf. No db,
// no approval-runtime, no fs — the registry is parsed from process.env (no file
// read), and last-used persistence is an INJECTED callback wired by the host.

import { timingSafeEqual } from "node:crypto";

import { hashToken } from "./identity";

/** A provisioned client. The token HASH is the registry key; this is the value. */
export interface ProvisionedClient {
  /** Server-assigned identity for this token. NEVER from a request body. */
  client_id: string;
  /** Disabled/revoked clients are refused even with a structurally valid token. */
  enabled: boolean;
  created_at_ms: number;
  /** If this token replaced an earlier one (rotation), the prior token's hash. */
  rotated_from_hash: string | null;
}

/** token_hash (lowercase sha256 hex) -> provisioned client. The allowlist. */
export type ProvisionedClientRegistry = ReadonlyMap<string, ProvisionedClient>;

/** Injected last-used recorder. Wired by the host to persist OUTSIDE the gateway
 * import graph (db/file). Keyed by client_id — the hash is NEVER passed out. */
export type RecordLastUsed = (clientId: string, atMs: number) => void;

export type ClientAuthRefusalReason =
  | "absent_token" // no token / empty / whitespace
  | "malformed_token" // present but not a structurally valid opaque secret
  | "not_provisioned" // valid shape, but hash not on the allowlist
  | "disabled"; // provisioned but revoked/disabled

export type ClientAuthResult =
  | { ok: true; clientId: string }
  | { ok: false; reason: ClientAuthRefusalReason };

export const CLIENT_REGISTRY_ENV_VAR = "JARVIS_MCP_CLIENT_REGISTRY" as const;

/** A token is an opaque secret: a bounded run of base64url/url-safe characters.
 * Anything else (empty, too short, control chars, oversized) is malformed. */
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=:-]{16,512}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

export function isStructurallyValidToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Constant-time lookup: compare the presented hash against EVERY provisioned hash
 * with timingSafeEqual and no early exit, so the time taken does not reveal which
 * (or whether an) entry matched. Returns the matched client or null.
 */
function matchProvisionedClient(
  registry: ProvisionedClientRegistry,
  presentedHashHex: string,
): ProvisionedClient | null {
  const presented = Buffer.from(presentedHashHex, "hex");
  let match: ProvisionedClient | null = null;
  for (const [storedHex, client] of registry) {
    const stored = Buffer.from(storedHex, "hex");
    if (
      stored.length === presented.length &&
      timingSafeEqual(stored, presented)
    ) {
      match = client;
    }
  }
  return match;
}

/**
 * FC-3 connection authentication. Identity is derived SERVER-SIDE from the token
 * hash via the provisioned registry; there is no input by which a client could
 * supply its own client_id. Fail-closed at every step. On success, records
 * last-used through the injected store (by client_id, never the hash).
 *
 * The result carries only client_id (success) or a coarse reason enum (failure) —
 * NEVER the token or its hash. The caller collapses every failure to the uniform
 * denial (ID-5); it must not echo the reason or the token.
 */
export function authenticateClient(input: {
  presentedToken?: string | null;
  registry: ProvisionedClientRegistry;
  recordLastUsed?: RecordLastUsed;
  now?: () => number;
}): ClientAuthResult {
  const token = input.presentedToken;
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, reason: "absent_token" };
  }
  if (!isStructurallyValidToken(token)) {
    return { ok: false, reason: "malformed_token" };
  }

  const presentedHash = hashToken(token);
  const client = matchProvisionedClient(input.registry, presentedHash);
  if (client === null) return { ok: false, reason: "not_provisioned" };
  if (!client.enabled) return { ok: false, reason: "disabled" };

  const at = (input.now ?? (() => Date.now()))();
  input.recordLastUsed?.(client.client_id, at);
  return { ok: true, clientId: client.client_id };
}

/**
 * Parse the provisioned registry from the env-carried source (hashes only, never
 * plaintext). Empty/absent/malformed env => EMPTY registry => refuse-all
 * (fail-closed). Entries with an invalid hash key or missing client_id are
 * dropped; `enabled` defaults true unless explicitly false.
 */
export function parseClientRegistryFromEnv(
  env: Record<string, string | undefined> = process.env,
): ProvisionedClientRegistry {
  const raw = env[CLIENT_REGISTRY_ENV_VAR] ?? "";
  if (raw.trim().length === 0) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Map(); // malformed env => refuse-all
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return new Map();
  }

  const registry = new Map<string, ProvisionedClient>();
  for (const [rawHash, rec] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    const hash = rawHash.toLowerCase();
    if (!SHA256_HEX.test(hash)) continue;
    if (!rec || typeof rec !== "object") continue;
    const r = rec as Record<string, unknown>;
    if (typeof r.client_id !== "string" || r.client_id.length === 0) continue;
    registry.set(hash, {
      client_id: r.client_id,
      enabled: r.enabled !== false,
      created_at_ms: typeof r.created_at_ms === "number" ? r.created_at_ms : 0,
      rotated_from_hash:
        typeof r.rotated_from_hash === "string" ? r.rotated_from_hash : null,
    });
  }
  return registry;
}
