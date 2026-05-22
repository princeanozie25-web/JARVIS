import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_RUNTIME_BOUNDARY_FEATURE_FLAGS,
  VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES,
  VisionRuntimeBoundaryDecisionRecordSchema,
  assertVisionRuntimeBoundary,
  createVisionRuntimeBoundaryReplayStep,
  createVisionRuntimeBoundaryTelemetryEvent,
  evaluateVisionRuntimeBoundary,
} from "./index";

describe("Phase 7G vision runtime boundary guard", () => {
  it("blocks action approval requests from vision", () => {
    const decision = evaluateVisionRuntimeBoundary({
      operation_class: "approve_action",
      external_approval_available: true,
    });

    expect(decision).toMatchObject({
      operation_class: "approve_action",
      decision: "blocked",
      reason: "approval_grant_blocked",
      requires_external_approval_path: false,
      authority_surface: false,
      advisory_only: true,
      action_executed: false,
      approval_granted: false,
    });
  });

  it("blocks runtime action execution requests from vision", () => {
    const decision = assertVisionRuntimeBoundary({
      operation_class: "execute_action",
    });

    expect(decision).toMatchObject({
      operation_class: "execute_action",
      decision: "blocked",
      reason: "runtime_action_blocked",
      action_executed: false,
      routine_triggered: false,
      authority_surface: false,
    });
  });

  it("blocks memory, project, and environment mutation requests", () => {
    for (const operation_class of [
      "mutate_memory",
      "mutate_project",
      "mutate_environment",
      "change_policy",
      "register_device",
    ] as const) {
      const decision = evaluateVisionRuntimeBoundary({ operation_class });

      expect(decision).toMatchObject({
        operation_class,
        decision: "blocked",
        reason: "mutation_blocked",
        memory_mutated: false,
        project_mutated: false,
        environment_mutated: false,
        policy_changed: false,
        device_registered: false,
      });
    }
  });

  it("allows context assembly and diagnostics as advisory metadata operations", () => {
    for (const operation_class of [
      "summarize_observation",
      "assemble_context",
      "create_replay_record",
      "evaluate_fallback_policy",
      "developer_diagnostic",
    ] as const) {
      const decision = evaluateVisionRuntimeBoundary({ operation_class });

      expect(decision).toMatchObject({
        operation_class,
        decision: "allowed",
        reason: "advisory_read_allowed",
        authority_surface: false,
        advisory_only: true,
        metadata_only: true,
        action_executed: false,
        approval_granted: false,
      });
    }
  });

  it("marks external approval requirement without granting approval", () => {
    const decision = evaluateVisionRuntimeBoundary({
      operation_class: "mutate_project",
      external_approval_available: true,
    });

    expect(decision).toMatchObject({
      operation_class: "mutate_project",
      decision: "requires_external_approval",
      reason: "external_approval_required",
      requires_external_approval_path: true,
      approval_granted: false,
      project_mutated: false,
      authority_surface: false,
    });
  });

  it("keeps telemetry and replay class/reason/decision-only metadata", () => {
    const decision = evaluateVisionRuntimeBoundary({
      operation_class: "cloud_export",
    });
    const event = createVisionRuntimeBoundaryTelemetryEvent(decision);
    const step = createVisionRuntimeBoundaryReplayStep(decision);

    expect(event).toEqual({
      event_type: "vision_boundary_evaluated",
      operation_class: "cloud_export",
      decision: "blocked",
      reason: "cloud_export_blocked",
      metadata_only: true,
      class_reason_decision_only: true,
      authority_surface: false,
      action_executed: false,
      approval_granted: false,
      mutation_performed: false,
      cloud_exported: false,
      background_job_started: false,
    });
    expect(step).toEqual({
      operation_class: "cloud_export",
      decision: "blocked",
      reason: "cloud_export_blocked",
      requires_external_approval_path: false,
      metadata_only: true,
      raw_payload_included: false,
      authority_surface: false,
      advisory_only: true,
      action_executed: false,
      approval_granted: false,
      mutation_performed: false,
      cloud_exported: false,
      background_job_started: false,
    });
    expect(JSON.stringify(event)).not.toContain("raw_frame");
    expect(JSON.stringify(step)).not.toContain("private");
  });

  it("cannot represent side effects in boundary decision records", () => {
    const decision = evaluateVisionRuntimeBoundary({
      operation_class: "start_background_job",
    });

    expect(
      VisionRuntimeBoundaryDecisionRecordSchema.safeParse({
        ...decision,
        action_executed: true,
        approval_granted: true,
        memory_mutated: true,
        cloud_exported: true,
        background_job_started: true,
      }).success,
    ).toBe(false);
    expect(decision).toMatchObject({
      decision: "blocked",
      reason: "background_job_blocked",
      action_executed: false,
      approval_granted: false,
      background_job_started: false,
    });
  });

  it("keeps runtime, approvals, mutations, cloud, capture, providers, and jobs disabled", () => {
    expect(
      Object.keys(DEFAULT_VISION_RUNTIME_BOUNDARY_FEATURE_FLAGS).sort(),
    ).toEqual([...VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES].sort());
    for (const feature of VISION_RUNTIME_BOUNDARY_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_RUNTIME_BOUNDARY_FEATURE_FLAGS[feature]).toBe(
        false,
      );
    }
  });
});
