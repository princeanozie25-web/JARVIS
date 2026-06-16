// GATE-2 / EoP-6 — the load-bearing structural control (I-24B1-3).
//
// Proves the MCP gateway module is STRUCTURALLY INCAPABLE of reaching any
// mutator: its FULL transitive import graph (direct + barrel re-exports +
// re-export chains + dynamic imports + require) resolves only to the read
// projection and schemas, and reaches NONE of the mutator module trees.
//
// The walk is TRANSITIVE and the policy is a POSITIVE allowlist (default-deny):
// every reachable in-repo module must live under an allowed prefix, every
// external must be explicitly allowed, and the named mutator trees must be
// unreachable entirely. A positive allowlist that is not transitive is a
// negative check in disguise — so this resolves and recurses the real graph.
//
// EDGE SEMANTICS:
//   - DENY is checked on EVERY edge (value, type-only, dynamic) — you may not
//     even *name* a mutator tree.
//   - ALLOW + recursion apply to RUNTIME edges only — `import type`/`export
//     type` are erased by the compiler and load no code, so they are checked
//     against DENY but do not pull a subtree into runtime reachability (this is
//     why the read projection's `import type {GraphifyOverlay}` is fine).
//
// RESIDUAL GAP (reported, not hidden): no `dependency-cruiser` is in the repo,
// so this is an explicit resolver+graph walk, not a compiler-backed one. It is
// fail-closed on the one thing a regex walk cannot prove — a NON-LITERAL
// dynamic import throws. Computed re-exports via `export * as ns` are followed;
// `require()` is followed. 24B-2/24B-3 may add dependency-cruiser for a second,
// compiler-grade enforcement of the same policy.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // src/lib/mcp-gateway
const SRC_ROOT = resolve(here, "..", ".."); // src
const REPO_ROOT = resolve(SRC_ROOT, ".."); // repo root

const toPosix = (p: string): string => p.split(sep).join("/");
const repoRel = (abs: string): string => toPosix(relative(REPO_ROOT, abs));

// ---- policy -----------------------------------------------------------------
const ALLOW_PREFIXES = [
  "src/lib/mcp-gateway/",
  "src/lib/pipeline-visualization/",
];

const EXTERNAL_ALLOW = new Set<string>(["zod", "node:crypto"]);

// EoP-6: these mutator TREES must be unreachable ENTIRELY (named for legible
// failure + direct threat-model mapping). The positive allowlist already
// excludes everything outside ALLOW_PREFIXES; this makes a regression point at
// the exact offending tree.
const DENY_TREES = [
  "src/lib/approval-runtime/", // approval lifecycle writer
  "src/lib/chat/", // tool-approvals EXECUTOR (resumeApproval -> runtime.runTool)
  "src/lib/tools/", // tool runtime + fs/memory/project mutators
  "src/lib/db/", // DB write helpers + event store
  "src/lib/telemetry/", // event-store / telemetry writer
  "src/lib/observability/",
  "src/lib/google-adapters/", // Phase 21B adapter MUTATORS
  "src/lib/obsidian/", // vault file writers
  "src/lib/rollbacks/",
  "src/lib/projects/",
  "src/lib/project-state/",
  "src/lib/memory/",
  "src/lib/memory-candidates/",
  "src/lib/suggestion-inbox/",
  "src/lib/human-review/",
  "src/lib/runtime/", // model runtime
  "src/lib/runtime-commands/", // runtime command execution
  "src/lib/agent-runtime/",
  "src/lib/providers/", // provider network calls
  "src/lib/router/", // routing into execution
];

const EXTERNAL_DENY = new Set<string>([
  "fs",
  "node:fs",
  "fs/promises",
  "node:fs/promises",
  "child_process",
  "node:child_process",
  "better-sqlite3",
  "net",
  "node:net",
  "http",
  "node:http",
  "https",
  "node:https",
  "dgram",
  "node:dgram",
  "tls",
  "node:tls",
]);

// ---- import extraction ------------------------------------------------------
interface Edge {
  specifier: string;
  typeOnly: boolean;
}

const STATIC_FROM =
  /(?:^|\n)\s*(?:import|export)(\s+type)?\b([^;'"]*?)\bfrom\s*["']([^"']+)["']/g;
const SIDE_EFFECT = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const DYNAMIC_LITERAL = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;
const REQUIRE_LITERAL = /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g;
// non-global: used with .test (stateless)
const DYNAMIC_NONLITERAL = /\bimport\s*\(\s*(?!["'])/;

function extractEdges(source: string, file: string): Edge[] {
  if (DYNAMIC_NONLITERAL.test(source)) {
    throw new Error(
      `non-literal dynamic import in ${repoRel(file)} — cannot statically prove import safety; failing closed (GATE-2)`,
    );
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

// ---- resolution -------------------------------------------------------------
type Resolved =
  | { kind: "repo"; file: string }
  | { kind: "external"; specifier: string }
  | { kind: "unresolved"; specifier: string };

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
    if (existsSync(candidate) && candidate.endsWith(".ts")) return candidate;
    if (
      existsSync(candidate) &&
      (candidate.endsWith(".tsx") || candidate.endsWith(".mts"))
    ) {
      return candidate;
    }
  }
  return null;
}

function resolveSpecifier(specifier: string, importer: string): Resolved {
  if (specifier.startsWith("@/")) {
    const file = resolveToFile(resolve(SRC_ROOT, specifier.slice(2)));
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

// ---- the transitive walk ----------------------------------------------------
interface WalkResult {
  reachableRepo: Set<string>; // posix repo-relative, RUNTIME-reachable
  runtimeExternals: Set<string>;
  denyHits: string[];
  allowViolations: string[];
  externalViolations: string[];
  unresolved: string[];
}

function walk(roots: string[]): WalkResult {
  const reachableRepo = new Set<string>();
  const runtimeExternals = new Set<string>();
  const denyHits: string[] = [];
  const allowViolations: string[] = [];
  const externalViolations: string[] = [];
  const unresolved: string[] = [];

  const visited = new Set<string>();
  const queue: string[] = [...roots];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (visited.has(file)) continue;
    visited.add(file);
    reachableRepo.add(repoRel(file));

    const edges = extractEdges(readFileSync(file, "utf8"), file);
    for (const edge of edges) {
      const resolved = resolveSpecifier(edge.specifier, file);

      if (resolved.kind === "unresolved") {
        unresolved.push(`${repoRel(file)} -> ${edge.specifier}`);
        continue;
      }

      if (resolved.kind === "external") {
        // DENY on every edge.
        if (EXTERNAL_DENY.has(resolved.specifier)) {
          denyHits.push(`${repoRel(file)} -> external ${resolved.specifier}`);
        }
        // ALLOW only constrains RUNTIME edges.
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

      // in-repo edge
      const rel = repoRel(resolved.file);
      if (matchesPrefix(rel, DENY_TREES)) {
        denyHits.push(`${repoRel(file)} -> ${rel} (mutator tree)`);
      }
      if (edge.typeOnly) continue; // erased; checked against DENY, not recursed

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

const ROOTS = [resolve(here, "index.ts"), resolve(here, "server.ts")];

describe("GATE-2 / EoP-6: MCP gateway transitive import allowlist", () => {
  const result = walk(ROOTS);

  it("self-check: the walk is actually transitive (reaches the read projection through the barrel chain)", () => {
    // index.ts -> resources.ts -> "@/lib/pipeline-visualization" (barrel) -> ./contracts
    expect(
      result.reachableRepo.has("src/lib/pipeline-visualization/index.ts"),
    ).toBe(true);
    expect(
      result.reachableRepo.has("src/lib/pipeline-visualization/contracts.ts"),
    ).toBe(true);
    // and the gateway's own internal modules are traversed
    expect(result.reachableRepo.has("src/lib/mcp-gateway/resources.ts")).toBe(
      true,
    );
    expect(result.reachableRepo.has("src/lib/mcp-gateway/protocol.ts")).toBe(
      true,
    );
    expect(result.reachableRepo.has("src/lib/mcp-gateway/sanitizer.ts")).toBe(
      true,
    );
    // 24B-2: the queue-status read path is traversed too — and being under the
    // allowed mcp-gateway prefix, it needs NO allowlist relaxation. Its raw
    // count is injected from outside, so the walk reaches no approvals/db tree.
    expect(
      result.reachableRepo.has("src/lib/mcp-gateway/queue-status.ts"),
    ).toBe(true);
    // 24C-1: the FC-1 canonicalizer is traversed too — and being under the
    // allowed mcp-gateway prefix, it needs NO allowlist relaxation. It reads
    // registry metadata via an injected lookup, so the walk reaches no
    // tools/router/approval-runtime tree.
    expect(
      result.reachableRepo.has("src/lib/mcp-gateway/canonicalize.ts"),
    ).toBe(true);
    // 24C-2: the FC-2 proposal builder + GATE-5 enqueue boundary are traversed.
    // Both sit under the allowed mcp-gateway prefix — NO allowlist relaxation.
    // The enqueue happens via an injected boundary, so the walk reaches no
    // db/approval-runtime tree.
    expect(result.reachableRepo.has("src/lib/mcp-gateway/proposal.ts")).toBe(
      true,
    );
    expect(result.reachableRepo.has("src/lib/mcp-gateway/enqueue.ts")).toBe(
      true,
    );
    // 24C-3: the presentation projection (injection containment) is traversed;
    // it imports only local gateway types + the leaf sanitizer — no mutator tree.
    expect(
      result.reachableRepo.has("src/lib/mcp-gateway/presentation.ts"),
    ).toBe(true);
    // 24D-1: the FC-3 client registry / token auth is traversed via server.ts.
    // It imports only node:crypto + the identity leaf — no db/approval-runtime.
    expect(
      result.reachableRepo.has("src/lib/mcp-gateway/client-registry.ts"),
    ).toBe(true);
    expect(
      result.unresolved,
      `unresolved imports: ${result.unresolved.join(", ")}`,
    ).toEqual([]);
  });

  it("reaches NO mutator tree (EoP-6 deny — direct, barrel, re-export, or dynamic)", () => {
    expect(
      result.denyHits,
      `mutator trees reached: ${result.denyHits.join(" | ")}`,
    ).toEqual([]);
  });

  it("every reachable in-repo module is under the positive allowlist (default-deny)", () => {
    expect(
      result.allowViolations,
      `modules outside {${ALLOW_PREFIXES.join(", ")}}: ${result.allowViolations.join(" | ")}`,
    ).toEqual([]);
  });

  it("every runtime external is explicitly allowlisted (default-deny externals)", () => {
    expect(
      result.externalViolations,
      `disallowed externals: ${result.externalViolations.join(" | ")}`,
    ).toEqual([]);
    // sanity: the gateway uses only schemas (zod) + a hash primitive (node:crypto)
    for (const ext of result.runtimeExternals) {
      expect(
        EXTERNAL_ALLOW.has(ext),
        `unexpected runtime external: ${ext}`,
      ).toBe(true);
    }
  });

  it("negative control: the policy bites — known mutators are denied + excluded, and non-literal dynamic imports fail closed", () => {
    // Real mutator files. If the gateway ever imported one (directly or
    // transitively), the deny + allow checks above would flag it.
    const knownMutators = [
      "src/lib/chat/tool-approvals.ts", // the resumeApproval executor
      "src/lib/tools/runtime.ts", // runtime.runTool
      "src/lib/db/approvals.ts", // DB writer + approval state writer
      "src/lib/approval-runtime/contracts.ts", // approval-runtime tree
      "src/lib/google-adapters/index.ts", // Phase 21B adapter tree (if present)
    ];
    for (const rel of knownMutators) {
      const abs = resolve(REPO_ROOT, rel);
      if (!existsSync(abs)) continue; // tolerate layout drift; the live ones below assert
      expect(
        matchesPrefix(rel, DENY_TREES),
        `${rel} must be a denied tree`,
      ).toBe(true);
      expect(
        matchesPrefix(rel, ALLOW_PREFIXES),
        `${rel} must NOT be allowlisted`,
      ).toBe(false);
    }
    // the executor and tool runtime MUST exist and MUST be denied (load-bearing)
    expect(
      existsSync(resolve(REPO_ROOT, "src/lib/chat/tool-approvals.ts")),
    ).toBe(true);
    expect(matchesPrefix("src/lib/chat/tool-approvals.ts", DENY_TREES)).toBe(
      true,
    );
    expect(existsSync(resolve(REPO_ROOT, "src/lib/tools/runtime.ts"))).toBe(
      true,
    );
    expect(matchesPrefix("src/lib/tools/runtime.ts", DENY_TREES)).toBe(true);

    // fail-closed: a non-literal dynamic import cannot be proven safe -> throws
    expect(() =>
      extractEdges("const m = await import(spec);", "probe.ts"),
    ).toThrow();
    // a literal dynamic import into a mutator tree is followed + would be denied
    const edges = extractEdges(
      'void import("@/lib/db/approvals");',
      "probe.ts",
    );
    expect(edges.some((e) => e.specifier === "@/lib/db/approvals")).toBe(true);
  });
});
