import { randomUUID } from "node:crypto";
import type DatabaseType from "better-sqlite3";
import { z } from "zod";
import {
  createMemoryCandidate,
  type MemoryCandidateRow,
} from "../db/memory-candidates";
import { listMessages } from "../db/messages";
import { getLatestSessionSummary } from "../db/session-summaries";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  LONG_TERM_MEMORY_CATEGORIES,
  MEMORY_SENSITIVITY_TIERS,
} from "../memory/types";
import type { ChatProvider, ProviderId } from "../providers";
import { enforceRouterSafety, resolveAuxModel } from "../router";
import type { RouterDecision } from "../router";
import type { Message } from "../types";

export const MAX_MEMORY_CANDIDATES_PER_RUN = 5;
export const MEMORY_CANDIDATE_MAX_TOKENS = 900;

const CANDIDATE_SYSTEM_PROMPT = [
  "You propose draft memory candidates for JARVIS review.",
  "Use only information explicitly present in the provided session messages or summary.",
  "Do not speculate.",
  "Do not write memories directly.",
  "Return strict JSON only, with no markdown and no commentary.",
].join(" ");

const CandidateSchema = z.object({
  source_message_ids: z.array(z.string().min(1)).default([]),
  proposed_category: z.enum(LONG_TERM_MEMORY_CATEGORIES),
  proposed_content: z.string().min(1).max(1_200),
  proposed_tags: z.array(z.string().min(1)).default([]),
  proposed_sensitivity: z.enum(MEMORY_SENSITIVITY_TIERS),
  rationale: z.string().min(1).max(1_000),
});

const CandidateResponseSchema = z
  .object({
    candidates: z.array(CandidateSchema),
  })
  .strict();

export interface MemoryCandidateProviderRegistry {
  get(id: ProviderId): ChatProvider;
}

export interface GenerateMemoryCandidatesInput {
  db: DatabaseType.Database;
  sessionId: string;
  requestedProvider?: ProviderId;
  registry?: MemoryCandidateProviderRegistry;
  now?: () => number;
  signal?: AbortSignal;
  idFactory?: () => string;
}

export type GenerateMemoryCandidatesResult =
  | {
      ok: true;
      status: "generated";
      candidates: MemoryCandidateRow[];
      modelId: string;
    }
  | {
      ok: false;
      status:
        | "empty_session"
        | "safety_blocked"
        | "provider_error"
        | "parse_error";
      reason: string;
    };

async function defaultRegistry(): Promise<MemoryCandidateProviderRegistry> {
  const providers = await import("../providers");
  return providers.registry;
}

function transcriptFor(rows: ReturnType<typeof listMessages>): string {
  return rows
    .map((row, index) => {
      const role = row.role.toUpperCase();
      return `${index + 1}. id=${row.id} ${role}: ${row.content}`;
    })
    .join("\n");
}

function generationMessages(input: {
  messages: ReturnType<typeof listMessages>;
  latestSummary?: string;
}): Message[] {
  return [
    { role: "system", content: CANDIDATE_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "Extract up to 5 draft memory candidates from this stored JARVIS session.",
        "Only include stable facts, user preferences, events, or decisions that may be useful later.",
        "Use one of these categories: fact, preference, event, decision.",
        "Use one of these sensitivity values: public, personal, sensitive, restricted.",
        "Return exactly this JSON shape:",
        '{"candidates":[{"source_message_ids":["message-id"],"proposed_category":"fact","proposed_content":"...","proposed_tags":["#tag"],"proposed_sensitivity":"personal","rationale":"..."}]}',
        input.latestSummary
          ? `Latest session summary:\n${input.latestSummary}`
          : "Latest session summary: none",
        "Session messages:",
        transcriptFor(input.messages),
      ].join("\n\n"),
    },
  ];
}

function emitFailureTelemetry(
  db: DatabaseType.Database,
  input: {
    at: number;
    sessionId: string;
    modelId?: string;
    auxTaskKind?: string;
    errorClass: string;
    reason: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.at,
    event_type: "memory_candidate_generated",
    success: false,
    session_id: input.sessionId,
    model_id: input.modelId,
    aux_task_kind: input.auxTaskKind,
    error_class: input.errorClass,
    notes: `aux_task_kind=${input.auxTaskKind ?? "unknown"} reason=${input.reason}`,
  });
}

function parseCandidateResponse(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Invalid JSON response.",
    );
  }
  return CandidateResponseSchema.parse(parsed);
}

export async function generateMemoryCandidates(
  input: GenerateMemoryCandidatesInput,
): Promise<GenerateMemoryCandidatesResult> {
  const at = input.now?.() ?? Date.now();
  const rows = listMessages(input.db, input.sessionId);
  const latestSummary = getLatestSessionSummary(input.db, input.sessionId);
  if (rows.length === 0 && !latestSummary) {
    return {
      ok: false,
      status: "empty_session",
      reason: "session_has_no_messages_or_summary",
    };
  }

  const messages = generationMessages({
    messages: rows,
    latestSummary: latestSummary?.summary_text,
  });
  const auxResolution = resolveAuxModel("keyword_extract");
  const decision = auxResolutionToRouterDecision(auxResolution);
  const safety = enforceRouterSafety(decision);
  if (safety) {
    emitFailureTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      modelId: decision.selection.model.modelName,
      auxTaskKind: "keyword_extract",
      errorClass: "SafetyBlocked",
      reason: "safety_blocked",
    });
    return {
      ok: false,
      status: "safety_blocked",
      reason: "safety_blocked",
    };
  }

  const registry = input.registry ?? (await defaultRegistry());
  const provider = registry.get(decision.selection.providerId);

  try {
    const generated = await provider.generate(messages, {
      model: decision.selection.model.modelName,
      temperature: 0,
      maxTokens: MEMORY_CANDIDATE_MAX_TOKENS,
      signal: input.signal,
    });
    let parsed: z.infer<typeof CandidateResponseSchema>;
    try {
      parsed = parseCandidateResponse(generated.content);
    } catch (error) {
      emitFailureTelemetry(input.db, {
        at,
        sessionId: input.sessionId,
        modelId: generated.modelId,
        auxTaskKind: "keyword_extract",
        errorClass: "StrictJsonParseError",
        reason: "parse_error",
      });
      return {
        ok: false,
        status: "parse_error",
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    const idFactory = input.idFactory ?? randomUUID;
    const candidates = parsed.candidates
      .slice(0, MAX_MEMORY_CANDIDATES_PER_RUN)
      .map((candidate) =>
        createMemoryCandidate(input.db, {
          id: idFactory(),
          sessionId: input.sessionId,
          sourceMessageIds: candidate.source_message_ids,
          proposedCategory: candidate.proposed_category,
          proposedContent: candidate.proposed_content,
          proposedTags: candidate.proposed_tags,
          proposedSensitivity: candidate.proposed_sensitivity,
          rationale: candidate.rationale,
          createdAt: at,
        }),
      );

    return {
      ok: true,
      status: "generated",
      candidates,
      modelId: generated.modelId,
    };
  } catch (error) {
    emitFailureTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      modelId: decision.selection.model.modelName,
      auxTaskKind: "keyword_extract",
      errorClass: error instanceof Error ? error.constructor.name : "Error",
      reason: "provider_error",
    });
    return {
      ok: false,
      status: "provider_error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function auxResolutionToRouterDecision(
  resolution: ReturnType<typeof resolveAuxModel>,
): RouterDecision {
  return {
    intent: {
      intent: "INFORMATION_REQUEST",
      reason: `Aux task ${resolution.kind} resolved independently of parent route.`,
    },
    safety: resolution.safety,
    capability: {
      tier: resolution.selection.model.tier,
      requiredCapabilities: [...resolution.requirement.requires],
      reason: `Auxiliary ${resolution.kind} capability requirement.`,
    },
    selection: resolution.selection,
  };
}
