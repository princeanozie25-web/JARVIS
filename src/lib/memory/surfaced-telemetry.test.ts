import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import { emitMemorySurfacedTelemetry } from "./surfaced-telemetry";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("emitMemorySurfacedTelemetry", () => {
  it("emits memory_surfaced telemetry when memories are shown", () => {
    expect(
      emitMemorySurfacedTelemetry(db, {
        memoryIds: ["mem-1", "mem-2", "mem-1"],
        retrievalMode: "hybrid",
        sessionId: "session-1",
        executionId: "exec-recall",
        now: () => 7_000,
      }),
    ).toBe(2);

    const event = listTelemetryEvents(db).find(
      (item) => item.event_type === "memory_surfaced",
    );
    expect(event).toMatchObject({
      timestamp: 7_000,
      success: 1,
      session_id: "session-1",
      execution_id: "exec-recall",
      tool_name: "memory.recall",
    });
    expect(event?.notes).toContain("mode=hybrid");
    expect(event?.notes).toContain('result_ids=["mem-1","mem-2"]');
  });

  it("does not emit telemetry for an empty surfaced set", () => {
    expect(
      emitMemorySurfacedTelemetry(db, {
        memoryIds: [],
        retrievalMode: "keyword_only",
      }),
    ).toBe(0);

    expect(
      listTelemetryEvents(db).some(
        (item) => item.event_type === "memory_surfaced",
      ),
    ).toBe(false);
  });
});
