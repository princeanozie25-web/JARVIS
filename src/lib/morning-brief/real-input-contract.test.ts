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
  MORNING_BRIEF_REAL_INPUT_GOVERNANCE,
  MORNING_BRIEF_REAL_INPUT_VERSION,
  buildMorningBriefInputReadiness,
  type MorningBriefRealInput,
} from ".";

describe("Morning Brief real input contract", () => {
  it("passes readiness with Gmail and Calendar metadata", () => {
    const readiness = buildMorningBriefInputReadiness(realInput());

    expect(readiness.status).toBe("ready");
    expect(readiness.minimum_viable_input_exists).toBe(true);
    expect(readiness.gmail).toMatchObject({
      source: "gmail",
      status: "present",
      item_count: 2,
      required_for_minimum_viable_brief: true,
    });
    expect(readiness.calendar).toMatchObject({
      source: "calendar",
      status: "present",
      item_count: 2,
      required_for_minimum_viable_brief: true,
    });
    expect(readiness.missing_required_sources).toEqual([]);
  });

  it("passes degraded readiness with Gmail only", () => {
    const readiness = buildMorningBriefInputReadiness(
      realInput({ calendar: false }),
    );

    expect(readiness.status).toBe("degraded");
    expect(readiness.minimum_viable_input_exists).toBe(true);
    expect(readiness.gmail.status).toBe("present");
    expect(readiness.calendar.status).toBe("missing");
    expect(readiness.missing_required_sources).toEqual(["calendar"]);
  });

  it("passes degraded readiness with Calendar only", () => {
    const readiness = buildMorningBriefInputReadiness(
      realInput({ gmail: false }),
    );

    expect(readiness.status).toBe("degraded");
    expect(readiness.minimum_viable_input_exists).toBe(true);
    expect(readiness.gmail.status).toBe("missing");
    expect(readiness.calendar.status).toBe("present");
    expect(readiness.missing_required_sources).toEqual(["gmail"]);
  });

  it("marks Drive as optional when missing and present when supplied", () => {
    const missingDrive = buildMorningBriefInputReadiness(
      realInput({ drive: false }),
    );
    const presentDrive = buildMorningBriefInputReadiness(realInput());

    expect(missingDrive.drive).toMatchObject({
      source: "drive",
      status: "optional",
      required_for_minimum_viable_brief: false,
    });
    expect(missingDrive.optional_unavailable_sources).toEqual(["drive"]);
    expect(presentDrive.drive).toMatchObject({
      source: "drive",
      status: "present",
      item_count: 2,
      required_for_minimum_viable_brief: false,
    });
  });

  it("fails readiness when no required source exists", () => {
    const readiness = buildMorningBriefInputReadiness(
      realInput({ gmail: false, calendar: false, drive: true }),
    );

    expect(readiness.status).toBe("not_ready");
    expect(readiness.minimum_viable_input_exists).toBe(false);
    expect(readiness.missing_required_sources).toEqual(["gmail", "calendar"]);
    expect(readiness.drive.status).toBe("present");
  });

  it("returns explicit governance posture with no live calls or writes", () => {
    const readiness = buildMorningBriefInputReadiness(realInput());

    expect(MORNING_BRIEF_REAL_INPUT_GOVERNANCE).toMatchObject({
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
    });
    expect(readiness.governance).toEqual({
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
    });
  });

  it("does not introduce scheduler, inbox, network, provider, or write affordances", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/real-input-contract.ts"),
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
    input_version: MORNING_BRIEF_REAL_INPUT_VERSION,
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
