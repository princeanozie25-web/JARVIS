import { z } from "zod";
import { JobPostingSchema } from "./contract";
import { RankedJobPostingSchema } from "./ranking";

export const JOB_SCOUT_APPLICATION_TRACKER_VERSION =
  "phase21i.job-scout-application-tracker.v1" as const;

export const JOB_APPLICATION_STATUSES = [
  "discovered",
  "shortlisted",
  "researching",
  "preparing",
  "ready_to_apply",
  "applied",
  "interview",
  "offer",
  "rejected",
  "archived",
] as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const BoundedTextSchema = z.string().trim().min(1).max(500);
const BoundedIdSchema = z.string().trim().min(1).max(180);

export const JobApplicationStatusSchema = z.enum(JOB_APPLICATION_STATUSES);

export const JobApplicationSourceSchema = z.strictObject({
  source_kind: z.enum(["ranked_job", "manual", "digest"]),
  source_id: BoundedIdSchema,
  metadata_only: z.literal(true),
});

export const JobApplicationTimelineEventSchema = z.strictObject({
  event_id: BoundedIdSchema,
  occurred_at: IsoDateTimeSchema,
  status: JobApplicationStatusSchema,
  note: BoundedTextSchema,
  metadata_only: z.literal(true),
  external_action_attempted: z.literal(false),
});

export const JobApplicationTimelineSchema = z.strictObject({
  application_id: BoundedIdSchema,
  events: z.array(JobApplicationTimelineEventSchema),
  latest_status: JobApplicationStatusSchema,
  metadata_only: z.literal(true),
});

export const JobApplicationSchema = z.strictObject({
  application_id: BoundedIdSchema,
  tracker_version: z.literal(JOB_SCOUT_APPLICATION_TRACKER_VERSION),
  posting: JobPostingSchema,
  status: JobApplicationStatusSchema,
  source: JobApplicationSourceSchema,
  fit_score: z.number().min(0).max(100).nullable().default(null),
  missing_skills: z
    .array(z.string().trim().min(1).max(80).toLowerCase())
    .default([]),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  timeline: JobApplicationTimelineSchema,
  governance: z.strictObject({
    metadata_only: z.literal(true),
    deterministic: z.literal(true),
    persisted: z.literal(false),
    external_api_call_attempted: z.literal(false),
    email_send_attempted: z.literal(false),
    calendar_write_attempted: z.literal(false),
    submission_attempted: z.literal(false),
    approval_execution_attempted: z.literal(false),
  }),
});

export const JobApplicationSummarySchema = z.strictObject({
  tracker_version: z.literal(JOB_SCOUT_APPLICATION_TRACKER_VERSION),
  application_count: z.number().int().nonnegative(),
  status_counts: z.record(
    JobApplicationStatusSchema,
    z.number().int().nonnegative(),
  ),
  ready_for_human_review_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  persisted: z.literal(false),
  external_action_attempted: z.literal(false),
});

export type JobApplicationStatus = z.infer<typeof JobApplicationStatusSchema>;
export type JobApplicationSource = z.infer<typeof JobApplicationSourceSchema>;
export type JobApplicationTimelineEvent = z.infer<
  typeof JobApplicationTimelineEventSchema
>;
export type JobApplicationTimeline = z.infer<
  typeof JobApplicationTimelineSchema
>;
export type JobApplication = z.infer<typeof JobApplicationSchema>;
export type JobApplicationSummary = z.infer<typeof JobApplicationSummarySchema>;

export function createJobApplication(input: {
  readonly ranked_job: z.input<typeof RankedJobPostingSchema>;
  readonly created_at?: string;
  readonly status?: JobApplicationStatus;
}): JobApplication {
  const ranked = RankedJobPostingSchema.parse(input.ranked_job);
  const createdAt = input.created_at ?? "2026-06-03T08:00:00.000Z";
  const status = input.status ?? "discovered";
  const applicationId = `application:${ranked.posting.posting_id}`;
  const timeline = buildApplicationTimeline({
    application_id: applicationId,
    events: [
      {
        event_id: `${applicationId}:event:created`,
        occurred_at: createdAt,
        status,
        note: `Application tracker created from ranked job ${ranked.rank}.`,
        metadata_only: true,
        external_action_attempted: false,
      },
    ],
  });

  return JobApplicationSchema.parse({
    application_id: applicationId,
    tracker_version: JOB_SCOUT_APPLICATION_TRACKER_VERSION,
    posting: ranked.posting,
    status,
    source: {
      source_kind: "ranked_job",
      source_id: ranked.posting.posting_id,
      metadata_only: true,
    },
    fit_score: ranked.score.fit_score,
    missing_skills: ranked.score.missing_skills,
    created_at: createdAt,
    updated_at: createdAt,
    timeline,
    governance: {
      metadata_only: true,
      deterministic: true,
      persisted: false,
      external_api_call_attempted: false,
      email_send_attempted: false,
      calendar_write_attempted: false,
      submission_attempted: false,
      approval_execution_attempted: false,
    },
  });
}

export function updateJobApplicationStatus(
  application: JobApplication,
  status: JobApplicationStatus,
  options: {
    readonly updated_at?: string;
    readonly note?: string;
  } = {},
): JobApplication {
  const parsed = JobApplicationSchema.parse(application);
  const nextUpdatedAt = options.updated_at ?? parsed.updated_at;
  const event = JobApplicationTimelineEventSchema.parse({
    event_id: `${parsed.application_id}:event:${status}:${parsed.timeline.events.length + 1}`,
    occurred_at: nextUpdatedAt,
    status,
    note: options.note ?? `Status updated to ${status}.`,
    metadata_only: true,
    external_action_attempted: false,
  });
  const timeline = buildApplicationTimeline({
    application_id: parsed.application_id,
    events: [...parsed.timeline.events, event],
  });

  return JobApplicationSchema.parse({
    ...parsed,
    status,
    updated_at: nextUpdatedAt,
    timeline,
  });
}

export function buildApplicationTimeline(input: {
  readonly application_id: string;
  readonly events: readonly z.input<typeof JobApplicationTimelineEventSchema>[];
}): JobApplicationTimeline {
  const events = input.events
    .map((event) => JobApplicationTimelineEventSchema.parse(event))
    .sort((left, right) => {
      const time = left.occurred_at.localeCompare(right.occurred_at);
      if (time !== 0) return time;
      return left.event_id.localeCompare(right.event_id);
    });

  return JobApplicationTimelineSchema.parse({
    application_id: input.application_id,
    events,
    latest_status: events.at(-1)?.status ?? "discovered",
    metadata_only: true,
  });
}

export function summarizeJobApplications(
  applications: readonly JobApplication[],
): JobApplicationSummary {
  const parsed = applications.map((application) =>
    JobApplicationSchema.parse(application),
  );
  const statusCounts = Object.fromEntries(
    JOB_APPLICATION_STATUSES.map((status) => [
      status,
      parsed.filter((application) => application.status === status).length,
    ]),
  );

  return JobApplicationSummarySchema.parse({
    tracker_version: JOB_SCOUT_APPLICATION_TRACKER_VERSION,
    application_count: parsed.length,
    status_counts: statusCounts,
    ready_for_human_review_count: parsed.filter(
      (application) => application.status === "ready_to_apply",
    ).length,
    metadata_only: true,
    persisted: false,
    external_action_attempted: false,
  });
}
