import { z } from "zod";

export const GOOGLE_OAUTH_READINESS_VERSION =
  "phase21b.google-oauth-readiness.v1" as const;

export const GOOGLE_OAUTH_READINESS_STATES = [
  "not_configured",
  "client_config_present",
  "user_authorization_required",
  "authorized",
  "expired",
  "revoked",
  "unavailable",
] as const;

export const GOOGLE_OAUTH_READINESS_REASONS = [
  "client_config_missing",
  "client_config_present",
  "authorization_metadata_missing",
  "user_authorization_required",
  "token_metadata_present",
  "token_metadata_missing",
  "required_scopes_granted",
  "required_scopes_missing",
  "token_expired",
  "token_revoked",
  "invalid_readiness_input",
  "metadata_only",
  "no_oauth_execution",
  "no_token_values",
] as const;

export const GOOGLE_OAUTH_SERVICES = ["gmail", "calendar", "drive"] as const;

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
] as const;

export const GOOGLE_OAUTH_MUTATION_SCOPE_PATTERNS = [
  "gmail.modify",
  "gmail.send",
  "gmail.compose",
  "gmail.insert",
  "gmail.labels",
  "calendar.events",
  "calendar.acl",
  "drive.file",
  "drive.appdata",
  "drive",
] as const;

export const GOOGLE_OAUTH_SCOPE_POLICY = {
  gmail: {
    required_scopes: ["https://www.googleapis.com/auth/gmail.metadata"],
    metadata_only: true,
    body_access_supported: false,
    mutation_supported: false,
  },
  calendar: {
    required_scopes: [
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.freebusy",
    ],
    metadata_only: true,
    body_access_supported: false,
    mutation_supported: false,
  },
  drive: {
    required_scopes: [
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
    metadata_only: true,
    file_download_supported: false,
    mutation_supported: false,
  },
  scope_policy_requires_live_verification_before_oauth: true,
} as const;

export const GOOGLE_OAUTH_TOKEN_STORAGE_POLICY = {
  allowed_locations: [
    "os_secret_manager",
    "encrypted_local_secret_store",
    "user_local_env_metadata_only",
  ],
  forbidden_locations: [
    "git_repository",
    "obsidian_vault",
    "sqlite_event_store",
    "vector_store",
    "telemetry",
    "logs",
    "test_snapshots",
  ],
  gitignore_expectations: [
    ".env.local",
    ".env*.local",
    ".jarvis/google-oauth/",
    "secrets/",
  ],
  raw_token_values_allowed_in_telemetry: false,
  raw_client_secret_allowed_in_telemetry: false,
  background_refresh_allowed: false,
  rotation_user_initiated_only: true,
  revocation_explicitly_detected_by_metadata_only: true,
} as const;

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const GoogleOAuthReadinessStateSchema = z.enum(
  GOOGLE_OAUTH_READINESS_STATES,
);
export const GoogleOAuthReadinessReasonSchema = z.enum(
  GOOGLE_OAUTH_READINESS_REASONS,
);
export const GoogleOAuthServiceSchema = z.enum(GOOGLE_OAUTH_SERVICES);
export const GoogleOAuthScopeSchema = z.enum(GOOGLE_OAUTH_SCOPES);

export const GoogleOAuthClientConfigMetadataSchema = z.strictObject({
  client_config_present: z.boolean(),
  location: z.enum([
    "absent",
    "os_secret_manager",
    "encrypted_local_secret_store",
    "user_local_env_metadata_only",
  ]),
  client_id_hash: HashReferenceSchema.nullable().default(null),
  client_secret_metadata_present: z.boolean(),
  raw_client_id_included: z.literal(false),
  raw_client_secret_included: z.literal(false),
});

export const GoogleOAuthAuthorizationMetadataSchema = z.strictObject({
  authorization_metadata_present: z.boolean(),
  granted_scopes: z.array(GoogleOAuthScopeSchema).default([]),
  raw_authorization_code_included: z.literal(false),
  authorization_url_generated: z.literal(false),
});

export const GoogleOAuthTokenMetadataSchema = z.strictObject({
  token_metadata_present: z.boolean(),
  location: z.enum([
    "absent",
    "os_secret_manager",
    "encrypted_local_secret_store",
    "user_local_env_metadata_only",
  ]),
  access_token_metadata_present: z.boolean(),
  refresh_token_metadata_present: z.boolean(),
  token_ref_hash: HashReferenceSchema.nullable().default(null),
  expires_at: IsoDateTimeSchema.nullable().default(null),
  revoked_at: IsoDateTimeSchema.nullable().default(null),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
});

export const GoogleOAuthReadinessInputSchema = z.strictObject({
  readiness_version: z.literal(GOOGLE_OAUTH_READINESS_VERSION),
  checked_at: IsoDateTimeSchema,
  requested_services: z
    .array(GoogleOAuthServiceSchema)
    .default(["gmail", "calendar", "drive"]),
  client_config: GoogleOAuthClientConfigMetadataSchema,
  authorization: GoogleOAuthAuthorizationMetadataSchema,
  token_metadata: GoogleOAuthTokenMetadataSchema,
  telemetry_metadata_only: z.literal(true),
});

export const GoogleOAuthReadinessTelemetrySchema = z.strictObject({
  readiness_version: z.literal(GOOGLE_OAUTH_READINESS_VERSION),
  state: GoogleOAuthReadinessStateSchema,
  requested_services: z.array(GoogleOAuthServiceSchema),
  granted_scope_count: z.number().int().nonnegative(),
  missing_scope_count: z.number().int().nonnegative(),
  token_metadata_present: z.boolean(),
  client_config_present: z.boolean(),
  metadata_only: z.literal(true),
  raw_token_values_included: z.literal(false),
  raw_client_secret_included: z.literal(false),
  oauth_response_included: z.literal(false),
  authorization_url_included: z.literal(false),
});

export const GoogleOAuthReadinessReportSchema = z.strictObject({
  readiness_version: z.literal(GOOGLE_OAUTH_READINESS_VERSION),
  state: GoogleOAuthReadinessStateSchema,
  reasons: z.array(GoogleOAuthReadinessReasonSchema),
  requested_services: z.array(GoogleOAuthServiceSchema),
  required_scopes: z.array(GoogleOAuthScopeSchema),
  granted_scopes: z.array(GoogleOAuthScopeSchema),
  missing_scopes: z.array(GoogleOAuthScopeSchema),
  token_storage_policy: z.literal("metadata_only_contract"),
  scope_policy_requires_live_verification_before_oauth: z.literal(true),
  oauth_call_attempted: z.literal(false),
  google_api_call_attempted: z.literal(false),
  authorization_url_generated: z.literal(false),
  token_refresh_attempted: z.literal(false),
  background_refresh_enabled: z.literal(false),
  mutation_scopes_requested: z.literal(false),
  mutation_attempted: z.literal(false),
  telemetry: GoogleOAuthReadinessTelemetrySchema,
});

export type GoogleOAuthReadinessState = z.infer<
  typeof GoogleOAuthReadinessStateSchema
>;
export type GoogleOAuthReadinessReason = z.infer<
  typeof GoogleOAuthReadinessReasonSchema
>;
export type GoogleOAuthService = z.infer<typeof GoogleOAuthServiceSchema>;
export type GoogleOAuthScope = z.infer<typeof GoogleOAuthScopeSchema>;
export type GoogleOAuthReadinessInput = z.infer<
  typeof GoogleOAuthReadinessInputSchema
>;
export type GoogleOAuthReadinessReport = z.infer<
  typeof GoogleOAuthReadinessReportSchema
>;

export function checkGoogleOAuthReadiness(
  input: unknown,
): GoogleOAuthReadinessReport {
  const parsed = GoogleOAuthReadinessInputSchema.safeParse(input);
  if (!parsed.success) {
    return unavailableReport();
  }

  const readinessInput = parsed.data;
  const requiredScopes = requiredScopesForServices(
    readinessInput.requested_services,
  );
  const grantedScopes = readinessInput.authorization.granted_scopes;
  const missingScopes = requiredScopes.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  const state = determineReadinessState(
    readinessInput,
    missingScopes.length > 0,
  );
  const reasons = readinessReasons(readinessInput, state, missingScopes);

  return GoogleOAuthReadinessReportSchema.parse({
    readiness_version: GOOGLE_OAUTH_READINESS_VERSION,
    state,
    reasons,
    requested_services: readinessInput.requested_services,
    required_scopes: requiredScopes,
    granted_scopes: grantedScopes,
    missing_scopes: missingScopes,
    token_storage_policy: "metadata_only_contract",
    scope_policy_requires_live_verification_before_oauth: true,
    oauth_call_attempted: false,
    google_api_call_attempted: false,
    authorization_url_generated: false,
    token_refresh_attempted: false,
    background_refresh_enabled: false,
    mutation_scopes_requested: false,
    mutation_attempted: false,
    telemetry: readinessTelemetry({
      input: readinessInput,
      state,
      missingScopeCount: missingScopes.length,
    }),
  });
}

function determineReadinessState(
  input: GoogleOAuthReadinessInput,
  hasMissingScopes: boolean,
): GoogleOAuthReadinessState {
  if (!input.client_config.client_config_present) return "not_configured";
  if (!input.authorization.authorization_metadata_present) {
    return "client_config_present";
  }
  if (input.token_metadata.revoked_at !== null) return "revoked";
  if (isExpired(input.token_metadata.expires_at, input.checked_at)) {
    return "expired";
  }
  if (!input.token_metadata.token_metadata_present || hasMissingScopes) {
    return "user_authorization_required";
  }
  return "authorized";
}

function readinessReasons(
  input: GoogleOAuthReadinessInput,
  state: GoogleOAuthReadinessState,
  missingScopes: readonly GoogleOAuthScope[],
): readonly GoogleOAuthReadinessReason[] {
  const reasons: GoogleOAuthReadinessReason[] = [
    "metadata_only",
    "no_oauth_execution",
  ];
  if (input.client_config.client_config_present) {
    reasons.push("client_config_present");
  } else {
    reasons.push("client_config_missing");
  }
  if (input.authorization.authorization_metadata_present) {
    if (missingScopes.length === 0) {
      reasons.push("required_scopes_granted");
    } else {
      reasons.push("required_scopes_missing");
    }
  } else {
    reasons.push("authorization_metadata_missing");
  }
  if (input.token_metadata.token_metadata_present) {
    reasons.push("token_metadata_present");
  } else {
    reasons.push("token_metadata_missing");
  }
  if (state === "user_authorization_required") {
    reasons.push("user_authorization_required");
  }
  if (state === "expired") reasons.push("token_expired");
  if (state === "revoked") reasons.push("token_revoked");
  reasons.push("no_token_values");
  return unique(reasons);
}

function readinessTelemetry(input: {
  readonly input: GoogleOAuthReadinessInput;
  readonly state: GoogleOAuthReadinessState;
  readonly missingScopeCount: number;
}): z.infer<typeof GoogleOAuthReadinessTelemetrySchema> {
  return GoogleOAuthReadinessTelemetrySchema.parse({
    readiness_version: GOOGLE_OAUTH_READINESS_VERSION,
    state: input.state,
    requested_services: input.input.requested_services,
    granted_scope_count: input.input.authorization.granted_scopes.length,
    missing_scope_count: input.missingScopeCount,
    token_metadata_present: input.input.token_metadata.token_metadata_present,
    client_config_present: input.input.client_config.client_config_present,
    metadata_only: true,
    raw_token_values_included: false,
    raw_client_secret_included: false,
    oauth_response_included: false,
    authorization_url_included: false,
  });
}

function unavailableReport(): GoogleOAuthReadinessReport {
  return GoogleOAuthReadinessReportSchema.parse({
    readiness_version: GOOGLE_OAUTH_READINESS_VERSION,
    state: "unavailable",
    reasons: [
      "invalid_readiness_input",
      "metadata_only",
      "no_oauth_execution",
      "no_token_values",
    ],
    requested_services: [],
    required_scopes: [],
    granted_scopes: [],
    missing_scopes: [],
    token_storage_policy: "metadata_only_contract",
    scope_policy_requires_live_verification_before_oauth: true,
    oauth_call_attempted: false,
    google_api_call_attempted: false,
    authorization_url_generated: false,
    token_refresh_attempted: false,
    background_refresh_enabled: false,
    mutation_scopes_requested: false,
    mutation_attempted: false,
    telemetry: {
      readiness_version: GOOGLE_OAUTH_READINESS_VERSION,
      state: "unavailable",
      requested_services: [],
      granted_scope_count: 0,
      missing_scope_count: 0,
      token_metadata_present: false,
      client_config_present: false,
      metadata_only: true,
      raw_token_values_included: false,
      raw_client_secret_included: false,
      oauth_response_included: false,
      authorization_url_included: false,
    },
  });
}

function requiredScopesForServices(
  services: readonly GoogleOAuthService[],
): GoogleOAuthScope[] {
  const scopes = services.flatMap((service) => {
    if (service === "gmail")
      return GOOGLE_OAUTH_SCOPE_POLICY.gmail.required_scopes;
    if (service === "calendar") {
      return GOOGLE_OAUTH_SCOPE_POLICY.calendar.required_scopes;
    }
    return GOOGLE_OAUTH_SCOPE_POLICY.drive.required_scopes;
  });
  return unique(scopes);
}

function isExpired(expiresAt: string | null, checkedAt: string): boolean {
  if (!expiresAt) return false;
  return Date.parse(expiresAt) <= Date.parse(checkedAt);
}

function unique<const Value extends string>(values: readonly Value[]): Value[] {
  return Array.from(new Set(values));
}
