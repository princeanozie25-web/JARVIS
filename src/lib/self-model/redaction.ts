// Self Model (E-050) — the leak guard.
//
// Introspection may say "an OpenAI credential is configured"; it may never
// carry the credential. Every payload that leaves the Self Model (tool
// results, projections, writer events, the reasoning context) is walked for
// forbidden KEYS (inherited from the architecture graph's raw-key ban plus
// credential vocabulary) and secret-shaped VALUES.
import { ARCHITECTURE_GRAPH_FORBIDDEN_RAW_KEYS } from "../architecture-graph/contracts";

export const SELF_MODEL_FORBIDDEN_KEYS = [
  ...ARCHITECTURE_GRAPH_FORBIDDEN_RAW_KEYS,
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "password",
  "passwd",
  "credential",
  "credentials",
  "authorization",
  "private_key",
  "access_key",
  "secret_key",
  "client_secret",
  "bearer",
  "cookie",
  "session_token",
  "env",
  "process_env",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(
  SELF_MODEL_FORBIDDEN_KEYS.map((k) => k.toLowerCase()),
);

// Value shapes that are secrets wherever they appear. Kept deliberately
// broad: a false positive costs one redaction; a false negative leaks a key.
export const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/, // OpenAI-style (also matches sk-ant-…)
  /\bsk-ant-[A-Za-z0-9_-]{8,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack
  /\bAIza[0-9A-Za-z_-]{30,}/, // Google API key
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/, // JWT
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{12,}/i,
];

export interface SelfRedactionFinding {
  path: string;
  reason: "forbidden_key" | "secret_value";
}

/** Depth-first walk; returns the first violation or null. */
export function findSelfLeak(
  value: unknown,
  path = "$",
  depth = 0,
): SelfRedactionFinding | null {
  if (depth > 32) return null;
  if (typeof value === "string") {
    return SECRET_VALUE_PATTERNS.some((re) => re.test(value))
      ? { path, reason: "secret_value" }
      : null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findSelfLeak(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (isForbiddenKey(key))
        return { path: `${path}.${key}`, reason: "forbidden_key" };
      const hit = findSelfLeak(child, `${path}.${key}`, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

// Marker keys the governed contracts use to ASSERT absence
// ("secret_material_included: false", "raw_payload_posture") are not
// carriers; they are exempt from the substring rule, never from the exact set.
const MARKER_KEY =
  /(_included|_posture|_count|_enabled|_configured|_withheld|_performed)$/;

export function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase();
  if (FORBIDDEN_KEY_SET.has(k)) return true;
  if (MARKER_KEY.test(k)) return false;
  // "openai_api_key", "x-access-token", "dbPassword" …
  return /(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|credential|private[_-]?key)/.test(
    k,
  );
}

export class SelfModelLeakError extends Error {
  constructor(readonly finding: SelfRedactionFinding) {
    super(`self-model payload refused: ${finding.reason} at ${finding.path}`);
    this.name = "SelfModelLeakError";
  }
}

/** Throws rather than redacting: a leak is a bug to surface, not to hide. */
export function assertNoSelfLeak<T>(value: T): T {
  const finding = findSelfLeak(value);
  if (finding) throw new SelfModelLeakError(finding);
  return value;
}

/** For statements built from free text (a prompt line, a registry title). */
export function scrubText(text: string): string {
  let out = text;
  for (const re of SECRET_VALUE_PATTERNS)
    out = out.replace(
      new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`),
      "[redacted]",
    );
  return out;
}
