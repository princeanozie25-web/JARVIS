import { z } from "zod";
import {
  JobApplicationSchema,
  type JobApplication,
} from "./application-tracker";
import {
  CoverLetterDraftPlanSchema,
  type CoverLetterDraft,
} from "./cover-letter";
import { RankedJobPostingSchema, type RankedJobPosting } from "./ranking";

export const JOB_SCOUT_SUPERVISED_APPLICATION_VERSION =
  "phase21i.job-scout-supervised-application-workflow.v1" as const;

export const JOB_SCOUT_FORM_FIELD_KINDS = [
  "text",
  "textarea",
  "select",
  "checkbox",
  "file",
] as const;

export const JOB_SCOUT_APPLICATION_DRAFT_PLAN_STATUSES = [
  "awaiting_user_approval",
  "blocked_mismatched_application",
  "blocked_application_not_ready",
  "blocked_cover_letter_not_ready",
] as const;

export const JOB_SCOUT_FORM_PREVIEW_STATUSES = [
  "ready_for_final_confirmation",
  "blocked_missing_user_approval",
] as const;

export const JOB_SCOUT_SUPERVISED_SUBMISSION_STATUSES = [
  "blocked_missing_final_ui_confirmation",
  "blocked_adapter_mismatch",
  "fake_submission_completed",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(180);
const BoundedTextSchema = z.string().trim().min(1).max(600);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const JobScoutFormFieldKindSchema = z.enum(JOB_SCOUT_FORM_FIELD_KINDS);
export const JobScoutApplicationDraftPlanStatusSchema = z.enum(
  JOB_SCOUT_APPLICATION_DRAFT_PLAN_STATUSES,
);
export const JobScoutFormPreviewStatusSchema = z.enum(
  JOB_SCOUT_FORM_PREVIEW_STATUSES,
);
export const JobScoutSupervisedSubmissionStatusSchema = z.enum(
  JOB_SCOUT_SUPERVISED_SUBMISSION_STATUSES,
);

export const JobScoutApplicationFormFieldPreviewSchema = z.strictObject({
  field_id: BoundedIdSchema,
  label: BoundedTextSchema,
  field_kind: JobScoutFormFieldKindSchema,
  value_preview: BoundedTextSchema,
  user_editable: z.literal(true),
  sensitive: z.boolean(),
  raw_value_included_in_telemetry: z.literal(false),
  credentials_field: z.literal(false),
});

export const JobScoutApplicationDraftPlanSchema = z.strictObject({
  draft_plan_id: BoundedIdSchema,
  workflow_version: z.literal(JOB_SCOUT_SUPERVISED_APPLICATION_VERSION),
  status: JobScoutApplicationDraftPlanStatusSchema,
  selected_ranked_job: RankedJobPostingSchema,
  application: JobApplicationSchema,
  cover_letter_draft: CoverLetterDraftPlanSchema,
  planned_form_fields: z.array(JobScoutApplicationFormFieldPreviewSchema),
  user_approval_required: z.literal(true),
  final_ui_confirmation_required: z.literal(true),
  governance: z.strictObject({
    supervised_only: z.literal(true),
    ranked_job_selected: z.boolean(),
    application_ready_to_apply: z.boolean(),
    cover_letter_draft_plan_ready: z.boolean(),
    user_approval_received: z.literal(false),
    form_fill_preview_generated: z.literal(false),
    final_ui_confirmation_received: z.literal(false),
    fake_submission_adapter_invoked: z.literal(false),
    external_submission_attempted: z.literal(false),
    no_auto_apply: z.literal(true),
    no_unsupervised_submit: z.literal(true),
    credentials_included: z.literal(false),
    raw_application_body_telemetry_included: z.literal(false),
  }),
});

export const JobScoutUserApplicationApprovalSchema = z.strictObject({
  approval_id: BoundedIdSchema,
  draft_plan_id: BoundedIdSchema,
  approved: z.boolean(),
  approved_at: IsoDateTimeSchema,
  approved_by: z.literal("user"),
  approval_scope: z.literal("application_draft_plan"),
  credentials_included: z.literal(false),
  raw_application_body_telemetry_included: z.literal(false),
});

export const JobScoutApplicationFormFillPreviewSchema = z.strictObject({
  preview_id: BoundedIdSchema,
  workflow_version: z.literal(JOB_SCOUT_SUPERVISED_APPLICATION_VERSION),
  status: JobScoutFormPreviewStatusSchema,
  draft_plan: JobScoutApplicationDraftPlanSchema,
  approval: JobScoutUserApplicationApprovalSchema.nullable(),
  fields: z.array(JobScoutApplicationFormFieldPreviewSchema),
  generated_after_user_approval: z.boolean(),
  final_ui_confirmation_required: z.literal(true),
  submission_adapter_invocation_permitted: z.literal(false),
  telemetry: z.strictObject({
    metadata_only: z.literal(true),
    source_id: BoundedIdSchema,
    posting_id: BoundedIdSchema,
    field_count: z.number().int().nonnegative(),
    credentials_included: z.literal(false),
    raw_application_body_included: z.literal(false),
  }),
});

export const JobScoutFinalUiConfirmationSchema = z.strictObject({
  confirmation_id: BoundedIdSchema,
  preview_id: BoundedIdSchema,
  draft_plan_id: BoundedIdSchema,
  confirmed: z.boolean(),
  confirmed_at: IsoDateTimeSchema,
  confirmed_by: z.literal("user"),
  visible_preview_reviewed: z.boolean(),
  credentials_included: z.literal(false),
  raw_application_body_telemetry_included: z.literal(false),
});

export const JobScoutFakeSubmissionAdapterResultSchema = z.strictObject({
  adapter_id: BoundedIdSchema,
  source_id: BoundedIdSchema,
  outcome: z.enum(["accepted_fake_submission", "rejected_fake_submission"]),
  submitted_at: IsoDateTimeSchema,
  external_reference_id: BoundedIdSchema.nullable(),
  fake_submission: z.literal(true),
  credentials_used: z.literal(false),
  raw_application_body_logged: z.literal(false),
  network_call_attempted: z.literal(false),
});

export const JobScoutSupervisedApplicationSubmissionResultSchema =
  z.strictObject({
    workflow_version: z.literal(JOB_SCOUT_SUPERVISED_APPLICATION_VERSION),
    submission_id: BoundedIdSchema,
    status: JobScoutSupervisedSubmissionStatusSchema,
    preview: JobScoutApplicationFormFillPreviewSchema,
    final_confirmation: JobScoutFinalUiConfirmationSchema.nullable(),
    adapter_result: JobScoutFakeSubmissionAdapterResultSchema.nullable(),
    governance: z.strictObject({
      supervised_only: z.literal(true),
      user_approval_required: z.literal(true),
      user_approval_received: z.boolean(),
      final_ui_confirmation_required: z.literal(true),
      final_ui_confirmation_received: z.boolean(),
      fake_submission_adapter_invoked: z.boolean(),
      external_submission_attempted: z.literal(false),
      no_auto_apply: z.literal(true),
      no_unsupervised_submit: z.literal(true),
      credentials_included: z.literal(false),
      raw_application_body_telemetry_included: z.literal(false),
    }),
    telemetry: z.strictObject({
      metadata_only: z.literal(true),
      source_id: BoundedIdSchema,
      posting_id: BoundedIdSchema,
      preview_field_count: z.number().int().nonnegative(),
      credentials_included: z.literal(false),
      raw_application_body_included: z.literal(false),
      network_call_attempted_by_boundary: z.literal(false),
    }),
  });

export type JobScoutApplicationFormFieldPreview = z.infer<
  typeof JobScoutApplicationFormFieldPreviewSchema
>;
export type JobScoutApplicationDraftPlanStatus = z.infer<
  typeof JobScoutApplicationDraftPlanStatusSchema
>;
export type JobScoutApplicationDraftPlan = z.infer<
  typeof JobScoutApplicationDraftPlanSchema
>;
export type JobScoutUserApplicationApproval = z.infer<
  typeof JobScoutUserApplicationApprovalSchema
>;
export type JobScoutApplicationFormFillPreview = z.infer<
  typeof JobScoutApplicationFormFillPreviewSchema
>;
export type JobScoutFinalUiConfirmation = z.infer<
  typeof JobScoutFinalUiConfirmationSchema
>;
export type JobScoutFakeSubmissionAdapterResult = z.infer<
  typeof JobScoutFakeSubmissionAdapterResultSchema
>;
export type JobScoutSupervisedApplicationSubmissionResult = z.infer<
  typeof JobScoutSupervisedApplicationSubmissionResultSchema
>;

export interface JobScoutFakeSubmissionAdapter {
  readonly adapter_id: string;
  readonly source_id: string;
  complete(
    preview: JobScoutApplicationFormFillPreview,
    confirmation: JobScoutFinalUiConfirmation,
  ):
    | JobScoutFakeSubmissionAdapterResult
    | Promise<JobScoutFakeSubmissionAdapterResult>;
}

export function buildSupervisedApplicationDraftPlan(input: {
  readonly draft_plan_id?: string;
  readonly ranked_job: RankedJobPosting;
  readonly application: JobApplication;
  readonly cover_letter_draft: CoverLetterDraft;
}): JobScoutApplicationDraftPlan {
  const rankedJob = RankedJobPostingSchema.parse(input.ranked_job);
  const application = JobApplicationSchema.parse(input.application);
  const coverLetterDraft = CoverLetterDraftPlanSchema.parse(
    input.cover_letter_draft,
  );
  const applicationMatches =
    application.posting.posting_id === rankedJob.posting.posting_id;
  const applicationReady = application.status === "ready_to_apply";
  const coverLetterReady =
    coverLetterDraft.input.posting.posting_id ===
      rankedJob.posting.posting_id &&
    coverLetterDraft.status === "draft_plan_ready";
  const status = !applicationMatches
    ? "blocked_mismatched_application"
    : !applicationReady
      ? "blocked_application_not_ready"
      : !coverLetterReady
        ? "blocked_cover_letter_not_ready"
        : "awaiting_user_approval";

  return JobScoutApplicationDraftPlanSchema.parse({
    draft_plan_id:
      input.draft_plan_id ??
      `job-scout:application-draft-plan:${rankedJob.posting.posting_id}`,
    workflow_version: JOB_SCOUT_SUPERVISED_APPLICATION_VERSION,
    status,
    selected_ranked_job: rankedJob,
    application,
    cover_letter_draft: coverLetterDraft,
    planned_form_fields: plannedFields(rankedJob, coverLetterDraft),
    user_approval_required: true,
    final_ui_confirmation_required: true,
    governance: {
      supervised_only: true,
      ranked_job_selected: true,
      application_ready_to_apply: applicationReady,
      cover_letter_draft_plan_ready: applicationReady && coverLetterReady,
      user_approval_received: false,
      form_fill_preview_generated: false,
      final_ui_confirmation_received: false,
      fake_submission_adapter_invoked: false,
      external_submission_attempted: false,
      no_auto_apply: true,
      no_unsupervised_submit: true,
      credentials_included: false,
      raw_application_body_telemetry_included: false,
    },
  });
}

export function approveApplicationDraftPlan(input: {
  readonly approval_id?: string;
  readonly draft_plan: JobScoutApplicationDraftPlan;
  readonly approved: boolean;
  readonly approved_at?: string;
}): JobScoutUserApplicationApproval {
  const draftPlan = JobScoutApplicationDraftPlanSchema.parse(input.draft_plan);

  return JobScoutUserApplicationApprovalSchema.parse({
    approval_id:
      input.approval_id ??
      `job-scout:application-approval:${draftPlan.draft_plan_id}`,
    draft_plan_id: draftPlan.draft_plan_id,
    approved: input.approved,
    approved_at: input.approved_at ?? "2026-06-03T10:00:00.000Z",
    approved_by: "user",
    approval_scope: "application_draft_plan",
    credentials_included: false,
    raw_application_body_telemetry_included: false,
  });
}

export function generateApplicationFormFillPreview(input: {
  readonly preview_id?: string;
  readonly draft_plan: JobScoutApplicationDraftPlan;
  readonly approval: JobScoutUserApplicationApproval | null;
}): JobScoutApplicationFormFillPreview {
  const draftPlan = JobScoutApplicationDraftPlanSchema.parse(input.draft_plan);
  const approval =
    input.approval === null
      ? null
      : JobScoutUserApplicationApprovalSchema.parse(input.approval);
  const approved =
    draftPlan.status === "awaiting_user_approval" &&
    approval?.draft_plan_id === draftPlan.draft_plan_id &&
    approval.approved;
  const fields = approved ? draftPlan.planned_form_fields : [];

  return JobScoutApplicationFormFillPreviewSchema.parse({
    preview_id:
      input.preview_id ?? `job-scout:form-preview:${draftPlan.draft_plan_id}`,
    workflow_version: JOB_SCOUT_SUPERVISED_APPLICATION_VERSION,
    status: approved
      ? "ready_for_final_confirmation"
      : "blocked_missing_user_approval",
    draft_plan: draftPlan,
    approval,
    fields,
    generated_after_user_approval: approved,
    final_ui_confirmation_required: true,
    submission_adapter_invocation_permitted: false,
    telemetry: {
      metadata_only: true,
      source_id: draftPlan.selected_ranked_job.posting.source.source_id,
      posting_id: draftPlan.selected_ranked_job.posting.posting_id,
      field_count: fields.length,
      credentials_included: false,
      raw_application_body_included: false,
    },
  });
}

export function confirmApplicationPreviewForSubmission(input: {
  readonly confirmation_id?: string;
  readonly preview: JobScoutApplicationFormFillPreview;
  readonly confirmed: boolean;
  readonly confirmed_at?: string;
  readonly visible_preview_reviewed: boolean;
}): JobScoutFinalUiConfirmation {
  const preview = JobScoutApplicationFormFillPreviewSchema.parse(input.preview);

  return JobScoutFinalUiConfirmationSchema.parse({
    confirmation_id:
      input.confirmation_id ??
      `job-scout:final-ui-confirmation:${preview.preview_id}`,
    preview_id: preview.preview_id,
    draft_plan_id: preview.draft_plan.draft_plan_id,
    confirmed: input.confirmed,
    confirmed_at: input.confirmed_at ?? "2026-06-03T10:05:00.000Z",
    confirmed_by: "user",
    visible_preview_reviewed: input.visible_preview_reviewed,
    credentials_included: false,
    raw_application_body_telemetry_included: false,
  });
}

export async function completeSupervisedApplicationWithAdapter(input: {
  readonly submission_id?: string;
  readonly preview: JobScoutApplicationFormFillPreview;
  readonly final_confirmation: JobScoutFinalUiConfirmation | null;
  readonly adapter: JobScoutFakeSubmissionAdapter;
}): Promise<JobScoutSupervisedApplicationSubmissionResult> {
  const preview = JobScoutApplicationFormFillPreviewSchema.parse(input.preview);
  const confirmation =
    input.final_confirmation === null
      ? null
      : JobScoutFinalUiConfirmationSchema.parse(input.final_confirmation);
  const confirmationValid =
    preview.status === "ready_for_final_confirmation" &&
    confirmation?.preview_id === preview.preview_id &&
    confirmation.draft_plan_id === preview.draft_plan.draft_plan_id &&
    confirmation.confirmed &&
    confirmation.visible_preview_reviewed;
  const adapterMatches =
    input.adapter.source_id ===
    preview.draft_plan.selected_ranked_job.posting.source.source_id;

  if (!confirmationValid) {
    return submissionResult({
      submission_id: input.submission_id,
      preview,
      confirmation,
      adapterResult: null,
      status: "blocked_missing_final_ui_confirmation",
      adapterInvoked: false,
    });
  }

  if (!adapterMatches) {
    return submissionResult({
      submission_id: input.submission_id,
      preview,
      confirmation,
      adapterResult: null,
      status: "blocked_adapter_mismatch",
      adapterInvoked: false,
    });
  }

  const adapterResult = JobScoutFakeSubmissionAdapterResultSchema.parse(
    await input.adapter.complete(preview, confirmation),
  );

  return submissionResult({
    submission_id: input.submission_id,
    preview,
    confirmation,
    adapterResult,
    status: "fake_submission_completed",
    adapterInvoked: true,
  });
}

function submissionResult(input: {
  readonly submission_id?: string;
  readonly preview: JobScoutApplicationFormFillPreview;
  readonly confirmation: JobScoutFinalUiConfirmation | null;
  readonly adapterResult: JobScoutFakeSubmissionAdapterResult | null;
  readonly status: z.infer<typeof JobScoutSupervisedSubmissionStatusSchema>;
  readonly adapterInvoked: boolean;
}): JobScoutSupervisedApplicationSubmissionResult {
  const posting = input.preview.draft_plan.selected_ranked_job.posting;

  return JobScoutSupervisedApplicationSubmissionResultSchema.parse({
    workflow_version: JOB_SCOUT_SUPERVISED_APPLICATION_VERSION,
    submission_id:
      input.submission_id ??
      `job-scout:supervised-submission:${input.preview.preview_id}`,
    status: input.status,
    preview: input.preview,
    final_confirmation: input.confirmation,
    adapter_result: input.adapterResult,
    governance: {
      supervised_only: true,
      user_approval_required: true,
      user_approval_received: input.preview.generated_after_user_approval,
      final_ui_confirmation_required: true,
      final_ui_confirmation_received:
        input.confirmation?.confirmed === true &&
        input.confirmation.visible_preview_reviewed,
      fake_submission_adapter_invoked: input.adapterInvoked,
      external_submission_attempted: false,
      no_auto_apply: true,
      no_unsupervised_submit: true,
      credentials_included: false,
      raw_application_body_telemetry_included: false,
    },
    telemetry: {
      metadata_only: true,
      source_id: posting.source.source_id,
      posting_id: posting.posting_id,
      preview_field_count: input.preview.fields.length,
      credentials_included: false,
      raw_application_body_included: false,
      network_call_attempted_by_boundary: false,
    },
  });
}

function plannedFields(
  rankedJob: RankedJobPosting,
  coverLetterDraft: CoverLetterDraft,
): JobScoutApplicationFormFieldPreview[] {
  return [
    field("role", "Role", "text", rankedJob.posting.title, false),
    field("company", "Company", "text", rankedJob.posting.company.name, false),
    field(
      "cover-letter-outline",
      "Cover letter outline",
      "textarea",
      coverLetterDraft.suggested_outline.join(" "),
      false,
    ),
    field(
      "candidate-review",
      "Candidate review required",
      "checkbox",
      "User must review all visible fields before final confirmation.",
      false,
    ),
  ];
}

function field(
  id: string,
  label: string,
  kind: z.infer<typeof JobScoutFormFieldKindSchema>,
  valuePreview: string,
  sensitive: boolean,
): JobScoutApplicationFormFieldPreview {
  return JobScoutApplicationFormFieldPreviewSchema.parse({
    field_id: `job-scout:form-field:${id}`,
    label,
    field_kind: kind,
    value_preview: valuePreview.slice(0, 600),
    user_editable: true,
    sensitive,
    raw_value_included_in_telemetry: false,
    credentials_field: false,
  });
}
