import { createHash } from "node:crypto";
import { z } from "zod";

export const GOOGLE_ACTIONS_VERSION = "phase21b.google-actions.v1" as const;

export const GOOGLE_ACTION_OPERATIONS = [
  "gmail.create_draft",
  "gmail.send_draft",
  "calendar.create_event",
] as const;

export const GOOGLE_DRIVE_FORBIDDEN_ACTION_OPERATIONS = [
  "drive.create_file",
  "drive.update_file",
  "drive.delete_file",
  "drive.move_file",
  "drive.rename_file",
  "drive.change_permissions",
] as const;

export const GOOGLE_ACTION_EXECUTION_STATUSES = [
  "completed",
  "rejected",
  "unavailable",
  "adapter_error",
] as const;

export const GOOGLE_ACTION_REASONS = [
  "accepted",
  "invalid_request",
  "adapter_missing",
  "adapter_error",
  "draft_only",
  "approval_required",
  "approval_not_finalized",
  "consent_required",
  "consent_missing",
  "drive_write_forbidden",
  "no_background_sync",
  "no_hidden_google_sdk",
] as const;

export const GOOGLE_ACTIONS_GOVERNANCE = {
  actions_version: GOOGLE_ACTIONS_VERSION,
  adapter_boundary: "google-adapters",
  adapter_injection_required: true,
  direct_google_sdk_supported: false,
  hidden_network_call_supported: false,
  credential_storage_supported: false,
  token_storage_supported: false,
  background_sync_supported: false,
  scheduler_supported: false,
  telemetry_metadata_only: true,
  raw_body_telemetry_supported: false,
  secret_telemetry_supported: false,
  drive_write_supported: false,
} as const;

const ActionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const EmailAddressSchema = z.string().trim().email().max(320);

const BoundedTextSchema = z.string().trim().min(1).max(8000);

const ShortTextSchema = z.string().trim().min(1).max(1000);

const GoogleActionOperationSchema = z.enum(GOOGLE_ACTION_OPERATIONS);

const GoogleActionExecutionStatusSchema = z.enum(
  GOOGLE_ACTION_EXECUTION_STATUSES,
);

const GoogleActionReasonSchema = z.enum(GOOGLE_ACTION_REASONS);

export const GoogleActionApprovalFinalizationMetadataSchema = z.strictObject({
  approval_required: z.literal(true),
  approval_status: z.enum(["pending", "approved", "rejected", "expired"]),
  approval_id: ActionIdSchema.nullable().default(null),
  approved_at: IsoDateTimeSchema.nullable().default(null),
  finalized_at: IsoDateTimeSchema.nullable().default(null),
  finalization_ref_hash: HashReferenceSchema.nullable().default(null),
  raw_approval_token_included: z.literal(false),
});

export const GoogleActionConsentGateMetadataSchema = z.strictObject({
  consent_required: z.literal(true),
  consent_granted: z.boolean(),
  consent_scope: z.enum(["calendar_event_create"]),
  consent_recorded_at: IsoDateTimeSchema.nullable().default(null),
  consent_ref_hash: HashReferenceSchema.nullable().default(null),
  raw_consent_token_included: z.literal(false),
});

const GoogleActionBaseRequestSchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  request_id: ActionIdSchema,
  operation: GoogleActionOperationSchema,
  service: z.enum(["gmail", "calendar"]),
  requested_at: IsoDateTimeSchema,
  write_requested: z.literal(true),
  background_sync_requested: z.literal(false),
  scheduler_requested: z.literal(false),
  telemetry_metadata_only: z.literal(true),
});

export const GmailCreateDraftActionRequestSchema =
  GoogleActionBaseRequestSchema.extend({
    kind: z.literal("google.gmail.create_draft.request"),
    operation: z.literal("gmail.create_draft"),
    service: z.literal("gmail"),
    to: z.array(EmailAddressSchema).min(1).max(50),
    cc: z.array(EmailAddressSchema).max(50).default([]),
    bcc: z.array(EmailAddressSchema).max(50).default([]),
    subject: ShortTextSchema,
    body_text: BoundedTextSchema,
    approval_required: z.literal(false),
    draft_only: z.literal(true),
  });

export const GmailSendDraftActionRequestSchema =
  GoogleActionBaseRequestSchema.extend({
    kind: z.literal("google.gmail.send_draft.request"),
    operation: z.literal("gmail.send_draft"),
    service: z.literal("gmail"),
    draft_id: ActionIdSchema,
    approval: GoogleActionApprovalFinalizationMetadataSchema,
  });

export const CalendarCreateEventActionRequestSchema =
  GoogleActionBaseRequestSchema.extend({
    kind: z.literal("google.calendar.create_event.request"),
    operation: z.literal("calendar.create_event"),
    service: z.literal("calendar"),
    calendar_id: ActionIdSchema.default("primary"),
    title: ShortTextSchema,
    description: BoundedTextSchema.nullable().default(null),
    location: ShortTextSchema.nullable().default(null),
    start_at: IsoDateTimeSchema,
    end_at: IsoDateTimeSchema,
    attendee_emails: z.array(EmailAddressSchema).max(50).default([]),
    approval: GoogleActionApprovalFinalizationMetadataSchema,
    consent: GoogleActionConsentGateMetadataSchema,
  });

const GmailDraftAdapterOutcomeSchema = z.object({
  draft_id: ActionIdSchema,
  message_id: ActionIdSchema.nullable().default(null),
  completed_at: IsoDateTimeSchema,
  provider_result_hash: HashReferenceSchema.nullable().default(null),
});

const GmailSendAdapterOutcomeSchema = z.object({
  draft_id: ActionIdSchema,
  message_id: ActionIdSchema,
  completed_at: IsoDateTimeSchema,
  provider_result_hash: HashReferenceSchema.nullable().default(null),
});

const CalendarCreateAdapterOutcomeSchema = z.object({
  event_id: ActionIdSchema,
  calendar_id: ActionIdSchema,
  completed_at: IsoDateTimeSchema,
  provider_result_hash: HashReferenceSchema.nullable().default(null),
});

const GoogleActionTelemetrySchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  operation: GoogleActionOperationSchema,
  service: z.enum(["gmail", "calendar"]),
  authority_level: z.enum(["T1", "T2"]),
  metadata_only: z.literal(true),
  request_id: ActionIdSchema,
  subject_hash: HashReferenceSchema.nullable().default(null),
  body_hash: HashReferenceSchema.nullable().default(null),
  title_hash: HashReferenceSchema.nullable().default(null),
  description_hash: HashReferenceSchema.nullable().default(null),
  recipient_count: z.number().int().nonnegative(),
  attendee_count: z.number().int().nonnegative(),
  approval_required: z.boolean(),
  approval_finalized: z.boolean(),
  consent_required: z.boolean(),
  consent_granted: z.boolean(),
  draft_created: z.boolean(),
  send_performed: z.boolean(),
  calendar_event_created: z.boolean(),
  raw_body_included: z.literal(false),
  raw_email_body_included: z.literal(false),
  raw_event_description_included: z.literal(false),
  raw_access_token_included: z.literal(false),
  raw_refresh_token_included: z.literal(false),
  raw_credentials_included: z.literal(false),
  raw_approval_token_included: z.literal(false),
  raw_consent_token_included: z.literal(false),
  background_sync_attempted: z.literal(false),
  scheduler_attempted: z.literal(false),
});

export const GmailDraftActionResultSchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  kind: z.literal("google.gmail.create_draft.result"),
  request_id: ActionIdSchema,
  operation: z.literal("gmail.create_draft"),
  service: z.literal("gmail"),
  authority_level: z.literal("T1"),
  completed_at: IsoDateTimeSchema,
  draft_id: ActionIdSchema,
  message_id: ActionIdSchema.nullable(),
  provider_result_hash: HashReferenceSchema.nullable(),
  draft_only: z.literal(true),
  approval_required: z.literal(false),
  mutation_performed: z.literal(true),
  send_performed: z.literal(false),
  raw_body_included: z.literal(false),
  raw_provider_response_included: z.literal(false),
  telemetry: GoogleActionTelemetrySchema,
});

export const GmailSendActionResultSchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  kind: z.literal("google.gmail.send_draft.result"),
  request_id: ActionIdSchema,
  operation: z.literal("gmail.send_draft"),
  service: z.literal("gmail"),
  authority_level: z.literal("T2"),
  completed_at: IsoDateTimeSchema,
  draft_id: ActionIdSchema,
  message_id: ActionIdSchema,
  provider_result_hash: HashReferenceSchema.nullable(),
  approval_finalization: GoogleActionApprovalFinalizationMetadataSchema,
  mutation_performed: z.literal(true),
  send_performed: z.literal(true),
  raw_body_included: z.literal(false),
  raw_provider_response_included: z.literal(false),
  telemetry: GoogleActionTelemetrySchema,
});

export const CalendarCreateEventActionResultSchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  kind: z.literal("google.calendar.create_event.result"),
  request_id: ActionIdSchema,
  operation: z.literal("calendar.create_event"),
  service: z.literal("calendar"),
  authority_level: z.literal("T2"),
  completed_at: IsoDateTimeSchema,
  calendar_id: ActionIdSchema,
  event_id: ActionIdSchema,
  provider_result_hash: HashReferenceSchema.nullable(),
  approval_finalization: GoogleActionApprovalFinalizationMetadataSchema,
  consent_gate: GoogleActionConsentGateMetadataSchema,
  mutation_performed: z.literal(true),
  calendar_event_created: z.literal(true),
  raw_body_included: z.literal(false),
  raw_provider_response_included: z.literal(false),
  telemetry: GoogleActionTelemetrySchema,
});

export const GoogleActionPlanSchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  plan_id: ActionIdSchema,
  request_id: ActionIdSchema,
  operation: z.union([
    GoogleActionOperationSchema,
    z.enum(GOOGLE_DRIVE_FORBIDDEN_ACTION_OPERATIONS),
  ]),
  service: z.enum(["gmail", "calendar", "drive"]),
  status: z.enum(["ready", "rejected"]),
  reasons: z.array(GoogleActionReasonSchema),
  authority_level: z.enum(["T1", "T2"]).nullable(),
  adapter_required: z.boolean(),
  approval_required: z.boolean(),
  consent_required: z.boolean(),
  draft_only: z.boolean(),
  drive_write_allowed: z.literal(false),
  direct_google_sdk_allowed: z.literal(false),
  hidden_network_call_allowed: z.literal(false),
  background_sync_allowed: z.literal(false),
  scheduler_allowed: z.literal(false),
  telemetry_metadata_only: z.literal(true),
  raw_body_telemetry_allowed: z.literal(false),
});

export const GoogleActionExecutionResultSchema = z.strictObject({
  actions_version: z.literal(GOOGLE_ACTIONS_VERSION),
  plan: GoogleActionPlanSchema,
  execution_status: GoogleActionExecutionStatusSchema,
  reasons: z.array(GoogleActionReasonSchema),
  result: z
    .union([
      GmailDraftActionResultSchema,
      GmailSendActionResultSchema,
      CalendarCreateEventActionResultSchema,
    ])
    .nullable(),
  adapter_invoked: z.boolean(),
  write_attempted: z.boolean(),
  mutation_performed: z.boolean(),
  send_performed: z.boolean(),
  calendar_event_created: z.boolean(),
  drive_write_performed: z.literal(false),
  raw_body_included: z.literal(false),
  raw_secret_included: z.literal(false),
  raw_provider_response_included: z.literal(false),
  background_sync_attempted: z.literal(false),
  scheduler_attempted: z.literal(false),
});

export type GoogleActionApprovalFinalizationMetadata = z.infer<
  typeof GoogleActionApprovalFinalizationMetadataSchema
>;
export type GoogleActionConsentGateMetadata = z.infer<
  typeof GoogleActionConsentGateMetadataSchema
>;
export type GmailCreateDraftActionRequest = z.infer<
  typeof GmailCreateDraftActionRequestSchema
>;
export type GmailSendDraftActionRequest = z.infer<
  typeof GmailSendDraftActionRequestSchema
>;
export type CalendarCreateEventActionRequest = z.infer<
  typeof CalendarCreateEventActionRequestSchema
>;
export type GoogleActionRequest =
  | GmailCreateDraftActionRequest
  | GmailSendDraftActionRequest
  | CalendarCreateEventActionRequest;
export type GmailDraftActionResult = z.infer<
  typeof GmailDraftActionResultSchema
>;
export type GmailSendActionResult = z.infer<typeof GmailSendActionResultSchema>;
export type CalendarCreateEventActionResult = z.infer<
  typeof CalendarCreateEventActionResultSchema
>;
export type GoogleActionResult =
  | GmailDraftActionResult
  | GmailSendActionResult
  | CalendarCreateEventActionResult;
export type GoogleActionPlan = z.infer<typeof GoogleActionPlanSchema>;
export type GoogleActionExecutionResult = z.infer<
  typeof GoogleActionExecutionResultSchema
>;
export type GoogleActionReason = z.infer<typeof GoogleActionReasonSchema>;
export type GoogleActionExecutionStatus = z.infer<
  typeof GoogleActionExecutionStatusSchema
>;

export interface GoogleActionGmailAdapter {
  readonly createDraft?: (
    request: GmailCreateDraftActionRequest,
  ) =>
    | Promise<z.infer<typeof GmailDraftAdapterOutcomeSchema>>
    | z.infer<typeof GmailDraftAdapterOutcomeSchema>;
  readonly sendDraft?: (
    request: GmailSendDraftActionRequest,
  ) =>
    | Promise<z.infer<typeof GmailSendAdapterOutcomeSchema>>
    | z.infer<typeof GmailSendAdapterOutcomeSchema>;
}

export interface GoogleActionCalendarAdapter {
  readonly createEvent?: (
    request: CalendarCreateEventActionRequest,
  ) =>
    | Promise<z.infer<typeof CalendarCreateAdapterOutcomeSchema>>
    | z.infer<typeof CalendarCreateAdapterOutcomeSchema>;
}

export interface GoogleActionAdapterDependencies {
  readonly gmail?: GoogleActionGmailAdapter;
  readonly calendar?: GoogleActionCalendarAdapter;
}

export function planGoogleActionOperation(input: {
  readonly plan_id: string;
  readonly request: unknown;
}): GoogleActionPlan {
  const request = parseActionRequest(input.request);
  if (!request) {
    const driveOperation = parseForbiddenDriveOperation(input.request);
    return rejectedPlan({
      plan_id: input.plan_id,
      request_id: requestIdFromUnknown(input.request),
      operation: driveOperation ?? "gmail.create_draft",
      service: driveOperation ? "drive" : "gmail",
      reasons: driveOperation
        ? [
            "drive_write_forbidden",
            "no_hidden_google_sdk",
            "no_background_sync",
          ]
        : ["invalid_request", "no_hidden_google_sdk", "no_background_sync"],
    });
  }

  const gateReasons = gateReasonsForRequest(request);
  if (gateReasons.length > 0) {
    return rejectedPlan({
      plan_id: input.plan_id,
      request_id: request.request_id,
      operation: request.operation,
      service: request.service,
      reasons: gateReasons,
    });
  }

  return GoogleActionPlanSchema.parse({
    actions_version: GOOGLE_ACTIONS_VERSION,
    plan_id: input.plan_id,
    request_id: request.request_id,
    operation: request.operation,
    service: request.service,
    status: "ready",
    reasons: readyReasonsForRequest(request),
    authority_level: authorityLevelForRequest(request),
    adapter_required: true,
    approval_required: approvalRequiredForRequest(request),
    consent_required: consentRequiredForRequest(request),
    draft_only: request.operation === "gmail.create_draft",
    drive_write_allowed: false,
    direct_google_sdk_allowed: false,
    hidden_network_call_allowed: false,
    background_sync_allowed: false,
    scheduler_allowed: false,
    telemetry_metadata_only: true,
    raw_body_telemetry_allowed: false,
  });
}

export const planGmailDraftAction = (
  plan_id: string,
  request: unknown,
): GoogleActionPlan => planGoogleActionOperation({ plan_id, request });

export const planGmailSendAction = (
  plan_id: string,
  request: unknown,
): GoogleActionPlan => planGoogleActionOperation({ plan_id, request });

export const planCalendarCreateAction = (
  plan_id: string,
  request: unknown,
): GoogleActionPlan => planGoogleActionOperation({ plan_id, request });

export async function executeGoogleActionPlan(
  plan: GoogleActionPlan,
  request: GoogleActionRequest,
  adapters: GoogleActionAdapterDependencies,
): Promise<GoogleActionExecutionResult> {
  if (plan.status !== "ready") {
    return executionResult({
      plan,
      execution_status: "rejected",
      reasons: plan.reasons,
      result: null,
      adapter_invoked: false,
    });
  }

  const invoker = adapterInvoker(plan.operation, adapters);
  if (!invoker) {
    return executionResult({
      plan,
      execution_status: "unavailable",
      reasons: [
        "adapter_missing",
        "no_hidden_google_sdk",
        "no_background_sync",
      ],
      result: null,
      adapter_invoked: false,
    });
  }

  try {
    const parsedRequest = parseExpectedRequest(plan.operation, request);
    const result = await invoker(parsedRequest);
    return executionResult({
      plan,
      execution_status: "completed",
      reasons: readyReasonsForRequest(parsedRequest),
      result: resultForAdapterOutcome(parsedRequest, result),
      adapter_invoked: true,
    });
  } catch {
    return executionResult({
      plan,
      execution_status: "adapter_error",
      reasons: ["adapter_error", "no_hidden_google_sdk", "no_background_sync"],
      result: null,
      adapter_invoked: true,
    });
  }
}

function parseActionRequest(input: unknown): GoogleActionRequest | null {
  const schemas = [
    GmailCreateDraftActionRequestSchema,
    GmailSendDraftActionRequestSchema,
    CalendarCreateEventActionRequestSchema,
  ] as const;
  for (const schema of schemas) {
    const parsed = schema.safeParse(input);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function parseExpectedRequest(
  operation: GoogleActionPlan["operation"],
  request: GoogleActionRequest,
): GoogleActionRequest {
  switch (operation) {
    case "gmail.create_draft":
      return GmailCreateDraftActionRequestSchema.parse(request);
    case "gmail.send_draft":
      return GmailSendDraftActionRequestSchema.parse(request);
    case "calendar.create_event":
      return CalendarCreateEventActionRequestSchema.parse(request);
    default:
      throw new Error("unsupported_google_action_operation");
  }
}

function parseForbiddenDriveOperation(input: unknown) {
  const parsed = z
    .object({
      service: z.literal("drive").optional(),
      operation: z.enum(GOOGLE_DRIVE_FORBIDDEN_ACTION_OPERATIONS).optional(),
      write_requested: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return null;
  if (parsed.data.operation) return parsed.data.operation;
  return parsed.data.service === "drive" && parsed.data.write_requested
    ? "drive.create_file"
    : null;
}

function requestIdFromUnknown(input: unknown): string {
  const parsed = z.object({ request_id: ActionIdSchema }).safeParse(input);
  return parsed.success
    ? parsed.data.request_id
    : "request:invalid-google-action";
}

function rejectedPlan(input: {
  readonly plan_id: string;
  readonly request_id: string;
  readonly operation: GoogleActionPlan["operation"];
  readonly service: "gmail" | "calendar" | "drive";
  readonly reasons: readonly GoogleActionReason[];
}): GoogleActionPlan {
  return GoogleActionPlanSchema.parse({
    actions_version: GOOGLE_ACTIONS_VERSION,
    plan_id: input.plan_id,
    request_id: input.request_id,
    operation: input.operation,
    service: input.service,
    status: "rejected",
    reasons: [...input.reasons],
    authority_level: null,
    adapter_required: input.service !== "drive",
    approval_required: input.reasons.includes("approval_required"),
    consent_required: input.reasons.includes("consent_required"),
    draft_only: false,
    drive_write_allowed: false,
    direct_google_sdk_allowed: false,
    hidden_network_call_allowed: false,
    background_sync_allowed: false,
    scheduler_allowed: false,
    telemetry_metadata_only: true,
    raw_body_telemetry_allowed: false,
  });
}

function gateReasonsForRequest(
  request: GoogleActionRequest,
): readonly GoogleActionReason[] {
  if (request.operation === "gmail.create_draft") return [];

  const reasons: GoogleActionReason[] = [];
  if (!approvalFinalized(request.approval)) {
    reasons.push("approval_required", "approval_not_finalized");
  }

  if (
    request.operation === "calendar.create_event" &&
    !calendarConsentGranted(request.consent)
  ) {
    reasons.push("consent_required", "consent_missing");
  }

  return reasons;
}

function readyReasonsForRequest(
  request: GoogleActionRequest,
): readonly GoogleActionReason[] {
  const reasons: GoogleActionReason[] = [
    "accepted",
    "no_hidden_google_sdk",
    "no_background_sync",
  ];
  if (request.operation === "gmail.create_draft") reasons.push("draft_only");
  return reasons;
}

function approvalFinalized(
  approval: GoogleActionApprovalFinalizationMetadata,
): boolean {
  return (
    approval.approval_status === "approved" &&
    Boolean(approval.approval_id) &&
    Boolean(approval.approved_at) &&
    Boolean(approval.finalized_at) &&
    Boolean(approval.finalization_ref_hash) &&
    !approval.raw_approval_token_included
  );
}

function calendarConsentGranted(
  consent: GoogleActionConsentGateMetadata,
): boolean {
  return (
    consent.consent_granted &&
    consent.consent_scope === "calendar_event_create" &&
    Boolean(consent.consent_recorded_at) &&
    Boolean(consent.consent_ref_hash) &&
    !consent.raw_consent_token_included
  );
}

function authorityLevelForRequest(request: GoogleActionRequest): "T1" | "T2" {
  return request.operation === "gmail.create_draft" ? "T1" : "T2";
}

function approvalRequiredForRequest(request: GoogleActionRequest): boolean {
  return request.operation !== "gmail.create_draft";
}

function consentRequiredForRequest(request: GoogleActionRequest): boolean {
  return request.operation === "calendar.create_event";
}

function adapterInvoker(
  operation: GoogleActionPlan["operation"],
  adapters: GoogleActionAdapterDependencies,
): ((request: GoogleActionRequest) => Promise<unknown> | unknown) | null {
  switch (operation) {
    case "gmail.create_draft":
      if (!adapters.gmail?.createDraft) return null;
      return (request) =>
        adapters.gmail?.createDraft?.(
          GmailCreateDraftActionRequestSchema.parse(request),
        );
    case "gmail.send_draft":
      if (!adapters.gmail?.sendDraft) return null;
      return (request) =>
        adapters.gmail?.sendDraft?.(
          GmailSendDraftActionRequestSchema.parse(request),
        );
    case "calendar.create_event":
      if (!adapters.calendar?.createEvent) return null;
      return (request) =>
        adapters.calendar?.createEvent?.(
          CalendarCreateEventActionRequestSchema.parse(request),
        );
    default:
      return null;
  }
}

function resultForAdapterOutcome(
  request: GoogleActionRequest,
  outcome: unknown,
): GoogleActionResult {
  switch (request.operation) {
    case "gmail.create_draft": {
      const parsed = GmailDraftAdapterOutcomeSchema.parse(outcome);
      return GmailDraftActionResultSchema.parse({
        actions_version: GOOGLE_ACTIONS_VERSION,
        kind: "google.gmail.create_draft.result",
        request_id: request.request_id,
        operation: request.operation,
        service: "gmail",
        authority_level: "T1",
        completed_at: parsed.completed_at,
        draft_id: parsed.draft_id,
        message_id: parsed.message_id,
        provider_result_hash: parsed.provider_result_hash,
        draft_only: true,
        approval_required: false,
        mutation_performed: true,
        send_performed: false,
        raw_body_included: false,
        raw_provider_response_included: false,
        telemetry: telemetryForRequest(request, {
          draftCreated: true,
          sendPerformed: false,
          calendarEventCreated: false,
        }),
      });
    }
    case "gmail.send_draft": {
      const parsed = GmailSendAdapterOutcomeSchema.parse(outcome);
      return GmailSendActionResultSchema.parse({
        actions_version: GOOGLE_ACTIONS_VERSION,
        kind: "google.gmail.send_draft.result",
        request_id: request.request_id,
        operation: request.operation,
        service: "gmail",
        authority_level: "T2",
        completed_at: parsed.completed_at,
        draft_id: parsed.draft_id,
        message_id: parsed.message_id,
        provider_result_hash: parsed.provider_result_hash,
        approval_finalization: request.approval,
        mutation_performed: true,
        send_performed: true,
        raw_body_included: false,
        raw_provider_response_included: false,
        telemetry: telemetryForRequest(request, {
          draftCreated: false,
          sendPerformed: true,
          calendarEventCreated: false,
        }),
      });
    }
    case "calendar.create_event": {
      const parsed = CalendarCreateAdapterOutcomeSchema.parse(outcome);
      return CalendarCreateEventActionResultSchema.parse({
        actions_version: GOOGLE_ACTIONS_VERSION,
        kind: "google.calendar.create_event.result",
        request_id: request.request_id,
        operation: request.operation,
        service: "calendar",
        authority_level: "T2",
        completed_at: parsed.completed_at,
        calendar_id: parsed.calendar_id,
        event_id: parsed.event_id,
        provider_result_hash: parsed.provider_result_hash,
        approval_finalization: request.approval,
        consent_gate: request.consent,
        mutation_performed: true,
        calendar_event_created: true,
        raw_body_included: false,
        raw_provider_response_included: false,
        telemetry: telemetryForRequest(request, {
          draftCreated: false,
          sendPerformed: false,
          calendarEventCreated: true,
        }),
      });
    }
  }
}

function telemetryForRequest(
  request: GoogleActionRequest,
  outcome: {
    readonly draftCreated: boolean;
    readonly sendPerformed: boolean;
    readonly calendarEventCreated: boolean;
  },
): z.infer<typeof GoogleActionTelemetrySchema> {
  return GoogleActionTelemetrySchema.parse({
    actions_version: GOOGLE_ACTIONS_VERSION,
    operation: request.operation,
    service: request.service,
    authority_level: authorityLevelForRequest(request),
    metadata_only: true,
    request_id: request.request_id,
    subject_hash:
      request.operation === "gmail.create_draft"
        ? hashReference(request.subject)
        : null,
    body_hash:
      request.operation === "gmail.create_draft"
        ? hashReference(request.body_text)
        : null,
    title_hash:
      request.operation === "calendar.create_event"
        ? hashReference(request.title)
        : null,
    description_hash:
      request.operation === "calendar.create_event" && request.description
        ? hashReference(request.description)
        : null,
    recipient_count:
      request.operation === "gmail.create_draft"
        ? request.to.length + request.cc.length + request.bcc.length
        : 0,
    attendee_count:
      request.operation === "calendar.create_event"
        ? request.attendee_emails.length
        : 0,
    approval_required: approvalRequiredForRequest(request),
    approval_finalized:
      request.operation === "gmail.create_draft"
        ? false
        : approvalFinalized(request.approval),
    consent_required: consentRequiredForRequest(request),
    consent_granted:
      request.operation === "calendar.create_event"
        ? calendarConsentGranted(request.consent)
        : false,
    draft_created: outcome.draftCreated,
    send_performed: outcome.sendPerformed,
    calendar_event_created: outcome.calendarEventCreated,
    raw_body_included: false,
    raw_email_body_included: false,
    raw_event_description_included: false,
    raw_access_token_included: false,
    raw_refresh_token_included: false,
    raw_credentials_included: false,
    raw_approval_token_included: false,
    raw_consent_token_included: false,
    background_sync_attempted: false,
    scheduler_attempted: false,
  });
}

function executionResult(input: {
  readonly plan: GoogleActionPlan;
  readonly execution_status: GoogleActionExecutionStatus;
  readonly reasons: readonly GoogleActionReason[];
  readonly result: GoogleActionResult | null;
  readonly adapter_invoked: boolean;
}): GoogleActionExecutionResult {
  return GoogleActionExecutionResultSchema.parse({
    actions_version: GOOGLE_ACTIONS_VERSION,
    plan: input.plan,
    execution_status: input.execution_status,
    reasons: [...input.reasons],
    result: input.result,
    adapter_invoked: input.adapter_invoked,
    write_attempted: input.adapter_invoked,
    mutation_performed: input.result?.mutation_performed ?? false,
    send_performed:
      input.result?.operation === "gmail.send_draft"
        ? input.result.send_performed
        : false,
    calendar_event_created:
      input.result?.operation === "calendar.create_event"
        ? input.result.calendar_event_created
        : false,
    drive_write_performed: false,
    raw_body_included: false,
    raw_secret_included: false,
    raw_provider_response_included: false,
    background_sync_attempted: false,
    scheduler_attempted: false,
  });
}

function hashReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
