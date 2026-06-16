// Per-client scope + EoP-13 completeness invariants I-24D2a-1 .. I-24D2a-9.
//
// The completeness test (I-24D2a-7) enumerates the LIVE tool registry's mutating
// capabilities and asserts each is classified in the gateway policy — a NEW
// unclassified mutating capability fails the build (proven with a synthetic one).

import { z } from "zod";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "@/lib/tools"; // side-effect: registers all built-in tools
import { tools } from "@/lib/tools/registry";

import {
  CAPABILITY_CLASSIFICATION,
  checkProposeScope,
  classifyCapability,
  createQueueStatusReader,
  findUnclassifiedMutatingCapabilities,
  handleJsonRpcRequest,
  isCapabilityExposable,
  isReadAllowed,
  PIPELINE_VIEW_MODEL_URI,
  QUEUE_STATUS_URI,
  submitProposalRequest,
  UNIFORM_DENIAL_MESSAGE,
  type ClientScope,
  type EnqueueProposal,
  type GatewaySession,
  type ToolMetadata,
  type ToolMetadataLookup,
} from "./index";

interface GatewayResp {
  result: { contents: Array<{ text: string }> };
  error: { code: number; message: string };
}

const call = (
  request: unknown,
  session: GatewaySession,
  queueStatus: Parameters<typeof handleJsonRpcRequest>[2] = null,
): GatewayResp =>
  handleJsonRpcRequest(request, session, queueStatus) as unknown as GatewayResp;

const readReq = (uri: string) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "resources/read",
  params: { uri },
});

// --- fixtures: two exposable mutating tools -----------------------------------
const memoryArgs = z.object({ slug: z.string(), body: z.string() });
const memoryMeta: ToolMetadata = {
  capability: "memory.note",
  reversibilityClass: "REVERSIBLE_WRITE",
  requiredSafetyTag: "CONFIRM_ONCE",
  proposalExposable: true,
  validateArgs: (a) =>
    memoryArgs.safeParse(a).success ? { ok: true } : { ok: false },
  deriveTarget: (a) => `memory:note:${memoryArgs.parse(a).slug}`,
};

const fsArgs = z.object({ path: z.string(), content: z.string() });
const fsMeta: ToolMetadata = {
  capability: "fs.create_file",
  reversibilityClass: "REVERSIBLE_WRITE",
  requiredSafetyTag: "CONFIRM_ONCE",
  proposalExposable: true,
  validateArgs: (a) =>
    fsArgs.safeParse(a).success ? { ok: true } : { ok: false },
  deriveTarget: (a) => fsArgs.parse(a).path,
};

function submit(
  meta: ToolMetadata,
  args: unknown,
  scope: ClientScope | null,
  ttlMs = 60_000,
) {
  const lookup: ToolMetadataLookup = () => meta;
  const enqueue: EnqueueProposal = (p) => ({ proposal_id: p.proposal_id });
  return submitProposalRequest(
    { tool: meta.capability, args },
    {
      lookup,
      clientId: "mcp-client:a",
      enqueue,
      now_ms: 1_000,
      ttl_ms: ttlMs,
      scope,
      proposal_id: "proposal:scope01",
    },
  );
}

const grant = (
  overrides: Partial<ClientScope["propose"][number]> & { capability: string },
): ClientScope["propose"][number] => ({ ...overrides });

const SCOPE_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "scope.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|\n)\s*\/\/[^\n]*/g, "");

// ===========================================================================
// I-24D2a-1 — read scope (ID-2)
// ===========================================================================
describe("I-24D2a-1 (read scope / ID-2): per-client read, no cross-client", () => {
  const queueReader = createQueueStatusReader({ source: () => 3 });
  const pipelineOnly: GatewaySession = {
    authenticated: true,
    clientId: "mcp-client:pipe",
    scope: { read: ["pipeline-view-model"], propose: [] },
  };
  const queueOnly: GatewaySession = {
    authenticated: true,
    clientId: "mcp-client:queue",
    scope: { read: ["queue-status"], propose: [] },
  };
  const noRead: GatewaySession = {
    authenticated: true,
    clientId: "mcp-client:none",
    scope: { read: [], propose: [] },
  };

  it("a pipeline-scoped client reads pipeline-view-model but is DENIED queue-status", () => {
    expect(
      call(readReq(PIPELINE_VIEW_MODEL_URI), pipelineOnly, queueReader).result
        .contents,
    ).toBeDefined();
    const denied = call(readReq(QUEUE_STATUS_URI), pipelineOnly, queueReader);
    expect(denied.error.message).toBe(UNIFORM_DENIAL_MESSAGE);
    // no cross-client info in the denial
    expect(JSON.stringify(denied)).not.toContain("mcp-client:queue");
  });

  it("a queue-scoped client reads queue-status (proves per-resource gating)", () => {
    expect(
      call(readReq(QUEUE_STATUS_URI), queueOnly, queueReader).result.contents,
    ).toBeDefined();
  });

  it("a client with empty read scope is denied BOTH reads", () => {
    expect(call(readReq(PIPELINE_VIEW_MODEL_URI), noRead).error.message).toBe(
      UNIFORM_DENIAL_MESSAGE,
    );
    expect(
      call(readReq(QUEUE_STATUS_URI), noRead, queueReader).error.message,
    ).toBe(UNIFORM_DENIAL_MESSAGE);
  });
});

// ===========================================================================
// I-24D2a-2 — propose scope (EoP-13)
// ===========================================================================
describe("I-24D2a-2 (propose scope): capability must be granted", () => {
  it("an in-scope capability proceeds", () => {
    const scope: ClientScope = {
      read: [],
      propose: [grant({ capability: "memory.note" })],
    };
    const r = submit(memoryMeta, { slug: "x", body: "hi" }, scope);
    expect(r.ok).toBe(true);
  });

  it("a capability not in the propose scope is rejected before enqueue", () => {
    const scope: ClientScope = {
      read: [],
      propose: [grant({ capability: "fs.create_file" })],
    };
    const r = submit(memoryMeta, { slug: "x", body: "hi" }, scope);
    expect(r).toEqual({ ok: false, stage: "scope", reason: "no_grant" });
  });
});

// ===========================================================================
// I-24D2a-3 — target-bound
// ===========================================================================
describe("I-24D2a-3 (target-bound): derived target must satisfy target_prefix", () => {
  const scope: ClientScope = {
    read: [],
    propose: [grant({ capability: "fs.create_file", target_prefix: "Daily/" })],
  };

  it("an in-prefix target proceeds", () => {
    expect(
      submit(fsMeta, { path: "Daily/note.md", content: "x" }, scope).ok,
    ).toBe(true);
  });

  it("an out-of-prefix target is rejected", () => {
    expect(
      submit(fsMeta, { path: "Secret/leak.md", content: "x" }, scope),
    ).toEqual({ ok: false, stage: "scope", reason: "target_out_of_scope" });
  });
});

// ===========================================================================
// I-24D2a-4 — arg-bound
// ===========================================================================
describe("I-24D2a-4 (arg-bound): size + forbidden + require-false constraints", () => {
  it("over max_args_bytes is rejected", () => {
    const scope: ClientScope = {
      read: [],
      propose: [grant({ capability: "memory.note", max_args_bytes: 40 })],
    };
    expect(
      submit(memoryMeta, { slug: "x", body: "y".repeat(200) }, scope).ok,
    ).toBe(false);
  });

  it("a require-false arg key that is true is rejected; false proceeds", () => {
    const scope: ClientScope = {
      read: [],
      propose: [
        grant({
          capability: "fs.create_file",
          require_false_arg_keys: ["overwrite"],
        }),
      ],
    };
    expect(
      submit(fsMeta, { path: "a.md", content: "x", overwrite: true }, scope),
    ).toEqual({ ok: false, stage: "scope", reason: "arg_out_of_scope" });
    expect(
      submit(fsMeta, { path: "a.md", content: "x", overwrite: false }, scope)
        .ok,
    ).toBe(true);
  });

  it("a forbidden arg key present is rejected", () => {
    const scope: ClientScope = {
      read: [],
      propose: [
        grant({
          capability: "fs.create_file",
          forbid_arg_keys: ["attachments"],
        }),
      ],
    };
    expect(
      submit(fsMeta, { path: "a.md", content: "x", attachments: [] }, scope).ok,
    ).toBe(false);
  });
});

// ===========================================================================
// I-24D2a-5 — time-bound
// ===========================================================================
describe("I-24D2a-5 (time-bound): proposal ttl must be within time_bound_ms", () => {
  const scope: ClientScope = {
    read: [],
    propose: [grant({ capability: "memory.note", time_bound_ms: 30_000 })],
  };
  it("ttl over the bound is rejected", () => {
    expect(
      submit(memoryMeta, { slug: "x", body: "hi" }, scope, 60_000),
    ).toEqual({ ok: false, stage: "scope", reason: "time_out_of_scope" });
  });
  it("ttl within the bound proceeds", () => {
    expect(
      submit(memoryMeta, { slug: "x", body: "hi" }, scope, 10_000).ok,
    ).toBe(true);
  });
});

// ===========================================================================
// I-24D2a-6 — EoP-4: no elevation by routing
// ===========================================================================
describe("I-24D2a-6 (EoP-4): a client cannot reach an out-of-scope capability", () => {
  it("granted only memory.note, an attempt to propose fs.create_file is rejected", () => {
    const scope: ClientScope = {
      read: [],
      propose: [grant({ capability: "memory.note" })],
    };
    // the client submits a DIFFERENT (exposable) capability it was not granted
    const r = submit(fsMeta, { path: "a.md", content: "x" }, scope);
    expect(r).toEqual({ ok: false, stage: "scope", reason: "no_grant" });
  });

  it("a classified-but-not-exposable capability is rejected even if the host marks it exposable", () => {
    const deleteMeta: ToolMetadata = {
      capability: "fs.delete_file", // classification: mcp_exposable false
      reversibilityClass: "REVERSIBLE_WRITE",
      requiredSafetyTag: "CONFIRM_ALWAYS",
      proposalExposable: true, // host says exposable; gateway policy overrides
      validateArgs: (a) =>
        fsArgs.safeParse(a).success ? { ok: true } : { ok: false },
      deriveTarget: (a) => fsArgs.parse(a).path,
    };
    const scope: ClientScope = {
      read: [],
      propose: [grant({ capability: "fs.delete_file" })],
    };
    expect(submit(deleteMeta, { path: "a.md", content: "x" }, scope)).toEqual({
      ok: false,
      stage: "scope",
      reason: "not_exposable",
    });
  });
});

// ===========================================================================
// I-24D2a-7 — EoP-13 completeness (build-failing)
// ===========================================================================
describe("I-24D2a-7 (completeness): every mutating capability is classified", () => {
  const mutatingCapabilities = tools
    .list()
    .filter(
      (t) =>
        t.reversibilityClass === "REVERSIBLE_WRITE" ||
        t.reversibilityClass === "IRREVERSIBLE",
    )
    .map((t) => t.id);

  it("the live registry has mutating capabilities and ALL are classified", () => {
    expect(mutatingCapabilities.length).toBeGreaterThan(0);
    expect(findUnclassifiedMutatingCapabilities(mutatingCapabilities)).toEqual(
      [],
    );
  });

  it("a synthetic NEW unclassified mutating capability fails completeness (build-fail) + is not exposable", () => {
    const withSynthetic = [
      ...mutatingCapabilities,
      "synthetic.unclassified_mutator",
    ];
    expect(findUnclassifiedMutatingCapabilities(withSynthetic)).toEqual([
      "synthetic.unclassified_mutator",
    ]);
    expect(classifyCapability("synthetic.unclassified_mutator")).toBeNull();
    expect(isCapabilityExposable("synthetic.unclassified_mutator")).toBe(false);
  });

  it("every classification entry declares all four required fields", () => {
    for (const [cap, c] of Object.entries(CAPABILITY_CLASSIFICATION)) {
      expect(typeof c.mcp_exposable, cap).toBe("boolean");
      expect(typeof c.proposal_allowed, cap).toBe("boolean");
      expect(typeof c.required_scope, cap).toBe("string");
      expect(typeof c.required_approval_tier, cap).toBe("string");
    }
  });
});

// ===========================================================================
// I-24D2a-8 — fail-closed
// ===========================================================================
describe("I-24D2a-8 (fail-closed): missing/ambiguous scope + unclassified => deny", () => {
  it("checkProposeScope with null scope denies (no grant)", () => {
    expect(
      checkProposeScope({
        capability: "memory.note",
        rawTarget: "memory:note:x",
        args: { slug: "x", body: "y" },
        ttlMs: 1_000,
        scope: null,
      }),
    ).toEqual({ ok: false, reason: "no_grant" });
  });

  it("an unclassified capability denies (not_classified) even with a matching grant", () => {
    expect(
      checkProposeScope({
        capability: "totally.unknown",
        rawTarget: "x",
        args: {},
        ttlMs: 1_000,
        scope: {
          read: [],
          propose: [grant({ capability: "totally.unknown" })],
        },
      }),
    ).toEqual({ ok: false, reason: "not_classified" });
  });

  it("isReadAllowed is fail-closed for null/empty scope", () => {
    expect(isReadAllowed(null, "pipeline-view-model")).toBe(false);
    expect(
      isReadAllowed({ read: [], propose: [] }, "pipeline-view-model"),
    ).toBe(false);
  });
});

// ===========================================================================
// I-24D2a-9 — GATE-2 leaf (no mutator tree, no cross-client)
// ===========================================================================
describe("I-24D2a-9 (GATE-2 leaf): scope.ts imports only the canonical-policy leaf", () => {
  it("its only module edge is the shared canonical-policy leaf (24D-2b)", () => {
    // 24D-2b moved the EoP-13 classification into @/lib/canonical-policy (a pure,
    // mutator-free leaf both the gateway and the executor import); scope.ts now
    // imports + re-exports it. That is its ONLY module edge.
    const froms = [...SCOPE_SRC.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    expect([...new Set(froms)]).toEqual(["@/lib/canonical-policy"]);
  });

  it("references no db/tools/approval-runtime/chat tree", () => {
    for (const denied of [
      "lib/db",
      "lib/tools",
      "approval-runtime",
      "lib/chat",
      "lib/router",
    ]) {
      expect(SCOPE_SRC.includes(denied)).toBe(false);
    }
  });
});
