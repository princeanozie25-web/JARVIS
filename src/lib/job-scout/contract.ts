import { z } from "zod";

export const JOB_SCOUT_CONTRACT_VERSION =
  "phase21i.job-scout-source-contract.v1" as const;

export const JOB_SOURCE_TYPES = [
  "linkedin",
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "otta",
  "manual",
] as const;

export const JOB_LOCATION_TYPES = [
  "uk",
  "europe",
  "us",
  "global",
  "unknown",
] as const;

export const JOB_WORK_MODES = [
  "remote",
  "hybrid",
  "onsite",
  "flexible",
  "unknown",
] as const;

export const JOB_ROLE_LEVELS = [
  "internship",
  "graduate",
  "junior",
  "mid",
  "senior",
  "unknown",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(500);
const BoundedIdSchema = z.string().trim().min(1).max(180);
const UrlSchema = z.string().trim().url().max(1000);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const TagSchema = z.string().trim().min(1).max(80).toLowerCase();

export const JobSourceTypeSchema = z.enum(JOB_SOURCE_TYPES);
export const JobLocationTypeSchema = z.enum(JOB_LOCATION_TYPES);
export const JobWorkModeSchema = z.enum(JOB_WORK_MODES);
export const JobRoleLevelSchema = z.enum(JOB_ROLE_LEVELS);

export const JobPostingIdSchema = BoundedIdSchema.brand<"JobPostingId">();

export const JobSourceSchema = z.strictObject({
  source_id: BoundedIdSchema,
  source_type: JobSourceTypeSchema,
  display_name: BoundedTextSchema,
  base_url: UrlSchema.nullable().default(null),
  live_integration_supported: z.literal(false),
  scraping_supported: z.literal(false),
  api_call_supported: z.literal(false),
});

export const JobCompanySchema = z.strictObject({
  company_id: BoundedIdSchema,
  name: BoundedTextSchema,
  domain: z.string().trim().min(1).max(180).nullable().default(null),
  size_band: z
    .enum(["startup", "scaleup", "enterprise", "unknown"])
    .default("unknown"),
});

export const JobSalaryBandSchema = z.strictObject({
  currency: z.enum(["GBP", "EUR", "USD", "unknown"]).default("unknown"),
  min_amount: z.number().int().nonnegative().nullable().default(null),
  max_amount: z.number().int().nonnegative().nullable().default(null),
  period: z.enum(["year", "month", "hour", "unknown"]).default("unknown"),
  disclosed: z.boolean().default(false),
});

export const JobRequirementsSchema = z.strictObject({
  required_skill_tags: z.array(TagSchema).default([]),
  preferred_skill_tags: z.array(TagSchema).default([]),
  years_experience_min: z.number().int().nonnegative().nullable().default(null),
  degree_required: z.boolean().nullable().default(null),
  sponsorship_available: z.boolean().nullable().default(null),
  graduate_friendly: z.boolean().nullable().default(null),
});

export const JobPostingMetadataSchema = z.strictObject({
  metadata_only: z.literal(true),
  raw_description_included: z.literal(false),
  application_submission_supported: z.literal(false),
  scraping_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  automation_attempted: z.literal(false),
});

export const JobPostingSchema = z.strictObject({
  posting_id: JobPostingIdSchema,
  title: BoundedTextSchema,
  company: JobCompanySchema,
  location_label: BoundedTextSchema,
  location_type: JobLocationTypeSchema,
  work_mode: JobWorkModeSchema,
  role_level: JobRoleLevelSchema,
  salary: JobSalaryBandSchema,
  source: JobSourceSchema,
  url: UrlSchema,
  tags: z.array(TagSchema).default([]),
  posted_at: IsoDateTimeSchema.nullable().default(null),
  requirements: JobRequirementsSchema,
  metadata: JobPostingMetadataSchema,
});

export const JobScoutGovernanceSchema = z.strictObject({
  suggestion_only: z.literal(true),
  deterministic: z.literal(true),
  fixture_input_only: z.literal(true),
  scraping_supported: z.literal(false),
  playwright_supported: z.literal(false),
  browser_automation_supported: z.literal(false),
  application_submission_supported: z.literal(false),
  external_api_call_supported: z.literal(false),
  provider_call_supported: z.literal(false),
  model_call_supported: z.literal(false),
  embedding_supported: z.literal(false),
  network_call_supported: z.literal(false),
  filesystem_write_supported: z.literal(false),
  database_write_supported: z.literal(false),
  scheduler_supported: z.literal(false),
  approval_execution_supported: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export type JobSourceType = z.infer<typeof JobSourceTypeSchema>;
export type JobLocationType = z.infer<typeof JobLocationTypeSchema>;
export type JobWorkMode = z.infer<typeof JobWorkModeSchema>;
export type JobRoleLevel = z.infer<typeof JobRoleLevelSchema>;
export type JobPostingId = z.infer<typeof JobPostingIdSchema>;
export type JobSource = z.infer<typeof JobSourceSchema>;
export type JobCompany = z.infer<typeof JobCompanySchema>;
export type JobSalaryBand = z.infer<typeof JobSalaryBandSchema>;
export type JobRequirements = z.infer<typeof JobRequirementsSchema>;
export type JobPostingMetadata = z.infer<typeof JobPostingMetadataSchema>;
export type JobPosting = z.infer<typeof JobPostingSchema>;
export type JobScoutGovernance = z.infer<typeof JobScoutGovernanceSchema>;

export function createJobSource(
  input: z.input<typeof JobSourceSchema>,
): JobSource {
  return JobSourceSchema.parse(input);
}

export function createJobPosting(
  input: z.input<typeof JobPostingSchema>,
): JobPosting {
  return JobPostingSchema.parse(input);
}

export function jobScoutGovernance(): JobScoutGovernance {
  return JobScoutGovernanceSchema.parse({
    suggestion_only: true,
    deterministic: true,
    fixture_input_only: true,
    scraping_supported: false,
    playwright_supported: false,
    browser_automation_supported: false,
    application_submission_supported: false,
    external_api_call_supported: false,
    provider_call_supported: false,
    model_call_supported: false,
    embedding_supported: false,
    network_call_supported: false,
    filesystem_write_supported: false,
    database_write_supported: false,
    scheduler_supported: false,
    approval_execution_supported: false,
    new_authority_surface_added: false,
  });
}
