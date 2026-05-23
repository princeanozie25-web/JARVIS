import { z } from "zod";

export const PROJECT_PROGRESS_EVENT_CLASSES = [
  "project_added",
  "project_changed",
  "project_archived",
  "indexing_succeeded",
  "indexing_failed",
  "blocker_added",
  "blocker_cleared",
  "task_promoted",
  "task_completed",
] as const;

export const PROJECT_PROGRESS_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export const PROJECT_PROGRESS_TELEMETRY_EVENT_TYPES = [
  "project_progress_summarized",
] as const;

export type ProjectProgressEventClass =
  (typeof PROJECT_PROGRESS_EVENT_CLASSES)[number];
export type ProjectProgressRedactionStatus =
  (typeof PROJECT_PROGRESS_REDACTION_STATUSES)[number];
export type ProjectProgressTelemetryEventType =
  (typeof PROJECT_PROGRESS_TELEMETRY_EVENT_TYPES)[number];

const AliasOrHashSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^(alias|hash):[a-z0-9._:-]+$/);

export const ProjectProgressEventClassSchema = z.enum(
  PROJECT_PROGRESS_EVENT_CLASSES,
);
export const ProjectProgressRedactionStatusSchema = z.enum(
  PROJECT_PROGRESS_REDACTION_STATUSES,
);
export const ProjectProgressTelemetryEventTypeSchema = z.enum(
  PROJECT_PROGRESS_TELEMETRY_EVENT_TYPES,
);

export const ProjectProgressWindowSchema = z
  .strictObject({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
  })
  .refine((window) => window.end_ms >= window.start_ms, {
    message:
      "project progress window end must be greater than or equal to start",
  });

export const ProjectProgressInputEventSchema = z.strictObject({
  event_id_hash: AliasOrHashSchema,
  project_id_hash: AliasOrHashSchema,
  event_class: ProjectProgressEventClassSchema,
  observed_at_ms: z.number().int().nonnegative(),
  redaction_status: ProjectProgressRedactionStatusSchema,
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  raw_project_name_included: z.literal(false),
  raw_project_slug_included: z.literal(false),
  raw_path_included: z.literal(false),
  raw_task_title_included: z.literal(false),
  raw_blocker_text_included: z.literal(false),
  raw_decision_text_included: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
});

export const ProjectProgressSummarySchema = z.strictObject({
  window: ProjectProgressWindowSchema,
  project_count: z.number().int().nonnegative(),
  event_count: z.number().int().nonnegative(),
  added_count: z.number().int().nonnegative(),
  changed_count: z.number().int().nonnegative(),
  archived_count: z.number().int().nonnegative(),
  indexing_success_count: z.number().int().nonnegative(),
  indexing_failure_count: z.number().int().nonnegative(),
  blocker_added_count: z.number().int().nonnegative(),
  blocker_cleared_count: z.number().int().nonnegative(),
  task_promoted_count: z.number().int().nonnegative(),
  task_completed_count: z.number().int().nonnegative(),
  redaction_status: ProjectProgressRedactionStatusSchema,
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_project_name_included: z.literal(false),
  raw_project_slug_included: z.literal(false),
  raw_path_included: z.literal(false),
  raw_task_title_included: z.literal(false),
  raw_blocker_text_included: z.literal(false),
  raw_decision_text_included: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
});

export const ProjectProgressTelemetryEventSchema = z.strictObject({
  event_type: ProjectProgressTelemetryEventTypeSchema,
  project_count: z.number().int().nonnegative(),
  event_count: z.number().int().nonnegative(),
  changed_count: z.number().int().nonnegative(),
  blocker_count: z.number().int().nonnegative(),
  task_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
});

export type ProjectProgressWindow = z.infer<typeof ProjectProgressWindowSchema>;
export type ProjectProgressInputEvent = z.infer<
  typeof ProjectProgressInputEventSchema
>;
export type ProjectProgressSummary = z.infer<
  typeof ProjectProgressSummarySchema
>;
export type ProjectProgressTelemetryEvent = z.infer<
  typeof ProjectProgressTelemetryEventSchema
>;

function countEvents(
  events: ProjectProgressInputEvent[],
  eventClass: ProjectProgressEventClass,
): number {
  return events.filter((event) => event.event_class === eventClass).length;
}

export function summarizeProjectProgress(input: {
  window: ProjectProgressWindow;
  events: ProjectProgressInputEvent[];
}): ProjectProgressSummary {
  const window = ProjectProgressWindowSchema.parse(input.window);
  const events = input.events.map((event) =>
    ProjectProgressInputEventSchema.parse(event),
  );
  const projects = new Set(events.map((event) => event.project_id_hash));

  return ProjectProgressSummarySchema.parse({
    window,
    project_count: projects.size,
    event_count: events.length,
    added_count: countEvents(events, "project_added"),
    changed_count: countEvents(events, "project_changed"),
    archived_count: countEvents(events, "project_archived"),
    indexing_success_count: countEvents(events, "indexing_succeeded"),
    indexing_failure_count: countEvents(events, "indexing_failed"),
    blocker_added_count: countEvents(events, "blocker_added"),
    blocker_cleared_count: countEvents(events, "blocker_cleared"),
    task_promoted_count: countEvents(events, "task_promoted"),
    task_completed_count: countEvents(events, "task_completed"),
    redaction_status: events.some(
      (event) => event.redaction_status === "redacted",
    )
      ? "redacted"
      : "metadata_only",
    truncated: events.some((event) => event.truncated),
    metadata_only: true,
    counts_and_flags_only: true,
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
  });
}

export function createProjectProgressTelemetryEvent(
  summaryInput: ProjectProgressSummary,
): ProjectProgressTelemetryEvent {
  const summary = ProjectProgressSummarySchema.parse(summaryInput);
  return ProjectProgressTelemetryEventSchema.parse({
    event_type: "project_progress_summarized",
    project_count: summary.project_count,
    event_count: summary.event_count,
    changed_count:
      summary.added_count + summary.changed_count + summary.archived_count,
    blocker_count: summary.blocker_added_count + summary.blocker_cleared_count,
    task_count: summary.task_promoted_count + summary.task_completed_count,
    truncated: summary.truncated,
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
}
