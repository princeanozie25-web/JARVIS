import type DatabaseType from "better-sqlite3";
import { listMessages } from "../db/messages";
import { getLatestSessionSummary } from "../db/session-summaries";
import { insertTelemetryEvent } from "../db/telemetry";
import type { ProviderId } from "../providers";
import {
  sessionSummaryConfigFromEnv,
  type SessionSummaryConfig,
} from "./config";
import {
  generateSessionSummary,
  type GenerateSessionSummaryInput,
  type GenerateSessionSummaryResult,
} from "./generator";

export interface TriggerRollingSessionSummaryInput {
  db: DatabaseType.Database;
  sessionId: string;
  requestedProvider?: ProviderId;
  config?: SessionSummaryConfig;
  now?: () => number;
  generate?: (
    input: GenerateSessionSummaryInput,
  ) => Promise<GenerateSessionSummaryResult>;
}

export type TriggerRollingSessionSummaryResult =
  | {
      ok: true;
      status: "triggered";
      coveredMessageCount: number;
      summaryHash: string;
    }
  | {
      ok: true;
      status: "skipped";
      reason:
        | "disabled"
        | "below_threshold"
        | "duplicate_covered_message_count";
      coveredMessageCount: number;
    }
  | {
      ok: false;
      status: "failed";
      reason: string;
      coveredMessageCount: number;
    };

function emitRollingTelemetry(
  db: DatabaseType.Database,
  input: {
    at: number;
    sessionId: string;
    eventType:
      | "session_summary_triggered"
      | "session_summary_skipped"
      | "session_summary_failed";
    success: boolean;
    notes: string;
    errorClass?: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.at,
    event_type: input.eventType,
    success: input.success,
    session_id: input.sessionId,
    error_class: input.errorClass,
    notes: input.notes,
  });
}

export async function triggerRollingSessionSummary(
  input: TriggerRollingSessionSummaryInput,
): Promise<TriggerRollingSessionSummaryResult> {
  const at = input.now?.() ?? Date.now();
  const config = input.config ?? sessionSummaryConfigFromEnv();
  const messages = listMessages(input.db, input.sessionId);
  const coveredMessageCount = messages.length;

  if (!config.enabled) {
    emitRollingTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      eventType: "session_summary_skipped",
      success: true,
      notes: `reason=disabled covered_message_count=${coveredMessageCount} every_messages=${config.everyMessages}`,
    });
    return {
      ok: true,
      status: "skipped",
      reason: "disabled",
      coveredMessageCount,
    };
  }

  const latest = getLatestSessionSummary(input.db, input.sessionId);
  if (latest?.covered_message_count === coveredMessageCount) {
    emitRollingTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      eventType: "session_summary_skipped",
      success: true,
      notes: `reason=duplicate_covered_message_count covered_message_count=${coveredMessageCount} summary_hash=${latest.summary_hash}`,
    });
    return {
      ok: true,
      status: "skipped",
      reason: "duplicate_covered_message_count",
      coveredMessageCount,
    };
  }

  const previousCovered = latest?.covered_message_count ?? 0;
  if (coveredMessageCount - previousCovered < config.everyMessages) {
    emitRollingTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      eventType: "session_summary_skipped",
      success: true,
      notes: `reason=below_threshold covered_message_count=${coveredMessageCount} previous_covered_message_count=${previousCovered} every_messages=${config.everyMessages}`,
    });
    return {
      ok: true,
      status: "skipped",
      reason: "below_threshold",
      coveredMessageCount,
    };
  }

  emitRollingTelemetry(input.db, {
    at,
    sessionId: input.sessionId,
    eventType: "session_summary_triggered",
    success: true,
    notes: `covered_message_count=${coveredMessageCount} previous_covered_message_count=${previousCovered} every_messages=${config.everyMessages}`,
  });

  try {
    const generate = input.generate ?? generateSessionSummary;
    const result = await generate({
      db: input.db,
      sessionId: input.sessionId,
      requestedProvider: input.requestedProvider,
      now: input.now,
    });
    if (!result.ok) {
      emitRollingTelemetry(input.db, {
        at,
        sessionId: input.sessionId,
        eventType: "session_summary_failed",
        success: false,
        errorClass: result.status,
        notes: `reason=${result.reason} covered_message_count=${coveredMessageCount}`,
      });
      return {
        ok: false,
        status: "failed",
        reason: result.reason,
        coveredMessageCount,
      };
    }

    return {
      ok: true,
      status: "triggered",
      coveredMessageCount,
      summaryHash: result.summary.summary_hash,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    emitRollingTelemetry(input.db, {
      at,
      sessionId: input.sessionId,
      eventType: "session_summary_failed",
      success: false,
      errorClass: error instanceof Error ? error.constructor.name : "Error",
      notes: `reason=${reason} covered_message_count=${coveredMessageCount}`,
    });
    return {
      ok: false,
      status: "failed",
      reason,
      coveredMessageCount,
    };
  }
}
