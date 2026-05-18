import type DatabaseType from "better-sqlite3";
import { listMessages } from "../db/messages";
import { saveSessionSummary } from "../db/session-summaries";
import type { SessionSummaryRow } from "../db/session-summaries";
import { insertTelemetryEvent } from "../db/telemetry";
import type { ChatProvider, ProviderId } from "../providers";
import { enforceRouterSafety, routeMessages } from "../router";
import type { Message } from "../types";

export const SESSION_SUMMARY_MAX_CHARS = 1_200;
export const SESSION_SUMMARY_MAX_TOKENS = 240;

const SUMMARY_SYSTEM_PROMPT = [
  "You create concise factual session summaries for JARVIS.",
  "Use only information explicitly present in the transcript.",
  "Do not speculate.",
  "Do not infer emotions, motives, mental state, personality, or intent beyond explicit statements.",
  "Target 200 tokens or fewer and 1,200 characters or fewer.",
  "Write plain text only.",
].join(" ");

export interface SessionSummaryProviderRegistry {
  get(id: ProviderId): ChatProvider;
}

export interface GenerateSessionSummaryInput {
  db: DatabaseType.Database;
  sessionId: string;
  requestedProvider?: ProviderId;
  registry?: SessionSummaryProviderRegistry;
  now?: () => number;
  signal?: AbortSignal;
}

export type GenerateSessionSummaryResult =
  | {
      ok: true;
      status: "generated";
      summary: SessionSummaryRow;
      modelId: string;
      coveredMessageCount: number;
    }
  | {
      ok: false;
      status: "empty_session" | "safety_blocked" | "provider_error";
      reason: string;
    };

async function defaultRegistry(): Promise<SessionSummaryProviderRegistry> {
  const providers = await import("../providers");
  return providers.registry;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function enforceSessionSummaryBudget(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= SESSION_SUMMARY_MAX_CHARS) return normalized;

  const clipped = normalized.slice(0, SESSION_SUMMARY_MAX_CHARS);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?"),
  );
  if (sentenceEnd >= SESSION_SUMMARY_MAX_CHARS * 0.6) {
    return clipped.slice(0, sentenceEnd + 1).trim();
  }
  const wordEnd = clipped.lastIndexOf(" ");
  return clipped.slice(0, wordEnd > 0 ? wordEnd : clipped.length).trim();
}

function transcriptFor(messages: Message[]): string {
  return messages
    .map((message, index) => {
      const role = message.role.toUpperCase();
      return `${index + 1}. ${role}: ${message.content}`;
    })
    .join("\n");
}

function summaryMessages(messages: Message[]): Message[] {
  return [
    { role: "system", content: SUMMARY_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "Summarize this stored JARVIS session transcript.",
        "Include concrete decisions, tasks, outcomes, constraints, and unresolved follow-ups only when explicitly stated.",
        "Transcript:",
        transcriptFor(messages),
      ].join("\n\n"),
    },
  ];
}

function emitGeneratedTelemetry(
  db: DatabaseType.Database,
  input: {
    at: number;
    sessionId: string;
    success: boolean;
    modelId?: string;
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    errorClass?: string;
    notes: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.at,
    event_type: "session_summary_generated",
    success: input.success,
    session_id: input.sessionId,
    model_id: input.modelId,
    latency_ms: input.latencyMs,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    cost_usd: input.costUsd,
    error_class: input.errorClass,
    notes: input.notes,
  });
}

export async function generateSessionSummary(
  input: GenerateSessionSummaryInput,
): Promise<GenerateSessionSummaryResult> {
  const at = input.now?.() ?? Date.now();
  const rows = listMessages(input.db, input.sessionId);
  if (rows.length === 0) {
    return {
      ok: false,
      status: "empty_session",
      reason: "session_has_no_messages",
    };
  }

  const messages = rows.map((row) => ({
    role: row.role,
    content: row.content,
  })) satisfies Message[];
  const generationMessages = summaryMessages(messages);
  const decision = routeMessages(generationMessages, {
    requestedProvider: input.requestedProvider,
  });
  const safety = enforceRouterSafety(decision);
  if (safety) {
    emitGeneratedTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      success: false,
      modelId: decision.selection.model.modelName,
      errorClass: "SafetyBlocked",
      notes: `reason=safety_blocked covered_message_count=${rows.length}`,
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
    const generated = await provider.generate(generationMessages, {
      model: decision.selection.model.modelName,
      temperature: 0,
      maxTokens: SESSION_SUMMARY_MAX_TOKENS,
      signal: input.signal,
    });
    const summaryText = enforceSessionSummaryBudget(generated.content);
    if (!summaryText) {
      throw new Error("Provider returned an empty summary.");
    }

    const saved = saveSessionSummary(input.db, {
      sessionId: input.sessionId,
      summaryText,
      coveredMessageCount: rows.length,
      now: () => at,
    });
    emitGeneratedTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      success: true,
      modelId: generated.modelId,
      latencyMs: generated.latencyMs,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      costUsd: generated.costUsd,
      notes: `summary_hash=${saved.summary_hash} covered_message_count=${rows.length} chars=${summaryText.length}`,
    });

    return {
      ok: true,
      status: "generated",
      summary: saved,
      modelId: generated.modelId,
      coveredMessageCount: rows.length,
    };
  } catch (error) {
    emitGeneratedTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      success: false,
      modelId: decision.selection.model.modelName,
      errorClass: error instanceof Error ? error.constructor.name : "Error",
      notes: `reason=provider_error covered_message_count=${rows.length}`,
    });
    return {
      ok: false,
      status: "provider_error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
