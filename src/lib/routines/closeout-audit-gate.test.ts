import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
  ROUTINE_CLOSEOUT_AUDIT_CATEGORIES,
  RoutineCloseoutAuditGateTelemetryEventSchema,
  createRoutineCloseoutAuditGateTelemetryEvent,
  evaluateRoutineCloseoutAuditGate,
  type RoutineCloseoutAuditGate,
} from "./index";

function gate(overrides: Partial<RoutineCloseoutAuditGate> = {}) {
  return {
    ...DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
    ...overrides,
  } as unknown as RoutineCloseoutAuditGate;
}

describe("Phase 8J.2 routine closeout audit gate", () => {
  it("passes the default safe Phase 8 scaffold", () => {
    const result = evaluateRoutineCloseoutAuditGate(
      DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
    );

    expect(result).toMatchObject({
      passed: true,
      violations: [],
      warnings: [],
      module_coverage_count: ROUTINE_CLOSEOUT_AUDIT_CATEGORIES.length,
      missing_module_count: 0,
      metadata_only: true,
      scheduler_execution_enabled: false,
      background_execution_enabled: false,
      tool_called: false,
      action_executed: false,
      approval_executed: false,
      mutation_performed: false,
    });
    expect(result.authority_surface).toMatchObject({
      phase: "8",
      autonomy_boundary: "suggestion_only",
      side_effects_allowed: false,
      scheduler_execution_enabled: false,
      background_execution_enabled: false,
      routine_tool_calls_enabled: false,
      routine_action_execution_enabled: false,
    });
  });

  it("fails when module coverage is missing", () => {
    const result = evaluateRoutineCloseoutAuditGate({
      ...DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
      module_coverage: {
        ...DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE.module_coverage,
        report_metadata_only: false,
      },
    });

    expect(result).toMatchObject({
      passed: false,
      violations: ["missing_module_coverage"],
      missing_module_count: 1,
    });
  });

  it("fails when scheduler, background, tool, action, approval, mutation, or cloud flags are enabled", () => {
    for (const field of [
      "scheduler_execution_enabled",
      "routine_execution_enabled",
      "background_execution_enabled",
      "tool_called",
      "action_executed",
      "approval_executed",
      "memory_written",
      "project_mutated",
      "environment_mutated",
      "mutation_performed",
      "cloud_called",
      "network_called",
    ] as const) {
      const result = evaluateRoutineCloseoutAuditGate({
        ...DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
        [field]: true,
      });

      expect(result.violations).toContain("side_effect_flag_enabled");
      expect(result.violations).toContain("unsafe_authority_surface");
      expect(result.passed).toBe(false);
    }
  });

  it("fails when the privacy manifest failed", () => {
    const result = evaluateRoutineCloseoutAuditGate(
      gate({
        disabled_feature_status: {
          ...DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE.disabled_feature_status,
          privacy_manifest_passed: false,
        },
      } as Partial<RoutineCloseoutAuditGate>),
    );

    expect(result).toMatchObject({
      passed: false,
      violations: ["privacy_manifest_failed"],
    });
  });

  it("fails when the disabled-feature guard failed", () => {
    const result = evaluateRoutineCloseoutAuditGate(
      gate({
        disabled_feature_status: {
          ...DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE.disabled_feature_status,
          disabled_feature_guard_passed: false,
          enabled_disabled_feature_count: 2,
        },
      } as Partial<RoutineCloseoutAuditGate>),
    );

    expect(result).toMatchObject({
      passed: false,
      violations: ["disabled_feature_guard_failed"],
    });
    expect(result.disabled_feature_status.enabled_disabled_feature_count).toBe(
      2,
    );
  });

  it("keeps authority summary suggestion-only with no side effects", () => {
    const result = evaluateRoutineCloseoutAuditGate(
      DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
    );

    expect(result.authority_surface).toEqual({
      phase: "8",
      autonomy_boundary: "suggestion_only",
      side_effects_allowed: false,
      scheduler_execution_enabled: false,
      background_execution_enabled: false,
      routine_tool_calls_enabled: false,
      routine_action_execution_enabled: false,
      approval_execution_enabled: false,
      memory_writes_enabled: false,
      project_mutations_enabled: false,
      environment_mutations_enabled: false,
      cloud_network_enabled: false,
      ui_runtime_wiring_enabled: false,
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const result = evaluateRoutineCloseoutAuditGate(
      DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
    );
    const telemetry = createRoutineCloseoutAuditGateTelemetryEvent(result);

    expect(telemetry).toEqual({
      event_type: "routine_closeout_audit_gate_evaluated",
      passed: true,
      violation_count: 0,
      warning_count: 0,
      module_coverage_count: ROUTINE_CLOSEOUT_AUDIT_CATEGORIES.length,
      missing_module_count: 0,
      enabled_disabled_feature_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      scheduler_execution_enabled: false,
      routine_execution_enabled: false,
      background_execution_enabled: false,
      telemetry_persisted: false,
      db_read_performed: false,
      db_write_performed: false,
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      action_executed: false,
      approval_executed: false,
      mutation_performed: false,
      ui_wired: false,
      runtime_wired: false,
    });
    expect(
      RoutineCloseoutAuditGateTelemetryEventSchema.safeParse({
        ...telemetry,
        raw_report_body: "private",
      }).success,
    ).toBe(false);
    expect(
      RoutineCloseoutAuditGateTelemetryEventSchema.safeParse({
        ...telemetry,
        action_executed: true,
      }).success,
    ).toBe(false);
  });

  it("adds no execution, wiring, persistence, network, or mutation paths", () => {
    const result = evaluateRoutineCloseoutAuditGate(
      DEFAULT_ROUTINE_CLOSEOUT_AUDIT_GATE,
    );

    expect({
      scheduler: result.scheduler_execution_enabled,
      routineExecution: result.routine_execution_enabled,
      timers: result.timers_started,
      background: result.background_execution_enabled,
      telemetryPersisted: result.telemetry_persisted,
      dbRead: result.db_read_performed,
      dbWrite: result.db_write_performed,
      providerCalled: result.provider_called,
      llmCalled: result.llm_called,
      networkCalled: result.network_called,
      cloudCalled: result.cloud_called,
      toolCalled: result.tool_called,
      actionExecuted: result.action_executed,
      approvalExecuted: result.approval_executed,
      memoryWritten: result.memory_written,
      projectMutated: result.project_mutated,
      environmentMutated: result.environment_mutated,
      mutationPerformed: result.mutation_performed,
      uiWired: result.ui_wired,
      apiRouteAdded: result.api_route_added,
      runtimeWired: result.runtime_wired,
      voiceWired: result.voice_wired,
    }).toEqual({
      scheduler: false,
      routineExecution: false,
      timers: false,
      background: false,
      telemetryPersisted: false,
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalExecuted: false,
      memoryWritten: false,
      projectMutated: false,
      environmentMutated: false,
      mutationPerformed: false,
      uiWired: false,
      apiRouteAdded: false,
      runtimeWired: false,
      voiceWired: false,
    });
  });
});
