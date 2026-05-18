import type DatabaseType from "better-sqlite3";
import { listMessages, type MessageRow } from "../db/messages";
import {
  getLatestSessionSummary,
  type SessionSummaryRow,
} from "../db/session-summaries";
import { insertTelemetryEvent } from "../db/telemetry";
import {
  MemoryRetriever,
  memoryRetrievalResultToToolData,
  type MemoryRetrievalResult,
  type MemoryRetrieverResult,
} from "../memory/retriever";
import type {
  LongTermMemoryCategory,
  SearchableMemorySensitivity,
} from "../memory/types";
import { workingMemoryConfigFromEnv, type WorkingMemoryConfig } from "./config";

export interface WorkingMemorySystemPromptMetadata {
  hash?: string;
  name?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface WorkingMemoryRetrievedMemory {
  id: string;
  category: LongTermMemoryCategory;
  content: string;
  source: string;
  sourceId: string | null;
  project: string | null;
  tags: string[];
  sensitivity: string;
  createdAt: number;
  updatedAt: number;
  obsidianPath: string | null;
  score: MemoryRetrievalResult["score"];
}

export interface WorkingMemoryBudgetMetadata {
  maxChars: number;
  usedChars: number;
  initialChars: number;
  breached: boolean;
  maxRecentMessages: number;
  maxRetrievedMemories: number;
  trimmedRecentMessages: number;
  trimmedRetrievedMemories: number;
}

export interface WorkingMemoryContext {
  systemPrompt: WorkingMemorySystemPromptMetadata | null;
  latestSessionSummary: {
    summaryHash: string;
    previousSummaryHash: string | null;
    summaryText: string;
    coveredMessageCount: number;
    createdAt: number;
    updatedAt: number;
  } | null;
  recentMessages: MessageRow[];
  retrievedMemories: WorkingMemoryRetrievedMemory[];
  budget: WorkingMemoryBudgetMetadata;
}

export type WorkingMemoryAssemblyResult =
  | {
      ok: true;
      status: "disabled";
      context: null;
      budget: WorkingMemoryBudgetMetadata;
    }
  | {
      ok: true;
      status: "assembled";
      context: WorkingMemoryContext;
      budget: WorkingMemoryBudgetMetadata;
    };

export interface WorkingMemoryAssemblerInput {
  sessionId: string;
  queryText?: string;
  systemPrompt?: WorkingMemorySystemPromptMetadata | null;
  category?: LongTermMemoryCategory;
  project?: string;
  tag?: string;
  sensitivityCeiling?: SearchableMemorySensitivity;
}

export interface WorkingMemoryRetriever {
  retrieve(input: {
    query: string;
    category?: LongTermMemoryCategory;
    project?: string;
    tag?: string;
    sensitivityCeiling?: SearchableMemorySensitivity;
    maxResults?: number;
    sessionId?: string;
  }): Promise<MemoryRetrieverResult>;
}

export interface WorkingMemoryAssemblerDeps {
  config?: WorkingMemoryConfig;
  retriever?: WorkingMemoryRetriever;
  now?: () => number;
}

function validSummary(row: SessionSummaryRow | undefined) {
  if (!row || !row.summary_text.trim()) return null;
  return {
    summaryHash: row.summary_hash,
    previousSummaryHash: row.previous_summary_hash,
    summaryText: row.summary_text,
    coveredMessageCount: row.covered_message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recentMessageWindow(
  messages: MessageRow[],
  maxRecentMessages: number,
): MessageRow[] {
  return messages.slice(-maxRecentMessages);
}

function charCount(input: {
  systemPrompt: WorkingMemorySystemPromptMetadata | null;
  latestSessionSummary: WorkingMemoryContext["latestSessionSummary"];
  recentMessages: MessageRow[];
  retrievedMemories: WorkingMemoryRetrievedMemory[];
}): number {
  return JSON.stringify(input).length;
}

function emptyBudget(config: WorkingMemoryConfig): WorkingMemoryBudgetMetadata {
  return {
    maxChars: config.maxChars,
    usedChars: 0,
    initialChars: 0,
    breached: false,
    maxRecentMessages: config.maxRecentMessages,
    maxRetrievedMemories: config.maxRetrievedMemories,
    trimmedRecentMessages: 0,
    trimmedRetrievedMemories: 0,
  };
}

function retrievedMemoryToContext(
  row: MemoryRetrievalResult,
): WorkingMemoryRetrievedMemory {
  return memoryRetrievalResultToToolData(row) as WorkingMemoryRetrievedMemory;
}

export class WorkingMemoryAssembler {
  constructor(
    private readonly db: DatabaseType.Database,
    private readonly deps: WorkingMemoryAssemblerDeps = {},
  ) {}

  async assemble(
    input: WorkingMemoryAssemblerInput,
  ): Promise<WorkingMemoryAssemblyResult> {
    const config = this.deps.config ?? workingMemoryConfigFromEnv();
    if (!config.enabled) {
      return {
        ok: true,
        status: "disabled",
        context: null,
        budget: emptyBudget(config),
      };
    }

    const systemPrompt = input.systemPrompt ?? null;
    const latestSessionSummary = validSummary(
      getLatestSessionSummary(this.db, input.sessionId),
    );
    const recentMessages = recentMessageWindow(
      listMessages(this.db, input.sessionId),
      config.maxRecentMessages,
    );
    const retrievedMemories = await this.retrieveMemories(input, config);
    const initialChars = charCount({
      systemPrompt,
      latestSessionSummary,
      recentMessages,
      retrievedMemories,
    });

    const trimmed = this.trimToBudget({
      systemPrompt,
      latestSessionSummary,
      recentMessages,
      retrievedMemories,
      config,
    });

    const budget: WorkingMemoryBudgetMetadata = {
      maxChars: config.maxChars,
      initialChars,
      usedChars: trimmed.usedChars,
      breached: trimmed.usedChars > config.maxChars,
      maxRecentMessages: config.maxRecentMessages,
      maxRetrievedMemories: config.maxRetrievedMemories,
      trimmedRecentMessages: trimmed.trimmedRecentMessages,
      trimmedRetrievedMemories: trimmed.trimmedRetrievedMemories,
    };
    const context: WorkingMemoryContext = {
      systemPrompt,
      latestSessionSummary,
      recentMessages: trimmed.recentMessages,
      retrievedMemories: trimmed.retrievedMemories,
      budget,
    };

    if (initialChars > config.maxChars) {
      this.emitBudgetBreach(input.sessionId, budget);
    }
    this.emitAssembled(input.sessionId, context);

    return {
      ok: true,
      status: "assembled",
      context,
      budget,
    };
  }

  private async retrieveMemories(
    input: WorkingMemoryAssemblerInput,
    config: WorkingMemoryConfig,
  ): Promise<WorkingMemoryRetrievedMemory[]> {
    const query = input.queryText?.trim();
    if (!query) return [];
    const retriever = this.deps.retriever ?? new MemoryRetriever(this.db);
    const result = await retriever.retrieve({
      query,
      category: input.category,
      project: input.project,
      tag: input.tag,
      sensitivityCeiling: input.sensitivityCeiling,
      maxResults: config.maxRetrievedMemories,
      sessionId: input.sessionId,
    });
    return result.results
      .slice(0, config.maxRetrievedMemories)
      .map(retrievedMemoryToContext);
  }

  private trimToBudget(input: {
    systemPrompt: WorkingMemorySystemPromptMetadata | null;
    latestSessionSummary: WorkingMemoryContext["latestSessionSummary"];
    recentMessages: MessageRow[];
    retrievedMemories: WorkingMemoryRetrievedMemory[];
    config: WorkingMemoryConfig;
  }): {
    recentMessages: MessageRow[];
    retrievedMemories: WorkingMemoryRetrievedMemory[];
    usedChars: number;
    trimmedRecentMessages: number;
    trimmedRetrievedMemories: number;
  } {
    const recentMessages = [...input.recentMessages];
    const retrievedMemories = [...input.retrievedMemories];
    let usedChars = charCount({
      systemPrompt: input.systemPrompt,
      latestSessionSummary: input.latestSessionSummary,
      recentMessages,
      retrievedMemories,
    });
    let trimmedRetrievedMemories = 0;
    let trimmedRecentMessages = 0;

    while (usedChars > input.config.maxChars && retrievedMemories.length > 0) {
      retrievedMemories.pop();
      trimmedRetrievedMemories += 1;
      usedChars = charCount({
        systemPrompt: input.systemPrompt,
        latestSessionSummary: input.latestSessionSummary,
        recentMessages,
        retrievedMemories,
      });
    }

    while (usedChars > input.config.maxChars && recentMessages.length > 0) {
      recentMessages.shift();
      trimmedRecentMessages += 1;
      usedChars = charCount({
        systemPrompt: input.systemPrompt,
        latestSessionSummary: input.latestSessionSummary,
        recentMessages,
        retrievedMemories,
      });
    }

    return {
      recentMessages,
      retrievedMemories,
      usedChars,
      trimmedRecentMessages,
      trimmedRetrievedMemories,
    };
  }

  private emitBudgetBreach(
    sessionId: string,
    budget: WorkingMemoryBudgetMetadata,
  ): void {
    insertTelemetryEvent(this.db, {
      timestamp: this.deps.now?.() ?? Date.now(),
      event_type: "context_budget_breach",
      success: !budget.breached,
      session_id: sessionId,
      notes: `initial_chars=${budget.initialChars} used_chars=${budget.usedChars} max_chars=${budget.maxChars} trimmed_memories=${budget.trimmedRetrievedMemories} trimmed_messages=${budget.trimmedRecentMessages}`,
    });
  }

  private emitAssembled(
    sessionId: string,
    context: WorkingMemoryContext,
  ): void {
    insertTelemetryEvent(this.db, {
      timestamp: this.deps.now?.() ?? Date.now(),
      event_type: "working_memory_assembled",
      success: true,
      session_id: sessionId,
      notes: `summary=${context.latestSessionSummary ? "present" : "none"} recent_messages=${context.recentMessages.length} retrieved_memories=${context.retrievedMemories.length} used_chars=${context.budget.usedChars} max_chars=${context.budget.maxChars}`,
    });
  }
}
