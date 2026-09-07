// E-050 — Self Model: the brief's 17 questions, precedence, freshness,
// leak guard, controlled writers, projection stability.
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/lib/db/schema";
import { createToolCall, updateToolCall } from "../../src/lib/db/tool-calls";
import { insertTelemetryEvent } from "../../src/lib/db/telemetry";
import {
  SelfClaimSchema,
  SelfModel,
  SelfProjectionSchema,
  SelfSnapshotSchema,
  buildCapabilityClaims,
  buildConstitutionalClaims,
  buildExperienceClaims,
  buildRepositoryClaims,
  buildRuntimeClaims,
  buildSelfContext,
  buildSelfProjection,
  claim,
  createSelfModelWriter,
  evidence,
  explainClaim,
  findSelfLeak,
  freshnessOf,
  parseEnhancementRows,
  reconcileClaims,
  type SelfClaim,
  type SelfSnapshot,
} from "../../src/lib/self-model";
import { createDefaultSelfModel } from "../../src/lib/self-model/default";
import { getStaticArchitectureGraph } from "../../src/lib/architecture-graph/static-registry";

const NOW = "2026-09-07T10:00:00.000Z";
const NOW_MS = Date.parse(NOW);

const PROMPT =
  "You are JARVIS, a personal AI operating environment for Prince Anozie.\n\nOperating principles:\n";

function inMemoryDb(): Database.Database {
  const db = new Database(":memory:");
  applyMigrations(db);
  return db;
}

function fakeFetch(
  map: Record<string, { ok: boolean; body: unknown } | null>,
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const hit = Object.entries(map).find(([k]) => url.startsWith(k));
    if (!hit || hit[1] === null) throw new Error(`ECONNREFUSED ${url}`);
    return new Response(JSON.stringify(hit[1].body), {
      status: hit[1].ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const REGISTRY_MD = [
  "# Enhancement Registry",
  "E-001 | First thing | surface | why | APPLIED (2026-09-01)",
  "E-002 | Second thing | surface | why | PROPOSED",
  "E-003 | Third thing | surface | why | RETIRED (non-change)",
  "E-004 | Fourth thing | surface | why | COMPLETE (2026-09-04) — partial, reported",
].join("\n");

function liveModel(
  overrides: {
    ollamaUp?: boolean;
    mlxUp?: boolean;
    db?: Database.Database | null;
    now?: string;
  } = {},
) {
  const g = getStaticArchitectureGraph();
  void g;
  return createDefaultSelfModel({
    projectRoot: process.cwd(),
    env: { JARVIS_EVENT_STORE_ENABLED: "false" },
    db: overrides.db === undefined ? inMemoryDb() : overrides.db,
    tools: [],
    fetchImpl: fakeFetch({
      "http://127.0.0.1:11434":
        overrides.ollamaUp === false
          ? null
          : {
              ok: true,
              body: {
                models: [
                  { name: "qwen3.5:9b-mlx" },
                  { name: "qwen3.5:27b-mlx" },
                ],
              },
            },
      "http://127.0.0.1:8004":
        overrides.mlxUp === false ? null : { ok: true, body: { data: [] } },
    }),
    probes: {
      doctor: () => ({
        verdict: "ready",
        blocking_failures: 0,
        warnings: 0,
        skipped: 9,
        pending: 0,
        hardware: {
          total_ram_gb: 32,
          unified_memory: true,
          metal: true,
          platform: "darwin",
          arch: "arm64",
        },
      }),
    },
    persistSnapshots: false,
    now: () => new Date(overrides.now ?? NOW),
    cacheTtlMs: 0,
  });
}

describe("E-050 Self Model — the seventeen questions (live composition, probes faked)", () => {
  it("Q1 What are you? / Q2 What can you do? / Q3 What can't you do?", async () => {
    const model = liveModel();
    const identity = await model.find("self:identity");
    expect(identity?.statement).toBe(
      "I am JARVIS, a personal AI operating environment for Prince Anozie.",
    );
    expect(identity?.trust_class).toBe("config_registry");
    const caps = await model.claims({ category: "capability" });
    expect(caps.length).toBeGreaterThan(5);
    expect(caps.some((c) => c.subject === "provider:anthropic")).toBe(true);
    expect((await model.find("provider:ollama"))?.status).toBe("operational");
    const limits = await model.claims({ category: "limit" });
    expect(
      limits.some((c) => c.claim_id === "self:limit.self-modification"),
    ).toBe(true);
    expect(
      limits.some((c) => c.claim_id === "self:limit.authority-escalation"),
    ).toBe(true);
  });

  it("Q4 Which models are available right now? — runtime probe outranks the registry", async () => {
    const up = await liveModel().find("model:ollama/qwen3.5-9b-mlx");
    expect(up?.status).toBe("operational");
    expect(up?.trust_class).toBe("current_verified_runtime");
    const down = await liveModel({ ollamaUp: false }).find(
      "model:ollama/qwen3.5-9b-mlx",
    );
    expect(down?.status).toBe("offline");
    // The registry said "operational" (enabled + provider registered); the probe overruled it and kept the record.
    expect(
      down?.contradictions.some(
        (x) =>
          x.trust_class === "config_registry" && x.status === "operational",
      ),
    ).toBe(true);
  });

  it("Q5 Which tools are enabled? (Q2 subset) and Q9 Which parts of you are experimental vs planned?", async () => {
    const model = createDefaultSelfModel({
      env: { JARVIS_EVENT_STORE_ENABLED: "false" },
      db: null,
      tools: [
        {
          id: "fs.read_file",
          name: "Read",
          description: "Reads a file",
          requiredSafetyTag: "ALLOW",
          reversibilityClass: "PURE_READ",
          inputSchema: {} as never,
          scopeOf: () => "",
          timeoutMs: 1,
          execute: async () => ({ ok: true, message: "" }),
        },
      ],
      fetchImpl: fakeFetch({}),
      probes: { doctor: () => null },
      persistSnapshots: false,
      now: () => new Date(NOW),
    });
    const tool = await model.find("tool:fs.read_file");
    expect(tool?.status).toBe("operational");
    expect(tool?.statement).toContain("tier ");
    const planned = await model.claims({ status: "planned" });
    expect(planned.some((c) => c.subject === "voice:barge-in")).toBe(true);
    expect(planned.some((c) => c.subject === "node:topology")).toBe(true);
    const experimental = await model.claims({ status: "experimental" });
    expect(
      experimental.some((c) => c.subject === "voice:realtime-streaming"),
    ).toBe(true);
  });

  it("Q6 Which nodes exist and their status? — one node, honestly", async () => {
    const node = await liveModel().find("node:local");
    expect(node?.status).toBe("operational");
    expect(node?.statement).toMatch(/single node/);
    expect(node?.statement).not.toMatch(/hostname/i);
    const topo = await liveModel().find("node:topology");
    expect(topo?.status).toBe("planned");
  });

  it("Q7 What is your current runtime status? / Q8 verified vs planned", async () => {
    const status = await liveModel().status();
    expect(status.headline).toBe("operational");
    const degraded = await liveModel({ mlxUp: false }).status();
    expect(degraded.headline).toBe("degraded");
    const offline = await liveModel({ ollamaUp: false }).status();
    expect(offline.headline).toBe("offline");
  });

  it("Q10 Are you allowed to modify yourself? / Q11 What memory do you have?", async () => {
    const model = liveModel();
    const self = await model.find("limit.self-modification");
    expect(self?.statement).toMatch(/cannot modify my own code/);
    const dbClaim = await model.find("runtime.db");
    expect(dbClaim?.statement).toMatch(/telemetry events/);
    const memorySurface = await model.find("authority-surface:memory-bridge");
    expect(memorySurface).not.toBeNull();
  });

  it("Q12 What is the difference between your roadmap and current capabilities?", async () => {
    const model = liveModel();
    const barge = await model.find("voice:barge-in");
    expect(barge?.status).toBe("planned");
    const live = await model.find("voice:live");
    expect(live?.status).toBe("operational");
  });

  it("Q13 What changed about you recently? — from the enhancement registry, with real statuses", async () => {
    const model = liveModel();
    const rows = await model.claims({ category: "enhancement" });
    expect(rows.length).toBeGreaterThan(40);
    expect(
      rows.every((r) =>
        [
          "operational",
          "planned",
          "unsupported",
          "unknown",
          "experimental",
        ].includes(r.status),
      ),
    ).toBe(true);
    expect(rows.find((r) => r.subject === "enhancement:E-049")?.status).toBe(
      "operational",
    );
  });

  it("Q14 Which subsystems are healthy? Q15 depend on Ollama? Q16 What happens if it goes offline?", async () => {
    const model = liveModel({ ollamaUp: false });
    const ollama = await model.find("provider:ollama");
    expect(ollama?.status).toBe("offline");
    const dependants = await model.claims({ subjectPrefix: "model:ollama/" });
    expect(dependants.length).toBeGreaterThan(0);
    expect(dependants.every((d) => d.status === "offline")).toBe(true);
    const arch = await model.find("repository.architecture");
    expect(arch?.statement).toMatch(/subsystems/);
  });

  it("Q17 What evidence supports your claim that X works? — explain shows the trail", async () => {
    const model = liveModel({ ollamaUp: false });
    const found = await model.find("model:ollama/qwen3.5-9b-mlx");
    const why = explainClaim(found!, NOW_MS);
    expect(why.because).toMatch(/current_verified_runtime/);
    expect(why.evidence[0]?.ref).toBe("http://127.0.0.1:11434/api/tags");
    expect(why.contradictions[0]?.why_overruled).toMatch(/ranks below/);
  });

  it("answers 'unknown' when the evidence is insufficient (test suite, experience) instead of guessing", async () => {
    const model = liveModel();
    const tests = await model.find("repository.test-suite");
    expect(tests?.status).toBe("unknown");
    expect(tests?.evidence[0]?.kind).toBe("unavailable");
    const experience = await model.find("experience.summary");
    expect(experience?.status).toBe("unknown");
  });
});

describe("E-050 — contradiction precedence and freshness", () => {
  const base = (over: Partial<SelfClaim>): SelfClaim =>
    claim({
      claim_id: "self:x",
      category: "capability",
      subject: "x",
      statement: "x works",
      status: "operational",
      trust_class: "roadmap",
      observed_at: NOW,
      ttl_ms: null,
      evidence: [evidence("roadmap_document", "docs/roadmap", NOW)],
      ...over,
    });

  it("runtime > test > config/registry > architecture docs > roadmap", () => {
    const merged = reconcileClaims([
      base({ trust_class: "roadmap", status: "planned" }),
      base({
        trust_class: "architecture_docs",
        status: "operational",
        evidence: [evidence("architecture_graph", "graph", NOW)],
      }),
      base({
        trust_class: "config_registry",
        status: "operational",
        evidence: [evidence("registry", "reg", NOW)],
      }),
      base({
        trust_class: "recent_verified_test",
        status: "degraded",
        evidence: [evidence("test_run", "t", NOW)],
      }),
      base({
        trust_class: "current_verified_runtime",
        status: "offline",
        evidence: [evidence("runtime_probe", "probe", NOW)],
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.status).toBe("offline");
    expect(merged[0]!.trust_class).toBe("current_verified_runtime");
    expect(merged[0]!.contradictions.map((c) => c.trust_class)).toEqual([
      "recent_verified_test",
      "config_registry",
      "architecture_docs",
      "roadmap",
    ]);
    expect(merged[0]!.evidence).toHaveLength(5);
  });

  it("same trust class: the more recent observation wins", () => {
    const older = base({
      trust_class: "current_verified_runtime",
      status: "operational",
      observed_at: "2026-09-07T09:00:00.000Z",
      evidence: [evidence("runtime_probe", "a", NOW)],
    });
    const newer = base({
      trust_class: "current_verified_runtime",
      status: "offline",
      observed_at: "2026-09-07T09:30:00.000Z",
      evidence: [evidence("runtime_probe", "b", NOW)],
    });
    expect(reconcileClaims([older, newer])[0]!.status).toBe("offline");
  });

  it("a stale probe result decays to unknown (never reported as current truth)", async () => {
    const stale = base({
      trust_class: "current_verified_runtime",
      status: "operational",
      observed_at: "2026-09-07T09:00:00.000Z",
      ttl_ms: 60_000,
      evidence: [evidence("runtime_probe", "a", NOW)],
    });
    expect(freshnessOf(stale, NOW_MS)).toBe("stale");
    const model = new SelfModel({
      now: () => new Date(NOW),
      sources: {
        constitutional: () => [],
        capabilities: () => [],
        runtime: () => [stale],
        experience: () => [],
        repository: () => [],
      },
    });
    const c = await model.find("self:x");
    expect(c?.status).toBe("unknown");
    expect(c?.statement).toMatch(/last observed operational/);
  });

  it("a source that throws becomes a warning, not a crash", async () => {
    const model = new SelfModel({
      now: () => new Date(NOW),
      sources: {
        constitutional: () => {
          throw new Error("boom");
        },
        capabilities: () => [],
        runtime: async () => [],
        experience: () => [],
        repository: () => [],
      },
    });
    const s = await model.snapshot();
    expect(s.warnings[0]).toMatch(/constitutional unavailable: boom/);
    expect(s.sources.find((x) => x.source_id === "constitutional")?.ok).toBe(
      false,
    );
    expect(SelfSnapshotSchema.safeParse(s).success).toBe(true);
  });
});

describe("E-050 — experience only from real evidence", () => {
  it("rates a tool only above the sample bar, from tool_calls rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      tool_id: "fs.read_file",
      tool_name: "Read",
      status: i < 9 ? "COMPLETED" : "ERROR",
      proposed_at: NOW_MS - 1000 * (i + 1),
      completed_at: NOW_MS - 900 * (i + 1),
    }));
    const rated = buildExperienceClaims({
      now: NOW,
      nowMs: NOW_MS,
      toolCalls: rows,
      telemetry: [],
    });
    const t = rated.find((c) => c.subject === "tool:fs.read_file");
    expect(t?.status).toBe("operational");
    expect(t?.statement).toMatch(/90% of 10 decided runs/);
    const thin = buildExperienceClaims({
      now: NOW,
      nowMs: NOW_MS,
      toolCalls: rows.slice(0, 3),
      telemetry: [],
    });
    expect(thin.find((c) => c.subject === "tool:fs.read_file")?.status).toBe(
      "unknown",
    );
  });

  it("reads the real audit tables (in-memory sqlite through the Phase 3 helpers)", async () => {
    const db = inMemoryDb();
    for (let i = 0; i < 6; i += 1) {
      const executionId = `exec-${i}`;
      createToolCall(db, {
        execution_id: executionId,
        session_id: "s",
        tool_id: "mock.status",
        tool_name: "Mock",
        status: "PENDING",
        safety_tag: "ALLOW",
        required_safety_tag: "ALLOW",
        scope_hash: "h",
        input_json: "{}",
        proposed_at: NOW_MS - 100,
        timeout_ms: 100,
      });
      updateToolCall(db, executionId, {
        status: i === 5 ? "ERROR" : "COMPLETED",
        completed_at: NOW_MS - 10,
      });
      insertTelemetryEvent(db, {
        timestamp: NOW_MS - 10,
        session_id: "s",
        event_type: "model_call",
        success: i !== 5,
        model_id: "ollama/qwen3.5-9b-mlx",
        latency_ms: 100 + i,
      } as never);
    }
    const model = liveModel({ db });
    const tool = await model.find("tool:mock.status");
    expect(tool?.trust_class).toBe("recent_verified_test");
    expect(tool?.status).toBe("degraded"); // 5/6 = 83%
    const m = await model.find("model:ollama/qwen3.5-9b-mlx");
    // Live probe says operational and outranks the 83% history; the history stays as a contradiction.
    expect(m?.status).toBe("operational");
    expect(
      m?.contradictions.some((c) => c.trust_class === "recent_verified_test"),
    ).toBe(true);
  });
});

describe("E-050 — sources in isolation", () => {
  it("constitutional: identity from the prompt line; unknown when absent", () => {
    const ok = buildConstitutionalClaims({
      now: NOW,
      systemPromptText: PROMPT,
    });
    expect(ok.find((c) => c.claim_id === "self:identity")?.status).toBe(
      "operational",
    );
    expect(
      ok.find((c) => c.claim_id === "self:constitution.approval-tiers")
        ?.statement,
    ).toMatch(/pure reads → auto/);
    expect(
      ok.filter((c) => c.subject.startsWith("authority-surface:")).length,
    ).toBe(17);
    const none = buildConstitutionalClaims({
      now: NOW,
      systemPromptText: null,
    });
    expect(none.find((c) => c.claim_id === "self:identity")?.status).toBe(
      "unknown",
    );
    for (const c of [...ok, ...none])
      expect(SelfClaimSchema.safeParse(c).success).toBe(true);
  });

  it("capabilities: cloud providers report 'credential configured' without a value", () => {
    const claims = buildCapabilityClaims({
      now: NOW,
      tools: [],
      models: [],
      providerIds: ["ollama", "openai"],
      voice: null,
      voiceFeatureFlags: null,
    });
    expect(
      claims.find((c) => c.subject === "provider:openai")?.statement,
    ).toMatch(/credential configured \(value withheld\)/);
    expect(claims.find((c) => c.subject === "provider:anthropic")?.status).toBe(
      "offline",
    );
  });

  it("runtime: absent probes yield no claim (not a fabricated one)", () => {
    const claims = buildRuntimeClaims({
      now: NOW,
      package_version: null,
      git: null,
      host: null,
      ollama: null,
      mlx_audio: null,
      db: null,
      event_store: null,
      doctor: null,
      registry_ollama_models: [],
    });
    expect(claims.map((c) => c.claim_id)).toEqual([
      "self:runtime.build",
      "self:node.topology",
    ]);
    expect(claims[0]!.status).toBe("unknown");
  });

  it("repository: enhancement rows parse with real status mapping", () => {
    const rows = parseEnhancementRows(REGISTRY_MD);
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["E-001", "operational"],
      ["E-002", "planned"],
      ["E-003", "unsupported"],
      ["E-004", "operational"],
    ]);
    const claims = buildRepositoryClaims({
      now: NOW,
      graph: null,
      registryMarkdown: REGISTRY_MD,
    });
    expect(
      claims.find((c) => c.claim_id === "self:repository.architecture")?.status,
    ).toBe("unknown");
    expect(
      claims.find((c) => c.subject === "enhancement:E-002")?.trust_class,
    ).toBe("architecture_docs");
  });
});

describe("E-050 — no leaks, no freeform writes, stable projection", () => {
  it("the leak guard catches credential keys and secret-shaped values", () => {
    expect(findSelfLeak({ openai_api_key: "x" })?.reason).toBe("forbidden_key");
    expect(
      findSelfLeak({ note: "sk-abcdefghijklmnopqrstuvwxyz1234" })?.reason,
    ).toBe("secret_value");
    expect(
      findSelfLeak({ note: "Bearer abcdefghijklmnopqrstuvwxyz" })?.reason,
    ).toBe("secret_value");
    expect(findSelfLeak({ nested: [{ prompt: "hi" }] })?.path).toBe(
      "$.nested[0].prompt",
    );
    expect(
      findSelfLeak({
        statement: "OpenAI credential configured (value withheld)",
      }),
    ).toBeNull();
  });

  it("a full live snapshot, context, explanation and projection carry no env values", async () => {
    const secret = "sk-testsecretvalue00000000000000000000";
    const model = createDefaultSelfModel({
      env: { OPENAI_API_KEY: secret, JARVIS_EVENT_STORE_ENABLED: "false" },
      db: inMemoryDb(),
      tools: [],
      fetchImpl: fakeFetch({}),
      probes: { doctor: () => null },
      persistSnapshots: false,
      now: () => new Date(NOW),
    });
    const snapshot = await model.snapshot();
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain(secret);
    expect(findSelfLeak(snapshot)).toBeNull();
    const ctx = buildSelfContext(snapshot, {
      task_kind: "chat",
      now_ms: NOW_MS,
    });
    expect(ctx.text.length).toBeLessThanOrEqual(2400);
    expect(ctx.text).toMatch(/^SELF \(evidence-backed/);
    expect(ctx.text).toContain("I am JARVIS");
    expect(findSelfLeak(ctx)).toBeNull();
    const projection = buildSelfProjection(snapshot, {
      now_ms: NOW_MS,
      headline: "operational",
    });
    expect(SelfProjectionSchema.safeParse(projection).success).toBe(true);
    expect(projection.sections.map((s) => s.id)).toEqual([
      "identity",
      "runtime",
      "capabilities",
      "experience",
      "limits",
      "repository",
    ]);
    expect(projection.identity).toEqual({
      name: "JARVIS",
      role: "a personal AI operating environment",
      owner_label: "Prince Anozie",
    });
  });

  it("the writer persists typed counts only and refuses anything else", () => {
    const events: Array<{
      eventType: string;
      metadataJson?: string;
      source: string;
    }> = [];
    const writer = createSelfModelWriter({
      appendEvent: (e) => events.push(e),
    });
    const snapshot: SelfSnapshot = SelfSnapshotSchema.parse({
      contract_version: "SM.1",
      generated_at: NOW,
      claims: [
        claim({
          claim_id: "self:identity",
          category: "identity",
          subject: "identity",
          statement: "I am JARVIS, x for y.",
          status: "operational",
          trust_class: "config_registry",
          observed_at: NOW,
          ttl_ms: null,
          evidence: [evidence("config", "prompt", NOW)],
        }),
      ],
      sources: [
        {
          source_id: "constitutional",
          ok: true,
          observed_at: NOW,
          claim_count: 1,
        },
      ],
      warnings: [],
      metadata_only: true,
      secret_material_included: false,
    });
    writer.recordSnapshot(snapshot);
    expect(events[0]!.eventType).toBe("self.snapshot_recorded");
    expect(events[0]!.source).toBe("self-model");
    const meta = JSON.parse(events[0]!.metadataJson!) as Record<
      string,
      unknown
    >;
    expect(Object.keys(meta).sort()).toEqual([
      "by_status",
      "claim_count",
      "contract_version",
      "contradiction_count",
      "generated_at",
      "metadata_only",
      "sources",
      "warning_count",
    ]);
    expect(JSON.stringify(meta)).not.toContain("I am JARVIS"); // no claim text is written
    expect(() =>
      writer.recordObservation({
        kind: "probe_failure",
        subject: "provider:ollama",
        detail: "token=abcdefghijklmnopqrstuvwxyz",
        observed_at: NOW,
      }),
    ).toThrow(/secret_value/);
    expect(() =>
      writer.recordObservation({
        kind: "freeform" as never,
        subject: "x",
        detail: "anything",
        observed_at: NOW,
      }),
    ).toThrow();
    expect(createSelfModelWriter(null).recordSnapshot(snapshot)).toBeNull();
  });
});
