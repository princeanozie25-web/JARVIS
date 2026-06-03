import { z } from "zod";
import { JOB_SCOUT_CONTRACT_VERSION } from "./contract";
import { JOB_SCOUT_DIGEST_VERSION } from "./digest";
import { JOB_SCOUT_FEED_VERSION } from "./feed";
import { JOB_SCOUT_NORMALIZATION_VERSION } from "./normalization";
import { JOB_SCOUT_RANKING_VERSION } from "./ranking";
import { JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION } from "./suggestion";

export const JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION =
  "phase21i.job-scout-foundation-closeout.v1" as const;

export const JobScoutFoundationComponentSchema = z.strictObject({
  component_id: z.string().trim().min(1).max(120),
  version: z.string().trim().min(1).max(120),
  present: z.literal(true),
});

export const JobScoutFoundationCloseoutGovernanceSchema = z.strictObject({
  status: z.literal("job_scout_foundation_complete"),
  suggestion_only: z.literal(true),
  feed_input_only: z.literal(true),
  scraping_supported: z.literal(false),
  playwright_supported: z.literal(false),
  browser_automation_supported: z.literal(false),
  application_submission_supported: z.literal(false),
  provider_call_supported: z.literal(false),
  model_call_supported: z.literal(false),
  deepseek_call_supported: z.literal(false),
  embedding_supported: z.literal(false),
  network_call_supported: z.literal(false),
  filesystem_write_supported: z.literal(false),
  database_write_supported: z.literal(false),
  scheduler_execution_supported: z.literal(false),
  approval_execution_supported: z.literal(false),
  auto_apply_supported: z.literal(false),
  auto_send_supported: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export const JobScoutFoundationCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION),
  phase: z.literal("21I"),
  title: z.literal("Job Scout foundation complete"),
  status: z.literal("foundation_complete"),
  components: z.array(JobScoutFoundationComponentSchema),
  completed_capabilities: z.array(z.string().trim().min(1).max(180)),
  future_capabilities: z.array(z.string().trim().min(1).max(180)),
  governance: JobScoutFoundationCloseoutGovernanceSchema,
  readme_safe_wording: z.array(z.string().trim().min(1).max(220)),
});

export type JobScoutFoundationComponent = z.infer<
  typeof JobScoutFoundationComponentSchema
>;
export type JobScoutFoundationCloseoutGovernance = z.infer<
  typeof JobScoutFoundationCloseoutGovernanceSchema
>;
export type JobScoutFoundationCloseoutReport = z.infer<
  typeof JobScoutFoundationCloseoutReportSchema
>;

export function buildJobScoutFoundationCloseoutReport(): JobScoutFoundationCloseoutReport {
  return JobScoutFoundationCloseoutReportSchema.parse({
    closeout_version: JOB_SCOUT_FOUNDATION_CLOSEOUT_VERSION,
    phase: "21I",
    title: "Job Scout foundation complete",
    status: "foundation_complete",
    components: [
      {
        component_id: "job-scout-source-contract",
        version: JOB_SCOUT_CONTRACT_VERSION,
        present: true,
      },
      {
        component_id: "job-scout-feed-layer",
        version: JOB_SCOUT_FEED_VERSION,
        present: true,
      },
      {
        component_id: "job-scout-feed-normalization",
        version: JOB_SCOUT_NORMALIZATION_VERSION,
        present: true,
      },
      {
        component_id: "job-scout-ranking-engine",
        version: JOB_SCOUT_RANKING_VERSION,
        present: true,
      },
      {
        component_id: "job-scout-digest-generator",
        version: JOB_SCOUT_DIGEST_VERSION,
        present: true,
      },
      {
        component_id: "job-scout-suggestion-payload",
        version: JOB_SCOUT_SUGGESTION_PAYLOAD_VERSION,
        present: true,
      },
      {
        component_id: "job-scout-morning-brief-contract",
        version: "phase21c.morning-brief-real-input.v1",
        present: true,
      },
    ],
    completed_capabilities: [
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
    ],
    future_capabilities: [
      "scraping",
      "browser_automation",
      "external_job_board_api_calls",
      "cover_letter_generation",
      "application_submission",
      "auto_apply",
    ],
    governance: {
      status: "job_scout_foundation_complete",
      suggestion_only: true,
      feed_input_only: true,
      scraping_supported: false,
      playwright_supported: false,
      browser_automation_supported: false,
      application_submission_supported: false,
      provider_call_supported: false,
      model_call_supported: false,
      deepseek_call_supported: false,
      embedding_supported: false,
      network_call_supported: false,
      filesystem_write_supported: false,
      database_write_supported: false,
      scheduler_execution_supported: false,
      approval_execution_supported: false,
      auto_apply_supported: false,
      auto_send_supported: false,
      new_authority_surface_added: false,
    },
    readme_safe_wording: [
      "Job Scout foundation complete.",
      "It supports supplied feed ingestion, normalization, ranking, fit scoring, digest generation, and Morning Brief metadata integration.",
      "Scraping, application automation, cover-letter generation, submissions, and auto-apply remain future slices.",
    ],
  });
}
