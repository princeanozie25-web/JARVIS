// E-050 — the self.* tools: registered, read-only, routed through the
// runtime like every other tool, and leak-checked on the way out.
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/lib/db/schema";
import {
  SelfModel,
  SELF_MODEL_TOOL_IDS,
  selfModelTools,
  setSelfModelProvider,
} from "../../src/lib/self-model";
import { claim, evidence } from "../../src/lib/self-model/contracts";
import { tools } from "../../src/lib/tools";
import type { ToolContext } from "../../src/lib/tools/types";

const NOW = "2026-09-07T10:00:00.000Z";

function fixtureModel(): SelfModel {
  const c = (
    id: string,
    subject: string,
    statement: string,
    status: "operational" | "offline" | "planned" = "operational",
    trust: "config_registry" | "current_verified_runtime" = "config_registry",
  ) =>
    claim({
      claim_id: id,
      category:
        subject.startsWith("tool:") || subject.startsWith("voice:")
          ? "capability"
          : subject.startsWith("limit.")
            ? "limit"
            : subject === "identity"
              ? "identity"
              : "runtime",
      subject,
      statement,
      status,
      trust_class: trust,
      observed_at: NOW,
      ttl_ms: trust === "current_verified_runtime" ? 60_000 : null,
      evidence: [
        evidence(
          trust === "current_verified_runtime" ? "runtime_probe" : "registry",
          `ref:${subject}`,
          NOW,
        ),
      ],
    });
  return new SelfModel({
    now: () => new Date(NOW),
    sources: {
      constitutional: () => [
        c(
          "self:identity",
          "identity",
          "I am JARVIS, a personal AI operating environment for Prince Anozie.",
        ),
        c(
          "self:limit.self-modification",
          "limit.self-modification",
          "I cannot modify my own code.",
        ),
      ],
      capabilities: () => [
        c(
          "self:tool.fs.read_file",
          "tool:fs.read_file",
          "Read: reads a file [PURE_READ]",
        ),
        c(
          "self:voice.barge-in",
          "voice:barge-in",
          "Barge-in is planned.",
          "planned",
        ),
      ],
      runtime: () => [
        c(
          "self:runtime.ollama",
          "provider:ollama",
          "Ollama is answering.",
          "operational",
          "current_verified_runtime",
        ),
      ],
      experience: () => [],
      repository: () => [],
    },
  });
}

function context(db?: Database.Database): ToolContext {
  return {
    executionId: "exec-self",
    sessionId: "s",
    signal: new AbortController().signal,
    timeoutMs: 8000,
    decision: {} as never,
    db,
  };
}

afterEach(() => setSelfModelProvider(null));

describe("E-050 self.* tools", () => {
  it("are registered in the live tool registry as PURE_READ / ALLOW, and no writer tool exists", () => {
    expect(SELF_MODEL_TOOL_IDS).toEqual([
      "self.describe",
      "self.capabilities",
      "self.limits",
      "self.status",
      "self.explain",
      "self.context",
      "self.projection",
    ]);
    for (const id of SELF_MODEL_TOOL_IDS) {
      const t = tools.get(id);
      expect(t.reversibilityClass).toBe("PURE_READ");
      expect(t.requiredSafetyTag).toBe("ALLOW");
    }
    expect(
      tools
        .list()
        .some((t) => /^self\.(modify|set|write|update|escalate)/.test(t.id)),
    ).toBe(false);
    expect(
      selfModelTools.every((t) => t.reversibilityClass === "PURE_READ"),
    ).toBe(true);
  });

  it("answer from the injected model", async () => {
    setSelfModelProvider(async () => fixtureModel());
    const describe = await tools.get("self.describe").execute({}, context());
    expect(describe.ok).toBe(true);
    expect(JSON.stringify(describe.data)).toContain("I am JARVIS");
    const caps = await tools
      .get("self.capabilities")
      .execute({ subject_prefix: "tool:" }, context());
    expect((caps.data as { claims: unknown[] }).claims).toHaveLength(1);
    const limits = await tools.get("self.limits").execute({}, context());
    expect(
      (limits.data as { standing_limits: string[] }).standing_limits[0],
    ).toMatch(/cannot modify/);
    expect((limits.data as { planned: unknown[] }).planned).toHaveLength(1);
    const status = await tools.get("self.status").execute({}, context());
    expect((status.data as { headline: string }).headline).toBe("operational");
    const explain = await tools
      .get("self.explain")
      .execute({ claim: "provider:ollama" }, context());
    expect((explain.data as { because: string }).because).toMatch(
      /current_verified_runtime/,
    );
    const missing = await tools
      .get("self.explain")
      .execute({ claim: "tool:nope" }, context());
    expect(missing.ok).toBe(false);
    expect(missing.message).toMatch(/do not invent/);
    const ctx = await tools
      .get("self.context")
      .execute({ task_kind: "voice", max_chars: 600 }, context());
    expect((ctx.data as { char_count: number }).char_count).toBeLessThanOrEqual(
      600,
    );
    const projection = await tools
      .get("self.projection")
      .execute({}, context());
    expect(
      (projection.data as { projection_version: string }).projection_version,
    ).toBe("SM.1-projection");
  });

  it("the default provider composes against the real registries and the context db without network", async () => {
    const db = new Database(":memory:");
    applyMigrations(db);
    // Point loopback probes at nothing: fetch must fail fast, not hang.
    const { createDefaultSelfModel } =
      await import("../../src/lib/self-model/default");
    setSelfModelProvider(async (ctx) =>
      createDefaultSelfModel({
        db: (ctx.db as Database.Database | undefined) ?? null,
        tools: tools.list(),
        env: { JARVIS_EVENT_STORE_ENABLED: "false" },
        fetchImpl: (async () => {
          throw new Error("no network in tests");
        }) as typeof fetch,
        probes: { doctor: () => null },
        persistSnapshots: false,
      }),
    );
    const status = await tools.get("self.status").execute({}, context(db));
    expect(status.ok).toBe(true);
    expect((status.data as { headline: string }).headline).toBe("offline");
    const caps = await tools
      .get("self.capabilities")
      .execute({ subject_prefix: "tool:self." }, context(db));
    expect((caps.data as { claims: unknown[] }).claims.length).toBe(
      SELF_MODEL_TOOL_IDS.length,
    );
  });
});
