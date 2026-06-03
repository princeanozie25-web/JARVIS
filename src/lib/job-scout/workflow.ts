import { z } from "zod";
import {
  JobApplicationSchema,
  type JobApplication,
} from "./application-tracker";
import {
  CoverLetterDraftPlanSchema,
  type CoverLetterDraft,
} from "./cover-letter";
import { JobScoutDigestSchema, type JobScoutDigest } from "./digest";
import { JobRankingResultSchema, type JobRankingResult } from "./ranking";

export const JOB_SCOUT_WORKFLOW_VERSION =
  "phase21i.job-scout-workflow-planner.v1" as const;

export const JOB_SCOUT_WORKFLOW_STATUSES = [
  "planned",
  "blocked",
  "ready_for_human_approval",
] as const;

export const JOB_SCOUT_WORKFLOW_STEP_KINDS = [
  "discovery",
  "ranking",
  "shortlist",
  "draft_preparation",
  "review",
  "ready_for_submission",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(600);
const BoundedIdSchema = z.string().trim().min(1).max(180);

export const JobScoutWorkflowStatusSchema = z.enum(JOB_SCOUT_WORKFLOW_STATUSES);
export const JobScoutWorkflowStepKindSchema = z.enum(
  JOB_SCOUT_WORKFLOW_STEP_KINDS,
);

export const JobScoutWorkflowStepSchema = z.strictObject({
  step_id: BoundedIdSchema,
  step_kind: JobScoutWorkflowStepKindSchema,
  status: z.enum(["complete", "planned", "blocked"]),
  summary: BoundedTextSchema,
  requires_human_approval: z.boolean(),
  execution_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const JobScoutWorkflowPlanSchema = z.strictObject({
  workflow_id: BoundedIdSchema,
  workflow_version: z.literal(JOB_SCOUT_WORKFLOW_VERSION),
  status: JobScoutWorkflowStatusSchema,
  ranking: JobRankingResultSchema,
  digest: JobScoutDigestSchema,
  applications: z.array(JobApplicationSchema),
  cover_letter_drafts: z.array(CoverLetterDraftPlanSchema),
  steps: z.array(JobScoutWorkflowStepSchema),
  blockers: z.array(BoundedTextSchema),
  summary: z.strictObject({
    ranked_job_count: z.number().int().nonnegative(),
    tracked_application_count: z.number().int().nonnegative(),
    draft_plan_count: z.number().int().nonnegative(),
    ready_for_human_approval_count: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
  }),
  governance: z.strictObject({
    suggestion_only: z.literal(true),
    approval_gated: z.literal(true),
    human_approval_boundary_reached: z.boolean(),
    workflow_execution_attempted: z.literal(false),
    application_submission_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    filesystem_write_attempted: z.literal(false),
    database_write_attempted: z.literal(false),
    scheduler_execution_attempted: z.literal(false),
    approval_execution_attempted: z.literal(false),
    auto_apply_attempted: z.literal(false),
    auto_send_attempted: z.literal(false),
    new_authority_surface_added: z.literal(false),
  }),
});

export type JobScoutWorkflowStatus = z.infer<
  typeof JobScoutWorkflowStatusSchema
>;
export type JobScoutWorkflowStepKind = z.infer<
  typeof JobScoutWorkflowStepKindSchema
>;
export type JobScoutWorkflowStep = z.infer<typeof JobScoutWorkflowStepSchema>;
export type JobScoutWorkflowPlan = z.infer<typeof JobScoutWorkflowPlanSchema>;
export type JobScoutWorkflow = JobScoutWorkflowPlan;

export function buildJobScoutWorkflow(input: {
  readonly workflow_id?: string;
  readonly ranking: JobRankingResult;
  readonly digest: JobScoutDigest;
  readonly applications: readonly JobApplication[];
  readonly cover_letter_drafts: readonly CoverLetterDraft[];
}): JobScoutWorkflowPlan {
  const ranking = JobRankingResultSchema.parse(input.ranking);
  const digest = JobScoutDigestSchema.parse(input.digest);
  const applications = input.applications.map((application) =>
    JobApplicationSchema.parse(application),
  );
  const coverLetterDrafts = input.cover_letter_drafts.map((draft) =>
    CoverLetterDraftPlanSchema.parse(draft),
  );
  const blockers = identifyWorkflowBlockers({
    ranking,
    digest,
    applications,
    cover_letter_drafts: coverLetterDrafts,
  });
  const readyApplications = applications.filter(
    (application) => application.status === "ready_to_apply",
  );
  const status =
    blockers.length > 0
      ? "blocked"
      : readyApplications.length > 0
        ? "ready_for_human_approval"
        : "planned";

  return JobScoutWorkflowPlanSchema.parse({
    workflow_id: input.workflow_id ?? "job-scout:workflow:plan",
    workflow_version: JOB_SCOUT_WORKFLOW_VERSION,
    status,
    ranking,
    digest,
    applications,
    cover_letter_drafts: coverLetterDrafts,
    steps: workflowSteps({
      rankedCount: ranking.ranked_jobs.length,
      applicationCount: applications.length,
      draftCount: coverLetterDrafts.length,
      readyCount: readyApplications.length,
      blocked: blockers.length > 0,
    }),
    blockers,
    summary: {
      ranked_job_count: ranking.ranked_jobs.length,
      tracked_application_count: applications.length,
      draft_plan_count: coverLetterDrafts.length,
      ready_for_human_approval_count: readyApplications.length,
      metadata_only: true,
    },
    governance: {
      suggestion_only: true,
      approval_gated: true,
      human_approval_boundary_reached: status === "ready_for_human_approval",
      workflow_execution_attempted: false,
      application_submission_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      scheduler_execution_attempted: false,
      approval_execution_attempted: false,
      auto_apply_attempted: false,
      auto_send_attempted: false,
      new_authority_surface_added: false,
    },
  });
}

export function identifyWorkflowBlockers(input: {
  readonly ranking: JobRankingResult;
  readonly digest: JobScoutDigest;
  readonly applications: readonly JobApplication[];
  readonly cover_letter_drafts: readonly CoverLetterDraft[];
}): string[] {
  const blockers = [
    ...(input.ranking.ranked_jobs.length === 0 ? ["no_ranked_jobs"] : []),
    ...(input.digest.top_opportunities.length === 0
      ? ["no_digest_opportunities"]
      : []),
    ...(input.applications.length === 0 ? ["no_tracked_applications"] : []),
    ...(input.cover_letter_drafts.length === 0
      ? ["no_cover_letter_draft_plans"]
      : []),
    ...(input.cover_letter_drafts.some(
      (draft) => draft.status !== "draft_plan_ready",
    )
      ? ["cover_letter_draft_plan_blocked"]
      : []),
  ];

  return blockers.sort();
}

export function summarizeWorkflow(
  workflow: JobScoutWorkflowPlan,
): JobScoutWorkflowPlan["summary"] {
  return JobScoutWorkflowPlanSchema.parse(workflow).summary;
}

function workflowSteps(input: {
  readonly rankedCount: number;
  readonly applicationCount: number;
  readonly draftCount: number;
  readonly readyCount: number;
  readonly blocked: boolean;
}): JobScoutWorkflowStep[] {
  return [
    step(
      "discovery",
      input.rankedCount > 0 ? "complete" : "blocked",
      `${input.rankedCount} ranked jobs available from supplied feeds.`,
      false,
    ),
    step(
      "ranking",
      input.rankedCount > 0 ? "complete" : "blocked",
      "Fit scoring and missing-skill analysis completed deterministically.",
      false,
    ),
    step(
      "shortlist",
      input.applicationCount > 0 ? "complete" : "blocked",
      `${input.applicationCount} applications tracked for manual review.`,
      false,
    ),
    step(
      "draft_preparation",
      input.draftCount > 0 && !input.blocked ? "complete" : "blocked",
      `${input.draftCount} cover letter draft plans prepared without generation.`,
      false,
    ),
    step(
      "review",
      input.readyCount > 0 && !input.blocked ? "planned" : "blocked",
      "Human review required before any future application action.",
      true,
    ),
    step(
      "ready_for_submission",
      input.readyCount > 0 && !input.blocked ? "planned" : "blocked",
      "Ready for human approval boundary; no submission is executed.",
      true,
    ),
  ];
}

function step(
  kind: JobScoutWorkflowStepKind,
  status: "complete" | "planned" | "blocked",
  summary: string,
  requiresHumanApproval: boolean,
): JobScoutWorkflowStep {
  return JobScoutWorkflowStepSchema.parse({
    step_id: `job-scout:workflow-step:${kind}`,
    step_kind: kind,
    status,
    summary,
    requires_human_approval: requiresHumanApproval,
    execution_attempted: false,
    metadata_only: true,
  });
}
