import { createHash } from "node:crypto";
import { z } from "zod";

export const CALENDAR_READ_ADAPTER_VERSION =
  "phase21b.calendar-read-integration.v1" as const;

export const CALENDAR_READ_OAUTH_VERSION =
  "phase21b.calendar-read-oauth.v1" as const;

export const CALENDAR_READ_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly" as const;

export const CALENDAR_READ_FORBIDDEN_OPERATIONS = [
  "create_event",
  "update_event",
  "delete_event",
  "rsvp_event",
  "add_attendee",
  "remove_attendee",
  "modify_reminders",
  "background_sync",
  "scheduler_wiring",
] as const;

export const CALENDAR_READ_AUTHORITY = {
  service: "calendar",
  authority_level: "T0",
  operation_class: "metadata_read",
  read_only: true,
  metadata_only_telemetry: true,
  approval_required: false,
  mutation_supported: false,
  event_creation_supported: false,
  event_update_supported: false,
  event_delete_supported: false,
  rsvp_supported: false,
  scheduler_supported: false,
  background_sync_supported: false,
} as const;

export const CALENDAR_READ_GOVERNANCE = {
  adapter_boundary: "google-adapters",
  plugin_surface: "calendar_read",
  authenticated_read_supported: true,
  read_only: true,
  metadata_only_telemetry: true,
  description_telemetry_supported: false,
  attendee_email_telemetry_supported: false,
  conference_link_telemetry_supported: false,
  event_creation_supported: false,
  event_update_supported: false,
  event_delete_supported: false,
  rsvp_supported: false,
  mutation_supported: false,
  background_sync_supported: false,
  scheduler_supported: false,
} as const;

const CalendarReadIdSchema = z.string().trim().min(1).max(260);

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const CalendarReadUrlSchema = z.string().trim().url();

export const CalendarReadOAuthConfigSchema = z.strictObject({
  oauth_version: z.literal(CALENDAR_READ_OAUTH_VERSION),
  client_id: z.string().trim().min(1),
  client_secret: z.string().trim().min(1).optional(),
  redirect_uri: CalendarReadUrlSchema,
  scopes: z
    .array(z.literal(CALENDAR_READ_SCOPE))
    .default([CALENDAR_READ_SCOPE]),
  authorization_endpoint: CalendarReadUrlSchema.default(
    "https://accounts.google.com/o/oauth2/v2/auth",
  ),
  token_endpoint: CalendarReadUrlSchema.default(
    "https://oauth2.googleapis.com/token",
  ),
});

export const CalendarReadOAuthAuthorizationResultSchema = z.strictObject({
  oauth_version: z.literal(CALENDAR_READ_OAUTH_VERSION),
  authorization_url: CalendarReadUrlSchema,
  scope: z.literal(CALENDAR_READ_SCOPE),
  state_hash: HashReferenceSchema,
  client_id_hash: HashReferenceSchema,
  redirect_uri_hash: HashReferenceSchema,
  raw_client_secret_included: z.literal(false),
  raw_token_included: z.literal(false),
  mutation_scopes_requested: z.literal(false),
});

export const CalendarReadOAuthTokenSecretSchema = z.strictObject({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
  expires_at: IsoDateTimeSchema.nullable().default(null),
  scope: z.literal(CALENDAR_READ_SCOPE),
  token_type: z.string().trim().min(1).default("Bearer"),
});

export const CalendarReadOAuthTokenExchangeResultSchema = z.strictObject({
  oauth_version: z.literal(CALENDAR_READ_OAUTH_VERSION),
  connection_status: z.enum(["connected", "failed_closed"]),
  token: CalendarReadOAuthTokenSecretSchema.nullable(),
  telemetry: z.strictObject({
    token_metadata_present: z.boolean(),
    token_ref_hash: HashReferenceSchema.nullable(),
    scope: z.literal(CALENDAR_READ_SCOPE).nullable(),
    raw_access_token_included: z.literal(false),
    raw_refresh_token_included: z.literal(false),
    raw_client_secret_included: z.literal(false),
    oauth_response_body_included: z.literal(false),
    mutation_scopes_requested: z.literal(false),
  }),
  reasons: z.array(z.string().trim().min(1).max(120)).default([]),
});

export const CalendarReadEventMetadataSchema = z.strictObject({
  adapter_version: z.literal(CALENDAR_READ_ADAPTER_VERSION),
  event_id: CalendarReadIdSchema,
  calendar_id: CalendarReadIdSchema,
  title: z.string().max(1000).nullable().default(null),
  start_time: IsoDateTimeSchema.nullable().default(null),
  end_time: IsoDateTimeSchema.nullable().default(null),
  location: z.string().max(1000).nullable().default(null),
  attendee_count: z.number().int().nonnegative().default(0),
  status: z.string().trim().min(1).max(120).nullable().default(null),
  organizer_domain: z.string().max(240).nullable().default(null),
  raw_description_included: z.literal(false),
  attendee_email_list_included: z.literal(false),
  conference_links_included: z.literal(false),
  attachment_contents_included: z.literal(false),
});

export const CalendarReadTelemetryEventSchema = z.strictObject({
  adapter_version: z.literal(CALENDAR_READ_ADAPTER_VERSION),
  operation: z.enum(["list_upcoming", "list_today", "read_event_metadata"]),
  authority_level: z.literal("T0"),
  metadata_only: z.literal(true),
  event_id: CalendarReadIdSchema.nullable().default(null),
  calendar_id: CalendarReadIdSchema,
  time_min: IsoDateTimeSchema.nullable().default(null),
  time_max: IsoDateTimeSchema.nullable().default(null),
  organizer_domain: z.string().max(240).nullable().default(null),
  attendee_count: z.number().int().nonnegative(),
  retrieval_latency_ms: z.number().nonnegative(),
  status: z.string().trim().min(1).max(120).nullable().default(null),
  access_token_present: z.boolean(),
  raw_description_included: z.literal(false),
  attendee_email_list_included: z.literal(false),
  conference_links_included: z.literal(false),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
  credentials_included: z.literal(false),
  mutation_attempted: z.literal(false),
  create_attempted: z.literal(false),
  update_attempted: z.literal(false),
  delete_attempted: z.literal(false),
  rsvp_attempted: z.literal(false),
});

export const CalendarReadListResultSchema = z.strictObject({
  adapter_version: z.literal(CALENDAR_READ_ADAPTER_VERSION),
  operation: z.enum(["list_upcoming", "list_today"]),
  calendar_id: CalendarReadIdSchema,
  time_min: IsoDateTimeSchema,
  time_max: IsoDateTimeSchema,
  events: z.array(CalendarReadEventMetadataSchema),
  next_page_token: z.string().trim().min(1).max(240).nullable().default(null),
  telemetry: z.array(CalendarReadTelemetryEventSchema),
  raw_descriptions_included: z.literal(false),
  attendee_email_lists_included: z.literal(false),
  mutation_performed: z.literal(false),
});

export const CalendarReadMetadataResultSchema = z.strictObject({
  adapter_version: z.literal(CALENDAR_READ_ADAPTER_VERSION),
  operation: z.literal("read_event_metadata"),
  event: CalendarReadEventMetadataSchema,
  telemetry: CalendarReadTelemetryEventSchema,
  raw_description_included: z.literal(false),
  attendee_email_list_included: z.literal(false),
  mutation_performed: z.literal(false),
});

export type CalendarReadOAuthConfig = z.infer<
  typeof CalendarReadOAuthConfigSchema
>;
export type CalendarReadOAuthAuthorizationResult = z.infer<
  typeof CalendarReadOAuthAuthorizationResultSchema
>;
export type CalendarReadOAuthTokenSecret = z.infer<
  typeof CalendarReadOAuthTokenSecretSchema
>;
export type CalendarReadOAuthTokenExchangeResult = z.infer<
  typeof CalendarReadOAuthTokenExchangeResultSchema
>;
export type CalendarReadEventMetadata = z.infer<
  typeof CalendarReadEventMetadataSchema
>;
export type CalendarReadTelemetryEvent = z.infer<
  typeof CalendarReadTelemetryEventSchema
>;
export type CalendarReadListResult = z.infer<
  typeof CalendarReadListResultSchema
>;
export type CalendarReadMetadataResult = z.infer<
  typeof CalendarReadMetadataResultSchema
>;

export interface CalendarReadFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}

export type CalendarReadFetch = (
  url: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<CalendarReadFetchResponse>;

export interface CalendarReadAdapterDependencies {
  readonly fetch: CalendarReadFetch;
  readonly accessTokenProvider: () => Promise<CalendarReadOAuthTokenSecret>;
  readonly now?: () => Date;
}

export interface CalendarReadAdapter {
  readonly listUpcomingEvents: (input?: {
    readonly calendar_id?: string;
    readonly max_results?: number;
    readonly time_min?: string | null;
    readonly time_max?: string | null;
    readonly page_token?: string | null;
  }) => Promise<CalendarReadListResult>;
  readonly listTodaysEvents: (input?: {
    readonly calendar_id?: string;
    readonly date?: string | null;
    readonly max_results?: number;
    readonly page_token?: string | null;
  }) => Promise<CalendarReadListResult>;
  readonly readEventMetadata: (input: {
    readonly calendar_id?: string;
    readonly event_id: string;
  }) => Promise<CalendarReadMetadataResult>;
}

export function createCalendarReadOAuthAuthorizationUrl(input: {
  readonly config: CalendarReadOAuthConfig;
  readonly state: string;
}): CalendarReadOAuthAuthorizationResult {
  const config = CalendarReadOAuthConfigSchema.parse(input.config);
  const url = new URL(config.authorization_endpoint);

  url.searchParams.set("client_id", config.client_id);
  url.searchParams.set("redirect_uri", config.redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_READ_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return CalendarReadOAuthAuthorizationResultSchema.parse({
    oauth_version: CALENDAR_READ_OAUTH_VERSION,
    authorization_url: url.toString(),
    scope: CALENDAR_READ_SCOPE,
    state_hash: hashReference(input.state),
    client_id_hash: hashReference(config.client_id),
    redirect_uri_hash: hashReference(config.redirect_uri),
    raw_client_secret_included: false,
    raw_token_included: false,
    mutation_scopes_requested: false,
  });
}

export async function exchangeCalendarReadOAuthCode(input: {
  readonly config: CalendarReadOAuthConfig;
  readonly authorization_code: string;
  readonly fetch: CalendarReadFetch;
  readonly now?: () => Date;
}): Promise<CalendarReadOAuthTokenExchangeResult> {
  const config = CalendarReadOAuthConfigSchema.parse(input.config);
  const body = new URLSearchParams({
    code: input.authorization_code,
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    grant_type: "authorization_code",
  });

  if (config.client_secret) {
    body.set("client_secret", config.client_secret);
  }

  const response = await input.fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    return CalendarReadOAuthTokenExchangeResultSchema.parse({
      oauth_version: CALENDAR_READ_OAUTH_VERSION,
      connection_status: "failed_closed",
      token: null,
      telemetry: redactedTokenTelemetry(null),
      reasons: [`oauth_token_exchange_failed:${response.status}`],
    });
  }

  const payload = parseCalendarTokenResponse(await response.json(), input.now);
  if (!payload) {
    return CalendarReadOAuthTokenExchangeResultSchema.parse({
      oauth_version: CALENDAR_READ_OAUTH_VERSION,
      connection_status: "failed_closed",
      token: null,
      telemetry: redactedTokenTelemetry(null),
      reasons: ["oauth_token_response_invalid"],
    });
  }

  return CalendarReadOAuthTokenExchangeResultSchema.parse({
    oauth_version: CALENDAR_READ_OAUTH_VERSION,
    connection_status: "connected",
    token: payload,
    telemetry: redactedTokenTelemetry(payload),
    reasons: [],
  });
}

export function createCalendarReadAdapter(
  dependencies: CalendarReadAdapterDependencies,
): CalendarReadAdapter {
  return {
    listUpcomingEvents: (input) => {
      const now = dependencies.now?.() ?? new Date();
      const timeMin = input?.time_min ?? now.toISOString();
      const timeMax =
        input?.time_max ??
        new Date(now.getTime() + 14 * 86400000).toISOString();

      return listEvents({
        dependencies,
        operation: "list_upcoming",
        calendar_id: input?.calendar_id ?? "primary",
        time_min: timeMin,
        time_max: timeMax,
        max_results: input?.max_results,
        page_token: input?.page_token ?? null,
      });
    },
    listTodaysEvents: (input) => {
      const window = todayWindow(input?.date ?? null, dependencies.now);

      return listEvents({
        dependencies,
        operation: "list_today",
        calendar_id: input?.calendar_id ?? "primary",
        time_min: window.time_min,
        time_max: window.time_max,
        max_results: input?.max_results,
        page_token: input?.page_token ?? null,
      });
    },
    readEventMetadata: async (input) => {
      const calendarId = input.calendar_id ?? "primary";
      const token = await dependencies.accessTokenProvider();
      const started = monotonicNow(dependencies);
      const event = await fetchEventMetadata(
        dependencies.fetch,
        token.access_token,
        calendarId,
        input.event_id,
      );

      const telemetry = telemetryForEvent({
        operation: "read_event_metadata",
        event,
        time_min: event.start_time,
        time_max: event.end_time,
        latency: monotonicNow(dependencies) - started,
        accessTokenPresent: Boolean(token.access_token),
      });

      return CalendarReadMetadataResultSchema.parse({
        adapter_version: CALENDAR_READ_ADAPTER_VERSION,
        operation: "read_event_metadata",
        event,
        telemetry,
        raw_description_included: false,
        attendee_email_list_included: false,
        mutation_performed: false,
      });
    },
  };
}

async function listEvents(input: {
  readonly dependencies: CalendarReadAdapterDependencies;
  readonly operation: "list_upcoming" | "list_today";
  readonly calendar_id: string;
  readonly time_min: string;
  readonly time_max: string;
  readonly max_results?: number;
  readonly page_token: string | null;
}): Promise<CalendarReadListResult> {
  const token = await input.dependencies.accessTokenProvider();
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      input.calendar_id,
    )}/events`,
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", input.time_min);
  url.searchParams.set("timeMax", input.time_max);
  url.searchParams.set(
    "maxResults",
    String(clampMaxResults(input.max_results)),
  );
  if (input.page_token) {
    url.searchParams.set("pageToken", input.page_token);
  }

  const started = monotonicNow(input.dependencies);
  const response = await input.dependencies.fetch(url.toString(), {
    method: "GET",
    headers: authorizationHeaders(token.access_token),
  });

  if (!response.ok) {
    throw new Error(`calendar_read_list_failed:${response.status}`);
  }

  const payload = CalendarEventsApiResponseSchema.parse(await response.json());
  const events = payload.items.map((event) =>
    eventMetadataFromApi(event, input.calendar_id),
  );
  const latency = monotonicNow(input.dependencies) - started;

  return CalendarReadListResultSchema.parse({
    adapter_version: CALENDAR_READ_ADAPTER_VERSION,
    operation: input.operation,
    calendar_id: input.calendar_id,
    time_min: input.time_min,
    time_max: input.time_max,
    events,
    next_page_token: payload.nextPageToken ?? null,
    telemetry: events.map((event) =>
      telemetryForEvent({
        operation: input.operation,
        event,
        time_min: input.time_min,
        time_max: input.time_max,
        latency,
        accessTokenPresent: Boolean(token.access_token),
      }),
    ),
    raw_descriptions_included: false,
    attendee_email_lists_included: false,
    mutation_performed: false,
  });
}

async function fetchEventMetadata(
  fetchImpl: CalendarReadFetch,
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<CalendarReadEventMetadata> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events/${encodeURIComponent(eventId)}`,
  );

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: authorizationHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(`calendar_read_event_failed:${response.status}`);
  }

  return eventMetadataFromApi(
    CalendarEventApiResponseSchema.parse(await response.json()),
    calendarId,
  );
}

function eventMetadataFromApi(
  value: z.infer<typeof CalendarEventApiResponseSchema>,
  calendarId: string,
): CalendarReadEventMetadata {
  const start = value.start?.dateTime ?? dateOnlyToIso(value.start?.date);
  const end = value.end?.dateTime ?? dateOnlyToIso(value.end?.date);

  return CalendarReadEventMetadataSchema.parse({
    adapter_version: CALENDAR_READ_ADAPTER_VERSION,
    event_id: value.id,
    calendar_id: calendarId,
    title: value.summary ?? null,
    start_time: start ?? null,
    end_time: end ?? null,
    location: value.location ?? null,
    attendee_count: value.attendees?.length ?? 0,
    status: value.status ?? null,
    organizer_domain: value.organizer?.email
      ? extractDomain(value.organizer.email)
      : null,
    raw_description_included: false,
    attendee_email_list_included: false,
    conference_links_included: false,
    attachment_contents_included: false,
  });
}

function parseCalendarTokenResponse(
  value: unknown,
  now?: () => Date,
): CalendarReadOAuthTokenSecret | null {
  const parsed = CalendarTokenResponseSchema.safeParse(value);
  if (!parsed.success) return null;

  const expiresAt = parsed.data.expires_in
    ? new Date(
        (now?.() ?? new Date()).getTime() + parsed.data.expires_in * 1000,
      ).toISOString()
    : null;

  return CalendarReadOAuthTokenSecretSchema.parse({
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token,
    expires_at: expiresAt,
    scope: CALENDAR_READ_SCOPE,
    token_type: parsed.data.token_type ?? "Bearer",
  });
}

function redactedTokenTelemetry(
  token: CalendarReadOAuthTokenSecret | null,
): CalendarReadOAuthTokenExchangeResult["telemetry"] {
  return {
    token_metadata_present: Boolean(token),
    token_ref_hash: token ? hashReference(token.access_token) : null,
    scope: token?.scope ?? null,
    raw_access_token_included: false,
    raw_refresh_token_included: false,
    raw_client_secret_included: false,
    oauth_response_body_included: false,
    mutation_scopes_requested: false,
  };
}

function telemetryForEvent(input: {
  readonly operation: "list_upcoming" | "list_today" | "read_event_metadata";
  readonly event: CalendarReadEventMetadata;
  readonly time_min: string | null;
  readonly time_max: string | null;
  readonly latency: number;
  readonly accessTokenPresent: boolean;
}): CalendarReadTelemetryEvent {
  return CalendarReadTelemetryEventSchema.parse({
    adapter_version: CALENDAR_READ_ADAPTER_VERSION,
    operation: input.operation,
    authority_level: "T0",
    metadata_only: true,
    event_id: input.event.event_id,
    calendar_id: input.event.calendar_id,
    time_min: input.time_min,
    time_max: input.time_max,
    organizer_domain: input.event.organizer_domain,
    attendee_count: input.event.attendee_count,
    retrieval_latency_ms: Math.max(0, input.latency),
    status: input.event.status,
    access_token_present: input.accessTokenPresent,
    raw_description_included: false,
    attendee_email_list_included: false,
    conference_links_included: false,
    raw_access_token_included: false,
    raw_refresh_token_included: false,
    credentials_included: false,
    mutation_attempted: false,
    create_attempted: false,
    update_attempted: false,
    delete_attempted: false,
    rsvp_attempted: false,
  });
}

function todayWindow(
  date: string | null,
  now?: () => Date,
): { readonly time_min: string; readonly time_max: string } {
  const source = date
    ? new Date(`${date}T00:00:00.000Z`)
    : (now?.() ?? new Date());
  const start = Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate(),
  );

  return {
    time_min: new Date(start).toISOString(),
    time_max: new Date(start + 86400000).toISOString(),
  };
}

function authorizationHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function clampMaxResults(value: number | undefined): number {
  if (!value) return 10;
  return Math.max(1, Math.min(25, Math.trunc(value)));
}

function dateOnlyToIso(value: string | undefined): string | null {
  if (!value) return null;
  const millis = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis).toISOString();
}

function extractDomain(email: string): string | null {
  const match = email.match(/@([^>\s]+)>?$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function hashReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function monotonicNow(
  dependencies: Pick<CalendarReadAdapterDependencies, "now">,
) {
  return dependencies.now?.().getTime() ?? Date.now();
}

const CalendarEventDateSchema = z.object({
  date: z.string().trim().min(1).optional(),
  dateTime: IsoDateTimeSchema.optional(),
  timeZone: z.string().trim().min(1).optional(),
});

const CalendarEventApiResponseSchema = z.object({
  id: CalendarReadIdSchema,
  status: z.string().trim().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  description: z.string().max(20000).optional(),
  location: z.string().max(1000).optional(),
  start: CalendarEventDateSchema.optional(),
  end: CalendarEventDateSchema.optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().trim().min(1).optional(),
        responseStatus: z.string().trim().min(1).optional(),
      }),
    )
    .optional(),
  organizer: z
    .object({
      email: z.string().trim().min(1).optional(),
    })
    .optional(),
  hangoutLink: z.string().optional(),
  conferenceData: z.unknown().optional(),
  attachments: z.array(z.unknown()).optional(),
});

const CalendarEventsApiResponseSchema = z.object({
  items: z.array(CalendarEventApiResponseSchema).default([]),
  nextPageToken: z.string().trim().min(1).max(240).optional(),
});

const CalendarTokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  token_type: z.string().trim().min(1).optional(),
  scope: z.string().trim().optional(),
});
