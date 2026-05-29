import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_17_ROUTINE_REGISTRY } from "../../src/lib/routines/routine-registry";
import {
  DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
  SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES,
} from "../../src/lib/routines/read-scope";
import {
  DEFAULT_ROUTINE_READ_SCOPE_BINDINGS,
  RoutineReadScopeBindingDecisionSchema,
  evaluateRoutineReadScopeBinding,
} from "../../src/lib/routines/read-scope-binding";

const repoRoot = process.cwd();

describe("Phase 17B.3 foreground scheduler read scope binding scaffold", () => {
  it("binds every routine only to declared metadata scopes", () => {
    for (const routine of DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines) {
      const decision = evaluateRoutineReadScopeBinding(routine);
      const expectedScopes =
        DEFAULT_ROUTINE_READ_SCOPE_BINDINGS[routine.routine_kind];

      expect(decision).toMatchObject({
        routine_id: routine.routine_id,
        routine_kind: routine.routine_kind,
        binding_complete: true,
        denied_read_scopes: [],
        metadata_only: true,
        collector_execution_supported: false,
        db_read_supported: false,
        event_store_read_supported: false,
        report_generation_supported: false,
        suggestion_generation_supported: false,
      });
      expect(
        decision.allowed_read_scopes.map((scope) => scope.surface_kind),
      ).toEqual(expectedScopes);
      expect(
        decision.allowed_read_scopes.every(
          (scope) =>
            SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES.includes(
              scope.surface_kind,
            ) &&
            scope.read_only &&
            scope.metadata_only &&
            !scope.raw_payload_allowed &&
            !scope.pii_allowed &&
            !scope.secrets_allowed &&
            !scope.network_allowed &&
            !scope.write_allowed,
        ),
      ).toBe(true);
    }
  });

  it("denies undeclared scopes when a routine-required scope is missing", () => {
    const routine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0];
    const missingProjectLedger =
      DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES.filter(
        (scope) => scope.surface_kind !== "project_ledger_metadata",
      );

    expect(
      evaluateRoutineReadScopeBinding(routine, missingProjectLedger),
    ).toMatchObject({
      routine_id: routine.routine_id,
      binding_complete: false,
      denied_read_scopes: [
        expect.objectContaining({
          scope_id: "scope:project_ledger_metadata",
          surface_kind: "project_ledger_metadata",
          reason: "undeclared_scope",
          metadata_only: true,
        }),
      ],
      collector_execution_attempted: false,
      db_read_performed: false,
      event_store_read_performed: false,
    });
  });

  it("denies raw payload, PII, secret, network, and write scopes", () => {
    const routine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[1];
    const unsafeCases = [
      ["raw_payload_allowed", "raw_payload_forbidden"],
      ["pii_allowed", "pii_forbidden"],
      ["secrets_allowed", "secrets_forbidden"],
      ["network_allowed", "network_forbidden"],
      ["write_allowed", "write_forbidden"],
    ] as const;

    for (const [field, reason] of unsafeCases) {
      const unsafeRegistry = DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES.map(
        (scope) =>
          scope.surface_kind === "model_cost_metadata"
            ? { ...scope, [field]: true }
            : scope,
      );

      expect(
        evaluateRoutineReadScopeBinding(routine, unsafeRegistry),
      ).toMatchObject({
        binding_complete: false,
        denied_read_scopes: [
          expect.objectContaining({
            scope_id: "scope:model_cost_metadata",
            surface_kind: "model_cost_metadata",
            reason,
            metadata_only: true,
          }),
        ],
        network_called: false,
        cloud_called: false,
        tool_called: false,
        memory_written: false,
        project_mutated: false,
        device_action_executed: false,
        approval_executed: false,
      });
    }
  });

  it("denies unknown scope surfaces without reading from them", () => {
    const routine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[2];
    const registryWithUnknown = [
      ...DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
      {
        scope_id: "scope:unknown_surface",
        surface_kind: "unknown_surface",
        read_only: true,
        metadata_only: true,
        raw_payload_allowed: false,
        pii_allowed: false,
        secrets_allowed: false,
        network_allowed: false,
        write_allowed: false,
        row_cap: 100,
      },
    ];

    expect(
      evaluateRoutineReadScopeBinding(routine, registryWithUnknown),
    ).toMatchObject({
      binding_complete: false,
      denied_read_scopes: [
        expect.objectContaining({
          scope_id: "scope:unknown_surface",
          surface_kind: "unknown_surface",
          reason: "unknown_surface",
          metadata_only: true,
        }),
      ],
      collector_execution_attempted: false,
      db_read_performed: false,
      event_store_read_performed: false,
      report_generated: false,
      suggestion_generated: false,
      persisted: false,
    });
  });

  it("fails closed for invalid routines and invalid scope registries", () => {
    expect(evaluateRoutineReadScopeBinding({})).toMatchObject({
      routine_id: "routine:invalid",
      binding_complete: false,
      denied_read_scopes: [
        expect.objectContaining({ reason: "routine_unknown" }),
      ],
    });
    expect(
      evaluateRoutineReadScopeBinding(
        DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0],
        [{}],
      ),
    ).toMatchObject({
      binding_complete: false,
      denied_read_scopes: [
        expect.objectContaining({ reason: "undeclared_scope" }),
      ],
    });
  });

  it("schema rejects collector, DB, event-store, report, suggestion, persistence, or authority enablement", () => {
    const decision = evaluateRoutineReadScopeBinding(
      DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0],
    );

    expect(
      RoutineReadScopeBindingDecisionSchema.safeParse({
        ...decision,
        collector_execution_supported: true,
        db_read_supported: true,
        event_store_read_supported: true,
        report_generation_supported: true,
        suggestion_generation_supported: true,
        persisted: true,
        tool_called: true,
      }).success,
    ).toBe(false);
  });

  it("does not add collectors, DB/event-store reads, reports, suggestions, persistence, tools, mutations, approval, cloud, or network behavior", () => {
    const source = read("src/lib/routines/read-scope-binding.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
