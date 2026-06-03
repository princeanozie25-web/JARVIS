import { z } from "zod";
import { jobScoutGovernance } from "./contract";
import {
  JobRankingResultSchema,
  RankedJobPostingSchema,
  type JobRankingResult,
  type RankedJobPosting,
} from "./ranking";

export const JOB_SCOUT_DIGEST_VERSION =
  "phase21i.job-scout-digest-generator.v1" as const;

export const JOB_SCOUT_RECOMMENDED_ACTIONS = [
  "review_role",
  "prepare_application_materials",
  "close_skill_gap",
  "monitor_company",
  "ignore_for_now",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(500);
const TagSchema = z.string().trim().min(1).max(80).toLowerCase();

export const JobScoutDigestOpportunitySchema = z.strictObject({
  rank: z.number().int().positive(),
  posting_id: z.string().trim().min(1).max(180),
  title: BoundedTextSchema,
  company: BoundedTextSchema,
  source_type: z.string().trim().min(1).max(80),
  fit_score: z.number().min(0).max(100),
  confidence: z.enum(["high", "medium", "low"]),
  fit_explanations: z.array(BoundedTextSchema),
  missing_skills: z.array(TagSchema),
  recommended_action: z.enum(JOB_SCOUT_RECOMMENDED_ACTIONS),
  suggestion_only: z.literal(true),
  application_submission_attempted: z.literal(false),
});

export const JobScoutMissingSkillSummarySchema = z.strictObject({
  skill_tag: TagSchema,
  occurrence_count: z.number().int().positive(),
  affected_posting_ids: z.array(z.string().trim().min(1).max(180)),
});

export const JobScoutDigestGovernanceSchema = z.strictObject({
  suggestion_only: z.literal(true),
  deterministic: z.literal(true),
  fixture_input_only: z.literal(true),
  suitable_for_morning_brief: z.literal(true),
  suitable_for_future_suggestion_inbox: z.literal(true),
  scraping_attempted: z.literal(false),
  playwright_attempted: z.literal(false),
  browser_automation_attempted: z.literal(false),
  external_api_call_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  embedding_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  filesystem_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
  scheduler_invoked: z.literal(false),
  approval_execution_attempted: z.literal(false),
  application_submission_attempted: z.literal(false),
  auto_apply_attempted: z.literal(false),
  auto_send_attempted: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export const JobScoutDigestSchema = z.strictObject({
  digest_version: z.literal(JOB_SCOUT_DIGEST_VERSION),
  digest_id: z.string().trim().min(1).max(180),
  generated_at: z.string().trim().datetime({ offset: true }),
  candidate_count: z.number().int().nonnegative(),
  top_opportunities: z.array(JobScoutDigestOpportunitySchema),
  missing_skill_summary: z.array(JobScoutMissingSkillSummarySchema),
  recommended_next_actions: z.array(BoundedTextSchema),
  governance: JobScoutDigestGovernanceSchema,
  metadata_only: z.literal(true),
  write_attempted: z.literal(false),
});

export type JobScoutRecommendedAction =
  (typeof JOB_SCOUT_RECOMMENDED_ACTIONS)[number];
export type JobScoutDigestOpportunity = z.infer<
  typeof JobScoutDigestOpportunitySchema
>;
export type JobScoutMissingSkillSummary = z.infer<
  typeof JobScoutMissingSkillSummarySchema
>;
export type JobScoutDigestGovernance = z.infer<
  typeof JobScoutDigestGovernanceSchema
>;
export type JobScoutDigest = z.infer<typeof JobScoutDigestSchema>;

export function buildJobScoutDigest(
  ranking: JobRankingResult,
  options: {
    readonly generated_at?: string;
    readonly digest_id?: string;
    readonly top_n?: number;
  } = {},
): JobScoutDigest {
  const parsed = JobRankingResultSchema.parse(ranking);
  const topN = Math.max(1, Math.min(options.top_n ?? 5, 10));
  const topOpportunities = parsed.ranked_jobs
    .slice(0, topN)
    .map((ranked) => opportunityFor(ranked));
  const missingSkillSummary = summarizeMissingSkills(parsed.ranked_jobs);

  return JobScoutDigestSchema.parse({
    digest_version: JOB_SCOUT_DIGEST_VERSION,
    digest_id: options.digest_id ?? "job-scout:digest:fixture",
    generated_at: options.generated_at ?? "2026-06-03T08:00:00.000Z",
    candidate_count: parsed.ranked_jobs.length,
    top_opportunities: topOpportunities,
    missing_skill_summary: missingSkillSummary,
    recommended_next_actions: recommendedNextActions(topOpportunities),
    governance: {
      suggestion_only: jobScoutGovernance().suggestion_only,
      deterministic: true,
      fixture_input_only: true,
      suitable_for_morning_brief: true,
      suitable_for_future_suggestion_inbox: true,
      scraping_attempted: false,
      playwright_attempted: false,
      browser_automation_attempted: false,
      external_api_call_attempted: false,
      provider_call_attempted: false,
      model_call_attempted: false,
      embedding_attempted: false,
      network_call_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      scheduler_invoked: false,
      approval_execution_attempted: false,
      application_submission_attempted: false,
      auto_apply_attempted: false,
      auto_send_attempted: false,
      new_authority_surface_added: false,
    },
    metadata_only: true,
    write_attempted: false,
  });
}

function opportunityFor(ranked: RankedJobPosting): JobScoutDigestOpportunity {
  const parsed = RankedJobPostingSchema.parse(ranked);

  return JobScoutDigestOpportunitySchema.parse({
    rank: parsed.rank,
    posting_id: parsed.posting.posting_id,
    title: parsed.posting.title,
    company: parsed.posting.company.name,
    source_type: parsed.posting.source.source_type,
    fit_score: parsed.score.fit_score,
    confidence: parsed.score.confidence,
    fit_explanations: parsed.score.explanation,
    missing_skills: parsed.score.missing_skills,
    recommended_action: actionFor(parsed),
    suggestion_only: true,
    application_submission_attempted: false,
  });
}

function summarizeMissingSkills(
  rankedJobs: readonly RankedJobPosting[],
): JobScoutMissingSkillSummary[] {
  const counts = new Map<string, Set<string>>();
  for (const ranked of rankedJobs) {
    for (const skill of ranked.score.missing_skills) {
      const existing = counts.get(skill) ?? new Set<string>();
      existing.add(ranked.posting.posting_id);
      counts.set(skill, existing);
    }
  }

  return [...counts.entries()]
    .map(([skill, postingIds]) => ({
      skill_tag: skill,
      occurrence_count: postingIds.size,
      affected_posting_ids: [...postingIds].sort(),
    }))
    .sort((left, right) => {
      if (right.occurrence_count !== left.occurrence_count) {
        return right.occurrence_count - left.occurrence_count;
      }
      return left.skill_tag.localeCompare(right.skill_tag);
    });
}

function recommendedNextActions(
  opportunities: readonly JobScoutDigestOpportunity[],
): string[] {
  const reviewCount = opportunities.filter(
    (opportunity) => opportunity.recommended_action === "review_role",
  ).length;
  const prepCount = opportunities.filter(
    (opportunity) =>
      opportunity.recommended_action === "prepare_application_materials",
  ).length;
  const skillGapCount = opportunities.filter(
    (opportunity) => opportunity.recommended_action === "close_skill_gap",
  ).length;

  return [
    `${reviewCount + prepCount} high-fit opportunities are ready for manual review.`,
    `${skillGapCount} opportunities need skill-gap preparation before application planning.`,
    "Keep Job Scout suggestion-only until scraping and application workflows receive explicit future approval.",
  ];
}

function actionFor(ranked: RankedJobPosting): JobScoutRecommendedAction {
  if (ranked.score.fit_score >= 82 && ranked.score.missing_skills.length <= 1) {
    return "prepare_application_materials";
  }
  if (ranked.score.fit_score >= 68) return "review_role";
  if (ranked.score.missing_skills.length >= 2) return "close_skill_gap";
  if (ranked.score.fit_score >= 50) return "monitor_company";
  return "ignore_for_now";
}
