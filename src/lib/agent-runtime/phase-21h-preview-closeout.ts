import { z } from "zod";
import {
  AGENT_SUITE_SUMMARY_VERSION,
  IMPLEMENTED_AGENT_PREVIEW_IDS,
  buildAgentSuiteRegistrySummary,
} from "./agent-suite-summary";
import { APPLICATION_TRACKER_AGENT_PREVIEW_VERSION } from "./application-tracker-preview";
import { BUILD_MONITOR_AGENT_PREVIEW_VERSION } from "./build-monitor-preview";
import { COST_MONITOR_PREVIEW_VERSION } from "./cost-monitor-preview";
import { CV_MAINTENANCE_AGENT_PREVIEW_VERSION } from "./cv-maintenance-preview";
import { DEADLINE_AGENT_PREVIEW_VERSION } from "./deadline-agent-preview";
import { HEALTH_AGENT_PREVIEW_VERSION } from "./health-agent-preview";
import { LIFE_COACH_AGENT_PREVIEW_VERSION } from "./life-coach-preview";
import { RESEARCH_AGENT_PREVIEW_VERSION } from "./research-agent-preview";

export const PHASE21H_PREVIEW_CLOSEOUT_VERSION =
  "phase21h.preview-closeout.v1" as const;

export const PHASE21H_PREVIEW_CLOSEOUT_AGENT_IDS = [
  "life_coach",
  "build_monitor",
  "research_agent",
  "cv_maintenance",
  "application_tracker",
  "deadline_agent",
  "cost_monitor",
  "health_agent",
] as const;

export const PHASE21H_PREVIEW_CLOSEOUT_STATUSES = [
  "PASS",
  "PASS_WITH_NOTES",
  "FAIL",
] as const;

const AgentIdSchema = z.enum(PHASE21H_PREVIEW_CLOSEOUT_AGENT_IDS);

export const Phase21HPreviewCloseoutStatusSchema = z.enum(
  PHASE21H_PREVIEW_CLOSEOUT_STATUSES,
);

export const Phase21HPreviewAgentCloseoutSchema = z.strictObject({
  agent_id: AgentIdSchema,
  display_name: z.string().trim().min(1).max(120),
  preview_version: z.string().trim().min(1).max(120),
  represented: z.literal(true),
  deterministic: z.literal(true),
  suggestion_only: z.literal(true),
  fixture_or_mock_input_only: z.literal(true),
  preview_only: z.literal(true),
  metadata_only: z.literal(true),
});

export const Phase21HPreviewCloseoutGovernanceSchema = z.strictObject({
  all_previews_represented: z.literal(true),
  agent_suite_summary_present: z.literal(true),
  all_previews_deterministic: z.literal(true),
  all_previews_suggestion_only: z.literal(true),
  all_previews_fixture_mock_input_only: z.literal(true),
  scheduler_wiring_exists: z.literal(false),
  suggestion_inbox_writes_exist: z.literal(false),
  approval_execution_exists: z.literal(false),
  provider_model_calls_exist: z.literal(false),
  network_calls_exist: z.literal(false),
  filesystem_database_writes_exist: z.literal(false),
  real_obsidian_gmail_calendar_ruview_reads_exist: z.literal(false),
  runtime_mutation_or_authority_escalation_exists: z.literal(false),
  approval_lifecycle_remains_only_execution_path: z.literal(true),
  metadata_only: z.literal(true),
});

export const Phase21HPreviewCloseoutFutureBoundarySchema = z.strictObject({
  real_scheduled_agents_complete: z.literal(false),
  real_suggestion_inbox_writes_complete: z.literal(false),
  real_gmail_calendar_reads_complete: z.literal(false),
  real_obsidian_reads_complete: z.literal(false),
  real_sensor_ruview_integrations_complete: z.literal(false),
  autonomous_agents_suite_fully_shipped: z.literal(false),
  future_work_note: z.string().trim().min(1).max(260),
  metadata_only: z.literal(true),
});

export const Phase21HPreviewCloseoutReportSchema = z.strictObject({
  kind: z.literal("agent_runtime.phase21h_preview_suite_closeout"),
  closeout_version: z.literal(PHASE21H_PREVIEW_CLOSEOUT_VERSION),
  status: Phase21HPreviewCloseoutStatusSchema,
  scope: z.literal("Phase 21H preview suite only"),
  completed_label: z.literal("preview suite complete"),
  foundation_complete: z.literal(true),
  registered_agent_count: z.number().int().nonnegative(),
  represented_preview_count: z.number().int().nonnegative(),
  agent_suite_summary_version: z.literal(AGENT_SUITE_SUMMARY_VERSION),
  agent_suite_summary_status: z.literal("complete_preview_suite"),
  preview_agents: z.array(Phase21HPreviewAgentCloseoutSchema),
  missing_preview_agents: z.array(AgentIdSchema),
  governance: Phase21HPreviewCloseoutGovernanceSchema,
  future_boundaries: Phase21HPreviewCloseoutFutureBoundarySchema,
  closeout_notes: z.array(z.string().trim().min(1).max(260)),
  deterministic: z.literal(true),
  metadata_only: z.literal(true),
});

export type Phase21HPreviewCloseoutReport = z.infer<
  typeof Phase21HPreviewCloseoutReportSchema
>;

export function buildPhase21HPreviewCloseoutReport(): Phase21HPreviewCloseoutReport {
  const summary = buildAgentSuiteRegistrySummary();
  const previewAgents = PHASE21H_PREVIEW_CLOSEOUT_AGENT_IDS.map((agentId) =>
    Phase21HPreviewAgentCloseoutSchema.parse({
      agent_id: agentId,
      display_name: displayNameFor(agentId),
      preview_version: previewVersionFor(agentId),
      represented: true,
      deterministic: true,
      suggestion_only: true,
      fixture_or_mock_input_only: true,
      preview_only: true,
      metadata_only: true,
    }),
  );

  return Phase21HPreviewCloseoutReportSchema.parse({
    kind: "agent_runtime.phase21h_preview_suite_closeout",
    closeout_version: PHASE21H_PREVIEW_CLOSEOUT_VERSION,
    status: "PASS",
    scope: "Phase 21H preview suite only",
    completed_label: "preview suite complete",
    foundation_complete: true,
    registered_agent_count: summary.registered_agent_count,
    represented_preview_count: previewAgents.length,
    agent_suite_summary_version: summary.summary_version,
    agent_suite_summary_status: summary.readiness_summary.status,
    preview_agents: previewAgents,
    missing_preview_agents: [],
    governance: {
      all_previews_represented: true,
      agent_suite_summary_present: true,
      all_previews_deterministic: true,
      all_previews_suggestion_only: true,
      all_previews_fixture_mock_input_only: true,
      scheduler_wiring_exists: false,
      suggestion_inbox_writes_exist: false,
      approval_execution_exists: false,
      provider_model_calls_exist: false,
      network_calls_exist: false,
      filesystem_database_writes_exist: false,
      real_obsidian_gmail_calendar_ruview_reads_exist: false,
      runtime_mutation_or_authority_escalation_exists: false,
      approval_lifecycle_remains_only_execution_path: true,
      metadata_only: true,
    },
    future_boundaries: {
      real_scheduled_agents_complete: false,
      real_suggestion_inbox_writes_complete: false,
      real_gmail_calendar_reads_complete: false,
      real_obsidian_reads_complete: false,
      real_sensor_ruview_integrations_complete: false,
      autonomous_agents_suite_fully_shipped: false,
      future_work_note:
        "This closeout covers preview-only foundations; scheduler wiring, live reads, Suggestion Inbox writes, and real integrations remain future work.",
      metadata_only: true,
    },
    closeout_notes: [
      "All eight Phase 21H preview agents are represented.",
      "Agent Suite Summary is present and complete.",
      "Suggestions only. Approval lifecycle remains the only path to execution.",
      "This does not close real scheduled agents or live integration work.",
    ],
    deterministic: true,
    metadata_only: true,
  });
}

function displayNameFor(agentId: z.infer<typeof AgentIdSchema>) {
  return {
    life_coach: "Life Coach",
    build_monitor: "Build Monitor",
    research_agent: "Research Agent",
    cv_maintenance: "CV Maintenance",
    application_tracker: "Application Tracker",
    deadline_agent: "Deadline Agent",
    cost_monitor: "Cost Monitor",
    health_agent: "Health Agent",
  }[agentId];
}

function previewVersionFor(agentId: z.infer<typeof AgentIdSchema>) {
  return {
    life_coach: LIFE_COACH_AGENT_PREVIEW_VERSION,
    build_monitor: BUILD_MONITOR_AGENT_PREVIEW_VERSION,
    research_agent: RESEARCH_AGENT_PREVIEW_VERSION,
    cv_maintenance: CV_MAINTENANCE_AGENT_PREVIEW_VERSION,
    application_tracker: APPLICATION_TRACKER_AGENT_PREVIEW_VERSION,
    deadline_agent: DEADLINE_AGENT_PREVIEW_VERSION,
    cost_monitor: COST_MONITOR_PREVIEW_VERSION,
    health_agent: HEALTH_AGENT_PREVIEW_VERSION,
  }[agentId];
}

if (
  JSON.stringify(PHASE21H_PREVIEW_CLOSEOUT_AGENT_IDS) !==
  JSON.stringify(IMPLEMENTED_AGENT_PREVIEW_IDS)
) {
  throw new Error(
    "Phase 21H closeout agent list must match implemented preview ids.",
  );
}
