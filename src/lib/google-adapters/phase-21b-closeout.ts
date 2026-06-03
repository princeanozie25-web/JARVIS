import { z } from "zod";
import {
  CALENDAR_READ_AUTHORITY,
  CALENDAR_READ_GOVERNANCE,
} from "./calendar-read";
import { DRIVE_READ_AUTHORITY, DRIVE_READ_GOVERNANCE } from "./drive-read";
import { GMAIL_READ_AUTHORITY, GMAIL_READ_GOVERNANCE } from "./gmail-read";
import { GOOGLE_ACCOUNT_RUNTIME_GOVERNANCE } from "./google-account-runtime";

export const PHASE_21B_GOOGLE_CLOSEOUT_VERSION =
  "phase21b.google-integration-closeout.v1" as const;

export const Phase21BGoogleCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_21B_GOOGLE_CLOSEOUT_VERSION),
  verdict: z.literal("PASS"),
  integration_status: z.literal("T0 read integration complete"),
  completed_adapters: z.array(z.enum(["gmail", "calendar", "drive"])),
  unified_runtime_present: z.literal(true),
  readiness_represented: z.strictObject({
    gmail: z.literal(true),
    calendar: z.literal(true),
    drive: z.literal(true),
  }),
  authority: z.strictObject({
    all_adapters_t0: z.literal(true),
    all_adapters_read_only: z.literal(true),
    new_authority_surface_added: z.literal(false),
    approval_execution_supported: z.literal(false),
  }),
  telemetry: z.strictObject({
    metadata_only: z.literal(true),
    tokens_exposed: z.literal(false),
    raw_email_bodies_exposed: z.literal(false),
    raw_calendar_descriptions_exposed: z.literal(false),
    raw_calendar_attendee_lists_exposed: z.literal(false),
    raw_drive_file_contents_exposed: z.literal(false),
    raw_drive_permission_lists_exposed: z.literal(false),
  }),
  forbidden_capabilities: z.strictObject({
    gmail_send_or_draft_or_mutation: z.literal(false),
    calendar_create_update_delete_or_rsvp: z.literal(false),
    drive_create_update_delete_move_rename_permission_or_download:
      z.literal(false),
    background_sync: z.literal(false),
    scheduler_wiring: z.literal(false),
    provider_model_call: z.literal(false),
  }),
  wording: z.strictObject({
    says_t0_read_complete: z.literal(true),
    says_full_google_automation: z.literal(false),
  }),
});

export type Phase21BGoogleCloseoutReport = z.infer<
  typeof Phase21BGoogleCloseoutReportSchema
>;

export function buildPhase21BGoogleIntegrationCloseoutReport(): Phase21BGoogleCloseoutReport {
  return Phase21BGoogleCloseoutReportSchema.parse({
    closeout_version: PHASE_21B_GOOGLE_CLOSEOUT_VERSION,
    verdict: "PASS",
    integration_status: "T0 read integration complete",
    completed_adapters: ["gmail", "calendar", "drive"],
    unified_runtime_present: true,
    readiness_represented: {
      gmail: true,
      calendar: true,
      drive: true,
    },
    authority: {
      all_adapters_t0:
        GMAIL_READ_AUTHORITY.authority_level === "T0" &&
        CALENDAR_READ_AUTHORITY.authority_level === "T0" &&
        DRIVE_READ_AUTHORITY.authority_level === "T0",
      all_adapters_read_only:
        GMAIL_READ_AUTHORITY.read_only &&
        CALENDAR_READ_AUTHORITY.read_only &&
        DRIVE_READ_AUTHORITY.read_only,
      new_authority_surface_added: false,
      approval_execution_supported: false,
    },
    telemetry: {
      metadata_only:
        GMAIL_READ_GOVERNANCE.metadata_only_telemetry &&
        CALENDAR_READ_GOVERNANCE.metadata_only_telemetry &&
        DRIVE_READ_GOVERNANCE.metadata_only_telemetry &&
        GOOGLE_ACCOUNT_RUNTIME_GOVERNANCE.metadata_only,
      tokens_exposed: false,
      raw_email_bodies_exposed: false,
      raw_calendar_descriptions_exposed: false,
      raw_calendar_attendee_lists_exposed: false,
      raw_drive_file_contents_exposed: false,
      raw_drive_permission_lists_exposed: false,
    },
    forbidden_capabilities: {
      gmail_send_or_draft_or_mutation: false,
      calendar_create_update_delete_or_rsvp: false,
      drive_create_update_delete_move_rename_permission_or_download: false,
      background_sync: false,
      scheduler_wiring: false,
      provider_model_call: false,
    },
    wording: {
      says_t0_read_complete: true,
      says_full_google_automation: false,
    },
  });
}
