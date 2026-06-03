import { z } from "zod";
import {
  JobLocationTypeSchema,
  JobPostingSchema,
  JobRoleLevelSchema,
  JobSourceSchema,
  JobWorkModeSchema,
  createJobPosting,
  createJobSource,
  type JobLocationType,
  type JobPosting,
  type JobRoleLevel,
  type JobSource,
  type JobWorkMode,
} from "./contract";
import {
  JobFeedRecordSchema,
  JobFeedSchema,
  type JobFeed,
  type JobFeedRecord,
} from "./feed";

export const JOB_SCOUT_NORMALIZATION_VERSION =
  "phase21i.job-scout-feed-normalization.v1" as const;

export const JobFeedNormalizationResultSchema = z.strictObject({
  normalization_version: z.literal(JOB_SCOUT_NORMALIZATION_VERSION),
  feed_id: z.string().trim().min(1).max(180),
  source: JobSourceSchema,
  input_record_count: z.number().int().nonnegative(),
  normalized_count: z.number().int().nonnegative(),
  duplicate_count: z.number().int().nonnegative(),
  postings: z.array(JobPostingSchema),
  metadata_only: z.literal(true),
  deterministic: z.literal(true),
  network_call_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  filesystem_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
  submission_attempted: z.literal(false),
});

export type JobFeedNormalizationResult = z.infer<
  typeof JobFeedNormalizationResultSchema
>;

export function normalizeJobFeed(feed: JobFeed): JobFeedNormalizationResult {
  const parsed = JobFeedSchema.parse(feed);
  const source = sourceForFeed(parsed);
  const normalized = parsed.records.map((record) =>
    normalizeJobRecord(record, source),
  );
  const deduplicated = deduplicateJobPostings(normalized);

  return JobFeedNormalizationResultSchema.parse({
    normalization_version: JOB_SCOUT_NORMALIZATION_VERSION,
    feed_id: parsed.feed_id,
    source,
    input_record_count: parsed.records.length,
    normalized_count: deduplicated.length,
    duplicate_count: parsed.records.length - deduplicated.length,
    postings: deduplicated,
    metadata_only: true,
    deterministic: true,
    network_call_attempted: false,
    provider_call_attempted: false,
    filesystem_write_attempted: false,
    database_write_attempted: false,
    submission_attempted: false,
  });
}

export function normalizeJobRecord(
  record: JobFeedRecord,
  source: JobSource,
): JobPosting {
  const parsedRecord = JobFeedRecordSchema.parse(record);
  const parsedSource = JobSourceSchema.parse(source);
  const locationType = inferLocationType(
    parsedRecord.location_label,
    parsedRecord.location_type,
  );
  const workMode = inferWorkMode(
    parsedRecord.location_label,
    parsedRecord.work_mode,
  );
  const roleLevel = inferRoleLevel(parsedRecord.title, parsedRecord.role_level);
  const tags = sortedUnique([
    ...parsedRecord.tags,
    ...parsedRecord.required_skill_tags,
    ...parsedRecord.preferred_skill_tags,
  ]);

  return createJobPosting({
    posting_id: stablePostingId(parsedSource.source_type, parsedRecord),
    title: parsedRecord.title,
    company: {
      company_id: `company:${slug(parsedRecord.company_name)}`,
      name: parsedRecord.company_name,
      domain: parsedRecord.company_domain,
      size_band: "unknown",
    },
    location_label: parsedRecord.location_label,
    location_type: locationType,
    work_mode: workMode,
    role_level: roleLevel,
    salary: {
      currency: parsedRecord.salary_currency,
      min_amount: parsedRecord.salary_min_amount,
      max_amount: parsedRecord.salary_max_amount,
      period: parsedRecord.salary_period,
      disclosed: parsedRecord.salary_disclosed,
    },
    source: parsedSource,
    url: parsedRecord.url,
    tags,
    posted_at: parsedRecord.posted_at,
    requirements: {
      required_skill_tags: parsedRecord.required_skill_tags,
      preferred_skill_tags: parsedRecord.preferred_skill_tags,
      years_experience_min: parsedRecord.years_experience_min,
      degree_required: parsedRecord.degree_required,
      sponsorship_available: parsedRecord.sponsorship_available,
      graduate_friendly: parsedRecord.graduate_friendly,
    },
    metadata: {
      metadata_only: true,
      raw_description_included: parsedRecord.raw_description_included,
      application_submission_supported: false,
      scraping_attempted: false,
      network_call_attempted: false,
      provider_call_attempted: false,
      automation_attempted: false,
    },
  });
}

export function deduplicateJobPostings(
  postings: readonly JobPosting[],
): JobPosting[] {
  const seen = new Set<string>();
  const output: JobPosting[] = [];

  for (const posting of postings.map((candidate) =>
    JobPostingSchema.parse(candidate),
  )) {
    const key = dedupeKey(posting);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(posting);
  }

  return output.sort((left, right) =>
    left.posting_id.localeCompare(right.posting_id),
  );
}

function sourceForFeed(feed: JobFeed): JobSource {
  return createJobSource({
    source_id: feed.source.source_id,
    source_type: feed.source.source_type,
    display_name: feed.source.display_name,
    base_url: feed.source.base_url,
    live_integration_supported: false,
    scraping_supported: false,
    api_call_supported: false,
  });
}

function stablePostingId(sourceType: string, record: JobFeedRecord): string {
  return `job:${sourceType}:${slug(
    `${record.record_id}-${record.company_name}-${record.title}`,
  )}`;
}

function dedupeKey(posting: JobPosting): string {
  return `${posting.url.toLowerCase()}|${posting.company.name.toLowerCase()}|${posting.title.toLowerCase()}`;
}

function inferLocationType(
  locationLabel: string,
  supplied: JobLocationType,
): JobLocationType {
  if (supplied !== "unknown") return JobLocationTypeSchema.parse(supplied);
  const lower = locationLabel.toLowerCase();
  if (/\buk\b|london|manchester|edinburgh|birmingham/.test(lower)) return "uk";
  if (/europe|eu\b|berlin|paris|amsterdam/.test(lower)) return "europe";
  if (/\bus\b|united states|new york|san francisco/.test(lower)) return "us";
  if (/global|worldwide/.test(lower)) return "global";
  return "unknown";
}

function inferWorkMode(
  locationLabel: string,
  supplied: JobWorkMode,
): JobWorkMode {
  if (supplied !== "unknown") return JobWorkModeSchema.parse(supplied);
  const lower = locationLabel.toLowerCase();
  if (/remote/.test(lower)) return "remote";
  if (/hybrid/.test(lower)) return "hybrid";
  if (/onsite|on-site|office/.test(lower)) return "onsite";
  if (/flexible/.test(lower)) return "flexible";
  return "unknown";
}

function inferRoleLevel(title: string, supplied: JobRoleLevel): JobRoleLevel {
  if (supplied !== "unknown") return JobRoleLevelSchema.parse(supplied);
  const lower = title.toLowerCase();
  if (/intern/.test(lower)) return "internship";
  if (/graduate|new grad/.test(lower)) return "graduate";
  if (/junior|associate/.test(lower)) return "junior";
  if (/senior|staff|principal|lead/.test(lower)) return "senior";
  return "unknown";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
