import { z } from "zod";
import {
  JobLocationTypeSchema,
  JobPostingSchema,
  JobSalaryBandSchema,
  JobWorkModeSchema,
  jobScoutGovernance,
  type JobPosting,
} from "./contract";

export const JOB_SCOUT_RANKING_VERSION =
  "phase21i.job-scout-ranking-engine.v1" as const;

export const JOB_SCOUT_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

const TagSchema = z.string().trim().min(1).max(80).toLowerCase();

export const JobScoutProfileSchema = z.strictObject({
  profile_id: z.string().trim().min(1).max(120),
  cybersecurity_interest: z.number().min(0).max(1),
  ai_ml_interest: z.number().min(0).max(1),
  graduate_role_preference: z.number().min(0).max(1),
  remote_preference: z.number().min(0).max(1),
  uk_preference: z.number().min(0).max(1),
  salary_expectation: JobSalaryBandSchema,
  skill_tags: z.array(TagSchema).default([]),
  preferred_role_tags: z.array(TagSchema).default([]),
  preferred_work_modes: z
    .array(JobWorkModeSchema)
    .default(["remote", "hybrid"]),
  preferred_location_types: z.array(JobLocationTypeSchema).default(["uk"]),
  metadata_only: z.literal(true),
});

export const JobFitScoreBreakdownSchema = z.strictObject({
  skill_match: z.number().min(0).max(35),
  domain_match: z.number().min(0).max(20),
  role_level_match: z.number().min(0).max(15),
  location_match: z.number().min(0).max(15),
  work_mode_match: z.number().min(0).max(10),
  salary_match: z.number().min(0).max(5),
});

export const JobFitScoreSchema = z.strictObject({
  ranking_version: z.literal(JOB_SCOUT_RANKING_VERSION),
  posting_id: z.string().trim().min(1).max(180),
  fit_score: z.number().min(0).max(100),
  confidence: z.enum(JOB_SCOUT_CONFIDENCE_LEVELS),
  breakdown: JobFitScoreBreakdownSchema,
  explanation: z.array(z.string().trim().min(1).max(220)),
  matched_skills: z.array(TagSchema),
  missing_skills: z.array(TagSchema),
  metadata_only: z.literal(true),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
});

export const RankedJobPostingSchema = z.strictObject({
  rank: z.number().int().positive(),
  posting: JobPostingSchema,
  score: JobFitScoreSchema,
});

export const JobRankingResultSchema = z.strictObject({
  ranking_version: z.literal(JOB_SCOUT_RANKING_VERSION),
  profile: JobScoutProfileSchema,
  ranked_jobs: z.array(RankedJobPostingSchema),
  governance: z.strictObject({
    suggestion_only: z.literal(true),
    deterministic: z.literal(true),
    pure_scoring: z.literal(true),
    model_call_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    embedding_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    application_submission_attempted: z.literal(false),
    write_attempted: z.literal(false),
  }),
});

export type JobScoutProfile = z.infer<typeof JobScoutProfileSchema>;
export type JobFitScoreBreakdown = z.infer<typeof JobFitScoreBreakdownSchema>;
export type JobFitScore = z.infer<typeof JobFitScoreSchema>;
export type RankedJobPosting = z.infer<typeof RankedJobPostingSchema>;
export type JobRankingResult = z.infer<typeof JobRankingResultSchema>;
export type JobScoutConfidence = (typeof JOB_SCOUT_CONFIDENCE_LEVELS)[number];

export function buildJobFitScore(
  posting: JobPosting,
  profile: JobScoutProfile,
): JobFitScore {
  const parsedPosting = JobPostingSchema.parse(posting);
  const parsedProfile = JobScoutProfileSchema.parse(profile);
  const requiredSkills = parsedPosting.requirements.required_skill_tags;
  const preferredSkills = parsedPosting.requirements.preferred_skill_tags;
  const profileSkills = new Set(parsedProfile.skill_tags);
  const matchedSkills = [...new Set([...requiredSkills, ...preferredSkills])]
    .filter((skill) => profileSkills.has(skill))
    .sort();
  const missingSkills = identifyMissingSkills(parsedPosting, parsedProfile);
  const skillUniverse = [...new Set([...requiredSkills, ...preferredSkills])];
  const skillCoverage =
    skillUniverse.length === 0
      ? 0.6
      : matchedSkills.length / skillUniverse.length;

  const breakdown: JobFitScoreBreakdown = {
    skill_match: roundScore(skillCoverage * 35),
    domain_match: roundScore(domainScore(parsedPosting, parsedProfile) * 20),
    role_level_match: roundScore(
      roleLevelScore(parsedPosting, parsedProfile) * 15,
    ),
    location_match: roundScore(
      locationScore(parsedPosting, parsedProfile) * 15,
    ),
    work_mode_match: roundScore(
      workModeScore(parsedPosting, parsedProfile) * 10,
    ),
    salary_match: roundScore(salaryScore(parsedPosting, parsedProfile) * 5),
  };
  const fitScore = roundScore(
    breakdown.skill_match +
      breakdown.domain_match +
      breakdown.role_level_match +
      breakdown.location_match +
      breakdown.work_mode_match +
      breakdown.salary_match,
  );

  return JobFitScoreSchema.parse({
    ranking_version: JOB_SCOUT_RANKING_VERSION,
    posting_id: parsedPosting.posting_id,
    fit_score: fitScore,
    confidence: confidenceFor(parsedPosting, missingSkills),
    breakdown,
    explanation: explanationFor(parsedPosting, breakdown, missingSkills),
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    metadata_only: true,
    model_call_attempted: false,
    network_call_attempted: false,
  });
}

export function identifyMissingSkills(
  posting: JobPosting,
  profile: JobScoutProfile,
): string[] {
  const parsedPosting = JobPostingSchema.parse(posting);
  const parsedProfile = JobScoutProfileSchema.parse(profile);
  const profileSkills = new Set(parsedProfile.skill_tags);

  return parsedPosting.requirements.required_skill_tags
    .filter((skill) => !profileSkills.has(skill))
    .sort();
}

export function rankJobPostings(
  postings: readonly JobPosting[],
  profile: JobScoutProfile,
): JobRankingResult {
  const parsedProfile = JobScoutProfileSchema.parse(profile);
  const scored = postings.map((posting) => ({
    posting: JobPostingSchema.parse(posting),
    score: buildJobFitScore(posting, parsedProfile),
  }));

  const ranked = scored
    .sort((left, right) => {
      if (right.score.fit_score !== left.score.fit_score) {
        return right.score.fit_score - left.score.fit_score;
      }
      const title = left.posting.title.localeCompare(right.posting.title);
      if (title !== 0) return title;
      const company = left.posting.company.name.localeCompare(
        right.posting.company.name,
      );
      if (company !== 0) return company;
      return left.posting.posting_id.localeCompare(right.posting.posting_id);
    })
    .map((entry, index) => ({
      rank: index + 1,
      posting: entry.posting,
      score: entry.score,
    }));

  return JobRankingResultSchema.parse({
    ranking_version: JOB_SCOUT_RANKING_VERSION,
    profile: parsedProfile,
    ranked_jobs: ranked,
    governance: {
      suggestion_only: jobScoutGovernance().suggestion_only,
      deterministic: true,
      pure_scoring: true,
      model_call_attempted: false,
      provider_call_attempted: false,
      embedding_attempted: false,
      network_call_attempted: false,
      application_submission_attempted: false,
      write_attempted: false,
    },
  });
}

function domainScore(posting: JobPosting, profile: JobScoutProfile): number {
  const tags = new Set([
    ...posting.tags,
    ...posting.requirements.required_skill_tags,
  ]);
  const aiSignals = ["ai", "ml", "machine-learning", "llm", "applied-ai"];
  const securitySignals = ["cybersecurity", "security", "appsec", "soc"];
  const aiScore = aiSignals.some((tag) => tags.has(tag))
    ? profile.ai_ml_interest
    : 0;
  const securityScore = securitySignals.some((tag) => tags.has(tag))
    ? profile.cybersecurity_interest
    : 0;
  const roleTagScore =
    profile.preferred_role_tags.filter((tag) => tags.has(tag)).length /
    Math.max(profile.preferred_role_tags.length, 1);

  return Math.min(1, Math.max(aiScore, securityScore, roleTagScore));
}

function roleLevelScore(posting: JobPosting, profile: JobScoutProfile): number {
  if (posting.role_level === "graduate" || posting.role_level === "junior") {
    return profile.graduate_role_preference;
  }
  if (posting.requirements.graduate_friendly)
    return profile.graduate_role_preference * 0.9;
  if (posting.role_level === "internship")
    return profile.graduate_role_preference * 0.7;
  if (posting.role_level === "unknown") return 0.45;
  return 0.2;
}

function locationScore(posting: JobPosting, profile: JobScoutProfile): number {
  if (profile.preferred_location_types.includes(posting.location_type))
    return 1;
  if (posting.location_type === "global" && profile.remote_preference >= 0.7)
    return 0.8;
  if (posting.location_type === "uk") return profile.uk_preference;
  return 0.25;
}

function workModeScore(posting: JobPosting, profile: JobScoutProfile): number {
  if (profile.preferred_work_modes.includes(posting.work_mode)) return 1;
  if (posting.work_mode === "flexible") return 0.8;
  if (posting.work_mode === "remote") return profile.remote_preference;
  return 0.35;
}

function salaryScore(posting: JobPosting, profile: JobScoutProfile): number {
  if (!posting.salary.disclosed || !posting.salary.max_amount) return 0.5;
  if (!profile.salary_expectation.min_amount) return 0.6;
  return posting.salary.max_amount >= profile.salary_expectation.min_amount
    ? 1
    : 0.35;
}

function confidenceFor(
  posting: JobPosting,
  missingSkills: readonly string[],
): JobScoutConfidence {
  const hasSalary = posting.salary.disclosed;
  const hasPostedAt = Boolean(posting.posted_at);
  const missingRatio =
    posting.requirements.required_skill_tags.length === 0
      ? 0
      : missingSkills.length / posting.requirements.required_skill_tags.length;

  if (hasSalary && hasPostedAt && missingRatio <= 0.25) return "high";
  if (hasPostedAt && missingRatio <= 0.5) return "medium";
  return "low";
}

function explanationFor(
  posting: JobPosting,
  breakdown: JobFitScoreBreakdown,
  missingSkills: readonly string[],
): string[] {
  return [
    `${posting.title} scored ${Math.round(
      breakdown.skill_match,
    )}/35 for explicit skill overlap.`,
    `${posting.location_type} location and ${posting.work_mode} work mode contributed ${Math.round(
      breakdown.location_match + breakdown.work_mode_match,
    )}/25.`,
    missingSkills.length > 0
      ? `Missing required skills: ${missingSkills.join(", ")}.`
      : "No required skill gaps detected from metadata.",
  ];
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
