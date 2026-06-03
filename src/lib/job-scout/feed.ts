import { z } from "zod";
import {
  JOB_SOURCE_TYPES,
  JobLocationTypeSchema,
  JobRoleLevelSchema,
  JobSourceTypeSchema,
  JobWorkModeSchema,
} from "./contract";

export const JOB_SCOUT_FEED_VERSION =
  "phase21i.job-scout-feed-layer.v1" as const;

export const JOB_FEED_IMPORT_FORMATS = [
  "linkedin_export",
  "greenhouse_export",
  "lever_export",
  "ashby_export",
  "workable_export",
  "otta_export",
  "manual_json",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(500);
const BoundedIdSchema = z.string().trim().min(1).max(180);
const UrlSchema = z.string().trim().url().max(1000);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const TagSchema = z.string().trim().min(1).max(80).toLowerCase();

export const JobFeedImportFormatSchema = z.enum(JOB_FEED_IMPORT_FORMATS);

export const JobFeedSourceSchema = z.strictObject({
  source_id: BoundedIdSchema,
  source_type: JobSourceTypeSchema,
  import_format: JobFeedImportFormatSchema,
  display_name: BoundedTextSchema,
  base_url: UrlSchema.nullable().default(null),
});

export const JobFeedRecordSchema = z.strictObject({
  record_id: BoundedIdSchema,
  title: BoundedTextSchema,
  company_name: BoundedTextSchema,
  company_domain: z.string().trim().min(1).max(180).nullable().default(null),
  location_label: BoundedTextSchema,
  location_type: JobLocationTypeSchema.default("unknown"),
  work_mode: JobWorkModeSchema.default("unknown"),
  role_level: JobRoleLevelSchema.default("unknown"),
  salary_currency: z.enum(["GBP", "EUR", "USD", "unknown"]).default("unknown"),
  salary_min_amount: z.number().int().nonnegative().nullable().default(null),
  salary_max_amount: z.number().int().nonnegative().nullable().default(null),
  salary_period: z
    .enum(["year", "month", "hour", "unknown"])
    .default("unknown"),
  salary_disclosed: z.boolean().default(false),
  url: UrlSchema,
  tags: z.array(TagSchema).default([]),
  posted_at: IsoDateTimeSchema.nullable().default(null),
  required_skill_tags: z.array(TagSchema).default([]),
  preferred_skill_tags: z.array(TagSchema).default([]),
  years_experience_min: z.number().int().nonnegative().nullable().default(null),
  degree_required: z.boolean().nullable().default(null),
  sponsorship_available: z.boolean().nullable().default(null),
  graduate_friendly: z.boolean().nullable().default(null),
  metadata_only: z.literal(true),
  raw_description_included: z.literal(false),
});

export const JobFeedMetadataSchema = z.strictObject({
  supplied_as_input: z.literal(true),
  record_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  scraping_attempted: z.literal(false),
  playwright_attempted: z.literal(false),
  browser_automation_attempted: z.literal(false),
  external_api_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  filesystem_write_attempted: z.literal(false),
  database_write_attempted: z.literal(false),
});

export const JobFeedSchema = z.strictObject({
  feed_version: z.literal(JOB_SCOUT_FEED_VERSION),
  feed_id: BoundedIdSchema,
  imported_at: IsoDateTimeSchema,
  source: JobFeedSourceSchema,
  records: z.array(JobFeedRecordSchema),
  metadata: JobFeedMetadataSchema,
});

export const JobFeedValidationResultSchema = z.strictObject({
  accepted: z.boolean(),
  feed_id: BoundedIdSchema,
  source_type: JobSourceTypeSchema,
  import_format: JobFeedImportFormatSchema,
  record_count: z.number().int().nonnegative(),
  reasons: z.array(z.string().trim().min(1).max(180)),
  warnings: z.array(z.string().trim().min(1).max(180)),
  metadata_only: z.literal(true),
  network_call_attempted: z.literal(false),
});

export const JobFeedSummarySchema = z.strictObject({
  feed_id: BoundedIdSchema,
  source_type: JobSourceTypeSchema,
  import_format: JobFeedImportFormatSchema,
  record_count: z.number().int().nonnegative(),
  unique_company_count: z.number().int().nonnegative(),
  work_modes: z.array(JobWorkModeSchema),
  location_types: z.array(JobLocationTypeSchema),
  tag_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export type JobFeedImportFormat = z.infer<typeof JobFeedImportFormatSchema>;
export type JobFeedSource = z.infer<typeof JobFeedSourceSchema>;
export type JobFeedRecord = z.infer<typeof JobFeedRecordSchema>;
export type JobFeedMetadata = z.infer<typeof JobFeedMetadataSchema>;
export type JobFeed = z.infer<typeof JobFeedSchema>;
export type JobFeedValidationResult = z.infer<
  typeof JobFeedValidationResultSchema
>;
export type JobFeedSummary = z.infer<typeof JobFeedSummarySchema>;

export function importJobFeed(input: z.input<typeof JobFeedSchema>): JobFeed {
  const parsed = JobFeedSchema.parse({
    ...input,
    metadata: {
      ...input.metadata,
      record_count: input.records.length,
      supplied_as_input: true,
      metadata_only: true,
      scraping_attempted: false,
      playwright_attempted: false,
      browser_automation_attempted: false,
      external_api_call_attempted: false,
      network_call_attempted: false,
      provider_call_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
    },
  });

  return parsed;
}

export function validateJobFeed(feed: JobFeed): JobFeedValidationResult {
  const parsed = JobFeedSchema.parse(feed);
  const expectedSource = sourceTypeForImportFormat(parsed.source.import_format);
  const sourceMatches =
    expectedSource === "manual" || expectedSource === parsed.source.source_type;
  const accepted = parsed.records.length > 0 && sourceMatches;

  return JobFeedValidationResultSchema.parse({
    accepted,
    feed_id: parsed.feed_id,
    source_type: parsed.source.source_type,
    import_format: parsed.source.import_format,
    record_count: parsed.records.length,
    reasons: [
      ...(parsed.records.length > 0 ? ["records_present"] : ["feed_empty"]),
      ...(sourceMatches
        ? ["source_format_matches"]
        : ["source_format_mismatch"]),
    ],
    warnings: parsed.records.some(
      (record) => record.location_type === "unknown",
    )
      ? ["some_locations_unknown"]
      : [],
    metadata_only: true,
    network_call_attempted: false,
  });
}

export function summarizeJobFeed(feed: JobFeed): JobFeedSummary {
  const parsed = JobFeedSchema.parse(feed);
  const companies = new Set(
    parsed.records.map((record) => record.company_name),
  );
  const workModes = sortedUnique(
    parsed.records.map((record) => record.work_mode),
  );
  const locationTypes = sortedUnique(
    parsed.records.map((record) => record.location_type),
  );
  const tags = new Set(parsed.records.flatMap((record) => record.tags));

  return JobFeedSummarySchema.parse({
    feed_id: parsed.feed_id,
    source_type: parsed.source.source_type,
    import_format: parsed.source.import_format,
    record_count: parsed.records.length,
    unique_company_count: companies.size,
    work_modes: workModes,
    location_types: locationTypes,
    tag_count: tags.size,
    metadata_only: true,
  });
}

function sourceTypeForImportFormat(
  format: JobFeedImportFormat,
): (typeof JOB_SOURCE_TYPES)[number] {
  switch (format) {
    case "linkedin_export":
      return "linkedin";
    case "greenhouse_export":
      return "greenhouse";
    case "lever_export":
      return "lever";
    case "ashby_export":
      return "ashby";
    case "workable_export":
      return "workable";
    case "otta_export":
      return "otta";
    case "manual_json":
      return "manual";
  }
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}
