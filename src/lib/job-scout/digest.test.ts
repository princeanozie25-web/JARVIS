import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_SCOUT_DIGEST_VERSION,
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobScoutDigest,
  rankJobPostings,
} from ".";

describe("Job Scout digest generator", () => {
  it("generates a deterministic digest from ranked jobs", () => {
    const ranking = rankJobPostings(
      buildFixtureJobPostings(),
      buildDefaultJobScoutProfile(),
    );
    const options = {
      generated_at: "2026-06-03T08:00:00.000Z",
      digest_id: "job-scout:digest:test",
    };

    expect(buildJobScoutDigest(ranking, options)).toEqual(
      buildJobScoutDigest(ranking, options),
    );
  });

  it("includes top opportunities with fit explanations", () => {
    const digest = buildJobScoutDigest(
      rankJobPostings(buildFixtureJobPostings(), buildDefaultJobScoutProfile()),
      { top_n: 2 },
    );

    expect(digest.digest_version).toBe(JOB_SCOUT_DIGEST_VERSION);
    expect(digest.candidate_count).toBe(3);
    expect(digest.top_opportunities).toHaveLength(2);
    expect(digest.top_opportunities[0].posting_id).toBe(
      "job:applied-ai-security-graduate",
    );
    expect(digest.top_opportunities[0].fit_explanations.length).toBeGreaterThan(
      0,
    );
    expect(digest.top_opportunities[0].recommended_action).toBe(
      "prepare_application_materials",
    );
    expect(digest.top_opportunities[0].suggestion_only).toBe(true);
    expect(digest.top_opportunities[0].application_submission_attempted).toBe(
      false,
    );
  });

  it("summarizes missing skills and recommendations", () => {
    const digest = buildJobScoutDigest(
      rankJobPostings(buildFixtureJobPostings(), buildDefaultJobScoutProfile()),
    );

    expect(digest.missing_skill_summary.map((item) => item.skill_tag)).toEqual([
      "design-systems",
      "frontend",
      "kubernetes",
      "react",
    ]);
    expect(digest.recommended_next_actions).toEqual([
      "2 high-fit opportunities are ready for manual review.",
      "1 opportunities need skill-gap preparation before application planning.",
      "Keep Job Scout suggestion-only until scraping and application workflows receive explicit future approval.",
    ]);
  });

  it("declares governance suitable for future Morning Brief and Suggestion Inbox integration", () => {
    const digest = buildJobScoutDigest(
      rankJobPostings(buildFixtureJobPostings(), buildDefaultJobScoutProfile()),
    );

    expect(digest.governance.suitable_for_morning_brief).toBe(true);
    expect(digest.governance.suitable_for_future_suggestion_inbox).toBe(true);
    expect(digest.governance.suggestion_only).toBe(true);
    expect(digest.governance.scraping_attempted).toBe(false);
    expect(digest.governance.playwright_attempted).toBe(false);
    expect(digest.governance.browser_automation_attempted).toBe(false);
    expect(digest.governance.external_api_call_attempted).toBe(false);
    expect(digest.governance.provider_call_attempted).toBe(false);
    expect(digest.governance.model_call_attempted).toBe(false);
    expect(digest.governance.network_call_attempted).toBe(false);
    expect(digest.governance.filesystem_write_attempted).toBe(false);
    expect(digest.governance.database_write_attempted).toBe(false);
    expect(digest.governance.scheduler_invoked).toBe(false);
    expect(digest.governance.approval_execution_attempted).toBe(false);
    expect(digest.governance.application_submission_attempted).toBe(false);
    expect(digest.governance.auto_apply_attempted).toBe(false);
    expect(digest.governance.auto_send_attempted).toBe(false);
    expect(digest.write_attempted).toBe(false);
  });

  it("keeps digest source free of submission, automation, network, model, and write paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/digest.ts"),
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
