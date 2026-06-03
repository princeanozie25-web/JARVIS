import { z } from "zod";
import { CALENDAR_READ_SCOPE } from "./calendar-read";
import { DRIVE_READ_SCOPE } from "./drive-read";
import { GMAIL_READ_SCOPE } from "./gmail-read";

export const GOOGLE_ACCOUNT_RUNTIME_VERSION =
  "phase21b.google-account-runtime.v1" as const;

export const GOOGLE_ACCOUNT_SERVICES = ["gmail", "calendar", "drive"] as const;

export const GOOGLE_ACCOUNT_CONNECTION_STATUSES = [
  "disconnected",
  "connected",
] as const;

export const GOOGLE_ACCOUNT_TOKEN_STATUSES = [
  "missing",
  "valid",
  "expired",
  "revoked",
] as const;

export const GOOGLE_ADAPTER_READINESS_STATUSES = [
  "unavailable",
  "connected",
  "ready",
  "future_not_configured",
] as const;

export const GOOGLE_ACCOUNT_REQUIRED_SCOPES = {
  gmail: GMAIL_READ_SCOPE,
  calendar: CALENDAR_READ_SCOPE,
  drive: DRIVE_READ_SCOPE,
} as const;

export const GOOGLE_ACCOUNT_RUNTIME_GOVERNANCE = {
  runtime_boundary: "google-adapters",
  shared_account_state_only: true,
  metadata_only: true,
  token_values_supported: false,
  token_persistence_supported: false,
  token_refresh_execution_supported: false,
  network_call_supported: false,
  gmail_feature_expansion_supported: false,
  calendar_feature_expansion_supported: false,
  drive_read_integration_supported: true,
  mutation_supported: false,
  scheduler_supported: false,
  background_sync_supported: false,
  provider_model_call_supported: false,
} as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const GoogleScopeSchema = z.enum([
  GOOGLE_ACCOUNT_REQUIRED_SCOPES.gmail,
  GOOGLE_ACCOUNT_REQUIRED_SCOPES.calendar,
  GOOGLE_ACCOUNT_REQUIRED_SCOPES.drive,
]);

export const GoogleAccountServiceSchema = z.enum(GOOGLE_ACCOUNT_SERVICES);

export const GoogleAccountConnectionStatusSchema = z.enum(
  GOOGLE_ACCOUNT_CONNECTION_STATUSES,
);

export const GoogleAccountTokenStatusSchema = z.enum(
  GOOGLE_ACCOUNT_TOKEN_STATUSES,
);

export const GoogleAdapterReadinessStatusSchema = z.enum(
  GOOGLE_ADAPTER_READINESS_STATUSES,
);

export const GoogleAccountTokenMetadataSchema = z.strictObject({
  access_token_present: z.boolean(),
  refresh_token_present: z.boolean(),
  expires_at: IsoDateTimeSchema.nullable().default(null),
  revoked_at: IsoDateTimeSchema.nullable().default(null),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
  raw_credentials_included: z.literal(false),
});

export const GoogleAccountRuntimeInputSchema = z.strictObject({
  runtime_version: z.literal(GOOGLE_ACCOUNT_RUNTIME_VERSION),
  checked_at: IsoDateTimeSchema,
  token_metadata: GoogleAccountTokenMetadataSchema,
  granted_scopes: z.array(GoogleScopeSchema).default([]),
  adapter_configuration: z
    .strictObject({
      gmail_configured: z.boolean().default(false),
      calendar_configured: z.boolean().default(false),
      drive_configured: z.boolean().default(false),
    })
    .default({
      gmail_configured: false,
      calendar_configured: false,
      drive_configured: false,
    }),
  observed_latency_ms: z.number().nonnegative().nullable().default(null),
  telemetry_metadata_only: z.literal(true),
});

export const GoogleScopeStatusSchema = z.strictObject({
  service: GoogleAccountServiceSchema,
  scope: GoogleScopeSchema,
  required: z.literal(true),
  granted: z.boolean(),
});

export const GoogleAdapterReadinessSchema = z.strictObject({
  service: GoogleAccountServiceSchema,
  status: GoogleAdapterReadinessStatusSchema,
  configured: z.boolean(),
  required_scope: GoogleScopeSchema,
  scope_granted: z.boolean(),
  token_status: GoogleAccountTokenStatusSchema,
  connection_status: GoogleAccountConnectionStatusSchema,
  reasons: z.array(z.string().trim().min(1).max(120)),
});

export const GoogleAccountRuntimeTelemetrySchema = z.strictObject({
  runtime_version: z.literal(GOOGLE_ACCOUNT_RUNTIME_VERSION),
  connection_status: GoogleAccountConnectionStatusSchema,
  token_status: GoogleAccountTokenStatusSchema,
  granted_scope_count: z.number().int().nonnegative(),
  required_scope_count: z.number().int().nonnegative(),
  ready_adapter_count: z.number().int().nonnegative(),
  configured_adapter_count: z.number().int().nonnegative(),
  observed_latency_ms: z.number().nonnegative().nullable(),
  metadata_only: z.literal(true),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
  raw_credentials_included: z.literal(false),
  email_body_included: z.literal(false),
  calendar_event_content_included: z.literal(false),
  mutation_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  token_refresh_attempted: z.literal(false),
});

export const GoogleConnectionSummarySchema = z.strictObject({
  runtime_version: z.literal(GOOGLE_ACCOUNT_RUNTIME_VERSION),
  connection_status: GoogleAccountConnectionStatusSchema,
  token_status: GoogleAccountTokenStatusSchema,
  token_present: z.boolean(),
  refresh_token_present: z.boolean(),
  expires_at: IsoDateTimeSchema.nullable(),
  granted_scope_count: z.number().int().nonnegative(),
  missing_scope_count: z.number().int().nonnegative(),
  gmail_status: GoogleAdapterReadinessStatusSchema,
  calendar_status: GoogleAdapterReadinessStatusSchema,
  drive_status: GoogleAdapterReadinessStatusSchema,
  ready_adapter_count: z.number().int().nonnegative(),
  health: z.enum(["healthy", "degraded", "unavailable"]),
  telemetry: GoogleAccountRuntimeTelemetrySchema,
});

export const GoogleAccountRuntimeSchema = z.strictObject({
  runtime_version: z.literal(GOOGLE_ACCOUNT_RUNTIME_VERSION),
  checked_at: IsoDateTimeSchema,
  connection_status: GoogleAccountConnectionStatusSchema,
  token_status: GoogleAccountTokenStatusSchema,
  token_metadata: GoogleAccountTokenMetadataSchema,
  scope_statuses: z.array(GoogleScopeStatusSchema),
  adapter_readiness: z.strictObject({
    gmail: GoogleAdapterReadinessSchema,
    calendar: GoogleAdapterReadinessSchema,
    drive: GoogleAdapterReadinessSchema,
  }),
  telemetry: GoogleAccountRuntimeTelemetrySchema,
  governance: z.literal("metadata_only_no_authority_expansion"),
});

export type GoogleAccountService = z.infer<typeof GoogleAccountServiceSchema>;
export type GoogleAccountConnectionStatus = z.infer<
  typeof GoogleAccountConnectionStatusSchema
>;
export type GoogleAccountTokenStatus = z.infer<
  typeof GoogleAccountTokenStatusSchema
>;
export type GoogleAdapterReadinessStatus = z.infer<
  typeof GoogleAdapterReadinessStatusSchema
>;
export type GoogleAccountTokenMetadata = z.infer<
  typeof GoogleAccountTokenMetadataSchema
>;
export type GoogleAccountRuntimeInput = z.infer<
  typeof GoogleAccountRuntimeInputSchema
>;
export type GoogleScopeStatus = z.infer<typeof GoogleScopeStatusSchema>;
export type GoogleAdapterReadiness = z.infer<
  typeof GoogleAdapterReadinessSchema
>;
export type GoogleAccountRuntimeTelemetry = z.infer<
  typeof GoogleAccountRuntimeTelemetrySchema
>;
export type GoogleConnectionSummary = z.infer<
  typeof GoogleConnectionSummarySchema
>;
export type GoogleAccountRuntime = z.infer<typeof GoogleAccountRuntimeSchema>;

export function createGoogleAccountRuntime(
  input: GoogleAccountRuntimeInput,
): GoogleAccountRuntime {
  const parsed = GoogleAccountRuntimeInputSchema.parse(input);
  const tokenStatus = getTokenStatus(
    parsed.token_metadata,
    new Date(parsed.checked_at),
  );
  const connectionStatus = getConnectionStatusFromTokenStatus(tokenStatus);
  const scopeStatuses = buildScopeStatuses(parsed.granted_scopes);
  const adapterReadiness = {
    gmail: buildReadiness({
      service: "gmail",
      configured: parsed.adapter_configuration.gmail_configured,
      scopeStatuses,
      tokenStatus,
      connectionStatus,
    }),
    calendar: buildReadiness({
      service: "calendar",
      configured: parsed.adapter_configuration.calendar_configured,
      scopeStatuses,
      tokenStatus,
      connectionStatus,
    }),
    drive: buildReadiness({
      service: "drive",
      configured: parsed.adapter_configuration.drive_configured,
      scopeStatuses,
      tokenStatus,
      connectionStatus,
    }),
  };

  const configuredAdapterCount = [
    parsed.adapter_configuration.gmail_configured,
    parsed.adapter_configuration.calendar_configured,
    parsed.adapter_configuration.drive_configured,
  ].filter(Boolean).length;
  const readyAdapterCount = Object.values(adapterReadiness).filter(
    (readiness) => readiness.status === "ready",
  ).length;

  return GoogleAccountRuntimeSchema.parse({
    runtime_version: GOOGLE_ACCOUNT_RUNTIME_VERSION,
    checked_at: parsed.checked_at,
    connection_status: connectionStatus,
    token_status: tokenStatus,
    token_metadata: parsed.token_metadata,
    scope_statuses: scopeStatuses,
    adapter_readiness: adapterReadiness,
    telemetry: {
      runtime_version: GOOGLE_ACCOUNT_RUNTIME_VERSION,
      connection_status: connectionStatus,
      token_status: tokenStatus,
      granted_scope_count: scopeStatuses.filter((scope) => scope.granted)
        .length,
      required_scope_count: scopeStatuses.length,
      ready_adapter_count: readyAdapterCount,
      configured_adapter_count: configuredAdapterCount,
      observed_latency_ms: parsed.observed_latency_ms,
      metadata_only: true,
      raw_access_token_included: false,
      raw_refresh_token_included: false,
      raw_credentials_included: false,
      email_body_included: false,
      calendar_event_content_included: false,
      mutation_attempted: false,
      network_call_attempted: false,
      token_refresh_attempted: false,
    },
    governance: "metadata_only_no_authority_expansion",
  });
}

export function getConnectionStatus(
  runtime: GoogleAccountRuntime,
): GoogleAccountConnectionStatus {
  return GoogleAccountRuntimeSchema.parse(runtime).connection_status;
}

export function getGrantedScopes(
  runtime: GoogleAccountRuntime,
): readonly GoogleScopeStatus[] {
  return GoogleAccountRuntimeSchema.parse(runtime).scope_statuses.filter(
    (scope) => scope.granted,
  );
}

export function getAdapterReadiness(
  runtime: GoogleAccountRuntime,
): GoogleAccountRuntime["adapter_readiness"] {
  return GoogleAccountRuntimeSchema.parse(runtime).adapter_readiness;
}

export function summarizeGoogleAccountRuntime(
  runtime: GoogleAccountRuntime,
): GoogleConnectionSummary {
  const parsed = GoogleAccountRuntimeSchema.parse(runtime);
  const missingScopeCount = parsed.scope_statuses.filter(
    (scope) => !scope.granted,
  ).length;
  const readyAdapterCount = Object.values(parsed.adapter_readiness).filter(
    (readiness) => readiness.status === "ready",
  ).length;

  return GoogleConnectionSummarySchema.parse({
    runtime_version: GOOGLE_ACCOUNT_RUNTIME_VERSION,
    connection_status: parsed.connection_status,
    token_status: parsed.token_status,
    token_present: parsed.token_metadata.access_token_present,
    refresh_token_present: parsed.token_metadata.refresh_token_present,
    expires_at: parsed.token_metadata.expires_at,
    granted_scope_count: parsed.scope_statuses.filter((scope) => scope.granted)
      .length,
    missing_scope_count: missingScopeCount,
    gmail_status: parsed.adapter_readiness.gmail.status,
    calendar_status: parsed.adapter_readiness.calendar.status,
    drive_status: parsed.adapter_readiness.drive.status,
    ready_adapter_count: readyAdapterCount,
    health:
      readyAdapterCount >= 2
        ? "healthy"
        : parsed.connection_status === "connected"
          ? "degraded"
          : "unavailable",
    telemetry: parsed.telemetry,
  });
}

function getTokenStatus(
  token: GoogleAccountTokenMetadata,
  checkedAt: Date,
): GoogleAccountTokenStatus {
  if (token.revoked_at) return "revoked";
  if (!token.access_token_present) return "missing";
  if (!token.expires_at) return "valid";
  return Date.parse(token.expires_at) > checkedAt.getTime()
    ? "valid"
    : "expired";
}

function getConnectionStatusFromTokenStatus(
  tokenStatus: GoogleAccountTokenStatus,
): GoogleAccountConnectionStatus {
  return tokenStatus === "valid" ? "connected" : "disconnected";
}

function buildScopeStatuses(
  grantedScopes: readonly string[],
): readonly GoogleScopeStatus[] {
  const granted = new Set(grantedScopes);

  return GOOGLE_ACCOUNT_SERVICES.map((service) =>
    GoogleScopeStatusSchema.parse({
      service,
      scope: GOOGLE_ACCOUNT_REQUIRED_SCOPES[service],
      required: true,
      granted: granted.has(GOOGLE_ACCOUNT_REQUIRED_SCOPES[service]),
    }),
  );
}

function buildReadiness(input: {
  readonly service: GoogleAccountService;
  readonly configured: boolean;
  readonly scopeStatuses: readonly GoogleScopeStatus[];
  readonly tokenStatus: GoogleAccountTokenStatus;
  readonly connectionStatus: GoogleAccountConnectionStatus;
}): GoogleAdapterReadiness {
  const scope = input.scopeStatuses.find(
    (scopeStatus) => scopeStatus.service === input.service,
  );
  const scopeGranted = Boolean(scope?.granted);
  const reasons: string[] = [];

  if (input.service === "drive" && !input.configured) {
    reasons.push("drive_future_placeholder");
    return GoogleAdapterReadinessSchema.parse({
      service: input.service,
      status: "future_not_configured",
      configured: false,
      required_scope: GOOGLE_ACCOUNT_REQUIRED_SCOPES[input.service],
      scope_granted: scopeGranted,
      token_status: input.tokenStatus,
      connection_status: input.connectionStatus,
      reasons,
    });
  }

  if (!input.configured) reasons.push("adapter_not_configured");
  if (input.tokenStatus !== "valid") reasons.push(`token_${input.tokenStatus}`);
  if (!scopeGranted) reasons.push("required_scope_missing");

  const status = adapterStatus({
    configured: input.configured,
    tokenStatus: input.tokenStatus,
    scopeGranted,
  });

  if (status === "ready") reasons.push("ready");
  if (status === "connected") reasons.push("connected_scope_pending");

  return GoogleAdapterReadinessSchema.parse({
    service: input.service,
    status,
    configured: input.configured,
    required_scope: GOOGLE_ACCOUNT_REQUIRED_SCOPES[input.service],
    scope_granted: scopeGranted,
    token_status: input.tokenStatus,
    connection_status: input.connectionStatus,
    reasons,
  });
}

function adapterStatus(input: {
  readonly configured: boolean;
  readonly tokenStatus: GoogleAccountTokenStatus;
  readonly scopeGranted: boolean;
}): GoogleAdapterReadinessStatus {
  if (!input.configured) return "unavailable";
  if (input.tokenStatus !== "valid") return "unavailable";
  return input.scopeGranted ? "ready" : "connected";
}
