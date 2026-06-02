import { createHash } from "node:crypto";
import { z } from "zod";

export const GMAIL_READ_ADAPTER_VERSION =
  "phase21b.gmail-read-integration.v1" as const;

export const GMAIL_READ_OAUTH_VERSION = "phase21b.gmail-read-oauth.v1" as const;

export const GMAIL_READ_SCOPE =
  "https://www.googleapis.com/auth/gmail.metadata" as const;

export const GMAIL_READ_FORBIDDEN_OPERATIONS = [
  "send_email",
  "create_draft",
  "modify_labels",
  "archive_message",
  "delete_message",
  "mark_read",
  "mark_unread",
  "auto_reply",
  "auto_categorize",
] as const;

export const GMAIL_READ_AUTHORITY = {
  service: "gmail",
  authority_level: "T0",
  operation_class: "metadata_read",
  read_only: true,
  metadata_only_telemetry: true,
  approval_required: false,
  mutation_supported: false,
  draft_supported: false,
  send_supported: false,
  scheduler_supported: false,
  background_sync_supported: false,
} as const;

export const GMAIL_READ_GOVERNANCE = {
  adapter_boundary: "google-adapters",
  plugin_surface: "gmail_read",
  authenticated_read_supported: true,
  read_only: true,
  metadata_only_telemetry: true,
  body_storage_supported: false,
  attachment_content_supported: false,
  send_supported: false,
  draft_supported: false,
  mutation_supported: false,
  background_sync_supported: false,
  scheduler_supported: false,
} as const;

const GmailReadIdSchema = z.string().trim().min(1).max(220);

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const GmailReadLabelSchema = z.string().trim().min(1).max(120);

const GmailReadUrlSchema = z.string().trim().url();

const GmailReadTextSchema = z.string().trim().min(1).max(1000);

export const GmailReadOAuthConfigSchema = z.strictObject({
  oauth_version: z.literal(GMAIL_READ_OAUTH_VERSION),
  client_id: z.string().trim().min(1),
  client_secret: z.string().trim().min(1).optional(),
  redirect_uri: GmailReadUrlSchema,
  scopes: z.array(z.literal(GMAIL_READ_SCOPE)).default([GMAIL_READ_SCOPE]),
  authorization_endpoint: GmailReadUrlSchema.default(
    "https://accounts.google.com/o/oauth2/v2/auth",
  ),
  token_endpoint: GmailReadUrlSchema.default(
    "https://oauth2.googleapis.com/token",
  ),
});

export const GmailReadOAuthAuthorizationResultSchema = z.strictObject({
  oauth_version: z.literal(GMAIL_READ_OAUTH_VERSION),
  authorization_url: GmailReadUrlSchema,
  scope: z.literal(GMAIL_READ_SCOPE),
  state_hash: HashReferenceSchema,
  client_id_hash: HashReferenceSchema,
  redirect_uri_hash: HashReferenceSchema,
  raw_client_secret_included: z.literal(false),
  raw_token_included: z.literal(false),
  mutation_scopes_requested: z.literal(false),
});

export const GmailReadOAuthTokenSecretSchema = z.strictObject({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
  expires_at: IsoDateTimeSchema.nullable().default(null),
  scope: z.literal(GMAIL_READ_SCOPE),
  token_type: z.string().trim().min(1).default("Bearer"),
});

export const GmailReadOAuthTokenExchangeResultSchema = z.strictObject({
  oauth_version: z.literal(GMAIL_READ_OAUTH_VERSION),
  connection_status: z.enum(["connected", "failed_closed"]),
  token: GmailReadOAuthTokenSecretSchema.nullable(),
  telemetry: z.strictObject({
    token_metadata_present: z.boolean(),
    token_ref_hash: HashReferenceSchema.nullable(),
    scope: z.literal(GMAIL_READ_SCOPE).nullable(),
    raw_access_token_included: z.literal(false),
    raw_refresh_token_included: z.literal(false),
    raw_client_secret_included: z.literal(false),
    oauth_response_body_included: z.literal(false),
    mutation_scopes_requested: z.literal(false),
  }),
  reasons: z.array(z.string().trim().min(1).max(120)).default([]),
});

export const GmailReadMessageMetadataSchema = z.strictObject({
  adapter_version: z.literal(GMAIL_READ_ADAPTER_VERSION),
  message_id: GmailReadIdSchema,
  thread_id: GmailReadIdSchema,
  subject: z.string().max(1000).nullable().default(null),
  sender: z.string().max(1000).nullable().default(null),
  sender_domain: z.string().max(240).nullable().default(null),
  timestamp: IsoDateTimeSchema.nullable().default(null),
  label_ids: z.array(GmailReadLabelSchema).default([]),
  size_estimate_bytes: z.number().int().nonnegative().nullable().default(null),
  raw_body_included: z.literal(false),
  attachment_contents_included: z.literal(false),
});

export const GmailReadTelemetryEventSchema = z.strictObject({
  adapter_version: z.literal(GMAIL_READ_ADAPTER_VERSION),
  operation: z.enum(["list_recent", "list_unread", "read_message_metadata"]),
  authority_level: z.literal("T0"),
  metadata_only: z.literal(true),
  message_id: GmailReadIdSchema.nullable().default(null),
  thread_id: GmailReadIdSchema.nullable().default(null),
  sender_domain: z.string().max(240).nullable().default(null),
  timestamp: IsoDateTimeSchema.nullable().default(null),
  label_ids: z.array(GmailReadLabelSchema).default([]),
  retrieval_latency_ms: z.number().nonnegative(),
  access_token_present: z.boolean(),
  raw_email_body_included: z.literal(false),
  attachment_contents_included: z.literal(false),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
  credentials_included: z.literal(false),
  mutation_attempted: z.literal(false),
  draft_attempted: z.literal(false),
  send_attempted: z.literal(false),
});

export const GmailReadListResultSchema = z.strictObject({
  adapter_version: z.literal(GMAIL_READ_ADAPTER_VERSION),
  operation: z.enum(["list_recent", "list_unread"]),
  messages: z.array(GmailReadMessageMetadataSchema),
  next_page_token: z.string().trim().min(1).max(240).nullable().default(null),
  telemetry: z.array(GmailReadTelemetryEventSchema),
  raw_body_included: z.literal(false),
  mutation_performed: z.literal(false),
});

export const GmailReadMetadataResultSchema = z.strictObject({
  adapter_version: z.literal(GMAIL_READ_ADAPTER_VERSION),
  operation: z.literal("read_message_metadata"),
  message: GmailReadMessageMetadataSchema,
  telemetry: GmailReadTelemetryEventSchema,
  raw_body_included: z.literal(false),
  mutation_performed: z.literal(false),
});

export type GmailReadOAuthConfig = z.infer<typeof GmailReadOAuthConfigSchema>;
export type GmailReadOAuthAuthorizationResult = z.infer<
  typeof GmailReadOAuthAuthorizationResultSchema
>;
export type GmailReadOAuthTokenSecret = z.infer<
  typeof GmailReadOAuthTokenSecretSchema
>;
export type GmailReadOAuthTokenExchangeResult = z.infer<
  typeof GmailReadOAuthTokenExchangeResultSchema
>;
export type GmailReadMessageMetadata = z.infer<
  typeof GmailReadMessageMetadataSchema
>;
export type GmailReadTelemetryEvent = z.infer<
  typeof GmailReadTelemetryEventSchema
>;
export type GmailReadListResult = z.infer<typeof GmailReadListResultSchema>;
export type GmailReadMetadataResult = z.infer<
  typeof GmailReadMetadataResultSchema
>;

export interface GmailReadFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}

export type GmailReadFetch = (
  url: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<GmailReadFetchResponse>;

export interface GmailReadAdapterDependencies {
  readonly fetch: GmailReadFetch;
  readonly accessTokenProvider: () => Promise<GmailReadOAuthTokenSecret>;
  readonly now?: () => Date;
}

export interface GmailReadAdapter {
  readonly listRecentMessages: (input?: {
    readonly max_results?: number;
    readonly page_token?: string | null;
  }) => Promise<GmailReadListResult>;
  readonly listUnreadMessages: (input?: {
    readonly max_results?: number;
    readonly page_token?: string | null;
  }) => Promise<GmailReadListResult>;
  readonly readMessageMetadata: (input: {
    readonly message_id: string;
  }) => Promise<GmailReadMetadataResult>;
}

export function createGmailReadOAuthAuthorizationUrl(input: {
  readonly config: GmailReadOAuthConfig;
  readonly state: string;
}): GmailReadOAuthAuthorizationResult {
  const config = GmailReadOAuthConfigSchema.parse(input.config);
  const url = new URL(config.authorization_endpoint);

  url.searchParams.set("client_id", config.client_id);
  url.searchParams.set("redirect_uri", config.redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_READ_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return GmailReadOAuthAuthorizationResultSchema.parse({
    oauth_version: GMAIL_READ_OAUTH_VERSION,
    authorization_url: url.toString(),
    scope: GMAIL_READ_SCOPE,
    state_hash: hashReference(input.state),
    client_id_hash: hashReference(config.client_id),
    redirect_uri_hash: hashReference(config.redirect_uri),
    raw_client_secret_included: false,
    raw_token_included: false,
    mutation_scopes_requested: false,
  });
}

export async function exchangeGmailReadOAuthCode(input: {
  readonly config: GmailReadOAuthConfig;
  readonly authorization_code: string;
  readonly fetch: GmailReadFetch;
  readonly now?: () => Date;
}): Promise<GmailReadOAuthTokenExchangeResult> {
  const config = GmailReadOAuthConfigSchema.parse(input.config);
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
    return GmailReadOAuthTokenExchangeResultSchema.parse({
      oauth_version: GMAIL_READ_OAUTH_VERSION,
      connection_status: "failed_closed",
      token: null,
      telemetry: redactedTokenTelemetry(null),
      reasons: [`oauth_token_exchange_failed:${response.status}`],
    });
  }

  const payload = parseGmailTokenResponse(await response.json(), input.now);
  if (!payload) {
    return GmailReadOAuthTokenExchangeResultSchema.parse({
      oauth_version: GMAIL_READ_OAUTH_VERSION,
      connection_status: "failed_closed",
      token: null,
      telemetry: redactedTokenTelemetry(null),
      reasons: ["oauth_token_response_invalid"],
    });
  }

  return GmailReadOAuthTokenExchangeResultSchema.parse({
    oauth_version: GMAIL_READ_OAUTH_VERSION,
    connection_status: "connected",
    token: payload,
    telemetry: redactedTokenTelemetry(payload),
    reasons: [],
  });
}

export function createGmailReadAdapter(
  dependencies: GmailReadAdapterDependencies,
): GmailReadAdapter {
  return {
    listRecentMessages: (input) =>
      listMessages({
        dependencies,
        operation: "list_recent",
        query: "newer_than:30d",
        max_results: input?.max_results,
        page_token: input?.page_token ?? null,
      }),
    listUnreadMessages: (input) =>
      listMessages({
        dependencies,
        operation: "list_unread",
        query: "is:unread",
        max_results: input?.max_results,
        page_token: input?.page_token ?? null,
      }),
    readMessageMetadata: async (input) => {
      const token = await dependencies.accessTokenProvider();
      const started = monotonicNow(dependencies);
      const message = await fetchMessageMetadata(
        dependencies.fetch,
        token.access_token,
        input.message_id,
      );

      const telemetry = telemetryForMessage({
        operation: "read_message_metadata",
        message,
        latency: monotonicNow(dependencies) - started,
        accessTokenPresent: Boolean(token.access_token),
      });

      return GmailReadMetadataResultSchema.parse({
        adapter_version: GMAIL_READ_ADAPTER_VERSION,
        operation: "read_message_metadata",
        message,
        telemetry,
        raw_body_included: false,
        mutation_performed: false,
      });
    },
  };
}

async function listMessages(input: {
  readonly dependencies: GmailReadAdapterDependencies;
  readonly operation: "list_recent" | "list_unread";
  readonly query: string;
  readonly max_results?: number;
  readonly page_token: string | null;
}): Promise<GmailReadListResult> {
  const token = await input.dependencies.accessTokenProvider();
  const url = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  );
  url.searchParams.set(
    "maxResults",
    String(clampMaxResults(input.max_results)),
  );
  url.searchParams.set("q", input.query);
  if (input.page_token) {
    url.searchParams.set("pageToken", input.page_token);
  }

  const started = monotonicNow(input.dependencies);
  const response = await input.dependencies.fetch(url.toString(), {
    method: "GET",
    headers: authorizationHeaders(token.access_token),
  });

  if (!response.ok) {
    throw new Error(`gmail_read_list_failed:${response.status}`);
  }

  const payload = GmailListResponseSchema.parse(await response.json());
  const messages = await Promise.all(
    payload.messages.map((message) =>
      fetchMessageMetadata(
        input.dependencies.fetch,
        token.access_token,
        message.id,
      ),
    ),
  );
  const latency = monotonicNow(input.dependencies) - started;

  return GmailReadListResultSchema.parse({
    adapter_version: GMAIL_READ_ADAPTER_VERSION,
    operation: input.operation,
    messages,
    next_page_token: payload.nextPageToken ?? null,
    telemetry: messages.map((message) =>
      telemetryForMessage({
        operation: input.operation,
        message,
        latency,
        accessTokenPresent: Boolean(token.access_token),
      }),
    ),
    raw_body_included: false,
    mutation_performed: false,
  });
}

async function fetchMessageMetadata(
  fetchImpl: GmailReadFetch,
  accessToken: string,
  messageId: string,
): Promise<GmailReadMessageMetadata> {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId,
    )}`,
  );
  url.searchParams.set("format", "metadata");
  for (const header of ["Subject", "From", "Date"]) {
    url.searchParams.append("metadataHeaders", header);
  }

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: authorizationHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(`gmail_read_message_failed:${response.status}`);
  }

  return messageMetadataFromApi(await response.json());
}

function messageMetadataFromApi(value: unknown): GmailReadMessageMetadata {
  const payload = GmailMessageApiResponseSchema.parse(value);
  const headers = new Map(
    (payload.payload?.headers ?? []).map((header) => [
      header.name.toLowerCase(),
      header.value,
    ]),
  );
  const sender = headers.get("from") ?? null;
  const timestamp =
    timestampFromInternalDate(payload.internalDate ?? null) ??
    timestampFromHeader(headers.get("date"));

  return GmailReadMessageMetadataSchema.parse({
    adapter_version: GMAIL_READ_ADAPTER_VERSION,
    message_id: payload.id,
    thread_id: payload.threadId,
    subject: headers.get("subject") ?? null,
    sender,
    sender_domain: sender ? extractSenderDomain(sender) : null,
    timestamp,
    label_ids: payload.labelIds ?? [],
    size_estimate_bytes: payload.sizeEstimate ?? null,
    raw_body_included: false,
    attachment_contents_included: false,
  });
}

function parseGmailTokenResponse(
  value: unknown,
  now?: () => Date,
): GmailReadOAuthTokenSecret | null {
  const parsed = GmailTokenResponseSchema.safeParse(value);
  if (!parsed.success) return null;

  const expiresAt = parsed.data.expires_in
    ? new Date(
        (now?.() ?? new Date()).getTime() + parsed.data.expires_in * 1000,
      ).toISOString()
    : null;

  return GmailReadOAuthTokenSecretSchema.parse({
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token,
    expires_at: expiresAt,
    scope: GMAIL_READ_SCOPE,
    token_type: parsed.data.token_type ?? "Bearer",
  });
}

function redactedTokenTelemetry(
  token: GmailReadOAuthTokenSecret | null,
): GmailReadOAuthTokenExchangeResult["telemetry"] {
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

function telemetryForMessage(input: {
  readonly operation: "list_recent" | "list_unread" | "read_message_metadata";
  readonly message: GmailReadMessageMetadata;
  readonly latency: number;
  readonly accessTokenPresent: boolean;
}): GmailReadTelemetryEvent {
  return GmailReadTelemetryEventSchema.parse({
    adapter_version: GMAIL_READ_ADAPTER_VERSION,
    operation: input.operation,
    authority_level: "T0",
    metadata_only: true,
    message_id: input.message.message_id,
    thread_id: input.message.thread_id,
    sender_domain: input.message.sender_domain,
    timestamp: input.message.timestamp,
    label_ids: input.message.label_ids,
    retrieval_latency_ms: Math.max(0, input.latency),
    access_token_present: input.accessTokenPresent,
    raw_email_body_included: false,
    attachment_contents_included: false,
    raw_access_token_included: false,
    raw_refresh_token_included: false,
    credentials_included: false,
    mutation_attempted: false,
    draft_attempted: false,
    send_attempted: false,
  });
}

function authorizationHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function clampMaxResults(value: number | undefined): number {
  if (!value) return 10;
  return Math.max(1, Math.min(25, Math.trunc(value)));
}

function extractSenderDomain(sender: string): string | null {
  const match = sender.match(/@([^>\s]+)>?$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function timestampFromInternalDate(internalDate: string | null): string | null {
  if (!internalDate) return null;
  const millis = Number(internalDate);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis).toISOString();
}

function timestampFromHeader(value: string | undefined): string | null {
  if (!value) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis).toISOString();
}

function hashReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function monotonicNow(dependencies: Pick<GmailReadAdapterDependencies, "now">) {
  return dependencies.now?.().getTime() ?? Date.now();
}

const GmailListResponseSchema = z.object({
  messages: z
    .array(
      z.object({
        id: GmailReadIdSchema,
        threadId: GmailReadIdSchema,
      }),
    )
    .default([]),
  nextPageToken: z.string().trim().min(1).max(240).optional(),
});

const GmailMessageApiResponseSchema = z.object({
  id: GmailReadIdSchema,
  threadId: GmailReadIdSchema,
  labelIds: z.array(GmailReadLabelSchema).optional(),
  internalDate: z.string().trim().nullable().optional(),
  sizeEstimate: z.number().int().nonnegative().optional(),
  payload: z
    .object({
      headers: z
        .array(
          z.object({
            name: GmailReadTextSchema,
            value: z.string().max(4000),
          }),
        )
        .default([]),
    })
    .optional(),
});

const GmailTokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  token_type: z.string().trim().min(1).optional(),
  scope: z.string().trim().optional(),
});
