import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_READ_AUTHORITY,
  CALENDAR_READ_FORBIDDEN_OPERATIONS,
  CALENDAR_READ_GOVERNANCE,
  CALENDAR_READ_SCOPE,
  createCalendarReadAdapter,
  createCalendarReadOAuthAuthorizationUrl,
  exchangeCalendarReadOAuthCode,
  type CalendarReadFetch,
  type CalendarReadFetchResponse,
  type CalendarReadOAuthConfig,
} from ".";

const FIXED_NOW = new Date("2026-06-02T09:00:00.000Z");
const ACCESS_TOKEN = "calendar-access-token";
const REFRESH_TOKEN = "calendar-refresh-token";

describe("Calendar read integration", () => {
  it("creates an OAuth authorization URL with the read-only Calendar event scope", () => {
    const result = createCalendarReadOAuthAuthorizationUrl({
      config: oauthConfig(),
      state: "calendar-state",
    });

    const url = new URL(result.authorization_url);

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(CALENDAR_READ_SCOPE);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(result.mutation_scopes_requested).toBe(false);
    expect(result.raw_client_secret_included).toBe(false);
    expect(result.raw_token_included).toBe(false);
    expect(JSON.stringify(result)).not.toContain("calendar-client-secret");
  });

  it("exchanges an OAuth code through injected fetch without leaking tokens", async () => {
    const result = await exchangeCalendarReadOAuthCode({
      config: oauthConfig(),
      authorization_code: "calendar-oauth-code",
      fetch: fakeFetch(async (url, init) => {
        expect(url).toBe("https://oauth2.googleapis.com/token");
        expect(init?.method).toBe("POST");
        expect(init?.body).toContain("grant_type=authorization_code");

        return jsonResponse({
          access_token: ACCESS_TOKEN,
          refresh_token: REFRESH_TOKEN,
          expires_in: 3600,
          token_type: "Bearer",
        });
      }),
      now: () => FIXED_NOW,
    });

    expect(result.connection_status).toBe("connected");
    expect(result.token?.access_token).toBe(ACCESS_TOKEN);
    expect(result.token?.scope).toBe(CALENDAR_READ_SCOPE);
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(REFRESH_TOKEN);
    expect(result.telemetry.raw_access_token_included).toBe(false);
    expect(result.telemetry.raw_refresh_token_included).toBe(false);
  });

  it("lists upcoming events through the Calendar API metadata path", async () => {
    const calls: string[] = [];
    const adapter = createCalendarReadAdapter({
      fetch: calendarFetch(calls),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.listUpcomingEvents({
      calendar_id: "primary",
      max_results: 2,
    });

    expect(result.operation).toBe("list_upcoming");
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      event_id: "event-1",
      calendar_id: "primary",
      title: "Phase 21B Calendar Read Review",
      start_time: "2026-06-02T10:00:00.000Z",
      end_time: "2026-06-02T10:30:00.000Z",
      location: "Command Center",
      attendee_count: 2,
      status: "confirmed",
      organizer_domain: "example.com",
      raw_description_included: false,
      attendee_email_list_included: false,
      conference_links_included: false,
    });
    expect(calls[0]).toContain("/calendar/v3/calendars/primary/events");
    expect(calls[0]).toContain("singleEvents=true");
    expect(calls[0]).toContain("orderBy=startTime");
    expect(result.telemetry[0]).toMatchObject({
      operation: "list_upcoming",
      authority_level: "T0",
      metadata_only: true,
      event_id: "event-1",
      calendar_id: "primary",
      organizer_domain: "example.com",
      attendee_count: 2,
      raw_description_included: false,
      attendee_email_list_included: false,
      conference_links_included: false,
      mutation_attempted: false,
      create_attempted: false,
      update_attempted: false,
      delete_attempted: false,
      rsvp_attempted: false,
    });
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Private planning detail",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "prince@example.com",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain("meet.google.com");
  });

  it("lists today's events using a deterministic day window", async () => {
    const calls: string[] = [];
    const adapter = createCalendarReadAdapter({
      fetch: calendarFetch(calls),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.listTodaysEvents({
      calendar_id: "primary",
      date: "2026-06-02",
    });

    expect(result.operation).toBe("list_today");
    expect(result.time_min).toBe("2026-06-02T00:00:00.000Z");
    expect(result.time_max).toBe("2026-06-03T00:00:00.000Z");
    expect(calls[0]).toContain("timeMin=2026-06-02T00%3A00%3A00.000Z");
    expect(calls[0]).toContain("timeMax=2026-06-03T00%3A00%3A00.000Z");
    expect(result.raw_descriptions_included).toBe(false);
    expect(result.attendee_email_lists_included).toBe(false);
    expect(result.mutation_performed).toBe(false);
  });

  it("reads a single event metadata record", async () => {
    const adapter = createCalendarReadAdapter({
      fetch: calendarFetch([]),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.readEventMetadata({
      calendar_id: "primary",
      event_id: "event-1",
    });

    expect(result.operation).toBe("read_event_metadata");
    expect(result.event.title).toBe("Phase 21B Calendar Read Review");
    expect(result.event.attendee_count).toBe(2);
    expect(result.event.organizer_domain).toBe("example.com");
    expect(result.telemetry.event_id).toBe("event-1");
    expect(result.telemetry.raw_description_included).toBe(false);
    expect(result.telemetry.attendee_email_list_included).toBe(false);
    expect(result.telemetry.credentials_included).toBe(false);
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Phase 21B Calendar Read Review",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Private planning detail",
    );
  });

  it("exposes no event create, update, delete, RSVP, or reminder mutation methods", () => {
    const adapter = createCalendarReadAdapter({
      fetch: calendarFetch([]),
      accessTokenProvider: async () => token(),
    }) as unknown as Record<string, unknown>;

    for (const operation of [
      "createEvent",
      "updateEvent",
      "deleteEvent",
      "rsvpEvent",
      "addAttendee",
      "removeAttendee",
      "modifyReminders",
      "syncCalendar",
      "scheduleCalendarRead",
    ]) {
      expect(adapter[operation]).toBeUndefined();
    }

    expect(CALENDAR_READ_FORBIDDEN_OPERATIONS).toContain("create_event");
    expect(CALENDAR_READ_FORBIDDEN_OPERATIONS).toContain("rsvp_event");
    expect(CALENDAR_READ_AUTHORITY).toMatchObject({
      authority_level: "T0",
      read_only: true,
      mutation_supported: false,
      event_creation_supported: false,
      event_update_supported: false,
      event_delete_supported: false,
      rsvp_supported: false,
    });
  });

  it("keeps the live Calendar read path inside the Google adapter plugin boundary", () => {
    expect(CALENDAR_READ_GOVERNANCE.adapter_boundary).toBe("google-adapters");
    expect(CALENDAR_READ_GOVERNANCE.plugin_surface).toBe("calendar_read");

    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/calendar-read.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(/googleapis|google-auth-library/);
    expect(imports.join("\n")).not.toMatch(
      /orchestrator|scheduler|suggestion-inbox|morning-brief/i,
    );
    expect(source).not.toMatch(
      /\bcreateEvent\b|\bupdateEvent\b|\bdeleteEvent\b|\brsvpEvent\b/,
    );
  });
});

function oauthConfig(): CalendarReadOAuthConfig {
  return {
    oauth_version: "phase21b.calendar-read-oauth.v1",
    client_id: "calendar-client-id",
    client_secret: "calendar-client-secret",
    redirect_uri: "http://127.0.0.1:1455/oauth/google/calendar/callback",
    scopes: [CALENDAR_READ_SCOPE],
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: "https://oauth2.googleapis.com/token",
  };
}

function token() {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: "2026-06-02T10:00:00.000Z",
    scope: CALENDAR_READ_SCOPE,
    token_type: "Bearer",
  };
}

function calendarFetch(calls: string[]): CalendarReadFetch {
  return fakeFetch(async (url) => {
    calls.push(url);
    if (url.includes("/events?")) {
      return jsonResponse({
        items: [
          calendarEvent("event-1"),
          calendarEvent("event-2", {
            summary: "Focus block",
            organizer: "coach@example.org",
            start: "2026-06-02T13:00:00.000Z",
            end: "2026-06-02T14:00:00.000Z",
            attendees: [],
          }),
        ],
      });
    }
    if (url.includes("/events/event-1")) {
      return jsonResponse(calendarEvent("event-1"));
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

function calendarEvent(
  id: string,
  overrides?: {
    readonly summary?: string;
    readonly organizer?: string;
    readonly start?: string;
    readonly end?: string;
    readonly attendees?: readonly { readonly email: string }[];
  },
) {
  return {
    id,
    status: "confirmed",
    summary: overrides?.summary ?? "Phase 21B Calendar Read Review",
    description: "Private planning detail that must not enter telemetry.",
    location: "Command Center",
    start: { dateTime: overrides?.start ?? "2026-06-02T10:00:00.000Z" },
    end: { dateTime: overrides?.end ?? "2026-06-02T10:30:00.000Z" },
    attendees: overrides?.attendees ?? [
      { email: "prince@example.com" },
      { email: "jarvis@example.com" },
    ],
    organizer: { email: overrides?.organizer ?? "Prince <prince@example.com>" },
    hangoutLink: "https://meet.google.com/not-telemetry-safe",
  };
}

function fakeFetch(
  handler: (
    url: string,
    init?: Parameters<CalendarReadFetch>[1],
  ) => Promise<CalendarReadFetchResponse> | CalendarReadFetchResponse,
): CalendarReadFetch {
  return async (url, init) => handler(url, init);
}

function jsonResponse(payload: unknown): CalendarReadFetchResponse {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

function incrementingClock() {
  let index = 0;
  return () => new Date(FIXED_NOW.getTime() + index++ * 25);
}
