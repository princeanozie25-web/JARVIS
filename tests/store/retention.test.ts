import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  EVENT_STORE_RETENTION_POLICY,
  EVENT_STORE_RETENTION_TABLES,
  getRetentionRule,
  previewRetention,
  previewRetentionTable,
} from "../../src/store/retention";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = 1_000 * DAY_MS;

describe("Phase 11A.4 store retention policy scaffold", () => {
  it("forever-retained tables return no deletion cutoff", () => {
    expect(previewRetentionTable("events", NOW_MS)).toMatchObject({
      table: "events",
      retained_forever: true,
      retention_days: null,
      deletion_cutoff_ms: null,
      retention_action: "none",
      mutation_executed: false,
    });
    expect(previewRetentionTable("room_events", NOW_MS)).toMatchObject({
      retained_forever: true,
      deletion_cutoff_ms: null,
    });
    expect(previewRetentionTable("approval_lifecycle", NOW_MS)).toMatchObject({
      retained_forever: true,
      deletion_cutoff_ms: null,
    });
    expect(previewRetentionTable("schema_migrations", NOW_MS)).toMatchObject({
      retained_forever: true,
      deletion_cutoff_ms: null,
    });
  });

  it("30-day tables produce deterministic cutoffs", () => {
    const cutoff = NOW_MS - 30 * DAY_MS;

    expect(previewRetentionTable("telemetry_events", NOW_MS)).toMatchObject({
      retained_forever: false,
      retention_days: 30,
      deletion_cutoff_ms: cutoff,
    });
    expect(previewRetentionTable("model_calls", NOW_MS)).toMatchObject({
      retained_forever: false,
      retention_days: 30,
      deletion_cutoff_ms: cutoff,
    });
  });

  it("90-day tables produce deterministic cutoffs", () => {
    const cutoff = NOW_MS - 90 * DAY_MS;

    expect(previewRetentionTable("replay_traces", NOW_MS)).toMatchObject({
      retained_forever: false,
      retention_days: 90,
      deletion_cutoff_ms: cutoff,
    });
    expect(previewRetentionTable("runtime_executions", NOW_MS)).toMatchObject({
      retained_forever: false,
      retention_days: 90,
      deletion_cutoff_ms: cutoff,
    });
    expect(previewRetentionTable("routine_suggestions", NOW_MS)).toMatchObject({
      retained_forever: false,
      retention_days: 90,
      deletion_cutoff_ms: cutoff,
    });
  });

  it("raw payload retention is forbidden for every policy table", () => {
    expect(
      EVENT_STORE_RETENTION_TABLES.every(
        (table) =>
          EVENT_STORE_RETENTION_POLICY[table].raw_payload_retention_allowed ===
          false,
      ),
    ).toBe(true);
  });

  it("unknown table or policy fails closed", () => {
    expect(() => getRetentionRule("unknown_table")).toThrow(
      "Unknown event-store retention table",
    );
    expect(() =>
      previewRetention({ nowMs: NOW_MS, tables: ["unknown"] }),
    ).toThrow("Unknown event-store retention table");
    expect(() => previewRetention({ nowMs: -1 })).toThrow(
      "nonnegative integer clock",
    );
  });

  it("preview output is metadata-only and non-executing", () => {
    expect(previewRetention({ nowMs: NOW_MS })).toEqual({
      generated_at_ms: NOW_MS,
      items: expect.arrayContaining([
        expect.objectContaining({
          table: "telemetry_events",
          metadata_only: true,
          retention_action: "none",
          raw_payload_retention_allowed: false,
          mutation_executed: false,
        }),
      ]),
      metadata_only: true,
      raw_payload_included: false,
      retention_execution_enabled: false,
      delete_executed: false,
      update_executed: false,
      vacuum_executed: false,
    });
  });

  it("preview outputs are defensive copies", () => {
    const first = previewRetention({ nowMs: NOW_MS });
    (first.items[0] as { table: string }).table = "mutated";

    expect(previewRetention({ nowMs: NOW_MS }).items[0].table).toBe("events");
  });

  it("exposes no delete/update/vacuum helpers", async () => {
    const moduleExports = Object.keys(
      await import("../../src/store/retention"),
    );

    expect(
      moduleExports.some((name) =>
        /delete|update|vacuum|truncate|execute|run|schedule|job|raw|db/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });

  it("retention scaffold contains no raw SQL mutation, scheduler, UI, or network path", () => {
    const source = readFileSync("src/store/retention.ts", "utf8");

    expect(source).not.toMatch(
      /\bDELETE\b|\bUPDATE\b|\bVACUUM\b|Database|better-sqlite3|setInterval|setTimeout|fetch\(|WebSocket|node:net|node:http|node:https|cloud|remote|render|component/i,
    );
  });
});
