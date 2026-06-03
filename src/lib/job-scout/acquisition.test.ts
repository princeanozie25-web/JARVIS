import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acquireJobsThroughAdapter,
  buildDefaultJobSourceAcquisitionConfigs,
  evaluateJobSourceAcquisitionConfig,
  importJobFeed,
  type JobFeed,
  type JobSourceAcquisitionConfig,
} from ".";

describe("Job Scout acquisition adapter boundary", () => {
  it("declares supported source configs with acquisition method, rate metadata, access status, and form automation flag", () => {
    const configs = buildDefaultJobSourceAcquisitionConfigs();

    expect(
      configs.map((config) => ({
        source_id: config.source_id,
        method: config.acquisition_method,
        status: config.access_status,
        form_automation_permitted: config.form_automation_permitted,
        remaining: config.rate_limit.remaining_requests,
      })),
    ).toEqual([
      {
        source_id: "source:greenhouse",
        method: "public_api",
        status: "allowed",
        form_automation_permitted: false,
        remaining: 60,
      },
      {
        source_id: "source:lever",
        method: "public_api",
        status: "allowed",
        form_automation_permitted: false,
        remaining: 60,
      },
      {
        source_id: "source:ashby",
        method: "public_api",
        status: "allowed",
        form_automation_permitted: false,
        remaining: 60,
      },
      {
        source_id: "source:workable",
        method: "public_api",
        status: "allowed",
        form_automation_permitted: false,
        remaining: 40,
      },
      {
        source_id: "source:linkedin",
        method: "structured_export",
        status: "tos_disallowed",
        form_automation_permitted: false,
        remaining: 1,
      },
      {
        source_id: "source:otta",
        method: "structured_export",
        status: "disabled",
        form_automation_permitted: false,
        remaining: 1,
      },
      {
        source_id: "source:manual",
        method: "supplied_feed",
        status: "allowed",
        form_automation_permitted: false,
        remaining: 500,
      },
    ]);
  });

  it("blocks disabled and ToS-disallowed configs before adapter invocation", async () => {
    const configs = buildDefaultJobSourceAcquisitionConfigs();
    const blocked = [
      configs.find((config) => config.source_id === "source:linkedin")!,
      configs.find((config) => config.source_id === "source:otta")!,
    ];
    let calls = 0;

    for (const config of blocked) {
      const result = await acquireJobsThroughAdapter({
        config,
        request: request(config.source_id),
        adapter: {
          adapter_id: "job-scout:test-adapter",
          source_id: config.source_id,
          acquisition_method: config.acquisition_method,
          acquire() {
            calls += 1;
            return feed(config.source_id);
          },
        },
      });

      expect(result.evaluation.allowed).toBe(false);
      expect(result.adapter.invoked).toBe(false);
      expect(result.feed).toBeNull();
      expect(result.evaluation.reasons).toContain(
        config.access_status === "disabled"
          ? "source_access_disabled"
          : "source_access_tos_disallowed",
      );
    }

    expect(calls).toBe(0);
  });

  it("enforces source id and rate metadata before acquisition", async () => {
    const base = buildDefaultJobSourceAcquisitionConfigs().find(
      (config) => config.source_id === "source:greenhouse",
    )!;
    const exhausted: JobSourceAcquisitionConfig = {
      ...base,
      rate_limit: {
        ...base.rate_limit,
        observed_requests: base.rate_limit.max_requests,
        remaining_requests: 0,
      },
    };
    const evaluation = evaluateJobSourceAcquisitionConfig({
      config: exhausted,
      request: request("source:lever"),
    });

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reasons).toEqual(
      expect.arrayContaining([
        "source_id_mismatch",
        "rate_limit_exhausted",
        "rate_window_exhausted",
      ]),
    );
    expect(evaluation.governance.rate_limit_enforced).toBe(true);
    expect(evaluation.governance.source_id_enforced).toBe(true);
  });

  it("invokes only a matching injected adapter for allowed source configs", async () => {
    const config = buildDefaultJobSourceAcquisitionConfigs().find(
      (candidate) => candidate.source_id === "source:greenhouse",
    )!;
    let calls = 0;

    const result = await acquireJobsThroughAdapter({
      acquisition_id: "job-scout:acquisition:test",
      config,
      request: request(config.source_id),
      adapter: {
        adapter_id: "job-scout:test-greenhouse-adapter",
        source_id: config.source_id,
        acquisition_method: config.acquisition_method,
        acquire() {
          calls += 1;
          return feed(config.source_id);
        },
      },
    });

    expect(calls).toBe(1);
    expect(result.acquisition_id).toBe("job-scout:acquisition:test");
    expect(result.evaluation.allowed).toBe(true);
    expect(result.adapter.invoked).toBe(true);
    expect(result.adapter.fake_or_injected_adapter).toBe(true);
    expect(result.feed?.source.source_id).toBe(config.source_id);
    expect(result.telemetry).toMatchObject({
      metadata_only: true,
      source_id: config.source_id,
      rate_limit_remaining: 60,
      credentials_included: false,
      raw_source_payload_included: false,
      network_call_attempted_by_boundary: false,
    });
  });

  it("keeps acquisition boundary free of direct network, browser, provider, write, and credential telemetry paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/acquisition.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(/autoApply|sendEmail|writeFile/i);
    expect(source).not.toMatch(/raw_source_payload_logged:\s*true/i);
    expect(source).not.toMatch(/credentials_(included|used):\s*true/i);
  });
});

function request(sourceId: string) {
  return {
    request_id: `job-scout:acquisition-request:${sourceId}`,
    source_id: sourceId,
    requested_at: "2026-06-03T08:30:00.000Z",
    expected_record_limit: 25,
    metadata_only: true,
  } as const;
}

function feed(sourceId: string): JobFeed {
  return importJobFeed({
    feed_version: "phase21i.job-scout-feed-layer.v1",
    feed_id: "feed:greenhouse_export",
    imported_at: "2026-06-03T08:31:00.000Z",
    source: {
      source_id: sourceId,
      source_type: "greenhouse",
      import_format: "greenhouse_export",
      display_name: "Greenhouse",
      base_url: "https://boards.greenhouse.io",
    },
    records: [
      {
        record_id: "record-1",
        title: "Graduate AI Security Engineer",
        company_name: "Sentinel AI Labs",
        company_domain: "sentinel.example",
        location_label: "London, UK",
        location_type: "uk",
        work_mode: "hybrid",
        role_level: "graduate",
        salary_currency: "GBP",
        salary_min_amount: 38000,
        salary_max_amount: 45000,
        salary_period: "year",
        salary_disclosed: true,
        url: "https://boards.greenhouse.io/sentinel/jobs/graduate-ai-security",
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
}
