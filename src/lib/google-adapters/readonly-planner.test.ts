import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GOOGLE_READONLY_ADAPTER_GOVERNANCE,
  executeGoogleReadonlyAdapterPlan,
  planCalendarEventMetadataList,
  planDriveDocumentMetadataFetch,
  planGmailMetadataSearch,
  type GoogleReadonlyAdapterDependencies,
  type GoogleReadonlyAdapterRequest,
} from ".";

const HASH = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const NOW = "2026-06-02T12:00:00.000Z";

const GOVERNANCE = {
  contract_only: true,
  live_integration_enabled: false,
  api_client_present: false,
  api_call_supported: false,
  network_call_supported: false,
  credential_storage_supported: false,
  token_storage_supported: false,
  background_sync_supported: false,
  scheduler_supported: false,
  content_body_required: false,
  raw_body_included: false,
  mutation_supported: false,
} as const;

describe("Google read-only adapter planner", () => {
  it("runs mock Gmail metadata search through an injected adapter", async () => {
    const request = gmailSearchRequest();
    const plan = planGmailMetadataSearch("plan:gmail-search", request);
    const result = await executeGoogleReadonlyAdapterPlan(plan, request, {
      gmail: {
        searchMessages: (adapterRequest) => ({
          contract_version: "phase21b.google-adapter-contracts.v1",
          request_id: adapterRequest.request_id,
          kind: "google.gmail.search_messages.result",
          operation: "gmail.search_messages",
          service: "gmail",
          captured_at: NOW,
          metadata_only: true,
          raw_body_included: false,
          mutation_performed: false,
          network_call_performed: false,
          next_page_token_ref: null,
          messages: [
            {
              message_id: "gmail:message-one",
              thread_id: "gmail:thread-one",
              label_ids: ["INBOX"],
              sender_hash: HASH,
              recipient_hashes: [HASH_B],
              subject_hash: HASH,
              sent_at: NOW,
              received_at: NOW,
              size_estimate_bytes: 512,
              attachment_count: 0,
              snippet_hash: HASH_B,
              raw_body_included: false,
            },
          ],
        }),
      },
    });

    expect(plan.status).toBe("ready");
    expect(plan.authority.authority_level).toBe("T0");
    expect(result.execution_status).toBe("completed");
    expect(result.metadata_count).toBe(1);
    expect(result.raw_body_included).toBe(false);
    expect(result.mutation_performed).toBe(false);
    expect(result.librarian_envelopes).toHaveLength(1);
    expect(result.librarian_envelopes[0].source_type).toBe("google_gmail");
    expect(
      result.librarian_envelopes[0].durable_promotion_requires_approval,
    ).toBe(true);
    expect(result.verification_metadata).toHaveLength(1);
    expect(result.verification_metadata[0].raw_body_required).toBe(false);
  });

  it("runs mock Calendar event metadata list through an injected adapter", async () => {
    const request = calendarListEventsRequest();
    const plan = planCalendarEventMetadataList("plan:calendar-events", request);
    const result = await executeGoogleReadonlyAdapterPlan(plan, request, {
      calendar: {
        listEvents: (adapterRequest) => ({
          contract_version: "phase21b.google-adapter-contracts.v1",
          request_id: adapterRequest.request_id,
          kind: "google.calendar.list_events.result",
          operation: "calendar.list_events",
          service: "calendar",
          captured_at: NOW,
          metadata_only: true,
          raw_body_included: false,
          mutation_performed: false,
          network_call_performed: false,
          next_page_token_ref: null,
          events: [
            {
              event_id: "calendar:event-one",
              calendar_id_hash: HASH,
              summary_hash: HASH_B,
              organizer_hash: HASH,
              attendee_count: 3,
              start_at: NOW,
              end_at: "2026-06-02T13:00:00.000Z",
              location_hash: null,
              meeting_url_hash: null,
              status: "confirmed",
              raw_description_included: false,
            },
          ],
        }),
      },
    });

    expect(result.execution_status).toBe("completed");
    expect(result.metadata_count).toBe(1);
    expect(result.librarian_envelopes[0].source_type).toBe("google_calendar");
    expect(result.librarian_envelopes[0].suggested_route_target).toBe("career");
    expect(result.verification_metadata[0].supports_date_freshness).toBe(true);
  });

  it("runs mock Drive document metadata fetch through an injected adapter", async () => {
    const request = driveDocumentRequest();
    const plan = planDriveDocumentMetadataFetch("plan:drive-doc", request);
    const result = await executeGoogleReadonlyAdapterPlan(plan, request, {
      drive: {
        fetchDocumentMetadata: (adapterRequest) => ({
          contract_version: "phase21b.google-adapter-contracts.v1",
          request_id: adapterRequest.request_id,
          kind: "google.drive.fetch_document_metadata.result",
          operation: "drive.fetch_document_metadata",
          service: "drive",
          captured_at: NOW,
          metadata_only: true,
          raw_body_included: false,
          mutation_performed: false,
          network_call_performed: false,
          next_page_token_ref: null,
          document: {
            document_id: adapterRequest.document_id,
            file_id: "drive:file-one",
            title_hash: HASH,
            revision_id_hash: HASH_B,
            modified_at: NOW,
            owner_hash: HASH,
            word_count_estimate: 1000,
            content_hash: HASH_B,
            export_supported: false,
            raw_document_body_included: false,
          },
        }),
      },
    });

    expect(result.execution_status).toBe("completed");
    expect(result.librarian_envelopes[0].source_type).toBe("google_drive");
    expect(result.librarian_envelopes[0].write_authority).toBe(false);
    expect(result.bridge_summary.vault_write_attempted).toBe(false);
  });

  it("fails closed when the required adapter is missing", async () => {
    const request = gmailSearchRequest();
    const plan = planGmailMetadataSearch("plan:gmail-missing", request);
    const result = await executeGoogleReadonlyAdapterPlan(plan, request, {});

    expect(result.execution_status).toBe("unavailable");
    expect(result.reasons).toContain("adapter_missing");
    expect(result.metadata_count).toBe(0);
    expect(result.librarian_envelopes).toEqual([]);
    expect(result.verification_metadata).toEqual([]);
    expect(result.write_attempted).toBe(false);
    expect(result.vault_write_attempted).toBe(false);
  });

  it("rejects invalid or non-metadata requests before adapter invocation", () => {
    const plan = planGmailMetadataSearch("plan:invalid", {
      contract_version: "phase21b.google-adapter-contracts.v1",
      request_id: "request:bad",
      operation: "gmail.search_messages",
      service: "gmail",
      requested_at: NOW,
      metadata_only: false,
      content_body_requested: true,
      mutation_requested: false,
      governance: GOVERNANCE,
      query_metadata_hash: HASH,
      window: { start_at: null, end_at: null },
      page: { max_results: 10 },
    });

    expect(plan.status).toBe("rejected");
    expect(plan.reasons).toContain("invalid_request");
    expect(plan.content_body_requested).toBe(false);
    expect(plan.mutation_requested).toBe(false);
  });

  it("declares read-only governance with injected adapters only", () => {
    expect(GOOGLE_READONLY_ADAPTER_GOVERNANCE).toEqual({
      contract_version: "phase21b.google-adapter-contracts.v1",
      planner_version: "phase21b.google-readonly-planner.v1",
      adapter_injection_required: true,
      oauth_supported: false,
      live_google_api_supported: false,
      credential_storage_supported: false,
      token_storage_supported: false,
      network_call_supported: false,
      background_sync_supported: false,
      scheduler_supported: false,
      mutation_supported: false,
      vault_write_supported: false,
      metadata_only: true,
    });
  });

  it("does not import Google SDKs, credential storage, network clients, or schedulers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/readonly-planner.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/googleapis|google-auth-library|OAuth2/);
    expect(source).not.toMatch(/access_token|refresh_token|client_secret/i);
    expect(source).not.toMatch(/\bfetch\s*\(|globalThis\.fetch/);
    expect(source).not.toMatch(/\bhttps?\b|XMLHttpRequest|WebSocket/);
    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
  });

  it("exposes no mutation operation names in the injected adapter interfaces", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/readonly-planner.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\bsend[A-Z]|\bdelete[A-Z]|\bupdate[A-Z]/);
    expect(source).not.toMatch(/\bcreate[A-Z].*Event|\bmove[A-Z]|\btrash[A-Z]/);
  });
});

function gmailSearchRequest(): GoogleReadonlyAdapterRequest {
  return {
    contract_version: "phase21b.google-adapter-contracts.v1",
    request_id: "request:gmail-search",
    kind: "google.gmail.search_messages.request",
    operation: "gmail.search_messages",
    service: "gmail",
    requested_at: NOW,
    metadata_only: true,
    content_body_requested: false,
    mutation_requested: false,
    governance: GOVERNANCE,
    query_metadata_hash: HASH,
    label_ids: ["INBOX"],
    window: { start_at: null, end_at: null },
    page: { max_results: 10, page_token_ref: null },
  };
}

function calendarListEventsRequest(): GoogleReadonlyAdapterRequest {
  return {
    contract_version: "phase21b.google-adapter-contracts.v1",
    request_id: "request:calendar-events",
    kind: "google.calendar.list_events.request",
    operation: "calendar.list_events",
    service: "calendar",
    requested_at: NOW,
    metadata_only: true,
    content_body_requested: false,
    mutation_requested: false,
    governance: GOVERNANCE,
    calendar_id_hash: HASH,
    window: { start_at: NOW, end_at: "2026-06-03T12:00:00.000Z" },
    page: { max_results: 5, page_token_ref: null },
  };
}

function driveDocumentRequest(): GoogleReadonlyAdapterRequest {
  return {
    contract_version: "phase21b.google-adapter-contracts.v1",
    request_id: "request:drive-doc",
    kind: "google.drive.fetch_document_metadata.request",
    operation: "drive.fetch_document_metadata",
    service: "drive",
    requested_at: NOW,
    metadata_only: true,
    content_body_requested: false,
    mutation_requested: false,
    governance: GOVERNANCE,
    document_id: "drive:doc-one",
  };
}
