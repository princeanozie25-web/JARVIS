import { z } from "zod";
import {
  CalendarReadEventMetadataSchema,
  DriveReadFileMetadataSchema,
  GmailReadMessageMetadataSchema,
  GoogleConnectionSummarySchema,
} from "../google-adapters";
import { JobScoutDigestSchema } from "../job-scout";

export const MORNING_BRIEF_REAL_INPUT_VERSION =
  "phase21c.morning-brief-real-input.v1" as const;

export const MORNING_BRIEF_INPUT_SOURCE_STATUSES = [
  "present",
  "missing",
  "degraded",
  "optional",
  "unavailable",
] as const;

export const MORNING_BRIEF_INPUT_READINESS_STATUSES = [
  "ready",
  "degraded",
  "not_ready",
] as const;

export const MORNING_BRIEF_REAL_INPUT_GOVERNANCE = {
  contract_only: true,
  consumes_google_adapter_outputs_only: true,
  gmail_live_call_supported: false,
  calendar_live_call_supported: false,
  drive_live_call_supported: false,
  generation_supported: false,
  scheduling_supported: false,
  delivery_supported: false,
  suggestion_inbox_write_supported: false,
  model_call_supported: false,
  network_call_supported: false,
  filesystem_write_supported: false,
  database_write_supported: false,
  approval_execution_supported: false,
  new_authority_surface_added: false,
  metadata_only: true,
} as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const SourceReasonSchema = z.string().trim().min(1).max(160);

export const MorningBriefSourceStatusSchema = z.enum(
  MORNING_BRIEF_INPUT_SOURCE_STATUSES,
);

export const MorningBriefInputReadinessStatusSchema = z.enum(
  MORNING_BRIEF_INPUT_READINESS_STATUSES,
);

export const MorningBriefGmailInputSchema = z.strictObject({
  recent_messages: z.array(GmailReadMessageMetadataSchema).default([]),
  unread_messages: z.array(GmailReadMessageMetadataSchema).default([]),
  metadata_only: z.literal(true),
  raw_message_bodies_included: z.literal(false),
});

export const MorningBriefCalendarInputSchema = z.strictObject({
  todays_events: z.array(CalendarReadEventMetadataSchema).default([]),
  upcoming_events: z.array(CalendarReadEventMetadataSchema).default([]),
  metadata_only: z.literal(true),
  raw_event_descriptions_included: z.literal(false),
  attendee_email_lists_included: z.literal(false),
});

export const MorningBriefDriveInputSchema = z.strictObject({
  recent_files: z.array(DriveReadFileMetadataSchema).default([]),
  search_results: z.array(DriveReadFileMetadataSchema).default([]),
  metadata_only: z.literal(true),
  raw_file_contents_included: z.literal(false),
  document_bodies_included: z.literal(false),
  permission_lists_included: z.literal(false),
});

export const MorningBriefGoogleInputSchema = z.strictObject({
  account_summary: GoogleConnectionSummarySchema.nullable().default(null),
  gmail: MorningBriefGmailInputSchema.nullable().default(null),
  calendar: MorningBriefCalendarInputSchema.nullable().default(null),
  drive: MorningBriefDriveInputSchema.nullable().default(null),
  metadata_only: z.literal(true),
  live_calls_attempted: z.literal(false),
});

export const MorningBriefRealInputSchema = z.strictObject({
  input_version: z.literal(MORNING_BRIEF_REAL_INPUT_VERSION),
  built_at: IsoDateTimeSchema,
  google: MorningBriefGoogleInputSchema,
  jarvis_status_metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .default(null),
  agent_preview_metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .default(null),
  job_scout_digest: JobScoutDigestSchema.nullable().default(null),
  metadata_only: z.literal(true),
  generation_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  delivery_requested: z.literal(false),
  model_call_requested: z.literal(false),
  network_call_requested: z.literal(false),
  write_requested: z.literal(false),
});

export const MorningBriefSourceReadinessSchema = z.strictObject({
  source: z.enum(["gmail", "calendar", "drive"]),
  status: MorningBriefSourceStatusSchema,
  item_count: z.number().int().nonnegative(),
  required_for_minimum_viable_brief: z.boolean(),
  reasons: z.array(SourceReasonSchema),
});

export const MorningBriefInputReadinessSchema = z.strictObject({
  input_version: z.literal(MORNING_BRIEF_REAL_INPUT_VERSION),
  status: MorningBriefInputReadinessStatusSchema,
  minimum_viable_input_exists: z.boolean(),
  gmail: MorningBriefSourceReadinessSchema,
  calendar: MorningBriefSourceReadinessSchema,
  drive: MorningBriefSourceReadinessSchema,
  missing_required_sources: z.array(z.enum(["gmail", "calendar"])),
  optional_unavailable_sources: z.array(z.enum(["drive"])),
  governance: z.strictObject({
    metadata_only: z.literal(true),
    live_google_calls_attempted: z.literal(false),
    scheduler_invoked: z.literal(false),
    delivery_attempted: z.literal(false),
    suggestion_inbox_write_attempted: z.literal(false),
    model_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    filesystem_write_attempted: z.literal(false),
    database_write_attempted: z.literal(false),
    approval_execution_attempted: z.literal(false),
    new_authority_surface_added: z.literal(false),
  }),
});

export type MorningBriefSourceStatus = z.infer<
  typeof MorningBriefSourceStatusSchema
>;
export type MorningBriefInputReadinessStatus = z.infer<
  typeof MorningBriefInputReadinessStatusSchema
>;
export type MorningBriefGmailInput = z.infer<
  typeof MorningBriefGmailInputSchema
>;
export type MorningBriefCalendarInput = z.infer<
  typeof MorningBriefCalendarInputSchema
>;
export type MorningBriefDriveInput = z.infer<
  typeof MorningBriefDriveInputSchema
>;
export type MorningBriefGoogleInput = z.infer<
  typeof MorningBriefGoogleInputSchema
>;
export type MorningBriefRealInput = z.input<typeof MorningBriefRealInputSchema>;
export type MorningBriefParsedRealInput = z.infer<
  typeof MorningBriefRealInputSchema
>;
export type MorningBriefSourceReadiness = z.infer<
  typeof MorningBriefSourceReadinessSchema
>;
export type MorningBriefInputReadiness = z.infer<
  typeof MorningBriefInputReadinessSchema
>;

export function buildMorningBriefInputReadiness(
  input: MorningBriefRealInput,
): MorningBriefInputReadiness {
  const parsed = MorningBriefRealInputSchema.parse(input);
  const gmailCount =
    (parsed.google.gmail?.recent_messages.length ?? 0) +
    (parsed.google.gmail?.unread_messages.length ?? 0);
  const calendarCount =
    (parsed.google.calendar?.todays_events.length ?? 0) +
    (parsed.google.calendar?.upcoming_events.length ?? 0);
  const driveCount =
    (parsed.google.drive?.recent_files.length ?? 0) +
    (parsed.google.drive?.search_results.length ?? 0);

  const gmail = requiredReadiness("gmail", gmailCount);
  const calendar = requiredReadiness("calendar", calendarCount);
  const drive = driveReadiness(driveCount, Boolean(parsed.google.drive));
  const minimum = gmailCount > 0 || calendarCount > 0;
  const missingRequiredSources = [
    ...(gmailCount > 0 ? [] : ["gmail" as const]),
    ...(calendarCount > 0 ? [] : ["calendar" as const]),
  ];
  const optionalUnavailableSources = driveCount > 0 ? [] : ["drive" as const];

  return MorningBriefInputReadinessSchema.parse({
    input_version: MORNING_BRIEF_REAL_INPUT_VERSION,
    status:
      gmailCount > 0 && calendarCount > 0
        ? "ready"
        : minimum
          ? "degraded"
          : "not_ready",
    minimum_viable_input_exists: minimum,
    gmail,
    calendar,
    drive,
    missing_required_sources: missingRequiredSources,
    optional_unavailable_sources: optionalUnavailableSources,
    governance: {
      metadata_only: true,
      live_google_calls_attempted: false,
      scheduler_invoked: false,
      delivery_attempted: false,
      suggestion_inbox_write_attempted: false,
      model_call_attempted: false,
      network_call_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      approval_execution_attempted: false,
      new_authority_surface_added: false,
    },
  });
}

function requiredReadiness(
  source: "gmail" | "calendar",
  itemCount: number,
): MorningBriefSourceReadiness {
  return MorningBriefSourceReadinessSchema.parse({
    source,
    status: itemCount > 0 ? "present" : "missing",
    item_count: itemCount,
    required_for_minimum_viable_brief: true,
    reasons: itemCount > 0 ? ["metadata_present"] : ["metadata_missing"],
  });
}

function driveReadiness(
  itemCount: number,
  inputPresent: boolean,
): MorningBriefSourceReadiness {
  return MorningBriefSourceReadinessSchema.parse({
    source: "drive",
    status:
      itemCount > 0 ? "present" : inputPresent ? "unavailable" : "optional",
    item_count: itemCount,
    required_for_minimum_viable_brief: false,
    reasons:
      itemCount > 0
        ? ["metadata_present"]
        : inputPresent
          ? ["optional_metadata_empty"]
          : ["optional_source_not_provided"],
  });
}
