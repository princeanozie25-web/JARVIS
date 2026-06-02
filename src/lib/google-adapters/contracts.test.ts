import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GOOGLE_ADAPTER_AUTHORITY_CLASS_MAP,
  GOOGLE_ADAPTER_GOVERNANCE_CONTRACT,
  GOOGLE_ADAPTER_OPERATIONS,
  CalendarFetchAvailabilityMetadataResultSchema,
  CalendarListEventsRequestSchema,
  DriveFetchDocumentMetadataResultSchema,
  DriveFetchFileMetadataRequestSchema,
  GmailFetchAttachmentMetadataResultSchema,
  GmailSearchMessagesRequestSchema,
  GoogleAdapterVerificationMetadataSchema,
  createGoogleAdapterLibrarianEnvelope,
  createGoogleAdapterVerificationMetadata,
  getGoogleAdapterOperationAuthority,
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

describe("Google adapter contracts", () => {
  it("maps requested Gmail, Calendar, and Drive metadata operations to T0", () => {
    expect(GOOGLE_ADAPTER_AUTHORITY_CLASS_MAP).toEqual({
      metadata_read: "T0",
      content_read: "T1",
      draft_generation: "T2",
      send_delete_mutate: "T3",
    });

    for (const operation of GOOGLE_ADAPTER_OPERATIONS) {
      const authority = getGoogleAdapterOperationAuthority(operation);
      expect(authority.operation).toBe(operation);
      expect(authority.operation_class).toBe("metadata_read");
      expect(authority.authority_level).toBe("T0");
      expect(authority.metadata_only).toBe(true);
      expect(authority.content_body_required).toBe(false);
      expect(authority.mutation_supported).toBe(false);
      expect(authority.live_call_supported).toBe(false);
    }
  });

  it("defines Gmail metadata-only request and result contracts", () => {
    const request = GmailSearchMessagesRequestSchema.parse({
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
      window: { start_at: null, end_at: null },
      page: { max_results: 10, page_token_ref: null },
    });

    expect(request.metadata_only).toBe(true);
    expect(request.content_body_requested).toBe(false);
    expect(request.governance).toEqual(GOVERNANCE);
  });

  it("defines Gmail attachment metadata without download authority", () => {
    const result = GmailFetchAttachmentMetadataResultSchema.parse({
      contract_version: "phase21b.google-adapter-contracts.v1",
      request_id: "request:gmail-attachment",
      kind: "google.gmail.fetch_attachment_metadata.result",
      operation: "gmail.fetch_attachment_metadata",
      service: "gmail",
      captured_at: NOW,
      metadata_only: true,
      raw_body_included: false,
      mutation_performed: false,
      network_call_performed: false,
      attachment: {
        attachment_id: "attachment:one",
        message_id: "message:one",
        filename_hash: HASH,
        mime_type: "application/pdf",
        size_bytes: 128,
        content_hash: HASH_B,
        download_supported: false,
        raw_attachment_body_included: false,
      },
    });

    expect(result.attachment.download_supported).toBe(false);
    expect(result.attachment.raw_attachment_body_included).toBe(false);
  });

  it("defines Calendar event and availability metadata contracts", () => {
    const request = CalendarListEventsRequestSchema.parse({
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
      page: { max_results: 20 },
    });
    const result = CalendarFetchAvailabilityMetadataResultSchema.parse({
      contract_version: "phase21b.google-adapter-contracts.v1",
      request_id: "request:calendar-availability",
      kind: "google.calendar.fetch_availability_metadata.result",
      operation: "calendar.fetch_availability_metadata",
      service: "calendar",
      captured_at: NOW,
      metadata_only: true,
      raw_body_included: false,
      mutation_performed: false,
      network_call_performed: false,
      availability: {
        window: { start_at: NOW, end_at: "2026-06-03T12:00:00.000Z" },
        calendar_count: 2,
        busy_window_count: 3,
        free_window_count: 4,
        raw_event_bodies_included: false,
      },
    });

    expect(request.service).toBe("calendar");
    expect(result.availability.raw_event_bodies_included).toBe(false);
  });

  it("defines Drive metadata contracts without download or export support", () => {
    const request = DriveFetchFileMetadataRequestSchema.parse({
      contract_version: "phase21b.google-adapter-contracts.v1",
      request_id: "request:drive-file",
      kind: "google.drive.fetch_file_metadata.request",
      operation: "drive.fetch_file_metadata",
      service: "drive",
      requested_at: NOW,
      metadata_only: true,
      content_body_requested: false,
      mutation_requested: false,
      governance: GOVERNANCE,
      file_id: "drive:file-one",
    });
    const result = DriveFetchDocumentMetadataResultSchema.parse({
      contract_version: "phase21b.google-adapter-contracts.v1",
      request_id: "request:drive-doc",
      kind: "google.drive.fetch_document_metadata.result",
      operation: "drive.fetch_document_metadata",
      service: "drive",
      captured_at: NOW,
      metadata_only: true,
      raw_body_included: false,
      mutation_performed: false,
      network_call_performed: false,
      document: {
        document_id: "drive:doc-one",
        file_id: "drive:file-one",
        title_hash: HASH,
        revision_id_hash: HASH_B,
        modified_at: NOW,
        owner_hash: HASH,
        word_count_estimate: 1200,
        content_hash: HASH_B,
        export_supported: false,
        raw_document_body_included: false,
      },
    });

    expect(request.service).toBe("drive");
    expect(result.document.export_supported).toBe(false);
    expect(result.document.raw_document_body_included).toBe(false);
  });

  it("projects Google adapter outputs into Librarian-compatible metadata envelopes", () => {
    const gmailEnvelope = createGoogleAdapterLibrarianEnvelope({
      envelope_id: "envelope:gmail-one",
      source_id: "gmail:message-one",
      source_ref: "gmail://metadata/message-one",
      service: "gmail",
      operation: "gmail.fetch_message_metadata",
      captured_at: NOW,
      content_hash: HASH,
    });
    const calendarEnvelope = createGoogleAdapterLibrarianEnvelope({
      envelope_id: "envelope:calendar-one",
      source_id: "calendar:event-one",
      source_ref: "calendar://metadata/event-one",
      service: "calendar",
      operation: "calendar.fetch_event_metadata",
      captured_at: NOW,
      content_hash: HASH,
      suggested_route_target: "career",
    });

    expect(gmailEnvelope.source_type).toBe("google_gmail");
    expect(calendarEnvelope.source_type).toBe("google_calendar");
    expect(calendarEnvelope.suggested_route_target).toBe("career");
    expect(gmailEnvelope.metadata_only).toBe(true);
    expect(gmailEnvelope.raw_body_included).toBe(false);
    expect(gmailEnvelope.durable_promotion_requires_approval).toBe(true);
    expect(gmailEnvelope.write_authority).toBe(false);
    expect(gmailEnvelope.execution_authority).toBe(false);
  });

  it("defines Verification Agent metadata support without requiring bodies or model calls", () => {
    const metadata = createGoogleAdapterVerificationMetadata({
      verification_ref_id: "verification:google-one",
      service: "drive",
      operation: "drive.fetch_document_metadata",
      source_id: "drive:doc-one",
      evidence_types: ["source_presence", "metadata_consistency"],
      suggested_risk_flags: ["insufficient_sources"],
    });

    expect(GoogleAdapterVerificationMetadataSchema.parse(metadata)).toEqual(
      metadata,
    );
    expect(metadata.raw_body_required).toBe(false);
    expect(metadata.model_call_required).toBe(false);
    expect(metadata.advisory_only).toBe(true);
    expect(metadata.supports_date_freshness).toBe(true);
  });

  it("declares contract-only governance with no live Google authority", () => {
    expect(GOOGLE_ADAPTER_GOVERNANCE_CONTRACT).toEqual(GOVERNANCE);
  });

  it("does not import live Google clients, credential storage, network, or schedulers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/google-adapters/contracts.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/googleapis|google-auth-library|OAuth2/);
    expect(source).not.toMatch(/access_token|refresh_token|client_secret/i);
    expect(source).not.toMatch(/\bfetch\s*\(|globalThis\.fetch/);
    expect(source).not.toMatch(/\bhttps?\b|XMLHttpRequest|WebSocket/);
    expect(source).not.toMatch(/\bsetInterval\s*\(|\bsetTimeout\s*\(/);
    expect(source).not.toMatch(/node-cron|cron\.schedule|scheduleJob/i);
  });
});
