import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOB_SCOUT_WORKFLOW_CLOSEOUT_VERSION,
  buildJobScoutWorkflowCloseoutReport,
} from ".";

describe("Job Scout workflow closeout", () => {
  it("verifies foundation and workflow components", () => {
    const report = buildJobScoutWorkflowCloseoutReport();

    expect(report.closeout_version).toBe(JOB_SCOUT_WORKFLOW_CLOSEOUT_VERSION);
    expect(report.title).toBe(
      "Job Scout workflow complete through human approval boundary",
    );
    expect(
      report.foundation_components.map((component) => component.component_id),
    ).toEqual([
      "job-scout-source-contract",
      "job-scout-feed-layer",
      "job-scout-feed-normalization",
      "job-scout-ranking-engine",
      "job-scout-digest-generator",
      "job-scout-suggestion-payload",
      "job-scout-morning-brief-contract",
      "job-scout-foundation-closeout",
    ]);
    expect(
      report.workflow_components.map((component) => component.component_id),
    ).toEqual([
      "job-scout-application-tracker",
      "job-scout-cover-letter-draft-foundation",
      "job-scout-workflow-planner",
    ]);
    expect(
      report.workflow_components.every((component) => component.present),
    ).toBe(true);
  });

  it("covers workflow capabilities through human approval only", () => {
    const report = buildJobScoutWorkflowCloseoutReport();

    expect(report.completed_capabilities).toContain("application_tracking");
    expect(report.completed_capabilities).toContain(
      "cover_letter_draft_planning",
    );
    expect(report.completed_capabilities).toContain("workflow_planning");
    expect(report.completed_capabilities).toContain(
      "ready_for_human_approval_boundary",
    );
    expect(report.future_capabilities).toEqual([
      "scraping",
      "browser_automation",
      "playwright_form_filling",
      "llm_generated_cover_letters",
      "application_submission",
      "auto_apply",
    ]);
  });

  it("proves prohibited capabilities remain absent", () => {
    const governance = buildJobScoutWorkflowCloseoutReport().governance;

    expect(governance.status).toBe(
      "job_scout_workflow_complete_through_human_approval_boundary",
    );
    expect(governance.suggestion_only).toBe(true);
    expect(governance.approval_gated).toBe(true);
    expect(governance.human_approval_boundary_required).toBe(true);
    expect(governance.scraping_supported).toBe(false);
    expect(governance.playwright_supported).toBe(false);
    expect(governance.browser_automation_supported).toBe(false);
    expect(governance.application_submission_supported).toBe(false);
    expect(governance.gmail_send_supported).toBe(false);
    expect(governance.calendar_write_supported).toBe(false);
    expect(governance.provider_call_supported).toBe(false);
    expect(governance.model_call_supported).toBe(false);
    expect(governance.deepseek_call_supported).toBe(false);
    expect(governance.external_api_call_supported).toBe(false);
    expect(governance.network_call_supported).toBe(false);
    expect(governance.filesystem_write_supported).toBe(false);
    expect(governance.database_write_supported).toBe(false);
    expect(governance.scheduler_execution_supported).toBe(false);
    expect(governance.approval_execution_supported).toBe(false);
    expect(governance.auto_apply_supported).toBe(false);
    expect(governance.auto_send_supported).toBe(false);
    expect(governance.autonomous_workflow_execution_supported).toBe(false);
    expect(governance.new_authority_surface_added).toBe(false);
  });

  it("uses safe closeout wording", () => {
    const wording =
      buildJobScoutWorkflowCloseoutReport().readme_safe_wording.join(" ");

    expect(wording).toMatch(/through human approval boundary/i);
    expect(wording).toMatch(/without submitting anything/i);
    expect(wording).not.toMatch(/Applications submitted|fully autonomous/i);
  });

  it("keeps closeout source free of live integration and execution imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/job-scout/phase-21i-workflow-closeout.ts"),
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
