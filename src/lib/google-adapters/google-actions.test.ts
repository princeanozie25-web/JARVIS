import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  GOOGLE_ACTIONS_GOVERNANCE,
  executeGoogleActionPlan,
  planCalendarCreateAction,
  planGmailDraftAction,
  planGmailSendAction,
  planGoogleActionOperation,
  type CalendarCreateEventActionRequest,
  type GmailCreateDraftActionRequest,
  type GmailSendDraftActionRequest,
  type GoogleActionAdapterDependencies,
} from "./google-actions";

const now = "2026-06-03T09:00:00.000Z";

describe("Google action realization", () => {
  it("creates a Gmail draft through an injected adapter without sending", async () => {
    const request = gmailDraftRequest();
    const plan = planGmailDraftAction(
      "google-action-plan:gmail-draft",
      request,
    );
    const adapters: GoogleActionAdapterDependencies = {
      gmail: {
        createDraft(input) {
          expect(input.body_text).toBe(
            "Please find my application details attached.",
          );
          return {
            draft_id: "draft:123",
            message_id: "message:123",
            completed_at: now,
            provider_result_hash:
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          };
        },
      },
    };

    const result = await executeGoogleActionPlan(plan, request, adapters);

    expect(plan).toMatchObject({
      status: "ready",
      authority_level: "T1",
      draft_only: true,
      approval_required: false,
      direct_google_sdk_allowed: false,
      hidden_network_call_allowed: false,
    });
    expect(result).toMatchObject({
      execution_status: "completed",
      adapter_invoked: true,
      mutation_performed: true,
      send_performed: false,
      drive_write_performed: false,
      raw_body_included: false,
      raw_secret_included: false,
    });
    expect(result.result?.operation).toBe("gmail.create_draft");
    expect(result.result?.telemetry).toMatchObject({
      metadata_only: true,
      draft_created: true,
      send_performed: false,
      raw_email_body_included: false,
      raw_access_token_included: false,
      raw_refresh_token_included: false,
      raw_credentials_included: false,
    });
    expect(JSON.stringify(result.result?.telemetry)).not.toContain(
      request.body_text,
    );
  });

  it("blocks Gmail send until approval finalization is present", async () => {
    const blockedRequest = gmailSendRequest({
      approval_status: "pending",
      approval_id: null,
      approved_at: null,
      finalized_at: null,
      finalization_ref_hash: null,
    });
    const blockedPlan = planGmailSendAction(
      "google-action-plan:gmail-send-blocked",
      blockedRequest,
    );
    let sendInvoked = false;
    const blockedResult = await executeGoogleActionPlan(
      blockedPlan,
      blockedRequest,
      {
        gmail: {
          sendDraft() {
            sendInvoked = true;
            throw new Error("must not send");
          },
        },
      },
    );

    expect(blockedPlan).toMatchObject({
      status: "rejected",
      reasons: expect.arrayContaining([
        "approval_required",
        "approval_not_finalized",
      ]),
      approval_required: true,
    });
    expect(blockedResult.adapter_invoked).toBe(false);
    expect(blockedResult.send_performed).toBe(false);
    expect(sendInvoked).toBe(false);

    const approvedRequest = gmailSendRequest();
    const approvedPlan = planGmailSendAction(
      "google-action-plan:gmail-send-approved",
      approvedRequest,
    );
    const approvedResult = await executeGoogleActionPlan(
      approvedPlan,
      approvedRequest,
      {
        gmail: {
          sendDraft(input) {
            return {
              draft_id: input.draft_id,
              message_id: "message:sent",
              completed_at: now,
              provider_result_hash: null,
            };
          },
        },
      },
    );

    expect(approvedPlan).toMatchObject({
      status: "ready",
      authority_level: "T2",
      approval_required: true,
    });
    expect(approvedResult).toMatchObject({
      execution_status: "completed",
      adapter_invoked: true,
      send_performed: true,
      raw_secret_included: false,
    });
    expect(approvedResult.result?.operation).toBe("gmail.send_draft");
  });

  it("requires approval and consent before Calendar event creation", async () => {
    const blockedRequest = calendarCreateRequest({
      approval_status: "approved",
      approval_id: "approval:calendar:1",
      approved_at: now,
      finalized_at: now,
      finalization_ref_hash:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      consent_granted: false,
    });
    const blockedPlan = planCalendarCreateAction(
      "google-action-plan:calendar-blocked",
      blockedRequest,
    );
    expect(blockedPlan).toMatchObject({
      status: "rejected",
      reasons: expect.arrayContaining(["consent_required", "consent_missing"]),
      consent_required: true,
    });

    const approvedRequest = calendarCreateRequest();
    const approvedPlan = planCalendarCreateAction(
      "google-action-plan:calendar-approved",
      approvedRequest,
    );
    const result = await executeGoogleActionPlan(
      approvedPlan,
      approvedRequest,
      {
        calendar: {
          createEvent(input) {
            return {
              event_id: "event:created",
              calendar_id: input.calendar_id,
              completed_at: now,
              provider_result_hash: null,
            };
          },
        },
      },
    );

    expect(approvedPlan).toMatchObject({
      status: "ready",
      authority_level: "T2",
      approval_required: true,
      consent_required: true,
    });
    expect(result).toMatchObject({
      execution_status: "completed",
      calendar_event_created: true,
      send_performed: false,
      drive_write_performed: false,
    });
    expect(result.result?.operation).toBe("calendar.create_event");
    expect(result.result?.telemetry).toMatchObject({
      raw_event_description_included: false,
      raw_access_token_included: false,
      raw_credentials_included: false,
    });
    expect(JSON.stringify(result.result?.telemetry)).not.toContain(
      "Private calendar description",
    );
  });

  it("keeps Drive writes forbidden in this phase", () => {
    const plan = planGoogleActionOperation({
      plan_id: "google-action-plan:drive-forbidden",
      request: {
        request_id: "request:drive-write",
        service: "drive",
        operation: "drive.create_file",
        write_requested: true,
      },
    });

    expect(plan).toMatchObject({
      service: "drive",
      status: "rejected",
      drive_write_allowed: false,
      direct_google_sdk_allowed: false,
      hidden_network_call_allowed: false,
      background_sync_allowed: false,
      scheduler_allowed: false,
      reasons: expect.arrayContaining(["drive_write_forbidden"]),
    });
  });

  it("degrades safely when a required adapter is unavailable", async () => {
    const request = gmailDraftRequest();
    const plan = planGmailDraftAction(
      "google-action-plan:gmail-no-adapter",
      request,
    );
    const result = await executeGoogleActionPlan(plan, request, {});

    expect(result).toMatchObject({
      execution_status: "unavailable",
      adapter_invoked: false,
      write_attempted: false,
      mutation_performed: false,
      send_performed: false,
      raw_secret_included: false,
    });
  });

  it("keeps the action module inside the injected adapter boundary", () => {
    const source = readFileSync(
      "src/lib/google-adapters/google-actions.ts",
      "utf8",
    );

    expect(GOOGLE_ACTIONS_GOVERNANCE).toMatchObject({
      adapter_injection_required: true,
      direct_google_sdk_supported: false,
      hidden_network_call_supported: false,
      token_storage_supported: false,
      background_sync_supported: false,
      drive_write_supported: false,
    });
    expect(source).not.toMatch(/from ["']googleapis["']/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bsetInterval\s*\(/);
    expect(source).not.toMatch(/\bwriteFile(?:Sync)?\s*\(/);
  });
});

function gmailDraftRequest(): GmailCreateDraftActionRequest {
  return {
    actions_version: "phase21b.google-actions.v1",
    kind: "google.gmail.create_draft.request",
    request_id: "request:gmail-draft",
    operation: "gmail.create_draft",
    service: "gmail",
    requested_at: now,
    write_requested: true,
    background_sync_requested: false,
    scheduler_requested: false,
    telemetry_metadata_only: true,
    to: ["recruiter@example.com"],
    cc: [],
    bcc: [],
    subject: "Application follow-up",
    body_text: "Please find my application details attached.",
    approval_required: false,
    draft_only: true,
  };
}

function gmailSendRequest(
  approvalPatch: Partial<GmailSendDraftActionRequest["approval"]> = {},
): GmailSendDraftActionRequest {
  return {
    actions_version: "phase21b.google-actions.v1",
    kind: "google.gmail.send_draft.request",
    request_id: "request:gmail-send",
    operation: "gmail.send_draft",
    service: "gmail",
    requested_at: now,
    write_requested: true,
    background_sync_requested: false,
    scheduler_requested: false,
    telemetry_metadata_only: true,
    draft_id: "draft:123",
    approval: {
      approval_required: true,
      approval_status: "approved",
      approval_id: "approval:gmail-send:1",
      approved_at: now,
      finalized_at: now,
      finalization_ref_hash:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      raw_approval_token_included: false,
      ...approvalPatch,
    },
  };
}

function calendarCreateRequest(
  patch: Partial<
    CalendarCreateEventActionRequest["approval"] &
      CalendarCreateEventActionRequest["consent"]
  > = {},
): CalendarCreateEventActionRequest {
  return {
    actions_version: "phase21b.google-actions.v1",
    kind: "google.calendar.create_event.request",
    request_id: "request:calendar-create",
    operation: "calendar.create_event",
    service: "calendar",
    requested_at: now,
    write_requested: true,
    background_sync_requested: false,
    scheduler_requested: false,
    telemetry_metadata_only: true,
    calendar_id: "primary",
    title: "Interview preparation",
    description: "Private calendar description",
    location: "Remote",
    start_at: "2026-06-04T09:00:00.000Z",
    end_at: "2026-06-04T10:00:00.000Z",
    attendee_emails: ["prince@example.com"],
    approval: {
      approval_required: true,
      approval_status: patch.approval_status ?? "approved",
      approval_id: patch.approval_id ?? "approval:calendar:1",
      approved_at: patch.approved_at ?? now,
      finalized_at: patch.finalized_at ?? now,
      finalization_ref_hash:
        patch.finalization_ref_hash ??
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      raw_approval_token_included: false,
    },
    consent: {
      consent_required: true,
      consent_granted: patch.consent_granted ?? true,
      consent_scope: "calendar_event_create",
      consent_recorded_at: patch.consent_recorded_at ?? now,
      consent_ref_hash:
        patch.consent_ref_hash ??
        "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      raw_consent_token_included: false,
    },
  };
}
