import { describe, expect, it } from "vitest";

import {
  ProjectProgressInputEventSchema,
  ProjectProgressTelemetryEventSchema,
  createProjectProgressTelemetryEvent,
  summarizeProjectProgress,
  type ProjectProgressInputEvent,
  type ProjectProgressWindow,
} from "./index";

function window(): ProjectProgressWindow {
  return {
    start_ms: 1000,
    end_ms: 2000,
    metadata_only: true,
  };
}

function event(
  overrides: Partial<ProjectProgressInputEvent> = {},
): ProjectProgressInputEvent {
  return {
    event_id_hash: "hash:event-1",
    project_id_hash: "hash:project-a",
    event_class: "project_changed",
    observed_at_ms: 1500,
    redaction_status: "metadata_only",
    truncated: false,
    metadata_only: true,
    raw_project_name_included: false,
    raw_project_slug_included: false,
    raw_path_included: false,
    raw_task_title_included: false,
    raw_blocker_text_included: false,
    raw_decision_text_included: false,
    db_read_performed: false,
    db_write_performed: false,
    project_mutated: false,
    memory_written: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    action_executed: false,
    approval_triggered: false,
    ...overrides,
  };
}

describe("Phase 8E.1 project progress summarizer scaffold", () => {
  it("summarizes metadata-only project events correctly", () => {
    const summary = summarizeProjectProgress({
      window: window(),
      events: [
        event({ event_class: "project_added" }),
        event({
          event_id_hash: "hash:event-2",
          event_class: "project_changed",
        }),
        event({
          event_id_hash: "hash:event-3",
          event_class: "project_archived",
        }),
        event({
          event_id_hash: "hash:event-4",
          event_class: "indexing_succeeded",
        }),
        event({
          event_id_hash: "hash:event-5",
          event_class: "indexing_failed",
        }),
        event({ event_id_hash: "hash:event-6", event_class: "blocker_added" }),
        event({
          event_id_hash: "hash:event-7",
          event_class: "blocker_cleared",
        }),
        event({ event_id_hash: "hash:event-8", event_class: "task_promoted" }),
        event({ event_id_hash: "hash:event-9", event_class: "task_completed" }),
      ],
    });

    expect(summary).toMatchObject({
      project_count: 1,
      event_count: 9,
      added_count: 1,
      changed_count: 1,
      archived_count: 1,
      indexing_success_count: 1,
      indexing_failure_count: 1,
      blocker_added_count: 1,
      blocker_cleared_count: 1,
      task_promoted_count: 1,
      task_completed_count: 1,
      metadata_only: true,
      counts_and_flags_only: true,
      db_read_performed: false,
      project_mutated: false,
      memory_written: false,
    });
  });

  it("requires project_id values to be aliases or hashes only", () => {
    expect(
      ProjectProgressInputEventSchema.safeParse({
        ...event(),
        project_id_hash: "my-project-slug",
      }).success,
    ).toBe(false);
    expect(
      ProjectProgressInputEventSchema.safeParse({
        ...event(),
        project_id_hash: "C:/Users/project",
      }).success,
    ).toBe(false);
    expect(
      ProjectProgressInputEventSchema.safeParse({
        ...event(),
        project_id_hash: "alias:project-a",
      }).success,
    ).toBe(true);
  });

  it("rejects raw names, slugs, paths, task titles, blocker text, and decision text", () => {
    for (const [field, value] of [
      ["project_name", "Real Project"],
      ["project_slug", "real-project"],
      ["file_path", "C:/secret/file.ts"],
      ["task_title", "Ship private thing"],
      ["blocker_text", "Waiting on private person"],
      ["decision_text", "Use private vendor"],
    ]) {
      expect(
        ProjectProgressInputEventSchema.safeParse({
          ...event(),
          [field]: value,
        }).success,
      ).toBe(false);
    }
    expect(
      ProjectProgressInputEventSchema.safeParse({
        ...event(),
        raw_task_title_included: true,
      }).success,
    ).toBe(false);
  });

  it("returns a safe zero summary for empty input", () => {
    const summary = summarizeProjectProgress({
      window: window(),
      events: [],
    });

    expect(summary).toMatchObject({
      project_count: 0,
      event_count: 0,
      added_count: 0,
      changed_count: 0,
      archived_count: 0,
      indexing_success_count: 0,
      indexing_failure_count: 0,
      blocker_added_count: 0,
      blocker_cleared_count: 0,
      task_promoted_count: 0,
      task_completed_count: 0,
      redaction_status: "metadata_only",
      truncated: false,
      db_read_performed: false,
      llm_called: false,
    });
  });

  it("propagates truncation and redaction status", () => {
    const summary = summarizeProjectProgress({
      window: window(),
      events: [
        event({
          truncated: true,
          redaction_status: "redacted",
        }),
      ],
    });

    expect(summary).toMatchObject({
      truncated: true,
      redaction_status: "redacted",
    });
  });

  it("does not call LLM, provider, or network paths", () => {
    const summary = summarizeProjectProgress({
      window: window(),
      events: [event()],
    });

    expect(summary).toMatchObject({
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
    });
  });

  it("does not perform project or memory writes or mutations", () => {
    const summary = summarizeProjectProgress({
      window: window(),
      events: [event()],
    });

    expect(summary).toMatchObject({
      db_write_performed: false,
      project_mutated: false,
      memory_written: false,
      tool_called: false,
      action_executed: false,
      approval_triggered: false,
    });
  });

  it("emits metadata-only telemetry with counts and flags only", () => {
    const summary = summarizeProjectProgress({
      window: window(),
      events: [
        event({ event_class: "blocker_added" }),
        event({ event_id_hash: "hash:event-2", event_class: "task_completed" }),
      ],
    });
    const telemetry = createProjectProgressTelemetryEvent(summary);

    expect(telemetry).toEqual({
      event_type: "project_progress_summarized",
      project_count: 1,
      event_count: 2,
      changed_count: 0,
      blocker_count: 1,
      task_count: 1,
      truncated: false,
      metadata_only: true,
      counts_and_flags_only: true,
      db_read_performed: false,
      db_write_performed: false,
      project_mutated: false,
      memory_written: false,
      provider_called: false,
      llm_called: false,
      network_called: false,
      cloud_called: false,
      tool_called: false,
      action_executed: false,
      approval_triggered: false,
    });
    expect(
      ProjectProgressTelemetryEventSchema.safeParse({
        ...telemetry,
        project_mutated: true,
        memory_written: true,
        llm_called: true,
      }).success,
    ).toBe(false);
  });
});
