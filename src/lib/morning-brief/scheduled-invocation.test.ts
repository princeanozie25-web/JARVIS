import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_READ_ADAPTER_VERSION,
  GMAIL_READ_ADAPTER_VERSION,
  type CalendarReadEventMetadata,
  type GmailReadMessageMetadata,
} from "../google-adapters";
import { createInMemorySuggestionInboxAdapter } from "../suggestion-inbox";
import {
  MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION,
  MORNING_BRIEF_SCHEDULED_JOB_ID,
  buildMorningBriefScheduledInvocation,
  runMorningBriefScheduledInvocation,
  type MorningBriefRealInput,
} from ".";

describe("Morning Brief scheduler invocation boundary", () => {
  it("declares daily 08:00 local invocation metadata", () => {
    const invocation = buildMorningBriefScheduledInvocation();

    expect(invocation.invocation_version).toBe(
      MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION,
    );
    expect(invocation.job_id).toBe(MORNING_BRIEF_SCHEDULED_JOB_ID);
    expect(invocation.schedule.local_time).toBe("08:00");
    expect(invocation.schedule.timezone).toBe("local");
    expect(invocation.schedule.frequency).toBe("daily");
    expect(invocation.delivery_target).toBe("suggestion_inbox");
    expect(invocation.input_resolver_contract).toBe(
      "supplied_or_injected_metadata_input",
    );
    expect(invocation.kill_switch.supported).toBe(true);
    expect(invocation.idempotency.key_strategy).toBe(
      "job_id_plus_source_built_at",
    );
  });

  it("runs deterministically from supplied fixture input through an injected adapter", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const input = realInput();

    const first = await runMorningBriefScheduledInvocation(
      { real_input: input, invoked_at: "2026-06-03T08:00:00.000Z" },
      { adapter },
    );
    const second = await runMorningBriefScheduledInvocation(
      { real_input: input, invoked_at: "2026-06-03T08:00:00.000Z" },
      { adapter },
    );

    expect(first.delivered).toBe(true);
    expect(first.delivery?.delivered).toBe(true);
    expect(first.idempotency_key).toBe(
      `${MORNING_BRIEF_SCHEDULED_JOB_ID}:2026-06-03T07:45:00.000Z`,
    );
    expect(second.delivered).toBe(false);
    expect(second.delivery?.deduplicated).toBe(true);
    expect(adapter.listItems()).toHaveLength(1);
  });

  it("supports kill switch skip without delivery", async () => {
    const adapter = createInMemorySuggestionInboxAdapter();
    const result = await runMorningBriefScheduledInvocation(
      { real_input: realInput(), invoked_at: "2026-06-03T08:00:00.000Z" },
      { adapter, kill_switch_enabled: true },
    );

    expect(result.killed_by_switch).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.delivery).toBeNull();
    expect(result.failure_reason).toBe("kill_switch_enabled");
    expect(adapter.listItems()).toHaveLength(0);
  });

  it("fails closed when no supplied input is available", async () => {
    const result = await runMorningBriefScheduledInvocation({
      invoked_at: "2026-06-03T08:00:00.000Z",
    });

    expect(result.delivered).toBe(false);
    expect(result.delivery).toBeNull();
    expect(result.failure_reason).toBe("supplied_input_required");
    expect(result.no_daemon_started).toBe(true);
    expect(result.live_google_calls_attempted).toBe(false);
    expect(result.provider_call_attempted).toBe(false);
    expect(result.network_call_attempted).toBe(false);
  });

  it("does not introduce timers, daemons, provider calls, live Google calls, or writes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/morning-brief/scheduled-invocation.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /cron|agenda|bull|node-schedule|googleapis|google-auth-library|openai|anthropic|fetch/i,
    );
    expect(source).not.toMatch(/setInterval|setTimeout|writeFile|appendFile/);
    expect(source).not.toMatch(/sendEmail|createEvent|downloadFile/);
    expect(source).not.toMatch(/executeApproval|finalizeApproval/);
  });
});

function realInput(): MorningBriefRealInput {
  return {
    input_version: "phase21c.morning-brief-real-input.v1",
    built_at: "2026-06-03T07:45:00.000Z",
    google: {
      account_summary: null,
      gmail: {
        recent_messages: [gmailMessage("gmail-message-1")],
        unread_messages: [],
        metadata_only: true,
        raw_message_bodies_included: false,
      },
      calendar: {
        todays_events: [calendarEvent("calendar-event-1")],
        upcoming_events: [],
        metadata_only: true,
        raw_event_descriptions_included: false,
        attendee_email_lists_included: false,
      },
      drive: null,
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
