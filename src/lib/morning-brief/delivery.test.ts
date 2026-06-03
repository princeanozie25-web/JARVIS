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
import { createInMemorySuggestionInboxAdapter } from "../suggestion-inbox";
import {
  MORNING_BRIEF_DELIVERY_VERSION,
  buildMorningBriefInboxItem,
  buildMorningBriefPreview,
  deliverMorningBriefToSuggestionInbox,
  summarizeMorningBriefDelivery,
  type MorningBriefRealInput,
} from ".";

describe("Morning Brief live Suggestion Inbox delivery", () => {
  it("builds a user-visible Morning Brief inbox item from a preview", () => {
    const preview = buildMorningBriefPreview(realInput(), {
      generated_at: "2026-06-03T08:00:00.000Z",
      preview_id: "morning-brief:preview:delivery",
    });

    const item = buildMorningBriefInboxItem(preview);

    expect(item.kind).toBe("morning_brief");
    expect(item.id).toBe(
      "inbox_item:morning_brief:morning-brief:preview:delivery",
    );
    expect(item.user_visible).toBe(true);
    expect(item.readiness_status).toBe("ready");
    expect(item.degraded).toBe(false);
    expect(item.sections.map((section) => section.section_id)).toEqual([
      "morning-brief:gmail",
      "morning-brief:calendar",
      "morning-brief:drive",
    ]);
    expect(item.governance.local_only).toBe(true);
    expect(item.governance.metadata_only).toBe(true);
    expect(item.governance.action_execution_supported).toBe(false);
    expect(item.governance.approval_finalization_supported).toBe(false);
    expect(item.raw_body_included).toBe(false);
  });

  it("delivers through an injected local adapter and returns delivery status", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const preview = buildMorningBriefPreview(realInput(), {
      generated_at: "2026-06-03T08:00:00.000Z",
      preview_id: "morning-brief:preview:live-delivery",
    });

    const result = await deliverMorningBriefToSuggestionInbox(
      { preview },
      { adapter },
    );
    const summary = summarizeMorningBriefDelivery(result);

    expect(result.delivery_version).toBe(MORNING_BRIEF_DELIVERY_VERSION);
    expect(result.delivered).toBe(true);
    expect(result.inbox_item_id).toBe(
      "inbox_item:morning_brief:morning-brief:preview:live-delivery",
    );
    expect(result.delivery_mode).toBe("in_memory");
    expect(result.execution_status).toBe("not_supported");
    expect(result.governance.suggestion_inbox_delivery_attempted).toBe(true);
    expect(result.governance.action_execution_attempted).toBe(false);
    expect(result.governance.approval_finalization_attempted).toBe(false);
    expect(summary.delivered).toBe(true);
    expect(adapter.listItems()).toHaveLength(1);
  });

  it("preserves degraded readiness without raw bodies or execution state", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const preview = buildMorningBriefPreview(realInput({ calendar: false }), {
      generated_at: "2026-06-03T08:00:00.000Z",
      preview_id: "morning-brief:preview:degraded",
    });

    const result = await deliverMorningBriefToSuggestionInbox(
      { preview },
      { adapter },
    );

    expect(result.delivered).toBe(true);
    expect(result.readiness_status).toBe("degraded");
    expect(result.degraded).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /raw_message|raw_event|raw_file/i,
    );
    expect(result.raw_body_included).toBe(false);
    expect(result.inbox_delivery.raw_body_included).toBe(false);
  });

  it("defaults to dry-run when no real adapter is supplied", async () => {
    const preview = buildMorningBriefPreview(realInput());
    const result = await deliverMorningBriefToSuggestionInbox({ preview });

    expect(result.delivered).toBe(false);
    expect(result.inbox_item_id).toBeNull();
    expect(result.delivery_mode).toBe("dry_run");
    expect(result.adapter_id).toBe("dry-run-suggestion-inbox");
  });

  it("does not introduce provider, network, live Google, or approval code", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/delivery.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch/i,
    );
    expect(source).not.toMatch(/sendEmail|createEvent|downloadFile/);
    expect(source).not.toMatch(/executeApproval|finalizeApproval/);
    expect(source).not.toMatch(/writeFile|appendFile|setInterval/);
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
    built_at: "2026-06-03T07:45:00.000Z",
    google: {
      account_summary: null,
      gmail: includeGmail
        ? {
            recent_messages: [gmailMessage("gmail-message-1")],
            unread_messages: [],
            metadata_only: true,
            raw_message_bodies_included: false,
          }
        : null,
      calendar: includeCalendar
        ? {
            todays_events: [calendarEvent("calendar-event-1")],
            upcoming_events: [],
            metadata_only: true,
            raw_event_descriptions_included: false,
            attendee_email_lists_included: false,
          }
        : null,
      drive: includeDrive
        ? {
            recent_files: [driveFile("drive-file-1")],
            search_results: [],
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
    timestamp: "2026-06-03T07:30:00.000Z",
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
    start_time: "2026-06-03T08:30:00.000Z",
    end_time: "2026-06-03T09:00:00.000Z",
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
    modified_time: "2026-06-03T07:00:00.000Z",
    owner_domain: "example.com",
    size_bytes: 1024,
    web_view_link: "https://drive.google.com/file/d/example/view",
    raw_file_contents_included: false,
    document_body_included: false,
    permission_list_included: false,
  };
}
