// MCP gateway — outbound read sanitizer (the hygiene gate every read passes
// through before leaving the process).
//
// WHY THIS LIVES HERE (and is not imported from an existing subsystem): the
// repo's existing redaction/hygiene gates are domain-coupled (voice telemetry,
// vision frames, command-center orb — each keyed to a specific event shape) and
// several sit inside subsystem trees that the EoP-6 transitive import allowlist
// (GATE-2) must deny. Importing one would drag a denied tree into the gateway's
// import graph. So the gateway owns a small, import-safe sentinel that FOLLOWS
// the established Phase-23 pattern (normalize key -> forbidden-set -> safe
// scalar shape; see src/lib/voice-streaming/telemetry-hygiene.ts). This module
// imports nothing — it is a leaf, by design.

/** Forbidden field-name classes (normalized). A read response must never carry
 * a key in these classes. Mirrors the Phase-23 forbidden vocabulary. */
const FORBIDDEN_KEY_LIST = [
  // raw payloads / bodies
  "payload",
  "rawpayload",
  "body",
  "rawbody",
  "requestpayload",
  "responsepayload",
  "approvalpayload",
  // content / transcripts / model output
  "transcript",
  "transcripttext",
  "spokentext",
  "assistanttext",
  "assistantbody",
  "modeloutput",
  "tooloutput",
  "filecontent",
  "code",
  "codeblock",
  "prompt",
  "personalcontext",
  "memorycontents",
  // audio / media
  "audio",
  "rawaudio",
  "audiodata",
  "audioblob",
  "audiourl",
  "pcm",
  "frame",
  "framedata",
  // locators
  "url",
  "href",
  "uri",
  "path",
  "filepath",
  "networkurl",
  // secrets / credentials / identity material
  "secret",
  "token",
  "tokenhash",
  "apikey",
  "providersecret",
  "password",
  "credential",
  "authorization",
  "cookie",
  // governance internals that must never ride a read
  "auditlog",
  "command",
  "executioncommand",
] as const;

const FORBIDDEN_KEYS = new Set<string>(FORBIDDEN_KEY_LIST);

/** Allow the static pipeline view-model's structural identifier keys, which are
 * NOT payloads even though their substrings could brush a forbidden token. They
 * are matched EXACTLY (normalized) and only ever hold enum/label strings. */
const STRUCTURAL_KEY_ALLOWLIST = new Set<string>([
  // pipeline view-model identifiers (static topology)
  "transitionid",
  "fromstageid",
  "tostageid",
  "stageid",
  "boundaryid",
]);

/** Structural value patterns that signal a leaked locator/secret in a STRING
 * VALUE (not a key). Deliberately narrow so prose descriptions (which may use
 * words like "transcript" or "path" in a sentence) do not false-positive. */
const URL_VALUE = /\b[a-z][a-z0-9+.-]*:\/\//i; // scheme://
const ABS_PATH_VALUE = /(^|[\s"'(])([A-Za-z]:\\|\/)[\w.-]+[\\/][\w./\\-]+/; // C:\a\b or /a/b
const SECRET_VALUE = /\b(?:[A-Za-z0-9_-]{40,}|[A-Fa-f0-9]{32,})\b/; // long opaque blob

export function normalizeFieldKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isForbiddenKey(key: string): boolean {
  const normalized = normalizeFieldKey(key);
  if (STRUCTURAL_KEY_ALLOWLIST.has(normalized)) return false;
  return FORBIDDEN_KEYS.has(normalized);
}

function stringValueHit(value: string): string | null {
  if (URL_VALUE.test(value)) return "url-value";
  if (ABS_PATH_VALUE.test(value)) return "path-value";
  if (SECRET_VALUE.test(value)) return "secret-value";
  return null;
}

/**
 * The forbidden-field sentinel. Walks `value` (objects + arrays, transitively)
 * and returns the dotted paths of every violation: a forbidden KEY name, or a
 * STRING VALUE that structurally looks like a url / absolute path / secret. An
 * empty array means clean. Exported so I-24B1-2 can loop over a read response
 * and assert zero hits.
 */
export function findForbiddenFields(value: unknown, basePath = ""): string[] {
  const hits: string[] = [];

  const walk = (node: unknown, path: string): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      const hit = stringValueHit(node);
      if (hit) hits.push(`${path || "<root>"} [${hit}]`);
      return;
    }
    if (typeof node === "number" || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (typeof node === "object") {
      for (const [key, child] of Object.entries(
        node as Record<string, unknown>,
      )) {
        const childPath = path ? `${path}.${key}` : key;
        if (isForbiddenKey(key)) hits.push(`${childPath} [forbidden-key]`);
        walk(child, childPath);
      }
      return;
    }
    // functions / symbols / bigint have no business in a read response
    hits.push(`${path || "<root>"} [non-serializable:${typeof node}]`);
  };

  walk(value, basePath);
  return hits;
}

/**
 * The sanitizer gate. Returns a JSON-safe deep copy of `value` after proving it
 * carries no forbidden field. FAIL-CLOSED: if the sentinel finds anything, it
 * throws rather than emitting a partially-redacted response — a read that can't
 * be proven clean does not leave the process.
 */
export function sanitizeReadPayload<T>(value: T): T {
  const clone = JSON.parse(JSON.stringify(value)) as T;
  const hits = findForbiddenFields(clone);
  if (hits.length > 0) {
    throw new Error(
      `mcp_gateway_sanitizer_blocked: read response carried forbidden field(s): ${hits.join(", ")}`,
    );
  }
  return clone;
}

export const MCP_GATEWAY_FORBIDDEN_KEY_LIST = FORBIDDEN_KEY_LIST;
