import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "../db/telemetry";
import type { MemoryRetrievalMode } from "./retriever";

export interface EmitMemorySurfacedTelemetryInput {
  memoryIds: string[];
  retrievalMode?: MemoryRetrievalMode;
  sessionId?: string;
  executionId?: string;
  now?: () => number;
}

export function emitMemorySurfacedTelemetry(
  db: DatabaseType.Database,
  input: EmitMemorySurfacedTelemetryInput,
): number {
  const memoryIds = Array.from(
    new Set(input.memoryIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (memoryIds.length === 0) return 0;

  insertTelemetryEvent(db, {
    timestamp: input.now?.() ?? Date.now(),
    event_type: "memory_surfaced",
    success: true,
    session_id: input.sessionId,
    execution_id: input.executionId,
    tool_name: "memory.recall",
    notes: `mode=${input.retrievalMode ?? "keyword_only"} result_ids=${JSON.stringify(memoryIds)}`,
  });

  return memoryIds.length;
}
