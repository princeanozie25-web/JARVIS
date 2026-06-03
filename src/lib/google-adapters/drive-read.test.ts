import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DRIVE_READ_AUTHORITY,
  DRIVE_READ_FORBIDDEN_OPERATIONS,
  DRIVE_READ_GOVERNANCE,
  DRIVE_READ_SCOPE,
  createDriveReadAdapter,
  createDriveReadOAuthAuthorizationUrl,
  exchangeDriveReadOAuthCode,
  type DriveReadFetch,
  type DriveReadFetchResponse,
  type DriveReadOAuthConfig,
} from ".";

const FIXED_NOW = new Date("2026-06-03T09:00:00.000Z");
const ACCESS_TOKEN = "drive-access-token";
const REFRESH_TOKEN = "drive-refresh-token";

describe("Drive read integration", () => {
  it("creates an OAuth authorization URL with the Drive metadata readonly scope", () => {
    const result = createDriveReadOAuthAuthorizationUrl({
      config: oauthConfig(),
      state: "drive-state",
    });

    const url = new URL(result.authorization_url);

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(DRIVE_READ_SCOPE);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(result.mutation_scopes_requested).toBe(false);
    expect(result.raw_client_secret_included).toBe(false);
    expect(result.raw_token_included).toBe(false);
    expect(JSON.stringify(result)).not.toContain("drive-client-secret");
  });

  it("exchanges an OAuth code through injected fetch without leaking tokens", async () => {
    const result = await exchangeDriveReadOAuthCode({
      config: oauthConfig(),
      authorization_code: "drive-oauth-code",
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
    expect(result.token?.scope).toBe(DRIVE_READ_SCOPE);
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(REFRESH_TOKEN);
    expect(result.telemetry.raw_access_token_included).toBe(false);
    expect(result.telemetry.raw_refresh_token_included).toBe(false);
  });

  it("lists recent files through the Drive metadata API path", async () => {
    const calls: string[] = [];
    const adapter = createDriveReadAdapter({
      fetch: driveFetch(calls),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.listRecentFiles({ max_results: 2 });

    expect(result.operation).toBe("list_recent");
    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toMatchObject({
      file_id: "file-1",
      file_name: "Expansion Era Notes",
      mime_type: "application/vnd.google-apps.document",
      modified_time: "2026-06-03T08:30:00.000Z",
      owner_domain: "example.com",
      size_bytes: 2048,
      web_view_link: "https://drive.google.com/file/d/file-1/view",
      raw_file_contents_included: false,
      document_body_included: false,
      permission_list_included: false,
    });
    expect(calls[0]).toContain("/drive/v3/files");
    expect(calls[0]).toContain("orderBy=modifiedTime+desc");
    expect(calls[0]).toContain("q=trashed+%3D+false");
    expect(result.telemetry[0]).toMatchObject({
      operation: "list_recent",
      authority_level: "T0",
      metadata_only: true,
      file_id: "file-1",
      mime_type: "application/vnd.google-apps.document",
      owner_domain: "example.com",
      result_count: 2,
      raw_file_contents_included: false,
      document_body_included: false,
      permission_list_included: false,
      private_link_included: false,
      mutation_attempted: false,
      create_attempted: false,
      update_attempted: false,
      delete_attempted: false,
      permission_change_attempted: false,
      download_attempted: false,
    });
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Private document body",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "writer@example.com",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain("drive.google.com");
  });

  it("searches files through the query parameter", async () => {
    const calls: string[] = [];
    const adapter = createDriveReadAdapter({
      fetch: driveFetch(calls),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.searchFiles({
      query: "name contains 'Expansion' and trashed = false",
      max_results: 1,
    });

    expect(result.operation).toBe("search_files");
    expect(calls[0]).toContain(
      "q=name+contains+%27Expansion%27+and+trashed+%3D+false",
    );
    expect(result.raw_file_contents_included).toBe(false);
    expect(result.document_bodies_included).toBe(false);
    expect(result.permission_lists_included).toBe(false);
    expect(result.mutation_performed).toBe(false);
  });

  it("reads a single file metadata record", async () => {
    const adapter = createDriveReadAdapter({
      fetch: driveFetch([]),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.readFileMetadata({ file_id: "file-1" });

    expect(result.operation).toBe("read_file_metadata");
    expect(result.file.file_name).toBe("Expansion Era Notes");
    expect(result.file.owner_domain).toBe("example.com");
    expect(result.file.web_view_link).toBe(
      "https://drive.google.com/file/d/file-1/view",
    );
    expect(result.telemetry.file_id).toBe("file-1");
    expect(result.telemetry.raw_file_contents_included).toBe(false);
    expect(result.telemetry.permission_list_included).toBe(false);
    expect(result.telemetry.private_link_included).toBe(false);
    expect(result.telemetry.credentials_included).toBe(false);
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Expansion Era Notes",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "https://drive.google.com/file/d/file-1/view",
    );
  });

  it("exposes no file create, update, delete, move, rename, permission, or download methods", () => {
    const adapter = createDriveReadAdapter({
      fetch: driveFetch([]),
      accessTokenProvider: async () => token(),
    }) as unknown as Record<string, unknown>;

    for (const operation of [
      "createFile",
      "updateFile",
      "deleteFile",
      "moveFile",
      "renameFile",
      "changePermissions",
      "downloadFile",
      "syncDrive",
      "scheduleDriveRead",
    ]) {
      expect(adapter[operation]).toBeUndefined();
    }

    expect(DRIVE_READ_FORBIDDEN_OPERATIONS).toContain("create_file");
    expect(DRIVE_READ_FORBIDDEN_OPERATIONS).toContain("download_file_contents");
    expect(DRIVE_READ_AUTHORITY).toMatchObject({
      authority_level: "T0",
      read_only: true,
      mutation_supported: false,
      file_creation_supported: false,
      file_update_supported: false,
      file_delete_supported: false,
      permission_change_supported: false,
      raw_download_supported: false,
    });
  });

  it("keeps the live Drive read path inside the Google adapter plugin boundary", () => {
    expect(DRIVE_READ_GOVERNANCE.adapter_boundary).toBe("google-adapters");
    expect(DRIVE_READ_GOVERNANCE.plugin_surface).toBe("drive_read");

    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/drive-read.ts"),
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
      /\bcreateFile\b|\bupdateFile\b|\bdeleteFile\b|\bdownloadFile\b/,
    );
  });
});

function oauthConfig(): DriveReadOAuthConfig {
  return {
    oauth_version: "phase21b.drive-read-oauth.v1",
    client_id: "drive-client-id",
    client_secret: "drive-client-secret",
    redirect_uri: "http://127.0.0.1:1455/oauth/google/drive/callback",
    scopes: [DRIVE_READ_SCOPE],
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: "https://oauth2.googleapis.com/token",
  };
}

function token() {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: "2026-06-03T10:00:00.000Z",
    scope: DRIVE_READ_SCOPE,
    token_type: "Bearer",
  };
}

function driveFetch(calls: string[]): DriveReadFetch {
  return fakeFetch(async (url) => {
    calls.push(url);
    if (url.includes("/drive/v3/files?")) {
      return jsonResponse({
        files: [
          driveFile("file-1"),
          driveFile("file-2", {
            name: "Calendar Integration Spec",
            mimeType: "application/pdf",
            owner: "docs@example.org",
            size: "4096",
          }),
        ],
      });
    }
    if (url.includes("/drive/v3/files/file-1")) {
      return jsonResponse(driveFile("file-1"));
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

function driveFile(
  id: string,
  overrides?: {
    readonly name?: string;
    readonly mimeType?: string;
    readonly owner?: string;
    readonly size?: string;
  },
) {
  return {
    id,
    name: overrides?.name ?? "Expansion Era Notes",
    mimeType: overrides?.mimeType ?? "application/vnd.google-apps.document",
    modifiedTime: "2026-06-03T08:30:00.000Z",
    owners: [{ emailAddress: overrides?.owner ?? "prince@example.com" }],
    size: overrides?.size ?? "2048",
    webViewLink: `https://drive.google.com/file/d/${id}/view`,
    permissions: [{ emailAddress: "writer@example.com", role: "writer" }],
    body: "Private document body must not enter telemetry.",
  };
}

function fakeFetch(
  handler: (
    url: string,
    init?: Parameters<DriveReadFetch>[1],
  ) => Promise<DriveReadFetchResponse> | DriveReadFetchResponse,
): DriveReadFetch {
  return async (url, init) => handler(url, init);
}

function jsonResponse(payload: unknown): DriveReadFetchResponse {
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
