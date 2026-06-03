import { createHash } from "node:crypto";
import { z } from "zod";

export const DRIVE_READ_ADAPTER_VERSION =
  "phase21b.drive-read-integration.v1" as const;

export const DRIVE_READ_OAUTH_VERSION = "phase21b.drive-read-oauth.v1" as const;

export const DRIVE_READ_SCOPE =
  "https://www.googleapis.com/auth/drive.metadata.readonly" as const;

export const DRIVE_READ_FORBIDDEN_OPERATIONS = [
  "create_file",
  "update_file",
  "delete_file",
  "move_file",
  "rename_file",
  "change_permissions",
  "download_file_contents",
  "background_sync",
  "scheduler_wiring",
] as const;

export const DRIVE_READ_AUTHORITY = {
  service: "drive",
  authority_level: "T0",
  operation_class: "metadata_read",
  read_only: true,
  metadata_only_telemetry: true,
  approval_required: false,
  mutation_supported: false,
  file_creation_supported: false,
  file_update_supported: false,
  file_delete_supported: false,
  permission_change_supported: false,
  raw_download_supported: false,
  scheduler_supported: false,
  background_sync_supported: false,
} as const;

export const DRIVE_READ_GOVERNANCE = {
  adapter_boundary: "google-adapters",
  plugin_surface: "drive_read",
  authenticated_read_supported: true,
  read_only: true,
  metadata_only_telemetry: true,
  file_content_telemetry_supported: false,
  document_body_telemetry_supported: false,
  permission_list_telemetry_supported: false,
  private_link_telemetry_supported: false,
  file_creation_supported: false,
  file_update_supported: false,
  file_delete_supported: false,
  permission_change_supported: false,
  raw_download_supported: false,
  mutation_supported: false,
  background_sync_supported: false,
  scheduler_supported: false,
} as const;

const DriveReadIdSchema = z.string().trim().min(1).max(260);

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const DriveReadUrlSchema = z.string().trim().url();

const DriveReadMimeTypeSchema = z.string().trim().min(1).max(300);

export const DriveReadOAuthConfigSchema = z.strictObject({
  oauth_version: z.literal(DRIVE_READ_OAUTH_VERSION),
  client_id: z.string().trim().min(1),
  client_secret: z.string().trim().min(1).optional(),
  redirect_uri: DriveReadUrlSchema,
  scopes: z.array(z.literal(DRIVE_READ_SCOPE)).default([DRIVE_READ_SCOPE]),
  authorization_endpoint: DriveReadUrlSchema.default(
    "https://accounts.google.com/o/oauth2/v2/auth",
  ),
  token_endpoint: DriveReadUrlSchema.default(
    "https://oauth2.googleapis.com/token",
  ),
});

export const DriveReadOAuthAuthorizationResultSchema = z.strictObject({
  oauth_version: z.literal(DRIVE_READ_OAUTH_VERSION),
  authorization_url: DriveReadUrlSchema,
  scope: z.literal(DRIVE_READ_SCOPE),
  state_hash: HashReferenceSchema,
  client_id_hash: HashReferenceSchema,
  redirect_uri_hash: HashReferenceSchema,
  raw_client_secret_included: z.literal(false),
  raw_token_included: z.literal(false),
  mutation_scopes_requested: z.literal(false),
});

export const DriveReadOAuthTokenSecretSchema = z.strictObject({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
  expires_at: IsoDateTimeSchema.nullable().default(null),
  scope: z.literal(DRIVE_READ_SCOPE),
  token_type: z.string().trim().min(1).default("Bearer"),
});

export const DriveReadOAuthTokenExchangeResultSchema = z.strictObject({
  oauth_version: z.literal(DRIVE_READ_OAUTH_VERSION),
  connection_status: z.enum(["connected", "failed_closed"]),
  token: DriveReadOAuthTokenSecretSchema.nullable(),
  telemetry: z.strictObject({
    token_metadata_present: z.boolean(),
    token_ref_hash: HashReferenceSchema.nullable(),
    scope: z.literal(DRIVE_READ_SCOPE).nullable(),
    raw_access_token_included: z.literal(false),
    raw_refresh_token_included: z.literal(false),
    raw_client_secret_included: z.literal(false),
    oauth_response_body_included: z.literal(false),
    mutation_scopes_requested: z.literal(false),
  }),
  reasons: z.array(z.string().trim().min(1).max(120)).default([]),
});

export const DriveReadFileMetadataSchema = z.strictObject({
  adapter_version: z.literal(DRIVE_READ_ADAPTER_VERSION),
  file_id: DriveReadIdSchema,
  file_name: z.string().max(1000).nullable().default(null),
  mime_type: DriveReadMimeTypeSchema.nullable().default(null),
  modified_time: IsoDateTimeSchema.nullable().default(null),
  owner_domain: z.string().max(240).nullable().default(null),
  size_bytes: z.number().int().nonnegative().nullable().default(null),
  web_view_link: DriveReadUrlSchema.nullable().default(null),
  raw_file_contents_included: z.literal(false),
  document_body_included: z.literal(false),
  permission_list_included: z.literal(false),
});

export const DriveReadTelemetryEventSchema = z.strictObject({
  adapter_version: z.literal(DRIVE_READ_ADAPTER_VERSION),
  operation: z.enum(["list_recent", "search_files", "read_file_metadata"]),
  authority_level: z.literal("T0"),
  metadata_only: z.literal(true),
  file_id: DriveReadIdSchema.nullable().default(null),
  mime_type: DriveReadMimeTypeSchema.nullable().default(null),
  modified_time: IsoDateTimeSchema.nullable().default(null),
  owner_domain: z.string().max(240).nullable().default(null),
  result_count: z.number().int().nonnegative(),
  retrieval_latency_ms: z.number().nonnegative(),
  access_token_present: z.boolean(),
  raw_file_contents_included: z.literal(false),
  document_body_included: z.literal(false),
  permission_list_included: z.literal(false),
  private_link_included: z.literal(false),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
  credentials_included: z.literal(false),
  mutation_attempted: z.literal(false),
  create_attempted: z.literal(false),
  update_attempted: z.literal(false),
  delete_attempted: z.literal(false),
  permission_change_attempted: z.literal(false),
  download_attempted: z.literal(false),
});

export const DriveReadListResultSchema = z.strictObject({
  adapter_version: z.literal(DRIVE_READ_ADAPTER_VERSION),
  operation: z.enum(["list_recent", "search_files"]),
  files: z.array(DriveReadFileMetadataSchema),
  next_page_token: z.string().trim().min(1).max(240).nullable().default(null),
  telemetry: z.array(DriveReadTelemetryEventSchema),
  raw_file_contents_included: z.literal(false),
  document_bodies_included: z.literal(false),
  permission_lists_included: z.literal(false),
  mutation_performed: z.literal(false),
});

export const DriveReadMetadataResultSchema = z.strictObject({
  adapter_version: z.literal(DRIVE_READ_ADAPTER_VERSION),
  operation: z.literal("read_file_metadata"),
  file: DriveReadFileMetadataSchema,
  telemetry: DriveReadTelemetryEventSchema,
  raw_file_contents_included: z.literal(false),
  document_body_included: z.literal(false),
  permission_list_included: z.literal(false),
  mutation_performed: z.literal(false),
});

export type DriveReadOAuthConfig = z.infer<typeof DriveReadOAuthConfigSchema>;
export type DriveReadOAuthAuthorizationResult = z.infer<
  typeof DriveReadOAuthAuthorizationResultSchema
>;
export type DriveReadOAuthTokenSecret = z.infer<
  typeof DriveReadOAuthTokenSecretSchema
>;
export type DriveReadOAuthTokenExchangeResult = z.infer<
  typeof DriveReadOAuthTokenExchangeResultSchema
>;
export type DriveReadFileMetadata = z.infer<typeof DriveReadFileMetadataSchema>;
export type DriveReadTelemetryEvent = z.infer<
  typeof DriveReadTelemetryEventSchema
>;
export type DriveReadListResult = z.infer<typeof DriveReadListResultSchema>;
export type DriveReadMetadataResult = z.infer<
  typeof DriveReadMetadataResultSchema
>;

export interface DriveReadFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}

export type DriveReadFetch = (
  url: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<DriveReadFetchResponse>;

export interface DriveReadAdapterDependencies {
  readonly fetch: DriveReadFetch;
  readonly accessTokenProvider: () => Promise<DriveReadOAuthTokenSecret>;
  readonly now?: () => Date;
}

export interface DriveReadAdapter {
  readonly listRecentFiles: (input?: {
    readonly max_results?: number;
    readonly page_token?: string | null;
  }) => Promise<DriveReadListResult>;
  readonly searchFiles: (input: {
    readonly query: string;
    readonly max_results?: number;
    readonly page_token?: string | null;
  }) => Promise<DriveReadListResult>;
  readonly readFileMetadata: (input: {
    readonly file_id: string;
  }) => Promise<DriveReadMetadataResult>;
}

export function createDriveReadOAuthAuthorizationUrl(input: {
  readonly config: DriveReadOAuthConfig;
  readonly state: string;
}): DriveReadOAuthAuthorizationResult {
  const config = DriveReadOAuthConfigSchema.parse(input.config);
  const url = new URL(config.authorization_endpoint);

  url.searchParams.set("client_id", config.client_id);
  url.searchParams.set("redirect_uri", config.redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_READ_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return DriveReadOAuthAuthorizationResultSchema.parse({
    oauth_version: DRIVE_READ_OAUTH_VERSION,
    authorization_url: url.toString(),
    scope: DRIVE_READ_SCOPE,
    state_hash: hashReference(input.state),
    client_id_hash: hashReference(config.client_id),
    redirect_uri_hash: hashReference(config.redirect_uri),
    raw_client_secret_included: false,
    raw_token_included: false,
    mutation_scopes_requested: false,
  });
}

export async function exchangeDriveReadOAuthCode(input: {
  readonly config: DriveReadOAuthConfig;
  readonly authorization_code: string;
  readonly fetch: DriveReadFetch;
  readonly now?: () => Date;
}): Promise<DriveReadOAuthTokenExchangeResult> {
  const config = DriveReadOAuthConfigSchema.parse(input.config);
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
    return DriveReadOAuthTokenExchangeResultSchema.parse({
      oauth_version: DRIVE_READ_OAUTH_VERSION,
      connection_status: "failed_closed",
      token: null,
      telemetry: redactedTokenTelemetry(null),
      reasons: [`oauth_token_exchange_failed:${response.status}`],
    });
  }

  const payload = parseDriveTokenResponse(await response.json(), input.now);
  if (!payload) {
    return DriveReadOAuthTokenExchangeResultSchema.parse({
      oauth_version: DRIVE_READ_OAUTH_VERSION,
      connection_status: "failed_closed",
      token: null,
      telemetry: redactedTokenTelemetry(null),
      reasons: ["oauth_token_response_invalid"],
    });
  }

  return DriveReadOAuthTokenExchangeResultSchema.parse({
    oauth_version: DRIVE_READ_OAUTH_VERSION,
    connection_status: "connected",
    token: payload,
    telemetry: redactedTokenTelemetry(payload),
    reasons: [],
  });
}

export function createDriveReadAdapter(
  dependencies: DriveReadAdapterDependencies,
): DriveReadAdapter {
  return {
    listRecentFiles: (input) =>
      listFiles({
        dependencies,
        operation: "list_recent",
        query: "trashed = false",
        orderBy: "modifiedTime desc",
        max_results: input?.max_results,
        page_token: input?.page_token ?? null,
      }),
    searchFiles: (input) =>
      listFiles({
        dependencies,
        operation: "search_files",
        query: input.query,
        orderBy: "modifiedTime desc",
        max_results: input.max_results,
        page_token: input.page_token ?? null,
      }),
    readFileMetadata: async (input) => {
      const token = await dependencies.accessTokenProvider();
      const started = monotonicNow(dependencies);
      const file = await fetchFileMetadata(
        dependencies.fetch,
        token.access_token,
        input.file_id,
      );

      const telemetry = telemetryForFile({
        operation: "read_file_metadata",
        file,
        resultCount: 1,
        latency: monotonicNow(dependencies) - started,
        accessTokenPresent: Boolean(token.access_token),
      });

      return DriveReadMetadataResultSchema.parse({
        adapter_version: DRIVE_READ_ADAPTER_VERSION,
        operation: "read_file_metadata",
        file,
        telemetry,
        raw_file_contents_included: false,
        document_body_included: false,
        permission_list_included: false,
        mutation_performed: false,
      });
    },
  };
}

async function listFiles(input: {
  readonly dependencies: DriveReadAdapterDependencies;
  readonly operation: "list_recent" | "search_files";
  readonly query: string;
  readonly orderBy: string;
  readonly max_results?: number;
  readonly page_token: string | null;
}): Promise<DriveReadListResult> {
  const token = await input.dependencies.accessTokenProvider();
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", String(clampMaxResults(input.max_results)));
  url.searchParams.set("q", input.query);
  url.searchParams.set("orderBy", input.orderBy);
  url.searchParams.set(
    "fields",
    "nextPageToken, files(id,name,mimeType,modifiedTime,owners(emailAddress),size,webViewLink)",
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
    throw new Error(`drive_read_list_failed:${response.status}`);
  }

  const payload = DriveFilesApiResponseSchema.parse(await response.json());
  const files = payload.files.map(fileMetadataFromApi);
  const latency = monotonicNow(input.dependencies) - started;

  return DriveReadListResultSchema.parse({
    adapter_version: DRIVE_READ_ADAPTER_VERSION,
    operation: input.operation,
    files,
    next_page_token: payload.nextPageToken ?? null,
    telemetry: files.map((file) =>
      telemetryForFile({
        operation: input.operation,
        file,
        resultCount: files.length,
        latency,
        accessTokenPresent: Boolean(token.access_token),
      }),
    ),
    raw_file_contents_included: false,
    document_bodies_included: false,
    permission_lists_included: false,
    mutation_performed: false,
  });
}

async function fetchFileMetadata(
  fetchImpl: DriveReadFetch,
  accessToken: string,
  fileId: string,
): Promise<DriveReadFileMetadata> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
  );
  url.searchParams.set(
    "fields",
    "id,name,mimeType,modifiedTime,owners(emailAddress),size,webViewLink",
  );

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: authorizationHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(`drive_read_file_failed:${response.status}`);
  }

  return fileMetadataFromApi(
    DriveFileApiResponseSchema.parse(await response.json()),
  );
}

function fileMetadataFromApi(
  value: z.infer<typeof DriveFileApiResponseSchema>,
): DriveReadFileMetadata {
  return DriveReadFileMetadataSchema.parse({
    adapter_version: DRIVE_READ_ADAPTER_VERSION,
    file_id: value.id,
    file_name: value.name ?? null,
    mime_type: value.mimeType ?? null,
    modified_time: value.modifiedTime ?? null,
    owner_domain: value.owners?.[0]?.emailAddress
      ? extractDomain(value.owners[0].emailAddress)
      : null,
    size_bytes: sizeToNumber(value.size),
    web_view_link: value.webViewLink ?? null,
    raw_file_contents_included: false,
    document_body_included: false,
    permission_list_included: false,
  });
}

function parseDriveTokenResponse(
  value: unknown,
  now?: () => Date,
): DriveReadOAuthTokenSecret | null {
  const parsed = DriveTokenResponseSchema.safeParse(value);
  if (!parsed.success) return null;

  const expiresAt = parsed.data.expires_in
    ? new Date(
        (now?.() ?? new Date()).getTime() + parsed.data.expires_in * 1000,
      ).toISOString()
    : null;

  return DriveReadOAuthTokenSecretSchema.parse({
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token,
    expires_at: expiresAt,
    scope: DRIVE_READ_SCOPE,
    token_type: parsed.data.token_type ?? "Bearer",
  });
}

function redactedTokenTelemetry(
  token: DriveReadOAuthTokenSecret | null,
): DriveReadOAuthTokenExchangeResult["telemetry"] {
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

function telemetryForFile(input: {
  readonly operation: "list_recent" | "search_files" | "read_file_metadata";
  readonly file: DriveReadFileMetadata;
  readonly resultCount: number;
  readonly latency: number;
  readonly accessTokenPresent: boolean;
}): DriveReadTelemetryEvent {
  return DriveReadTelemetryEventSchema.parse({
    adapter_version: DRIVE_READ_ADAPTER_VERSION,
    operation: input.operation,
    authority_level: "T0",
    metadata_only: true,
    file_id: input.file.file_id,
    mime_type: input.file.mime_type,
    modified_time: input.file.modified_time,
    owner_domain: input.file.owner_domain,
    result_count: input.resultCount,
    retrieval_latency_ms: Math.max(0, input.latency),
    access_token_present: input.accessTokenPresent,
    raw_file_contents_included: false,
    document_body_included: false,
    permission_list_included: false,
    private_link_included: false,
    raw_access_token_included: false,
    raw_refresh_token_included: false,
    credentials_included: false,
    mutation_attempted: false,
    create_attempted: false,
    update_attempted: false,
    delete_attempted: false,
    permission_change_attempted: false,
    download_attempted: false,
  });
}

function authorizationHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function clampMaxResults(value: number | undefined): number {
  if (!value) return 10;
  return Math.max(1, Math.min(25, Math.trunc(value)));
}

function extractDomain(email: string): string | null {
  const match = email.match(/@([^>\s]+)>?$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function hashReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function monotonicNow(dependencies: Pick<DriveReadAdapterDependencies, "now">) {
  return dependencies.now?.().getTime() ?? Date.now();
}

function sizeToNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const DriveOwnerApiSchema = z.object({
  emailAddress: z.string().trim().min(1).optional(),
});

const DriveFileApiResponseSchema = z.object({
  id: DriveReadIdSchema,
  name: z.string().max(1000).optional(),
  mimeType: DriveReadMimeTypeSchema.optional(),
  modifiedTime: IsoDateTimeSchema.optional(),
  owners: z.array(DriveOwnerApiSchema).optional(),
  size: z.string().trim().optional(),
  webViewLink: DriveReadUrlSchema.optional(),
  permissions: z.array(z.unknown()).optional(),
});

const DriveFilesApiResponseSchema = z.object({
  files: z.array(DriveFileApiResponseSchema).default([]),
  nextPageToken: z.string().trim().min(1).max(240).optional(),
});

const DriveTokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  token_type: z.string().trim().min(1).optional(),
  scope: z.string().trim().optional(),
});
