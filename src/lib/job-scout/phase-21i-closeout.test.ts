import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION,
  buildJobScoutFoundationCloseoutReport,
} from ".";

describe("Job Scout foundation closeout", () => {
  it("verifies every Job Scout foundation component", () => {
    const report = buildJobScoutFoundationCloseoutReport();

    expect(report.closeout_version).toBe(JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION);
    expect(report.title).toBe("Job Scout foundation complete");
    expect(report.status).toBe("foundation_complete");
    expect(
      report.components.map((component) => component.component_id),
    ).toEqual([
      "job-scout-source-contract",
      "job-scout-feed-layer",
      "job-scout-feed-normalization",
      "job-scout-ranking-engine",
      "job-scout-digest-generator",
      "job-scout-suggestion-payload",
      "job-scout-morning-brief-contract",
    ]);
    expect(report.components.every((component) => component.present)).toBe(
      true,
    );
  });

  it("covers source, feed, normalization, ranking, digest, suggestion, and Morning Brief capabilities", () => {
    const report = buildJobScoutFoundationCloseoutReport();

    expect(report.completed_capabilities).toEqual([
      "source_contracts",
      "feed_ingestion_from_supplied_data",
      "feed_validation_and_summary",
      "feed_normalization_to_job_postings",
      "deterministic_deduplication",
      "ranking_and_fit_scoring",
      "missing_skill_detection",
      "digest_generation",
      "suggestion_payloads",
      "morning_brief_optional_section_contract",
    ]);
    expect(report.future_capabilities).toContain("scraping");
    expect(report.future_capabilities).toContain("application_submission");
    expect(report.future_capabilities).toContain("auto_apply");
  });

  it("proves prohibited capabilities remain absent", () => {
    const governance = buildJobScoutFoundationCloseoutReport().governance;

    expect(governance.status).toBe("job_scout_foundation_complete");
    expect(governance.suggestion_only).toBe(true);
    expect(governance.feed_input_only).toBe(true);
    expect(governance.scraping_supported).toBe(false);
    expect(governance.playwright_supported).toBe(false);
    expect(governance.browser_automation_supported).toBe(false);
    expect(governance.application_submission_supported).toBe(false);
    expect(governance.provider_call_supported).toBe(false);
    expect(governance.model_call_supported).toBe(false);
    expect(governance.deepseek_call_supported).toBe(false);
    expect(governance.embedding_supported).toBe(false);
    expect(governance.network_call_supported).toBe(false);
    expect(governance.filesystem_write_supported).toBe(false);
    expect(governance.database_write_supported).toBe(false);
    expect(governance.scheduler_execution_supported).toBe(false);
    expect(governance.approval_execution_supported).toBe(false);
    expect(governance.auto_apply_supported).toBe(false);
    expect(governance.auto_send_supported).toBe(false);
    expect(governance.new_authority_surface_added).toBe(false);
  });

  it("uses README-safe closeout wording", () => {
    const report = buildJobScoutFoundationCloseoutReport();
    const wording = report.readme_safe_wording.join(" ");

    expect(wording).toMatch(/foundation complete/i);
    expect(wording).toMatch(/feed ingestion, normalization, ranking/i);
    expect(wording).toMatch(/future slices/i);
    expect(wording).not.toMatch(/fully shipped|auto-apply complete/i);
  });

  it("keeps closeout source free of live integration and execution imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/phase-21i-closeout.ts"),
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
