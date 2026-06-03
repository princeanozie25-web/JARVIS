import { z } from "zod";

export const MORNING_BRIEF_SCHEDULER_PLAN_VERSION =
  "phase21c.morning-brief-scheduler-plan.v1" as const;

export const MORNING_BRIEF_SCHEDULE_ID =
  "morning-brief:daily-0800-local" as const;

export const MORNING_BRIEF_SCHEDULE_FREQUENCIES = ["daily"] as const;

export const MORNING_BRIEF_SCHEDULER_OUTPUT_TARGETS = [
  "suggestion_inbox_digest",
] as const;

const BoundedTextSchema = z.string().trim().min(1).max(240);

export const MorningBriefScheduleSchema = z.strictObject({
  schedule_id: z.literal(MORNING_BRIEF_SCHEDULE_ID),
  local_time: z.literal("08:00"),
  timezone: z.literal("local"),
  frequency: z.enum(MORNING_BRIEF_SCHEDULE_FREQUENCIES),
  enabled_by_default: z.literal(false),
  kill_switch_supported: z.literal(true),
  kill_switch_enabled: z.literal(true),
});

export const MorningBriefScheduledJobSchema = z.strictObject({
  job_id: z.literal("morning-brief:scheduled-suggestion-preview"),
  schedule_id: z.literal(MORNING_BRIEF_SCHEDULE_ID),
  output_target: z.enum(MORNING_BRIEF_SCHEDULER_OUTPUT_TARGETS),
  output_kind: z.literal("suggestion.digest"),
  required_sources: z.array(z.enum(["gmail_or_calendar"])),
  optional_sources: z.array(
    z.enum(["drive", "jarvis_status", "agent_preview"]),
  ),
  failure_behavior: z.literal("skip_and_report_metadata_only"),
  background_daemon_started: z.literal(false),
  timer_registered: z.literal(false),
  live_adapter_calls_supported: z.literal(false),
  action_execution_supported: z.literal(false),
});

export const MorningBriefSchedulerGovernanceSchema = z.strictObject({
  suggestion_only: z.literal(true),
  metadata_only: z.literal(true),
  disabled_by_default: z.literal(true),
  scheduler_metadata_only: z.literal(true),
  daemon_started: z.literal(false),
  background_job_started: z.literal(false),
  timer_registered: z.literal(false),
  delivery_supported: z.literal(false),
  auto_send_supported: z.literal(false),
  auto_execute_supported: z.literal(false),
  approval_finalization_supported: z.literal(false),
  provider_call_supported: z.literal(false),
  network_call_supported: z.literal(false),
  mutation_supported: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export const MorningBriefSchedulerPlanSchema = z.strictObject({
  plan_version: z.literal(MORNING_BRIEF_SCHEDULER_PLAN_VERSION),
  schedule: MorningBriefScheduleSchema,
  job: MorningBriefScheduledJobSchema,
  governance: MorningBriefSchedulerGovernanceSchema,
  notes: z.array(BoundedTextSchema),
});

export type MorningBriefSchedule = z.infer<typeof MorningBriefScheduleSchema>;
export type MorningBriefScheduledJob = z.infer<
  typeof MorningBriefScheduledJobSchema
>;
export type MorningBriefSchedulerGovernance = z.infer<
  typeof MorningBriefSchedulerGovernanceSchema
>;
export type MorningBriefSchedulerPlan = z.infer<
  typeof MorningBriefSchedulerPlanSchema
>;

export function buildMorningBriefSchedulerPlan(): MorningBriefSchedulerPlan {
  return MorningBriefSchedulerPlanSchema.parse({
    plan_version: MORNING_BRIEF_SCHEDULER_PLAN_VERSION,
    schedule: {
      schedule_id: MORNING_BRIEF_SCHEDULE_ID,
      local_time: "08:00",
      timezone: "local",
      frequency: "daily",
      enabled_by_default: false,
      kill_switch_supported: true,
      kill_switch_enabled: true,
    },
    job: {
      job_id: "morning-brief:scheduled-suggestion-preview",
      schedule_id: MORNING_BRIEF_SCHEDULE_ID,
      output_target: "suggestion_inbox_digest",
      output_kind: "suggestion.digest",
      required_sources: ["gmail_or_calendar"],
      optional_sources: ["drive", "jarvis_status", "agent_preview"],
      failure_behavior: "skip_and_report_metadata_only",
      background_daemon_started: false,
      timer_registered: false,
      live_adapter_calls_supported: false,
      action_execution_supported: false,
    },
    governance: {
      suggestion_only: true,
      metadata_only: true,
      disabled_by_default: true,
      scheduler_metadata_only: true,
      daemon_started: false,
      background_job_started: false,
      timer_registered: false,
      delivery_supported: false,
      auto_send_supported: false,
      auto_execute_supported: false,
      approval_finalization_supported: false,
      provider_call_supported: false,
      network_call_supported: false,
      mutation_supported: false,
      new_authority_surface_added: false,
    },
    notes: [
      "Daily 08:00 local schedule is represented as metadata only.",
      "Scheduled output is limited to a Suggestion Inbox digest payload.",
      "The plan starts disabled with a kill switch and no daemon.",
    ],
  });
}
