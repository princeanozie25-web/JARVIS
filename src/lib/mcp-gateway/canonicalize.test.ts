// FC-1 canonicalizer invariants I-24C1-1 .. I-24C1-7 (24C-1).
//
// The fixtures are typed by the REAL `Tool` interface (a type-only import — it
// loads no runtime code and does not enter the GATE-2 graph) and projected into
// the gateway's ToolMetadata via `project()`. That proves the derivation tracks
// the registry's own shape (reversibilityClass / requiredSafetyTag / inputSchema
// / scopeOf), not the client's framing.

import { z } from "zod";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Tool } from "@/lib/tools/types";
import {
  canonicalizeProposalRequest,
  ClientProposalRequestSchema,
  findForbiddenFields,
  type ToolMetadata,
  type ToolMetadataLookup,
} from "./index";

// ---------------------------------------------------------------------------
// fixtures typed by the real Tool interface
// ---------------------------------------------------------------------------
function makeTool<I>(spec: {
  id: string;
  requiredSafetyTag: Tool["requiredSafetyTag"];
  reversibilityClass: Tool["reversibilityClass"];
  inputSchema: z.ZodType<I>;
  scopeOf: (input: I) => string;
}): Tool<I> {
  return {
    id: spec.id,
    name: spec.id,
    description: `fixture tool ${spec.id}`,
    requiredSafetyTag: spec.requiredSafetyTag,
    inputSchema: spec.inputSchema,
    scopeOf: spec.scopeOf,
    reversibilityClass: spec.reversibilityClass,
    timeoutMs: 1_000,
    // the canonicalizer must NEVER reach this — proving no-execution (I-24C1-7)
    execute: async () => ({
      ok: false,
      message: "fixture execute must never be called by FC-1",
    }),
  };
}

/** The narrow projection a host would build from the real registry, OUTSIDE the
 * gateway import graph. reversibilityClass/requiredSafetyTag assign structurally
 * into the gateway's local unions; validateArgs wraps inputSchema; deriveTarget
 * wraps scopeOf. */
function project<I>(tool: Tool<I>, exposable: boolean): ToolMetadata {
  return {
    capability: tool.id,
    reversibilityClass: tool.reversibilityClass,
    requiredSafetyTag: tool.requiredSafetyTag,
    proposalExposable: exposable,
    validateArgs: (args) =>
      tool.inputSchema.safeParse(args).success ? { ok: true } : { ok: false },
    deriveTarget: (args) => {
      const parsed = tool.inputSchema.safeParse(args);
      if (!parsed.success) throw new Error("deriveTarget on unvalidated args");
      return tool.scopeOf(parsed.data);
    },
  };
}

const readTool = makeTool({
  id: "fs.read_file",
  requiredSafetyTag: "ALLOW",
  reversibilityClass: "PURE_READ",
  inputSchema: z.object({ path: z.string().min(1) }),
  scopeOf: (i) => i.path,
});
const writeTool = makeTool({
  id: "fs.create_file",
  requiredSafetyTag: "CONFIRM_ONCE",
  reversibilityClass: "REVERSIBLE_WRITE",
  inputSchema: z.object({ path: z.string().min(1), content: z.string() }),
  scopeOf: (i) => i.path,
});
const deleteTool = makeTool({
  id: "fs.delete",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  reversibilityClass: "IRREVERSIBLE",
  inputSchema: z.object({ path: z.string().min(1) }),
  scopeOf: (i) => i.path,
});
const memoryTool = makeTool({
  id: "memory.note",
  requiredSafetyTag: "CONFIRM_ONCE",
  reversibilityClass: "REVERSIBLE_WRITE",
  inputSchema: z.object({ slug: z.string().min(1), body: z.string() }),
  scopeOf: (i) => `memory:note:${i.slug}`,
});
const internalTool = makeTool({
  id: "internal.purge_all",
  requiredSafetyTag: "CONFIRM_ALWAYS",
  reversibilityClass: "IRREVERSIBLE",
  inputSchema: z.object({ confirm: z.boolean() }),
  scopeOf: () => "system:all",
});

const REGISTRY = new Map<string, ToolMetadata>([
  ["fs.read_file", project(readTool, true)],
  ["fs.create_file", project(writeTool, true)],
  ["fs.delete", project(deleteTool, true)],
  ["memory.note", project(memoryTool, true)],
  // exists in the registry but NOT proposal-exposable
  ["internal.purge_all", project(internalTool, false)],
]);
const lookup: ToolMetadataLookup = (id) => REGISTRY.get(id) ?? null;

const CANON_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "canonicalize.ts"),
  "utf8",
);
const codeWithoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "");

// ===========================================================================
// I-24C1-1 — server-derived: the effect tracks the REGISTRY, not the client
// ===========================================================================
describe("I-24C1-1 (server-derived): effect fields come from the registry", () => {
  it("read tool -> read / low / auto / masked fs target", () => {
    const r = canonicalizeProposalRequest(
      { tool: "fs.read_file", args: { path: "/home/owner/secret.md" } },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const e = r.canonical_effect;
      expect(e.mutation_type).toBe("read");
      expect(e.risk_class).toBe("low");
      expect(e.approval_tier).toBe("auto");
      expect(e.target).toBe("filesystem:*.md");
      expect(e.scope_required).toBe("filesystem:read");
      expect(e.capability).toBe("fs.read_file");
      expect(e.server_derived).toBe(true);
    }
  });

  it("reversible-write CONFIRM_ONCE tool -> reversible_write / medium / confirm_once", () => {
    const r = canonicalizeProposalRequest(
      { tool: "fs.create_file", args: { path: "/home/x/n.md", content: "hi" } },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.canonical_effect.mutation_type).toBe("reversible_write");
      expect(r.canonical_effect.risk_class).toBe("medium");
      expect(r.canonical_effect.approval_tier).toBe("confirm_once");
    }
  });

  it("irreversible CONFIRM_ALWAYS tool -> irreversible_write / critical / elevated", () => {
    const r = canonicalizeProposalRequest(
      { tool: "fs.delete", args: { path: "/var/data/x.db" } },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.canonical_effect.mutation_type).toBe("irreversible_write");
      expect(r.canonical_effect.risk_class).toBe("critical");
      expect(r.canonical_effect.approval_tier).toBe("elevated");
    }
  });

  it("scheme-scoped tool -> scheme target + scope_required", () => {
    const r = canonicalizeProposalRequest(
      { tool: "memory.note", args: { slug: "merger-secret", body: "..." } },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.canonical_effect.target).toBe("memory:<target>");
      expect(r.canonical_effect.scope_required).toBe("memory:reversible_write");
    }
  });

  it("identical client input + different registry metadata -> different effect (effect follows the registry)", () => {
    const req = { tool: "x", args: { path: "/a/b.txt" } };
    const asRead = canonicalizeProposalRequest(req, () =>
      project(readTool, true),
    );
    const asDelete = canonicalizeProposalRequest(req, () =>
      project(deleteTool, true),
    );
    expect(asRead.ok && asRead.canonical_effect.risk_class).toBe("low");
    expect(asDelete.ok && asDelete.canonical_effect.risk_class).toBe(
      "critical",
    );
  });
});

// ===========================================================================
// I-24C1-2 — GATE-3: the client cannot author any effect field
// ===========================================================================
describe("I-24C1-2 (GATE-3): client-supplied effect fields are REJECTED, not stripped", () => {
  const base = { path: "/a/b.md", content: "x" };

  it("a top-level risk_class rejects the whole request", () => {
    const r = canonicalizeProposalRequest(
      { tool: "fs.create_file", args: base, risk_class: "low" },
      lookup,
    );
    expect(r).toEqual({ ok: false, reason: "malformed_request" });
  });

  it("every forge-able effect field rejects at the top level", () => {
    const extras: Array<Record<string, unknown>> = [
      { target: "x" },
      { approval_tier: "auto" },
      { canonical_effect: {} },
      { canonical_effect_hash: "hash:x" },
      { scope: "fs" },
      { scope_required: "fs:read" },
      { effect: {} },
      { mutation_type: "read" },
    ];
    for (const extra of extras) {
      const r = canonicalizeProposalRequest(
        { tool: "fs.create_file", args: base, ...extra },
        lookup,
      );
      expect(r.ok, `expected rejection for ${JSON.stringify(extra)}`).toBe(
        false,
      );
      if (!r.ok) expect(r.reason).toBe("malformed_request");
    }
  });

  it("the SAME request succeeds once the forged field is removed", () => {
    const r = canonicalizeProposalRequest(
      { tool: "fs.create_file", args: base },
      lookup,
    );
    expect(r.ok).toBe(true);
  });

  it("the client schema is strict — exactly {tool, args}", () => {
    expect(
      ClientProposalRequestSchema.safeParse({ tool: "t", args: {} }).success,
    ).toBe(true);
    expect(
      ClientProposalRequestSchema.safeParse({ tool: "t", args: {}, extra: 1 })
        .success,
    ).toBe(false);
  });

  it("a risk_class buried INSIDE args cannot author the effect (derived from registry)", () => {
    const r = canonicalizeProposalRequest(
      {
        tool: "fs.read_file",
        args: { path: "/a/b.md", risk_class: "critical" },
      },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.canonical_effect.risk_class).toBe("low"); // META wins
  });
});

// ===========================================================================
// I-24C1-3 — EoP-13: unknown / non-exposable rejected (default-deny)
// ===========================================================================
describe("I-24C1-3 (EoP-13 default-deny): unknown or non-exposable tool rejected", () => {
  it("rejects an unknown tool id", () => {
    expect(
      canonicalizeProposalRequest({ tool: "does.not.exist", args: {} }, lookup),
    ).toEqual({ ok: false, reason: "unknown_tool" });
  });

  it("rejects a known but non-exposable tool", () => {
    expect(
      canonicalizeProposalRequest(
        { tool: "internal.purge_all", args: { confirm: true } },
        lookup,
      ),
    ).toEqual({ ok: false, reason: "not_exposable" });
  });

  it("treats metadata lacking the exposable flag as NOT exposable", () => {
    const r = canonicalizeProposalRequest(
      { tool: "x", args: { path: "/a" } },
      () => project(readTool, false),
    );
    expect(r).toEqual({ ok: false, reason: "not_exposable" });
  });
});

// ===========================================================================
// I-24C1-4 — args must satisfy the tool's own schema
// ===========================================================================
describe("I-24C1-4 (arg validation): invalid args are rejected", () => {
  it("rejects args of the wrong shape", () => {
    expect(
      canonicalizeProposalRequest(
        { tool: "fs.create_file", args: { path: 123 } },
        lookup,
      ),
    ).toEqual({ ok: false, reason: "invalid_args" });
  });

  it("rejects a request missing args entirely (malformed envelope — args is required)", () => {
    const r = canonicalizeProposalRequest({ tool: "fs.create_file" }, lookup);
    expect(r).toEqual({ ok: false, reason: "malformed_request" });
  });
});

// ===========================================================================
// I-24C1-5 — metadata-only: no raw arg value / body / path / secret leaks
// ===========================================================================
describe("I-24C1-5 (metadata-only): the effect leaks no raw value", () => {
  it("masks a sensitive filesystem path; the raw path/body never appears", () => {
    const secretPath = "/home/owner/private/merger-acquisition-secret.md";
    const secretBody = "TOP-SECRET-ACQUISITION-PRICE-42M";
    const r = canonicalizeProposalRequest(
      {
        tool: "fs.create_file",
        args: { path: secretPath, content: secretBody },
      },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const json = JSON.stringify(r.canonical_effect);
      expect(json).not.toContain(secretPath);
      expect(json).not.toContain(secretBody);
      expect(json).not.toContain("merger-acquisition-secret");
      expect(r.canonical_effect.target).toBe("filesystem:*.md");
    }
  });

  it("the canonical effect passes the leaf sanitizer", () => {
    const r = canonicalizeProposalRequest(
      { tool: "memory.note", args: { slug: "x", body: "secret body" } },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(findForbiddenFields(r.canonical_effect)).toEqual([]);
  });
});

// ===========================================================================
// I-24C1-6 — GATE-2 leaf: the canonicalizer reaches no mutator tree
// ===========================================================================
describe("I-24C1-6 (GATE-2 leaf): canonicalize.ts imports only zod + the sanitizer", () => {
  it("its only module edges are zod and ./sanitizer", () => {
    const froms = [
      ...codeWithoutComments(CANON_SRC).matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);
    expect([...new Set(froms)].sort()).toEqual(["./sanitizer", "zod"]);
  });

  it("references no denied tree", () => {
    const code = codeWithoutComments(CANON_SRC);
    for (const denied of [
      "lib/tools",
      "lib/router",
      "approval-runtime",
      "lib/db",
      "lib/chat",
      "lib/runtime",
    ]) {
      expect(code.includes(denied), `must not reference ${denied}`).toBe(false);
    }
  });
});

// ===========================================================================
// I-24C1-7 — no enqueue / approval / execution path
// ===========================================================================
describe("I-24C1-7 (no enqueue/execution): the canonicalizer only derives", () => {
  it("has no runTool / enqueue / execute call site", () => {
    const code = codeWithoutComments(CANON_SRC);
    expect(/\.runTool\s*\(/.test(code)).toBe(false);
    expect(/\benqueue\b/i.test(code)).toBe(false);
    expect(/\bexecute\s*\(/.test(code)).toBe(false);
  });

  it("a successful canonicalization never invokes the tool's execute()", () => {
    // deleteTool.execute returns ok:false and would throw the test off if ever
    // called; canonicalize returns a derived effect and never executes.
    const r = canonicalizeProposalRequest(
      { tool: "fs.delete", args: { path: "/tmp/x" } },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.canonical_effect.mutation_type).toBe("irreversible_write");
  });
});
