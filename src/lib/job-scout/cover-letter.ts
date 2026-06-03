import { z } from "zod";
import { JobPostingSchema } from "./contract";
import { JobFitScoreSchema, JobScoutProfileSchema } from "./ranking";

export const JOB_SCOUT_COVER_LETTER_VERSION =
  "phase21i.job-scout-cover-letter-foundation.v1" as const;

export const COVER_LETTER_DRAFT_STATUSES = [
  "draft_plan_ready",
  "blocked_missing_job_metadata",
  "blocked_missing_profile_metadata",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(600);
const BoundedIdSchema = z.string().trim().min(1).max(180);

export const CoverLetterDraftStatusSchema = z.enum(COVER_LETTER_DRAFT_STATUSES);

export const CoverLetterTemplateSchema = z.strictObject({
  template_id: BoundedIdSchema,
  template_version: z.literal(JOB_SCOUT_COVER_LETTER_VERSION),
  sections: z.array(
    z.enum([
      "role_context",
      "company_context",
      "skill_alignment",
      "motivation",
      "closing",
    ]),
  ),
  placeholders: z.array(BoundedTextSchema),
  final_letter_generated: z.literal(false),
  model_call_required: z.literal(false),
});

export const CoverLetterInputSchema = z.strictObject({
  input_id: BoundedIdSchema,
  posting: JobPostingSchema,
  profile: JobScoutProfileSchema,
  fit_score: JobFitScoreSchema,
  company_notes: z.array(BoundedTextSchema).default([]),
  candidate_highlights: z.array(BoundedTextSchema).default([]),
  metadata_only: z.literal(true),
});

export const CoverLetterDraftRequirementsSummarySchema = z.strictObject({
  required_sections: z.array(BoundedTextSchema),
  available_metadata: z.array(BoundedTextSchema),
  missing_metadata: z.array(BoundedTextSchema),
  missing_skills: z.array(z.string().trim().min(1).max(80).toLowerCase()),
  ready_for_drafting: z.boolean(),
  metadata_only: z.literal(true),
});

export const CoverLetterDraftPlanSchema = z.strictObject({
  draft_id: BoundedIdSchema,
  draft_version: z.literal(JOB_SCOUT_COVER_LETTER_VERSION),
  status: CoverLetterDraftStatusSchema,
  template: CoverLetterTemplateSchema,
  input: CoverLetterInputSchema,
  requirements_summary: CoverLetterDraftRequirementsSummarySchema,
  suggested_outline: z.array(BoundedTextSchema),
  governance: z.strictObject({
    suggestion_only: z.literal(true),
    draft_ready: z.boolean(),
    final_letter_generated: z.literal(false),
    llm_call_attempted: z.literal(false),
    deepseek_call_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    filesystem_write_attempted: z.literal(false),
    database_write_attempted: z.literal(false),
    submission_attempted: z.literal(false),
    approval_execution_attempted: z.literal(false),
  }),
});

export type CoverLetterDraftStatus = z.infer<
  typeof CoverLetterDraftStatusSchema
>;
export type CoverLetterTemplate = z.infer<typeof CoverLetterTemplateSchema>;
export type CoverLetterInput = z.infer<typeof CoverLetterInputSchema>;
export type CoverLetterDraftRequirementsSummary = z.infer<
  typeof CoverLetterDraftRequirementsSummarySchema
>;
export type CoverLetterDraft = z.infer<typeof CoverLetterDraftPlanSchema>;

export function buildCoverLetterTemplate(
  template_id = "cover-letter-template:job-scout-standard",
): CoverLetterTemplate {
  return CoverLetterTemplateSchema.parse({
    template_id,
    template_version: JOB_SCOUT_COVER_LETTER_VERSION,
    sections: [
      "role_context",
      "company_context",
      "skill_alignment",
      "motivation",
      "closing",
    ],
    placeholders: [
      "role_title",
      "company_name",
      "matched_skills",
      "missing_skill_mitigation",
      "candidate_highlights",
    ],
    final_letter_generated: false,
    model_call_required: false,
  });
}

export function summarizeDraftRequirements(
  input: CoverLetterInput,
): CoverLetterDraftRequirementsSummary {
  const parsed = CoverLetterInputSchema.parse(input);
  const availableMetadata = [
    "job_posting",
    "company_metadata",
    "candidate_profile",
    "fit_score",
    ...(parsed.company_notes.length > 0 ? ["company_notes"] : []),
    ...(parsed.candidate_highlights.length > 0 ? ["candidate_highlights"] : []),
  ];
  const missingMetadata = [
    ...(parsed.company_notes.length === 0 ? ["company_notes"] : []),
    ...(parsed.candidate_highlights.length === 0
      ? ["candidate_highlights"]
      : []),
  ];

  return CoverLetterDraftRequirementsSummarySchema.parse({
    required_sections: buildCoverLetterTemplate().sections,
    available_metadata: availableMetadata,
    missing_metadata: missingMetadata,
    missing_skills: parsed.fit_score.missing_skills,
    ready_for_drafting:
      parsed.posting.title.length > 0 &&
      parsed.posting.company.name.length > 0 &&
      parsed.profile.skill_tags.length > 0,
    metadata_only: true,
  });
}

export function buildCoverLetterDraftPlan(
  input: CoverLetterInput,
): CoverLetterDraft {
  const parsed = CoverLetterInputSchema.parse(input);
  const requirementsSummary = summarizeDraftRequirements(parsed);
  const status = requirementsSummary.ready_for_drafting
    ? "draft_plan_ready"
    : parsed.profile.skill_tags.length === 0
      ? "blocked_missing_profile_metadata"
      : "blocked_missing_job_metadata";

  return CoverLetterDraftPlanSchema.parse({
    draft_id: `cover-letter-draft:${parsed.posting.posting_id}`,
    draft_version: JOB_SCOUT_COVER_LETTER_VERSION,
    status,
    template: buildCoverLetterTemplate(),
    input: parsed,
    requirements_summary: requirementsSummary,
    suggested_outline: [
      `Open with interest in ${parsed.posting.title} at ${parsed.posting.company.name}.`,
      `Reference strongest matched skills: ${parsed.fit_score.matched_skills.join(", ") || "none supplied"}.`,
      parsed.fit_score.missing_skills.length > 0
        ? `Acknowledge growth areas without overstating: ${parsed.fit_score.missing_skills.join(", ")}.`
        : "No explicit required skill gaps detected from metadata.",
      "Close with a concise request for human review before any application action.",
    ],
    governance: {
      suggestion_only: true,
      draft_ready: status === "draft_plan_ready",
      final_letter_generated: false,
      llm_call_attempted: false,
      deepseek_call_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      submission_attempted: false,
      approval_execution_attempted: false,
    },
  });
}
