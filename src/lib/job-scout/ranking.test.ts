import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobFitScore,
  identifyMissingSkills,
  rankJobPostings,
} from ".";

describe("Job Scout ranking engine", () => {
  it("produces deterministic rankings", () => {
    const postings = buildFixtureJobPostings();
    const profile = buildDefaultJobScoutProfile();

    expect(rankJobPostings(postings, profile)).toEqual(
      rankJobPostings(postings, profile),
    );
  });

  it("ranks higher-fit jobs above lower-fit jobs", () => {
    const result = rankJobPostings(
      buildFixtureJobPostings(),
      buildDefaultJobScoutProfile(),
    );

    expect(result.ranked_jobs.map((job) => job.posting.posting_id)).toEqual([
      "job:applied-ai-security-graduate",
      "job:ml-infra-junior",
      "job:senior-frontend-onsite",
    ]);
    expect(result.ranked_jobs[0].score.fit_score).toBeGreaterThan(
      result.ranked_jobs[1].score.fit_score,
    );
    expect(result.ranked_jobs[1].score.fit_score).toBeGreaterThan(
      result.ranked_jobs[2].score.fit_score,
    );
  });

  it("produces fit scores with explanations and confidence metadata", () => {
    const posting = buildFixtureJobPostings()[0];
    const score = buildJobFitScore(posting, buildDefaultJobScoutProfile());

    expect(score.fit_score).toBeGreaterThanOrEqual(85);
    expect(score.confidence).toBe("high");
    expect(score.breakdown.skill_match).toBeGreaterThan(25);
    expect(score.explanation.length).toBeGreaterThanOrEqual(3);
    expect(score.metadata_only).toBe(true);
    expect(score.model_call_attempted).toBe(false);
    expect(score.network_call_attempted).toBe(false);
  });

  it("identifies missing skills from required metadata", () => {
    const postings = buildFixtureJobPostings();
    const profile = buildDefaultJobScoutProfile();

    expect(identifyMissingSkills(postings[0], profile)).toEqual([]);
    expect(identifyMissingSkills(postings[1], profile)).toEqual(["kubernetes"]);
    expect(identifyMissingSkills(postings[2], profile)).toEqual([
      "design-systems",
      "frontend",
      "react",
    ]);
  });

  it("respects location and work-mode preferences", () => {
    const result = rankJobPostings(
      buildFixtureJobPostings(),
      buildDefaultJobScoutProfile(),
    );
    const top = result.ranked_jobs[0].score.breakdown;
    const low = result.ranked_jobs[2].score.breakdown;

    expect(top.location_match + top.work_mode_match).toBe(25);
    expect(low.location_match + low.work_mode_match).toBeLessThan(10);
  });

  it("does not call models, providers, embeddings, network, or writes", () => {
    const result = rankJobPostings(
      buildFixtureJobPostings(),
      buildDefaultJobScoutProfile(),
    );

    expect(result.governance.pure_scoring).toBe(true);
    expect(result.governance.model_call_attempted).toBe(false);
    expect(result.governance.provider_call_attempted).toBe(false);
    expect(result.governance.embedding_attempted).toBe(false);
    expect(result.governance.network_call_attempted).toBe(false);
    expect(result.governance.application_submission_attempted).toBe(false);
    expect(result.governance.write_attempted).toBe(false);
  });

  it("keeps ranking source free of live integration imports and automation paths", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/ranking.ts"),
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
