import { describe, expect, it } from "vitest";

import {
  NextActionSuggestionInputSchema,
  NextActionSuggestionTelemetryEventSchema,
  createNextActionSuggestionsTelemetryEvent,
  generateNextActionSuggestions,
  rankNextActionPriority,
  type NextActionSuggestionClass,
  type NextActionSuggestionInput,
} from "./index";

function event(
  suggestionClass: NextActionSuggestionClass,
  overrides: Partial<NextActionSuggestionInput> = {},
): NextActionSuggestionInput {
  return {
    source_event_hash: `hash:${suggestionClass}`,
    project_id_hash: "hash:project-a",
    routine_id: "routine:next_action_suggest",
    suggestion_class: suggestionClass,
    signal_count: 1,
    observed_at_ms: 1000,
    redaction_status: "metadata_only",
    truncated: false,
    metadata_only: true,
    raw_content_included: false,
    raw_body_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    action_executed: false,
    approval_triggered: false,
    tool_called: false,
    memory_written: false,
    mutation_performed: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    ...overrides,
  };
}

describe("Phase 8F.1 next-action suggestion engine scaffold", () => {
  it("generates suggestions from metadata-only inputs", () => {
    const result = generateNextActionSuggestions({
      events: [
        event("review_failure"),
        event("check_cost", { project_id_hash: null }),
      ],
    });

    expect(result).toMatchObject({
      input_count: 2,
      output_count: 2,
      output_cap: 5,
      deterministic: true,
      rule_based: true,
      metadata_only: true,
      advisory_only: true,
      inbox_only: true,
      action_executed: false,
      approval_triggered: false,
      tool_called: false,
      memory_written: false,
      mutation_performed: false,
    });
    expect(
      result.suggestions.map((suggestion) => suggestion.suggestion_class),
    ).toEqual(["review_failure", "check_cost"]);
  });

  it("caps output to five suggestions by default", () => {
    const result = generateNextActionSuggestions({
      events: [
        event("continue_project", { source_event_hash: "hash:a" }),
        event("continue_project", { source_event_hash: "hash:b" }),
        event("continue_project", { source_event_hash: "hash:c" }),
        event("continue_project", { source_event_hash: "hash:d" }),
        event("continue_project", { source_event_hash: "hash:e" }),
        event("continue_project", { source_event_hash: "hash:f" }),
      ],
    });

    expect(result.output_count).toBe(5);
    expect(result.suggestions).toHaveLength(5);
    expect(result.omitted_count).toBe(1);
    expect(result.truncated).toBe(true);
  });

  it("ranks suggestions deterministically", () => {
    const result = generateNextActionSuggestions({
      events: [
        event("continue_project", { source_event_hash: "hash:z" }),
        event("check_cost", { source_event_hash: "hash:c" }),
        event("review_denied_action", { source_event_hash: "hash:b" }),
        event("review_failure", { source_event_hash: "hash:a" }),
        event("inspect_project_blocker", { source_event_hash: "hash:d" }),
      ],
    });

    expect(
      result.suggestions.map((suggestion) => suggestion.suggestion_class),
    ).toEqual([
      "review_failure",
      "inspect_project_blocker",
      "review_denied_action",
      "check_cost",
      "continue_project",
    ]);
    expect(rankNextActionPriority("review_failure")).toBe("high");
    expect(rankNextActionPriority("check_cost")).toBe("medium");
    expect(rankNextActionPriority("continue_project")).toBe("low");
  });

  it("keeps suggestions advisory and inbox-only", () => {
    const result = generateNextActionSuggestions({
      events: [event("inspect_project_blocker")],
    });

    expect(result.suggestions[0]).toMatchObject({
      status: "proposed",
      advisory_only: true,
      inbox_only: true,
      action_executed: false,
      approval_triggered: false,
      tool_called: false,
      memory_written: false,
      mutation_performed: false,
      persisted: false,
    });
  });

  it("rejects true approval, tool, action, mutation, and memory flags", () => {
    for (const field of [
      "approval_triggered",
      "tool_called",
      "action_executed",
      "mutation_performed",
      "memory_written",
    ]) {
      expect(
        NextActionSuggestionInputSchema.safeParse({
          ...event("review_failure"),
          [field]: true,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects raw content, body, project text, and task text", () => {
    for (const field of ["raw_content", "body", "project_name", "task_title"]) {
      expect(
        NextActionSuggestionInputSchema.safeParse({
          ...event("continue_project"),
          [field]: "private text",
        }).success,
      ).toBe(false);
    }
    expect(
      NextActionSuggestionInputSchema.safeParse({
        ...event("continue_project"),
        raw_task_text_included: true,
      }).success,
    ).toBe(false);
  });

  it("requires source references to use hashes or IDs only", () => {
    expect(
      NextActionSuggestionInputSchema.safeParse({
        ...event("continue_project"),
        source_event_hash: "plain-event",
      }).success,
    ).toBe(false);
    expect(
      NextActionSuggestionInputSchema.safeParse({
        ...event("continue_project"),
        project_id_hash: "Real Project",
      }).success,
    ).toBe(false);
    expect(
      NextActionSuggestionInputSchema.safeParse({
        ...event("continue_project"),
        source_event_hash: "alias:event",
        project_id_hash: "hash:project",
      }).success,
    ).toBe(true);
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const result = generateNextActionSuggestions({
      events: [
        event("review_failure"),
        event("check_cost"),
        event("continue_project"),
      ],
    });
    const telemetry = createNextActionSuggestionsTelemetryEvent(result);

    expect(telemetry).toEqual({
      event_type: "next_action_suggestions_generated",
      input_count: 3,
      output_count: 3,
      omitted_count: 0,
      high_count: 1,
      medium_count: 1,
      low_count: 1,
      truncated: false,
      metadata_only: true,
      counts_and_flags_only: true,
      action_executed: false,
      approval_triggered: false,
      tool_called: false,
      memory_written: false,
      mutation_performed: false,
      db_read_performed: false,
      db_write_performed: false,
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
    });
    expect(
      NextActionSuggestionTelemetryEventSchema.safeParse({
        ...telemetry,
        action_executed: true,
        llm_called: true,
        memory_written: true,
      }).success,
    ).toBe(false);
  });

  it("adds no DB, LLM, network, tool, action, write, or execution paths", () => {
    const result = generateNextActionSuggestions({
      events: [event("review_failure")],
    });

    expect({
      dbRead: result.db_read_performed,
      dbWrite: result.db_write_performed,
      providerCalled: result.provider_called,
      llmCalled: result.llm_called,
      networkCalled: result.network_called,
      cloudCalled: result.cloud_called,
      toolCalled: result.tool_called,
      actionExecuted: result.action_executed,
      approvalTriggered: result.approval_triggered,
      memoryWritten: result.memory_written,
      mutationPerformed: result.mutation_performed,
    }).toEqual({
      dbRead: false,
      dbWrite: false,
      providerCalled: false,
      llmCalled: false,
      networkCalled: false,
      cloudCalled: false,
      toolCalled: false,
      actionExecuted: false,
      approvalTriggered: false,
      memoryWritten: false,
      mutationPerformed: false,
    });
  });
});
