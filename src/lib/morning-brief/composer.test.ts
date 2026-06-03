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
  MORNING_BRIEF_COMPOSER_GOVERNANCE,
  MORNING_BRIEF_COMPOSER_VERSION,
  composeMorningBrief,
  type MorningBriefRealInput,
} from ".";

describe("Morning Brief composer", () => {
  it("composes Gmail and Calendar metadata into a full brief", () => {
    const brief = composeMorningBrief(realInput(), {
      generated_at: "2026-06-03T09:30:00.000Z",
    });

    expect(brief.composer_version).toBe(MORNING_BRIEF_COMPOSER_VERSION);
    expect(brief.composition_status).toBe("composed");
    expect(brief.readiness.status).toBe("ready");
    expect(brief.sections.map((section) => section.section_type)).toEqual([
      "gmail",
      "calendar",
      "drive",
    ]);
    expect(
      brief.sections.find((section) => section.section_type === "gmail"),
    ).toMatchObject({
      title: "Gmail metadata",
      item_count: 2,
      metadata: {
        recent_count: 1,
        unread_count: 1,
        sender_domains: ["example.com"],
      },
    });
    expect(
      brief.sections.find((section) => section.section_type === "calendar"),
    ).toMatchObject({
      title: "Calendar metadata",
      item_count: 2,
      metadata: {
        today_count: 1,
        upcoming_count: 1,
      },
    });
  });

  it("composes Gmail-only input as a degraded brief", () => {
    const brief = composeMorningBrief(realInput({ calendar: false }));

    expect(brief.composition_status).toBe("degraded");
    expect(brief.readiness.status).toBe("degraded");
    expect(brief.sections.map((section) => section.section_type)).toEqual([
      "gmail",
      "drive",
    ]);
    expect(brief.readiness.missing_required_sources).toEqual(["calendar"]);
  });

  it("composes Calendar-only input as a degraded brief", () => {
    const brief = composeMorningBrief(realInput({ gmail: false }));

    expect(brief.composition_status).toBe("degraded");
    expect(brief.readiness.status).toBe("degraded");
    expect(brief.sections.map((section) => section.section_type)).toEqual([
      "calendar",
      "drive",
    ]);
    expect(brief.readiness.missing_required_sources).toEqual(["gmail"]);
  });

  it("includes optional Drive section when Drive metadata is supplied", () => {
    const brief = composeMorningBrief(realInput());
    const drive = brief.sections.find(
      (section) => section.section_type === "drive",
    );

    expect(drive).toMatchObject({
      title: "Drive metadata",
      status: "present",
      item_count: 2,
      metadata: {
        recent_count: 1,
        search_result_count: 1,
        mime_types: ["application/vnd.google-apps.document"],
        owner_domains: ["example.com"],
      },
    });
  });

  it("fails closed when no required Gmail or Calendar metadata exists", () => {
    const brief = composeMorningBrief(
      realInput({ gmail: false, calendar: false, drive: true }),
    );

    expect(brief.composition_status).toBe("failed_closed");
    expect(brief.readiness.minimum_viable_input_exists).toBe(false);
    expect(brief.sections).toEqual([]);
    expect(brief.governance.delivery_attempted).toBe(false);
  });

  it("includes readiness and governance metadata", () => {
    const brief = composeMorningBrief(realInput());

    expect(brief.readiness.minimum_viable_input_exists).toBe(true);
    expect(brief.governance).toMatchObject({
      read_only: true,
      input_driven: true,
      deterministic: true,
      preview_only: true,
      metadata_governed: true,
      live_google_calls_attempted: false,
      scheduler_invoked: false,
      delivery_attempted: false,
      suggestion_inbox_write_attempted: false,
      model_call_attempted: false,
      network_call_attempted: false,
      filesystem_write_attempted: false,
      database_write_attempted: false,
      approval_execution_attempted: false,
      mutation_attempted: false,
      new_authority_surface_added: false,
      metadata_only: true,
    });
    expect(MORNING_BRIEF_COMPOSER_GOVERNANCE.preview_only).toBe(true);
  });

  it("excludes raw email, calendar, and Drive bodies from composed output", () => {
    const brief = composeMorningBrief(realInput());
    const serialized = JSON.stringify(brief);

    expect(serialized).not.toContain("Raw email body");
    expect(serialized).not.toContain("Raw calendar description");
    expect(serialized).not.toContain("Raw Drive document body");
    expect(serialized).not.toContain("attendee@example.com");
    expect(serialized).not.toContain("writer@example.com");
    expect(brief.raw_body_included).toBe(false);
    for (const section of brief.sections) {
      expect(section.raw_body_included).toBe(false);
      for (const item of section.items) {
        expect(item.raw_body_included).toBe(false);
      }
    }
  });

  it("is deterministic for identical input and options", () => {
    const input = realInput();
    const options = { generated_at: "2026-06-03T09:30:00.000Z" };

    expect(composeMorningBrief(input, options)).toEqual(
      composeMorningBrief(input, options),
    );
  });

  it("has no live adapter, provider, network, scheduler, write, or execution affordances", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/composer.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch/,
    );
    expect(source).not.toMatch(
      /createGmailReadAdapter|createCalendarReadAdapter|createDriveReadAdapter/,
    );
    expect(source).not.toMatch(/writeFile|readFile|setInterval|setTimeout/);
    expect(source).not.toMatch(/SuggestionInbox|executeApproval/i);
  });
});

function realInput(options?: {
  readonly gmail?: boolean;
  readonly calendar?: boolean;
  readonly drive?: boolean;
  readonly jarvis?: boolean;
  readonly agents?: boolean;
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
            recent_messages: [
              gmailMessage("gmail-message-1", "Metadata subject"),
            ],
            unread_messages: [
              gmailMessage("gmail-message-2", "Urgent metadata"),
            ],
            metadata_only: true,
            raw_message_bodies_included: false,
          }
        : null,
      calendar: includeCalendar
        ? {
            todays_events: [calendarEvent("calendar-event-1", "Today event")],
            upcoming_events: [
              calendarEvent("calendar-event-2", "Upcoming event"),
            ],
            metadata_only: true,
            raw_event_descriptions_included: false,
            attendee_email_lists_included: false,
          }
        : null,
      drive: includeDrive
        ? {
            recent_files: [driveFile("drive-file-1", "Recent file")],
            search_results: [driveFile("drive-file-2", "Searched file")],
            metadata_only: true,
            raw_file_contents_included: false,
            document_bodies_included: false,
            permission_lists_included: false,
          }
        : null,
      metadata_only: true,
      live_calls_attempted: false,
    },
    jarvis_status_metadata: options?.jarvis ? { health: "green" } : null,
    agent_preview_metadata: options?.agents ? { build_monitor: "ready" } : null,
    metadata_only: true,
    generation_requested: false,
    scheduling_requested: false,
    delivery_requested: false,
    model_call_requested: false,
    network_call_requested: false,
    write_requested: false,
  };
}

function gmailMessage(id: string, subject: string): GmailReadMessageMetadata {
  return {
    adapter_version: GMAIL_READ_ADAPTER_VERSION,
    message_id: id,
    thread_id: `thread-${id}`,
    subject,
    sender: "Prince <prince@example.com>",
    sender_domain: "example.com",
    timestamp: "2026-06-03T08:30:00.000Z",
    label_ids: id.endsWith("2") ? ["INBOX", "IMPORTANT"] : ["INBOX"],
    size_estimate_bytes: 512,
    raw_body_included: false,
    attachment_contents_included: false,
  };
}

function calendarEvent(id: string, title: string): CalendarReadEventMetadata {
  return {
    adapter_version: CALENDAR_READ_ADAPTER_VERSION,
    event_id: id,
    calendar_id: "primary",
    title,
    start_time: id.endsWith("1")
      ? "2026-06-03T09:00:00.000Z"
      : "2026-06-04T09:00:00.000Z",
    end_time: id.endsWith("1")
      ? "2026-06-03T09:30:00.000Z"
      : "2026-06-04T09:30:00.000Z",
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

function driveFile(id: string, fileName: string): DriveReadFileMetadata {
  return {
    adapter_version: DRIVE_READ_ADAPTER_VERSION,
    file_id: id,
    file_name: fileName,
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
