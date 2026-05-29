import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_17_DISABLED_GUARDS } from "../../src/lib/routines/phase-17-disabled-guards";
import {
  DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
  SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES,
  evaluateScheduledAssistanceReadScope,
} from "../../src/lib/routines/read-scope";

const repoRoot = process.cwd();

describe("Phase 17A.5 scheduled assistance read scope contract", () => {
  it("declares every expected metadata read scope", () => {
    expect(
      DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES.map(
        (scope) => scope.surface_kind,
      ),
    ).toEqual([
      "approvals_metadata",
      "tool_call_metadata",
      "model_cost_metadata",
      "vision_replay_metadata",
      "environment_room_event_metadata",
      "project_ledger_metadata",
      "router_decision_metadata",
      "safety_classifier_metadata",
    ]);
    expect(DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES).toHaveLength(
      SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES.length,
    );
  });

  it("allows only declared read-only metadata-only scopes", () => {
    for (const scope of DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES) {
      expect(evaluateScheduledAssistanceReadScope(scope)).toMatchObject({
        scope_id: `scope:${scope.surface_kind}`,
        surface_kind: scope.surface_kind,
        allowed: true,
        reason: "scope_allowed",
        read_only: true,
        metadata_only: true,
        raw_payload_allowed: false,
        pii_allowed: false,
        secrets_allowed: false,
        network_allowed: false,
        write_allowed: false,
        row_cap: 250,
      });
    }
  });

  it("denies unknown surfaces and unsafe read scope authority", () => {
    const base = DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES[0];

    expect(
      evaluateScheduledAssistanceReadScope({
        ...base,
        scope_id: "scope:unknown_surface",
        surface_kind: "raw_database_rows",
      }),
    ).toMatchObject({ allowed: false, reason: "unknown_surface" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...base,
        raw_payload_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "raw_payload_forbidden" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...base,
        read_only: false,
        write_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "write_forbidden" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...base,
        network_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "network_forbidden" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...base,
        pii_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "pii_forbidden" });
    expect(
      evaluateScheduledAssistanceReadScope({
        ...base,
        secrets_allowed: true,
      }),
    ).toMatchObject({ allowed: false, reason: "secrets_forbidden" });
  });

  it("never implements collectors, DB reads, reports, suggestions, persistence, tools, mutations, approvals, or cloud", () => {
    const decision = evaluateScheduledAssistanceReadScope(
      DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES[0],
    );

    expect(decision).toMatchObject({
      collector_implemented: false,
      db_read_performed: false,
      event_store_read_performed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
      tool_called: false,
      memory_written: false,
      project_mutated: false,
      device_action_executed: false,
      approval_executed: false,
      cloud_called: false,
    });
  });

  it("keeps the Phase 17 disabled guard matrix pinned", () => {
    expect(DEFAULT_PHASE_17_DISABLED_GUARDS).toMatchObject({
      scheduler_execution_enabled: false,
      tool_calls_enabled: false,
      device_actions_enabled: false,
      project_mutations_enabled: false,
      memory_writes_enabled: false,
      approval_execution_enabled: false,
      cloud_network_calls_enabled: false,
      raw_report_telemetry_enabled: false,
      raw_suggestion_telemetry_enabled: false,
      metadata_only: true,
      non_executing: true,
    });
  });

  it("does not add collectors, DB reads, report generation, suggestion generation, persistence, or network markers", () => {
    const source = read("src/lib/routines/read-scope.ts");

    expect(source).not.toMatch(
      /SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
