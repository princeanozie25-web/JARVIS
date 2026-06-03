import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALENDAR_READ_SCOPE,
  DRIVE_READ_SCOPE,
  GMAIL_READ_SCOPE,
  GOOGLE_ACCOUNT_REQUIRED_SCOPES,
  GOOGLE_ACCOUNT_RUNTIME_GOVERNANCE,
  GOOGLE_ACCOUNT_RUNTIME_VERSION,
  createGoogleAccountRuntime,
  getAdapterReadiness,
  getConnectionStatus,
  getGrantedScopes,
  summarizeGoogleAccountRuntime,
  type GoogleAccountRuntimeInput,
} from ".";

const CHECKED_AT = "2026-06-03T09:00:00.000Z";

describe("Google account runtime", () => {
  it("creates deterministic shared Google account runtime state", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());
    const again = createGoogleAccountRuntime(connectedInput());

    expect(runtime).toEqual(again);
    expect(runtime.runtime_version).toBe(GOOGLE_ACCOUNT_RUNTIME_VERSION);
    expect(runtime.connection_status).toBe("connected");
    expect(runtime.token_status).toBe("valid");
    expect(runtime.governance).toBe("metadata_only_no_authority_expansion");
    expect(runtime.telemetry).toMatchObject({
      metadata_only: true,
      granted_scope_count: 2,
      required_scope_count: 3,
      ready_adapter_count: 2,
      configured_adapter_count: 2,
      raw_access_token_included: false,
      raw_refresh_token_included: false,
      raw_credentials_included: false,
      mutation_attempted: false,
      network_call_attempted: false,
      token_refresh_attempted: false,
    });
  });

  it("reports Gmail readiness from shared token and scope state", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());
    const readiness = getAdapterReadiness(runtime);

    expect(readiness.gmail).toMatchObject({
      service: "gmail",
      status: "ready",
      configured: true,
      required_scope: GMAIL_READ_SCOPE,
      scope_granted: true,
      token_status: "valid",
      connection_status: "connected",
    });
    expect(readiness.gmail.reasons).toContain("ready");
  });

  it("reports Calendar readiness from the same runtime state", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());
    const readiness = getAdapterReadiness(runtime);

    expect(readiness.calendar).toMatchObject({
      service: "calendar",
      status: "ready",
      configured: true,
      required_scope: CALENDAR_READ_SCOPE,
      scope_granted: true,
      token_status: "valid",
      connection_status: "connected",
    });
    expect(readiness.calendar.reasons).toContain("ready");
  });

  it("keeps Drive as a future placeholder when it is not configured", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());

    expect(runtime.adapter_readiness.drive).toMatchObject({
      service: "drive",
      status: "future_not_configured",
      configured: false,
      required_scope: GOOGLE_ACCOUNT_REQUIRED_SCOPES.drive,
      scope_granted: false,
    });
    expect(runtime.adapter_readiness.drive.reasons).toContain(
      "drive_future_placeholder",
    );
  });

  it("reports Drive readiness when configured with the Drive read scope", () => {
    const runtime = createGoogleAccountRuntime(driveConnectedInput());

    expect(runtime.adapter_readiness.drive).toMatchObject({
      service: "drive",
      status: "ready",
      configured: true,
      required_scope: DRIVE_READ_SCOPE,
      scope_granted: true,
      token_status: "valid",
      connection_status: "connected",
    });
    expect(runtime.adapter_readiness.drive.reasons).toContain("ready");
    expect(runtime.telemetry.ready_adapter_count).toBe(3);
  });

  it("reports granted scopes and missing scopes without exposing token values", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());
    const grantedScopes = getGrantedScopes(runtime);
    const summary = summarizeGoogleAccountRuntime(runtime);

    expect(grantedScopes.map((scope) => scope.scope)).toEqual([
      GMAIL_READ_SCOPE,
      CALENDAR_READ_SCOPE,
    ]);
    expect(summary).toMatchObject({
      connection_status: "connected",
      token_status: "valid",
      token_present: true,
      refresh_token_present: true,
      granted_scope_count: 2,
      missing_scope_count: 1,
      gmail_status: "ready",
      calendar_status: "ready",
      drive_status: "future_not_configured",
      ready_adapter_count: 2,
      health: "healthy",
    });
    expect(JSON.stringify(summary)).not.toContain("access-token");
    expect(JSON.stringify(summary)).not.toContain("refresh-token");
  });

  it("reports disconnected state when token metadata is missing", () => {
    const runtime = createGoogleAccountRuntime({
      ...connectedInput(),
      token_metadata: {
        access_token_present: false,
        refresh_token_present: false,
        expires_at: null,
        revoked_at: null,
        raw_access_token_included: false,
        raw_refresh_token_included: false,
        raw_credentials_included: false,
      },
      granted_scopes: [],
    });

    expect(getConnectionStatus(runtime)).toBe("disconnected");
    expect(runtime.token_status).toBe("missing");
    expect(runtime.adapter_readiness.gmail.status).toBe("unavailable");
    expect(runtime.adapter_readiness.calendar.status).toBe("unavailable");
    expect(runtime.telemetry.granted_scope_count).toBe(0);
  });

  it("reports expired and revoked token validity without refresh execution", () => {
    const expired = createGoogleAccountRuntime({
      ...connectedInput(),
      token_metadata: {
        ...connectedInput().token_metadata,
        expires_at: "2026-06-03T08:59:59.000Z",
      },
    });
    const revoked = createGoogleAccountRuntime({
      ...connectedInput(),
      token_metadata: {
        ...connectedInput().token_metadata,
        revoked_at: "2026-06-03T08:30:00.000Z",
      },
    });

    expect(expired.token_status).toBe("expired");
    expect(expired.connection_status).toBe("disconnected");
    expect(expired.telemetry.token_refresh_attempted).toBe(false);
    expect(revoked.token_status).toBe("revoked");
    expect(revoked.connection_status).toBe("disconnected");
    expect(revoked.telemetry.token_refresh_attempted).toBe(false);
  });

  it("lets Gmail and Calendar adapters share one source of runtime readiness", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());
    const readiness = getAdapterReadiness(runtime);

    expect([readiness.gmail.status, readiness.calendar.status]).toEqual([
      "ready",
      "ready",
    ]);
    expect(readiness.gmail.connection_status).toBe(
      readiness.calendar.connection_status,
    );
    expect(readiness.gmail.token_status).toBe(readiness.calendar.token_status);
  });

  it("keeps telemetry metadata-only and excludes content payload classes", () => {
    const runtime = createGoogleAccountRuntime(connectedInput());
    const telemetry = runtime.telemetry;

    expect(telemetry.email_body_included).toBe(false);
    expect(telemetry.calendar_event_content_included).toBe(false);
    expect(telemetry.raw_access_token_included).toBe(false);
    expect(telemetry.raw_refresh_token_included).toBe(false);
    expect(telemetry.raw_credentials_included).toBe(false);
    expect(JSON.stringify(runtime)).not.toContain("ya29.access-token");
    expect(JSON.stringify(runtime)).not.toContain("1//refresh-token");
    expect(JSON.stringify(runtime)).not.toContain("email body");
    expect(JSON.stringify(runtime)).not.toContain("event description");
  });

  it("adds no mutation, provider, network, scheduler, or token persistence paths", () => {
    expect(GOOGLE_ACCOUNT_RUNTIME_GOVERNANCE).toMatchObject({
      shared_account_state_only: true,
      metadata_only: true,
      token_values_supported: false,
      token_persistence_supported: false,
      token_refresh_execution_supported: false,
      network_call_supported: false,
      mutation_supported: false,
      scheduler_supported: false,
      background_sync_supported: false,
      provider_model_call_supported: false,
    });

    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/google-account-runtime.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(
      /googleapis|google-auth-library|openai|anthropic|fetch/,
    );
    expect(imports.join("\n")).not.toMatch(
      /orchestrator|scheduler|suggestion-inbox|morning-brief/i,
    );
    expect(source).not.toMatch(
      /\bcreateEvent\b|\bupdateEvent\b|\bdeleteEvent\b|\bsendEmail\b|\bcreateDraft\b/,
    );
    expect(source).not.toMatch(/writeFile|readFile|setInterval|setTimeout/);
  });
});

function connectedInput(): GoogleAccountRuntimeInput {
  return {
    runtime_version: GOOGLE_ACCOUNT_RUNTIME_VERSION,
    checked_at: CHECKED_AT,
    token_metadata: {
      access_token_present: true,
      refresh_token_present: true,
      expires_at: "2026-06-03T10:00:00.000Z",
      revoked_at: null,
      raw_access_token_included: false,
      raw_refresh_token_included: false,
      raw_credentials_included: false,
    },
    granted_scopes: [GMAIL_READ_SCOPE, CALENDAR_READ_SCOPE],
    adapter_configuration: {
      gmail_configured: true,
      calendar_configured: true,
      drive_configured: false,
    },
    observed_latency_ms: 12,
    telemetry_metadata_only: true,
  };
}

function driveConnectedInput(): GoogleAccountRuntimeInput {
  return {
    ...connectedInput(),
    granted_scopes: [GMAIL_READ_SCOPE, CALENDAR_READ_SCOPE, DRIVE_READ_SCOPE],
    adapter_configuration: {
      gmail_configured: true,
      calendar_configured: true,
      drive_configured: true,
    },
  };
}
