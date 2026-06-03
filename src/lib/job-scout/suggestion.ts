import { z } from "zod";
import {
  JobScoutDigestGovernanceSchema,
  JobScoutDigestOpportunitySchema,
  JobScoutDigestSchema,
  JobScoutMissingSkillSummarySchema,
  type JobScoutDigest,
} from "./digest";

export const JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION =
  "phase21i.job-scout-suggestion-payload.v1" as const;

export const JOB_SCOUT_SUGGESTION_WRITE_PLAN_VERSION =
  "phase21i.job-scout-suggestion-write-plan.v1" as const;

export const JOB_SCOUT_SUGGESTION_OUTPUT_KIND = "suggestion.digest" as const;

export const JOB_SCOUT_SUGGESTION_PLAN_STATUSES = [
  "dry_run",
  "injected_writer_planned",
  "rejected",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(500);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const JobScoutSuggestionPayloadGovernanceSchema = z.strictObject({
  suggestion_only: z.literal(true),
  digest_only: z.literal(true),
  metadata_only: z.literal(true),
  application_submission_supported: z.literal(false),
  auto_apply_supported: z.literal(false),
  auto_send_supported: z.literal(false),
  execution_supported: z.literal(false),
  approval_finalization_supported: z.literal(false),
  mutation_supported: z.literal(false),
});

export const JobScoutSuggestionPayloadSchema = z.strictObject({
  kind: z.literal(JOB_SCOUT_SUGGESTION_OUTPUT_KIND),
  payload_version: z.literal(JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION),
  suggestion_id: z.string().trim().min(1).max(220),
  source_kind: z.literal("job_scout.digest"),
  digest_id: z.string().trim().min(1).max(180),
  generated_at: IsoDateTimeSchema,
  title: BoundedTextSchema,
  candidate_count: z.number().int().nonnegative(),
  top_ranked_jobs: z.array(JobScoutDigestOpportunitySchema),
  missing_skill_summary: z.array(JobScoutMissingSkillSummarySchema),
  recommended_next_actions: z.array(BoundedTextSchema),
  digest_governance: JobScoutDigestGovernanceSchema,
  governance: JobScoutSuggestionPayloadGovernanceSchema,
  suggestion_inbox_ready: z.literal(true),
  application_submission_attempted: z.literal(false),
  auto_apply_attempted: z.literal(false),
  auto_send_attempted: z.literal(false),
  write_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const JobScoutSuggestionWriterResultSchema = z.strictObject({
  writer_id: z.string().trim().min(1).max(160),
  accepted: z.boolean(),
  wrote_to_real_inbox: z.literal(false),
  result_metadata_only: z.literal(true),
});

export const JobScoutSuggestionWritePlanSchema = z.strictObject({
  plan_version: z.literal(JOB_SCOUT_SUGGESTION_WRITE_PLAN_VERSION),
  status: z.enum(JOB_SCOUT_SUGGESTION_PLAN_STATUSES),
  payload: JobScoutSuggestionPayloadSchema,
  reasons: z.array(BoundedTextSchema),
  warnings: z.array(BoundedTextSchema),
  writer_result: JobScoutSuggestionWriterResultSchema.nullable(),
  dry_run: z.boolean(),
  writer_injected: z.boolean(),
  real_inbox_write_attempted: z.literal(false),
  write_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  application_submission_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type JobScoutSuggestionPayloadGovernance = z.infer<
  typeof JobScoutSuggestionPayloadGovernanceSchema
>;
export type JobScoutSuggestionPayload = z.infer<
  typeof JobScoutSuggestionPayloadSchema
>;
export type JobScoutSuggestionWriterResult = z.infer<
  typeof JobScoutSuggestionWriterResultSchema
>;
export type JobScoutSuggestionWritePlan = z.infer<
  typeof JobScoutSuggestionWritePlanSchema
>;
export type JobScoutSuggestionPlanStatus =
  (typeof JOB_SCOUT_SUGGESTION_PLAN_STATUSES)[number];

export interface JobScoutSuggestionWriter {
  readonly writer_id: string;
  readonly preview_only: true;
  writePreviewPayload(
    payload: JobScoutSuggestionPayload,
  ): JobScoutSuggestionWriterResult | Promise<JobScoutSuggestionWriterResult>;
}

export function buildJobScoutSuggestionPayload(
  digest: JobScoutDigest,
): JobScoutSuggestionPayload {
  const parsed = JobScoutDigestSchema.parse(digest);

  return JobScoutSuggestionPayloadSchema.parse({
    kind: JOB_SCOUT_SUGGESTION_OUTPUT_KIND,
    payload_version: JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION,
    suggestion_id: `suggestion:job-scout:${parsed.digest_id}`,
    source_kind: "job_scout.digest",
    digest_id: parsed.digest_id,
    generated_at: parsed.generated_at,
    title: "Job Scout digest",
    candidate_count: parsed.candidate_count,
    top_ranked_jobs: parsed.top_opportunities,
    missing_skill_summary: parsed.missing_skill_summary,
    recommended_next_actions: parsed.recommended_next_actions,
    digest_governance: parsed.governance,
    governance: {
      suggestion_only: true,
      digest_only: true,
      metadata_only: true,
      application_submission_supported: false,
      auto_apply_supported: false,
      auto_send_supported: false,
      execution_supported: false,
      approval_finalization_supported: false,
      mutation_supported: false,
    },
    suggestion_inbox_ready: true,
    application_submission_attempted: false,
    auto_apply_attempted: false,
    auto_send_attempted: false,
    write_attempted: false,
    execution_attempted: false,
    approval_finalization_attempted: false,
    metadata_only: true,
  });
}

export async function planJobScoutSuggestionInboxWrite(
  payload: JobScoutSuggestionPayload,
  writer?: JobScoutSuggestionWriter | null,
): Promise<JobScoutSuggestionWritePlan> {
  const parsedPayload = JobScoutSuggestionPayloadSchema.parse(payload);

  if (!writer) {
    return JobScoutSuggestionWritePlanSchema.parse({
      plan_version: JOB_SCOUT_SUGGESTION_WRITE_PLAN_VERSION,
      status: "dry_run",
      payload: parsedPayload,
      reasons: ["dry_run_default_no_writer_supplied"],
      warnings: ["real_suggestion_inbox_write_not_attempted"],
      writer_result: null,
      dry_run: true,
      writer_injected: false,
      real_inbox_write_attempted: false,
      write_attempted: false,
      execution_attempted: false,
      application_submission_attempted: false,
      approval_finalization_attempted: false,
      metadata_only: true,
    });
  }

  if (writer.preview_only !== true) {
    return JobScoutSuggestionWritePlanSchema.parse({
      plan_version: JOB_SCOUT_SUGGESTION_WRITE_PLAN_VERSION,
      status: "rejected",
      payload: parsedPayload,
      reasons: ["writer_must_be_preview_only"],
      warnings: ["writer_rejected_before_invocation"],
      writer_result: null,
      dry_run: true,
      writer_injected: true,
      real_inbox_write_attempted: false,
      write_attempted: false,
      execution_attempted: false,
      application_submission_attempted: false,
      approval_finalization_attempted: false,
      metadata_only: true,
    });
  }

  const writerResult = JobScoutSuggestionWriterResultSchema.parse(
    await writer.writePreviewPayload(parsedPayload),
  );

  return JobScoutSuggestionWritePlanSchema.parse({
    plan_version: JOB_SCOUT_SUGGESTION_WRITE_PLAN_VERSION,
    status: "injected_writer_planned",
    payload: parsedPayload,
    reasons: ["preview_only_injected_writer_invoked"],
    warnings: ["real_suggestion_inbox_write_not_attempted"],
    writer_result: writerResult,
    dry_run: true,
    writer_injected: true,
    real_inbox_write_attempted: false,
    write_attempted: false,
    execution_attempted: false,
    application_submission_attempted: false,
    approval_finalization_attempted: false,
    metadata_only: true,
  });
}
