import { z } from "zod";
import { JOB_SCOUT_APPLICATION_TRACKER_VERSION } from "./application-tracker";
import { JOB_SCOUT_CONTRACT_VERSION } from "./contract";
import { JOB_SCOUT_COVER_LETTER_VERSION } from "./cover-letter";
import { JOB_SCOUT_DIGEST_VERSION } from "./digest";
import { JOB_SCOUT_FEED_VERSION } from "./feed";
import { JOB_SCOUT_NORMALIZATION_VERSION } from "./normalization";
import { JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION } from "./phase-21i-closeout";
import { JOB_SCOUT_RANKING_VERSION } from "./ranking";
import { JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION } from "./suggestion";
import { JOB_SCOUT_WORKFLOW_VERSION } from "./workflow";

export const JOB_SCOUT_WORKFLOW_CLOSEOUT_VERSION =
  "phase21i.job-scout-workflow-closeout.v1" as const;

export const JobScoutWorkflowCloseoutComponentSchema = z.strictObject({
  component_id: z.string().trim().min(1).max(140),
  version: z.string().trim().min(1).max(140),
  present: z.literal(true),
});

export const JobScoutWorkflowCloseoutGovernanceSchema = z.strictObject({
  status: z.literal(
    "job_scout_workflow_complete_through_human_approval_boundary",
  ),
  suggestion_only: z.literal(true),
  approval_gated: z.literal(true),
  human_approval_boundary_required: z.literal(true),
  scraping_supported: z.literal(false),
  playwright_supported: z.literal(false),
  browser_automation_supported: z.literal(false),
  application_submission_supported: z.literal(false),
  gmail_send_supported: z.literal(false),
  calendar_write_supported: z.literal(false),
  provider_call_supported: z.literal(false),
  model_call_supported: z.literal(false),
  deepseek_call_supported: z.literal(false),
  external_api_call_supported: z.literal(false),
  network_call_supported: z.literal(false),
  filesystem_write_supported: z.literal(false),
  database_write_supported: z.literal(false),
  scheduler_execution_supported: z.literal(false),
  approval_execution_supported: z.literal(false),
  auto_apply_supported: z.literal(false),
  auto_send_supported: z.literal(false),
  autonomous_workflow_execution_supported: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export const JobScoutWorkflowCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(JOB_SCOUT_WORKFLOW_CLOSEOUT_VERSION),
  phase: z.literal("21I"),
  title: z.literal(
    "Job Scout workflow complete through human approval boundary",
  ),
  status: z.literal("workflow_complete_through_human_approval_boundary"),
  foundation_components: z.array(JobScoutWorkflowCloseoutComponentSchema),
  workflow_components: z.array(JobScoutWorkflowCloseoutComponentSchema),
  completed_capabilities: z.array(z.string().trim().min(1).max(180)),
  future_capabilities: z.array(z.string().trim().min(1).max(180)),
  governance: JobScoutWorkflowCloseoutGovernanceSchema,
  readme_safe_wording: z.array(z.string().trim().min(1).max(220)),
});

export type JobScoutWorkflowCloseoutComponent = z.infer<
  typeof JobScoutWorkflowCloseoutComponentSchema
>;
export type JobScoutWorkflowCloseoutGovernance = z.infer<
  typeof JobScoutWorkflowCloseoutGovernanceSchema
>;
export type JobScoutWorkflowCloseoutReport = z.infer<
  typeof JobScoutWorkflowCloseoutReportSchema
>;

export function buildJobScoutWorkflowCloseoutReport(): JobScoutWorkflowCloseoutReport {
  return JobScoutWorkflowCloseoutReportSchema.parse({
    closeout_version: JOB_SCOUT_WORKFLOW_CLOSEOUT_VERSION,
    phase: "21I",
    title: "Job Scout workflow complete through human approval boundary",
    status: "workflow_complete_through_human_approval_boundary",
    foundation_components: [
      component("job-scout-source-contract", JOB_SCOUT_CONTRACT_VERSION),
      component("job-scout-feed-layer", JOB_SCOUT_FEED_VERSION),
      component(
        "job-scout-feed-normalization",
        JOB_SCOUT_NORMALIZATION_VERSION,
      ),
      component("job-scout-ranking-engine", JOB_SCOUT_RANKING_VERSION),
      component("job-scout-digest-generator", JOB_SCOUT_DIGEST_VERSION),
      component(
        "job-scout-suggestion-payload",
        JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION,
      ),
      component(
        "job-scout-morning-brief-contract",
        "phase21c.morning-brief-real-input.v1",
      ),
      component(
        "job-scout-foundation-closeout",
        JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION,
      ),
    ],
    workflow_components: [
      component(
        "job-scout-application-tracker",
        JOB_SCOUT_APPLICATION_TRACKER_VERSION,
      ),
      component(
        "job-scout-cover-letter-draft-foundation",
        JOB_SCOUT_COVER_LETTER_VERSION,
      ),
      component("job-scout-workflow-planner", JOB_SCOUT_WORKFLOW_VERSION),
    ],
    completed_capabilities: [
      "source_contracts",
      "feed_ingestion",
      "normalization",
      "ranking",
      "fit_scoring",
      "missing_skill_detection",
      "digest_generation",
      "morning_brief_integration",
      "application_tracking",
      "cover_letter_draft_planning",
      "workflow_planning",
      "ready_for_human_approval_boundary",
    ],
    future_capabilities: [
      "scraping",
      "browser_automation",
      "playwright_form_filling",
      "llm_generated_cover_letters",
      "application_submission",
      "auto_apply",
    ],
    governance: {
      status: "job_scout_workflow_complete_through_human_approval_boundary",
      suggestion_only: true,
      approval_gated: true,
      human_approval_boundary_required: true,
      scraping_supported: false,
      playwright_supported: false,
      browser_automation_supported: false,
      application_submission_supported: false,
      gmail_send_supported: false,
      calendar_write_supported: false,
      provider_call_supported: false,
      model_call_supported: false,
      deepseek_call_supported: false,
      external_api_call_supported: false,
      network_call_supported: false,
      filesystem_write_supported: false,
      database_write_supported: false,
      scheduler_execution_supported: false,
      approval_execution_supported: false,
      auto_apply_supported: false,
      auto_send_supported: false,
      autonomous_workflow_execution_supported: false,
      new_authority_surface_added: false,
    },
    readme_safe_wording: [
      "Job Scout workflow complete through human approval boundary.",
      "It tracks applications, prepares cover-letter draft plans, and plans the application workflow without submitting anything.",
      "Scraping, LLM-generated cover letters, application submission, and auto-apply remain future slices.",
    ],
  });
}

function component(
  component_id: string,
  version: string,
): JobScoutWorkflowCloseoutComponent {
  return JobScoutWorkflowCloseoutComponentSchema.parse({
    component_id,
    version,
    present: true,
  });
}
