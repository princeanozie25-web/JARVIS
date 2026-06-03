import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_READ_ADAPTER_VERSION,
  DRIVE_READ_ADAPTER_VERSION,
  GMAIL_READ_ADAPTER_VERSION,
  createGoogleAccountRuntime,
  summarizeGoogleAccountRuntime,
  type CalendarReadEventMetadata,
  type DriveReadFileMetadata,
  type GmailReadMessageMetadata,
} from "../google-adapters";
import {
  MORNING_BRIEF_REAL_PREVIEW_VERSION,
  buildMorningBriefPreview,
  type MorningBriefRealInput,
} from ".";

describe("Morning Brief preview generator", () => {
  it("builds a deterministic preview from valid real input", () => {
    const input = realInput();
    const options = {
      generated_at: "2026-06-03T09:30:00.000Z",
      preview_id: "morning-brief:preview:test",
    };

    const preview = buildMorningBriefPreview(input, options);

    expect(preview).toEqual(buildMorningBriefPreview(input, options));
    expect(preview.preview_version).toBe(MORNING_BRIEF_REAL_PREVIEW_VERSION);
    expect(preview.status).toBe("preview_ready");
    expect(preview.composition_status).toBe("composed");
    expect(preview.title).toBe("Morning Brief Preview");
    expect(preview.generated_at).toBe("2026-06-03T09:30:00.000Z");
    expect(preview.source_built_at).toBe("2026-06-03T09:00:00.000Z");
    expect(preview.section_count).toBe(3);
    expect(preview.sections.map((section) => section.section_type)).toEqual([
      "gmail",
      "calendar",
      "drive",
    ]);
  });

  it("preserves degraded status from the composer", () => {
    const preview = buildMorningBriefPreview(realInput({ calendar: false }));

    expect(preview.status).toBe("preview_degraded");
    expect(preview.degraded).toBe(true);
    expect(preview.readiness.status).toBe("degraded");
    expect(preview.readiness.missing_required_sources).toEqual(["calendar"]);
    expect(preview.governance_notes).toContain(
      "degraded_required_input_missing",
    );
  });

  it("returns failed closed preview when minimum input is missing", () => {
    const preview = buildMorningBriefPreview(
      realInput({ gmail: false, calendar: false, drive: true }),
    );

    expect(preview.status).toBe("failed_closed");
    expect(preview.degraded).toBe(true);
    expect(preview.sections).toEqual([]);
    expect(preview.governance_notes).toContain(
      "failed_closed_missing_required_input",
    );
  });

  it("includes sections suitable for future UI and inbox rendering without writing", () => {
    const preview = buildMorningBriefPreview(realInput());

    expect(preview.suitable_for_future_ui).toBe(true);
    expect(preview.suitable_for_future_suggestion_inbox).toBe(true);
    expect(preview.preview_only).toBe(true);
    expect(preview.delivery_attempted).toBe(false);
    expect(preview.scheduling_attempted).toBe(false);
    expect(preview.suggestion_inbox_write_attempted).toBe(false);
    expect(preview.write_attempted).toBe(false);
    for (const section of preview.sections) {
      expect(section.metadata_only).toBe(true);
      expect(section.raw_body_included).toBe(false);
    }
  });

  it("has no scheduler, inbox, network, provider, write, or execution affordances", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/real-preview.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch/,
    );
    expect(imports.join("\n")).not.toMatch(
      /scheduler|suggestion-inbox|orchestrator/i,
    );
    expect(source).not.toMatch(
      /createGmailReadAdapter|createCalendarReadAdapter|createDriveReadAdapter/,
    );
    expect(source).not.toMatch(/writeFile|readFile|setInterval|setTimeout/);
    expect(source).not.toMatch(
      /executeApproval|sendEmail|createEvent|downloadFile/,
    );
  });
});

function realInput(options?: {
  readonly gmail?: boolean;
  readonly calendar?: boolean;
  readonly drive?: boolean;
}): MorningBriefRealInput {
  const includeGmail = options?.gmail ?? true;
  const includeCalendar = options?.calendar ?? true;
  const includeDrive = options?.drive ?? true;

  return {
    input_version: "phase21c.morning-brief-real-input.v1",
    built_at: "2026-06-03T09:00:00.000Z",
    google: {
      account_summary: summarizeGoogleAccountRuntime(
        createGoogleAccountRuntime({
          runtime_version: "phase21b.google-account-runtime.v1",
          checked_at: "2026-06-03T09:00:00.000Z",
          token_metadata: {
            access_token_present: true,
            refresh_token_present: true,
            expires_at: "2026-06-03T10:00:00.000Z",
            revoked_at: null,
            raw_access_token_included: false,
            raw_refresh_token_included: false,
            raw_credentials_included: false,
          },
          granted_scopes: [
            "https://www.googleapis.com/auth/gmail.metadata",
            "https://www.googleapis.com/auth/calendar.events.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
          ],
          adapter_configuration: {
            gmail_configured: true,
            calendar_configured: true,
            drive_configured: true,
          },
          observed_latency_ms: 7,
          telemetry_metadata_only: true,
        }),
      ),
      gmail: includeGmail
        ? {
            recent_messages: [gmailMessage("gmail-message-1")],
            unread_messages: [gmailMessage("gmail-message-2")],
            metadata_only: true,
            raw_message_bodies_included: false,
          }
        : null,
      calendar: includeCalendar
        ? {
            todays_events: [calendarEvent("calendar-event-1")],
            upcoming_events: [calendarEvent("calendar-event-2")],
            metadata_only: true,
            raw_event_descriptions_included: false,
            attendee_email_lists_included: false,
          }
        : null,
      drive: includeDrive
        ? {
            recent_files: [driveFile("drive-file-1")],
            search_results: [driveFile("drive-file-2")],
            metadata_only: true,
            raw_file_contents_included: false,
            document_bodies_included: false,
            permission_lists_included: false,
          }
        : null,
      metadata_only: true,
      live_calls_attempted: false,
    },
    jarvis_status_metadata: null,
    agent_preview_metadata: null,
    metadata_only: true,
    generation_requested: false,
    scheduling_requested: false,
    delivery_requested: false,
    model_call_requested: false,
    network_call_requested: false,
    write_requested: false,
  };
}

function gmailMessage(id: string): GmailReadMessageMetadata {
  return {
    adapter_version: GMAIL_READ_ADAPTER_VERSION,
    message_id: id,
    thread_id: `thread-${id}`,
    subject: "Metadata subject",
    sender: "Prince <prince@example.com>",
    sender_domain: "example.com",
    timestamp: "2026-06-03T08:30:00.000Z",
    label_ids: ["INBOX"],
    size_estimate_bytes: 512,
    raw_body_included: false,
    attachment_contents_included: false,
  };
}

function calendarEvent(id: string): CalendarReadEventMetadata {
  return {
    adapter_version: CALENDAR_READ_ADAPTER_VERSION,
    event_id: id,
    calendar_id: "primary",
    title: "Metadata event",
    start_time: "2026-06-03T09:00:00.000Z",
    end_time: "2026-06-03T09:30:00.000Z",
    location: "Command Center",
    attendee_count: 1,
    status: "confirmed",
    organizer_domain: "example.com",
    raw_description_included: false,
    attendee_email_list_included: false,
    conference_links_included: false,
    attachment_contents_included: false,
  };
}

function driveFile(id: string): DriveReadFileMetadata {
  return {
    adapter_version: DRIVE_READ_ADAPTER_VERSION,
    file_id: id,
    file_name: "Metadata file",
    mime_type: "application/vnd.google-apps.document",
    modified_time: "2026-06-03T08:00:00.000Z",
    owner_domain: "example.com",
    size_bytes: 1024,
    web_view_link: "https://drive.google.com/file/d/example/view",
    raw_file_contents_included: false,
    document_body_included: false,
    permission_list_included: false,
  };
}
