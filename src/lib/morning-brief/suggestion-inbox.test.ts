import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_READ_ADAPTER_VERSION,
  DRIVE_READ_ADAPTER_VERSION,
  GMAIL_READ_ADAPTER_VERSION,
  type CalendarReadEventMetadata,
  type DriveReadFileMetadata,
  type GmailReadMessageMetadata,
} from "../google-adapters";
import {
  MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION,
  buildMorningBriefPreview,
  buildMorningBriefSuggestionPayload,
  planMorningBriefSuggestionInboxWrite,
  type MorningBriefRealInput,
  type MorningBriefSuggestionWriter,
} from ".";

describe("Morning Brief Suggestion Inbox integration", () => {
  it("builds a suggestion-only digest payload from a preview", () => {
    const preview = buildMorningBriefPreview(realInput(), {
      generated_at: "2026-06-03T09:30:00.000Z",
      preview_id: "morning-brief:preview:suggestion",
    });

    const payload = buildMorningBriefSuggestionPayload(preview);

    expect(payload.payload_version).toBe(
      MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION,
    );
    expect(payload.kind).toBe("suggestion.digest");
    expect(payload.suggestion_id).toBe(
      "suggestion:morning-brief:morning-brief:preview:suggestion",
    );
    expect(payload.preview_id).toBe(preview.preview_id);
    expect(payload.readiness_status).toBe("ready");
    expect(payload.degraded).toBe(false);
    expect(payload.section_count).toBe(3);
    expect(payload.sections.map((section) => section.section_type)).toEqual([
      "gmail",
      "calendar",
      "drive",
    ]);
    expect(payload.governance.suggestion_only).toBe(true);
    expect(payload.governance.digest_only).toBe(true);
    expect(payload.governance.action_execution_supported).toBe(false);
    expect(payload.governance.approval_finalization_supported).toBe(false);
    expect(payload.governance.send_supported).toBe(false);
    expect(payload.governance.apply_supported).toBe(false);
    expect(payload.write_attempted).toBe(false);
    expect(payload.execution_attempted).toBe(false);
    expect(payload.approval_finalization_attempted).toBe(false);
    expect(payload.raw_body_included).toBe(false);
  });

  it("preserves degraded readiness and governance metadata", () => {
    const preview = buildMorningBriefPreview(realInput({ calendar: false }));
    const payload = buildMorningBriefSuggestionPayload(preview);

    expect(payload.readiness_status).toBe("degraded");
    expect(payload.degraded).toBe(true);
    expect(payload.readiness.missing_required_sources).toEqual(["calendar"]);
    expect(payload.composer_governance.live_google_calls_attempted).toBe(false);
    expect(payload.governance_notes).toContain("suggestion_only_digest");
  });

  it("defaults the write planner to dry-run without invoking a writer", async () => {
    const preview = buildMorningBriefPreview(realInput());
    const plan = await planMorningBriefSuggestionInboxWrite(preview);

    expect(plan.status).toBe("dry_run");
    expect(plan.dry_run).toBe(true);
    expect(plan.writer_injected).toBe(false);
    expect(plan.real_inbox_write_attempted).toBe(false);
    expect(plan.write_attempted).toBe(false);
    expect(plan.execution_attempted).toBe(false);
    expect(plan.approval_finalization_attempted).toBe(false);
    expect(plan.writer_result).toBeNull();
  });

  it("supports an injected preview-only writer without marking a real inbox write", async () => {
    const preview = buildMorningBriefPreview(realInput());
    const seenIds: string[] = [];
    const writer: MorningBriefSuggestionWriter = {
      writer_id: "test-writer",
      preview_only: true,
      writePreviewPayload(payload) {
        seenIds.push(payload.suggestion_id);
        return {
          writer_id: "test-writer",
          accepted: true,
          wrote_to_real_inbox: false,
          result_metadata_only: true,
        };
      },
    };

    const plan = await planMorningBriefSuggestionInboxWrite(preview, writer);

    expect(plan.status).toBe("injected_writer_planned");
    expect(seenIds).toEqual([plan.payload.suggestion_id]);
    expect(plan.writer_injected).toBe(true);
    expect(plan.writer_result?.accepted).toBe(true);
    expect(plan.writer_result?.wrote_to_real_inbox).toBe(false);
    expect(plan.real_inbox_write_attempted).toBe(false);
    expect(plan.write_attempted).toBe(false);
  });

  it("declares no network, provider, scheduler, approval, or real inbox affordances", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/suggestion-inbox.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch|scheduler/i,
    );
    expect(source).not.toMatch(/setInterval|setTimeout|writeFile|appendFile/);
    expect(source).not.toMatch(/sendEmail|createEvent|downloadFile/);
    expect(source).not.toMatch(/executeApproval|finalizeApproval/);
    expect(source).not.toMatch(/createSuggestionInboxEntry|insertSuggestion/);
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
      account_summary: null,
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
