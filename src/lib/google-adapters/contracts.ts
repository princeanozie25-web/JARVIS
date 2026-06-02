import { z } from "zod";

export const GOOGLE_ADAPTER_CONTRACT_VERSION =
  "phase21b.google-adapter-contracts.v1" as const;

export const GOOGLE_ADAPTER_SERVICES = ["gmail", "calendar", "drive"] as const;

export const GOOGLE_ADAPTER_AUTHORITY_LEVELS = [
  "T0",
  "T1",
  "T2",
  "T3",
] as const;

export const GOOGLE_ADAPTER_OPERATION_CLASSES = [
  "metadata_read",
  "content_read",
  "draft_generation",
  "send_delete_mutate",
] as const;

export const GOOGLE_ADAPTER_AUTHORITY_CLASS_MAP = {
  metadata_read: "T0",
  content_read: "T1",
  draft_generation: "T2",
  send_delete_mutate: "T3",
} as const;

export const GOOGLE_GMAIL_OPERATIONS = [
  "gmail.search_messages",
  "gmail.fetch_message_metadata",
  "gmail.fetch_thread_metadata",
  "gmail.fetch_attachment_metadata",
] as const;

export const GOOGLE_CALENDAR_OPERATIONS = [
  "calendar.list_events",
  "calendar.fetch_event_metadata",
  "calendar.fetch_availability_metadata",
  "calendar.fetch_meeting_metadata",
] as const;

export const GOOGLE_DRIVE_OPERATIONS = [
  "drive.fetch_file_metadata",
  "drive.fetch_folder_metadata",
  "drive.fetch_document_metadata",
] as const;

export const GOOGLE_ADAPTER_OPERATIONS = [
  ...GOOGLE_GMAIL_OPERATIONS,
  ...GOOGLE_CALENDAR_OPERATIONS,
  ...GOOGLE_DRIVE_OPERATIONS,
] as const;

export const GOOGLE_ADAPTER_LIBRARIAN_SOURCE_TYPES = [
  "google_gmail",
  "google_calendar",
  "google_drive",
] as const;

export const GOOGLE_ADAPTER_VERIFICATION_EVIDENCE_TYPES = [
  "source_presence",
  "date_freshness",
  "metadata_consistency",
  "identity_consistency",
  "attachment_presence",
] as const;

export const GOOGLE_ADAPTER_VERIFICATION_RISK_FLAGS = [
  "unsupported_claim",
  "outdated_information",
  "insufficient_sources",
  "conflicting_context",
] as const;

const ContractIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const MetadataTextSchema = z.string().trim().min(1).max(280);

const MetadataHashSchema = HashReferenceSchema.nullable().default(null);

const GoogleAdapterGovernanceSchema = z.strictObject({
  contract_only: z.literal(true),
  live_integration_enabled: z.literal(false),
  api_client_present: z.literal(false),
  api_call_supported: z.literal(false),
  network_call_supported: z.literal(false),
  credential_storage_supported: z.literal(false),
  token_storage_supported: z.literal(false),
  background_sync_supported: z.literal(false),
  scheduler_supported: z.literal(false),
  content_body_required: z.literal(false),
  raw_body_included: z.literal(false),
  mutation_supported: z.literal(false),
});

const GoogleAdapterPageRequestSchema = z.strictObject({
  max_results: z.number().int().min(1).max(100).default(25),
  page_token_ref: z.string().trim().min(1).max(180).nullable().default(null),
});

const GoogleAdapterMetadataWindowSchema = z.strictObject({
  start_at: IsoDateTimeSchema.nullable().default(null),
  end_at: IsoDateTimeSchema.nullable().default(null),
});

export const GoogleAdapterServiceSchema = z.enum(GOOGLE_ADAPTER_SERVICES);
export const GoogleAdapterAuthorityLevelSchema = z.enum(
  GOOGLE_ADAPTER_AUTHORITY_LEVELS,
);
export const GoogleAdapterOperationClassSchema = z.enum(
  GOOGLE_ADAPTER_OPERATION_CLASSES,
);
export const GoogleAdapterOperationSchema = z.enum(GOOGLE_ADAPTER_OPERATIONS);
export const GoogleAdapterLibrarianSourceTypeSchema = z.enum(
  GOOGLE_ADAPTER_LIBRARIAN_SOURCE_TYPES,
);
export const GoogleAdapterVerificationEvidenceTypeSchema = z.enum(
  GOOGLE_ADAPTER_VERIFICATION_EVIDENCE_TYPES,
);
export const GoogleAdapterVerificationRiskFlagSchema = z.enum(
  GOOGLE_ADAPTER_VERIFICATION_RISK_FLAGS,
);

export const GoogleAdapterAuthorityMappingSchema = z.strictObject({
  operation: GoogleAdapterOperationSchema,
  service: GoogleAdapterServiceSchema,
  operation_class: GoogleAdapterOperationClassSchema,
  authority_level: GoogleAdapterAuthorityLevelSchema,
  metadata_only: z.literal(true),
  approval_required: z.literal(false),
  content_body_required: z.literal(false),
  mutation_supported: z.literal(false),
  live_call_supported: z.literal(false),
});

export const GOOGLE_ADAPTER_OPERATION_AUTHORITY = Object.fromEntries(
  GOOGLE_ADAPTER_OPERATIONS.map((operation) => [
    operation,
    {
      operation,
      service: operation.split(".")[0],
      operation_class: "metadata_read",
      authority_level: "T0",
      metadata_only: true,
      approval_required: false,
      content_body_required: false,
      mutation_supported: false,
      live_call_supported: false,
    },
  ]),
) as Record<GoogleAdapterOperation, GoogleAdapterAuthorityMapping>;

export const GoogleAdapterBaseRequestSchema = z.strictObject({
  contract_version: z.literal(GOOGLE_ADAPTER_CONTRACT_VERSION),
  request_id: ContractIdSchema,
  operation: GoogleAdapterOperationSchema,
  service: GoogleAdapterServiceSchema,
  requested_at: IsoDateTimeSchema,
  metadata_only: z.literal(true),
  content_body_requested: z.literal(false),
  mutation_requested: z.literal(false),
  governance: GoogleAdapterGovernanceSchema,
});

export const GoogleAdapterBaseResultSchema = z.strictObject({
  contract_version: z.literal(GOOGLE_ADAPTER_CONTRACT_VERSION),
  request_id: ContractIdSchema,
  operation: GoogleAdapterOperationSchema,
  service: GoogleAdapterServiceSchema,
  captured_at: IsoDateTimeSchema,
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  mutation_performed: z.literal(false),
  network_call_performed: z.literal(false),
  next_page_token_ref: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .nullable()
    .default(null),
});

export const GmailMessageMetadataSchema = z.strictObject({
  message_id: ContractIdSchema,
  thread_id: ContractIdSchema,
  label_ids: z.array(MetadataTextSchema).default([]),
  sender_hash: MetadataHashSchema,
  recipient_hashes: z.array(HashReferenceSchema).default([]),
  subject_hash: MetadataHashSchema,
  sent_at: IsoDateTimeSchema.nullable().default(null),
  received_at: IsoDateTimeSchema.nullable().default(null),
  size_estimate_bytes: z.number().int().nonnegative().nullable().default(null),
  attachment_count: z.number().int().nonnegative().default(0),
  snippet_hash: MetadataHashSchema,
  raw_body_included: z.literal(false),
});

export const GmailThreadMetadataSchema = z.strictObject({
  thread_id: ContractIdSchema,
  message_count: z.number().int().nonnegative(),
  participant_hashes: z.array(HashReferenceSchema).default([]),
  label_ids: z.array(MetadataTextSchema).default([]),
  first_message_at: IsoDateTimeSchema.nullable().default(null),
  last_message_at: IsoDateTimeSchema.nullable().default(null),
  raw_body_included: z.literal(false),
});

export const GmailAttachmentMetadataSchema = z.strictObject({
  attachment_id: ContractIdSchema,
  message_id: ContractIdSchema,
  filename_hash: MetadataHashSchema,
  mime_type: MetadataTextSchema.nullable().default(null),
  size_bytes: z.number().int().nonnegative().nullable().default(null),
  content_hash: MetadataHashSchema,
  download_supported: z.literal(false),
  raw_attachment_body_included: z.literal(false),
});

export const GmailSearchMessagesRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.gmail.search_messages.request"),
    operation: z.literal("gmail.search_messages"),
    service: z.literal("gmail"),
    query_metadata_hash: HashReferenceSchema,
    label_ids: z.array(MetadataTextSchema).default([]),
    window: GoogleAdapterMetadataWindowSchema,
    page: GoogleAdapterPageRequestSchema,
  });

export const GmailSearchMessagesResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.gmail.search_messages.result"),
    operation: z.literal("gmail.search_messages"),
    service: z.literal("gmail"),
    messages: z.array(GmailMessageMetadataSchema),
  });

export const GmailFetchMessageMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.gmail.fetch_message_metadata.request"),
    operation: z.literal("gmail.fetch_message_metadata"),
    service: z.literal("gmail"),
    message_id: ContractIdSchema,
  });

export const GmailFetchMessageMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.gmail.fetch_message_metadata.result"),
    operation: z.literal("gmail.fetch_message_metadata"),
    service: z.literal("gmail"),
    message: GmailMessageMetadataSchema,
  });

export const GmailFetchThreadMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.gmail.fetch_thread_metadata.request"),
    operation: z.literal("gmail.fetch_thread_metadata"),
    service: z.literal("gmail"),
    thread_id: ContractIdSchema,
  });

export const GmailFetchThreadMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.gmail.fetch_thread_metadata.result"),
    operation: z.literal("gmail.fetch_thread_metadata"),
    service: z.literal("gmail"),
    thread: GmailThreadMetadataSchema,
  });

export const GmailFetchAttachmentMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.gmail.fetch_attachment_metadata.request"),
    operation: z.literal("gmail.fetch_attachment_metadata"),
    service: z.literal("gmail"),
    attachment_id: ContractIdSchema,
    message_id: ContractIdSchema,
  });

export const GmailFetchAttachmentMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.gmail.fetch_attachment_metadata.result"),
    operation: z.literal("gmail.fetch_attachment_metadata"),
    service: z.literal("gmail"),
    attachment: GmailAttachmentMetadataSchema,
  });

export const CalendarEventMetadataSchema = z.strictObject({
  event_id: ContractIdSchema,
  calendar_id_hash: HashReferenceSchema,
  summary_hash: MetadataHashSchema,
  organizer_hash: MetadataHashSchema,
  attendee_count: z.number().int().nonnegative().default(0),
  start_at: IsoDateTimeSchema,
  end_at: IsoDateTimeSchema,
  location_hash: MetadataHashSchema,
  meeting_url_hash: MetadataHashSchema,
  status: z.enum(["confirmed", "tentative", "cancelled", "unknown"]),
  raw_description_included: z.literal(false),
});

export const CalendarAvailabilityMetadataSchema = z.strictObject({
  window: GoogleAdapterMetadataWindowSchema,
  calendar_count: z.number().int().nonnegative(),
  busy_window_count: z.number().int().nonnegative(),
  free_window_count: z.number().int().nonnegative(),
  raw_event_bodies_included: z.literal(false),
});

export const CalendarMeetingMetadataSchema = z.strictObject({
  meeting_id: ContractIdSchema,
  event_id: ContractIdSchema,
  provider_metadata_hash: MetadataHashSchema,
  attendee_count: z.number().int().nonnegative().default(0),
  recording_metadata_present: z.boolean().default(false),
  transcript_body_included: z.literal(false),
});

export const CalendarListEventsRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.calendar.list_events.request"),
    operation: z.literal("calendar.list_events"),
    service: z.literal("calendar"),
    calendar_id_hash: HashReferenceSchema,
    window: GoogleAdapterMetadataWindowSchema,
    page: GoogleAdapterPageRequestSchema,
  });

export const CalendarListEventsResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.calendar.list_events.result"),
    operation: z.literal("calendar.list_events"),
    service: z.literal("calendar"),
    events: z.array(CalendarEventMetadataSchema),
  });

export const CalendarFetchEventMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.calendar.fetch_event_metadata.request"),
    operation: z.literal("calendar.fetch_event_metadata"),
    service: z.literal("calendar"),
    event_id: ContractIdSchema,
    calendar_id_hash: HashReferenceSchema,
  });

export const CalendarFetchEventMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.calendar.fetch_event_metadata.result"),
    operation: z.literal("calendar.fetch_event_metadata"),
    service: z.literal("calendar"),
    event: CalendarEventMetadataSchema,
  });

export const CalendarFetchAvailabilityMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.calendar.fetch_availability_metadata.request"),
    operation: z.literal("calendar.fetch_availability_metadata"),
    service: z.literal("calendar"),
    calendar_id_hashes: z.array(HashReferenceSchema),
    window: GoogleAdapterMetadataWindowSchema,
  });

export const CalendarFetchAvailabilityMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.calendar.fetch_availability_metadata.result"),
    operation: z.literal("calendar.fetch_availability_metadata"),
    service: z.literal("calendar"),
    availability: CalendarAvailabilityMetadataSchema,
  });

export const CalendarFetchMeetingMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.calendar.fetch_meeting_metadata.request"),
    operation: z.literal("calendar.fetch_meeting_metadata"),
    service: z.literal("calendar"),
    meeting_id: ContractIdSchema,
    event_id: ContractIdSchema,
  });

export const CalendarFetchMeetingMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.calendar.fetch_meeting_metadata.result"),
    operation: z.literal("calendar.fetch_meeting_metadata"),
    service: z.literal("calendar"),
    meeting: CalendarMeetingMetadataSchema,
  });

export const DrivePermissionSummarySchema = z.strictObject({
  owner_hash: MetadataHashSchema,
  explicit_reader_count: z.number().int().nonnegative().default(0),
  explicit_writer_count: z.number().int().nonnegative().default(0),
  shared_externally: z.boolean().default(false),
  raw_permission_principals_included: z.literal(false),
});

export const DriveFileMetadataSchema = z.strictObject({
  file_id: ContractIdSchema,
  parent_folder_id: ContractIdSchema.nullable().default(null),
  name_hash: HashReferenceSchema,
  mime_type: MetadataTextSchema,
  size_bytes: z.number().int().nonnegative().nullable().default(null),
  created_at: IsoDateTimeSchema.nullable().default(null),
  modified_at: IsoDateTimeSchema.nullable().default(null),
  owner_hash: MetadataHashSchema,
  content_hash: MetadataHashSchema,
  permissions: DrivePermissionSummarySchema,
  download_supported: z.literal(false),
  raw_file_content_included: z.literal(false),
});

export const DriveFolderMetadataSchema = z.strictObject({
  folder_id: ContractIdSchema,
  parent_folder_id: ContractIdSchema.nullable().default(null),
  name_hash: HashReferenceSchema,
  child_file_count: z.number().int().nonnegative().default(0),
  child_folder_count: z.number().int().nonnegative().default(0),
  modified_at: IsoDateTimeSchema.nullable().default(null),
  owner_hash: MetadataHashSchema,
  permissions: DrivePermissionSummarySchema,
  raw_listing_body_included: z.literal(false),
});

export const DriveDocumentMetadataSchema = z.strictObject({
  document_id: ContractIdSchema,
  file_id: ContractIdSchema,
  title_hash: HashReferenceSchema,
  revision_id_hash: MetadataHashSchema,
  modified_at: IsoDateTimeSchema.nullable().default(null),
  owner_hash: MetadataHashSchema,
  word_count_estimate: z.number().int().nonnegative().nullable().default(null),
  content_hash: MetadataHashSchema,
  export_supported: z.literal(false),
  raw_document_body_included: z.literal(false),
});

export const DriveFetchFileMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.drive.fetch_file_metadata.request"),
    operation: z.literal("drive.fetch_file_metadata"),
    service: z.literal("drive"),
    file_id: ContractIdSchema,
  });

export const DriveFetchFileMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.drive.fetch_file_metadata.result"),
    operation: z.literal("drive.fetch_file_metadata"),
    service: z.literal("drive"),
    file: DriveFileMetadataSchema,
  });

export const DriveFetchFolderMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.drive.fetch_folder_metadata.request"),
    operation: z.literal("drive.fetch_folder_metadata"),
    service: z.literal("drive"),
    folder_id: ContractIdSchema,
  });

export const DriveFetchFolderMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.drive.fetch_folder_metadata.result"),
    operation: z.literal("drive.fetch_folder_metadata"),
    service: z.literal("drive"),
    folder: DriveFolderMetadataSchema,
  });

export const DriveFetchDocumentMetadataRequestSchema =
  GoogleAdapterBaseRequestSchema.extend({
    kind: z.literal("google.drive.fetch_document_metadata.request"),
    operation: z.literal("drive.fetch_document_metadata"),
    service: z.literal("drive"),
    document_id: ContractIdSchema,
  });

export const DriveFetchDocumentMetadataResultSchema =
  GoogleAdapterBaseResultSchema.extend({
    kind: z.literal("google.drive.fetch_document_metadata.result"),
    operation: z.literal("drive.fetch_document_metadata"),
    service: z.literal("drive"),
    document: DriveDocumentMetadataSchema,
  });

export const GoogleAdapterLibrarianEnvelopeSchema = z.strictObject({
  contract_version: z.literal(GOOGLE_ADAPTER_CONTRACT_VERSION),
  envelope_id: ContractIdSchema,
  source_type: GoogleAdapterLibrarianSourceTypeSchema,
  source_id: ContractIdSchema,
  source_ref: z.string().trim().min(1).max(240),
  service: GoogleAdapterServiceSchema,
  operation: GoogleAdapterOperationSchema,
  captured_at: IsoDateTimeSchema,
  content_hash: HashReferenceSchema,
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  durable_promotion_requires_approval: z.literal(true),
  canonical_promotion_requires_approval: z.literal(true),
  suggested_route_target: z.enum(["inbox", "research", "project", "career"]),
  write_authority: z.literal(false),
  execution_authority: z.literal(false),
});

export const GoogleAdapterVerificationMetadataSchema = z.strictObject({
  contract_version: z.literal(GOOGLE_ADAPTER_CONTRACT_VERSION),
  verification_ref_id: ContractIdSchema,
  service: GoogleAdapterServiceSchema,
  operation: GoogleAdapterOperationSchema,
  source_id: ContractIdSchema,
  evidence_types: z.array(GoogleAdapterVerificationEvidenceTypeSchema),
  suggested_risk_flags: z.array(GoogleAdapterVerificationRiskFlagSchema),
  supports_source_presence: z.literal(true),
  supports_date_freshness: z.literal(true),
  supports_metadata_consistency: z.literal(true),
  raw_body_required: z.literal(false),
  model_call_required: z.literal(false),
  advisory_only: z.literal(true),
});

export type GoogleAdapterService = z.infer<typeof GoogleAdapterServiceSchema>;
export type GoogleAdapterAuthorityLevel = z.infer<
  typeof GoogleAdapterAuthorityLevelSchema
>;
export type GoogleAdapterOperationClass = z.infer<
  typeof GoogleAdapterOperationClassSchema
>;
export type GoogleAdapterOperation = z.infer<
  typeof GoogleAdapterOperationSchema
>;
export type GoogleAdapterAuthorityMapping = z.infer<
  typeof GoogleAdapterAuthorityMappingSchema
>;
export type GoogleAdapterLibrarianEnvelope = z.infer<
  typeof GoogleAdapterLibrarianEnvelopeSchema
>;
export type GoogleAdapterVerificationMetadata = z.infer<
  typeof GoogleAdapterVerificationMetadataSchema
>;
export type GmailMessageMetadata = z.infer<typeof GmailMessageMetadataSchema>;
export type GmailThreadMetadata = z.infer<typeof GmailThreadMetadataSchema>;
export type GmailAttachmentMetadata = z.infer<
  typeof GmailAttachmentMetadataSchema
>;
export type CalendarEventMetadata = z.infer<typeof CalendarEventMetadataSchema>;
export type CalendarAvailabilityMetadata = z.infer<
  typeof CalendarAvailabilityMetadataSchema
>;
export type CalendarMeetingMetadata = z.infer<
  typeof CalendarMeetingMetadataSchema
>;
export type DriveFileMetadata = z.infer<typeof DriveFileMetadataSchema>;
export type DriveFolderMetadata = z.infer<typeof DriveFolderMetadataSchema>;
export type DriveDocumentMetadata = z.infer<typeof DriveDocumentMetadataSchema>;

export function getGoogleAdapterOperationAuthority(
  operation: GoogleAdapterOperation,
): GoogleAdapterAuthorityMapping {
  return GoogleAdapterAuthorityMappingSchema.parse(
    GOOGLE_ADAPTER_OPERATION_AUTHORITY[operation],
  );
}

export function createGoogleAdapterLibrarianEnvelope(input: {
  readonly envelope_id: string;
  readonly source_id: string;
  readonly source_ref: string;
  readonly service: GoogleAdapterService;
  readonly operation: GoogleAdapterOperation;
  readonly captured_at: string;
  readonly content_hash: string;
  readonly suggested_route_target?: "inbox" | "research" | "project" | "career";
}): GoogleAdapterLibrarianEnvelope {
  return GoogleAdapterLibrarianEnvelopeSchema.parse({
    contract_version: GOOGLE_ADAPTER_CONTRACT_VERSION,
    envelope_id: input.envelope_id,
    source_type: sourceTypeForService(input.service),
    source_id: input.source_id,
    source_ref: input.source_ref,
    service: input.service,
    operation: input.operation,
    captured_at: input.captured_at,
    content_hash: input.content_hash,
    metadata_only: true,
    raw_body_included: false,
    durable_promotion_requires_approval: true,
    canonical_promotion_requires_approval: true,
    suggested_route_target: input.suggested_route_target ?? "inbox",
    write_authority: false,
    execution_authority: false,
  });
}

export function createGoogleAdapterVerificationMetadata(input: {
  readonly verification_ref_id: string;
  readonly service: GoogleAdapterService;
  readonly operation: GoogleAdapterOperation;
  readonly source_id: string;
  readonly evidence_types?: readonly GoogleAdapterVerificationEvidenceType[];
  readonly suggested_risk_flags?: readonly GoogleAdapterVerificationRiskFlag[];
}): GoogleAdapterVerificationMetadata {
  return GoogleAdapterVerificationMetadataSchema.parse({
    contract_version: GOOGLE_ADAPTER_CONTRACT_VERSION,
    verification_ref_id: input.verification_ref_id,
    service: input.service,
    operation: input.operation,
    source_id: input.source_id,
    evidence_types: input.evidence_types ?? [
      "source_presence",
      "date_freshness",
      "metadata_consistency",
    ],
    suggested_risk_flags: input.suggested_risk_flags ?? [
      "insufficient_sources",
      "outdated_information",
    ],
    supports_source_presence: true,
    supports_date_freshness: true,
    supports_metadata_consistency: true,
    raw_body_required: false,
    model_call_required: false,
    advisory_only: true,
  });
}

function sourceTypeForService(
  service: GoogleAdapterService,
): z.infer<typeof GoogleAdapterLibrarianSourceTypeSchema> {
  if (service === "gmail") return "google_gmail";
  if (service === "calendar") return "google_calendar";
  return "google_drive";
}

export type GoogleAdapterVerificationEvidenceType = z.infer<
  typeof GoogleAdapterVerificationEvidenceTypeSchema
>;
export type GoogleAdapterVerificationRiskFlag = z.infer<
  typeof GoogleAdapterVerificationRiskFlagSchema
>;

export const GOOGLE_ADAPTER_GOVERNANCE_CONTRACT =
  GoogleAdapterGovernanceSchema.parse({
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
  });
