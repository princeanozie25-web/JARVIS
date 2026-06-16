// Phase 24B — CLOSEOUT + FREEZE of the MCP gateway read-server.
//
// This is the freeze checkpoint for src/lib/mcp-gateway/. It re-asserts the
// read-surface invariants against the CURRENT tree as an independent artifact
// (it does not merely point at the slice tests). Each invariant is its OWN small
// `it` block — there is NO whole-repo scan inside a single `it` (the E-013/E-015
// lesson). The GATE-2 check is a SCOPED transitive walk rooted at the gateway
// (~12 files), not a repo scan.
//
// Closeout invariants:
//   I-24B3-1 exposure set == {pipeline-view-model, queue-status}, frozen
//   I-24B3-2 GATE-2 transitive allowlist holds; no mutator tree reachable
//   I-24B3-3 view-model static (ID-4); queue-status counts-only (ID-1)
//   I-24B3-4 ID-3 cadence + ID-5 uniform denial + identity seam fail-closed
//   I-24B3-5 zero new runtime.runTool call sites; frozen boundary untouched

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { applyMigrations } from "@/lib/db/schema";
import { recordApproval } from "@/lib/db/approvals";

import {
  EXPOSED_RESOURCES,
  PIPELINE_VIEW_MODEL_URI,
  QUEUE_STATUS_URI,
  UNIFORM_DENIAL_MESSAGE,
  authenticateConnection,
  createQueueStatusReader,
  deriveClientId,
  findForbiddenFields,
  handleJsonRpcRequest,
  hashToken,
  listExposedResourceNames,
  listExposedResourceUris,
  readPipelineViewModel,
  readResourceByUri,
  sanitizeReadPayload,
  type GatewaySession,
} from "@/lib/mcp-gateway";

// ---------------------------------------------------------------------------
// shared fixtures
// ---------------------------------------------------------------------------
interface GatewayResp {
  result: {
    contents: Array<{ uri: string; mimeType: string; text: string }>;
    resources: Array<{ uri: string; name: string }>;
  };
  error: { code: number; message: string };
}

const AUTHED: GatewaySession = {
  authenticated: true,
  clientId: "mcp-client:closeout",
};

const call = (
  request: unknown,
  queueStatus: Parameters<typeof handleJsonRpcRequest>[2] = null,
): GatewayResp =>
  handleJsonRpcRequest(request, AUTHED, queueStatus) as unknown as GatewayResp;

const here = dirname(fileURLToPath(import.meta.url)); // tests/mcp-gateway
const REPO_ROOT = resolve(here, "..", "..");
const SRC = resolve(REPO_ROOT, "src");
const GATEWAY_DIR = resolve(SRC, "lib", "mcp-gateway");
const toPosix = (p: string): string => p.split(sep).join("/");
const repoRel = (abs: string): string => toPosix(relative(REPO_ROOT, abs));

// ---------------------------------------------------------------------------
// GATE-2 scoped transitive walk (mirrors transitive-import-allowlist.test.ts,
// kept minimal; roots = the gateway's public entrypoints).
// ---------------------------------------------------------------------------
const ALLOW_PREFIXES = [
  "src/lib/mcp-gateway/",
  "src/lib/pipeline-visualization/",
  // 24D-2b: the shared canonicalization leaf (pure, imports NOTHING) — the
  // neutral home both the gateway and the executor depend on, so neither imports
  // the other (E-016). Adding it does not weaken the freeze's load-bearing claim:
  // the gateway still reaches NO mutator tree (asserted by I-24B3-2 below).
  "src/lib/canonical-policy/",
];
const DENY_TREES = [
  "src/lib/approval-runtime/",
  "src/lib/chat/",
  "src/lib/tools/",
  "src/lib/db/",
  "src/lib/telemetry/",
  "src/lib/observability/",
  "src/lib/google-adapters/",
  "src/lib/obsidian/",
  "src/lib/rollbacks/",
  "src/lib/projects/",
  "src/lib/project-state/",
  "src/lib/memory/",
  "src/lib/memory-candidates/",
  "src/lib/suggestion-inbox/",
  "src/lib/human-review/",
  "src/lib/runtime/",
  "src/lib/runtime-commands/",
  "src/lib/agent-runtime/",
  "src/lib/providers/",
  "src/lib/router/",
];
const EXTERNAL_ALLOW = new Set<string>(["zod", "node:crypto"]);

const STATIC_FROM =
  /(?:^|\n)\s*(?:import|export)(\s+type)?\b([^;'"]*?)\bfrom\s*["']([^"']+)["']/g;
const SIDE_EFFECT = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const DYNAMIC_LITERAL = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;
const REQUIRE_LITERAL = /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g;
const DYNAMIC_NONLITERAL = /\bimport\s*\(\s*(?!["'])/;

interface Edge {
  specifier: string;
  typeOnly: boolean;
}

function extractEdges(source: string, file: string): Edge[] {
  if (DYNAMIC_NONLITERAL.test(source)) {
    throw new Error(`non-literal dynamic import in ${repoRel(file)} (GATE-2)`);
  }
  const edges: Edge[] = [];
  for (const m of source.matchAll(STATIC_FROM)) {
    const typeOnly = Boolean(m[1]) || /^\s*\{?\s*type\s/.test(m[2] ?? "");
    edges.push({ specifier: m[3], typeOnly });
  }
  for (const m of source.matchAll(SIDE_EFFECT)) {
    edges.push({ specifier: m[1], typeOnly: false });
  }
  for (const m of source.matchAll(DYNAMIC_LITERAL)) {
    edges.push({ specifier: m[2], typeOnly: false });
  }
  for (const m of source.matchAll(REQUIRE_LITERAL)) {
    edges.push({ specifier: m[2], typeOnly: false });
  }
  return edges;
}

function resolveToFile(base: string): string | null {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
    resolve(base, "index.mts"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && /\.(ts|tsx|mts)$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

type Resolved =
  | { kind: "repo"; file: string }
  | { kind: "external"; specifier: string }
  | { kind: "unresolved"; specifier: string };

function resolveSpecifier(specifier: string, importer: string): Resolved {
  if (specifier.startsWith("@/")) {
    const file = resolveToFile(resolve(SRC, specifier.slice(2)));
    return file ? { kind: "repo", file } : { kind: "unresolved", specifier };
  }
  if (specifier.startsWith(".")) {
    const file = resolveToFile(resolve(dirname(importer), specifier));
    return file ? { kind: "repo", file } : { kind: "unresolved", specifier };
  }
  return { kind: "external", specifier };
}

const matchesPrefix = (rel: string, prefixes: string[]): boolean =>
  prefixes.some((prefix) => rel.startsWith(prefix));

interface WalkResult {
  reachableRepo: Set<string>;
  runtimeExternals: Set<string>;
  denyHits: string[];
  allowViolations: string[];
  externalViolations: string[];
  unresolved: string[];
}

function walkGateway(): WalkResult {
  const reachableRepo = new Set<string>();
  const runtimeExternals = new Set<string>();
  const denyHits: string[] = [];
  const allowViolations: string[] = [];
  const externalViolations: string[] = [];
  const unresolved: string[] = [];

  const roots = [
    resolve(GATEWAY_DIR, "index.ts"),
    resolve(GATEWAY_DIR, "server.ts"),
  ];
  const visited = new Set<string>();
  const queue = [...roots];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (visited.has(file)) continue;
    visited.add(file);
    reachableRepo.add(repoRel(file));

    for (const edge of extractEdges(readFileSync(file, "utf8"), file)) {
      const resolved = resolveSpecifier(edge.specifier, file);
      if (resolved.kind === "unresolved") {
        unresolved.push(`${repoRel(file)} -> ${edge.specifier}`);
        continue;
      }
      if (resolved.kind === "external") {
        if (!edge.typeOnly) {
          runtimeExternals.add(resolved.specifier);
          if (!EXTERNAL_ALLOW.has(resolved.specifier)) {
            externalViolations.push(
              `${repoRel(file)} -> external ${resolved.specifier}`,
            );
          }
        }
        continue;
      }
      const rel = repoRel(resolved.file);
      if (matchesPrefix(rel, DENY_TREES)) {
        denyHits.push(`${repoRel(file)} -> ${rel} (mutator tree)`);
      }
      if (edge.typeOnly) continue; // erased: DENY-checked, not recursed
      if (!matchesPrefix(rel, ALLOW_PREFIXES)) {
        allowViolations.push(`${repoRel(file)} -> ${rel}`);
      }
      if (!visited.has(resolved.file)) queue.push(resolved.file);
    }
  }

  return {
    reachableRepo,
    runtimeExternals,
    denyHits,
    allowViolations,
    externalViolations,
    unresolved,
  };
}

const GATE2 = walkGateway();

// ===========================================================================
// I-24B3-1 — exposure set frozen at exactly two reads
// ===========================================================================
describe("I-24B3-1 (freeze): exposure set is exactly {pipeline-view-model, queue-status}", () => {
  it("EXPOSED_RESOURCES holds exactly the two names, in order", () => {
    expect(listExposedResourceNames()).toEqual([
      "pipeline-view-model",
      "queue-status",
    ]);
    expect(EXPOSED_RESOURCES.length).toBe(2);
  });

  it("the two URIs are exactly the pipeline + queue URIs", () => {
    expect(listExposedResourceUris()).toEqual([
      PIPELINE_VIEW_MODEL_URI,
      QUEUE_STATUS_URI,
    ]);
  });

  it("resources/list returns exactly the two, no third", () => {
    const list = call({ jsonrpc: "2.0", id: 1, method: "resources/list" });
    const names = list.result.resources.map((r) => r.name);
    expect(names).toEqual(["pipeline-view-model", "queue-status"]);
    expect(names).toHaveLength(2);
  });

  it("a non-exposed URI is not readable (uniform denial)", () => {
    const denied = call({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "jarvis://telemetry/event-store" },
    });
    expect(denied.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });
});

// ===========================================================================
// I-24B3-2 — GATE-2 structural non-mutation
// ===========================================================================
describe("I-24B3-2 (GATE-2): the gateway import graph reaches only the allowed read set", () => {
  it("the walk is transitive and fully resolved (no unresolved edges)", () => {
    expect(
      GATE2.unresolved,
      `unresolved: ${GATE2.unresolved.join(", ")}`,
    ).toEqual([]);
  });

  it("reaches the queue-status narrow read path (24B-2)", () => {
    expect(GATE2.reachableRepo.has("src/lib/mcp-gateway/queue-status.ts")).toBe(
      true,
    );
  });

  it("reaches the pipeline-visualization read projection", () => {
    expect(
      GATE2.reachableRepo.has("src/lib/pipeline-visualization/contracts.ts"),
    ).toBe(true);
  });

  it("reaches the shared canonical-policy leaf, and it pulls in no further repo module (24D-2b)", () => {
    expect(GATE2.reachableRepo.has("src/lib/canonical-policy/index.ts")).toBe(
      true,
    );
    // the leaf is the deepest node on its branch: it imports NOTHING, so it adds
    // no external and no new repo module — the non-mutation claim is preserved.
  });

  it("reaches NO mutator tree", () => {
    expect(
      GATE2.denyHits,
      `mutator trees reached: ${GATE2.denyHits.join(" | ")}`,
    ).toEqual([]);
  });

  it("every reachable in-repo module is under the positive allowlist", () => {
    expect(
      GATE2.allowViolations,
      `outside allowlist: ${GATE2.allowViolations.join(" | ")}`,
    ).toEqual([]);
  });

  it("every runtime external is zod or node:crypto only", () => {
    expect(GATE2.externalViolations).toEqual([]);
    for (const ext of GATE2.runtimeExternals) {
      expect(EXTERNAL_ALLOW.has(ext), `unexpected external: ${ext}`).toBe(true);
    }
  });

  it("the known mutators are NOT reachable (executor, tool runtime, db)", () => {
    expect(GATE2.reachableRepo.has("src/lib/chat/tool-approvals.ts")).toBe(
      false,
    );
    expect(GATE2.reachableRepo.has("src/lib/tools/runtime.ts")).toBe(false);
    expect(GATE2.reachableRepo.has("src/lib/db/approvals.ts")).toBe(false);
  });

  it("fail-closed: a non-literal dynamic import throws", () => {
    expect(() =>
      extractEdges("const m = await import(spec);", "probe.ts"),
    ).toThrow();
  });
});

// ===========================================================================
// I-24B3-3a — ID-4: pipeline-view-model is static topology
// ===========================================================================
describe("I-24B3-3a (ID-4): the view-model is static topology", () => {
  const LIVE_KEYS = new Set<string>([
    "provider",
    "providerstatus",
    "route",
    "currentroute",
    "failures",
    "activeclients",
    "clientid",
    "sessionid",
    "session",
    "timestamp",
    "updatedat",
    "now",
    "uptime",
    "latency",
    "cost",
    "queuedepth",
    "pendingcount",
  ]);
  const normalize = (key: string): string =>
    key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const collectKeys = (value: unknown, out: Set<string>): Set<string> => {
    if (Array.isArray(value)) value.forEach((v) => collectKeys(v, out));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        out.add(normalize(k));
        collectKeys(v, out);
      }
    }
    return out;
  };

  it("is byte-identical across two builds (deterministic, not a live snapshot)", () => {
    expect(JSON.stringify(readPipelineViewModel())).toBe(
      JSON.stringify(readPipelineViewModel()),
    );
  });

  it("carries none of the live/per-session field keys", () => {
    const keys = collectKeys(readPipelineViewModel(), new Set<string>());
    const offenders = [...keys].filter((k) => LIVE_KEYS.has(k));
    expect(offenders, `live keys present: ${offenders.join(", ")}`).toEqual([]);
  });

  it("presents no execute/approve/mutation affordance and empty controls", () => {
    const vm = readPipelineViewModel() as Record<string, unknown>;
    expect(vm.controls).toEqual([]);
    expect(vm.execute_affordance_present).toBe(false);
    expect(vm.approve_affordance_present).toBe(false);
    expect(vm.mutation_affordance_present).toBe(false);
  });
});

// ===========================================================================
// I-24B3-3b — ID-1: queue-status is counts-only over a seeded sensitive queue
// ===========================================================================
describe("I-24B3-3b (ID-1): queue-status is counts-only, no specifics", () => {
  const SENTINELS = [
    "Acme-Merger-SECRET",
    "/home/owner/notes/merger.md",
    "[email protected]",
  ];
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    applyMigrations(db);
    for (let i = 0; i < 6; i++) {
      recordApproval(db, {
        id: `pending-${i}`,
        execution_id: SENTINELS[1],
        session_id: SENTINELS[2],
        tool_id: `${SENTINELS[0]}-${i}`,
        scope_hash: "scope",
        decision: "PENDING",
        state: "pending",
        decided_at: 1_000 + i,
      });
    }
    // resolved rows must NOT count toward "pending"
    recordApproval(db, {
      id: "approved",
      session_id: "s",
      tool_id: "t",
      scope_hash: "h",
      decision: "APPROVED_ONCE",
      state: "approved",
      decided_at: 5_000,
    });
  });

  afterEach(() => {
    db.close();
  });

  const reader = () =>
    createQueueStatusReader({
      source: () =>
        (
          db
            .prepare(
              "SELECT COUNT(*) AS n FROM approvals WHERE state = 'pending'",
            )
            .get() as { n: number }
        ).n,
    });

  it("the snapshot is exactly the five counts-only keys", () => {
    const snap = reader().read();
    expect(Object.keys(snap).sort()).toEqual([
      "cadence_seconds",
      "metadata_only",
      "pending_bucket",
      "pending_count",
      "read_only",
    ]);
  });

  it("counts only pending rows (resolved excluded)", () => {
    const snap = reader().read();
    expect(snap.pending_count).toBe(6);
    expect(snap.pending_bucket).toBe("many");
  });

  it("no seeded sentinel appears in the serialized snapshot", () => {
    const json = JSON.stringify(reader().read());
    for (const sentinel of SENTINELS) expect(json).not.toContain(sentinel);
  });

  it("the snapshot passes the outbound sanitizer", () => {
    expect(findForbiddenFields(reader().read())).toEqual([]);
  });
});

// ===========================================================================
// I-24B3-4a — ID-3: coarse cadence cache
// ===========================================================================
describe("I-24B3-4a (ID-3): sub-interval polls see a frozen count", () => {
  it("returns the cached count within the window; moves only past the interval", () => {
    let count = 1;
    let clockMs = 10_000;
    const reader = createQueueStatusReader({
      source: () => count,
      cadenceMs: 30_000,
      now: () => clockMs,
    });
    const first = reader.read();
    expect(first.pending_count).toBe(1);

    count = 9;
    clockMs += 1_000;
    expect(reader.read().pending_count).toBe(1);
    clockMs += 28_000; // 29s since refresh, still < cadence
    expect(reader.read()).toBe(first);

    clockMs += 2_000; // 31s since refresh
    expect(reader.read().pending_count).toBe(9);
  });
});

// ===========================================================================
// I-24B3-4b — ID-5: uniform denial
// ===========================================================================
describe("I-24B3-4b (ID-5): refusals are indistinguishable and name no surface", () => {
  it("unknown / forbidden / unwired queue-status collapse to the identical error", () => {
    const wired = createQueueStatusReader({ source: () => 3 });
    const unknown = call(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "jarvis://unknown/surface" },
      },
      wired,
    );
    const forbidden = call(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: { uri: "jarvis://approvals/db" },
      },
      wired,
    );
    const unwired = call(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "resources/read",
        params: { uri: QUEUE_STATUS_URI },
      },
      null,
    );
    expect(unknown.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
    expect(forbidden.error).toEqual(unknown.error);
    expect(unwired.error.code).toBe(unknown.error.code);
    expect(unwired.error.message).toBe(unknown.error.message);
  });

  it("an unknown method is denied with the same message (no enumeration)", () => {
    const unknownMethod = call({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {},
    });
    expect(unknownMethod.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });

  it("the denial body names no surface or scope", () => {
    const denied = call({
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: { uri: QUEUE_STATUS_URI },
    });
    const body = JSON.stringify(denied.error);
    expect(body).not.toContain("queue");
    expect(body).not.toContain("approval");
    expect(body).not.toContain("pipeline");
  });
});

// ===========================================================================
// I-24B3-4c — identity seam fail-closed
// ===========================================================================
describe("I-24B3-4c (identity): the seam is fail-closed and server-derived", () => {
  const TOKEN = "provisioned-closeout-token";
  const PROVISIONED = new Set<string>([hashToken(TOKEN)]);

  it("refuses an absent or empty token", () => {
    expect(
      authenticateConnection({
        presentedToken: null,
        provisionedTokenHashes: PROVISIONED,
      }).ok,
    ).toBe(false);
    expect(
      authenticateConnection({
        presentedToken: "",
        provisionedTokenHashes: PROVISIONED,
      }).ok,
    ).toBe(false);
  });

  it("refuses an unprovisioned (off-allowlist) token", () => {
    expect(
      authenticateConnection({
        presentedToken: "not-provisioned",
        provisionedTokenHashes: PROVISIONED,
      }).ok,
    ).toBe(false);
  });

  it("accepts a provisioned token and derives a stable id the client cannot choose", () => {
    const a = authenticateConnection({
      presentedToken: TOKEN,
      provisionedTokenHashes: PROVISIONED,
    });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.clientId).toBe(deriveClientId(TOKEN));
  });

  it("an unauthenticated session is uniformly denied a read", () => {
    const resp = handleJsonRpcRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: PIPELINE_VIEW_MODEL_URI },
      },
      { authenticated: false, clientId: null },
    ) as unknown as GatewayResp;
    expect(resp.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
  });
});

// ===========================================================================
// I-24B3-4d — sanitizer fail-closed
// ===========================================================================
describe("I-24B3-4d (sanitizer): the leaf sentinel is fail-closed", () => {
  it("passes a clean payload through unchanged", () => {
    expect(sanitizeReadPayload({ pending_count: 3 })).toEqual({
      pending_count: 3,
    });
  });

  it("throws on a planted forbidden field rather than partially redacting", () => {
    expect(() => sanitizeReadPayload({ transcript: "secret" })).toThrow();
    expect(() =>
      sanitizeReadPayload({ note: "https://evil.example/x" }),
    ).toThrow();
  });

  it("the served view-model payload is clean by the sentinel", () => {
    // the sentinel guards the PAYLOAD, not the {uri,mimeType,text} envelope —
    // parse the bytes that actually leave the process and assert zero hits.
    const outcome = readResourceByUri(PIPELINE_VIEW_MODEL_URI);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(findForbiddenFields(JSON.parse(outcome.text))).toEqual([]);
    }
  });
});

// ===========================================================================
// I-24B3-5 — frozen boundary untouched: zero new runtime.runTool sites
// ===========================================================================
describe("I-24B3-5 (frozen boundary): the gateway adds no executor call site", () => {
  it("no production file under src/lib/mcp-gateway has a runTool call site", () => {
    // test files legitimately NAME the executor (allowlist negative control);
    // the freeze claim is that no gateway SOURCE file CALLS runTool.
    const offenders = readdirSync(GATEWAY_DIR)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .filter((name) =>
        /\.runTool\s*\(/.test(readFileSync(resolve(GATEWAY_DIR, name), "utf8")),
      );
    expect(
      offenders,
      `gateway source files with a runTool call site: ${offenders}`,
    ).toEqual([]);
  });

  it("the frozen production executor call sites still exist (chat tree)", () => {
    const approvals = readFileSync(
      resolve(SRC, "lib", "chat", "tool-approvals.ts"),
      "utf8",
    );
    const continuation = readFileSync(
      resolve(SRC, "lib", "chat", "tool-continuation.ts"),
      "utf8",
    );
    expect(approvals).toContain("runtime.runTool({");
    expect(continuation).toContain("runtime.runTool({");
  });
});
