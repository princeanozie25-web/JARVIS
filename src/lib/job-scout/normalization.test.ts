import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_FEED_IMPORT_FORMATS,
  deduplicateJobPostings,
  importJobFeed,
  normalizeJobFeed,
  normalizeJobRecord,
  type JobFeed,
  type JobFeedImportFormat,
} from ".";

describe("Job Scout feed normalization", () => {
  it("normalizes every supported feed format into JobPosting contracts", () => {
    const results = JOB_FEED_IMPORT_FORMATS.map((format) =>
      normalizeJobFeed(importJobFeed(feedInput(format))),
    );

    expect(results.map((result) => result.source.source_type)).toEqual([
      "linkedin",
      "greenhouse",
      "lever",
      "ashby",
      "workable",
      "otta",
      "manual",
    ]);
    for (const result of results) {
      expect(result.normalized_count).toBe(2);
      expect(result.duplicate_count).toBe(0);
      expect(result.metadata_only).toBe(true);
      expect(result.network_call_attempted).toBe(false);
      expect(result.filesystem_write_attempted).toBe(false);
      expect(result.database_write_attempted).toBe(false);
      expect(result.submission_attempted).toBe(false);
      expect(result.postings[0].source.source_type).toBe(
        result.source.source_type,
      );
    }
  });

  it("generates stable IDs and deterministic output", () => {
    const feed = importJobFeed(feedInput("greenhouse_export"));
    const result = normalizeJobFeed(feed);

    expect(result).toEqual(normalizeJobFeed(feed));
    expect(result.postings.map((posting) => posting.posting_id)).toEqual([
      "job:greenhouse:record-1-sentinel-ai-labs-graduate-ai-security-engineer",
      "job:greenhouse:record-2-vectorworks-systems-junior-ml-infrastructure-engineer",
    ]);
  });

  it("infers missing location, work mode, and role level from feed metadata", () => {
    const feed = importJobFeed(feedInput("manual_json"));
    const source = normalizeJobFeed(feed).source;
    const inferred = normalizeJobRecord(
      {
        ...feed.records[0],
        location_type: "unknown",
        work_mode: "unknown",
        role_level: "unknown",
        location_label: "Remote UK",
      },
      source,
    );

    expect(inferred.location_type).toBe("uk");
    expect(inferred.work_mode).toBe("remote");
    expect(inferred.role_level).toBe("graduate");
  });

  it("removes duplicate postings by URL/title/company while preserving first source metadata", () => {
    const feed = importJobFeed({
      ...feedInput("lever_export"),
      records: [
        ...feedInput("lever_export").records,
        {
          ...feedInput("lever_export").records[0],
          record_id: "record-duplicate",
        },
      ],
    });

    const result = normalizeJobFeed(feed);

    expect(result.input_record_count).toBe(3);
    expect(result.normalized_count).toBe(2);
    expect(result.duplicate_count).toBe(1);
    expect(result.postings[0].source.source_type).toBe("lever");
  });

  it("deduplicates deterministic posting arrays", () => {
    const result = normalizeJobFeed(importJobFeed(feedInput("ashby_export")));
    const duplicated = deduplicateJobPostings([
      result.postings[0],
      result.postings[0],
      result.postings[1],
    ]);

    expect(duplicated.map((posting) => posting.posting_id)).toEqual(
      result.postings.map((posting) => posting.posting_id),
    );
  });

  it("keeps normalization source free of network, provider, automation, write, and submission paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/normalization.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(
      /submitApplication|autoApply|sendEmail|writeFile|executeApproval/i,
    );
  });
});

function feedInput(format: JobFeedImportFormat): JobFeed {
  const sourceType = sourceTypeFor(format);
  const feed = importJobFeed({
    feed_version: "phase21i.job-scout-feed-layer.v1",
    feed_id: `feed:${format}`,
    imported_at: "2026-06-03T08:00:00.000Z",
    source: {
      source_id: `source:${sourceType}`,
      source_type: sourceType,
      import_format: format,
      display_name: sourceType,
      base_url: `https://${sourceType}.example.test`,
    },
    records: [
      {
        record_id: "record-1",
        title: "Graduate AI Security Engineer",
        company_name: "Sentinel AI Labs",
        company_domain: "sentinel.example",
        location_label: "London, UK hybrid",
        location_type: "uk",
        work_mode: "hybrid",
        role_level: "graduate",
        salary_currency: "GBP",
        salary_min_amount: 38000,
        salary_max_amount: 45000,
        salary_period: "year",
        salary_disclosed: true,
        url: "https://jobs.example.test/sentinel/graduate-ai-security",
        tags: ["ai", "security"],
        posted_at: "2026-06-01T09:00:00.000Z",
        required_skill_tags: ["python", "security"],
        preferred_skill_tags: ["llm"],
        years_experience_min: 0,
        degree_required: false,
        sponsorship_available: null,
        graduate_friendly: true,
        metadata_only: true,
        raw_description_included: false,
      },
      {
        record_id: "record-2",
        title: "Junior ML Infrastructure Engineer",
        company_name: "VectorWorks Systems",
        company_domain: "vectorworks.example",
        location_label: "Remote UK",
        location_type: "uk",
        work_mode: "remote",
        role_level: "junior",
        salary_currency: "GBP",
        salary_min_amount: 35000,
        salary_max_amount: 42000,
        salary_period: "year",
        salary_disclosed: true,
        url: "https://jobs.example.test/vectorworks/ml-infra",
        tags: ["ml", "cloud"],
        posted_at: "2026-05-30T09:00:00.000Z",
        required_skill_tags: ["python", "cloud"],
        preferred_skill_tags: ["kubernetes"],
        years_experience_min: 1,
        degree_required: false,
        sponsorship_available: null,
        graduate_friendly: true,
        metadata_only: true,
        raw_description_included: false,
      },
    ],
    metadata: {
      supplied_as_input: true,
      record_count: 0,
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
  return feed;
}

function sourceTypeFor(format: JobFeedImportFormat) {
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
