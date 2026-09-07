// Self Model (E-050) — read-only introspection tools.
//
// Six tools, all PURE_READ / ALLOW, all answering from one cached
// snapshot. They are the ONLY model-facing surface of the Self Model: a
// model can ask what JARVIS is, can do, cannot do, is doing, and why it
// believes so. There is deliberately no self.modify, no self.set, no
// self.write — introspection has no hands.
import { z } from "zod";
import type { Tool, ToolResult } from "../tools/types";
import {
  SelfClaimCategorySchema,
  SelfClaimStatusSchema,
  SelfContextTaskKindSchema,
} from "./contracts";
import { buildSelfContext, explainClaim } from "./context";
import type { SelfModel } from "./model";
import { buildSelfProjection } from "./projection";
import { assertNoSelfLeak } from "./redaction";

export type SelfModelProvider = (context: {
  db?: unknown;
}) => Promise<SelfModel>;

let provider: SelfModelProvider | null = null;

/** Host wiring (default: the node composition with the live registries). */
export function setSelfModelProvider(next: SelfModelProvider | null): void {
  provider = next;
}

async function resolveModel(context: { db?: unknown }): Promise<SelfModel> {
  if (provider) return provider(context);
  const { createDefaultSelfModel } = await import("./default");
  const { tools } = await import("../tools/registry");
  const db = context.db as import("better-sqlite3").Database | undefined;
  const model = createDefaultSelfModel({ db: db ?? null, tools: tools.list() });
  provider = async () => model;
  return model;
}

function ok(message: string, data: unknown): ToolResult {
  return { ok: true, message, data: assertNoSelfLeak(data) };
}

const NoInputSchema = z.object({}).strict();

export const selfDescribeTool: Tool<Record<string, never>> = {
  id: "self.describe",
  name: "Self: describe",
  description:
    "Who and what JARVIS is: identity, role, constitution and standing limits, with provenance.",
  requiredSafetyTag: "ALLOW",
  inputSchema: NoInputSchema as z.ZodType<Record<string, never>>,
  scopeOf: () => "self.describe",
  reversibilityClass: "PURE_READ",
  timeoutMs: 8000,
  async execute(_input, context) {
    const model = await resolveModel(context);
    const claims = await model.claims();
    const pick = (cat: string) =>
      claims
        .filter((c) => c.category === cat)
        .map(({ claim_id, statement, status, trust_class }) => ({
          claim_id,
          statement,
          status,
          trust_class,
        }));
    return ok("Self description assembled from governed sources.", {
      identity: pick("identity"),
      constitution: pick("constitution").filter(
        (c) => !c.claim_id.startsWith("self:authority-surface"),
      ),
      limits: pick("limit").filter((c) => c.claim_id.startsWith("self:limit.")),
    });
  },
};

export interface SelfCapabilitiesInput {
  category?: z.infer<typeof SelfClaimCategorySchema>;
  status?: z.infer<typeof SelfClaimStatusSchema>;
  subject_prefix?: string;
}
export const SelfCapabilitiesInputSchema = z.object({
  category: SelfClaimCategorySchema.optional(),
  status: SelfClaimStatusSchema.optional(),
  subject_prefix: z.string().max(60).optional(),
});
export const selfCapabilitiesTool: Tool<SelfCapabilitiesInput> = {
  id: "self.capabilities",
  name: "Self: capabilities",
  description:
    'What JARVIS can do right now — tools, models, providers, voice — each with status (operational/degraded/offline/planned/…) and evidence class. Filter by category, status or subject prefix (e.g. "tool:", "model:", "voice:").',
  requiredSafetyTag: "ALLOW",
  inputSchema: SelfCapabilitiesInputSchema,
  scopeOf: () => "self.capabilities",
  reversibilityClass: "PURE_READ",
  timeoutMs: 8000,
  async execute(input, context) {
    const model = await resolveModel(context);
    const claims = await model.claims({
      category:
        input.category ?? (input.subject_prefix ? undefined : "capability"),
      status: input.status,
      subjectPrefix: input.subject_prefix,
    });
    return ok(`${claims.length} capability claims.`, {
      claims: claims.map(
        ({
          claim_id,
          subject,
          statement,
          status,
          trust_class,
          observed_at,
          contradictions,
        }) => ({
          claim_id,
          subject,
          statement,
          status,
          trust_class,
          observed_at,
          contradiction_count: contradictions.length,
        }),
      ),
    });
  },
};

export const selfLimitsTool: Tool<Record<string, never>> = {
  id: "self.limits",
  name: "Self: limits",
  description:
    "What JARVIS cannot or must not do: standing limits, disabled features and the approval-tier constitution.",
  requiredSafetyTag: "ALLOW",
  inputSchema: NoInputSchema as z.ZodType<Record<string, never>>,
  scopeOf: () => "self.limits",
  reversibilityClass: "PURE_READ",
  timeoutMs: 8000,
  async execute(_input, context) {
    const model = await resolveModel(context);
    const limits = await model.claims({ category: "limit" });
    const planned = await model.claims({ status: "planned" });
    return ok(
      `${limits.length} limits, ${planned.length} planned-not-present capabilities.`,
      {
        standing_limits: limits
          .filter((c) => c.claim_id.startsWith("self:limit."))
          .map((c) => c.statement),
        disabled_features: limits
          .filter((c) => c.subject.startsWith("disabled-feature"))
          .map(({ subject, statement }) => ({ subject, statement })),
        planned: planned.map(({ subject, statement }) => ({
          subject,
          statement,
        })),
      },
    );
  },
};

export const selfStatusTool: Tool<Record<string, never>> = {
  id: "self.status",
  name: "Self: status",
  description:
    "Live runtime self-snapshot: build, host, Ollama, TTS server, database, doctor verdict, with freshness and the headline status.",
  requiredSafetyTag: "ALLOW",
  inputSchema: NoInputSchema as z.ZodType<Record<string, never>>,
  scopeOf: () => "self.status",
  reversibilityClass: "PURE_READ",
  timeoutMs: 10000,
  async execute(_input, context) {
    const model = await resolveModel(context);
    const status = await model.status();
    const runtime = await model.claims({ category: "runtime" });
    const node = await model.claims({ category: "node" });
    return ok(`Headline: ${status.headline}.`, {
      ...status,
      runtime: [...runtime, ...node].map(
        ({ claim_id, statement, status: s, observed_at, ttl_ms }) => ({
          claim_id,
          statement,
          status: s,
          observed_at,
          ttl_ms,
        }),
      ),
    });
  },
};

export interface SelfExplainInput {
  claim: string;
}
export const SelfExplainInputSchema = z.object({
  claim: z.string().min(1).max(160),
});
export const selfExplainTool: Tool<SelfExplainInput> = {
  id: "self.explain",
  name: "Self: explain",
  description:
    "Why JARVIS believes a self-claim: evidence trail, trust class, freshness, overruled contradictions, and how to verify. Pass a claim_id (self:…) or a subject (tool:…, model:…).",
  requiredSafetyTag: "ALLOW",
  inputSchema: SelfExplainInputSchema,
  scopeOf: (input) => `self.explain:${input.claim}`,
  reversibilityClass: "PURE_READ",
  timeoutMs: 8000,
  async execute(input, context) {
    const model = await resolveModel(context);
    const found = await model.find(input.claim);
    if (!found) {
      return {
        ok: false,
        message: `No self-claim matches "${input.claim}". I do not invent claims; ask self.capabilities or self.status for the subjects I know.`,
      };
    }
    const snapshot = await model.snapshot();
    return ok(
      `Explained ${found.claim_id}.`,
      explainClaim(found, Date.parse(snapshot.generated_at)),
    );
  },
};

export interface SelfContextInput {
  task_kind?: z.infer<typeof SelfContextTaskKindSchema>;
  max_chars?: number;
}
export const SelfContextInputSchema = z.object({
  task_kind: SelfContextTaskKindSchema.optional(),
  max_chars: z.number().int().min(200).max(6000).optional(),
});
export const selfContextTool: Tool<SelfContextInput> = {
  id: "self.context",
  name: "Self: reasoning context",
  description:
    "A compact, bounded self-context block (identity, verified-now capabilities, degraded/offline, limits, freshness) for a router, orchestrator or prompt assembler.",
  requiredSafetyTag: "ALLOW",
  inputSchema: SelfContextInputSchema,
  scopeOf: (input) => `self.context:${input.task_kind ?? "chat"}`,
  reversibilityClass: "PURE_READ",
  timeoutMs: 8000,
  async execute(input, context) {
    const model = await resolveModel(context);
    const snapshot = await model.snapshot();
    const ctx = buildSelfContext(snapshot, {
      task_kind: input.task_kind ?? "chat",
      now_ms: Date.parse(snapshot.generated_at),
      max_chars: input.max_chars,
    });
    return ok(`${ctx.char_count} chars.`, ctx);
  },
};

export const selfProjectionTool: Tool<Record<string, never>> = {
  id: "self.projection",
  name: "Self: frontend projection",
  description:
    "The typed, UI-agnostic Self projection (sections of claims with status/freshness) for a frontend panel.",
  requiredSafetyTag: "ALLOW",
  inputSchema: NoInputSchema as z.ZodType<Record<string, never>>,
  scopeOf: () => "self.projection",
  reversibilityClass: "PURE_READ",
  timeoutMs: 8000,
  async execute(_input, context) {
    const model = await resolveModel(context);
    const snapshot = await model.snapshot();
    const status = await model.status();
    return ok(
      "Projection built.",
      buildSelfProjection(snapshot, {
        now_ms: Date.parse(snapshot.generated_at),
        headline: status.headline,
      }),
    );
  },
};

export const selfModelTools: readonly Tool<never>[] = [
  selfDescribeTool,
  selfCapabilitiesTool,
  selfLimitsTool,
  selfStatusTool,
  selfExplainTool,
  selfContextTool,
  selfProjectionTool,
] as unknown as readonly Tool<never>[];

export const SELF_MODEL_TOOL_IDS = selfModelTools.map((t) => t.id);
