import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendMessage } from "../db/messages";
import { applyMigrations } from "../db/schema";
import {
  getLatestSessionSummary,
  saveSessionSummary,
} from "../db/session-summaries";
import { createSession } from "../db/sessions";
import { listTelemetryEvents } from "../db/telemetry";
import type { GenerateSessionSummaryResult } from "./generator";
import { triggerRollingSessionSummary } from "./rolling";

let db: Database.Database;

function addMessages(count: number): void {
  for (let index = 0; index < count; index += 1) {
    appendMessage(db, {
      id: `m${index}`,
      session_id: "session-1",
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message ${index}`,
      created_at: 1_000 + index,
    });
  }
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  createSession(db, "session-1", 1_000);
});

afterEach(() => {
  db.close();
});

describe("triggerRollingSessionSummary", () => {
  it("triggers summary generation at the configured message threshold", async () => {
    addMessages(10);

    const result = await triggerRollingSessionSummary({
      db,
      sessionId: "session-1",
      config: { enabled: true, everyMessages: 10 },
      now: () => 2_000,
      generate: async (input): Promise<GenerateSessionSummaryResult> => {
        const summary = saveSessionSummary(input.db, {
          sessionId: input.sessionId,
          summaryText: "Ten persisted messages were summarized.",
          coveredMessageCount: 10,
          now: () => 2_000,
        });
        return {
          ok: true,
          status: "generated",
          summary,
          modelId: "gpt-4o-mini",
          coveredMessageCount: 10,
        };
      },
    });

    expect(result).toMatchObject({
      ok: true,
      status: "triggered",
      coveredMessageCount: 10,
    });
    expect(getLatestSessionSummary(db, "session-1")).toMatchObject({
      summary_text: "Ten persisted messages were summarized.",
      covered_message_count: 10,
    });
    expect(
      listTelemetryEvents(db).some(
        (event) => event.event_type === "session_summary_triggered",
      ),
    ).toBe(true);
  });

  it("skips sessions below the threshold", async () => {
    addMessages(9);

    const result = await triggerRollingSessionSummary({
      db,
      sessionId: "session-1",
      config: { enabled: true, everyMessages: 10 },
      now: () => 2_000,
      generate: async () => {
        throw new Error("should not run");
      },
    });

    expect(result).toEqual({
      ok: true,
      status: "skipped",
      reason: "below_threshold",
      coveredMessageCount: 9,
    });
    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "session_summary_skipped",
    );
    expect(event?.notes).toContain("reason=below_threshold");
  });

  it("skips duplicate covered_message_count", async () => {
    addMessages(10);
    saveSessionSummary(db, {
      sessionId: "session-1",
      summaryText: "Already summarized.",
      coveredMessageCount: 10,
      now: () => 1_500,
    });

    const result = await triggerRollingSessionSummary({
      db,
      sessionId: "session-1",
      config: { enabled: true, everyMessages: 10 },
      now: () => 2_000,
      generate: async () => {
        throw new Error("should not run");
      },
    });

    expect(result).toEqual({
      ok: true,
      status: "skipped",
      reason: "duplicate_covered_message_count",
      coveredMessageCount: 10,
    });
    expect(
      listTelemetryEvents(db).find(
        (event) => event.event_type === "session_summary_skipped",
      )?.notes,
    ).toContain("reason=duplicate_covered_message_count");
  });

  it("skips when session summary config is disabled", async () => {
    addMessages(10);

    const result = await triggerRollingSessionSummary({
      db,
      sessionId: "session-1",
      config: { enabled: false, everyMessages: 10 },
      now: () => 2_000,
      generate: async () => {
        throw new Error("should not run");
      },
    });

    expect(result).toEqual({
      ok: true,
      status: "skipped",
      reason: "disabled",
      coveredMessageCount: 10,
    });
    expect(
      listTelemetryEvents(db).find(
        (event) => event.event_type === "session_summary_skipped",
      )?.notes,
    ).toContain("reason=disabled");
  });

  it("returns failure without throwing when generation fails", async () => {
    addMessages(10);

    await expect(
      triggerRollingSessionSummary({
        db,
        sessionId: "session-1",
        config: { enabled: true, everyMessages: 10 },
        now: () => 2_000,
        generate: async () => {
          throw new Error("provider down");
        },
      }),
    ).resolves.toEqual({
      ok: false,
      status: "failed",
      reason: "provider down",
      coveredMessageCount: 10,
    });

    expect(getLatestSessionSummary(db, "session-1")).toBeUndefined();
    const eventTypes = listTelemetryEvents(db).map((event) => event.event_type);
    expect(eventTypes).toContain("session_summary_triggered");
    expect(eventTypes).toContain("session_summary_failed");
  });

  it("emits failure telemetry when the generator returns a failed result", async () => {
    addMessages(10);

    const result = await triggerRollingSessionSummary({
      db,
      sessionId: "session-1",
      config: { enabled: true, everyMessages: 10 },
      now: () => 2_000,
      generate: async () => ({
        ok: false,
        status: "provider_error",
        reason: "provider rejected",
      }),
    });

    expect(result).toEqual({
      ok: false,
      status: "failed",
      reason: "provider rejected",
      coveredMessageCount: 10,
    });
    expect(
      listTelemetryEvents(db).find(
        (event) => event.event_type === "session_summary_failed",
      )?.notes,
    ).toContain("reason=provider rejected");
  });
});
