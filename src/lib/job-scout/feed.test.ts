import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_FEED_IMPORT_FORMATS,
  importJobFeed,
  summarizeJobFeed,
  validateJobFeed,
  type JobFeedImportFormat,
  type JobSourceType,
} from ".";

describe("Job Scout feed layer", () => {
  it("represents every supported supplied feed format", () => {
    expect(JOB_FEED_IMPORT_FORMATS).toEqual([
      "linkedin_export",
      "greenhouse_export",
      "lever_export",
      "ashby_export",
      "workable_export",
      "otta_export",
      "manual_json",
    ]);
  });

  it("imports supplied feed data without live integration attempts", () => {
    const feed = importJobFeed(feedInput("greenhouse_export"));

    expect(feed.feed_id).toBe("feed:greenhouse_export");
    expect(feed.records).toHaveLength(2);
    expect(feed.metadata.record_count).toBe(2);
    expect(feed.metadata.supplied_as_input).toBe(true);
    expect(feed.metadata.scraping_attempted).toBe(false);
    expect(feed.metadata.network_call_attempted).toBe(false);
    expect(feed.metadata.filesystem_write_attempted).toBe(false);
    expect(feed.metadata.database_write_attempted).toBe(false);
  });

  it("validates feed source and format compatibility", () => {
    const feed = importJobFeed(feedInput("lever_export"));
    const result = validateJobFeed(feed);

    expect(result.accepted).toBe(true);
    expect(result.source_type).toBe("lever");
    expect(result.import_format).toBe("lever_export");
    expect(result.reasons).toEqual([
      "records_present",
      "source_format_matches",
    ]);
    expect(result.network_call_attempted).toBe(false);
  });

  it("summarizes feed metadata deterministically", () => {
    const feed = importJobFeed(feedInput("manual_json"));

    expect(summarizeJobFeed(feed)).toEqual(summarizeJobFeed(feed));
    expect(summarizeJobFeed(feed)).toMatchObject({
      feed_id: "feed:manual_json",
      source_type: "manual",
      import_format: "manual_json",
      record_count: 2,
      unique_company_count: 2,
      work_modes: ["hybrid", "remote"],
      location_types: ["uk"],
      tag_count: 4,
      metadata_only: true,
    });
  });

  it("keeps feed source free of network, browser, provider, and write imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/feed.ts"),
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

export function feedInput(
  format: JobFeedImportFormat,
): Parameters<typeof importJobFeed>[0] {
  const sourceType = sourceTypeFor(format);

  return {
    feed_version: "phase21i.job-scout-feed-layer.v1" as const,
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
  };
}

function sourceTypeFor(format: JobFeedImportFormat): JobSourceType {
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
