import { describe, expect, it } from "vitest";

import {
  NextActionSuggestionSchema,
  SuggestionApprovalBridgeRequestSchema,
  SuggestionApprovalBridgeTelemetryEventSchema,
  createSuggestionApprovalBridgeRequest,
  createSuggestionApprovalBridgeTelemetryEvent,
  createSuggestionInboxItem,
  evaluateSuggestionApprovalBridge,
  type NextActionSuggestion,
  type SuggestionApprovalBridgeOrigin,
  type SuggestionInboxItem,
} from "./index";

function suggestion(
  overrides: Partial<NextActionSuggestion> = {},
): NextActionSuggestion {
  return NextActionSuggestionSchema.parse({
    suggestion_id_hash: "suggestion:1234abcd",
    suggestion_class: "review_failure",
    priority: "high",
    status: "proposed",
    source_event_hash: "hash:event-1",
    project_id_hash: "hash:project-1",
    routine_id: "daily_self_audit",
    rank: 1,
    advisory_only: true,
    inbox_only: true,
    metadata_only: true,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    action_executed: false,
    approval_triggered: false,
    tool_called: false,
    memory_written: false,
    mutation_performed: false,
    persisted: false,
    ...overrides,
  });
}

function item(
  overrides: Partial<SuggestionInboxItem> = {},
): SuggestionInboxItem {
  return {
    ...createSuggestionInboxItem({
      suggestion: suggestion(),
      created_at_ms: 1_000,
    }),
    status: "acted",
    updated_at_ms: 1_100,
    ...overrides,
  };
}

function request(
  overrides: {
    item?: SuggestionInboxItem;
    request_origin?: SuggestionApprovalBridgeOrigin;
    user_selected?: boolean;
  } = {},
) {
  return createSuggestionApprovalBridgeRequest({
    item: overrides.item ?? item(),
    request_origin: overrides.request_origin ?? "user_click",
    user_selected: overrides.user_selected ?? false,
    requested_at_ms: 1_200,
  });
}

describe("Phase 8H.2 suggestion approval bridge boundary scaffold", () => {
  it("allows user_click to become eligible for the existing approval flow", () => {
    const decision = evaluateSuggestionApprovalBridge(
      request({ request_origin: "user_click" }),
    );

    expect(decision).toMatchObject({
      decision_state: "eligible_for_existing_approval_flow",
      reason: "eligible_user_action",
      request_origin: "user_click",
      bridge_only: true,
      existing_approval_flow_only: true,
      approval_granted: false,
      approval_created: false,
      tool_called: false,
      action_executed: false,
    });
    expect(decision.metadata_for_existing_approval_flow).toEqual({
      suggestion_id: "suggestion:1234abcd",
      source_event_hash: "hash:event-1",
      project_id_hash: "hash:project-1",
      routine_id: "daily_self_audit",
    });
  });

  it("allows user_typed_command to become eligible for the existing approval flow", () => {
    const decision = evaluateSuggestionApprovalBridge(
      request({ request_origin: "user_typed_command" }),
    );

    expect(decision).toMatchObject({
      decision_state: "eligible_for_existing_approval_flow",
      reason: "eligible_user_action",
      request_origin: "user_typed_command",
      user_action_required: false,
    });
  });

  it("blocks routine, scheduler, voice, system_auto, and background origins", () => {
    for (const origin of [
      "routine",
      "scheduler",
      "voice",
      "system_auto",
      "background",
    ] satisfies SuggestionApprovalBridgeOrigin[]) {
      const decision = evaluateSuggestionApprovalBridge(
        request({ request_origin: origin }),
      );

      expect(decision).toMatchObject({
        decision_state: "blocked",
        reason: "blocked_origin",
        request_origin: origin,
        metadata_for_existing_approval_flow: null,
        approval_granted: false,
        approval_created: false,
      });
    }
  });

  it("requires acted status or explicit user selection", () => {
    const blocked = evaluateSuggestionApprovalBridge(
      request({
        item: item({ status: "seen" }),
        request_origin: "user_click",
        user_selected: false,
      }),
    );
    const eligible = evaluateSuggestionApprovalBridge(
      request({
        item: item({ status: "seen" }),
        request_origin: "user_click",
        user_selected: true,
      }),
    );

    expect(blocked).toMatchObject({
      decision_state: "blocked",
      reason: "user_action_required",
      metadata_for_existing_approval_flow: null,
    });
    expect(eligible.decision_state).toBe("eligible_for_existing_approval_flow");
  });

  it("never grants or creates approval", () => {
    const decision = evaluateSuggestionApprovalBridge(request());

    expect(decision).toMatchObject({
      approval_granted: false,
      approval_created: false,
      existing_approval_flow_only: true,
    });
    expect(
      SuggestionApprovalBridgeRequestSchema.safeParse({
        ...request(),
        approval_granted: true,
      }).success,
    ).toBe(false);
    expect(
      SuggestionApprovalBridgeRequestSchema.safeParse({
        ...request(),
        approval_created: true,
      }).success,
    ).toBe(false);
  });

  it("never calls tools or actions", () => {
    const decision = evaluateSuggestionApprovalBridge(request());

    expect(decision).toMatchObject({
      tool_called: false,
      action_executed: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      mutation_performed: false,
    });
    expect(
      SuggestionApprovalBridgeRequestSchema.safeParse({
        ...request(),
        tool_called: true,
      }).success,
    ).toBe(false);
    expect(
      SuggestionApprovalBridgeRequestSchema.safeParse({
        ...request(),
        action_executed: true,
      }).success,
    ).toBe(false);
  });

  it("rejects raw suggestion, project, and task content", () => {
    for (const field of [
      "suggestion_body",
      "raw_body",
      "raw_content",
      "project_name",
      "task_title",
    ]) {
      expect(
        SuggestionApprovalBridgeRequestSchema.safeParse({
          ...request(),
          [field]: "private payload",
        }).success,
      ).toBe(false);
    }
    expect(
      SuggestionApprovalBridgeRequestSchema.safeParse({
        ...request(),
        raw_project_text_included: true,
      }).success,
    ).toBe(false);
    expect(
      evaluateSuggestionApprovalBridge({ suggestion_body: "private" }),
    ).toMatchObject({
      decision_state: "invalid",
      reason: "invalid_request",
      approval_granted: false,
      approval_created: false,
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const decision = evaluateSuggestionApprovalBridge(request());
    const telemetry = createSuggestionApprovalBridgeTelemetryEvent(decision);

    expect(telemetry).toEqual({
      event_type: "suggestion_approval_bridge_evaluated",
      eligible_count: 1,
      blocked_count: 0,
      invalid_count: 0,
      request_origin: "user_click",
      decision_state: "eligible_for_existing_approval_flow",
      metadata_only: true,
      counts_and_flags_only: true,
      approval_granted: false,
      approval_created: false,
      tool_called: false,
      action_executed: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      mutation_performed: false,
      persisted: false,
      db_read_performed: false,
      db_write_performed: false,
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
    });
    expect(
      SuggestionApprovalBridgeTelemetryEventSchema.safeParse({
        ...telemetry,
        suggestion_body: "private",
      }).success,
    ).toBe(false);
    expect(
      SuggestionApprovalBridgeTelemetryEventSchema.safeParse({
        ...telemetry,
        approval_created: true,
      }).success,
    ).toBe(false);
  });

  it("adds no approval, tool, action, write, network, UI, or runtime paths", () => {
    const decision = evaluateSuggestionApprovalBridge(request());

    expect({
      approvalGranted: decision.approval_granted,
      approvalCreated: decision.approval_created,
      toolCalled: decision.tool_called,
      actionExecuted: decision.action_executed,
      persisted: decision.persisted,
      dbRead: decision.db_read_performed,
      dbWrite: decision.db_write_performed,
      providerCalled: decision.provider_called,
      llmCalled: decision.llm_called,
      networkCalled: decision.network_called,
      cloudCalled: decision.cloud_called,
      mutationPerformed: decision.mutation_performed,
    }).toEqual({
      approvalGranted: false,
      approvalCreated: false,
      toolCalled: false,
      actionExecuted: false,
      persisted: false,
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      mutationPerformed: false,
    });
  });
});
