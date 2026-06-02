import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GOOGLE_OAUTH_READINESS_STATES,
  GOOGLE_OAUTH_SCOPE_POLICY,
  GOOGLE_OAUTH_TOKEN_STORAGE_POLICY,
  checkGoogleOAuthReadiness,
  type GoogleOAuthReadinessInput,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const NOW = "2026-06-02T12:00:00.000Z";
const FUTURE = "2026-06-03T12:00:00.000Z";
const PAST = "2026-06-01T12:00:00.000Z";

describe("Google OAuth readiness", () => {
  it("defines all required readiness states", () => {
    expect(GOOGLE_OAUTH_READINESS_STATES).toEqual([
      "not_configured",
      "client_config_present",
      "user_authorization_required",
      "authorized",
      "expired",
      "revoked",
      "unavailable",
    ]);
  });

  it("defines minimum read-only metadata scopes and excludes mutation scopes", () => {
    expect(GOOGLE_OAUTH_SCOPE_POLICY.gmail.required_scopes).toEqual([
      "https://www.googleapis.com/auth/gmail.metadata",
    ]);
    expect(GOOGLE_OAUTH_SCOPE_POLICY.calendar.required_scopes).toEqual([
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.freebusy",
    ]);
    expect(GOOGLE_OAUTH_SCOPE_POLICY.drive.required_scopes).toEqual([
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ]);
    const requiredScopes = [
      ...GOOGLE_OAUTH_SCOPE_POLICY.gmail.required_scopes,
      ...GOOGLE_OAUTH_SCOPE_POLICY.calendar.required_scopes,
      ...GOOGLE_OAUTH_SCOPE_POLICY.drive.required_scopes,
    ];
    expect(requiredScopes).not.toContain(
      "https://www.googleapis.com/auth/gmail.modify",
    );
    expect(requiredScopes).not.toContain(
      "https://www.googleapis.com/auth/gmail.send",
    );
    expect(requiredScopes).not.toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
    expect(requiredScopes).not.toContain(
      "https://www.googleapis.com/auth/drive.file",
    );
  });

  it("defines token storage policy without telemetry or repository storage", () => {
    expect(GOOGLE_OAUTH_TOKEN_STORAGE_POLICY.allowed_locations).toContain(
      "os_secret_manager",
    );
    expect(GOOGLE_OAUTH_TOKEN_STORAGE_POLICY.forbidden_locations).toContain(
      "git_repository",
    );
    expect(GOOGLE_OAUTH_TOKEN_STORAGE_POLICY.forbidden_locations).toContain(
      "telemetry",
    );
    expect(GOOGLE_OAUTH_TOKEN_STORAGE_POLICY.gitignore_expectations).toContain(
      ".env.local",
    );
    expect(
      GOOGLE_OAUTH_TOKEN_STORAGE_POLICY.raw_token_values_allowed_in_telemetry,
    ).toBe(false);
    expect(GOOGLE_OAUTH_TOKEN_STORAGE_POLICY.background_refresh_allowed).toBe(
      false,
    );
  });

  it("reports not_configured when client config metadata is absent", () => {
    const report = checkGoogleOAuthReadiness(
      readinessInput({ client_config_present: false }),
    );

    expect(report.state).toBe("not_configured");
    expect(report.reasons).toContain("client_config_missing");
    expect(report.oauth_call_attempted).toBe(false);
    expect(report.google_api_call_attempted).toBe(false);
  });

  it("reports client_config_present before authorization metadata exists", () => {
    const report = checkGoogleOAuthReadiness(
      readinessInput({
        client_config_present: true,
        authorization_metadata_present: false,
      }),
    );

    expect(report.state).toBe("client_config_present");
    expect(report.reasons).toContain("authorization_metadata_missing");
  });

  it("reports user_authorization_required when scopes or token metadata are missing", () => {
    const report = checkGoogleOAuthReadiness(
      readinessInput({
        client_config_present: true,
        authorization_metadata_present: true,
        granted_scopes: ["https://www.googleapis.com/auth/gmail.metadata"],
      }),
    );

    expect(report.state).toBe("user_authorization_required");
    expect(report.missing_scopes).toContain(
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    );
    expect(report.reasons).toContain("required_scopes_missing");
  });

  it("reports authorized from metadata-only client, authorization, and token presence", () => {
    const report = checkGoogleOAuthReadiness(
      readinessInput({
        client_config_present: true,
        authorization_metadata_present: true,
        token_metadata_present: true,
        access_token_metadata_present: true,
        refresh_token_metadata_present: true,
        granted_scopes: [
          "https://www.googleapis.com/auth/gmail.metadata",
          "https://www.googleapis.com/auth/calendar.events.readonly",
          "https://www.googleapis.com/auth/calendar.freebusy",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ],
      }),
    );

    expect(report.state).toBe("authorized");
    expect(report.missing_scopes).toEqual([]);
    expect(report.authorization_url_generated).toBe(false);
    expect(report.token_refresh_attempted).toBe(false);
    expect(report.telemetry.raw_token_values_included).toBe(false);
    expect(report.telemetry.raw_client_secret_included).toBe(false);
  });

  it("reports expired and revoked without refreshing tokens", () => {
    const expired = checkGoogleOAuthReadiness(
      readinessInput({
        client_config_present: true,
        authorization_metadata_present: true,
        token_metadata_present: true,
        granted_scopes: [
          "https://www.googleapis.com/auth/gmail.metadata",
          "https://www.googleapis.com/auth/calendar.events.readonly",
          "https://www.googleapis.com/auth/calendar.freebusy",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ],
        expires_at: PAST,
      }),
    );
    const revoked = checkGoogleOAuthReadiness(
      readinessInput({
        client_config_present: true,
        authorization_metadata_present: true,
        token_metadata_present: true,
        revoked_at: NOW,
      }),
    );

    expect(expired.state).toBe("expired");
    expect(expired.token_refresh_attempted).toBe(false);
    expect(revoked.state).toBe("revoked");
    expect(revoked.token_refresh_attempted).toBe(false);
  });

  it("fails closed to unavailable for invalid readiness input", () => {
    const report = checkGoogleOAuthReadiness({ nope: true });

    expect(report.state).toBe("unavailable");
    expect(report.reasons).toContain("invalid_readiness_input");
    expect(report.oauth_call_attempted).toBe(false);
    expect(report.telemetry.raw_token_values_included).toBe(false);
  });

  it("does not implement OAuth execution, API calls, token storage, URL generation, or refresh loops", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/oauth-readiness.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /from\s+["']googleapis["']|from\s+["']google-auth-library["']|new\s+OAuth2/,
    );
    expect(source).not.toMatch(/\bfetch\s*\(|globalThis\.fetch/);
    expect(source).not.toMatch(/accounts\.google\.com|oauth2\/v2|authUrl/i);
    expect(source).not.toMatch(/process\.env\.[A-Z0-9_]*(TOKEN|SECRET)/);
    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
  });
});

function readinessInput(
  overrides: Partial<{
    client_config_present: boolean;
    authorization_metadata_present: boolean;
    token_metadata_present: boolean;
    access_token_metadata_present: boolean;
    refresh_token_metadata_present: boolean;
    granted_scopes: GoogleOAuthReadinessInput["authorization"]["granted_scopes"];
    expires_at: string | null;
    revoked_at: string | null;
  }> = {},
): GoogleOAuthReadinessInput {
  const clientPresent = overrides.client_config_present ?? false;
  const tokenPresent = overrides.token_metadata_present ?? false;
  return {
    readiness_version: "phase21b.google-oauth-readiness.v1",
    checked_at: NOW,
    requested_services: ["gmail", "calendar", "drive"],
    client_config: {
      client_config_present: clientPresent,
      location: clientPresent ? "os_secret_manager" : "absent",
      client_id_hash: clientPresent ? HASH : null,
      client_secret_metadata_present: clientPresent,
      raw_client_id_included: false,
      raw_client_secret_included: false,
    },
    authorization: {
      authorization_metadata_present:
        overrides.authorization_metadata_present ?? false,
      granted_scopes: overrides.granted_scopes ?? [],
      raw_authorization_code_included: false,
      authorization_url_generated: false,
    },
    token_metadata: {
      token_metadata_present: tokenPresent,
      location: tokenPresent ? "os_secret_manager" : "absent",
      access_token_metadata_present:
        overrides.access_token_metadata_present ?? tokenPresent,
      refresh_token_metadata_present:
        overrides.refresh_token_metadata_present ?? tokenPresent,
      token_ref_hash: tokenPresent ? HASH : null,
      expires_at: overrides.expires_at ?? FUTURE,
      revoked_at: overrides.revoked_at ?? null,
      raw_access_token_included: false,
      raw_refresh_token_included: false,
    },
    telemetry_metadata_only: true,
  };
}
