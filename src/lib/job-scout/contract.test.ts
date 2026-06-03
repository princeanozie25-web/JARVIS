import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_SOURCE_TYPES,
  JobPostingSchema,
  buildFixtureJobPostings,
  createJobSource,
  jobScoutGovernance,
} from ".";

describe("Job Scout source contract", () => {
  it("supports all declared source types without live integrations", () => {
    const sources = JOB_SOURCE_TYPES.map((sourceType) =>
      createJobSource({
        source_id: `source:${sourceType}`,
        source_type: sourceType,
        display_name: sourceType,
        base_url: "https://jobs.example.test",
        live_integration_supported: false,
        scraping_supported: false,
        api_call_supported: false,
      }),
    );

    expect(sources.map((source) => source.source_type)).toEqual([
      "linkedin",
      "greenhouse",
      "lever",
      "ashby",
      "workable",
      "otta",
      "manual",
    ]);
    expect(sources.every((source) => !source.scraping_supported)).toBe(true);
    expect(sources.every((source) => !source.api_call_supported)).toBe(true);
  });

  it("validates job posting structure and metadata-only posture", () => {
    const posting = buildFixtureJobPostings()[0];
    const parsed = JobPostingSchema.parse(posting);

    expect(parsed.title).toBe("Graduate Applied AI Security Engineer");
    expect(parsed.company.name).toBe("Sentinel AI Labs");
    expect(parsed.location_type).toBe("uk");
    expect(parsed.work_mode).toBe("hybrid");
    expect(parsed.requirements.required_skill_tags).toEqual([
      "python",
      "security",
      "ai",
    ]);
    expect(parsed.metadata.metadata_only).toBe(true);
    expect(parsed.metadata.raw_description_included).toBe(false);
    expect(parsed.metadata.application_submission_supported).toBe(false);
  });

  it("builds deterministic fixture postings", () => {
    expect(buildFixtureJobPostings()).toEqual(buildFixtureJobPostings());
    expect(
      buildFixtureJobPostings().map((posting) => posting.posting_id),
    ).toEqual([
      "job:applied-ai-security-graduate",
      "job:ml-infra-junior",
      "job:senior-frontend-onsite",
    ]);
  });

  it("declares no scraping, submission, provider, network, or write authority", () => {
    const governance = jobScoutGovernance();

    expect(governance.suggestion_only).toBe(true);
    expect(governance.scraping_supported).toBe(false);
    expect(governance.playwright_supported).toBe(false);
    expect(governance.browser_automation_supported).toBe(false);
    expect(governance.application_submission_supported).toBe(false);
    expect(governance.external_api_call_supported).toBe(false);
    expect(governance.provider_call_supported).toBe(false);
    expect(governance.model_call_supported).toBe(false);
    expect(governance.network_call_supported).toBe(false);
    expect(governance.filesystem_write_supported).toBe(false);
    expect(governance.database_write_supported).toBe(false);
    expect(governance.scheduler_supported).toBe(false);
    expect(governance.approval_execution_supported).toBe(false);
  });

  it("keeps contract source free of live integration imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/contract.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(
      /submitApplication|autoApply|sendEmail|writeFile/,
    );
  });
});
