// FC-2 approval-time re-validation — integration invariants through the REAL
// resumeApproval executor path (24C-2b). The existing tool-approvals.test.ts
// continues to exercise the legacy flow; this file adds the gateway-proposal
// cases and proves runtime.runTool is reached (or not) correctly.

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyMigrations } from "../db/schema";
import { createPendingApproval } from "../db/approvals";
import { getToolCall } from "../db/node";
import type { RouterDecision } from "../router";
import type { TelemetryEvent } from "../telemetry";
import { InProcessToolRuntime } from "../tools/runtime";
import { ToolRegistry } from "../tools/registry";
import type { Tool } from "../tools/types";
import {
  buildCanonicalProposal,
  canonicalizeProposalRequest,
  type GatewaySafetyTag,
  type ToolMetadata,
  type ToolMetadataLookup,
} from "../mcp-gateway";
import { ensurePendingToolApproval, resumeApproval } from "./tool-approvals";

const allowDecision: RouterDecision = {
  intent: { intent: "DETERMINISTIC_COMMAND", reason: "test" },
  safety: { safetyTag: "ALLOW", reason: "test" },
  capability: { tier: "T3", requiredCapabilities: ["tools"], reason: "test" },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["tools"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let calls: string[];
let now: number;
let runtime: InProcessToolRuntime;
let events: TelemetryEvent[];

const confirmTool: Tool<{ value: string }> = {
  id: "mock.confirm",
  name: "Mock Confirm",
  description: "Test-only confirmation tool.",
  requiredSafetyTag: "CONFIRM_ONCE",
  inputSchema: z.object({ value: z.string() }),
  scopeOf(input) {
    return `value:${input.value}`;
  },
  reversibilityClass: "REVERSIBLE_WRITE",
  timeoutMs: 1000,
  async execute(input) {
    calls.push(input.value);
    return {
      ok: true,
      status: "COMPLETED",
      message: `executed ${input.value}`,
      data: { value: input.value },
    };
  },
};

// 24D-2b: the canonical effect's CAPABILITY must be a live-classified exposable
// capability so the new decision-point re-check passes when the hash is intact.
// "memory.note" is classified @ confirm_once; confirmTool derives confirm_once
// (REVERSIBLE_WRITE + CONFIRM_ONCE), so the frozen tier matches current policy.
// The tool actually executed is still confirmTool — only the effect's policy
// fields are re-derived. Drift cases below OVERRIDE this capability/tag.
const meta: ToolMetadata = {
  capability: "memory.note",
  reversibilityClass: "REVERSIBLE_WRITE",
  requiredSafetyTag: "CONFIRM_ONCE",
  proposalExposable: true,
  validateArgs: () => ({ ok: true }),
  deriveTarget: () => "value:alpha",
};
const lookup: ToolMetadataLookup = () => meta;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  calls = [];
  events = [];
  now = 1_000;
  const registry = new ToolRegistry();
  registry.register(confirmTool);
  runtime = new InProcessToolRuntime(registry, {
    db,
    now: () => now,
    newId: () => "generated-exec",
  });
});

afterEach(() => db.close());

const recordEvent = (
  e: Omit<TelemetryEvent, "timestamp"> & { timestamp?: number },
): void => {
  events.push({ ...e, timestamp: e.timestamp ?? now } as TelemetryEvent);
};

async function awaitToolCall(executionId: string): Promise<void> {
  const result = await runtime.runTool({
    toolId: confirmTool.id,
    input: { value: "alpha" },
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  expect(result.status).toBe("AWAITING_APPROVAL");
}

// Create a GATEWAY-originated pending approval (carries the FC-2 hash + the
// stable serialization). `drift` stores a serialization that no longer hashes
// to the stored hash. `capability`/`safetyTag` OVERRIDE the frozen effect's
// policy fields to simulate REGISTRY/POLICY drift between queueing and approval
// (24D-2b): an unclassified capability, or a derived tier the live policy no
// longer matches. The hash stays internally consistent — only its relationship
// to CURRENT policy drifts, which is exactly what the decision-point re-check
// catches and the hash check cannot.
function createGatewayApproval(
  executionId: string,
  opts: {
    drift?: boolean;
    capability?: string;
    safetyTag?: GatewaySafetyTag;
  } = {},
): string {
  // default path uses the shared lookup; drift cases swap in an overridden meta
  const effLookup: ToolMetadataLookup =
    opts.capability || opts.safetyTag
      ? () => ({
          ...meta,
          ...(opts.capability ? { capability: opts.capability } : {}),
          ...(opts.safetyTag ? { requiredSafetyTag: opts.safetyTag } : {}),
        })
      : lookup;
  const canon = canonicalizeProposalRequest(
    { tool: confirmTool.id, args: { value: "alpha" } },
    effLookup,
  );
  if (!canon.ok) throw new Error(`canonicalize: ${canon.reason}`);
  const proposal = buildCanonicalProposal({
    canonical_effect: canon.canonical_effect,
    client_id: "mcp-client:test0000test0000",
    now_ms: now,
    ttl_ms: 500,
    proposal_id: `proposal:${executionId}`,
  });
  const pending = createPendingApproval(db, {
    execution_id: executionId,
    session_id: "session-1",
    tool_id: confirmTool.id,
    scope_hash: confirmTool.scopeOf({ value: "alpha" }),
    created_at: now,
    ttl_ms: 500,
    canonical_effect_hash: proposal.canonical_effect_hash,
    canonical_effect_json: opts.drift
      ? `${proposal.canonical_effect_json} DRIFTED`
      : proposal.canonical_effect_json,
  });
  return pending.token;
}

describe("resumeApproval — FC-2 re-validation guard", () => {
  it("I-24C2b-3 (valid proceeds): a matching gateway approval executes once, normal path", async () => {
    await awaitToolCall("exec-valid");
    const token = createGatewayApproval("exec-valid");

    const res = await resumeApproval({
      db,
      runtime,
      executionId: "exec-valid",
      decision: "APPROVED_ONCE",
      approvalToken: token,
      now,
      recordEvent,
    });

    expect(res.body.ok).toBe(true);
    expect(calls).toEqual(["alpha"]); // runtime.runTool executed exactly once
    expect(events.some((e) => e.event_type === "tool_approved")).toBe(true);
  });

  it("I-24C2b-1 (hash drift denied): a drifted gateway approval finalizes DENIED, runTool NOT called", async () => {
    await awaitToolCall("exec-drift");
    const token = createGatewayApproval("exec-drift", { drift: true });

    const res = await resumeApproval({
      db,
      runtime,
      executionId: "exec-drift",
      decision: "APPROVED_ONCE",
      approvalToken: token,
      now,
      recordEvent,
    });

    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("revalidation_hash_mismatch");
    // finalized DENIED on the tool_call row (mirrors the existing DENIED path)
    expect(getToolCall(db, "exec-drift")?.status).toBe("DENIED");
    expect(calls).toEqual([]); // never executed
    expect(
      events.some((e) => e.error_class === "ApprovalRevalidationFailed"),
    ).toBe(true);
    // metadata-only: the failure event carries no raw payload/body
    const denyEvent = events.find(
      (e) => e.error_class === "ApprovalRevalidationFailed",
    );
    expect(JSON.stringify(denyEvent)).not.toContain("alpha");
  });

  it("I-24C2b-4 (legacy unaffected): a no-hash approval behaves exactly as before (executes)", async () => {
    await awaitToolCall("exec-legacy");
    const pending = ensurePendingToolApproval({
      db,
      executionId: "exec-legacy",
      sessionId: "session-1",
      toolId: confirmTool.id,
      toolName: confirmTool.name,
      scopeHash: confirmTool.scopeOf({ value: "alpha" }),
      requiredSafetyTag: "CONFIRM_ONCE",
      safetyTag: "ALLOW",
      toolInput: { value: "alpha" },
      now,
      ttlMs: 500,
    });

    const res = await resumeApproval({
      db,
      runtime,
      executionId: "exec-legacy",
      decision: "APPROVED_ONCE",
      approvalToken: pending.approvalToken,
      now,
      recordEvent,
    });

    expect(res.body.ok).toBe(true);
    expect(calls).toEqual(["alpha"]); // guard did not fire; executed as before
    expect(
      events.some((e) => e.error_class === "ApprovalRevalidationFailed"),
    ).toBe(false);
  });

  it("I-24D2b-3 (drift declassified): a capability no longer classified finalizes DENIED, runTool NOT called", async () => {
    await awaitToolCall("exec-declassified");
    // freeze an effect whose capability is unclassified in the LIVE policy; the
    // hash is intact, so ONLY the decision-point re-check can catch this.
    const token = createGatewayApproval("exec-declassified", {
      capability: "mock.confirm",
    });

    const res = await resumeApproval({
      db,
      runtime,
      executionId: "exec-declassified",
      decision: "APPROVED_ONCE",
      approvalToken: token,
      now,
      recordEvent,
    });

    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("revalidation_tool_declassified");
    expect(getToolCall(db, "exec-declassified")?.status).toBe("DENIED");
    expect(calls).toEqual([]); // never executed
    expect(
      events.some((e) => e.error_class === "ApprovalRevalidationFailed"),
    ).toBe(true);
  });

  it("I-24D2b-4 (drift tier): a frozen tier the live policy no longer matches finalizes DENIED, runTool NOT called", async () => {
    await awaitToolCall("exec-tier");
    // memory.note is classified @ confirm_once; freeze it with a derived tier of
    // confirm_always (CONFIRM_ALWAYS safety tag) so current policy no longer
    // matches the frozen tier — a policy drift the hash alone cannot detect.
    const token = createGatewayApproval("exec-tier", {
      capability: "memory.note",
      safetyTag: "CONFIRM_ALWAYS",
    });

    const res = await resumeApproval({
      db,
      runtime,
      executionId: "exec-tier",
      decision: "APPROVED_ONCE",
      approvalToken: token,
      now,
      recordEvent,
    });

    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("revalidation_approval_policy_changed");
    expect(getToolCall(db, "exec-tier")?.status).toBe("DENIED");
    expect(calls).toEqual([]); // never executed
  });
});

describe("I-24C2b-5 (sole executor): runtime.runTool call-site count is unchanged", () => {
  it("src/lib/chat has exactly two production runtime.runTool call sites", () => {
    const chatDir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(chatDir).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    let count = 0;
    const sites: string[] = [];
    for (const name of files) {
      const code = readFileSync(resolve(chatDir, name), "utf8");
      const matches = code.match(/\.runTool\s*\(/g);
      if (matches) {
        count += matches.length;
        sites.push(`${name}:${matches.length}`);
      }
    }
    expect(count, `runTool call sites: ${sites.join(", ")}`).toBe(2);
    // and the new revalidation leaf adds no call site (it may NAME runTool in a
    // comment; what matters is there is no `.runTool(` invocation)
    expect(
      /\.runTool\s*\(/.test(
        readFileSync(resolve(chatDir, "approval-revalidation.ts"), "utf8"),
      ),
    ).toBe(false);
  });
});
