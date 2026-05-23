import { describe, expect, it } from "vitest";

import {
  NextActionSuggestionSchema,
  SuggestionInboxItemSchema,
  SuggestionInboxTelemetryEventSchema,
  createSuggestionInboxItem,
  createSuggestionInboxTelemetryEvent,
  transitionSuggestionInboxItem,
  type NextActionSuggestion,
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

function inboxItem(overrides: Partial<SuggestionInboxItem> = {}) {
  return {
    ...createSuggestionInboxItem({
      suggestion: suggestion(),
      created_at_ms: 1_000,
    }),
    ...overrides,
  } satisfies SuggestionInboxItem;
}

describe("Phase 8H.1 suggestion inbox scaffold", () => {
  it("creates inbox items from metadata-only suggestions", () => {
    const item = createSuggestionInboxItem({
      suggestion: suggestion(),
      created_at_ms: 1_000,
    });

    expect(item).toMatchObject({
      suggestion_id: "suggestion:1234abcd",
      status: "new",
      source_event_hash: "hash:event-1",
      project_id_hash: "hash:project-1",
      routine_id: "daily_self_audit",
      created_at_ms: 1_000,
      updated_at_ms: 1_000,
      metadata_only: true,
      advisory_only: true,
      inbox_only: true,
      auto_action_performed: false,
      approval_triggered: false,
      tool_called: false,
      action_executed: false,
      persisted: false,
    });
  });

  it("allows only the explicit inbox status transitions", () => {
    expect(
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "new" }),
        to_status: "seen",
        transitioned_at_ms: 1_100,
      }).item.status,
    ).toBe("seen");
    expect(
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "new" }),
        to_status: "dismissed",
        transitioned_at_ms: 1_100,
      }).item.status,
    ).toBe("dismissed");
    expect(
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "seen" }),
        to_status: "dismissed",
        transitioned_at_ms: 1_100,
      }).item.status,
    ).toBe("dismissed");
    expect(
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "seen" }),
        to_status: "acted",
        transitioned_at_ms: 1_100,
      }).item.status,
    ).toBe("acted");
  });

  it("rejects invalid transitions", () => {
    expect(() =>
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "new" }),
        to_status: "acted",
        transitioned_at_ms: 1_100,
      }),
    ).toThrow("invalid suggestion inbox transition");
    expect(() =>
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "dismissed" }),
        to_status: "seen",
        transitioned_at_ms: 1_100,
      }),
    ).toThrow("invalid suggestion inbox transition");
    expect(() =>
      transitionSuggestionInboxItem({
        item: inboxItem({ status: "acted" }),
        to_status: "dismissed",
        transitioned_at_ms: 1_100,
      }),
    ).toThrow("invalid suggestion inbox transition");
  });

  it("treats acted as an external marker without execution or approval", () => {
    const seen = inboxItem({ status: "seen" });
    const result = transitionSuggestionInboxItem({
      item: seen,
      to_status: "acted",
      transitioned_at_ms: 1_200,
    });

    expect(result.transition).toMatchObject({
      from_status: "seen",
      to_status: "acted",
      external_user_action_only: true,
      auto_action_performed: false,
      approval_triggered: false,
      tool_called: false,
      action_executed: false,
      memory_written: false,
      project_mutated: false,
      environment_mutated: false,
      mutation_performed: false,
    });
    expect(result.item).toMatchObject({
      status: "acted",
      action_executed: false,
      approval_triggered: false,
      tool_called: false,
    });
  });

  it("rejects raw body, content, project text, and task text", () => {
    for (const field of [
      "raw_body",
      "raw_content",
      "project_name",
      "task_title",
      "suggestion_body",
    ]) {
      expect(
        SuggestionInboxItemSchema.safeParse({
          ...inboxItem(),
          [field]: "private payload",
        }).success,
      ).toBe(false);
    }
    expect(
      SuggestionInboxItemSchema.safeParse({
        ...inboxItem(),
        raw_body_included: true,
      }).success,
    ).toBe(false);
    expect(
      SuggestionInboxItemSchema.safeParse({
        ...inboxItem(),
        raw_project_text_included: true,
      }).success,
    ).toBe(false);
  });

  it("requires hash/ID-only references", () => {
    expect(
      SuggestionInboxItemSchema.safeParse({
        ...inboxItem(),
        suggestion_id: "task title",
      }).success,
    ).toBe(false);
    expect(
      SuggestionInboxItemSchema.safeParse({
        ...inboxItem(),
        source_event_hash: "event name",
      }).success,
    ).toBe(false);
    expect(
      SuggestionInboxItemSchema.safeParse({
        ...inboxItem(),
        project_id_hash: "project slug",
      }).success,
    ).toBe(false);
    expect(
      SuggestionInboxItemSchema.safeParse({
        ...inboxItem(),
        project_id_hash: null,
      }).success,
    ).toBe(true);
  });

  it("emits status, counts, and flags only in telemetry", () => {
    const result = transitionSuggestionInboxItem({
      item: inboxItem({ status: "seen" }),
      to_status: "acted",
      transitioned_at_ms: 1_200,
    });
    const telemetry = createSuggestionInboxTelemetryEvent(result.transition);

    expect(telemetry).toEqual({
      event_type: "suggestion_inbox_item_transitioned",
      transition_count: 1,
      from_status: "seen",
      to_status: "acted",
      acted_count: 1,
      dismissed_count: 0,
      metadata_only: true,
      counts_and_flags_only: true,
      auto_action_performed: false,
      approval_triggered: false,
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
      SuggestionInboxTelemetryEventSchema.safeParse({
        ...telemetry,
        suggestion_body: "private",
      }).success,
    ).toBe(false);
    expect(
      SuggestionInboxTelemetryEventSchema.safeParse({
        ...telemetry,
        action_executed: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, write, UI, tool, action, approval, network, or mutation paths", () => {
    const item = inboxItem();
    const result = transitionSuggestionInboxItem({
      item: inboxItem({ status: "seen" }),
      to_status: "dismissed",
      transitioned_at_ms: 1_300,
    });

    expect({
      persisted: item.persisted,
      dbRead: item.db_read_performed,
      dbWrite: item.db_write_performed,
      providerCalled: item.provider_called,
      llmCalled: item.llm_called,
      networkCalled: item.network_called,
      cloudCalled: item.cloud_called,
      toolCalled: result.transition.tool_called,
      actionExecuted: result.transition.action_executed,
      approvalTriggered: result.transition.approval_triggered,
      mutationPerformed: result.transition.mutation_performed,
    }).toEqual({
      persisted: false,
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalTriggered: false,
      mutationPerformed: false,
    });
  });
});
