import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGoogleReadinessCliReport, runGoogleReadinessCli } from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const NOW = "2026-06-02T12:00:00.000Z";

describe("Google readiness CLI", () => {
  it("prints redacted readiness for missing config", () => {
    const lines: string[] = [];
    const report = runGoogleReadinessCli({
      env: {},
      checkedAt: NOW,
      write: (line) => lines.push(line),
    });
    const output = lines.join("\n");

    expect(report.readiness.state).toBe("not_configured");
    expect(report.missing_config_fields).toContain(
      "GOOGLE_OAUTH_CLIENT_CONFIG_PRESENT",
    );
    expect(output).toContain('"setup_state": "not_configured"');
    expect(output).toContain('"token_values_printed": false');
    expect(output).toContain('"authorization_url_generated": false');
    expect(output).not.toMatch(/ya29\.|secret-token|client-secret/);
  });

  it("prints authorized metadata without token or secret values", () => {
    const secretValue = "ya29.secret-token-that-must-not-print";
    const clientSecret = "client-secret-that-must-not-print";
    const lines: string[] = [];
    const report = runGoogleReadinessCli({
      env: {
        GOOGLE_OAUTH_CLIENT_CONFIG_PRESENT: "true",
        GOOGLE_OAUTH_CLIENT_ID_HASH: HASH,
        GOOGLE_OAUTH_CLIENT_SECRET_METADATA_PRESENT: "true",
        GOOGLE_OAUTH_AUTHORIZATION_METADATA_PRESENT: "true",
        GOOGLE_OAUTH_GRANTED_SCOPES: [
          "https://www.googleapis.com/auth/gmail.metadata",
          "https://www.googleapis.com/auth/calendar.events.readonly",
          "https://www.googleapis.com/auth/calendar.freebusy",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ].join(","),
        GOOGLE_OAUTH_TOKEN_METADATA_PRESENT: "true",
        GOOGLE_OAUTH_TOKEN_REF_HASH: HASH,
        GOOGLE_OAUTH_ACCESS_TOKEN_METADATA_PRESENT: "true",
        GOOGLE_OAUTH_REFRESH_TOKEN_METADATA_PRESENT: "true",
        GOOGLE_OAUTH_TOKEN_EXPIRES_AT: "2026-06-03T12:00:00.000Z",
        GOOGLE_OAUTH_ACCESS_TOKEN: secretValue,
        GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
      },
      checkedAt: NOW,
      write: (line) => lines.push(line),
    });
    const output = lines.join("\n");

    expect(report.readiness.state).toBe("authorized");
    expect(report.missing_config_fields).toEqual([]);
    expect(output).toContain('"setup_state": "authorized"');
    expect(output).toContain('"granted_scope_count": 4');
    expect(output).not.toContain(secretValue);
    expect(output).not.toContain(clientSecret);
    expect(output).not.toMatch(
      /GOOGLE_OAUTH_ACCESS_TOKEN|GOOGLE_OAUTH_CLIENT_SECRET/,
    );
  });

  it("ignores invalid scopes and reports missing required scopes safely", () => {
    const report = createGoogleReadinessCliReport({
      env: {
        GOOGLE_OAUTH_CLIENT_CONFIG_PRESENT: "true",
        GOOGLE_OAUTH_AUTHORIZATION_METADATA_PRESENT: "true",
        GOOGLE_OAUTH_GRANTED_SCOPES:
          "https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.metadata",
      },
      checkedAt: NOW,
    });

    expect(report.readiness.state).toBe("user_authorization_required");
    expect(report.readiness.granted_scopes).toEqual([
      "https://www.googleapis.com/auth/gmail.metadata",
    ]);
    expect(report.readiness.missing_scopes).toContain(
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    );
    expect(report.redaction.google_api_called).toBe(false);
  });

  it("does not implement OAuth, Google API calls, token storage, or schedulers", () => {
    const cliSource = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/readiness-cli.ts"),
      "utf8",
    );
    const scriptSource = readFileSync(
      join(process.cwd(), "scripts/google-readiness.ts"),
      "utf8",
    );
    const source = `${cliSource}\n${scriptSource}`;

    expect(source).not.toMatch(
      /from\s+["']googleapis["']|from\s+["']google-auth-library["']|new\s+OAuth2/,
    );
    expect(source).not.toMatch(/\bfetch\s*\(|globalThis\.fetch/);
    expect(source).not.toMatch(/accounts\.google\.com|oauth2\/v2|authUrl/i);
    expect(source).not.toMatch(/\bwriteFileSync\b|\bappendFileSync\b/);
    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
  });
});
