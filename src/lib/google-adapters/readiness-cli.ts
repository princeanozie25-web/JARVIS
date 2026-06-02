import { z } from "zod";
import {
  GOOGLE_OAUTH_READINESS_VERSION,
  GoogleOAuthReadinessReportSchema,
  GoogleOAuthScopeSchema,
  checkGoogleOAuthReadiness,
  type GoogleOAuthReadinessInput,
  type GoogleOAuthReadinessReport,
  type GoogleOAuthScope,
} from "./oauth-readiness";

export const GOOGLE_READINESS_CLI_VERSION =
  "phase21b.google-readiness-cli.v1" as const;

export const GOOGLE_READINESS_ENV_KEYS = [
  "GOOGLE_OAUTH_CLIENT_CONFIG_PRESENT",
  "GOOGLE_OAUTH_CLIENT_CONFIG_LOCATION",
  "GOOGLE_OAUTH_CLIENT_ID_HASH",
  "GOOGLE_OAUTH_CLIENT_SECRET_METADATA_PRESENT",
  "GOOGLE_OAUTH_AUTHORIZATION_METADATA_PRESENT",
  "GOOGLE_OAUTH_GRANTED_SCOPES",
  "GOOGLE_OAUTH_TOKEN_METADATA_PRESENT",
  "GOOGLE_OAUTH_TOKEN_LOCATION",
  "GOOGLE_OAUTH_ACCESS_TOKEN_METADATA_PRESENT",
  "GOOGLE_OAUTH_REFRESH_TOKEN_METADATA_PRESENT",
  "GOOGLE_OAUTH_TOKEN_REF_HASH",
  "GOOGLE_OAUTH_TOKEN_EXPIRES_AT",
  "GOOGLE_OAUTH_TOKEN_REVOKED_AT",
] as const;

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const StorageLocationSchema = z.enum([
  "absent",
  "os_secret_manager",
  "encrypted_local_secret_store",
  "user_local_env_metadata_only",
]);

export type GoogleReadinessCliEnv = Record<string, string | undefined>;

export type GoogleReadinessCliReport = {
  readonly cli_version: typeof GOOGLE_READINESS_CLI_VERSION;
  readonly status: "ok";
  readonly readiness: GoogleOAuthReadinessReport;
  readonly missing_config_fields: readonly string[];
  readonly redaction: {
    readonly metadata_only: true;
    readonly token_values_printed: false;
    readonly secrets_printed: false;
    readonly authorization_url_generated: false;
    readonly google_api_called: false;
    readonly background_sync_enabled: false;
  };
};

export function googleOAuthReadinessInputFromEnv(
  env: GoogleReadinessCliEnv,
  checkedAt = new Date().toISOString(),
): GoogleOAuthReadinessInput {
  const clientIdHash = hashOrNull(env.GOOGLE_OAUTH_CLIENT_ID_HASH);
  const tokenRefHash = hashOrNull(env.GOOGLE_OAUTH_TOKEN_REF_HASH);
  const clientSecretMetadataPresent = bool(
    env.GOOGLE_OAUTH_CLIENT_SECRET_METADATA_PRESENT,
  );
  const clientConfigPresent =
    bool(env.GOOGLE_OAUTH_CLIENT_CONFIG_PRESENT) ||
    clientIdHash !== null ||
    clientSecretMetadataPresent;
  const grantedScopes = parseGrantedScopes(env.GOOGLE_OAUTH_GRANTED_SCOPES);
  const authorizationMetadataPresent =
    bool(env.GOOGLE_OAUTH_AUTHORIZATION_METADATA_PRESENT) ||
    grantedScopes.length > 0;
  const tokenMetadataPresent =
    bool(env.GOOGLE_OAUTH_TOKEN_METADATA_PRESENT) || tokenRefHash !== null;

  return {
    readiness_version: GOOGLE_OAUTH_READINESS_VERSION,
    checked_at: checkedAt,
    requested_services: ["gmail", "calendar", "drive"],
    client_config: {
      client_config_present: clientConfigPresent,
      location: storageLocation(
        env.GOOGLE_OAUTH_CLIENT_CONFIG_LOCATION,
        clientConfigPresent,
      ),
      client_id_hash: clientIdHash,
      client_secret_metadata_present: clientSecretMetadataPresent,
      raw_client_id_included: false,
      raw_client_secret_included: false,
    },
    authorization: {
      authorization_metadata_present: authorizationMetadataPresent,
      granted_scopes: grantedScopes,
      raw_authorization_code_included: false,
      authorization_url_generated: false,
    },
    token_metadata: {
      token_metadata_present: tokenMetadataPresent,
      location: storageLocation(
        env.GOOGLE_OAUTH_TOKEN_LOCATION,
        tokenMetadataPresent,
      ),
      access_token_metadata_present:
        bool(env.GOOGLE_OAUTH_ACCESS_TOKEN_METADATA_PRESENT) ||
        tokenMetadataPresent,
      refresh_token_metadata_present:
        bool(env.GOOGLE_OAUTH_REFRESH_TOKEN_METADATA_PRESENT) ||
        tokenMetadataPresent,
      token_ref_hash: tokenRefHash,
      expires_at: env.GOOGLE_OAUTH_TOKEN_EXPIRES_AT ?? null,
      revoked_at: env.GOOGLE_OAUTH_TOKEN_REVOKED_AT ?? null,
      raw_access_token_included: false,
      raw_refresh_token_included: false,
    },
    telemetry_metadata_only: true,
  };
}

export function createGoogleReadinessCliReport(input: {
  readonly env: GoogleReadinessCliEnv;
  readonly checkedAt?: string;
}): GoogleReadinessCliReport {
  const readiness = GoogleOAuthReadinessReportSchema.parse(
    checkGoogleOAuthReadiness(
      googleOAuthReadinessInputFromEnv(input.env, input.checkedAt),
    ),
  );
  return {
    cli_version: GOOGLE_READINESS_CLI_VERSION,
    status: "ok",
    readiness,
    missing_config_fields: missingConfigFields(readiness),
    redaction: {
      metadata_only: true,
      token_values_printed: false,
      secrets_printed: false,
      authorization_url_generated: false,
      google_api_called: false,
      background_sync_enabled: false,
    },
  };
}

export function printGoogleReadinessCliReport(
  report: GoogleReadinessCliReport,
  write: (line: string) => void = console.log,
): void {
  write(
    JSON.stringify(
      {
        cli_version: report.cli_version,
        status: report.status,
        setup_state: report.readiness.state,
        missing_config_fields: report.missing_config_fields,
        required_scopes: report.readiness.required_scopes,
        missing_scopes: report.readiness.missing_scopes,
        granted_scope_count: report.readiness.granted_scopes.length,
        token_metadata_present:
          report.readiness.telemetry.token_metadata_present,
        client_config_present: report.readiness.telemetry.client_config_present,
        redaction: report.redaction,
        governance: {
          oauth_call_attempted: report.readiness.oauth_call_attempted,
          google_api_call_attempted: report.readiness.google_api_call_attempted,
          authorization_url_generated:
            report.readiness.authorization_url_generated,
          token_refresh_attempted: report.readiness.token_refresh_attempted,
          background_refresh_enabled:
            report.readiness.background_refresh_enabled,
          mutation_attempted: report.readiness.mutation_attempted,
        },
      },
      null,
      2,
    ),
  );
}

export function runGoogleReadinessCli(input: {
  readonly env: GoogleReadinessCliEnv;
  readonly checkedAt?: string;
  readonly write?: (line: string) => void;
}): GoogleReadinessCliReport {
  const report = createGoogleReadinessCliReport({
    env: input.env,
    checkedAt: input.checkedAt,
  });
  printGoogleReadinessCliReport(report, input.write);
  return report;
}

function missingConfigFields(
  report: GoogleOAuthReadinessReport,
): readonly string[] {
  const fields: string[] = [];
  if (!report.telemetry.client_config_present) {
    fields.push("GOOGLE_OAUTH_CLIENT_CONFIG_PRESENT");
    fields.push("GOOGLE_OAUTH_CLIENT_ID_HASH");
    fields.push("GOOGLE_OAUTH_CLIENT_SECRET_METADATA_PRESENT");
  }
  if (
    report.state === "client_config_present" ||
    report.reasons.includes("authorization_metadata_missing")
  ) {
    fields.push("GOOGLE_OAUTH_AUTHORIZATION_METADATA_PRESENT");
    fields.push("GOOGLE_OAUTH_GRANTED_SCOPES");
  }
  if (
    report.state === "user_authorization_required" ||
    report.reasons.includes("token_metadata_missing")
  ) {
    fields.push("GOOGLE_OAUTH_TOKEN_METADATA_PRESENT");
    fields.push("GOOGLE_OAUTH_TOKEN_REF_HASH");
  }
  return Array.from(new Set(fields));
}

function parseGrantedScopes(input: string | undefined): GoogleOAuthScope[] {
  if (!input) return [];
  return input
    .split(",")
    .map((scope) => scope.trim())
    .filter(
      (scope): scope is GoogleOAuthScope =>
        GoogleOAuthScopeSchema.safeParse(scope).success,
    );
}

function storageLocation(input: string | undefined, present: boolean) {
  if (!present) return "absent";
  const parsed = StorageLocationSchema.safeParse(input);
  if (parsed.success && parsed.data !== "absent") return parsed.data;
  return "os_secret_manager";
}

function hashOrNull(input: string | undefined): string | null {
  const parsed = HashReferenceSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function bool(input: string | undefined): boolean {
  return input === "true" || input === "1" || input === "yes";
}
