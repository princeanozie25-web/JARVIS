import { createHash } from "node:crypto";
import { z } from "zod";

import {
  CoverLetterDraftPlanSchema,
  type CoverLetterDraft,
} from "./cover-letter";
import { RankedJobPostingSchema, type RankedJobPosting } from "./ranking";

export const JOB_SCOUT_SUBMISSION_WORKFLOW_VERSION =
  "phase21i-r.job-scout-submission-workflow.v1" as const;

export const JOB_SCOUT_FORM_FILL_STEP_KINDS = [
  "profile_metadata",
  "cover_letter_attachment",
  "cv_attachment",
  "screening_questions",
  "review_before_submit",
] as const;

export const JOB_SCOUT_SUBMISSION_STATUSES = [
  "planned",
  "preview_ready",
  "blocked",
  "submitted",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(220);
const BoundedTextSchema = z.string().trim().min(1).max(1200);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const JobScoutApprovalGateSchema = z.strictObject({
  approval_required: z.literal(true),
  approval_status: z.enum(["pending", "approved", "rejected"]),
  approval_id: BoundedIdSchema.nullable(),
  approved_at: IsoDateTimeSchema.nullable(),
  raw_approval_token_included: z.literal(false),
});

export const JobScoutFinalConfirmationSchema = z.strictObject({
  final_ui_confirmation_required: z.literal(true),
  final_ui_confirmation_received: z.boolean(),
  confirmed_at: IsoDateTimeSchema.nullable().default(null),
  confirmation_ref_hash: HashReferenceSchema.nullable().default(null),
  raw_confirmation_token_included: z.literal(false),
});

export const JobScoutFormFillStepSchema = z.strictObject({
  step_id: BoundedIdSchema,
  step_kind: z.enum(JOB_SCOUT_FORM_FILL_STEP_KINDS),
  field_label: BoundedTextSchema,
  value_ref_hash: HashReferenceSchema.nullable(),
  raw_value_included: z.literal(false),
  preview_required: z.literal(true),
  submit_attempted: z.literal(false),
});

export const JobScoutFormFillPreviewSchema = z.strictObject({
  preview_id: BoundedIdSchema,
  ranked_job_id: BoundedIdSchema,
  steps: z.array(JobScoutFormFillStepSchema).min(1),
  preview_required_before_submit: z.literal(true),
  submit_attempted: z.literal(false),
  credentials_included: z.literal(false),
  raw_application_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const JobScoutSubmissionPlanSchema = z.strictObject({
  submission_plan_id: BoundedIdSchema,
  workflow_version: z.literal(JOB_SCOUT_SUBMISSION_WORKFLOW_VERSION),
  ranked_job: RankedJobPostingSchema,
  cover_letter_draft: CoverLetterDraftPlanSchema,
  approval_gate: JobScoutApprovalGateSchema,
  form_fill_preview: JobScoutFormFillPreviewSchema,
  final_confirmation: JobScoutFinalConfirmationSchema,
  status: z.enum(JOB_SCOUT_SUBMISSION_STATUSES),
  blockers: z.array(BoundedTextSchema),
  governance: z.strictObject({
    no_auto_apply: z.literal(true),
    no_unsupervised_submission: z.literal(true),
    approval_required: z.literal(true),
    preview_required_before_submit: z.literal(true),
    final_ui_confirmation_required: z.literal(true),
    adapter_injection_required: z.literal(true),
    credentials_in_telemetry: z.literal(false),
    raw_application_body_in_telemetry: z.literal(false),
    network_call_attempted_by_planner: z.literal(false),
  }),
});

export const JobScoutSubmissionAdapterResultSchema = z.strictObject({
  submission_ref_hash: HashReferenceSchema,
  submitted_at: IsoDateTimeSchema,
  adapter_ref: BoundedIdSchema,
  raw_provider_response_included: z.literal(false),
  credentials_logged: z.literal(false),
});

export const JobScoutSubmissionResultSchema = z.strictObject({
  result_id: BoundedIdSchema,
  workflow_version: z.literal(JOB_SCOUT_SUBMISSION_WORKFLOW_VERSION),
  plan_id: BoundedIdSchema,
  status: z.enum([
    "submitted",
    "blocked",
    "adapter_unavailable",
    "adapter_error",
  ]),
  adapter_invoked: z.boolean(),
  submission_attempted: z.boolean(),
  submitted: z.boolean(),
  adapter_result: JobScoutSubmissionAdapterResultSchema.nullable(),
  telemetry: z.strictObject({
    metadata_only: z.literal(true),
    ranked_job_id: BoundedIdSchema,
    company_domain_hash: HashReferenceSchema.nullable(),
    submission_ref_hash: HashReferenceSchema.nullable(),
    credentials_included: z.literal(false),
    raw_application_body_included: z.literal(false),
    raw_cover_letter_included: z.literal(false),
  }),
});

export type JobScoutApprovalGate = z.infer<typeof JobScoutApprovalGateSchema>;
export type JobScoutFinalConfirmation = z.infer<
  typeof JobScoutFinalConfirmationSchema
>;
export type JobScoutFormFillStep = z.infer<typeof JobScoutFormFillStepSchema>;
export type JobScoutFormFillPreview = z.infer<
  typeof JobScoutFormFillPreviewSchema
>;
export type JobScoutSubmissionPlan = z.infer<
  typeof JobScoutSubmissionPlanSchema
>;
export type JobScoutSubmissionResult = z.infer<
  typeof JobScoutSubmissionResultSchema
>;
export type JobScoutSubmissionAdapterResult = z.infer<
  typeof JobScoutSubmissionAdapterResultSchema
>;

export interface JobScoutSubmissionAdapter {
  submit(
    plan: JobScoutSubmissionPlan,
  ):
    | Promise<JobScoutSubmissionAdapterResult | unknown>
    | JobScoutSubmissionAdapterResult
    | unknown;
}

export function buildJobScoutSubmissionPlan(input: {
  readonly plan_id?: string;
  readonly ranked_job: RankedJobPosting;
  readonly cover_letter_draft: CoverLetterDraft;
  readonly approval_gate?: Partial<JobScoutApprovalGate>;
  readonly final_confirmation?: Partial<JobScoutFinalConfirmation>;
}): JobScoutSubmissionPlan {
  const rankedJob = RankedJobPostingSchema.parse(input.ranked_job);
  const draft = CoverLetterDraftPlanSchema.parse(input.cover_letter_draft);
  const approval = JobScoutApprovalGateSchema.parse({
    approval_required: true,
    approval_status: input.approval_gate?.approval_status ?? "pending",
    approval_id: input.approval_gate?.approval_id ?? null,
    approved_at: input.approval_gate?.approved_at ?? null,
    raw_approval_token_included: false,
  });
  const confirmation = JobScoutFinalConfirmationSchema.parse({
    final_ui_confirmation_required: true,
    final_ui_confirmation_received:
      input.final_confirmation?.final_ui_confirmation_received ?? false,
    confirmed_at: input.final_confirmation?.confirmed_at ?? null,
    confirmation_ref_hash:
      input.final_confirmation?.confirmation_ref_hash ?? null,
    raw_confirmation_token_included: false,
  });
  const blockers = submissionBlockers(approval, confirmation);

  return JobScoutSubmissionPlanSchema.parse({
    submission_plan_id:
      input.plan_id ??
      `job-scout:submission-plan:${rankedJob.posting.posting_id}`,
    workflow_version: JOB_SCOUT_SUBMISSION_WORKFLOW_VERSION,
    ranked_job: rankedJob,
    cover_letter_draft: draft,
    approval_gate: approval,
    form_fill_preview: buildFormFillPreview(rankedJob, draft),
    final_confirmation: confirmation,
    status: blockers.length > 0 ? "blocked" : "preview_ready",
    blockers,
    governance: {
      no_auto_apply: true,
      no_unsupervised_submission: true,
      approval_required: true,
      preview_required_before_submit: true,
      final_ui_confirmation_required: true,
      adapter_injection_required: true,
      credentials_in_telemetry: false,
      raw_application_body_in_telemetry: false,
      network_call_attempted_by_planner: false,
    },
  });
}

export async function submitJobScoutApplication(input: {
  readonly plan: JobScoutSubmissionPlan;
  readonly adapter?: JobScoutSubmissionAdapter;
}): Promise<JobScoutSubmissionResult> {
  const plan = JobScoutSubmissionPlanSchema.parse(input.plan);
  if (plan.status !== "preview_ready") {
    return submissionResult({ plan, status: "blocked", adapterInvoked: false });
  }
  if (!input.adapter) {
    return submissionResult({
      plan,
      status: "adapter_unavailable",
      adapterInvoked: false,
    });
  }
  try {
    const adapterResult = JobScoutSubmissionAdapterResultSchema.parse(
      await input.adapter.submit(plan),
    );
    return submissionResult({
      plan,
      status: "submitted",
      adapterInvoked: true,
      adapterResult,
    });
  } catch {
    return submissionResult({
      plan,
      status: "adapter_error",
      adapterInvoked: true,
    });
  }
}

function buildFormFillPreview(
  rankedJob: RankedJobPosting,
  draft: CoverLetterDraft,
): JobScoutFormFillPreview {
  const posting = rankedJob.posting;
  return JobScoutFormFillPreviewSchema.parse({
    preview_id: `job-scout:form-fill-preview:${posting.posting_id}`,
    ranked_job_id: posting.posting_id,
    steps: [
      formStep(
        "profile_metadata",
        "Candidate profile metadata",
        posting.posting_id,
      ),
      formStep(
        "cover_letter_attachment",
        "Cover letter draft plan",
        draft.draft_id,
      ),
      formStep(
        "cv_attachment",
        "CV attachment reference",
        posting.company.company_id,
      ),
      formStep(
        "screening_questions",
        "Screening question metadata",
        posting.title,
      ),
      formStep("review_before_submit", "Human review gate", posting.url),
    ],
    preview_required_before_submit: true,
    submit_attempted: false,
    credentials_included: false,
    raw_application_body_included: false,
    metadata_only: true,
  });
}

function formStep(
  kind: z.infer<typeof JobScoutFormFillStepSchema>["step_kind"],
  label: string,
  value: string,
): JobScoutFormFillStep {
  return JobScoutFormFillStepSchema.parse({
    step_id: `job-scout:form-fill-step:${kind}`,
    step_kind: kind,
    field_label: label,
    value_ref_hash: hashReference(value),
    raw_value_included: false,
    preview_required: true,
    submit_attempted: false,
  });
}

function submissionBlockers(
  approval: JobScoutApprovalGate,
  confirmation: JobScoutFinalConfirmation,
): string[] {
  return [
    ...(approval.approval_status !== "approved" || !approval.approval_id
      ? ["approval_not_finalized"]
      : []),
    ...(!confirmation.final_ui_confirmation_received ||
    !confirmation.confirmation_ref_hash
      ? ["final_ui_confirmation_missing"]
      : []),
  ];
}

function submissionResult(input: {
  readonly plan: JobScoutSubmissionPlan;
  readonly status: z.infer<typeof JobScoutSubmissionResultSchema>["status"];
  readonly adapterInvoked: boolean;
  readonly adapterResult?: JobScoutSubmissionAdapterResult;
}): JobScoutSubmissionResult {
  const posting = input.plan.ranked_job.posting;
  return JobScoutSubmissionResultSchema.parse({
    result_id: `job-scout:submission-result:${input.plan.submission_plan_id}`,
    workflow_version: JOB_SCOUT_SUBMISSION_WORKFLOW_VERSION,
    plan_id: input.plan.submission_plan_id,
    status: input.status,
    adapter_invoked: input.adapterInvoked,
    submission_attempted: input.adapterInvoked,
    submitted: input.status === "submitted",
    adapter_result: input.adapterResult ?? null,
    telemetry: {
      metadata_only: true,
      ranked_job_id: posting.posting_id,
      company_domain_hash: posting.company.domain
        ? hashReference(posting.company.domain)
        : null,
      submission_ref_hash: input.adapterResult?.submission_ref_hash ?? null,
      credentials_included: false,
      raw_application_body_included: false,
      raw_cover_letter_included: false,
    },
  });
}

function hashReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
