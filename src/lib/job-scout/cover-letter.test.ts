import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoverLetterDraftPlan,
  buildCoverLetterTemplate,
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobFitScore,
  summarizeDraftRequirements,
} from ".";

describe("Job Scout cover letter drafting foundation", () => {
  it("builds a deterministic non-generative template", () => {
    const template = buildCoverLetterTemplate();

    expect(template).toEqual(buildCoverLetterTemplate());
    expect(template.sections).toEqual([
      "role_context",
      "company_context",
      "skill_alignment",
      "motivation",
      "closing",
    ]);
    expect(template.final_letter_generated).toBe(false);
    expect(template.model_call_required).toBe(false);
  });

  it("summarizes draft requirements from metadata only", () => {
    const input = coverLetterInput();
    const summary = summarizeDraftRequirements(input);

    expect(summary.ready_for_drafting).toBe(true);
    expect(summary.available_metadata).toContain("job_posting");
    expect(summary.available_metadata).toContain("candidate_profile");
    expect(summary.available_metadata).toContain("fit_score");
    expect(summary.missing_skills).toEqual([]);
    expect(summary.metadata_only).toBe(true);
  });

  it("builds a draft-ready plan without generating a final letter", () => {
    const plan = buildCoverLetterDraftPlan(coverLetterInput());

    expect(plan.status).toBe("draft_plan_ready");
    expect(plan.draft_id).toBe(
      "cover-letter-draft:job:applied-ai-security-graduate",
    );
    expect(plan.suggested_outline.length).toBe(4);
    expect(plan.governance.suggestion_only).toBe(true);
    expect(plan.governance.draft_ready).toBe(true);
    expect(plan.governance.final_letter_generated).toBe(false);
    expect(plan.governance.llm_call_attempted).toBe(false);
    expect(plan.governance.deepseek_call_attempted).toBe(false);
    expect(plan.governance.provider_call_attempted).toBe(false);
    expect(plan.governance.submission_attempted).toBe(false);
  });

  it("keeps cover-letter source free of LLM, provider, network, write, and submission paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/cover-letter.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(
      /generateFinalLetter|callDeepSeek|submitApplication|autoApply|sendEmail|writeFile|executeApproval/i,
    );
  });
});

function coverLetterInput() {
  const posting = buildFixtureJobPostings()[0];
  const profile = buildDefaultJobScoutProfile();
  return {
    input_id: "cover-letter-input:test",
    posting,
    profile,
    fit_score: buildJobFitScore(posting, profile),
    company_notes: ["AI security scaleup."],
    candidate_highlights: ["Built governed local-first JARVIS workflows."],
    metadata_only: true as const,
  };
}
