import { z } from "zod";
import { SUGGESTION_INBOX_BRIDGE_VERSION } from "../suggestion-inbox";
import { MORNING_BRIEF_COMPOSER_VERSION } from "./composer";
import { MORNING_BRIEF_DELIVERY_VERSION } from "./delivery";
import { MORNING_BRIEF_REAL_INPUT_VERSION } from "./real-input-contract";
import { MORNING_BRIEF_REAL_PREVIEW_VERSION } from "./real-preview";
import { MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION } from "./scheduled-invocation";
import { MORNING_BRIEF_SCHEDULER_PLAN_VERSION } from "./scheduler";
import { MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION } from "./suggestion-inbox";

export const PHASE_21C_MORNING_BRIEF_CLOSEOUT_VERSION =
  "phase21c-r.morning-brief-realization-closeout.v1" as const;

export const Phase21CMorningBriefComponentSchema = z.strictObject({
  component_id: z.string().trim().min(1).max(120),
  version: z.string().trim().min(1).max(120),
  present: z.literal(true),
  posture: z.enum([
    "real_input_contract",
    "deterministic_composer",
    "deterministic_preview",
    "suggestion_payload",
    "scheduler_metadata",
    "suggestion_inbox_delivery",
    "scheduler_invocation_boundary",
    "shared_delivery_bridge",
  ]),
});

export const Phase21CMorningBriefCloseoutGovernanceSchema = z.strictObject({
  workflow_status: z.literal(
    "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
  ),
  suggestion_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only_google_inputs_only: z.literal(true),
  google_t0_read_stack_present: z.literal(true),
  minimum_viable_input_rules_present: z.literal(true),
  degraded_modes_present: z.literal(true),
  suggestion_payload_builder_present: z.literal(true),
  suggestion_inbox_delivery_present: z.literal(true),
  injected_delivery_supported: z.literal(true),
  scheduler_metadata_present: z.literal(true),
  scheduler_invocation_boundary_present: z.literal(true),
  idempotency_dedupe_present: z.literal(true),
  delivery_user_visible_through_inbox_item: z.literal(true),
  scheduler_daemon_started: z.literal(false),
  auto_send_supported: z.literal(false),
  auto_execute_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_finalization_supported: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  provider_call_supported: z.literal(false),
  network_call_supported: z.literal(false),
  live_adapter_call_inside_morning_brief_supported: z.literal(false),
  filesystem_write_supported: z.literal(false),
  database_write_supported: z.literal(false),
  mutation_supported: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export const Phase21CMorningBriefCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_21C_MORNING_BRIEF_CLOSEOUT_VERSION),
  phase: z.literal("21C-R"),
  title: z.literal("Morning Brief realization closeout"),
  status: z.literal(
    "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
  ),
  components: z.array(Phase21CMorningBriefComponentSchema),
  external_source_families: z.array(z.literal("google_t0_read_metadata")),
  output_path: z.literal("morning_brief_preview_to_suggestion_inbox_delivery"),
  schedule_summary: z.strictObject({
    local_time: z.literal("08:00"),
    frequency: z.literal("daily"),
    output_target: z.literal("suggestion_inbox"),
    kill_switch_supported: z.literal(true),
    input_must_be_supplied: z.literal(true),
    daemon_started: z.literal(false),
    metadata_only: z.literal(true),
  }),
  governance: Phase21CMorningBriefCloseoutGovernanceSchema,
  readme_safe_wording: z.array(z.string().trim().min(1).max(220)),
  future_work: z.array(z.string().trim().min(1).max(220)),
});

export type Phase21CMorningBriefComponent = z.infer<
  typeof Phase21CMorningBriefComponentSchema
>;
export type Phase21CMorningBriefCloseoutGovernance = z.infer<
  typeof Phase21CMorningBriefCloseoutGovernanceSchema
>;
export type Phase21CMorningBriefCloseoutReport = z.infer<
  typeof Phase21CMorningBriefCloseoutReportSchema
>;

export function buildPhase21CMorningBriefCloseoutReport(): Phase21CMorningBriefCloseoutReport {
  return Phase21CMorningBriefCloseoutReportSchema.parse({
    closeout_version: PHASE_21C_MORNING_BRIEF_CLOSEOUT_VERSION,
    phase: "21C-R",
    title: "Morning Brief realization closeout",
    status:
      "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
    components: [
      {
        component_id: "morning-brief-real-input-contract",
        version: MORNING_BRIEF_REAL_INPUT_VERSION,
        present: true,
        posture: "real_input_contract",
      },
      {
        component_id: "morning-brief-composer",
        version: MORNING_BRIEF_COMPOSER_VERSION,
        present: true,
        posture: "deterministic_composer",
      },
      {
        component_id: "morning-brief-preview-generator",
        version: MORNING_BRIEF_REAL_PREVIEW_VERSION,
        present: true,
        posture: "deterministic_preview",
      },
      {
        component_id: "morning-brief-suggestion-payload",
        version: MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION,
        present: true,
        posture: "suggestion_payload",
      },
      {
        component_id: "morning-brief-scheduler-plan",
        version: MORNING_BRIEF_SCHEDULER_PLAN_VERSION,
        present: true,
        posture: "scheduler_metadata",
      },
      {
        component_id: "morning-brief-inbox-delivery",
        version: MORNING_BRIEF_DELIVERY_VERSION,
        present: true,
        posture: "suggestion_inbox_delivery",
      },
      {
        component_id: "morning-brief-scheduler-invocation-boundary",
        version: MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION,
        present: true,
        posture: "scheduler_invocation_boundary",
      },
      {
        component_id: "shared-suggestion-inbox-delivery-bridge",
        version: SUGGESTION_INBOX_BRIDGE_VERSION,
        present: true,
        posture: "shared_delivery_bridge",
      },
    ],
    external_source_families: ["google_t0_read_metadata"],
    output_path: "morning_brief_preview_to_suggestion_inbox_delivery",
    schedule_summary: {
      local_time: "08:00",
      frequency: "daily",
      output_target: "suggestion_inbox",
      kill_switch_supported: true,
      input_must_be_supplied: true,
      daemon_started: false,
      metadata_only: true,
    },
    governance: {
      workflow_status:
        "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
      suggestion_only: true,
      metadata_only: true,
      read_only_google_inputs_only: true,
      google_t0_read_stack_present: true,
      minimum_viable_input_rules_present: true,
      degraded_modes_present: true,
      suggestion_payload_builder_present: true,
      suggestion_inbox_delivery_present: true,
      injected_delivery_supported: true,
      scheduler_metadata_present: true,
      scheduler_invocation_boundary_present: true,
      idempotency_dedupe_present: true,
      delivery_user_visible_through_inbox_item: true,
      scheduler_daemon_started: false,
      auto_send_supported: false,
      auto_execute_supported: false,
      action_execution_attempted: false,
      approval_finalization_supported: false,
      approval_finalization_attempted: false,
      provider_call_supported: false,
      network_call_supported: false,
      live_adapter_call_inside_morning_brief_supported: false,
      filesystem_write_supported: false,
      database_write_supported: false,
      mutation_supported: false,
      new_authority_surface_added: false,
    },
    readme_safe_wording: [
      "Morning Brief realized as scheduled Suggestion Inbox delivery workflow",
      "It consumes supplied Google T0 read metadata, composes deterministically, and delivers a metadata-only Suggestion Inbox item through an injected or local inbox boundary.",
      "Daily 08:00 local scheduling is represented as an invocation boundary with supplied input and a kill switch, not a background daemon.",
    ],
    future_work: [
      "Any action proposed from a brief must pass through the existing approval lifecycle.",
      "Live Google input resolution remains in the Google T0 read stack, not the Morning Brief composer, delivery, or scheduler invocation layers.",
      "Email send, calendar mutation, Drive writes, digest action execution, and auto-approval remain out of scope.",
    ],
  });
}
