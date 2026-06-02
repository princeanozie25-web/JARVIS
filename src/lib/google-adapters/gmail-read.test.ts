import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GMAIL_READ_AUTHORITY,
  GMAIL_READ_FORBIDDEN_OPERATIONS,
  GMAIL_READ_GOVERNANCE,
  GMAIL_READ_SCOPE,
  createGmailReadAdapter,
  createGmailReadOAuthAuthorizationUrl,
  exchangeGmailReadOAuthCode,
  type GmailReadFetch,
  type GmailReadFetchResponse,
  type GmailReadOAuthConfig,
} from ".";

const FIXED_NOW = new Date("2026-06-02T12:00:00.000Z");
const ACCESS_TOKEN = "ya29.test-access-token";
const REFRESH_TOKEN = "1//test-refresh-token";

describe("Gmail read integration", () => {
  it("creates a real OAuth authorization URL with Gmail metadata scope only", () => {
    const result = createGmailReadOAuthAuthorizationUrl({
      config: oauthConfig(),
      state: "local-state-value",
    });

    const url = new URL(result.authorization_url);

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_READ_SCOPE);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(result.mutation_scopes_requested).toBe(false);
    expect(result.raw_client_secret_included).toBe(false);
    expect(result.raw_token_included).toBe(false);
    expect(JSON.stringify(result)).not.toContain("client-secret");
  });

  it("exchanges an OAuth code through an injected fetch and keeps telemetry redacted", async () => {
    const fetch = fakeFetch(async (url, init) => {
      expect(url).toBe("https://oauth2.googleapis.com/token");
      expect(init?.method).toBe("POST");
      expect(init?.body).toContain("grant_type=authorization_code");

      return jsonResponse({
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        token_type: "Bearer",
      });
    });

    const result = await exchangeGmailReadOAuthCode({
      config: oauthConfig(),
      authorization_code: "oauth-code",
      fetch,
      now: () => FIXED_NOW,
    });

    expect(result.connection_status).toBe("connected");
    expect(result.token?.access_token).toBe(ACCESS_TOKEN);
    expect(result.token?.scope).toBe(GMAIL_READ_SCOPE);
    expect(result.telemetry.token_metadata_present).toBe(true);
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(REFRESH_TOKEN);
    expect(result.telemetry.raw_access_token_included).toBe(false);
    expect(result.telemetry.raw_refresh_token_included).toBe(false);
  });

  it("lists recent messages and retrieves subject, sender, timestamp, and labels", async () => {
    const calls: readonly string[] = [];
    const mutableCalls: string[] = [];
    const adapter = createGmailReadAdapter({
      fetch: gmailFetch(mutableCalls),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.listRecentMessages({ max_results: 2 });
    calls.concat(mutableCalls);

    expect(result.operation).toBe("list_recent");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      message_id: "msg-1",
      thread_id: "thread-1",
      subject: "Phase 21B Gmail metadata",
      sender: "Prince <prince@example.com>",
      sender_domain: "example.com",
      timestamp: "2026-06-02T11:00:00.000Z",
      label_ids: ["INBOX", "UNREAD"],
      raw_body_included: false,
      attachment_contents_included: false,
    });
    expect(mutableCalls[0]).toContain("q=newer_than%3A30d");
    expect(result.telemetry[0]).toMatchObject({
      operation: "list_recent",
      authority_level: "T0",
      metadata_only: true,
      sender_domain: "example.com",
      raw_email_body_included: false,
      raw_access_token_included: false,
      mutation_attempted: false,
      draft_attempted: false,
      send_attempted: false,
    });
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Phase 21B Gmail metadata",
    );
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "This snippet should never enter telemetry.",
    );
  });

  it("lists unread messages through the unread query", async () => {
    const calls: string[] = [];
    const adapter = createGmailReadAdapter({
      fetch: gmailFetch(calls),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.listUnreadMessages({ max_results: 1 });

    expect(result.operation).toBe("list_unread");
    expect(calls[0]).toContain("q=is%3Aunread");
    expect(result.raw_body_included).toBe(false);
    expect(result.mutation_performed).toBe(false);
  });

  it("reads one message metadata without storing bodies or tokens in telemetry", async () => {
    const adapter = createGmailReadAdapter({
      fetch: gmailFetch([]),
      accessTokenProvider: async () => token(),
      now: incrementingClock(),
    });

    const result = await adapter.readMessageMetadata({ message_id: "msg-1" });

    expect(result.operation).toBe("read_message_metadata");
    expect(result.message.subject).toBe("Phase 21B Gmail metadata");
    expect(result.message.sender_domain).toBe("example.com");
    expect(result.telemetry.message_id).toBe("msg-1");
    expect(result.telemetry.raw_email_body_included).toBe(false);
    expect(result.telemetry.credentials_included).toBe(false);
    expect(JSON.stringify(result.telemetry)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result.telemetry)).not.toContain(
      "Phase 21B Gmail metadata",
    );
  });

  it("exposes no send, draft, label mutation, or mailbox mutation methods", () => {
    const adapter = createGmailReadAdapter({
      fetch: gmailFetch([]),
      accessTokenProvider: async () => token(),
    }) as unknown as Record<string, unknown>;

    for (const operation of [
      "sendEmail",
      "createDraft",
      "modifyLabels",
      "archiveMessage",
      "deleteMessage",
      "markRead",
      "markUnread",
      "autoReply",
      "autoCategorize",
    ]) {
      expect(adapter[operation]).toBeUndefined();
    }

    expect(GMAIL_READ_FORBIDDEN_OPERATIONS).toContain("send_email");
    expect(GMAIL_READ_FORBIDDEN_OPERATIONS).toContain("create_draft");
    expect(GMAIL_READ_AUTHORITY).toMatchObject({
      authority_level: "T0",
      read_only: true,
      mutation_supported: false,
      send_supported: false,
      draft_supported: false,
    });
  });

  it("keeps the live Gmail read path inside the Google adapter plugin boundary", () => {
    expect(GMAIL_READ_GOVERNANCE.adapter_boundary).toBe("google-adapters");
    expect(GMAIL_READ_GOVERNANCE.plugin_surface).toBe("gmail_read");

    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/gmail-read.ts"),
      "utf8",
    );

    const imports = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(imports.join("\n")).not.toMatch(/googleapis|google-auth-library/);
    expect(imports.join("\n")).not.toMatch(
      /orchestrator|scheduler|suggestion-inbox/i,
    );
    expect(source).not.toMatch(
      /\bcreateDraft\b|\bsendEmail\b|\bdeleteMessage\b/,
    );
  });
});

function oauthConfig(): GmailReadOAuthConfig {
  return {
    oauth_version: "phase21b.gmail-read-oauth.v1",
    client_id: "gmail-client-id",
    client_secret: "client-secret",
    redirect_uri: "http://127.0.0.1:1455/oauth/google/callback",
    scopes: [GMAIL_READ_SCOPE],
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: "https://oauth2.googleapis.com/token",
  };
}

function token() {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: "2026-06-02T13:00:00.000Z",
    scope: GMAIL_READ_SCOPE,
    token_type: "Bearer",
  };
}

function gmailFetch(calls: string[]): GmailReadFetch {
  return fakeFetch(async (url) => {
    calls.push(url);
    if (url.includes("/messages?")) {
      return jsonResponse({
        messages: [
          { id: "msg-1", threadId: "thread-1" },
          { id: "msg-2", threadId: "thread-2" },
        ],
      });
    }
    if (url.includes("/messages/msg-1")) {
      return jsonResponse(gmailMessage("msg-1", "thread-1"));
    }
    if (url.includes("/messages/msg-2")) {
      return jsonResponse(
        gmailMessage("msg-2", "thread-2", {
          subject: "Unread review item",
          sender: "Build Monitor <build@example.org>",
          internalDate: "1780403400000",
          labels: ["INBOX"],
        }),
      );
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

function gmailMessage(
  id: string,
  threadId: string,
  overrides?: {
    readonly subject?: string;
    readonly sender?: string;
    readonly internalDate?: string;
    readonly labels?: readonly string[];
  },
) {
  return {
    id,
    threadId,
    labelIds: overrides?.labels ?? ["INBOX", "UNREAD"],
    internalDate: overrides?.internalDate ?? "1780398000000",
    sizeEstimate: 512,
    snippet: "This snippet should never enter telemetry.",
    payload: {
      headers: [
        {
          name: "Subject",
          value: overrides?.subject ?? "Phase 21B Gmail metadata",
        },
        {
          name: "From",
          value: overrides?.sender ?? "Prince <prince@example.com>",
        },
        {
          name: "Date",
          value: "Tue, 2 Jun 2026 11:00:00 +0000",
        },
      ],
    },
  };
}

function fakeFetch(
  handler: (
    url: string,
    init?: Parameters<GmailReadFetch>[1],
  ) => Promise<GmailReadFetchResponse> | GmailReadFetchResponse,
): GmailReadFetch {
  return async (url, init) => handler(url, init);
}

function jsonResponse(payload: unknown): GmailReadFetchResponse {
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
