import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoverLetterDraftPlan,
  buildDefaultJobScoutProfile,
  buildFixtureJobPostings,
  buildJobFitScore,
  buildJobScoutDigest,
  buildJobScoutWorkflow,
  createJobApplication,
  identifyWorkflowBlockers,
  rankJobPostings,
  summarizeWorkflow,
  updateJobApplicationStatus,
} from ".";

describe("Job Scout workflow planner", () => {
  it("plans the full workflow through human approval boundary", () => {
    const fixture = workflowFixture();
    const workflow = buildJobScoutWorkflow(fixture);

    expect(workflow.status).toBe("ready_for_human_approval");
    expect(workflow.summary.ranked_job_count).toBe(3);
    expect(workflow.summary.tracked_application_count).toBe(1);
    expect(workflow.summary.draft_plan_count).toBe(1);
    expect(workflow.summary.ready_for_human_approval_count).toBe(1);
    expect(workflow.steps.map((step) => step.step_kind)).toEqual([
      "discovery",
      "ranking",
      "shortlist",
      "draft_preparation",
      "review",
      "ready_for_submission",
    ]);
    expect(workflow.steps.at(-1)?.requires_human_approval).toBe(true);
    expect(workflow.governance.human_approval_boundary_reached).toBe(true);
    expect(workflow.governance.application_submission_attempted).toBe(false);
    expect(workflow.governance.workflow_execution_attempted).toBe(false);
  });

  it("identifies blockers when draft planning or tracking is missing", () => {
    const fixture = workflowFixture();
    const blockers = identifyWorkflowBlockers({
      ...fixture,
      applications: [],
      cover_letter_drafts: [],
    });

    expect(blockers).toEqual([
      "no_cover_letter_draft_plans",
      "no_tracked_applications",
    ]);
    expect(
      buildJobScoutWorkflow({
        ...fixture,
        applications: [],
        cover_letter_drafts: [],
      }).status,
    ).toBe("blocked");
  });

  it("summarizes workflow deterministically", () => {
    const workflow = buildJobScoutWorkflow(workflowFixture());

    expect(summarizeWorkflow(workflow)).toEqual(summarizeWorkflow(workflow));
    expect(summarizeWorkflow(workflow)).toEqual({
      ranked_job_count: 3,
      tracked_application_count: 1,
      draft_plan_count: 1,
      ready_for_human_approval_count: 1,
      metadata_only: true,
    });
  });

  it("preserves no execution, provider, network, write, scheduler, approval, or auto-apply paths", () => {
    const workflow = buildJobScoutWorkflow(workflowFixture());

    expect(workflow.governance.suggestion_only).toBe(true);
    expect(workflow.governance.approval_gated).toBe(true);
    expect(workflow.governance.workflow_execution_attempted).toBe(false);
    expect(workflow.governance.application_submission_attempted).toBe(false);
    expect(workflow.governance.provider_call_attempted).toBe(false);
    expect(workflow.governance.network_call_attempted).toBe(false);
    expect(workflow.governance.filesystem_write_attempted).toBe(false);
    expect(workflow.governance.database_write_attempted).toBe(false);
    expect(workflow.governance.scheduler_execution_attempted).toBe(false);
    expect(workflow.governance.approval_execution_attempted).toBe(false);
    expect(workflow.governance.auto_apply_attempted).toBe(false);
    expect(workflow.governance.auto_send_attempted).toBe(false);
  });

  it("keeps workflow source free of live integration and execution imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/workflow.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /playwright|puppeteer|googleapis|openai|anthropic|fetch|fs|sqlite/i,
    );
    expect(source).not.toMatch(
      /submitApplication|autoApply|sendEmail|createCalendar|writeFile|executeApproval/i,
    );
  });
});

function workflowFixture() {
  const profile = buildDefaultJobScoutProfile();
  const ranking = rankJobPostings(buildFixtureJobPostings(), profile);
  const digest = buildJobScoutDigest(ranking);
  const application = updateJobApplicationStatus(
    createJobApplication({ ranked_job: ranking.ranked_jobs[0] }),
    "ready_to_apply",
    { updated_at: "2026-06-03T09:00:00.000Z" },
  );
  const posting = ranking.ranked_jobs[0].posting;
  const draft = buildCoverLetterDraftPlan({
    input_id: "cover-letter-input:workflow",
    posting,
    profile,
    fit_score: buildJobFitScore(posting, profile),
    company_notes: ["AI security role."],
    candidate_highlights: ["JARVIS Expansion Era workflow architecture."],
    metadata_only: true,
  });

  return {
    ranking,
    digest,
    applications: [application],
    cover_letter_drafts: [draft],
  };
}
