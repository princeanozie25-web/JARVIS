import { z } from "zod";
import {
  CalendarFetchAvailabilityMetadataRequestSchema,
  CalendarFetchAvailabilityMetadataResultSchema,
  CalendarFetchEventMetadataRequestSchema,
  CalendarFetchEventMetadataResultSchema,
  CalendarFetchMeetingMetadataRequestSchema,
  CalendarFetchMeetingMetadataResultSchema,
  CalendarListEventsRequestSchema,
  CalendarListEventsResultSchema,
  DriveFetchDocumentMetadataRequestSchema,
  DriveFetchDocumentMetadataResultSchema,
  DriveFetchFileMetadataRequestSchema,
  DriveFetchFileMetadataResultSchema,
  DriveFetchFolderMetadataRequestSchema,
  DriveFetchFolderMetadataResultSchema,
  GOOGLE_ADAPTER_CONTRACT_VERSION,
  GmailFetchAttachmentMetadataRequestSchema,
  GmailFetchAttachmentMetadataResultSchema,
  GmailFetchMessageMetadataRequestSchema,
  GmailFetchMessageMetadataResultSchema,
  GmailFetchThreadMetadataRequestSchema,
  GmailFetchThreadMetadataResultSchema,
  GmailSearchMessagesRequestSchema,
  GmailSearchMessagesResultSchema,
  GoogleAdapterLibrarianEnvelopeSchema,
  GoogleAdapterOperationSchema,
  GoogleAdapterVerificationMetadataSchema,
  createGoogleAdapterLibrarianEnvelope,
  createGoogleAdapterVerificationMetadata,
  getGoogleAdapterOperationAuthority,
  type CalendarAvailabilityMetadata,
  type CalendarEventMetadata,
  type CalendarMeetingMetadata,
  type DriveDocumentMetadata,
  type DriveFileMetadata,
  type DriveFolderMetadata,
  type GmailAttachmentMetadata,
  type GmailMessageMetadata,
  type GmailThreadMetadata,
  type GoogleAdapterLibrarianEnvelope,
  type GoogleAdapterOperation,
  type GoogleAdapterService,
  type GoogleAdapterVerificationMetadata,
} from "./contracts";

export const GOOGLE_READONLY_PLANNER_VERSION =
  "phase21b.google-readonly-planner.v1" as const;

export const GOOGLE_READONLY_PLAN_STATUSES = [
  "ready",
  "rejected",
  "unavailable",
] as const;

export const GOOGLE_READONLY_EXECUTION_STATUSES = [
  "completed",
  "unavailable",
  "rejected",
  "adapter_error",
] as const;

export const GOOGLE_READONLY_REASONS = [
  "accepted",
  "invalid_request",
  "adapter_missing",
  "adapter_error",
  "metadata_only",
  "no_mutation_authority",
] as const;

const PlanIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const GoogleReadonlyPlanStatusSchema = z.enum(
  GOOGLE_READONLY_PLAN_STATUSES,
);
export const GoogleReadonlyExecutionStatusSchema = z.enum(
  GOOGLE_READONLY_EXECUTION_STATUSES,
);
export const GoogleReadonlyReasonSchema = z.enum(GOOGLE_READONLY_REASONS);

export const GoogleReadonlyAdapterPlanSchema = z.strictObject({
  planner_version: z.literal(GOOGLE_READONLY_PLANNER_VERSION),
  plan_id: PlanIdSchema,
  request_id: PlanIdSchema,
  operation: GoogleAdapterOperationSchema,
  service: z.enum(["gmail", "calendar", "drive"]),
  status: GoogleReadonlyPlanStatusSchema,
  reasons: z.array(GoogleReadonlyReasonSchema),
  adapter_required: z.literal(true),
  metadata_only: z.literal(true),
  content_body_requested: z.literal(false),
  mutation_requested: z.literal(false),
  write_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
  authority: z.strictObject({
    authority_level: z.literal("T0"),
    operation_class: z.literal("metadata_read"),
    live_call_supported: z.literal(false),
    mutation_supported: z.literal(false),
  }),
});

export const GoogleReadonlyBridgeSummarySchema = z.strictObject({
  librarian_envelope_count: z.number().int().nonnegative(),
  verification_metadata_count: z.number().int().nonnegative(),
  durable_promotion_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
  raw_body_included: z.literal(false),
});

export const GoogleReadonlyExecutionResultSchema = z.strictObject({
  planner_version: z.literal(GOOGLE_READONLY_PLANNER_VERSION),
  plan: GoogleReadonlyAdapterPlanSchema,
  execution_status: GoogleReadonlyExecutionStatusSchema,
  reasons: z.array(GoogleReadonlyReasonSchema),
  result_kind: z.string().trim().min(1).max(120).nullable(),
  metadata_count: z.number().int().nonnegative(),
  librarian_envelopes: z.array(GoogleAdapterLibrarianEnvelopeSchema),
  verification_metadata: z.array(GoogleAdapterVerificationMetadataSchema),
  bridge_summary: GoogleReadonlyBridgeSummarySchema,
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  mutation_performed: z.literal(false),
  network_call_performed: z.literal(false),
  write_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
});

type GmailSearchMessagesRequest = z.infer<
  typeof GmailSearchMessagesRequestSchema
>;
type GmailSearchMessagesResult = z.infer<
  typeof GmailSearchMessagesResultSchema
>;
type GmailFetchMessageMetadataRequest = z.infer<
  typeof GmailFetchMessageMetadataRequestSchema
>;
type GmailFetchMessageMetadataResult = z.infer<
  typeof GmailFetchMessageMetadataResultSchema
>;
type GmailFetchThreadMetadataRequest = z.infer<
  typeof GmailFetchThreadMetadataRequestSchema
>;
type GmailFetchThreadMetadataResult = z.infer<
  typeof GmailFetchThreadMetadataResultSchema
>;
type GmailFetchAttachmentMetadataRequest = z.infer<
  typeof GmailFetchAttachmentMetadataRequestSchema
>;
type GmailFetchAttachmentMetadataResult = z.infer<
  typeof GmailFetchAttachmentMetadataResultSchema
>;
type CalendarListEventsRequest = z.infer<
  typeof CalendarListEventsRequestSchema
>;
type CalendarListEventsResult = z.infer<typeof CalendarListEventsResultSchema>;
type CalendarFetchEventMetadataRequest = z.infer<
  typeof CalendarFetchEventMetadataRequestSchema
>;
type CalendarFetchEventMetadataResult = z.infer<
  typeof CalendarFetchEventMetadataResultSchema
>;
type CalendarFetchAvailabilityMetadataRequest = z.infer<
  typeof CalendarFetchAvailabilityMetadataRequestSchema
>;
type CalendarFetchAvailabilityMetadataResult = z.infer<
  typeof CalendarFetchAvailabilityMetadataResultSchema
>;
type CalendarFetchMeetingMetadataRequest = z.infer<
  typeof CalendarFetchMeetingMetadataRequestSchema
>;
type CalendarFetchMeetingMetadataResult = z.infer<
  typeof CalendarFetchMeetingMetadataResultSchema
>;
type DriveFetchFileMetadataRequest = z.infer<
  typeof DriveFetchFileMetadataRequestSchema
>;
type DriveFetchFileMetadataResult = z.infer<
  typeof DriveFetchFileMetadataResultSchema
>;
type DriveFetchFolderMetadataRequest = z.infer<
  typeof DriveFetchFolderMetadataRequestSchema
>;
type DriveFetchFolderMetadataResult = z.infer<
  typeof DriveFetchFolderMetadataResultSchema
>;
type DriveFetchDocumentMetadataRequest = z.infer<
  typeof DriveFetchDocumentMetadataRequestSchema
>;
type DriveFetchDocumentMetadataResult = z.infer<
  typeof DriveFetchDocumentMetadataResultSchema
>;

export type GoogleReadonlyAdapterRequest =
  | GmailSearchMessagesRequest
  | GmailFetchMessageMetadataRequest
  | GmailFetchThreadMetadataRequest
  | GmailFetchAttachmentMetadataRequest
  | CalendarListEventsRequest
  | CalendarFetchEventMetadataRequest
  | CalendarFetchAvailabilityMetadataRequest
  | CalendarFetchMeetingMetadataRequest
  | DriveFetchFileMetadataRequest
  | DriveFetchFolderMetadataRequest
  | DriveFetchDocumentMetadataRequest;

export type GoogleReadonlyAdapterResult =
  | GmailSearchMessagesResult
  | GmailFetchMessageMetadataResult
  | GmailFetchThreadMetadataResult
  | GmailFetchAttachmentMetadataResult
  | CalendarListEventsResult
  | CalendarFetchEventMetadataResult
  | CalendarFetchAvailabilityMetadataResult
  | CalendarFetchMeetingMetadataResult
  | DriveFetchFileMetadataResult
  | DriveFetchFolderMetadataResult
  | DriveFetchDocumentMetadataResult;

export type GoogleReadonlyAdapterPlan = z.infer<
  typeof GoogleReadonlyAdapterPlanSchema
>;
export type GoogleReadonlyExecutionResult = z.infer<
  typeof GoogleReadonlyExecutionResultSchema
>;
export type GoogleReadonlyPlanStatus = z.infer<
  typeof GoogleReadonlyPlanStatusSchema
>;
export type GoogleReadonlyExecutionStatus = z.infer<
  typeof GoogleReadonlyExecutionStatusSchema
>;
export type GoogleReadonlyReason = z.infer<typeof GoogleReadonlyReasonSchema>;

export interface GoogleReadonlyGmailAdapter {
  readonly searchMessages?: (
    request: GmailSearchMessagesRequest,
  ) => Promise<GmailSearchMessagesResult> | GmailSearchMessagesResult;
  readonly fetchMessageMetadata?: (
    request: GmailFetchMessageMetadataRequest,
  ) =>
    | Promise<GmailFetchMessageMetadataResult>
    | GmailFetchMessageMetadataResult;
  readonly fetchThreadMetadata?: (
    request: GmailFetchThreadMetadataRequest,
  ) => Promise<GmailFetchThreadMetadataResult> | GmailFetchThreadMetadataResult;
  readonly fetchAttachmentMetadata?: (
    request: GmailFetchAttachmentMetadataRequest,
  ) =>
    | Promise<GmailFetchAttachmentMetadataResult>
    | GmailFetchAttachmentMetadataResult;
}

export interface GoogleReadonlyCalendarAdapter {
  readonly listEvents?: (
    request: CalendarListEventsRequest,
  ) => Promise<CalendarListEventsResult> | CalendarListEventsResult;
  readonly fetchEventMetadata?: (
    request: CalendarFetchEventMetadataRequest,
  ) =>
    | Promise<CalendarFetchEventMetadataResult>
    | CalendarFetchEventMetadataResult;
  readonly fetchAvailabilityMetadata?: (
    request: CalendarFetchAvailabilityMetadataRequest,
  ) =>
    | Promise<CalendarFetchAvailabilityMetadataResult>
    | CalendarFetchAvailabilityMetadataResult;
  readonly fetchMeetingMetadata?: (
    request: CalendarFetchMeetingMetadataRequest,
  ) =>
    | Promise<CalendarFetchMeetingMetadataResult>
    | CalendarFetchMeetingMetadataResult;
}

export interface GoogleReadonlyDriveAdapter {
  readonly fetchFileMetadata?: (
    request: DriveFetchFileMetadataRequest,
  ) => Promise<DriveFetchFileMetadataResult> | DriveFetchFileMetadataResult;
  readonly fetchFolderMetadata?: (
    request: DriveFetchFolderMetadataRequest,
  ) => Promise<DriveFetchFolderMetadataResult> | DriveFetchFolderMetadataResult;
  readonly fetchDocumentMetadata?: (
    request: DriveFetchDocumentMetadataRequest,
  ) =>
    | Promise<DriveFetchDocumentMetadataResult>
    | DriveFetchDocumentMetadataResult;
}

export interface GoogleReadonlyAdapterDependencies {
  readonly gmail?: GoogleReadonlyGmailAdapter;
  readonly calendar?: GoogleReadonlyCalendarAdapter;
  readonly drive?: GoogleReadonlyDriveAdapter;
}

export function planGoogleReadonlyAdapterOperation(input: {
  readonly plan_id: string;
  readonly request: unknown;
}): GoogleReadonlyAdapterPlan {
  const request = parseReadonlyRequest(input.request);
  if (!request) {
    return rejectedPlan(input.plan_id);
  }

  const authority = getGoogleAdapterOperationAuthority(request.operation);
  return GoogleReadonlyAdapterPlanSchema.parse({
    planner_version: GOOGLE_READONLY_PLANNER_VERSION,
    plan_id: input.plan_id,
    request_id: request.request_id,
    operation: request.operation,
    service: request.service,
    status: "ready",
    reasons: ["accepted", "metadata_only", "no_mutation_authority"],
    adapter_required: true,
    metadata_only: true,
    content_body_requested: false,
    mutation_requested: false,
    write_attempted: false,
    vault_write_attempted: false,
    authority: {
      authority_level: authority.authority_level,
      operation_class: authority.operation_class,
      live_call_supported: authority.live_call_supported,
      mutation_supported: authority.mutation_supported,
    },
  });
}

export const planGmailMetadataSearch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planGmailMessageMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planGmailThreadMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planCalendarEventMetadataList = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planCalendarEventMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planCalendarMeetingMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planDriveFileMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planDriveFolderMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export const planDriveDocumentMetadataFetch = (
  plan_id: string,
  request: unknown,
): GoogleReadonlyAdapterPlan =>
  planGoogleReadonlyAdapterOperation({ plan_id, request });

export async function executeGoogleReadonlyAdapterPlan(
  plan: GoogleReadonlyAdapterPlan,
  request: GoogleReadonlyAdapterRequest,
  adapters: GoogleReadonlyAdapterDependencies,
): Promise<GoogleReadonlyExecutionResult> {
  if (plan.status !== "ready") {
    return executionResult({
      plan,
      execution_status: "rejected",
      reasons: ["invalid_request", "no_mutation_authority"],
      result: null,
    });
  }

  const invoker = adapterInvoker(plan.operation, adapters);
  if (!invoker) {
    return executionResult({
      plan,
      execution_status: "unavailable",
      reasons: ["adapter_missing", "metadata_only", "no_mutation_authority"],
      result: null,
    });
  }

  try {
    const result = validateReadonlyResult(
      plan.operation,
      await invoker(request),
    );
    return executionResult({
      plan,
      execution_status: "completed",
      reasons: ["accepted", "metadata_only", "no_mutation_authority"],
      result,
    });
  } catch {
    return executionResult({
      plan,
      execution_status: "adapter_error",
      reasons: ["adapter_error", "metadata_only", "no_mutation_authority"],
      result: null,
    });
  }
}

export function projectGoogleReadonlyResultToLibrarianEnvelopes(
  result: GoogleReadonlyAdapterResult,
): readonly GoogleAdapterLibrarianEnvelope[] {
  return metadataRecords(result).flatMap((record) => {
    const contentHash = record.content_hash;
    if (!contentHash) return [];
    return [
      createGoogleAdapterLibrarianEnvelope({
        envelope_id: `google:${record.service}:${record.source_id}:librarian`,
        source_id: record.source_id,
        source_ref: record.source_ref,
        service: record.service,
        operation: result.operation,
        captured_at: result.captured_at,
        content_hash: contentHash,
        suggested_route_target: record.route_target,
      }),
    ];
  });
}

export function projectGoogleReadonlyResultToVerificationMetadata(
  result: GoogleReadonlyAdapterResult,
): readonly GoogleAdapterVerificationMetadata[] {
  return metadataRecords(result).map((record) =>
    createGoogleAdapterVerificationMetadata({
      verification_ref_id: `google:${record.service}:${record.source_id}:verification`,
      service: record.service,
      operation: result.operation,
      source_id: record.source_id,
      evidence_types: record.evidence_types,
      suggested_risk_flags: record.risk_flags,
    }),
  );
}

function rejectedPlan(plan_id: string): GoogleReadonlyAdapterPlan {
  return GoogleReadonlyAdapterPlanSchema.parse({
    planner_version: GOOGLE_READONLY_PLANNER_VERSION,
    plan_id,
    request_id: "request:invalid-google-readonly",
    operation: "gmail.search_messages",
    service: "gmail",
    status: "rejected",
    reasons: ["invalid_request", "metadata_only", "no_mutation_authority"],
    adapter_required: true,
    metadata_only: true,
    content_body_requested: false,
    mutation_requested: false,
    write_attempted: false,
    vault_write_attempted: false,
    authority: {
      authority_level: "T0",
      operation_class: "metadata_read",
      live_call_supported: false,
      mutation_supported: false,
    },
  });
}

function parseReadonlyRequest(
  input: unknown,
): GoogleReadonlyAdapterRequest | null {
  const schemas = [
    GmailSearchMessagesRequestSchema,
    GmailFetchMessageMetadataRequestSchema,
    GmailFetchThreadMetadataRequestSchema,
    GmailFetchAttachmentMetadataRequestSchema,
    CalendarListEventsRequestSchema,
    CalendarFetchEventMetadataRequestSchema,
    CalendarFetchAvailabilityMetadataRequestSchema,
    CalendarFetchMeetingMetadataRequestSchema,
    DriveFetchFileMetadataRequestSchema,
    DriveFetchFolderMetadataRequestSchema,
    DriveFetchDocumentMetadataRequestSchema,
  ] as const;
  for (const schema of schemas) {
    const parsed = schema.safeParse(input);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function validateReadonlyResult(
  operation: GoogleAdapterOperation,
  input: unknown,
): GoogleReadonlyAdapterResult {
  const schema = resultSchemaForOperation(operation);
  return schema.parse(input) as GoogleReadonlyAdapterResult;
}

function resultSchemaForOperation(operation: GoogleAdapterOperation) {
  switch (operation) {
    case "gmail.search_messages":
      return GmailSearchMessagesResultSchema;
    case "gmail.fetch_message_metadata":
      return GmailFetchMessageMetadataResultSchema;
    case "gmail.fetch_thread_metadata":
      return GmailFetchThreadMetadataResultSchema;
    case "gmail.fetch_attachment_metadata":
      return GmailFetchAttachmentMetadataResultSchema;
    case "calendar.list_events":
      return CalendarListEventsResultSchema;
    case "calendar.fetch_event_metadata":
      return CalendarFetchEventMetadataResultSchema;
    case "calendar.fetch_availability_metadata":
      return CalendarFetchAvailabilityMetadataResultSchema;
    case "calendar.fetch_meeting_metadata":
      return CalendarFetchMeetingMetadataResultSchema;
    case "drive.fetch_file_metadata":
      return DriveFetchFileMetadataResultSchema;
    case "drive.fetch_folder_metadata":
      return DriveFetchFolderMetadataResultSchema;
    case "drive.fetch_document_metadata":
      return DriveFetchDocumentMetadataResultSchema;
  }
  const exhaustive: never = operation;
  return exhaustive;
}

function adapterInvoker(
  operation: GoogleAdapterOperation,
  adapters: GoogleReadonlyAdapterDependencies,
):
  | ((request: GoogleReadonlyAdapterRequest) => Promise<unknown> | unknown)
  | null {
  switch (operation) {
    case "gmail.search_messages":
      if (!adapters.gmail?.searchMessages) return null;
      return (request) =>
        adapters.gmail?.searchMessages?.(
          GmailSearchMessagesRequestSchema.parse(request),
        );
    case "gmail.fetch_message_metadata":
      if (!adapters.gmail?.fetchMessageMetadata) return null;
      return (request) =>
        adapters.gmail?.fetchMessageMetadata?.(
          GmailFetchMessageMetadataRequestSchema.parse(request),
        );
    case "gmail.fetch_thread_metadata":
      if (!adapters.gmail?.fetchThreadMetadata) return null;
      return (request) =>
        adapters.gmail?.fetchThreadMetadata?.(
          GmailFetchThreadMetadataRequestSchema.parse(request),
        );
    case "gmail.fetch_attachment_metadata":
      if (!adapters.gmail?.fetchAttachmentMetadata) return null;
      return (request) =>
        adapters.gmail?.fetchAttachmentMetadata?.(
          GmailFetchAttachmentMetadataRequestSchema.parse(request),
        );
    case "calendar.list_events":
      if (!adapters.calendar?.listEvents) return null;
      return (request) =>
        adapters.calendar?.listEvents?.(
          CalendarListEventsRequestSchema.parse(request),
        );
    case "calendar.fetch_event_metadata":
      if (!adapters.calendar?.fetchEventMetadata) return null;
      return (request) =>
        adapters.calendar?.fetchEventMetadata?.(
          CalendarFetchEventMetadataRequestSchema.parse(request),
        );
    case "calendar.fetch_availability_metadata":
      if (!adapters.calendar?.fetchAvailabilityMetadata) return null;
      return (request) =>
        adapters.calendar?.fetchAvailabilityMetadata?.(
          CalendarFetchAvailabilityMetadataRequestSchema.parse(request),
        );
    case "calendar.fetch_meeting_metadata":
      if (!adapters.calendar?.fetchMeetingMetadata) return null;
      return (request) =>
        adapters.calendar?.fetchMeetingMetadata?.(
          CalendarFetchMeetingMetadataRequestSchema.parse(request),
        );
    case "drive.fetch_file_metadata":
      if (!adapters.drive?.fetchFileMetadata) return null;
      return (request) =>
        adapters.drive?.fetchFileMetadata?.(
          DriveFetchFileMetadataRequestSchema.parse(request),
        );
    case "drive.fetch_folder_metadata":
      if (!adapters.drive?.fetchFolderMetadata) return null;
      return (request) =>
        adapters.drive?.fetchFolderMetadata?.(
          DriveFetchFolderMetadataRequestSchema.parse(request),
        );
    case "drive.fetch_document_metadata":
      if (!adapters.drive?.fetchDocumentMetadata) return null;
      return (request) =>
        adapters.drive?.fetchDocumentMetadata?.(
          DriveFetchDocumentMetadataRequestSchema.parse(request),
        );
  }
  const exhaustive: never = operation;
  return exhaustive;
}

function executionResult(input: {
  readonly plan: GoogleReadonlyAdapterPlan;
  readonly execution_status: GoogleReadonlyExecutionStatus;
  readonly reasons: readonly GoogleReadonlyReason[];
  readonly result: GoogleReadonlyAdapterResult | null;
}): GoogleReadonlyExecutionResult {
  const librarianEnvelopes = input.result
    ? projectGoogleReadonlyResultToLibrarianEnvelopes(input.result)
    : [];
  const verificationMetadata = input.result
    ? projectGoogleReadonlyResultToVerificationMetadata(input.result)
    : [];
  const metadataCount = input.result ? metadataRecords(input.result).length : 0;

  return GoogleReadonlyExecutionResultSchema.parse({
    planner_version: GOOGLE_READONLY_PLANNER_VERSION,
    plan: input.plan,
    execution_status: input.execution_status,
    reasons: [...input.reasons],
    result_kind: input.result ? input.result.kind : null,
    metadata_count: metadataCount,
    librarian_envelopes: librarianEnvelopes,
    verification_metadata: verificationMetadata,
    bridge_summary: {
      librarian_envelope_count: librarianEnvelopes.length,
      verification_metadata_count: verificationMetadata.length,
      durable_promotion_attempted: false,
      vault_write_attempted: false,
      raw_body_included: false,
    },
    metadata_only: true,
    raw_body_included: false,
    mutation_performed: false,
    network_call_performed: false,
    write_attempted: false,
    vault_write_attempted: false,
  });
}

type MetadataRecord = {
  readonly service: GoogleAdapterService;
  readonly source_id: string;
  readonly source_ref: string;
  readonly content_hash: string | null;
  readonly route_target: "inbox" | "research" | "project" | "career";
  readonly evidence_types: readonly (
    | "source_presence"
    | "date_freshness"
    | "metadata_consistency"
    | "identity_consistency"
    | "attachment_presence"
  )[];
  readonly risk_flags: readonly (
    | "outdated_information"
    | "insufficient_sources"
    | "conflicting_context"
    | "unsupported_claim"
  )[];
};

function metadataRecords(
  result: GoogleReadonlyAdapterResult,
): readonly MetadataRecord[] {
  switch (result.operation) {
    case "gmail.search_messages":
      return result.messages.map((message) => gmailMessageRecord(message));
    case "gmail.fetch_message_metadata":
      return [gmailMessageRecord(result.message)];
    case "gmail.fetch_thread_metadata":
      return [gmailThreadRecord(result.thread)];
    case "gmail.fetch_attachment_metadata":
      return [gmailAttachmentRecord(result.attachment)];
    case "calendar.list_events":
      return result.events.map((event) => calendarEventRecord(event));
    case "calendar.fetch_event_metadata":
      return [calendarEventRecord(result.event)];
    case "calendar.fetch_availability_metadata":
      return [
        {
          service: "calendar",
          source_id: `calendar:availability:${result.request_id}`,
          source_ref: `calendar://metadata/availability/${result.request_id}`,
          content_hash: null,
          route_target: "inbox",
          evidence_types: ["source_presence", "date_freshness"],
          risk_flags: ["insufficient_sources"],
        },
      ];
    case "calendar.fetch_meeting_metadata":
      return [calendarMeetingRecord(result.meeting)];
    case "drive.fetch_file_metadata":
      return [driveFileRecord(result.file)];
    case "drive.fetch_folder_metadata":
      return [driveFolderRecord(result.folder)];
    case "drive.fetch_document_metadata":
      return [driveDocumentRecord(result.document)];
  }
}

function gmailMessageRecord(message: GmailMessageMetadata): MetadataRecord {
  return {
    service: "gmail",
    source_id: message.message_id,
    source_ref: `gmail://metadata/messages/${message.message_id}`,
    content_hash: firstHash(
      message.snippet_hash,
      message.subject_hash,
      message.sender_hash,
    ),
    route_target: "inbox",
    evidence_types: [
      "source_presence",
      "date_freshness",
      "metadata_consistency",
    ],
    risk_flags: ["insufficient_sources", "outdated_information"],
  };
}

function gmailThreadRecord(thread: GmailThreadMetadata): MetadataRecord {
  return {
    service: "gmail",
    source_id: thread.thread_id,
    source_ref: `gmail://metadata/threads/${thread.thread_id}`,
    content_hash: firstHash(...thread.participant_hashes),
    route_target: "inbox",
    evidence_types: [
      "source_presence",
      "date_freshness",
      "identity_consistency",
    ],
    risk_flags: ["insufficient_sources"],
  };
}

function gmailAttachmentRecord(
  attachment: GmailAttachmentMetadata,
): MetadataRecord {
  return {
    service: "gmail",
    source_id: attachment.attachment_id,
    source_ref: `gmail://metadata/attachments/${attachment.attachment_id}`,
    content_hash: firstHash(attachment.content_hash, attachment.filename_hash),
    route_target: "inbox",
    evidence_types: ["source_presence", "attachment_presence"],
    risk_flags: ["insufficient_sources"],
  };
}

function calendarEventRecord(event: CalendarEventMetadata): MetadataRecord {
  return {
    service: "calendar",
    source_id: event.event_id,
    source_ref: `calendar://metadata/events/${event.event_id}`,
    content_hash: firstHash(event.summary_hash, event.organizer_hash),
    route_target: "career",
    evidence_types: [
      "source_presence",
      "date_freshness",
      "metadata_consistency",
    ],
    risk_flags: ["outdated_information", "insufficient_sources"],
  };
}

function calendarMeetingRecord(
  meeting: CalendarMeetingMetadata,
): MetadataRecord {
  return {
    service: "calendar",
    source_id: meeting.meeting_id,
    source_ref: `calendar://metadata/meetings/${meeting.meeting_id}`,
    content_hash: meeting.provider_metadata_hash,
    route_target: "career",
    evidence_types: ["source_presence", "metadata_consistency"],
    risk_flags: ["insufficient_sources"],
  };
}

function driveFileRecord(file: DriveFileMetadata): MetadataRecord {
  return {
    service: "drive",
    source_id: file.file_id,
    source_ref: `drive://metadata/files/${file.file_id}`,
    content_hash: firstHash(file.content_hash, file.name_hash),
    route_target: "research",
    evidence_types: [
      "source_presence",
      "date_freshness",
      "metadata_consistency",
    ],
    risk_flags: ["insufficient_sources"],
  };
}

function driveFolderRecord(folder: DriveFolderMetadata): MetadataRecord {
  return {
    service: "drive",
    source_id: folder.folder_id,
    source_ref: `drive://metadata/folders/${folder.folder_id}`,
    content_hash: firstHash(folder.name_hash, folder.owner_hash),
    route_target: "research",
    evidence_types: ["source_presence", "metadata_consistency"],
    risk_flags: ["insufficient_sources"],
  };
}

function driveDocumentRecord(document: DriveDocumentMetadata): MetadataRecord {
  return {
    service: "drive",
    source_id: document.document_id,
    source_ref: `drive://metadata/documents/${document.document_id}`,
    content_hash: firstHash(document.content_hash, document.title_hash),
    route_target: "research",
    evidence_types: [
      "source_presence",
      "date_freshness",
      "metadata_consistency",
    ],
    risk_flags: ["insufficient_sources", "outdated_information"],
  };
}

function firstHash(
  ...hashes: readonly (string | null | undefined)[]
): string | null {
  return (
    hashes.find((hash) => HashReferenceSchema.safeParse(hash).success) ?? null
  );
}

export const GOOGLE_READONLY_ADAPTER_GOVERNANCE = {
  contract_version: GOOGLE_ADAPTER_CONTRACT_VERSION,
  planner_version: GOOGLE_READONLY_PLANNER_VERSION,
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
} as const;
